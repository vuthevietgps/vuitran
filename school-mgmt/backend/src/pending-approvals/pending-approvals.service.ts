import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Payroll, PayrollDocument, PayrollStatus } from '../payroll/schemas/payroll.schema';
import { Invoice, InvoiceDocument, InvoiceStatus } from '../invoices/schemas/invoice.schema';
import { LedgerEntry, LedgerEntryDocument, TransactionStatus, TransactionType } from '../wallets/schemas/ledger-entry.schema';
import { TeacherProfile } from '../teachers/schemas/teacher-profile.schema';
import { Ticket, TicketDocument } from '../tickets/schemas/ticket.schema';
import {
  Classroom,
  ClassDocument,
  ClassUpdateRequestStatus,
} from '../classes/schemas/class.schema';
import {
  SessionChangeRequest,
  SessionChangeRequestDocument,
  SessionChangeRequestStatus,
} from '../sessions/schemas/session-change-request.schema';

@Injectable()
export class PendingApprovalsService {
  constructor(
    @InjectModel(Payroll.name) private payrollModel: Model<PayrollDocument>,
    @InjectModel(Invoice.name) private invoiceModel: Model<InvoiceDocument>,
    @InjectModel(LedgerEntry.name) private ledgerModel: Model<LedgerEntryDocument>,
    @InjectModel(TeacherProfile.name) private teacherModel: Model<any>,
    @InjectModel(Ticket.name) private ticketModel: Model<TicketDocument>,
    @InjectModel(Classroom.name) private classModel: Model<ClassDocument>,
    @InjectModel(SessionChangeRequest.name)
    private sessionChangeRequestModel: Model<SessionChangeRequestDocument>,
  ) {}

  async getSummary() {
    const [
      pendingPayrolls,
      pendingInvoices,
      pendingTopUps,
      pendingTeachers,
      pendingClassUpdates,
      pendingSessionChangeRequests,
      openTickets,
    ] = await Promise.all([
      this.payrollModel.countDocuments({ status: PayrollStatus.PENDING_REVIEW }),
      this.invoiceModel.countDocuments({ status: InvoiceStatus.PENDING_APPROVAL }),
      this.ledgerModel.countDocuments({ type: TransactionType.TOP_UP, status: TransactionStatus.PENDING }),
      this.teacherModel.countDocuments({ status: 'PENDING' }),
      this.classModel.countDocuments({ 'pendingSaleUpdate.status': ClassUpdateRequestStatus.PENDING }),
      this.sessionChangeRequestModel.countDocuments({ status: SessionChangeRequestStatus.PENDING }),
      this.ticketModel.countDocuments({ status: { $in: ['OPEN', 'IN_PROGRESS', 'WAITING_INFO'] } }),
    ]);

    return {
      pendingPayrolls,
      pendingInvoices,
      pendingTopUps,
      pendingTeachers,
      pendingClassUpdates,
      pendingSessionChangeRequests,
      openTickets,
      totalPending:
        pendingPayrolls
        + pendingInvoices
        + pendingTopUps
        + pendingTeachers
        + pendingClassUpdates
        + pendingSessionChangeRequests,
    };
  }

  async getPendingPayrolls() {
    return this.payrollModel
      .find({ status: PayrollStatus.PENDING_REVIEW })
      .populate('teacherId', 'fullName email')
      .sort({ createdAt: -1 })
      .lean();
  }

  async getPendingInvoices() {
    return this.invoiceModel
      .find({ status: InvoiceStatus.PENDING_APPROVAL })
      .select(
        '_id invoiceNumber invoiceType classType sessions bonusSessions trialSessions amount paymentDate receiptImage description status createdAt createdBy studentId saleId classId',
      )
      .populate('studentId', 'fullName parentName parentPhone studentCode parentUserId')
      .populate('createdBy', 'fullName email')
      .populate('saleId', 'fullName email')
      .populate('classId', 'name code')
      .sort({ createdAt: -1 })
      .lean();
  }

  async getPendingTopUps() {
    return this.ledgerModel
      .find({ type: TransactionType.TOP_UP, status: TransactionStatus.PENDING })
      .populate('userId', 'fullName email')
      .sort({ createdAt: -1 })
      .lean();
  }

  async getPendingTeachers() {
    return this.teacherModel
      .find({ status: 'PENDING' })
      .populate('userId', 'fullName email phone')
      .sort({ createdAt: -1 })
      .lean();
  }

  async getPendingClassUpdates() {
    return this.classModel
      .find({ 'pendingSaleUpdate.status': ClassUpdateRequestStatus.PENDING })
      .populate('teacher', 'fullName email')
      .populate('sale', 'fullName email')
      .populate('pendingSaleUpdate.requestedBy', 'fullName email')
      .sort({ 'pendingSaleUpdate.requestedAt': -1 })
      .lean();
  }

  async getPendingSessionChanges() {
    return this.sessionChangeRequestModel
      .find({ status: SessionChangeRequestStatus.PENDING })
      .populate('sessionId', 'scheduledDate scheduledStartTime scheduledEndTime status durationMinutes')
      .populate('classId', 'name code')
      .populate('studentId', 'fullName studentCode')
      .populate('requestedBy', 'fullName email')
      .populate('currentTeacherId', 'fullName email')
      .populate('requestedTeacherId', 'fullName email')
      .sort({ requestedAt: -1 })
      .lean();
  }

  async getAll() {
    const [summary, payrolls, invoices, topUps, teachers, classes, sessionChanges] = await Promise.all([
      this.getSummary(),
      this.getPendingPayrolls(),
      this.getPendingInvoices(),
      this.getPendingTopUps(),
      this.getPendingTeachers(),
      this.getPendingClassUpdates(),
      this.getPendingSessionChanges(),
    ]);

    return { summary, payrolls, invoices, topUps, teachers, classes, sessionChanges };
  }
}
