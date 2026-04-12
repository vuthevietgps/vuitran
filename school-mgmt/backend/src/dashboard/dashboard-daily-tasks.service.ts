import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { AdsAnalyticsService } from '../ads/ads-analytics.service';
import { ActionableSuggestion } from '../ads/ads.types';
import { Session, SessionDocument, SessionStatus } from '../sessions/schemas/session.schema';
import { LedgerEntry, LedgerEntryDocument, TransactionType, TransactionStatus } from '../wallets/schemas/ledger-entry.schema';
import { Payroll, PayrollDocument, PayrollStatus } from '../payroll/schemas/payroll.schema';
import { Ticket, TicketDocument } from '../tickets/schemas/ticket.schema';
import { TeacherProfile, TeacherStatus } from '../teachers/schemas/teacher-profile.schema';
import { Student, StudentDocument } from '../students/schemas/student.schema';
import { Classroom, ClassDocument, ClassUpdateRequestStatus } from '../classes/schemas/class.schema';
import { Invoice, InvoiceDocument, InvoiceStatus } from '../invoices/schemas/invoice.schema';
import { Order, OrderDocument, OrderStatus } from '../orders/schemas/order.schema';
import { Lead, LeadDocument } from '../leads/schemas/lead.schema';
import {
  TrialEnrollment,
  TrialEnrollmentDocument,
  TrialEnrollmentStatus,
} from '../trial-enrollments/schemas/trial-enrollment.schema';
import { Role } from '../common/interfaces/role.enum';
import { DailyTaskBoard, DailyTaskItem } from './dashboard.types';
import {
  startOfDay, addDays, isSameDay, isOverdue,
  toIso, toShortDate, formatCurrency,
  compactMeta, personName, studentName, className,
  buildDailyTaskBoard, getOpenTicketStatuses, getActiveLeadStatuses,
  mapTicketPriority, mapAdsActionToTask,
} from './dashboard.utils';

@Injectable()
export class DashboardDailyTasksService {
  constructor(
    private readonly adsAnalyticsService: AdsAnalyticsService,
    @InjectModel(Session.name) private sessionModel: Model<SessionDocument>,
    @InjectModel(LedgerEntry.name) private ledgerModel: Model<LedgerEntryDocument>,
    @InjectModel(Payroll.name) private payrollModel: Model<PayrollDocument>,
    @InjectModel(Ticket.name) private ticketModel: Model<TicketDocument>,
    @InjectModel(TeacherProfile.name) private teacherModel: Model<any>,
    @InjectModel(Student.name) private studentModel: Model<StudentDocument>,
    @InjectModel(Classroom.name) private classModel: Model<ClassDocument>,
    @InjectModel(Invoice.name) private invoiceModel: Model<InvoiceDocument>,
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    @InjectModel(Lead.name) private leadModel: Model<LeadDocument>,
    @InjectModel(TrialEnrollment.name) private trialEnrollmentModel: Model<TrialEnrollmentDocument>,
  ) {}

  async getDailyTasks(role: Role, userId: string): Promise<DailyTaskBoard> {
    switch (role) {
      case Role.DIRECTOR: return this.getDirectorDailyTasks();
      case Role.ACCOUNTING: return this.getAccountingDailyTasks();
      case Role.OPS: return this.getOpsDailyTasks(userId);
      case Role.TEACHER: return this.getTeacherDailyTasks(userId);
      case Role.PARENT: return this.getParentDailyTasks(userId);
      case Role.SALE: return this.getSaleDailyTasks(userId);
      case Role.ADSMANAGER: return this.getAdsDailyTasks();
      default: return buildDailyTaskBoard(role, []);
    }
  }

