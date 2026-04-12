import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectModel, InjectConnection } from '@nestjs/mongoose';
import { Model, Types, Connection } from 'mongoose';
import { Invoice, InvoiceDocument, InvoiceStatus, InvoiceType } from './schemas/invoice.schema';
import { ApproveInvoiceDto } from './dto/approve-invoice.dto';
import { Student, StudentDocument } from '../students/schemas/student.schema';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { ClassesService } from '../classes/classes.service';
import { WalletsService } from '../wallets/wallets.service';
import {
  getActorId,
  normalizeObjectId,
  isPurchasedSessionsSourceStatus,
  getPurchasedSessionsForInvoice,
  getInvoiceStudentId,
  isFinanciallyLockedInvoice,
  buildInvoiceClawbackReason,
} from './invoices.utils';

@Injectable()
export class InvoicesApprovalService {
  private readonly logger = new Logger(InvoicesApprovalService.name);

  constructor(
    @InjectModel(Invoice.name) private readonly invoiceModel: Model<InvoiceDocument>,
    @InjectModel(Student.name) private readonly studentModel: Model<StudentDocument>,
    private readonly classesService: ClassesService,
    private readonly walletsService: WalletsService,
    @InjectConnection() private readonly connection: Connection,
  ) {}

  async applyPurchasedSessionsDelta(
    studentId: string | null,
    delta: number,
    mongoSession?: import('mongoose').ClientSession,
  ): Promise<void> {
    if (!studentId || delta === 0) {
      return;
    }

    await this.studentModel.updateOne(
      { _id: new Types.ObjectId(studentId) },
      {
        $inc: { totalPurchasedSessions: delta },
      },
      mongoSession ? { session: mongoSession } : {},
    );
  }

  async syncPurchasedSessionsSnapshot(
    before: Partial<InvoiceDocument> | null,
    after: Partial<InvoiceDocument> | null,
    mongoSession?: import('mongoose').ClientSession,
  ): Promise<void> {
    const beforeStudentId = getInvoiceStudentId(before);
    const afterStudentId = getInvoiceStudentId(after);
    const beforeTotal = before && isPurchasedSessionsSourceStatus(before.status)
      ? getPurchasedSessionsForInvoice(before)
      : 0;
    const afterTotal = after && isPurchasedSessionsSourceStatus(after.status)
      ? getPurchasedSessionsForInvoice(after)
      : 0;

    if (beforeStudentId && afterStudentId && beforeStudentId === afterStudentId) {
      await this.applyPurchasedSessionsDelta(afterStudentId, afterTotal - beforeTotal, mongoSession);
      return;
    }

    await this.applyPurchasedSessionsDelta(beforeStudentId, -beforeTotal, mongoSession);
    await this.applyPurchasedSessionsDelta(afterStudentId, afterTotal, mongoSession);
  }

  private async topUpWalletForInvoice(
    invoice: InvoiceDocument,
    approver: JwtPayload,
    mongoSession?: import('mongoose').ClientSession,
  ): Promise<void> {
    const student = await this.studentModel
      .findById(invoice.studentId)
      .select('parentUserId fullName')
      .session(mongoSession || null)
      .lean();

    if (!student?.parentUserId) {
      throw new BadRequestException(
        `Invoice ${invoice.invoiceNumber}: Student chưa có parentUserId, không thể nạp ví. ` +
        `Vui lòng cập nhật parentUserId cho học sinh trước khi duyệt hóa đơn.`,
      );
    }

    const parentUserId = student.parentUserId.toString();

    const ledgerEntry = await this.walletsService.topUpFromInvoice({
      parentUserId,
      invoiceId: (invoice._id as Types.ObjectId).toString(),
      invoiceNumber: invoice.invoiceNumber,
      amount: invoice.amount,
      studentId: invoice.studentId.toString(),
      classId: invoice.classId?.toString(),
      approvedBy: getActorId(approver),
    }, { session: mongoSession });

    await this.invoiceModel.updateOne(
      { _id: invoice._id },
      {
        $set: {
          walletTopUpDone: true,
          ledgerEntryId: ledgerEntry._id as Types.ObjectId,
        },
      },
      mongoSession ? { session: mongoSession } : {},
    );

    this.logger.log(
      `Invoice ${invoice.invoiceNumber} APPROVED → Wallet topped up ${invoice.amount.toLocaleString('vi-VN')}đ for parent ${parentUserId}`,
    );
  }

