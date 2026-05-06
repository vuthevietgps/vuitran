import { Injectable, Logger } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { InjectConnection, InjectModel } from "@nestjs/mongoose";
import { Connection, Model, Types } from "mongoose";
import { JwtPayload } from "../common/interfaces/jwt-payload.interface";
import { InvoicesService } from "../invoices/invoices.service";
import { StudentsService } from "../students/students.service";
import { UsersService } from "../users/users.service";
import { OrderApprovedEvent } from "./events/order-approved.event";
import { Order, OrderDocument, OrderStatus } from "./schemas/order.schema";

export interface EnrollmentResult {
  success: boolean;
  studentId?: string;
  studentCode?: string;
  invoiceIds?: string[];
  classIds?: string[];
  errors?: string[];
}

@Injectable()
export class EnrollmentService {
  private readonly logger = new Logger(EnrollmentService.name);

  constructor(
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    private readonly usersService: UsersService,
    private readonly studentsService: StudentsService,
    private readonly invoicesService: InvoicesService,
    private readonly eventEmitter: EventEmitter2,
    @InjectConnection() private readonly connection: Connection,
  ) {}

  private roundMoneyToThousand(value?: number): number {
    const normalized = Number(value || 0);
    if (!Number.isFinite(normalized) || normalized <= 0) return 0;
    return Math.round(normalized / 1000) * 1000;
  }

  private floorCount(value?: number): number {
    const normalized = Number(value || 0);
    if (!Number.isFinite(normalized) || normalized <= 0) return 0;
    return Math.floor(normalized);
  }