  private async getDirectorDailyTasks(): Promise<DailyTaskBoard> {
    const now = new Date();
    const today = startOfDay(now);
    const tomorrow = addDays(today, 1);

    const [
      pendingPayrolls, pendingInvoices, pendingTopUps, pendingTeachers,
      pendingClassUpdates, sessionsWaitingFinalization, overdueTickets,
      leadFollowUps, submittedOrders, trialDecisions,
    ] = await Promise.all([
      this.payrollModel.find({ status: PayrollStatus.PENDING_REVIEW }).sort({ createdAt: 1 }).limit(10)
        .populate('teacherId', 'fullName email').lean(),
      this.invoiceModel.find({ status: InvoiceStatus.PENDING_APPROVAL }).sort({ createdAt: 1 }).limit(10)
        .populate('studentId', 'fullName studentCode').populate('createdBy', 'fullName email').lean(),
      this.ledgerModel.find({ type: TransactionType.TOP_UP, status: TransactionStatus.PENDING }).sort({ createdAt: 1 }).limit(10)
        .populate('userId', 'fullName email').lean(),
      this.teacherModel.find({ status: TeacherStatus.PENDING }).sort({ createdAt: 1 }).limit(10)
        .populate('userId', 'fullName email phone').lean(),
      this.classModel.find({ 'pendingSaleUpdate.status': ClassUpdateRequestStatus.PENDING }).sort({ 'pendingSaleUpdate.requestedAt': 1 }).limit(10)
        .populate('sale', 'fullName email').populate('pendingSaleUpdate.requestedBy', 'fullName email').lean(),
      this.sessionModel.find({ status: SessionStatus.TEACHER_COMPLETED }).sort({ scheduledDate: 1 }).limit(10)
        .populate('teacherId', 'fullName').populate('studentId', 'fullName studentCode').populate('classId', 'name code').lean(),
      this.ticketModel.find({ status: { $in: getOpenTicketStatuses() }, dueDate: { $lt: now } }).sort({ dueDate: 1 }).limit(10)
        .populate('createdBy', 'fullName').populate('assignedTo', 'fullName').lean(),
      this.leadModel.find({ nextFollowUp: { $lte: tomorrow }, status: { $in: getActiveLeadStatuses() } }).sort({ nextFollowUp: 1 }).limit(10).lean(),
      this.orderModel.find({ status: OrderStatus.SUBMITTED }).sort({ createdAt: 1 }).limit(10).lean(),
      this.trialEnrollmentModel.find({
        status: { $in: [TrialEnrollmentStatus.PENDING_TRIAL, TrialEnrollmentStatus.WAITING_DECISION] },
      }).sort({ updatedAt: 1, createdAt: 1 }).limit(10)
        .populate('classId', 'name code').populate('saleId', 'fullName').populate('studentId', 'fullName studentCode').lean(),
    ]);

    const approvalTasks: DailyTaskItem[] = [
      ...pendingPayrolls.map((payroll: any) => ({
        id: `director-payroll-${String(payroll._id)}`, type: 'PENDING_PAYROLL',
        title: `Duyet bang luong ${payroll.payrollCode}`,
        detail: payroll.teacherId?.fullName || 'Bang luong cho duyet',
        meta: compactMeta([payroll.teacherId?.email, payroll.periodStart && payroll.periodEnd ? `${toShortDate(payroll.periodStart)} - ${toShortDate(payroll.periodEnd)}` : undefined]),
        status: payroll.status, priority: 'HIGH' as const, dueAt: toIso(payroll.createdAt),
        route: '/app/pending-approvals', queryParams: { tab: 'payroll' }, actionLabel: 'Mo cho duyet',
      })),
      ...pendingInvoices.map((invoice: any) => ({
        id: `director-invoice-${String(invoice._id)}`, type: 'PENDING_INVOICE',
        title: `Duyet hoa don ${invoice.invoiceNumber}`,
        detail: studentName(invoice.studentId) || 'Hoa don dang cho duyet',
        meta: compactMeta([invoice.createdBy?.fullName]),
        status: invoice.status, priority: 'HIGH' as const, dueAt: toIso(invoice.createdAt),
        route: '/app/pending-approvals', queryParams: { tab: 'invoices' }, actionLabel: 'Mo cho duyet',
      })),
      ...pendingTopUps.map((entry: any) => ({
        id: `director-topup-${String(entry._id)}`, type: 'PENDING_TOP_UP',
        title: `Duyet nap vi ${formatCurrency(entry.amount)}`,
        detail: personName(entry.userId) || 'Yeu cau nap vi',
        meta: compactMeta([entry.userId?.email]),
        status: entry.status, priority: 'HIGH' as const, dueAt: toIso(entry.createdAt),
        route: '/app/pending-approvals', queryParams: { tab: 'topups' }, actionLabel: 'Mo cho duyet',
      })),
      ...pendingTeachers.map((teacher: any) => ({
        id: `director-teacher-${String(teacher._id)}`, type: 'PENDING_TEACHER',
        title: `Duyet giao vien ${teacher.userId?.fullName || 'moi'}`,
        detail: teacher.userId?.email || 'Ho so giao vien cho duyet',
        meta: compactMeta([teacher.userId?.phone]),
        status: teacher.status, priority: 'MEDIUM' as const, dueAt: toIso(teacher.createdAt),
        route: '/app/pending-approvals', queryParams: { tab: 'teachers' }, actionLabel: 'Mo cho duyet',
      })),
      ...pendingClassUpdates.map((classItem: any) => ({
        id: `director-class-update-${String(classItem._id)}`, type: 'PENDING_CLASS_UPDATE',
        title: `Duyet cap nhat lop ${classItem.code || classItem.name || ''}`.trim(),
        detail: classItem.name || 'Yeu cau sua lop hoc',
        meta: compactMeta([classItem.pendingSaleUpdate?.requestedBy?.fullName, classItem.pendingSaleUpdate?.requestType]),
        status: classItem.pendingSaleUpdate?.status,
        priority: classItem.pendingSaleUpdate?.requestType === 'DURATION_CHANGE' ? 'HIGH' : 'MEDIUM',
        dueAt: toIso(classItem.pendingSaleUpdate?.requestedAt),
        route: '/app/pending-approvals', queryParams: { tab: 'classes' }, actionLabel: 'Mo cho duyet',
      })),
    ];

    const operationsTasks: DailyTaskItem[] = [
      ...sessionsWaitingFinalization.map((session: any) => ({
        id: `director-session-finalize-${String(session._id)}`, type: 'SESSION_WAITING_FINALIZATION',
        title: `Chot buoi hoc ${studentName(session.studentId) || ''}`.trim(),
        detail: className(session.classId) || 'Buoi hoc cho xu ly',
        meta: compactMeta([personName(session.teacherId)]),
        status: session.status, priority: isOverdue(session.scheduledDate, today) ? 'HIGH' : 'MEDIUM',
        dueAt: toIso(session.scheduledDate), route: '/app/sessions', actionLabel: 'Mo buoi hoc',
        overdue: isOverdue(session.scheduledDate, today),
      })),
      ...overdueTickets.map((ticket: any) => ({
        id: `director-ticket-${String(ticket._id)}`, type: 'OVERDUE_TICKET',
        title: `Xu ly ticket ${ticket.ticketCode || ''}`.trim(),
        detail: ticket.subject || 'Ticket qua han',
        meta: compactMeta([personName(ticket.createdBy), personName(ticket.assignedTo)]),
        status: ticket.status, priority: mapTicketPriority(ticket.priority),
        dueAt: toIso(ticket.dueDate), route: '/app/tickets', actionLabel: 'Mo ticket', overdue: true,
      })),
    ];

    const salesTasks: DailyTaskItem[] = [
      ...leadFollowUps.map((lead: any) => ({
        id: `director-lead-${String(lead._id)}`, type: 'LEAD_FOLLOW_UP',
        title: `Follow-up lead ${lead.leadCode || ''}`.trim(),
        detail: lead.parentName || 'Lead can lien he',
        meta: compactMeta([lead.parentPhone, lead.status]),
        status: lead.status, priority: isOverdue(lead.nextFollowUp, today) ? 'HIGH' : 'MEDIUM',
        dueAt: toIso(lead.nextFollowUp), route: '/app/leads', actionLabel: 'Mo lead',
        overdue: isOverdue(lead.nextFollowUp, today),
      })),
      ...submittedOrders.map((order: any) => ({
        id: `director-order-${String(order._id)}`, type: 'ORDER_SUBMITTED',
        title: `Ra soat don ${order.orderCode}`,
        detail: compactMeta([order.parentName, order.studentName]).join(' · ') || 'Don dang cho xu ly',
        meta: compactMeta([formatCurrency(order.finalAmount)]),
        status: order.status, priority: 'HIGH' as const, dueAt: toIso(order.createdAt),
        route: '/app/orders', actionLabel: 'Mo don hang',
      })),
      ...trialDecisions.map((trial: any) => ({
        id: `director-trial-${String(trial._id)}`, type: 'TRIAL_ENROLLMENT',
        title: trial.status === TrialEnrollmentStatus.WAITING_DECISION
          ? `Chot hoc thu ${trial.trialCode || ''}`.trim()
          : `Theo doi hoc thu ${trial.trialCode || ''}`.trim(),
        detail: trial.studentName || studentName(trial.studentId) || 'Hoc thu offline',
        meta: compactMeta([className(trial.classId), personName(trial.saleId), `${trial.trialSessionsUsed || 0}/${trial.maxTrialSessions || 2} buoi`]),
        status: trial.status,
        priority: trial.status === TrialEnrollmentStatus.WAITING_DECISION ? 'HIGH'
          : (trial.trialSessionsUsed || 0) > 0 ? 'MEDIUM' : 'LOW',
        dueAt: toIso(trial.updatedAt || trial.createdAt), route: '/app/trial-enrollments', actionLabel: 'Mo hoc thu',
        overdue: trial.status === TrialEnrollmentStatus.WAITING_DECISION && isOverdue(trial.updatedAt || trial.createdAt, today),
      })),
    ];

    return buildDailyTaskBoard(Role.DIRECTOR, [
      { key: 'approvals', label: 'Cho duyet', description: 'Cac muc can phe duyet va phan hoi som trong ngay.', emptyMessage: 'Khong co hang muc cho duyet.', count: 0, tasks: approvalTasks },
      { key: 'operations', label: 'Van hanh', description: 'Buoi hoc va ticket dang can xu ly ngay.', emptyMessage: 'Khong co viec van hanh cap bach.', count: 0, tasks: operationsTasks },
      { key: 'sales', label: 'Kinh doanh', description: 'Lead den han va don dang cho ra quyet dinh.', emptyMessage: 'Khong co lead hay don can theo doi ngay.', count: 0, tasks: salesTasks },
    ]);
  }