  private async autoPlaceApprovedInvoice(invoice: Partial<InvoiceDocument> | any, actor: JwtPayload): Promise<void> {
    const invoiceId = normalizeObjectId(invoice?._id);
    const studentId = normalizeObjectId(invoice?.studentId);
    const classId = normalizeObjectId(invoice?.classId);
    const requestedClassId = normalizeObjectId(invoice?.requestedClassId);
    const requestedTeacherId = normalizeObjectId(invoice?.requestedTeacherId);

    if (!invoiceId || !studentId) return;
    if (classId) return;
    if (!requestedClassId && !requestedTeacherId) return;

    try {
      await this.classesService.autoPlaceApprovedInvoice(
        {
          invoiceId,
          studentId,
          requestedClassId,
          requestedTeacherId,
        },
        actor,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      this.logger.warn(
        `Auto placement failed for invoice ${invoice?.invoiceNumber || invoiceId}: ${message}`,
      );
    }
  }

  /** Duyệt hoặc từ chối hóa đơn (DIRECTOR / ACCOUNTING) */
  async approveInvoice(id: string, dto: ApproveInvoiceDto, actor: JwtPayload) {
    const actorId = getActorId(actor);
    const approvalImage = dto.approvalImage?.trim();
    let approvedInvoiceAfterCommit: any = null;

    if (dto.action === 'APPROVE' && !approvalImage) {
      throw new BadRequestException('Phai tai hoa don doi ung truoc khi duyet hoa don');
    }

    const existingInvoice = await this.invoiceModel
      .findById(id)
      .select(
        '_id invoiceNumber status receiptImage studentId invoiceType sessions bonusSessions classId requestedClassId requestedTeacherId',
      )
      .lean();
    if (!existingInvoice) {
      throw new NotFoundException('Hóa đơn không tồn tại');
    }

    if (dto.action === 'APPROVE' && !existingInvoice.receiptImage) {
      throw new BadRequestException(
        'Khong the duyet hoa don khi chua co hoa don sale upload. Vui long bo sung hoa don goc truoc.',
      );
    }

    if (dto.action === 'APPROVE') {
      const mongoSession = await this.connection.startSession();
      mongoSession.startTransaction();

      try {
        const now = new Date();
        const approvedByOid = new Types.ObjectId(actorId);
        const invoice = await this.invoiceModel.findOneAndUpdate(
          { _id: id, status: InvoiceStatus.PENDING_APPROVAL },
          [{
            $set: {
              status: InvoiceStatus.APPROVED,
              approvedBy: approvedByOid,
              approvedAt: now,
              approvalImage,
              paymentDate: { $ifNull: ['$paymentDate', now] },
              updatedAt: now,
            },
          }],
          { new: true, session: mongoSession },
        );
        if (!invoice) {
          const exists = await this.invoiceModel.findById(id).lean();
          if (!exists) throw new NotFoundException('Hóa đơn không tồn tại');
          throw new BadRequestException(
            `Hóa đơn đang ở trạng thái "${exists.status}", chỉ có thể duyệt khi ở trạng thái "PENDING_APPROVAL"`,
          );
        }

        if (
          invoice.invoiceType === InvoiceType.TUITION &&
          !invoice.walletTopUpDone &&
          invoice.amount > 0
        ) {
          await this.topUpWalletForInvoice(invoice, actor, mongoSession);
        }

        await this.syncPurchasedSessionsSnapshot(existingInvoice as any, invoice, mongoSession);
        approvedInvoiceAfterCommit = invoice.toObject();

        await mongoSession.commitTransaction();
      } catch (err) {
        if (mongoSession.inTransaction()) {
          await mongoSession.abortTransaction();
        }
        throw err;
      } finally {
        mongoSession.endSession();
      }
    } else {
      const invoice = await this.invoiceModel.findOneAndUpdate(
        { _id: id, status: InvoiceStatus.PENDING_APPROVAL },
        {
          $set: {
            status: InvoiceStatus.REJECTED,
            approvedBy: new Types.ObjectId(actorId),
            approvedAt: new Date(),
            rejectedReason: dto.rejectedReason || '',
          },
        },
        { new: true },
      );
      if (!invoice) {
        const exists = await this.invoiceModel.findById(id).lean();
        if (!exists) throw new NotFoundException('Hóa đơn không tồn tại');
        throw new BadRequestException(
          `Hóa đơn đang ở trạng thái "${exists.status}", chỉ có thể duyệt khi ở trạng thái "PENDING_APPROVAL"`,
        );
      }
    }

    if (dto.action === 'APPROVE' && approvedInvoiceAfterCommit) {
      await this.autoPlaceApprovedInvoice(approvedInvoiceAfterCommit, actor);
    }

    return this.invoiceModel.findById(id)
      .populate('studentId', 'fullName parentName parentPhone studentCode')
      .populate('classId', 'name code pricePerSession')
      .populate('createdBy', 'fullName email')
      .populate('approvedBy', 'fullName email')
      .populate('saleId', 'fullName email')
      .lean();
  }

  async cancelInvoice(id: string, actor: JwtPayload, reason?: string) {
    const actorId = getActorId(actor);

    const mongoSession = await this.connection.startSession();
    mongoSession.startTransaction();

    try {
      const existingInvoice = await this.invoiceModel.findById(id).lean();
      if (!existingInvoice) {
        throw new NotFoundException('Hoa don khong ton tai');
      }

      if (isFinanciallyLockedInvoice(existingInvoice)) {
        throw new BadRequestException(
          `Hoa don ${existingInvoice.invoiceNumber} da khoa so (${existingInvoice.status}). ` +
          `Khong the rollback thong thuong; can clawback/adjustment entry co audit reason ro rang.`,
        );
      }

      if (existingInvoice.status !== InvoiceStatus.APPROVED) {
        throw new BadRequestException(
          `Hoa don dang o trang thai "${existingInvoice.status}", chi co the huy hoa don o trang thai "APPROVED"`,
        );
      }

      const now = new Date();
      const invoice = await this.invoiceModel.findOneAndUpdate(
        { _id: id, status: InvoiceStatus.APPROVED },
        {
          $set: {
            status: InvoiceStatus.CANCELLED,
            cancelledBy: new Types.ObjectId(actorId),
            cancelledAt: now,
            ...(reason ? { cancellationReason: reason } : {}),
          },
        },
        { new: true, session: mongoSession },
      );

      if (!invoice) {
        throw new BadRequestException(
          `Hoa don ${existingInvoice.invoiceNumber} khong the cap nhat do da bi nguoi khac xu ly truoc do.`,
        );
      }

      if (invoice.walletTopUpDone && invoice.amount > 0) {
        await this.walletsService.reverseInvoiceTopUp({
          invoiceId: (invoice._id as Types.ObjectId).toString(),
          amount: invoice.amount,
          reason: buildInvoiceClawbackReason(invoice.invoiceNumber, reason),
          cancelledBy: actorId,
        }, { session: mongoSession });
      }

      const beforeSnapshot = { ...invoice.toObject(), status: InvoiceStatus.APPROVED } as Partial<InvoiceDocument>;
      await this.syncPurchasedSessionsSnapshot(beforeSnapshot, invoice, mongoSession);

      await mongoSession.commitTransaction();

      this.logger.log(
        `Invoice ${invoice.invoiceNumber} CANCELLED by ${actorId}` +
        (invoice.walletTopUpDone ? ` -- wallet rollback ${invoice.amount.toLocaleString('vi-VN')}d` : ''),
      );

      return this.invoiceModel.findById(id)
        .populate('studentId', 'fullName parentName parentPhone studentCode')
        .populate('classId', 'name code pricePerSession')
        .populate('createdBy', 'fullName email')
        .populate('approvedBy', 'fullName email')
        .lean();
    } catch (err) {
      if (mongoSession.inTransaction()) {
        await mongoSession.abortTransaction();
      }
      throw err;
    } finally {
      mongoSession.endSession();
    }
  }
}