  private getInstallmentFrameCount(paymentPlan?: string | null): number {
    switch (String(paymentPlan || "").toUpperCase()) {
      case "INSTALLMENT_2":
        return 2;
      case "INSTALLMENT_3":
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

  private splitCountIntoFrames(totalCount: number, frameCount: number): number[] {
    const normalizedTotal = this.floorCount(totalCount);
    if (frameCount <= 0 || normalizedTotal <= 0) {
      return Array.from({ length: Math.max(frameCount, 0) }, () => 0);
    }

    const baseCount = Math.floor(normalizedTotal / frameCount);
    let remainder = normalizedTotal - baseCount * frameCount;

    return Array.from({ length: frameCount }, () => {
      if (remainder > 0) {
        remainder -= 1;
        return baseCount + 1;
      }
      return baseCount;
    });
  }

  private buildInstallmentInvoiceDrafts(order: any, item: any): Array<{
    paymentDate: Date;
    paymentRound: number;
    invoiceNumber: string;
    amount: number;
    invoiceSessions: number;
    bonusSessions: number;
    trialSessions: number;
    pricePerSession?: number;
  }> {
    const frameCount = this.getInstallmentFrameCount(order?.paymentPlan);
    const orderFrames = Array.isArray(order?.paymentFrames) ? order.paymentFrames : [];
    if (frameCount <= 1 || orderFrames.length !== frameCount) {
      return [];
    }

    const amounts = this.splitAmountIntoFrames(Number(item?.amount || 0), frameCount);
    const invoiceSessions = this.splitCountIntoFrames(
      Number(item?.invoiceSessions ?? item?.sessions ?? 0),
      frameCount,
    );
    const bonusSessions = this.splitCountIntoFrames(
      Number(item?.bonusSessions || 0),
      frameCount,
    );
    const trialSessions = this.splitCountIntoFrames(
      Number(item?.trialSessions || 0),
      frameCount,
    );
    const baseInvoiceNumber = String(item?.invoiceNumber || "").trim();

    return orderFrames.map((frame: any, index: number) => {
      const splitSessions = invoiceSessions[index] || 0;
      const splitAmount = amounts[index] || 0;
      const computedPricePerSession =
        splitSessions > 0 && splitAmount > 0
          ? Math.round(splitAmount / splitSessions)
          : undefined;

      return {
        paymentDate: new Date(frame?.dueDate || order?.paymentDate || new Date()),
        paymentRound: index + 1,
        invoiceNumber: baseInvoiceNumber
          ? `${baseInvoiceNumber}-${index + 1}`
          : "",
        amount: splitAmount,
        invoiceSessions: splitSessions,
        bonusSessions: bonusSessions[index] || 0,
        trialSessions: trialSessions[index] || 0,
        ...(computedPricePerSession ? { pricePerSession: computedPricePerSession } : {}),
      };
    });
  }

  private buildInvoiceDraftsForItem(order: any, item: any): Array<{
    paymentDate?: Date;
    paymentRound?: number;
    invoiceNumber?: string;
    amount?: number;
    invoiceSessions?: number;
    bonusSessions?: number;
    trialSessions?: number;
    pricePerSession?: number;
  }> {
    return [{}];
  }

  async processApprovedOrder(
    orderId: string,
    approver: JwtPayload,
    approvalImage?: string,
  ): Promise<EnrollmentResult> {
    const order = await this.orderModel.findById(orderId).lean();
    if (!order) {
      return { success: false, errors: ["Order khong ton tai"] };
    }

    const rawOrderData = order as any;
    const mongoSession = await this.connection.startSession();

    let studentId = "";
    let studentCode = "";
    let isNew = false;
    let parentUserId = "";
    let invoiceIds: string[] = [];

    try {
      await mongoSession.withTransaction(async () => {
        parentUserId = await this.usersService.findOrCreateParentFromOrder(
          rawOrderData,
          mongoSession,
        );

        const studentResult =
          await this.studentsService.findOrCreateStudentFromOrder(
            rawOrderData,
            parentUserId,
            approver,
            mongoSession,
          );
        studentId = studentResult.studentId;
        studentCode = studentResult.studentCode;
        isNew = studentResult.isNew;

        invoiceIds = [];
        for (const [itemIndex, item] of (rawOrderData.items || []).entries()) {
          for (const draft of this.buildInvoiceDraftsForItem(rawOrderData, item)) {
            const invoiceItem = {
              ...item,
              ...(draft.invoiceNumber ? { invoiceNumber: draft.invoiceNumber } : {}),
              ...(draft.paymentRound ? { paymentRound: draft.paymentRound } : {}),
              ...(draft.amount !== undefined ? { amount: draft.amount } : {}),
              ...(draft.invoiceSessions !== undefined ? { invoiceSessions: draft.invoiceSessions } : {}),
              ...(draft.bonusSessions !== undefined ? { bonusSessions: draft.bonusSessions } : {}),
              ...(draft.trialSessions !== undefined ? { trialSessions: draft.trialSessions } : {}),
              ...(draft.pricePerSession !== undefined ? { pricePerSession: draft.pricePerSession } : {}),
            };
            const invoiceOrder = {
              ...rawOrderData,
              ...(draft.paymentDate ? { paymentDate: draft.paymentDate } : {}),
              items: (rawOrderData.items || []).map((candidate: any, index: number) =>
                index === itemIndex ? invoiceItem : candidate,
              ),
            };
            const invoiceId = await this.invoicesService.createInvoiceForOrder(
              invoiceOrder,
              invoiceOrder.items[itemIndex],
              studentId,
              approver,
              mongoSession,
            );
            invoiceIds.push(invoiceId);
          }
        }

        await this.orderModel.findByIdAndUpdate(
          orderId,
          {
            status: OrderStatus.APPROVED,
            approvedBy: new Types.ObjectId(approver._id || approver.sub),
            approvedAt: new Date(),
            ...(approvalImage ? { approvalImage } : {}),
            parentUserId: new Types.ObjectId(parentUserId),
            processedResults: {
              studentId: new Types.ObjectId(studentId),
              invoiceIds: invoiceIds.map((id) => new Types.ObjectId(id)),
              classIds: [],
            },
          },
          { session: mongoSession },
        );
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      this.logger.error(
        `Enrollment transaction failed for order ${rawOrderData.orderCode}: ${message}`,
      );

      return {
        success: false,
        errors: [`Enrollment that bai: ${message}`],
      };
    } finally {
      await mongoSession.endSession();
    }

    try {
      this.eventEmitter.emit(
        "order.approved.success",
        new OrderApprovedEvent(
          orderId,
          rawOrderData.orderCode,
          studentId,
          invoiceIds,
          approver._id || approver.sub,
          rawOrderData,
          {
            parentUserId,
            studentCode,
            studentName: rawOrderData.studentName,
            parentPhone: rawOrderData.parentPhone,
            adGroupId:
              rawOrderData.adGroupId?.toString?.() || rawOrderData.adGroupId,
            adGroupName: rawOrderData.adGroupName,
            saleId: rawOrderData.saleId?.toString?.() || rawOrderData.saleId,
            saleName: rawOrderData.saleName,
            actorEmail: approver.email,
            actorFullName: approver.fullName,
            actorRole: approver.role,
            isNew,
          },
        ),
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      this.logger.warn(
        `Failed to emit order.approved.success for ${rawOrderData.orderCode}: ${message}`,
      );
    }

    return {
      success: true,
      studentId,
      studentCode,
      invoiceIds,
      classIds: [],
    };
  }
}