  private async getAccountingDailyTasks(): Promise<DailyTaskBoard> {
    const [pendingTopUps, pendingInvoices, approvedPayrolls, pendingPayrolls] = await Promise.all([
      this.ledgerModel.find({ type: TransactionType.TOP_UP, status: TransactionStatus.PENDING }).sort({ createdAt: 1 }).limit(10)
        .populate('userId', 'fullName email').lean(),
      this.invoiceModel.find({ status: InvoiceStatus.PENDING_APPROVAL }).sort({ createdAt: 1 }).limit(10)
        .populate('studentId', 'fullName studentCode').populate('createdBy', 'fullName email').lean(),
      this.payrollModel.find({ status: PayrollStatus.APPROVED }).sort({ updatedAt: 1, createdAt: 1 }).limit(10)
        .populate('teacherId', 'fullName email').lean(),
      this.payrollModel.find({ status: PayrollStatus.PENDING_REVIEW }).sort({ createdAt: 1 }).limit(10)
        .populate('teacherId', 'fullName email').lean(),
    ]);

    const incomingTasks: DailyTaskItem[] = [
      ...pendingTopUps.map((entry: any) => ({
        id: `accounting-topup-${String(entry._id)}`, type: 'PENDING_TOP_UP',
        title: `Xac nhan nap vi ${formatCurrency(entry.amount)}`,
        detail: personName(entry.userId) || 'Yeu cau nap vi',
        meta: compactMeta([entry.userId?.email, entry.paymentMethod]),
        status: entry.status, priority: 'HIGH' as const, dueAt: toIso(entry.createdAt),
        route: '/app/wallets', actionLabel: 'Mo vi',
      })),
      ...pendingInvoices.map((invoice: any) => ({
        id: `accounting-invoice-${String(invoice._id)}`, type: 'PENDING_INVOICE',
        title: `Ra soat hoa don ${invoice.invoiceNumber}`,
        detail: studentName(invoice.studentId) || 'Hoa don cho xu ly',
        meta: compactMeta([invoice.createdBy?.fullName]),
        status: invoice.status, priority: 'HIGH' as const, dueAt: toIso(invoice.createdAt),
        route: '/app/invoices', actionLabel: 'Mo hoa don',
      })),
    ];

    const payrollTasks: DailyTaskItem[] = [
      ...approvedPayrolls.map((payroll: any) => ({
        id: `accounting-approved-payroll-${String(payroll._id)}`, type: 'APPROVED_PAYROLL',
        title: `Chi luong ${payroll.payrollCode}`,
        detail: payroll.teacherId?.fullName || 'Bang luong da duyet',
        meta: compactMeta([formatCurrency(payroll.netAmount), payroll.periodStart && payroll.periodEnd ? `${toShortDate(payroll.periodStart)} - ${toShortDate(payroll.periodEnd)}` : undefined]),
        status: payroll.status, priority: 'HIGH' as const, dueAt: toIso(payroll.updatedAt || payroll.createdAt),
        route: '/app/payroll', actionLabel: 'Mo payroll',
      })),
      ...pendingPayrolls.map((payroll: any) => ({
        id: `accounting-pending-payroll-${String(payroll._id)}`, type: 'PAYROLL_WAITING_APPROVAL',
        title: `Theo doi bang luong ${payroll.payrollCode}`, detail: 'Dang cho director duyet truoc khi chi tra',
        meta: compactMeta([payroll.teacherId?.fullName]),
        status: payroll.status, priority: 'MEDIUM' as const, dueAt: toIso(payroll.createdAt),
        route: '/app/payroll', actionLabel: 'Mo payroll',
      })),
    ];

    return buildDailyTaskBoard(Role.ACCOUNTING, [
      { key: 'incoming', label: 'Thu vao', description: 'Top-up va hoa don moi can duoc xu ly.', emptyMessage: 'Khong co top-up hay hoa don dang cho xu ly.', count: 0, tasks: incomingTasks },
      { key: 'payroll', label: 'Luong', description: 'Bang luong da duyet de chi tra va bang luong dang theo doi.', emptyMessage: 'Khong co bang luong can xu ly ngay.', count: 0, tasks: payrollTasks },
    ]);
  }

