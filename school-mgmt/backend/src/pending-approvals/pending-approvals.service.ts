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

@Injectable()
export class PendingApprovalsService {
  constructor(
    @InjectModel(Payroll.name) private payrollModel: Model<PayrollDocument>,
    @InjectModel(Invoice.name) private invoiceModel: Model<InvoiceDocument>,
    @InjectModel(LedgerEntry.name) private ledgerModel: Model<LedgerEntryDocument>,
    @InjectModel(TeacherProfile.name) private teacherModel: Model<any>,
    @InjectModel(Ticket.name) private ticketModel: Model<TicketDocument>,
    @InjectModel(Classroom.name) private classModel: Model<ClassDocument>,
  ) {}

  async getSummary() {
    const [
      pendingPayrolls,
      pendingInvoices,
      pendingTopUps,
      pendingTeachers,
      pendingClassUpdates,
      openTickets,
    ] = await Promise.all([
      this.payrollModel.countDocuments({ status: PayrollStatus.PENDING_REVIEW }),
      this.invoiceModel.countDocuments({ status: InvoiceStatus.PENDING_APPROVAL }),
      this.ledgerModel.countDocuments({ type: TransactionType.TOP_UP, status: TransactionStatus.PENDING }),
      this.teacherModel.countDocuments({ status: 'PENDING' }),
      this.classModel.countDocuments({ 'pendingSaleUpdate.status': ClassUpdateRequestStatus.PENDING }),
      this.ticketModel.countDocuments({ status: { $in: ['OPEN', 'IN_PROGRESS', 'WAITING_INFO'] } }),
    ]);

    return {
      pendingPayrolls,
      pendingInvoices,
      pendingTopUps,
      pendingTeachers,
      pendingClassUpdates,
      openTickets,
      totalPending: pendingPayrolls + pendingInvoices + pendingTopUps + pendingTeachers + pendingClassUpdates,
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
      .populate('studentId', 'fullName')
      .populate('createdBy', 'fullName email')
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

  async getAll() {
    const [summary, payrolls, invoices, topUps, teachers, classes] = await Promise.all([
      this.getSummary(),
      this.getPendingPayrolls(),
      this.getPendingInvoices(),
      this.getPendingTopUps(),
      this.getPendingTeachers(),
      this.getPendingClassUpdates(),
    ]);

    return { summary, payrolls, invoices, topUps, teachers, classes };
  }
}
