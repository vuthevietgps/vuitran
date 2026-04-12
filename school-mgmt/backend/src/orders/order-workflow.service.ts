import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { InvoicesService } from "../invoices/invoices.service";
import { Order, OrderDocument, OrderStatus } from "./schemas/order.schema";
import { Lead, LeadDocument, LeadStatus } from "../leads/schemas/lead.schema";
import { Invoice, InvoiceDocument } from "../invoices/schemas/invoice.schema";
import { AuditLogService } from "../audit-log/audit-log.service";
import { AuditAction } from "../audit-log/schemas/audit-log.schema";
import { EnrollmentService, EnrollmentResult } from "./enrollment.service";
import { JwtPayload } from "../common/interfaces/jwt-payload.interface";
import { Role } from "../common/interfaces/role.enum";

@Injectable()
export class OrderWorkflowService {
  private readonly logger = new Logger(OrderWorkflowService.name);

  constructor(
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    @InjectModel(Invoice.name) private invoiceModel: Model<InvoiceDocument>,
    @InjectModel(Lead.name) private leadModel: Model<LeadDocument>,
    private auditLogService: AuditLogService,
    private enrollmentService: EnrollmentService,
    private invoicesService: InvoicesService,
  ) {}

  private getActorId(user: JwtPayload): string {
    return user?.sub ?? user?._id ?? (user as any)?.userId;
  }

  private normalizeOptionalText(value?: string | null): string | undefined {
    const normalized = String(value ?? "").trim();
    return normalized || undefined;
  }

  private assertSaleOrderAccess(order: any, user: JwtPayload): void {
    if (user.role !== Role.SALE) return;
    const actorId = this.getActorId(user);
    const ownerSaleId = order?.saleId?.toString?.();
    if (!actorId || !ownerSaleId || ownerSaleId !== actorId) {
      throw new NotFoundException("Don hang khong ton tai");
    }
  }

  private async assertOrderInvoiceNumbersAvailable(
    items?: Array<{ invoiceNumber?: string }>,
  ): Promise<void> {
    if (!Array.isArray(items) || !items.length) {
      return;
    }

    const invoiceNumbers = items
      .map((item) => this.normalizeOptionalText(item?.invoiceNumber))
      .filter((value): value is string => !!value);

    if (!invoiceNumbers.length) {
      return;
    }

    const numberCounts = new Map<string, number>();
    for (const invoiceNumber of invoiceNumbers) {
      numberCounts.set(
        invoiceNumber,
        (numberCounts.get(invoiceNumber) || 0) + 1,
      );
    }

    const duplicatedNumbers = Array.from(numberCounts.entries())
      .filter(([, count]) => count > 1)
      .map(([invoiceNumber]) => invoiceNumber);
    if (duplicatedNumbers.length) {
      throw new BadRequestException(
        `So hoa don bi trung trong cung don: ${duplicatedNumbers.join(", ")}`,
      );
    }

    const existingInvoices = await this.invoiceModel
      .find({ invoiceNumber: { $in: invoiceNumbers } })
      .select("invoiceNumber")
      .lean();

    const conflictingNumbers = Array.from(
      new Set(
        existingInvoices
          .map((invoice: any) =>
            this.normalizeOptionalText(invoice?.invoiceNumber),
          )
          .filter((value): value is string => !!value),
      ),
    );
    if (conflictingNumbers.length) {
      throw new ConflictException(
        `So hoa don da ton tai: ${conflictingNumbers.join(", ")}`,
      );
    }
  }

  private roundMoneyToThousand(value?: number): number {
    const normalized = Number(value || 0);
    if (!Number.isFinite(normalized) || normalized <= 0) return 0;
    return Math.round(normalized / 1000) * 1000;
  }

  private floorSessionCount(value?: number): number {
    const normalized = Number(value || 0);
    if (!Number.isFinite(normalized) || normalized <= 0) return 0;
    return Math.floor(normalized);
  }

  private isOfflineTrialZeroAmountItem(item: any): boolean {
    const teachingMode = String(item?.teachingMode || "").trim().toUpperCase();
    const trialSessions = this.floorSessionCount(item?.trialSessions);
    const amount = this.roundMoneyToThousand(item?.amount);
    return teachingMode === "OFFLINE" && trialSessions > 0 && amount <= 0;
  }

  private isOfflineTrialApprovalExempt(order: any): boolean {
    const items = Array.isArray(order?.items) ? order.items : [];
    return items.length > 0 && items.every((item) => this.isOfflineTrialZeroAmountItem(item));
  }

  private shouldAutoApproveEnrollmentInvoices(order: any): boolean {
    const paymentPlan = String(order?.paymentPlan || "").toUpperCase();
    return !["INSTALLMENT_2", "INSTALLMENT_3"].includes(paymentPlan);
  }