  private async getOpsDailyTasks(opsUserId: string): Promise<DailyTaskBoard> {
    const now = new Date();
    const today = startOfDay(now);
    const tomorrow = addDays(today, 1);

    const [
      sessionsToday, sessionsWaitingFinalization, overdueTickets,
      pendingTeachers, pendingClassUpdates, pendingStudents, trialQueue,
    ] = await Promise.all([
      this.sessionModel.find({ status: SessionStatus.SCHEDULED, scheduledDate: { $gte: today, $lt: tomorrow } })
        .sort({ scheduledDate: 1 }).limit(10).populate('teacherId', 'fullName').populate('studentId', 'fullName studentCode').populate('classId', 'name code').lean(),
      this.sessionModel.find({ status: SessionStatus.TEACHER_COMPLETED }).sort({ scheduledDate: 1 }).limit(10)
        .populate('teacherId', 'fullName').populate('studentId', 'fullName studentCode').populate('classId', 'name code').lean(),
      this.ticketModel.find({
        status: { $in: getOpenTicketStatuses() }, dueDate: { $lt: now },
        ...(Types.ObjectId.isValid(opsUserId) ? { assignedTo: new Types.ObjectId(opsUserId) } : {}),
      }).sort({ dueDate: 1 }).limit(10).populate('createdBy', 'fullName').populate('assignedTo', 'fullName').lean(),
      this.teacherModel.find({ status: TeacherStatus.PENDING }).sort({ createdAt: 1 }).limit(10)
        .populate('userId', 'fullName email phone').lean(),
      this.classModel.find({
        'pendingSaleUpdate.status': ClassUpdateRequestStatus.PENDING,
        'pendingSaleUpdate.requestType': { $ne: 'DURATION_CHANGE' },
      }).sort({ 'pendingSaleUpdate.requestedAt': 1 }).limit(10)
        .populate('sale', 'fullName email').populate('pendingSaleUpdate.requestedBy', 'fullName email').lean(),
      this.studentModel.find({ status: 'PENDING' }).sort({ createdAt: 1 }).limit(10)
        .select('fullName name studentCode parentName createdAt status').lean(),
      this.trialEnrollmentModel.find({
        status: { $in: [TrialEnrollmentStatus.PENDING_TRIAL, TrialEnrollmentStatus.WAITING_DECISION] },
      }).sort({ updatedAt: 1, createdAt: 1 }).limit(12)
        .populate('classId', 'name code').populate('saleId', 'fullName').populate('studentId', 'fullName studentCode').lean(),
    ]);

    const sessionTasks: DailyTaskItem[] = [
      ...sessionsToday.map((session: any) => ({
        id: `ops-session-today-${String(session._id)}`, type: 'SESSION_TODAY',
        title: `Dieu phoi buoi ${studentName(session.studentId) || ''}`.trim(),
        detail: className(session.classId) || 'Buoi hoc hom nay',
        meta: compactMeta([personName(session.teacherId)]),
        status: session.status, priority: 'MEDIUM' as const, dueAt: toIso(session.scheduledDate),
        route: '/app/sessions', actionLabel: 'Mo buoi hoc',
      })),
      ...sessionsWaitingFinalization.map((session: any) => ({
        id: `ops-session-finalize-${String(session._id)}`, type: 'SESSION_WAITING_FINALIZATION',
        title: `Chot buoi ${studentName(session.studentId) || ''}`.trim(),
        detail: className(session.classId) || 'Buoi hoc can chot',
        meta: compactMeta([personName(session.teacherId)]),
        status: session.status, priority: isOverdue(session.scheduledDate, today) ? 'HIGH' : 'MEDIUM',
        dueAt: toIso(session.scheduledDate), route: '/app/sessions', actionLabel: 'Mo buoi hoc',
        overdue: isOverdue(session.scheduledDate, today),
      })),
    ];

    const supportTasks: DailyTaskItem[] = overdueTickets.map((ticket: any) => ({
      id: `ops-ticket-${String(ticket._id)}`, type: 'OVERDUE_TICKET',
      title: `Xu ly ticket ${ticket.ticketCode || ''}`.trim(),
      detail: ticket.subject || 'Ticket qua han',
      meta: compactMeta([personName(ticket.createdBy), personName(ticket.assignedTo)]),
      status: ticket.status, priority: mapTicketPriority(ticket.priority),
      dueAt: toIso(ticket.dueDate), route: '/app/tickets', actionLabel: 'Mo ticket', overdue: true,
    }));

    const resourceTasks: DailyTaskItem[] = [
      ...pendingTeachers.map((teacher: any) => ({
        id: `ops-teacher-${String(teacher._id)}`, type: 'PENDING_TEACHER',
        title: `Ra soat giao vien ${teacher.userId?.fullName || 'moi'}`,
        detail: teacher.userId?.email || 'Ho so giao vien can tiep nhan',
        meta: compactMeta([teacher.userId?.phone]),
        status: teacher.status, priority: 'MEDIUM' as const, dueAt: toIso(teacher.createdAt),
        route: '/app/pending-approvals', queryParams: { tab: 'teachers' }, actionLabel: 'Mo cho duyet',
      })),
      ...pendingClassUpdates.map((classItem: any) => ({
        id: `ops-class-update-${String(classItem._id)}`, type: 'PENDING_CLASS_UPDATE',
        title: `Cap nhat lop ${classItem.code || classItem.name || ''}`.trim(),
        detail: classItem.name || 'Yeu cau sua lop',
        meta: compactMeta([classItem.pendingSaleUpdate?.requestedBy?.fullName]),
        status: classItem.pendingSaleUpdate?.status, priority: 'MEDIUM' as const,
        dueAt: toIso(classItem.pendingSaleUpdate?.requestedAt),
        route: '/app/pending-approvals', queryParams: { tab: 'classes' }, actionLabel: 'Mo cho duyet',
      })),
      ...pendingStudents.map((student: any) => ({
        id: `ops-student-${String(student._id)}`, type: 'PENDING_STUDENT',
        title: `Ra soat hoc sinh ${student.fullName || student.name || ''}`.trim(),
        detail: student.studentCode || 'Hoc sinh cho xu ly',
        meta: compactMeta([student.parentName]),
        status: student.status, priority: 'LOW' as const, dueAt: toIso(student.createdAt),
        route: '/app/students', actionLabel: 'Mo hoc sinh',
      })),
    ];

    const trialTasks: DailyTaskItem[] = trialQueue.map((trial: any) => ({
      id: `ops-trial-${String(trial._id)}`, type: 'TRIAL_ENROLLMENT',
      title: trial.status === TrialEnrollmentStatus.WAITING_DECISION
        ? `Chot hoc thu ${trial.trialCode || ''}`.trim()
        : `Theo doi hoc thu ${trial.trialCode || ''}`.trim(),
      detail: trial.studentName || studentName(trial.studentId) || 'Hoc thu offline',
      meta: compactMeta([className(trial.classId), personName(trial.saleId), `${trial.trialSessionsUsed || 0}/${trial.maxTrialSessions || 2} buoi`]),
      status: trial.status,
      priority: trial.status === TrialEnrollmentStatus.WAITING_DECISION ? 'HIGH'
        : (trial.trialSessionsUsed || 0) > 0 ? 'MEDIUM' : 'LOW',
      dueAt: toIso(trial.updatedAt || trial.createdAt), route: '/app/trial-enrollments', actionLabel: 'Mo hoc thu',
      overdue: trial.status === TrialEnrollmentStatus.WAITING_DECISION && isOverdue(trial.updatedAt || trial.createdAt, today),
    }));

    return buildDailyTaskBoard(Role.OPS, [
      { key: 'sessions', label: 'Buoi hoc', description: 'Nhung buoi hom nay va buoi can chot ngay.', emptyMessage: 'Khong co buoi hoc nao can xu ly them.', count: 0, tasks: sessionTasks },
      { key: 'support', label: 'Ticket', description: 'Ticket qua han dang duoc giao cho van hanh.', emptyMessage: 'Khong co ticket qua han dang giao cho ban.', count: 0, tasks: supportTasks },
      { key: 'resources', label: 'Nhan su & lop', description: 'Nhan su, lop hoc va hoc sinh can tiep nhan.', emptyMessage: 'Khong co hang muc nhan su hay lop can xu ly.', count: 0, tasks: resourceTasks },
      { key: 'trials', label: 'Hoc thu', description: 'Hoc thu dang hoc va hoc thu can chot quyet dinh.', emptyMessage: 'Khong co hoc thu nao can xu ly.', count: 0, tasks: trialTasks },
    ]);
  }

