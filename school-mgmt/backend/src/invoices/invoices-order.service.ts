import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Invoice, InvoiceDocument, InvoiceStatus, InvoiceType } from './schemas/invoice.schema';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { getActorId, mapPaymentRoundToCourseStatus } from './invoices.utils';

@Injectable()
export class InvoicesOrderService {
  constructor(
    @InjectModel(Invoice.name) private readonly invoiceModel: Model<InvoiceDocument>,
  ) {}

  private async generateInvoiceNumber(
    mongoSession?: import('mongoose').ClientSession,
  ): Promise<string> {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const prefix = `INV-${year}${month}-`;

    const query = this.invoiceModel
      .findOne({ invoiceNumber: { $regex: `^${prefix}` } })
      .sort({ invoiceNumber: -1 });
    if (mongoSession) query.session(mongoSession);
    const last = await query.lean();

    let nextNum = 1;
    if (last) {
      const suffix = (last as any).invoiceNumber.replace(prefix, '');
      nextNum = parseInt(suffix, 10) + 1;
    }
    return `${prefix}${String(nextNum).padStart(4, '0')}`;
  }

  /**
   * Tạo hóa đơn tự động từ Order item khi approve order.
   * Được gọi bởi EnrollmentService trong transaction.
   */
  async createInvoiceForOrder(
    order: any,
    item: any,
    studentId: string,
    actor: JwtPayload,
    mongoSession?: import('mongoose').ClientSession,
  ): Promise<string> {
    const orderId = order._id;
    const items: any[] = order.items || [];
    const itemIndex = items.indexOf(item);
    const orderItemIndex = itemIndex >= 0 ? itemIndex : 0;

    // Invoice number: use item-level override or auto-generate
    const invoiceNumber =
      (item.invoiceNumber && String(item.invoiceNumber).trim()) ||
      (await this.generateInvoiceNumber(mongoSession));

    // Payment round: explicit or auto from existing invoices
    let paymentRound = item.paymentRound;
    if (!paymentRound) {
      const countQuery = this.invoiceModel.countDocuments({
        studentId: new Types.ObjectId(studentId),
        status: { $nin: [InvoiceStatus.CANCELLED, InvoiceStatus.REJECTED] },
      });
      paymentRound = (await countQuery) + 1;
    }

    const courseStatus = item.courseStatus || mapPaymentRoundToCourseStatus(paymentRound);

    // Amount distribution: single-item → finalAmount, multi-item → item.amount ratio
    const isSingleItem = items.length === 1;
    const totalAmount = Number(order.totalAmount || 0);
    const finalAmount = Number(order.finalAmount || 0);
    let invoiceAmount: number;
    if (isSingleItem) {
      invoiceAmount = finalAmount;
    } else {
      const itemAmount = Number(item.amount || 0);
      const ratio = totalAmount > 0 ? itemAmount / totalAmount : 1 / items.length;
      invoiceAmount = Math.round(finalAmount * ratio);
    }

    // Commission distribution
    const totalCommission = Number(order.saleCommission || 0);
    let saleCommission: number;
    if (isSingleItem) {
      saleCommission = totalCommission;
    } else {
      const itemAmount = Number(item.amount || 0);
      const ratio = totalAmount > 0 ? itemAmount / totalAmount : 1 / items.length;
      saleCommission = Math.round(totalCommission * ratio);
    }

    // Sessions: prefer invoiceSessions (explicit invoice sessions) over order sessions
    const sessions = item.invoiceSessions ?? item.sessions ?? 0;
    const bonusSessions = Math.max(0, Number(item.bonusSessions || 0));
    const trialSessions = Math.max(0, Number(item.trialSessions || 0));

    // Duration and per-minute rate
    const sessionDuration = item.sessionDuration || 90;
    const referenceDuration = item.baseDuration || sessionDuration;
    const pricePerSession = Number(item.pricePerSession || 0);
    const perMinuteRate = referenceDuration > 0 ? pricePerSession / referenceDuration : 0;

    // Class type from teaching mode
    const classType = item.teachingMode === 'OFFLINE' ? 'OFFLINE' : 'ONLINE';

    const entity = new this.invoiceModel({
      invoiceNumber,
      invoiceType: InvoiceType.TUITION,
      orderId: new Types.ObjectId(orderId),
      orderItemIndex,
      productId: item.productId ? new Types.ObjectId(String(item.productId)) : undefined,
      productName: item.productName,
      studentId: new Types.ObjectId(studentId),
      saleId: order.saleId ? new Types.ObjectId(String(order.saleId)) : undefined,
      saleCommission,
      classId: item.selectedClassId ? new Types.ObjectId(String(item.selectedClassId)) : undefined,
      requestedClassId: item.selectedClassId ? new Types.ObjectId(String(item.selectedClassId)) : undefined,
      requestedTeacherId: item.preferredTeacherId ? new Types.ObjectId(String(item.preferredTeacherId)) : undefined,
      createNewClassWhenApproved: !!item.createNewClassWhenApproved,
      classType,
      sessions,
      sessionsRemaining: sessions,
      bonusSessions,
      bonusSessionsRemaining: bonusSessions,
      trialSessions,
      trialSessionsRemaining: trialSessions,
      paymentRound,
      courseStatus,
      pricePerSession,
      referenceDuration,
      perMinuteRate,
      teacherPayPerSession: Number(item.teacherPayPerSession || 0),
      amount: invoiceAmount,
      paymentDate: order.paymentDate || new Date(),
      receiptImage: order.receiptImage,
      description: item.invoiceDescription || item.notes,
      status: InvoiceStatus.PENDING_APPROVAL,
      createdBy: new Types.ObjectId(getActorId(actor)),
    });

    const saved = await entity.save(mongoSession ? { session: mongoSession } : {});
    return (saved._id as Types.ObjectId).toString();
  }
}