  private validateOrderAmounts(order: any): void {
    const items = order.items || [];
    const totalAmount = Number(order.totalAmount || 0);
    const discountAmount = Number(order.discountAmount || 0);
    const finalAmount = Number(order.finalAmount || 0);

    if (finalAmount > totalAmount && totalAmount > 0) {
      throw new BadRequestException(
        `So tien cuoi (${finalAmount}) khong the lon hon tong (${totalAmount})`,
      );
    }

    const expectedFinal = totalAmount - discountAmount;
    if (discountAmount > 0 && Math.abs(finalAmount - expectedFinal) > 1) {
      this.logger.warn(
        `Order ${order.orderCode}: finalAmount (${finalAmount}) != totalAmount (${totalAmount}) - discount (${discountAmount}) = ${expectedFinal}`,
      );
    }

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.productId) {
        throw new BadRequestException(`San pham #${i + 1} thieu productId`);
      }
      if (!item.sessions || item.sessions < 1) {
        throw new BadRequestException(`San pham #${i + 1} thieu so buoi hoc`);
      }
    }

    if (order.paymentPlan && order.paymentPlan !== 'FULL') {
      const frames = order.paymentFrames || [];
      if (frames.length > 0) {
        const framesTotal = frames.reduce(
          (sum: number, f: any) => sum + Number(f.amount || 0),
          0,
        );
        if (Math.abs(framesTotal - finalAmount) > 1) {
          this.logger.warn(
            `Order ${order.orderCode}: payment frames total (${framesTotal}) != finalAmount (${finalAmount})`,
          );
        }
      }
    }
  }

  private async revertLeadConversion(order: any): Promise<void> {
    if (!order.leadId) return;
    try {
      const lead = await this.leadModel.findById(order.leadId);
      if (!lead) return;
      const convertedOrderId = (lead as any).convertedOrderId?.toString?.();
      if (convertedOrderId && convertedOrderId === order._id?.toString?.()) {
        (lead as any).convertedOrderId = undefined;
        lead.status = LeadStatus.CONTACTED;
        await lead.save();
        this.logger.log(`Reverted lead ${lead._id} from CONVERTED to CONTACTED (order ${order.orderCode})`);
      }
    } catch (err) {
      this.logger.warn(`Failed to revert lead ${order.leadId}: ${err instanceof Error ? err.message : err}`);
    }
  }

  async submit(id: string, user: JwtPayload): Promise<Order> {
    const actorId = this.getActorId(user);
    const order = await this.orderModel.findById(id).lean();
    if (!order) throw new NotFoundException("Don hang khong ton tai");
    this.assertSaleOrderAccess(order, user);

    const o = order as any;
    if (![OrderStatus.DRAFT, OrderStatus.NEEDS_INFO].includes(o.status)) {
      throw new BadRequestException(
        "Chi co the gui duyet don o trang thai Nhap hoac Can bo sung",
      );
    }

    if (!o.items || o.items.length === 0) {
      throw new BadRequestException(
        "Don hang phai co it nhat 1 san pham",
      );
    }

    await this.assertOrderInvoiceNumbersAvailable(o.items);

    const updated = await this.orderModel
      .findByIdAndUpdate(id, { status: OrderStatus.SUBMITTED }, { new: true })
      .lean();

    await this.auditLogService.log({
      userId: actorId,
      userEmail: user.email,
      userFullName: user.fullName,
      userRole: user.role,
      action: AuditAction.STATUS_CHANGE,
      module: "ORDERS" as any,
      targetId: id,
      targetName: o.orderCode,
      description: `Gui duyet don ${o.orderCode}`,
    });

    return updated as Order;
  }

  async approve(
    id: string,
    user: JwtPayload,
    approvalImage?: string,
  ): Promise<{ order: Order; enrollment: EnrollmentResult }> {
    const actorId = this.getActorId(user);

    const order = await this.orderModel.findOneAndUpdate(
      { _id: id, status: OrderStatus.SUBMITTED },
      {
        status: OrderStatus.APPROVED,
        approvedBy: actorId,
        approvedAt: new Date(),
      },
      { new: true },
    ).lean();

    if (!order) {
      const exists = await this.orderModel.findById(id).lean();
      if (!exists) throw new NotFoundException('Don hang khong ton tai');
      throw new BadRequestException('Chi co the duyet don dang cho duyet');
    }

    const o = order as any;

    const approvalProofRequired = !this.isOfflineTrialApprovalExempt(o);

    if (approvalProofRequired && !this.normalizeOptionalText(o.receiptImage)) {
      await this.orderModel.findByIdAndUpdate(id, { status: OrderStatus.SUBMITTED, $unset: { approvedBy: 1, approvedAt: 1 } });
      throw new BadRequestException(
        'Phai co hoa don sale upload truoc khi duyet don',
      );
    }

    const normalizedApprovalImage = this.normalizeOptionalText(approvalImage);
    if (approvalProofRequired && !normalizedApprovalImage) {
      await this.orderModel.findByIdAndUpdate(id, { status: OrderStatus.SUBMITTED, $unset: { approvedBy: 1, approvedAt: 1 } });
      throw new BadRequestException(
        'Phai tai hoa don doi ung truoc khi duyet don',
      );
    }

    await this.assertOrderInvoiceNumbersAvailable(o.items);

    if (normalizedApprovalImage) {
      await this.orderModel.findByIdAndUpdate(id, { approvalImage: normalizedApprovalImage });
    }

    this.validateOrderAmounts(o);

    const enrollment = await this.enrollmentService.processApprovedOrder(
      id,
      user,
      approvalImage,
    );
    const autoApprovalErrors: string[] = [];
    if (
      enrollment.success
      && Array.isArray(enrollment.invoiceIds)
      && this.shouldAutoApproveEnrollmentInvoices(o)
    ) {
      for (const invoiceId of enrollment.invoiceIds) {
        try {
          const approveInvoiceDto = normalizedApprovalImage
            ? { action: 'APPROVE', approvalImage: normalizedApprovalImage }
            : { action: 'APPROVE' };
          await this.invoicesService.approveInvoice(
            invoiceId,
            approveInvoiceDto as any,
            user,
          );
        } catch (error: any) {
          const message =
            error instanceof Error ? error.message : 'Khong the duyet hoa don';
          autoApprovalErrors.push(
            `Khong the duyet hoa don ${invoiceId}: ${message}`,
          );
        }
      }
    }

    if (!enrollment.success) {
      await this.orderModel.findByIdAndUpdate(id, {
        status: OrderStatus.SUBMITTED,
        $unset: { approvedBy: 1, approvedAt: 1, approvalImage: 1 },
      });
    } else {
      await this.auditLogService.log({
        userId: actorId,
        userEmail: user.email,
        userFullName: user.fullName,
        userRole: user.role,
        action: AuditAction.APPROVE,
        module: 'ORDERS' as any,
        targetId: id,
        targetName: o.orderCode,
        description: `Duyet don ${o.orderCode} - ${o.studentName}`,
      });
    }

    const updatedOrder = await this.orderModel.findById(id).lean();
    const mergedErrors = [...(enrollment.errors || []), ...autoApprovalErrors];
    const mergedEnrollment = autoApprovalErrors.length
      ? { ...enrollment, success: false, errors: mergedErrors }
      : enrollment;

    return {
      order: updatedOrder as Order,
      enrollment: mergedEnrollment,
    };
  }

  async reject(id: string, reason: string, user: JwtPayload): Promise<Order> {
    const actorId = this.getActorId(user);
    const order = await this.orderModel.findById(id).lean();
    if (!order) throw new NotFoundException("Don hang khong ton tai");

    const o = order as any;
    if (o.status !== OrderStatus.SUBMITTED) {
      throw new BadRequestException(
        "Chi co the tu choi don dang cho duyet",
      );
    }

    const updated = await this.orderModel
      .findByIdAndUpdate(
        id,
        { status: OrderStatus.REJECTED, rejectionReason: reason },
        { new: true },
      )
      .lean();

    await this.auditLogService.log({
      userId: actorId,
      userEmail: user.email,
      userFullName: user.fullName,
      userRole: user.role,
      action: AuditAction.REJECT,
      module: "ORDERS" as any,
      targetId: id,
      targetName: o.orderCode,
      description: `Tu choi don ${o.orderCode}: ${reason}`,
    });

    return updated as Order;
  }

  async requestInfo(
    id: string,
    reason: string,
    user: JwtPayload,
  ): Promise<Order> {
    const order = await this.orderModel.findById(id).lean();
    if (!order) throw new NotFoundException("Don hang khong ton tai");

    const o = order as any;
    if (o.status !== OrderStatus.SUBMITTED) {
      throw new BadRequestException(
        "Chi yeu cau bo sung cho don dang cho duyet",
      );
    }

    const updated = await this.orderModel
      .findByIdAndUpdate(
        id,
        { status: OrderStatus.NEEDS_INFO, needsInfoReason: reason },
        { new: true },
      )
      .lean();

    const actorId = this.getActorId(user);
    await this.auditLogService.log({
      userId: actorId,
      userEmail: user.email,
      userFullName: user.fullName,
      userRole: user.role,
      action: AuditAction.STATUS_CHANGE,
      module: "ORDERS" as any,
      targetId: id,
      targetName: o.orderCode,
      description: `Yeu cau bo sung don ${o.orderCode}: ${reason}`,
    });

    return updated as Order;
  }

  async cancel(id: string, user: JwtPayload): Promise<Order> {
    const actorId = this.getActorId(user);
    const order = await this.orderModel.findById(id).lean();
    if (!order) throw new NotFoundException("Don hang khong ton tai");
    this.assertSaleOrderAccess(order, user);

    const o = order as any;
    if ([OrderStatus.COMPLETED, OrderStatus.CANCELLED].includes(o.status)) {
      throw new BadRequestException(
        "Khong the huy don da hoan tat hoac da huy",
      );
    }

    if (o.status === OrderStatus.APPROVED) {
      if (user.role !== Role.DIRECTOR) {
        throw new BadRequestException(
          "Chi DIRECTOR moi co the huy don da duyet",
        );
      }
      if (o.processedResults?.invoiceIds?.length) {
        for (const invoiceId of o.processedResults.invoiceIds) {
          try {
            await this.invoicesService.cancelInvoice(
              invoiceId.toString(),
              user,
              `Huy tu don ${o.orderCode}`,
            );
          } catch (err) {
            this.logger.warn(
              `Failed to cancel invoice ${invoiceId} for order ${o.orderCode}: ${err instanceof Error ? err.message : err}`,
            );
          }
        }
      }
    }

    const updated = await this.orderModel
      .findByIdAndUpdate(id, { status: OrderStatus.CANCELLED }, { new: true })
      .lean();

    await this.revertLeadConversion(o);

    await this.auditLogService.log({
      userId: actorId,
      userEmail: user.email,
      userFullName: user.fullName,
      userRole: user.role,
      action: AuditAction.STATUS_CHANGE,
      module: "ORDERS" as any,
      targetId: id,
      targetName: o.orderCode,
      description: `Huy don ${o.orderCode}${o.status === OrderStatus.APPROVED ? ' (da huy hoa don lien quan)' : ''}`,
    });

    return updated as Order;
  }

  async remove(id: string, user: JwtPayload): Promise<Order> {
    const actorId = this.getActorId(user);
    const order = await this.orderModel.findById(id).lean();
    if (!order) throw new NotFoundException("Don hang khong ton tai");
    this.assertSaleOrderAccess(order, user);
    const o = order as any;
    if (![OrderStatus.DRAFT, OrderStatus.CANCELLED].includes(o.status)) {
      throw new BadRequestException(
        "Chi co the xoa don Nhap hoac Da huy",
      );
    }

    await this.orderModel.findByIdAndDelete(id);

    await this.revertLeadConversion(o);

    await this.auditLogService.log({
      userId: actorId,
      userEmail: user.email,
      userFullName: user.fullName,
      userRole: user.role,
      action: AuditAction.DELETE,
      module: "ORDERS" as any,
      targetId: id,
      targetName: o.orderCode,
      description: `Xoa don ${o.orderCode}`,
    });

    return order as Order;
  }

  async resubmit(id: string, user: JwtPayload): Promise<Order> {
    const actorId = this.getActorId(user);
    const order = await this.orderModel.findById(id).lean();
    if (!order) throw new NotFoundException("Don hang khong ton tai");
    this.assertSaleOrderAccess(order, user);

    const o = order as any;
    if (o.status !== OrderStatus.REJECTED) {
      throw new BadRequestException(
        "Chi co the gui lai don da bi tu choi",
      );
    }

    const updated = await this.orderModel
      .findByIdAndUpdate(
        id,
        {
          status: OrderStatus.DRAFT,
          $unset: { rejectionReason: 1 },
        },
        { new: true },
      )
      .lean();

    await this.auditLogService.log({
      userId: actorId,
      userEmail: user.email,
      userFullName: user.fullName,
      userRole: user.role,
      action: AuditAction.STATUS_CHANGE,
      module: "ORDERS" as any,
      targetId: id,
      targetName: o.orderCode,
      description: `Mo lai don bi tu choi ${o.orderCode} de chinh sua`,
    });

    return updated as Order;
  }

  async complete(id: string, user: JwtPayload): Promise<Order> {
    const actorId = this.getActorId(user);
    const order = await this.orderModel.findById(id).lean();
    if (!order) throw new NotFoundException("Don hang khong ton tai");

    const o = order as any;
    if (o.status !== OrderStatus.APPROVED) {
      throw new BadRequestException(
        "Chi co the hoan tat don da duyet",
      );
    }

    const updated = await this.orderModel
      .findByIdAndUpdate(
        id,
        { status: OrderStatus.COMPLETED },
        { new: true },
      )
      .lean();

    await this.auditLogService.log({
      userId: actorId,
      userEmail: user.email,
      userFullName: user.fullName,
      userRole: user.role,
      action: AuditAction.STATUS_CHANGE,
      module: "ORDERS" as any,
      targetId: id,
      targetName: o.orderCode,
      description: `Hoan tat don ${o.orderCode}`,
    });

    return updated as Order;
  }
}