  private async getTeacherDailyTasks(teacherUserId: string): Promise<DailyTaskBoard> {
    const now = new Date();
    const today = startOfDay(now);
    const teacherObjId = new Types.ObjectId(teacherUserId);

    const [missedCompletions, upcomingSessions, waitingParentConfirm, openTickets] = await Promise.all([
      this.sessionModel.find({ teacherId: teacherObjId, status: SessionStatus.SCHEDULED, scheduledDate: { $lt: now } })
        .sort({ scheduledDate: 1 }).limit(10).populate('studentId', 'fullName studentCode').populate('classId', 'name code').lean(),
      this.sessionModel.find({ teacherId: teacherObjId, status: SessionStatus.SCHEDULED, scheduledDate: { $gte: now } })
        .sort({ scheduledDate: 1 }).limit(10).populate('studentId', 'fullName studentCode').populate('classId', 'name code').lean(),
      this.sessionModel.find({ teacherId: teacherObjId, status: SessionStatus.TEACHER_COMPLETED })
        .sort({ scheduledDate: 1 }).limit(10).populate('studentId', 'fullName studentCode').populate('classId', 'name code').lean(),
      this.ticketModel.find({ createdBy: teacherObjId, status: { $in: getOpenTicketStatuses() } })
        .sort({ updatedAt: -1, createdAt: -1 }).limit(10).lean(),
    ]);

    const completionTasks: DailyTaskItem[] = missedCompletions.map((session: any) => ({
      id: `teacher-missed-${String(session._id)}`, type: 'MISSING_SESSION_COMPLETION',
      title: `Cap nhat buoi ${studentName(session.studentId) || ''}`.trim(),
      detail: className(session.classId) || 'Buoi da qua gio nhung chua chot',
      meta: [], status: session.status, priority: 'HIGH' as const,
      dueAt: toIso(session.scheduledDate), route: '/app/sessions', actionLabel: 'Mo buoi hoc', overdue: true,
    }));

    const upcomingTasks: DailyTaskItem[] = upcomingSessions.map((session: any) => ({
      id: `teacher-upcoming-${String(session._id)}`, type: 'UPCOMING_SESSION',
      title: `Sap day ${studentName(session.studentId) || ''}`.trim(),
      detail: className(session.classId) || 'Buoi hoc sap toi',
      meta: [], status: session.status, priority: isSameDay(session.scheduledDate, today) ? 'HIGH' : 'MEDIUM',
      dueAt: toIso(session.scheduledDate), route: '/app/sessions', actionLabel: 'Mo lich day',
    }));

    const confirmationTasks: DailyTaskItem[] = waitingParentConfirm.map((session: any) => ({
      id: `teacher-wait-parent-${String(session._id)}`, type: 'WAITING_PARENT_CONFIRMATION',
      title: `Cho PH xac nhan ${studentName(session.studentId) || ''}`.trim(),
      detail: className(session.classId) || 'Buoi hoc dang cho PH xac nhan',
      meta: [], status: session.status, priority: isOverdue(session.scheduledDate, today) ? 'MEDIUM' : 'LOW',
      dueAt: toIso(session.scheduledDate), route: '/app/sessions', actionLabel: 'Mo buoi hoc',
      overdue: isOverdue(session.scheduledDate, today),
    }));

    const supportTasks: DailyTaskItem[] = openTickets.map((ticket: any) => ({
      id: `teacher-ticket-${String(ticket._id)}`, type: 'TEACHER_OPEN_TICKET',
      title: `Theo doi ticket ${ticket.ticketCode || ''}`.trim(),
      detail: ticket.subject || 'Ticket dang mo',
      meta: compactMeta([ticket.priority]), status: ticket.status, priority: mapTicketPriority(ticket.priority),
      dueAt: toIso(ticket.dueDate), route: '/app/tickets', actionLabel: 'Mo ticket',
      overdue: isOverdue(ticket.dueDate, now),
    }));

    return buildDailyTaskBoard(Role.TEACHER, [
      { key: 'completion', label: 'Can cap nhat', description: 'Buoi da qua gio nhung chua duoc giao vien chot.', emptyMessage: 'Khong co buoi nao bi tre cap nhat.', count: 0, tasks: completionTasks },
      { key: 'upcoming', label: 'Sap toi', description: 'Nhung buoi day can mo ra de chuan bi trong ngay.', emptyMessage: 'Khong co buoi day sap toi nao.', count: 0, tasks: upcomingTasks },
      { key: 'confirmations', label: 'Cho PH', description: 'Buoi hoc da nop nhung dang cho phu huynh xac nhan.', emptyMessage: 'Khong co buoi nao dang cho PH xac nhan.', count: 0, tasks: confirmationTasks },
      { key: 'support', label: 'Ho tro', description: 'Ticket giao vien dang mo can tiep tuc theo doi.', emptyMessage: 'Khong co ticket nao dang mo.', count: 0, tasks: supportTasks },
    ]);
  }

