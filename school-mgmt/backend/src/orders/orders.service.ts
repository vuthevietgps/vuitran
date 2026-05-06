import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, FilterQuery, Types } from "mongoose";
import { InvoicesService } from "../invoices/invoices.service";
import {
  Order,
  OrderDocument,
  OrderStatus,
  PaymentPlan,
} from "./schemas/order.schema";
import { Lead, LeadDocument, LeadStatus } from "../leads/schemas/lead.schema";
import { Student, StudentDocument } from "../students/schemas/student.schema";
import { User, UserDocument } from "../users/schemas/user.schema";
import { Invoice, InvoiceDocument, InvoiceStatus } from "../invoices/schemas/invoice.schema";
import { CreateOrderDto } from "./dto/create-order.dto";
import { UpdateOrderDto } from "./dto/update-order.dto";
import { QueryOrderDto } from "./dto/query-order.dto";
import { AuditLogService } from "../audit-log/audit-log.service";
import { AuditAction } from "../audit-log/schemas/audit-log.schema";
import { EnrollmentService, EnrollmentResult } from "./enrollment.service";
import { JwtPayload } from "../common/interfaces/jwt-payload.interface";
import { Role } from "../common/interfaces/role.enum";
import { MarketingAttributionService } from "../marketing-attribution/marketing-attribution.service";
import { OrderWorkflowService } from "./order-workflow.service";
import {
  ParentAttributionModel,
  ParentAttributionSourceType,
} from "../marketing-attribution/schemas/parent-attribution.schema";
import { mergeTrackingAttribution } from "../marketing-attribution/parent-attribution.util";

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    @InjectModel(Invoice.name) private invoiceModel: Model<InvoiceDocument>,
    @InjectModel(Lead.name) private leadModel: Model<LeadDocument>,
    @InjectModel(Student.name) private studentModel: Model<StudentDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private auditLogService: AuditLogService,
    private enrollmentService: EnrollmentService,
    private invoicesService: InvoicesService,
    private marketingAttributionService: MarketingAttributionService,
    private orderWorkflowService: OrderWorkflowService,
  ) {}

  private getActorId(user: JwtPayload): string {
    return user?.sub ?? user?._id ?? (user as any)?.userId;
  }

  private normalizeOptionalText(value?: string | null): string | undefined {
    const normalized = String(value ?? "").trim();
    return normalized || undefined;
  }

  private roundMoneyToThousand(value?: number): number {
    const normalized = Number(value || 0);
    if (!Number.isFinite(normalized) || normalized <= 0) return 0;
    return Math.round(normalized / 1000) * 1000;
  }

  private getInstallmentFrameCount(paymentPlan?: string | null): number {
    switch (paymentPlan) {
      case PaymentPlan.INSTALLMENT_2:
        return 2;
      case PaymentPlan.INSTALLMENT_3:
        return 3;
      default:
        return 0;
    }
  }

  private splitAmountIntoFrames(totalAmount: number, frameCount: number): number[] {
    const normalizedTotal = this.roundMoneyToThousand(totalAmount);
    if (frameCount <= 0 || normalizedTotal <= 0) {
      return [];
    }

    const baseAmount = Math.floor(normalizedTotal / frameCount / 1000) * 1000;
    const remainder = normalizedTotal - baseAmount * frameCount;

    return Array.from({ length: frameCount }, (_, index) =>
      index === frameCount - 1 ? baseAmount + remainder : baseAmount,
    );
  }

  private normalizePaymentDate(value?: string | Date | null): Date {
    const fallback = new Date();
    if (!value) {
      return new Date(
        Date.UTC(
          fallback.getUTCFullYear(),
          fallback.getUTCMonth(),
          fallback.getUTCDate(),
        ),
      );
    }

    if (typeof value === "string") {
      const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
      if (dateOnlyMatch) {
        const [, year, month, day] = dateOnlyMatch;
        return new Date(
          Date.UTC(Number(year), Number(month) - 1, Number(day)),
        );
      }
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return new Date(
        Date.UTC(
          fallback.getUTCFullYear(),
          fallback.getUTCMonth(),
          fallback.getUTCDate(),
        ),
      );
    }
    return new Date(
      Date.UTC(
        parsed.getUTCFullYear(),
        parsed.getUTCMonth(),
        parsed.getUTCDate(),
      ),
    );
  }

  private buildPaymentFrames(
    paymentPlan?: string | null,
    finalAmount?: number,
    paymentDate?: string | Date | null,
  ): Array<{ dueDate: Date; amount: number; status: "PENDING" | "PAID" }> {
    const frameCount = this.getInstallmentFrameCount(paymentPlan);
    const amounts = this.splitAmountIntoFrames(Number(finalAmount || 0), frameCount);
    if (!amounts.length) {
      return [];
    }

    const baseDate = this.normalizePaymentDate(paymentDate);
    return amounts.map((amount, index) => {
      const dueDate = new Date(baseDate);
      dueDate.setMonth(dueDate.getMonth() + index);
      return {
        dueDate,
        amount,
        status: "PENDING",
      };
    });
  }

  private normalizeOrderPayload<T extends { items?: any[] }>(dto: T): T {
    if (!Array.isArray(dto?.items)) {
      return dto;
    }

    return {
      ...dto,
      items: dto.items.map((item) => {
        const normalizedItem = { ...(item || {}) };
        const invoiceNumber = this.normalizeOptionalText(
          normalizedItem.invoiceNumber,
        );
        if (invoiceNumber) {
          normalizedItem.invoiceNumber = invoiceNumber;
        } else {
          delete normalizedItem.invoiceNumber;
        }
        delete normalizedItem.paymentRound;
        return normalizedItem;
      }),
    };
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

  private assertSaleOrderAccess(order: any, user: JwtPayload): void {
    if (user.role !== Role.SALE) return;
    const actorId = this.getActorId(user);
    const ownerSaleId = order?.saleId?.toString?.();
    if (!actorId || !ownerSaleId || ownerSaleId !== actorId) {
      throw new NotFoundException("Don hang khong ton tai");
    }
  }

  private async findSaleUser(saleId: string | Types.ObjectId): Promise<any> {
    const sale = await this.userModel
      .findOne({ _id: saleId, role: Role.SALE })
      .select("_id fullName email")
      .lean();
    if (!sale) {
      throw new BadRequestException("Sale phu trach khong hop le");
    }
    return sale;
  }

  private async resolveOrderSaleOwner(
    dto: Pick<
      CreateOrderDto,
      "leadId" | "existingStudentId" | "saleId" | "parentUserId"
    >,
    user: JwtPayload,
    leadForConversion?: LeadDocument | null,
  ): Promise<{ saleId: Types.ObjectId; saleName: string }> {
    const actorId = this.getActorId(user);

    const lead = dto.leadId
      ? (leadForConversion ??
        (await this.leadModel
          .findById(dto.leadId)
          .select("saleId saleName")
          .lean()))
      : null;
    if (dto.leadId && !lead) {
      throw new NotFoundException("Lead khong ton tai");
    }

    const student = dto.existingStudentId
      ? await this.studentModel
          .findById(dto.existingStudentId)
          .select("saleId saleName")
          .lean()
      : null;
    if (dto.existingStudentId && !student) {
      throw new NotFoundException("Hoc sinh khong ton tai");
    }

    const parent = dto.parentUserId
      ? await this.userModel
          .findById(dto.parentUserId)
          .select("role saleOwnerId saleOwnerName")
          .lean()
      : null;
    if (dto.parentUserId && !parent) {
      throw new NotFoundException("Phu huynh khong ton tai");
    }
    if (parent && parent.role !== Role.PARENT) {
      throw new BadRequestException(
        "parentUserId khong phai tai khoan phu huynh",
      );
    }

    const leadSaleId = lead?.saleId?.toString?.() || null;
    const studentSaleId = student?.saleId?.toString?.() || null;
    const parentSaleId = (parent as any)?.saleOwnerId?.toString?.() || null;
    const leadSaleName = (lead as any)?.saleName || null;
    const studentSaleName = (student as any)?.saleName || null;
    const parentSaleName = (parent as any)?.saleOwnerName || null;

    const uniqueOwnerIds = Array.from(
      new Set(
        [leadSaleId, studentSaleId, parentSaleId].filter(
          (value): value is string => !!value,
        ),
      ),
    );
    if (uniqueOwnerIds.length > 1) {
      throw new BadRequestException(
        "Lead, phu huynh va hoc sinh dang thuoc cac sale khac nhau",
      );
    }

    if (user.role === Role.SALE) {
      if (dto.leadId && leadSaleId !== actorId) {
        throw new NotFoundException("Lead khong ton tai");
      }
      if (dto.existingStudentId && studentSaleId !== actorId) {
        throw new NotFoundException("Hoc sinh khong ton tai");
      }
      if (dto.parentUserId && parentSaleId && parentSaleId !== actorId) {
        throw new NotFoundException("Phu huynh khong ton tai");
      }
      return {
        saleId: new Types.ObjectId(actorId),
        saleName: user.fullName || user.email,
      };
    }

    const lockedOwnerId = leadSaleId || studentSaleId || parentSaleId;
    const lockedOwnerName = leadSaleName || studentSaleName || parentSaleName;

    if (dto.saleId) {
      const requestedSale = await this.findSaleUser(dto.saleId);
      if (lockedOwnerId && requestedSale._id.toString() !== lockedOwnerId) {
        throw new BadRequestException(
          leadSaleId
            ? "Lead da co sale phu trach. Hay chuyen lead truoc khi tao don"
            : "Hoc sinh da co sale phu trach. Hay cap nhat owner truoc khi tao don",
        );
      }
      return {
        saleId: requestedSale._id as Types.ObjectId,
        saleName: requestedSale.fullName || requestedSale.email,
      };
    }

    if (lockedOwnerId) {
      if (lockedOwnerName) {
        return {
          saleId: new Types.ObjectId(lockedOwnerId),
          saleName: lockedOwnerName,
        };
      }
      const inferredSale = await this.findSaleUser(lockedOwnerId);
      return {
        saleId: inferredSale._id as Types.ObjectId,
        saleName: inferredSale.fullName || inferredSale.email,
      };
    }

    throw new BadRequestException("Phai chon sale phu trach cho don hang");
  }

  private async generateOrderCode(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `ORD-${year}-`;

    // Retry loop to handle concurrent order creation
    for (let attempt = 0; attempt < 5; attempt++) {
      const last = await this.orderModel
        .findOne({ orderCode: { $regex: `^${prefix}` } })
        .sort({ orderCode: -1 })
        .lean();
      let nextNum = 1;
      if (last) {
        const parts = last.orderCode.split("-");
        nextNum = parseInt(parts[2], 10) + 1;
      }
      const code = `${prefix}${String(nextNum).padStart(4, "0")}`;

      const exists = await this.orderModel.exists({ orderCode: code });
      if (!exists) return code;

      this.logger.warn(`OrderCode ${code} conflict, retrying (attempt ${attempt + 1})`);
    }

    // Fallback: append timestamp suffix to guarantee uniqueness
    const ts = Date.now().toString(36);
    return `${prefix}${ts}`;
  }

  async create(dto: CreateOrderDto, user: JwtPayload): Promise<Order> {
    const normalizedDto = this.normalizeOrderPayload(dto);
    (normalizedDto as any).paymentPlan = PaymentPlan.FULL;
    (normalizedDto as any).paymentFrames = [];
    await this.assertOrderInvoiceNumbersAvailable(normalizedDto.items);

    const orderCode = await this.generateOrderCode();
    const actorId = this.getActorId(user);

    // Resolve adGroupId: Lead takes priority over direct assignment
    let adGroupId = normalizedDto.adGroupId;
    let adGroupName = normalizedDto.adGroupName;
    let tracking = normalizedDto.tracking;
    let leadForConversion: LeadDocument | null = null;
    if (normalizedDto.leadId) {
      leadForConversion = await this.leadModel.findById(normalizedDto.leadId);
      if (!leadForConversion) {
        throw new NotFoundException("Lead khong ton tai");
      }

      if ((leadForConversion as any).convertedOrderId) {
        throw new BadRequestException("Lead da co don dang ky lien ket");
      }
      if (
        (leadForConversion as any).status === LeadStatus.NOT_INTERESTED ||
        (leadForConversion as any).status === LeadStatus.NO_RESPONSE
      ) {
        throw new BadRequestException(
          "Khong the tao don tu lead da mat hoac khong phan hoi",
        );
      }

      if (leadForConversion.adGroupId) {
        adGroupId = leadForConversion.adGroupId.toString();
        adGroupName = (leadForConversion as any).adGroupName || adGroupName;
      }

      tracking = mergeTrackingAttribution(
        (leadForConversion as any).tracking,
        normalizedDto.tracking,
        true,
      ) as any;
    }

    const saleOwner = await this.resolveOrderSaleOwner(
      normalizedDto,
      user,
      leadForConversion,
    );

    // SALE không được tự set hoa hồng
    if (user.role === Role.SALE) {
      delete (normalizedDto as any).saleCommission;
    }

    const order = new this.orderModel({
      ...normalizedDto,
      orderCode,
      status: OrderStatus.DRAFT,
      saleId: saleOwner.saleId,
      saleName: saleOwner.saleName,
      adGroupId,
      adGroupName,
      tracking,
    });
    const saved = await order.save();

    if (leadForConversion) {
      leadForConversion.status = LeadStatus.CONVERTED;
      (leadForConversion as any).convertedOrderId = (saved as any)._id;
      await leadForConversion.save();
    }

    await this.marketingAttributionService.upsertParentAttribution({
      parentUserId: (saved as any).parentUserId,
      referredByUserId: normalizedDto.referredByUserId,
      parentPhone: saved.parentPhone,
      parentEmail: saved.parentEmail,
      adGroupId: saved.adGroupId,
      adGroupName: saved.adGroupName,
      platform: saved.leadSource,
      tracking: saved.tracking,
      sourceLeadId: saved.leadId,
      sourceOrderId: saved._id,
      attributionModel:
        normalizedDto.adGroupId && !leadForConversion
          ? ParentAttributionModel.MANUAL_OVERRIDE
          : undefined,
      sourceType:
        normalizedDto.adGroupId && !leadForConversion
          ? ParentAttributionSourceType.MANUAL
          : ParentAttributionSourceType.ORDER,
    });

    await this.auditLogService.log({
      userId: actorId,
      userEmail: user.email,
      userFullName: user.fullName,
      userRole: user.role,
      action: AuditAction.CREATE,
      module: "ORDERS" as any,
      targetId: saved._id?.toString(),
      targetName: saved.orderCode,
      description: `Tao don dang ky: ${saved.orderCode} - ${saved.studentName}`,
    });

    return saved;
  }

  async findAll(query: QueryOrderDto, user: JwtPayload) {
    const filter: FilterQuery<OrderDocument> = {};
    const actorId = this.getActorId(user);

    if (query.status) filter.status = query.status;
    if (query.orderType) filter.orderType = query.orderType;
    if (query.saleId) filter.saleId = query.saleId;

    if (query.search) {
      const escaped = query.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.$or = [
        { parentName: { $regex: escaped, $options: "i" } },
        { parentPhone: { $regex: escaped, $options: "i" } },
        { studentName: { $regex: escaped, $options: "i" } },
        { studentCode: { $regex: escaped, $options: "i" } },
        { orderCode: { $regex: escaped, $options: "i" } },
      ];
    }

    if (query.fromDate || query.toDate) {
      filter.createdAt = {};
      if (query.fromDate) filter.createdAt.$gte = new Date(query.fromDate);
      if (query.toDate)
        filter.createdAt.$lte = new Date(query.toDate + "T23:59:59.999Z");
    }

    // SALE only sees their own orders
    if (user.role === Role.SALE) {
      filter.saleId = actorId;
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.orderModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      this.orderModel.countDocuments(filter),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string, user?: JwtPayload): Promise<Order> {
    const order = await this.orderModel.findById(id).lean();
    if (!order) throw new NotFoundException("Don hang khong ton tai");
    if (user) this.assertSaleOrderAccess(order, user);
    return order as Order;
  }

  async update(
    id: string,
    dto: UpdateOrderDto,
    user: JwtPayload,
  ): Promise<Order> {
    const actorId = this.getActorId(user);
    const order = await this.orderModel.findById(id).lean();
    if (!order) throw new NotFoundException("Don hang khong ton tai");
    this.assertSaleOrderAccess(order, user);
    const o = order as any;
    if (![OrderStatus.DRAFT, OrderStatus.NEEDS_INFO].includes(o.status)) {
      throw new BadRequestException(
        "Chi co the sua don o trang thai Nhap hoac Can bo sung",
      );
    }

    const updateData: any = this.normalizeOrderPayload({ ...dto });
    if (updateData.items) {
      await this.assertOrderInvoiceNumbersAvailable(updateData.items);
    }
    if (user.role === Role.SALE) {
      delete updateData.saleId;
      delete updateData.saleCommission;
    }

    const hasOwn = (key: string) =>
      Object.prototype.hasOwnProperty.call(updateData, key);
    const shouldResolveOwner =
      hasOwn("saleId") ||
      hasOwn("leadId") ||
      hasOwn("existingStudentId") ||
      hasOwn("parentUserId");

    if (shouldResolveOwner) {
      const saleOwner = await this.resolveOrderSaleOwner(
        {
          leadId: hasOwn("leadId")
            ? updateData.leadId ?? undefined
            : o.leadId?.toString?.(),
          existingStudentId: hasOwn("existingStudentId")
            ? updateData.existingStudentId ?? undefined
            : o.existingStudentId?.toString?.(),
          parentUserId: hasOwn("parentUserId")
            ? updateData.parentUserId ?? undefined
            : o.parentUserId?.toString?.(),
          saleId: hasOwn("saleId")
            ? updateData.saleId ?? undefined
            : o.saleId?.toString?.(),
        },
        user,
      );
      updateData.saleId = saleOwner.saleId;
      updateData.saleName = saleOwner.saleName;
    }

    updateData.paymentPlan = PaymentPlan.FULL;
    updateData.paymentFrames = [];

    const updated = await this.orderModel
      .findByIdAndUpdate(id, updateData, { new: true })
      .lean();
    if (updated) {
      await this.marketingAttributionService.upsertParentAttribution({
        parentUserId: (updated as any).parentUserId,
        referredByUserId: updateData.referredByUserId,
        parentPhone: updated.parentPhone,
        parentEmail: updated.parentEmail,
        adGroupId: (updated as any).adGroupId,
        adGroupName: (updated as any).adGroupName,
        platform: (updated as any).leadSource,
        tracking: (updated as any).tracking,
        sourceLeadId: (updated as any).leadId,
        sourceOrderId: (updated as any)._id,
        attributionModel:
          updateData.adGroupId !== undefined
            ? ParentAttributionModel.MANUAL_OVERRIDE
            : undefined,
        sourceType:
          updateData.adGroupId !== undefined
            ? ParentAttributionSourceType.MANUAL
            : ParentAttributionSourceType.ORDER,
      });
    }

    await this.auditLogService.log({
      userId: actorId,
      userEmail: user.email,
      userFullName: user.fullName,
      userRole: user.role,
      action: AuditAction.UPDATE,
      module: "ORDERS" as any,
      targetId: id,
      targetName: o.orderCode,
      description: `Cap nhat don ${o.orderCode}`,
      newValue: updateData as any,
    });

    return updated as Order;
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
    const order = await this.orderModel.findById(id).lean();
    if (!order) throw new NotFoundException('ÄÆ¡n hÃ ng khÃ´ng tá»"n táº¡i');

    const o = order as any;
    if (o.status !== OrderStatus.SUBMITTED) {
      throw new BadRequestException("Chi co the duyet don dang cho duyet");
    }

    // ÄÃ¡nh dáº¥u APPROVED trÆ°á»›c
    await this.assertOrderInvoiceNumbersAvailable(o.items);

    // Atomic update: chỉ approve nếu status vẫn là SUBMITTED (tránh race condition)
    const updated = await this.orderModel.findOneAndUpdate(
      { _id: id, status: OrderStatus.SUBMITTED },
      {
        status: OrderStatus.APPROVED,
        approvedBy: actorId,
        approvedAt: new Date(),
        ...(approvalImage ? { approvalImage } : {}),
      },
      { new: true },
    );

    if (!updated) {
      throw new BadRequestException("Chi co the duyet don dang cho duyet");
    }

    // Audit log duyá»‡t Ä‘Æ¡n
    await this.auditLogService.log({
      userId: actorId,
      userEmail: user.email,
      userFullName: user.fullName,
      userRole: user.role,
      action: AuditAction.APPROVE,
      module: "ORDERS" as any,
      targetId: id,
      targetName: o.orderCode,
      description: `Duyá»‡t Ä‘Æ¡n ${o.orderCode} - ${o.studentName}`,
    });

    // Auto-enrollment: táº¡o Student, Invoice, ghi log
    const enrollment = await this.enrollmentService.processApprovedOrder(
      id,
      user,
    );

    // Rollback status neu enrollment that bai
    if (!enrollment.success) {
      await this.orderModel.findByIdAndUpdate(id, {
        status: OrderStatus.SUBMITTED,
        $unset: { approvedBy: 1, approvedAt: 1 },
      });
      this.logger.error(
        `Enrollment failed for order ${o.orderCode}, reverted to SUBMITTED: ${enrollment.errors?.join(', ')}`,
      );
    }

    // Láº¥y láº¡i order sau khi enrollment cáº­p nháº­t
    const updatedOrder = await this.orderModel.findById(id).lean();

    return {
      order: updatedOrder as Order,
      enrollment,
    };
  }

  async reject(id: string, reason: string, user: JwtPayload): Promise<Order> {
    const actorId = this.getActorId(user);
    const order = await this.orderModel.findById(id).lean();
    if (!order) throw new NotFoundException("ÄÆ¡n hÃ ng khÃ´ng tá»“n táº¡i");

    const o = order as any;
    if (o.status !== OrderStatus.SUBMITTED) {
      throw new BadRequestException(
        "Chá»‰ cÃ³ thá»ƒ tá»« chá»‘i Ä‘Æ¡n Ä‘ang chá» duyá»‡t",
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
      description: `Tá»« chá»‘i Ä‘Æ¡n ${o.orderCode}: ${reason}`,
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

    await this.auditLogService.log({
      userId: this.getActorId(user),
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
    if (!order) throw new NotFoundException("ÄÆ¡n hÃ ng khÃ´ng tá»“n táº¡i");
    this.assertSaleOrderAccess(order, user);

    const o = order as any;
    if ([OrderStatus.COMPLETED, OrderStatus.CANCELLED].includes(o.status)) {
      throw new BadRequestException(
        "KhÃ´ng thá»ƒ há»§y Ä‘Æ¡n Ä‘Ã£ hoÃ n táº¥t hoáº·c Ä‘Ã£ há»§y",
      );
    }

    const updated = await this.orderModel
      .findByIdAndUpdate(id, { status: OrderStatus.CANCELLED }, { new: true })
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
      description: `Há»§y Ä‘Æ¡n ${o.orderCode}`,
    });

    return updated as Order;
  }

  async resubmit(id: string, user: JwtPayload): Promise<Order> {
    const actorId = this.getActorId(user);
    const order = await this.orderModel.findById(id).lean();
    if (!order) throw new NotFoundException("Don hang khong ton tai");
    this.assertSaleOrderAccess(order, user);

    const o = order as any;
    if (o.status !== OrderStatus.REJECTED) {
      throw new BadRequestException(
        "Chi co the gui lai don bi tu choi",
      );
    }

    const updated = await this.orderModel
      .findByIdAndUpdate(id, { status: OrderStatus.SUBMITTED, rejectionReason: null }, { new: true })
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
      description: `Gui lai don ${o.orderCode} sau khi bi tu choi`,
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
      .findByIdAndUpdate(id, { status: OrderStatus.COMPLETED }, { new: true })
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

  async getPipeline(user: JwtPayload) {
    const match: any = {};
    if (user.role === Role.SALE) {
      const actorId = this.getActorId(user);
      match.saleId = new Types.ObjectId(actorId);
    }

    const pipeline = await this.orderModel.aggregate([
      { $match: match },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          totalValue: { $sum: "$finalAmount" },
        },
      },
    ]);

    const result: Record<string, { count: number; totalValue: number }> = {};
    for (const status of Object.values(OrderStatus)) {
      result[status] = { count: 0, totalValue: 0 };
    }
    for (const item of pipeline) {
      result[item._id] = {
        count: item.count,
        totalValue: item.totalValue || 0,
      };
    }

    return result;
  }

  async getStats(user: JwtPayload) {
    const thisMonthStart = new Date(
      new Date().getFullYear(),
      new Date().getMonth(),
      1,
    );
    const match: any = {};
    if (user.role === Role.SALE) {
      const actorId = this.getActorId(user);
      match.saleId = new Types.ObjectId(actorId);
    }

    const stats = await this.orderModel.aggregate([
      { $match: match },
      {
        $facet: {
          overview: [
            {
              $group: {
                _id: null,
                total: { $sum: 1 },
                approved: {
                  $sum: {
                    $cond: [
                      { $in: ["$status", ["APPROVED", "COMPLETED"]] },
                      1,
                      0,
                    ],
                  },
                },
                totalRevenue: {
                  $sum: {
                    $cond: [
                      { $in: ["$status", ["APPROVED", "COMPLETED"]] },
                      "$finalAmount",
                      0,
                    ],
                  },
                },
                totalCommission: {
                  $sum: {
                    $cond: [
                      { $in: ["$status", ["APPROVED", "COMPLETED"]] },
                      "$saleCommission",
                      0,
                    ],
                  },
                },
              },
            },
          ],
          thisMonth: [
            { $match: { createdAt: { $gte: thisMonthStart } } },
            {
              $group: {
                _id: null,
                count: { $sum: 1 },
                revenue: {
                  $sum: {
                    $cond: [
                      { $in: ["$status", ["APPROVED", "COMPLETED"]] },
                      "$finalAmount",
                      0,
                    ],
                  },
                },
              },
            },
          ],
          bySale: [
            {
              $group: {
                _id: { saleId: "$saleId", saleName: "$saleName" },
                total: { $sum: 1 },
                approved: {
                  $sum: {
                    $cond: [
                      { $in: ["$status", ["APPROVED", "COMPLETED"]] },
                      1,
                      0,
                    ],
                  },
                },
                revenue: {
                  $sum: {
                    $cond: [
                      { $in: ["$status", ["APPROVED", "COMPLETED"]] },
                      "$finalAmount",
                      0,
                    ],
                  },
                },
              },
            },
          ],
          byType: [{ $group: { _id: "$orderType", count: { $sum: 1 } } }],
          bySource: [
            { $match: { leadSource: { $ne: null } } },
            { $group: { _id: "$leadSource", count: { $sum: 1 } } },
          ],
          pendingValue: [
            { $match: { status: "SUBMITTED" } },
            {
              $group: {
                _id: null,
                count: { $sum: 1 },
                total: { $sum: "$finalAmount" },
              },
            },
          ],
        },
      },
    ]);

    const data = stats[0];
    const overview = data.overview[0] || {
      total: 0,
      submitted: 0,
      approved: 0,
      totalRevenue: 0,
      totalCommission: 0,
    };

    return {
      total: overview.total,
      approved: overview.approved,
      conversionRate:
        overview.total > 0
          ? Math.round((overview.approved / overview.total) * 100)
          : 0,
      totalRevenue: overview.totalRevenue,
      totalCommission: overview.totalCommission,
      thisMonth: data.thisMonth[0] || { count: 0, revenue: 0 },
      bySale: data.bySale.map((s: any) => ({
        saleId: s._id.saleId,
        saleName: s._id.saleName,
        total: s.total,
        approved: s.approved,
        conversionRate:
          s.total > 0 ? Math.round((s.approved / s.total) * 100) : 0,
        revenue: s.revenue,
      })),
      byType: data.byType,
      bySource: data.bySource,
      pendingOrders: data.pendingValue[0]?.count || 0,
      pendingValue: data.pendingValue[0]?.total || 0,
    };
  }

  async remove(id: string, user: JwtPayload): Promise<Order> {
    const actorId = this.getActorId(user);
    const order = await this.orderModel.findById(id).lean();
    if (!order) throw new NotFoundException("ÄÆ¡n hÃ ng khÃ´ng tá»“n táº¡i");
    this.assertSaleOrderAccess(order, user);
    const o = order as any;
    if (![OrderStatus.DRAFT, OrderStatus.CANCELLED].includes(o.status)) {
      throw new BadRequestException(
        "Chá»‰ cÃ³ thá»ƒ xÃ³a Ä‘Æ¡n NhÃ¡p hoáº·c ÄÃ£ há»§y",
      );
    }

    await this.orderModel.findByIdAndDelete(id);

    await this.auditLogService.log({
      userId: actorId,
      userEmail: user.email,
      userFullName: user.fullName,
      userRole: user.role,
      action: AuditAction.DELETE,
      module: "ORDERS" as any,
      targetId: id,
      targetName: o.orderCode,
      description: `XÃ³a Ä‘Æ¡n ${o.orderCode}`,
    });

    return order as Order;
  }

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // COMMISSION REPORT (Phase 1.3)
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

  async getCommissionReport(
    saleId?: string,
    fromDate?: string,
    toDate?: string,
  ) {
    const match: FilterQuery<OrderDocument> = {};
    if (saleId) match.saleId = new Types.ObjectId(saleId);
    if (fromDate || toDate) {
      match.createdAt = {};
      if (fromDate) match.createdAt.$gte = new Date(fromDate);
      if (toDate) match.createdAt.$lte = new Date(toDate + "T23:59:59.999Z");
    }

    const result = await this.orderModel.aggregate([
      { $match: match },
      {
        $facet: {
          details: [
            { $sort: { createdAt: -1 as const } },
            {
              $project: {
                orderCode: 1,
                parentName: 1,
                studentName: 1,
                finalAmount: { $ifNull: ["$finalAmount", 0] },
                saleCommission: { $ifNull: ["$saleCommission", 0] },
                status: 1,
                saleName: 1,
                saleId: 1,
                createdAt: 1,
              },
            },
          ],
          byMonth: [
            {
              $match: { status: { $in: ["COMPLETED", "APPROVED"] } },
            },
            {
              $group: {
                _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
                revenue: { $sum: { $ifNull: ["$finalAmount", 0] } },
                commission: { $sum: { $ifNull: ["$saleCommission", 0] } },
                count: { $sum: 1 },
              },
            },
            { $sort: { _id: -1 as const } },
            {
              $project: {
                _id: 0,
                month: "$_id",
                revenue: 1,
                commission: 1,
                count: 1,
              },
            },
          ],
          summary: [
            {
              $group: {
                _id: null,
                totalOrders: { $sum: 1 },
                totalRevenue: {
                  $sum: {
                    $cond: [
                      { $in: ["$status", ["APPROVED", "COMPLETED"]] },
                      { $ifNull: ["$finalAmount", 0] },
                      0,
                    ],
                  },
                },
                totalCommission: {
                  $sum: {
                    $cond: [
                      { $in: ["$status", ["APPROVED", "COMPLETED"]] },
                      { $ifNull: ["$saleCommission", 0] },
                      0,
                    ],
                  },
                },
              },
            },
          ],
        },
      },
    ]);

    const data = result[0];
    return {
      details: data.details,
      byMonth: data.byMonth,
      summary: data.summary[0] || {
        totalOrders: 0,
        totalRevenue: 0,
        totalCommission: 0,
        pendingCommission: 0,
      },
    };
  }
}