  private async getParentDailyTasks(parentUserId: string): Promise<DailyTaskBoard> {
    const now = new Date();
    const today = startOfDay(now);
    const parentObjId = new Types.ObjectId(parentUserId);
    const children = await this.studentModel.find({ parentUserId: parentObjId }).select('fullName name studentCode').lean();
    const childIds = children.map((child) => child._id);

    const [needsConfirmation, upcomingSessions, pendingTopUps, openTickets] = await Promise.all([
      this.sessionModel.find({ studentId: { $in: childIds }, status: SessionStatus.TEACHER_COMPLETED })
        .sort({ scheduledDate: 1 }).limit(10).populate('teacherId', 'fullName').populate('studentId', 'fullName studentCode').populate('classId', 'name code').lean(),
      this.sessionModel.find({ studentId: { $in: childIds }, status: SessionStatus.SCHEDULED, scheduledDate: { $gte: now } })
        .sort({ scheduledDate: 1 }).limit(10).populate('teacherId', 'fullName').populate('studentId', 'fullName studentCode').populate('classId', 'name code').lean(),
      this.ledgerModel.find({ userId: parentObjId, type: TransactionType.TOP_UP, status: TransactionStatus.PENDING })
        .sort({ createdAt: 1 }).limit(10).lean(),
      this.ticketModel.find({ createdBy: parentObjId, status: { $in: getOpenTicketStatuses() } })
        .sort({ updatedAt: -1, createdAt: -1 }).limit(10).lean(),
    ]);

    const confirmationTasks: DailyTaskItem[] = needsConfirmation.map((session: any) => ({
      id: `parent-confirm-${String(session._id)}`, type: 'PARENT_CONFIRM_SESSION',
      title: `Xac nhan buoi ${studentName(session.studentId) || ''}`.trim(),
      detail: className(session.classId) || 'Buoi hoc dang cho phu huynh xac nhan',
      meta: compactMeta([personName(session.teacherId)]),
      status: session.status, priority: isOverdue(session.scheduledDate, today) ? 'HIGH' : 'MEDIUM',
      dueAt: toIso(session.scheduledDate), route: '/app/sessions', actionLabel: 'Mo buoi hoc',
      overdue: isOverdue(session.scheduledDate, today),
    }));

    const upcomingTasks: DailyTaskItem[] = upcomingSessions.map((session: any) => ({
      id: `parent-upcoming-${String(session._id)}`, type: 'PARENT_UPCOMING_SESSION',
      title: `Sap hoc ${studentName(session.studentId) || ''}`.trim(),
      detail: className(session.classId) || 'Buoi hoc sap toi',
      meta: compactMeta([personName(session.teacherId)]),
      status: session.status, priority: isSameDay(session.scheduledDate, today) ? 'HIGH' : 'LOW',
      dueAt: toIso(session.scheduledDate), route: '/app/parent-calendar', actionLabel: 'Mo lich hoc',
    }));

    const financeTasks: DailyTaskItem[] = pendingTopUps.map((entry: any) => ({
      id: `parent-topup-${String(entry._id)}`, type: 'PARENT_PENDING_TOP_UP',
      title: `Theo doi yeu cau nap vi ${formatCurrency(entry.amount)}`,
      detail: 'Yeu cau nap vi dang cho xac nhan',
      meta: compactMeta([entry.paymentMethod]),
      status: entry.status, priority: 'MEDIUM' as const, dueAt: toIso(entry.createdAt),
      route: '/app/wallets', actionLabel: 'Mo vi',
    }));

    const supportTasks: DailyTaskItem[] = openTickets.map((ticket: any) => ({
      id: `parent-ticket-${String(ticket._id)}`, type: 'PARENT_OPEN_TICKET',
      title: `Theo doi ticket ${ticket.ticketCode || ''}`.trim(),
      detail: ticket.subject || 'Yeu cau ho tro dang mo',
      meta: compactMeta([ticket.priority]), status: ticket.status, priority: mapTicketPriority(ticket.priority),
      dueAt: toIso(ticket.dueDate), route: '/app/tickets', actionLabel: 'Mo ticket',
      overdue: isOverdue(ticket.dueDate, now),
    }));

    return buildDailyTaskBoard(Role.PARENT, [
      { key: 'confirmations', label: 'Can xac nhan', description: 'Nhung buoi hoc phu huynh can vao xac nhan.', emptyMessage: 'Khong co buoi hoc nao can xac nhan.', count: 0, tasks: confirmationTasks },
      { key: 'upcoming', label: 'Sap hoc', description: 'Lich hoc sap toi cua con de chuan bi trong ngay.', emptyMessage: 'Khong co buoi hoc sap toi nao.', count: 0, tasks: upcomingTasks },
      { key: 'finance', label: 'Giao dich', description: 'Yeu cau nap vi dang cho xac nhan.', emptyMessage: 'Khong co giao dich nao dang cho xu ly.', count: 0, tasks: financeTasks },
      { key: 'support', label: 'Ho tro', description: 'Ticket dang mo can theo doi tiep.', emptyMessage: 'Khong co ticket nao dang mo.', count: 0, tasks: supportTasks },
    ]);
  }

  private async getSaleDailyTasks(saleUserId: string): Promise<DailyTaskBoard> {
    const today = startOfDay(new Date());
    const tomorrow = addDays(today, 1);
    const saleObjId = new Types.ObjectId(saleUserId);

    const [leadFollowUps, orderQueue, pendingInvoices, trialQueue] = await Promise.all([
      this.leadModel.find({ saleId: saleObjId, nextFollowUp: { $lte: tomorrow }, status: { $in: getActiveLeadStatuses() } })
        .sort({ nextFollowUp: 1 }).limit(12).lean(),
      this.orderModel.find({ saleId: saleObjId, status: { $in: [OrderStatus.SUBMITTED, 'NEEDS_INFO', OrderStatus.APPROVED] } })
        .sort({ createdAt: 1 }).limit(12).lean(),
      this.invoiceModel.find({ $or: [{ createdBy: saleObjId }, { saleId: saleObjId }], status: InvoiceStatus.PENDING_APPROVAL })
        .sort({ createdAt: 1 }).limit(10).populate('studentId', 'fullName studentCode').lean(),
      this.trialEnrollmentModel.find({
        saleId: saleObjId, status: { $in: [TrialEnrollmentStatus.PENDING_TRIAL, TrialEnrollmentStatus.WAITING_DECISION] },
      }).sort({ updatedAt: 1, createdAt: 1 }).limit(12)
        .populate('classId', 'name code').populate('studentId', 'fullName studentCode').lean(),
    ]);

    const followUpTasks: DailyTaskItem[] = leadFollowUps.map((lead: any) => ({
      id: `sale-lead-${String(lead._id)}`, type: 'SALE_FOLLOW_UP',
      title: `Follow-up ${lead.parentName || lead.leadCode || 'lead'}`,
      detail: lead.parentPhone || 'Lead den han lien he',
      meta: compactMeta([lead.leadCode, lead.status]),
      status: lead.status, priority: isOverdue(lead.nextFollowUp, today) ? 'HIGH' : 'MEDIUM',
      dueAt: toIso(lead.nextFollowUp), route: '/app/leads', actionLabel: 'Mo leads',
      overdue: isOverdue(lead.nextFollowUp, today),
    }));

    const orderTasks: DailyTaskItem[] = orderQueue.map((order: any) => ({
      id: `sale-order-${String(order._id)}`, type: 'SALE_ORDER_QUEUE',
      title: `Theo doi don ${order.orderCode}`,
      detail: compactMeta([order.parentName, order.studentName]).join(' · ') || 'Don hang can theo doi',
      meta: compactMeta([formatCurrency(order.finalAmount)]),
      status: order.status, priority: order.status === 'NEEDS_INFO' ? 'HIGH' : 'MEDIUM',
      dueAt: toIso(order.createdAt), route: '/app/orders', actionLabel: 'Mo don hang',
    }));

    const financeTasks: DailyTaskItem[] = pendingInvoices.map((invoice: any) => ({
      id: `sale-invoice-${String(invoice._id)}`, type: 'SALE_PENDING_INVOICE',
      title: `Theo doi hoa don ${invoice.invoiceNumber}`,
      detail: studentName(invoice.studentId) || 'Hoa don dang cho duyet',
      meta: [], status: invoice.status, priority: 'MEDIUM' as const,
      dueAt: toIso(invoice.createdAt), route: '/app/invoices', actionLabel: 'Mo hoa don',
    }));

    const trialTasks: DailyTaskItem[] = trialQueue.map((trial: any) => ({
      id: `sale-trial-${String(trial._id)}`, type: 'TRIAL_ENROLLMENT',
      title: trial.status === TrialEnrollmentStatus.WAITING_DECISION
        ? `Chot PH sau hoc thu ${trial.trialCode || ''}`.trim()
        : `Xep hoc thu ${trial.trialCode || ''}`.trim(),
      detail: trial.studentName || studentName(trial.studentId) || 'Hoc thu offline',
      meta: compactMeta([className(trial.classId), `${trial.trialSessionsUsed || 0}/${trial.maxTrialSessions || 2} buoi`, trial.parentPhone]),
      status: trial.status,
      priority: trial.status === TrialEnrollmentStatus.WAITING_DECISION ? 'HIGH'
        : (trial.trialSessionsUsed || 0) > 0 ? 'MEDIUM' : 'LOW',
      dueAt: toIso(trial.updatedAt || trial.createdAt), route: '/app/trial-enrollments', actionLabel: 'Mo hoc thu',
      overdue: trial.status === TrialEnrollmentStatus.WAITING_DECISION && isOverdue(trial.updatedAt || trial.createdAt, today),
    }));

    return buildDailyTaskBoard(Role.SALE, [
      { key: 'followups', label: 'Follow-up', description: 'Lead den han va lead da qua han can lien he ngay.', emptyMessage: 'Khong co lead nao den han follow-up.', count: 0, tasks: followUpTasks },
      { key: 'orders', label: 'Don hang', description: 'Don dang cho duyet, bo sung hoac tiep tuc handover.', emptyMessage: 'Khong co don hang nao can theo doi hom nay.', count: 0, tasks: orderTasks },
      { key: 'finance', label: 'Hoa don', description: 'Hoa don do sale tao dang cho duyet.', emptyMessage: 'Khong co hoa don nao dang cho duyet.', count: 0, tasks: financeTasks },
      { key: 'trials', label: 'Hoc thu', description: 'Ban ghi hoc thu dang hoc va hoc thu can chot voi phu huynh.', emptyMessage: 'Khong co hoc thu nao can theo doi.', count: 0, tasks: trialTasks },
    ]);
  }

  private async getAdsDailyTasks(): Promise<DailyTaskBoard> {
    const actionsResponse = await this.adsAnalyticsService.getActionsRequired().catch(() => ({
      actions: [] as ActionableSuggestion[],
      summary: null,
    }));
    const actions = actionsResponse.actions || [];

    const urgentTasks = actions
      .filter((action) => action.priority === 'CRITICAL' || action.priority === 'HIGH')
      .map((action) => mapAdsActionToTask(action));
    const growthTasks = actions
      .filter((action) => action.priority !== 'CRITICAL' && action.priority !== 'HIGH')
      .map((action) => mapAdsActionToTask(action));

    return buildDailyTaskBoard(Role.ADSMANAGER, [
      { key: 'urgent', label: 'Xu ly ngay', description: 'Nhung de xuat uu tien cao can mo analytics hoac management de thao tac.', emptyMessage: 'Khong co de xuat cap bach nao tu he thong ads.', count: 0, tasks: urgentTasks },
      { key: 'growth', label: 'Mo rong', description: 'Nhung de xuat toi uu budget va mo rong nhom quang cao.', emptyMessage: 'Khong co de xuat mo rong nao can xu ly ngay.', count: 0, tasks: growthTasks },
    ]);
  }
}
