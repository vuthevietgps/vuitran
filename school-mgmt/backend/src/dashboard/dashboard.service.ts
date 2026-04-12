import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { Session, SessionDocument } from '../sessions/schemas/session.schema';
import { Wallet, WalletDocument } from '../wallets/schemas/wallet.schema';
import { LedgerEntry, LedgerEntryDocument, TransactionType, TransactionStatus } from '../wallets/schemas/ledger-entry.schema';
import { Payroll, PayrollDocument, PayrollStatus } from '../payroll/schemas/payroll.schema';
import { Ticket, TicketDocument, TicketStatus } from '../tickets/schemas/ticket.schema';
import { TeacherProfile } from '../teachers/schemas/teacher-profile.schema';
import { Student, StudentDocument } from '../students/schemas/student.schema';
import { Classroom, ClassDocument } from '../classes/schemas/class.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { Invoice, InvoiceDocument } from '../invoices/schemas/invoice.schema';
import { Attendance, AttendanceDocument } from '../attendance/schemas/attendance.schema';
import { Expense, ExpenseDocument, PaymentStatus as ExpensePaymentStatus } from '../expenses/schemas/expense.schema';
import { Order, OrderDocument } from '../orders/schemas/order.schema';
import { Role } from '../common/interfaces/role.enum';
import {
  DirectorDashboard, AccountingDashboard, OpsDashboard,
  TeacherDashboard, ParentDashboard, DailyTaskBoard,
} from './dashboard.types';
import { buildDateFilter } from './dashboard.utils';
import { DashboardDailyTasksService } from './dashboard-daily-tasks.service';
import { DashboardAnalyticsService } from './dashboard-analytics.service';

@Injectable()
export class DashboardService {
  constructor(
    private readonly dailyTasksService: DashboardDailyTasksService,
    private readonly analyticsService: DashboardAnalyticsService,
    @InjectModel(Session.name) private sessionModel: Model<SessionDocument>,
    @InjectModel(Wallet.name) private walletModel: Model<WalletDocument>,
    @InjectModel(LedgerEntry.name) private ledgerModel: Model<LedgerEntryDocument>,
    @InjectModel(Payroll.name) private payrollModel: Model<PayrollDocument>,
    @InjectModel(Ticket.name) private ticketModel: Model<TicketDocument>,
    @InjectModel(TeacherProfile.name) private teacherModel: Model<any>,
    @InjectModel(Student.name) private studentModel: Model<StudentDocument>,
    @InjectModel(Classroom.name) private classModel: Model<ClassDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Invoice.name) private invoiceModel: Model<InvoiceDocument>,
    @InjectModel(Attendance.name) private attendanceModel: Model<AttendanceDocument>,
    @InjectModel(Expense.name) private expenseModel: Model<ExpenseDocument>,
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
  ) {}

  // ════════════════════════════════════════════════════════════════════
  // 1. DIRECTOR — Tổng quan toàn hệ thống
  // ════════════════════════════════════════════════════════════════════

  async getDirectorDashboard(fromDate?: string, toDate?: string): Promise<DirectorDashboard> {
    const dateFilter = buildDateFilter(fromDate, toDate);
    const expenseDateFilter: any = {};
    if (fromDate || toDate) {
      expenseDateFilter.expenseDate = {};
      if (fromDate) expenseDateFilter.expenseDate.$gte = new Date(fromDate);
      if (toDate) { const end = new Date(toDate); end.setHours(23, 59, 59, 999); expenseDateFilter.expenseDate.$lte = end; }
    }

    const [
      sessionStats, userStats, payrollStats, ticketStats, walletStats, expenseStats,
      recentSessions, recentTickets, recentTopUps,
    ] = await Promise.all([
      this.getSessionStats(dateFilter),
      this.getUserStats(),
      this.getPayrollStats(dateFilter),
      this.getTicketStats(),
      this.getWalletAggregates(),
      this.getExpenseAggregates(expenseDateFilter),
      this.sessionModel.find(dateFilter.createdAt ? dateFilter : {}).sort({ createdAt: -1 }).limit(10)
        .populate('teacherId', 'fullName').populate('studentId', 'fullName').lean(),
      this.ticketModel.find().sort({ createdAt: -1 }).limit(10).populate('createdBy', 'fullName').lean(),
      this.ledgerModel.find({ type: TransactionType.TOP_UP, status: TransactionStatus.APPROVED }).sort({ createdAt: -1 }).limit(10)
        .populate('userId', 'fullName').lean(),
    ]);

    const grossProfit = sessionStats.totalRevenue - sessionStats.totalTeacherCost;
    const netProfit = grossProfit - expenseStats.totalPaid;

    return {
      overview: {
        totalRevenue: sessionStats.totalRevenue, totalTeacherCost: sessionStats.totalTeacherCost,
        totalExpenses: expenseStats.totalPaid, grossProfit, netProfit,
        profitMargin: sessionStats.totalRevenue > 0 ? Math.round((netProfit / sessionStats.totalRevenue) * 10000) / 100 : 0,
      },
      sessions: {
        total: sessionStats.total, byStatus: sessionStats.byStatus,
        completionRate: sessionStats.total > 0 ? Math.round(((sessionStats.byStatus['FINALIZED'] || 0) / sessionStats.total) * 10000) / 100 : 0,
      },
      users: userStats, payroll: payrollStats, tickets: ticketStats, wallets: walletStats,
      recentActivity: { recentSessions, recentTickets, recentTopUps },
    };
  }

  // ════════════════════════════════════════════════════════════════════
  // 2. ACCOUNTING — Tài chính
  // ════════════════════════════════════════════════════════════════════

  async getAccountingDashboard(fromDate?: string, toDate?: string): Promise<AccountingDashboard> {
    const dateFilter = buildDateFilter(fromDate, toDate);
    const dateMatch = dateFilter.createdAt ? { createdAt: dateFilter.createdAt } : {};

    const [financialSummary, walletAgg, pendingTopUps, payrollAgg, ledgerRecent, sessionRevenue] = await Promise.all([
      this.ledgerModel.aggregate([
        { $match: { status: TransactionStatus.COMPLETED, ...dateMatch } },
        { $group: { _id: '$type', totalAmount: { $sum: '$amount' }, count: { $sum: 1 } } },
      ]),
      this.getWalletAggregates(),
      this.ledgerModel.find({ type: TransactionType.TOP_UP, status: TransactionStatus.PENDING }).sort({ createdAt: -1 })
        .populate('userId', 'fullName email').lean(),
      this.payrollModel.aggregate([
        ...(dateMatch.createdAt ? [{ $match: dateMatch }] : []),
        { $group: { _id: '$status', count: { $sum: 1 }, totalNet: { $sum: '$netAmount' }, totalGross: { $sum: '$grossAmount' } } },
      ]),
      this.ledgerModel.find(dateMatch).sort({ createdAt: -1 }).limit(20).populate('userId', 'fullName').lean(),
      this.sessionModel.aggregate([
        { $match: { status: 'FINALIZED', ...dateMatch } },
        { $group: { _id: null, totalRevenue: { $sum: '$amountCharged' }, totalTeacherCost: { $sum: '$teacherPayout' } } },
      ]),
    ]);

    const summaryMap: Record<string, { totalAmount: number; count: number }> = {};
    financialSummary.forEach((item: any) => { summaryMap[item._id] = { totalAmount: item.totalAmount, count: item.count }; });

    const payrollMap: Record<string, { count: number; totalNet: number; totalGross: number }> = {};
    let totalPaidThisPeriod = 0;
    payrollAgg.forEach((item: any) => {
      payrollMap[item._id] = { count: item.count, totalNet: item.totalNet, totalGross: item.totalGross };
      if (item._id === PayrollStatus.PAID) totalPaidThisPeriod = item.totalNet;
    });

    const rev = sessionRevenue[0] || { totalRevenue: 0, totalTeacherCost: 0 };
    const frozenCount = await this.walletModel.countDocuments({ status: 'FROZEN' });

    return {
      financialSummary: summaryMap,
      wallets: { ...walletAgg, walletCount: await this.walletModel.countDocuments(), frozenCount },
      pendingTopUps,
      payroll: { byStatus: payrollMap, totalPaidThisPeriod },
      ledgerRecent,
      revenue: { totalSessionRevenue: rev.totalRevenue, totalTeacherCost: rev.totalTeacherCost, grossProfit: rev.totalRevenue - rev.totalTeacherCost },
    };
  }

  // ════════════════════════════════════════════════════════════════════
  // 3. OPS — Vận hành
  // ════════════════════════════════════════════════════════════════════

  async getOpsDashboard(opsUserId: string): Promise<OpsDashboard> {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);

    const [
      classCounts, sessionCounts, teacherCounts, studentCounts, ticketCounts,
      upcomingToday, needsFinalization, assignedToMe, recentTickets,
    ] = await Promise.all([
      this.classModel.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      this.sessionModel.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      this.teacherModel.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      Promise.all([this.studentModel.countDocuments(), this.studentModel.countDocuments({ status: 'PENDING' })]),
      Promise.all([
        this.ticketModel.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
        this.ticketModel.aggregate([{ $group: { _id: '$priority', count: { $sum: 1 } } }]),
        this.ticketModel.countDocuments({
          status: { $nin: [TicketStatus.RESOLVED, TicketStatus.CLOSED, TicketStatus.CANCELLED] },
          dueDate: { $lt: new Date() },
        }),
      ]),
      this.sessionModel.countDocuments({ scheduledDate: { $gte: today, $lt: tomorrow }, status: 'SCHEDULED' }),
      this.sessionModel.countDocuments({ status: 'TEACHER_COMPLETED' }),
      opsUserId && Types.ObjectId.isValid(opsUserId)
        ? this.ticketModel.countDocuments({ assignedTo: opsUserId })
        : Promise.resolve(0),
      this.ticketModel.find().sort({ createdAt: -1 }).limit(15).populate('createdBy', 'fullName').populate('assignedTo', 'fullName').lean(),
    ]);

    const classByStatus: Record<string, number> = {};
    let totalClasses = 0, activeClasses = 0;
    classCounts.forEach((c: any) => { classByStatus[c._id] = c.count; totalClasses += c.count; if (c._id === 'ACTIVE') activeClasses = c.count; });

    const sessionByStatus: Record<string, number> = {};
    let totalSessions = 0;
    sessionCounts.forEach((s: any) => { sessionByStatus[s._id] = s.count; totalSessions += s.count; });

    let totalTeachers = 0, activeT = 0, pendingT = 0, suspendedT = 0;
    teacherCounts.forEach((t: any) => {
      totalTeachers += t.count;
      if (t._id === 'ACTIVE') activeT = t.count;
      if (t._id === 'PENDING') pendingT = t.count;
      if (t._id === 'SUSPENDED') suspendedT = t.count;
    });

    const ticketByStatus: Record<string, number> = {};
    let totalTickets = 0;
    ticketCounts[0].forEach((t: any) => { ticketByStatus[t._id] = t.count; totalTickets += t.count; });
    const ticketByPriority: Record<string, number> = {};
    ticketCounts[1].forEach((t: any) => { ticketByPriority[t._id] = t.count; });

    return {
      classes: { total: totalClasses, active: activeClasses, byStatus: classByStatus },
      sessions: { total: totalSessions, byStatus: sessionByStatus, upcomingToday, needsFinalization },
      teachers: { total: totalTeachers, active: activeT, pendingApproval: pendingT, suspended: suspendedT },
      students: { total: studentCounts[0], pendingApproval: studentCounts[1] },
      tickets: { total: totalTickets, byStatus: ticketByStatus, byPriority: ticketByPriority, overdueCount: ticketCounts[2], assignedToMe },
      recentTickets,
    };
  }

  // ════════════════════════════════════════════════════════════════════
  // 4. TEACHER — Giáo viên
  // ════════════════════════════════════════════════════════════════════

  async getTeacherDashboard(teacherUserId: string): Promise<TeacherDashboard> {
    const now = new Date();
    const teacherObjId = new Types.ObjectId(teacherUserId);

    const [profile, sessionAgg, upcomingSessions, payrollData, activeClasses, ticketData] = await Promise.all([
      this.teacherModel.findOne({ userId: teacherUserId }).lean(),
      this.sessionModel.aggregate([
        { $match: { teacherId: teacherObjId } },
        { $group: { _id: '$status', count: { $sum: 1 }, totalPayout: { $sum: '$teacherPayout' } } },
      ]),
      this.sessionModel.find({ teacherId: teacherObjId, status: 'SCHEDULED', scheduledDate: { $gte: now } })
        .sort({ scheduledDate: 1 }).limit(10).populate('studentId', 'fullName').populate('classId', 'name').lean(),
      this.payrollModel.find({ teacherId: teacherObjId }).sort({ createdAt: -1 }).limit(1).lean(),
      this.classModel.find({
        status: 'ACTIVE',
        $or: [
          { teacher: teacherObjId },
          { substituteTeachers: { $elemMatch: { teacherId: teacherObjId, fromDate: { $lte: now }, toDate: { $gte: now } } } },
        ],
      }).select('name subject grade students schedule').lean(),
      Promise.all([
        this.ticketModel.countDocuments({ createdBy: teacherObjId }),
        this.ticketModel.countDocuments({
          createdBy: teacherObjId,
          status: { $in: [TicketStatus.OPEN, TicketStatus.IN_PROGRESS, TicketStatus.WAITING_INFO] },
        }),
      ]),
    ]);

    const byStatus: Record<string, number> = {};
    let totalSessions = 0, totalEarned = 0, completedCount = 0, cancelledCount = 0, noShowCount = 0;
    sessionAgg.forEach((s: any) => {
      byStatus[s._id] = s.count; totalSessions += s.count;
      if (s._id === 'FINALIZED') { totalEarned += s.totalPayout; completedCount = s.count; }
      if (s._id === 'CANCELLED') cancelledCount = s.count;
      if (s._id === 'NO_SHOW') noShowCount = s.count;
    });

    const pendingPayout = await this.sessionModel.aggregate([
      { $match: { teacherId: teacherObjId, status: 'FINALIZED', isTeacherPaid: false } },
      { $group: { _id: null, total: { $sum: '$teacherPayout' } } },
    ]);

    return {
      profile,
      sessions: { total: totalSessions, byStatus, upcomingCount: upcomingSessions.length, completedCount, cancelledCount, noShowCount },
      earnings: { totalEarned, pendingPayout: pendingPayout[0]?.total || 0, lastPayroll: payrollData[0] || null },
      classes: { activeCount: activeClasses.length, list: activeClasses },
      tickets: { myTickets: ticketData[0], openTickets: ticketData[1] },
      upcoming: upcomingSessions,
    };
  }

  // ════════════════════════════════════════════════════════════════════
  // 5. PARENT — Phụ huynh
  // ════════════════════════════════════════════════════════════════════

  async getParentDashboard(parentUserId: string): Promise<ParentDashboard> {
    const now = new Date();
    const parentObjId = new Types.ObjectId(parentUserId);
    const children = await this.studentModel.find({ parentUserId: parentObjId }).select('fullName grade subjects').lean();
    const childIds = children.map((c) => c._id);

    const [
      wallet, sessionAgg, upcomingSessions, needsConfirm, recentTransactions,
      ticketData, invoicesList, invoiceTotalsAgg, attendanceAgg, recentAttendance,
    ] = await Promise.all([
      this.walletModel.findOne({ userId: parentObjId }).lean(),
      this.sessionModel.aggregate([
        { $match: { studentId: { $in: childIds } } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      this.sessionModel.find({ studentId: { $in: childIds }, status: 'SCHEDULED', scheduledDate: { $gte: now } })
        .sort({ scheduledDate: 1 }).limit(10).populate('teacherId', 'fullName').populate('studentId', 'fullName').populate('classId', 'name').lean(),
      this.sessionModel.countDocuments({ studentId: { $in: childIds }, status: 'TEACHER_COMPLETED' }),
      this.ledgerModel.find({ userId: parentObjId }).sort({ createdAt: -1 }).limit(15).lean(),
      Promise.all([
        this.ticketModel.countDocuments({ createdBy: parentObjId }),
        this.ticketModel.countDocuments({
          createdBy: parentObjId,
          status: { $in: [TicketStatus.OPEN, TicketStatus.IN_PROGRESS, TicketStatus.WAITING_INFO] },
        }),
      ]),
      this.invoiceModel.find({ studentId: { $in: childIds } }).sort({ paymentDate: -1 }).limit(20)
        .populate('studentId', 'fullName studentCode').populate('classId', 'name code').lean(),
      this.invoiceModel.aggregate([
        { $match: { studentId: { $in: childIds } } },
        { $group: { _id: null, totalCount: { $sum: 1 }, totalPaid: { $sum: { $cond: [{ $in: ['$status', ['APPROVED', 'PAID']] }, '$amount', 0] } } } },
      ]),
      this.attendanceModel.aggregate([
        { $match: { studentId: { $in: childIds } } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      this.attendanceModel.find({ studentId: { $in: childIds } }).sort({ date: -1 }).limit(20)
        .populate('studentId', 'fullName studentCode').populate('classId', 'name code').populate('teacherId', 'fullName').lean(),
    ]);

    const byStatus: Record<string, number> = {};
    let totalSessions = 0;
    sessionAgg.forEach((s: any) => { byStatus[s._id] = s.count; totalSessions += s.count; });

    const invoiceSummary = (invoiceTotalsAgg as any[])[0] || { totalCount: 0, totalPaid: 0 };
    const attendByStatus: Record<string, number> = {};
    let totalAttendance = 0;
    (attendanceAgg as any[]).forEach((a: any) => { attendByStatus[a._id] = a.count; totalAttendance += a.count; });

    return {
      wallet: wallet ? {
        balance: wallet.balance, totalTopUp: wallet.totalTopUp, totalDeducted: wallet.totalDeducted,
        totalRefunded: wallet.totalRefunded, status: wallet.status,
      } : null,
      children: { total: children.length, list: children },
      sessions: { total: totalSessions, byStatus, upcomingCount: byStatus['SCHEDULED'] || 0, needsConfirmation: needsConfirm },
      recentSessions: upcomingSessions, recentTransactions,
      invoices: { total: invoiceSummary.totalCount, totalPaid: invoiceSummary.totalPaid, list: invoicesList },
      attendance: { total: totalAttendance, byStatus: attendByStatus, recentList: recentAttendance },
      tickets: { myTickets: ticketData[0], openTickets: ticketData[1] },
    };
  }

  // ════════════════════════════════════════════════════════════════════
  // DAILY TASKS — Delegates to DashboardDailyTasksService
  // ════════════════════════════════════════════════════════════════════

  async getDailyTasks(role: Role, userId: string): Promise<DailyTaskBoard> {
    return this.dailyTasksService.getDailyTasks(role, userId);
  }

  // ════════════════════════════════════════════════════════════════════
  // ANALYTICS — Delegates to DashboardAnalyticsService
  // ════════════════════════════════════════════════════════════════════

  async getDirectorComprehensive(fromDate?: string, toDate?: string, userId?: string) {
    const [director, accounting, ops, birthdays, staffLists] = await Promise.all([
      this.getDirectorDashboard(fromDate, toDate),
      this.getAccountingDashboard(fromDate, toDate),
      this.getOpsDashboard(userId || ''),
      this.analyticsService.getBirthdaysByMonth(),
      this.analyticsService.getStaffLists(),
    ]);
    return { director, accounting, ops, birthdays, staffLists };
  }

  async getBirthdaysByMonth(month?: number) {
    return this.analyticsService.getBirthdaysByMonth(month);
  }

  async getStaffLists() {
    return this.analyticsService.getStaffLists();
  }

  async getTeacherKPI(fromDate?: string, toDate?: string) {
    return this.analyticsService.getTeacherKPI(fromDate, toDate);
  }

  async getCalendarOverview(month?: number, year?: number, teacherId?: string, classId?: string) {
    return this.analyticsService.getCalendarOverview(month, year, teacherId, classId);
  }

  async getSalesDashboard(saleId?: string, fromDate?: string, toDate?: string) {
    return this.analyticsService.getSalesDashboard(saleId, fromDate, toDate);
  }

  async getRevenueReport(period: 'monthly' | 'quarterly' | 'yearly' = 'monthly', fromDate?: string, toDate?: string) {
    return this.analyticsService.getRevenueReport(period, fromDate, toDate);
  }

  async getRetentionMetrics() {
    return this.analyticsService.getRetentionMetrics();
  }

  async getEmployeePerformance() {
    return this.analyticsService.getEmployeePerformance();
  }

  async getRevenueForecast() {
    return this.analyticsService.getRevenueForecast();
  }

  // ════════════════════════════════════════════════════════════════════
  // Private aggregate helpers
  // ════════════════════════════════════════════════════════════════════

  private async getSessionStats(dateFilter: any) {
    const match = dateFilter.createdAt ? dateFilter : {};
    const agg = await this.sessionModel.aggregate([
      { $match: match },
      { $group: { _id: '$status', count: { $sum: 1 }, revenue: { $sum: '$amountCharged' }, teacherCost: { $sum: '$teacherPayout' } } },
    ]);
    const byStatus: Record<string, number> = {};
    let total = 0, totalRevenue = 0, totalTeacherCost = 0;
    agg.forEach((item: any) => {
      byStatus[item._id] = item.count; total += item.count;
      if (item._id === 'FINALIZED') { totalRevenue += item.revenue; totalTeacherCost += item.teacherCost; }
    });
    return { total, byStatus, totalRevenue, totalTeacherCost };
  }

  private async getUserStats() {
    const [totalTeachers, activeTeachers, totalParents, totalStudents] = await Promise.all([
      this.teacherModel.countDocuments(),
      this.teacherModel.countDocuments({ status: 'ACTIVE' }),
      this.userModel.countDocuments({ role: 'PARENT' }),
      this.studentModel.countDocuments(),
    ]);
    return { totalTeachers, activeTeachers, totalParents, totalStudents };
  }

  private async getPayrollStats(dateFilter: any) {
    const match = dateFilter.createdAt ? { createdAt: dateFilter.createdAt } : {};
    const agg = await this.payrollModel.aggregate([
      { $match: match },
      { $group: { _id: '$status', count: { $sum: 1 }, totalNet: { $sum: '$netAmount' } } },
    ]);
    const byStatus: Record<string, { count: number; totalNet: number }> = {};
    let totalPaid = 0, pendingApproval = 0;
    agg.forEach((item: any) => {
      byStatus[item._id] = { count: item.count, totalNet: item.totalNet };
      if (item._id === PayrollStatus.PAID) totalPaid = item.totalNet;
      if (item._id === PayrollStatus.PENDING_REVIEW) pendingApproval = item.count;
    });
    return { totalPaid, pendingApproval, byStatus };
  }

  private async getTicketStats() {
    const [statusAgg, resolvedAgg, overdueCount] = await Promise.all([
      this.ticketModel.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      this.ticketModel.aggregate([
        { $match: { status: { $in: [TicketStatus.RESOLVED, TicketStatus.CLOSED] }, 'resolution.resolvedAt': { $exists: true } } },
        { $project: { resolutionMs: { $subtract: ['$resolution.resolvedAt', '$createdAt'] } } },
        { $group: { _id: null, avgMs: { $avg: '$resolutionMs' } } },
      ]),
      this.ticketModel.countDocuments({
        status: { $nin: [TicketStatus.RESOLVED, TicketStatus.CLOSED, TicketStatus.CANCELLED] },
        dueDate: { $lt: new Date() },
      }),
    ]);

    let total = 0, openCount = 0;
    statusAgg.forEach((s: any) => { total += s.count; if (s._id === TicketStatus.OPEN) openCount = s.count; });
    const avgResolutionHours = resolvedAgg[0]?.avgMs ? Math.round((resolvedAgg[0].avgMs / (1000 * 60 * 60)) * 10) / 10 : null;
    return { total, openCount, overdueCount, avgResolutionHours };
  }

  private async getWalletAggregates() {
    const agg = await this.walletModel.aggregate([
      { $match: { status: { $ne: 'CLOSED' } } },
      { $group: { _id: null, totalBalance: { $sum: '$balance' }, totalTopUp: { $sum: '$totalTopUp' }, totalDeducted: { $sum: '$totalDeducted' }, totalRefunded: { $sum: '$totalRefunded' } } },
    ]);
    return agg[0] || { totalBalance: 0, totalTopUp: 0, totalDeducted: 0, totalRefunded: 0 };
  }

  private async getExpenseAggregates(dateFilter: any = {}) {
    const paidFilter = { paymentStatus: ExpensePaymentStatus.PAID, ...dateFilter };
    const allFilter = { ...dateFilter };

    const [paidAgg, byStatusAgg, byCategoryAgg] = await Promise.all([
      this.expenseModel.aggregate([{ $match: paidFilter }, { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }]),
      this.expenseModel.aggregate([{ $match: allFilter }, { $group: { _id: '$paymentStatus', total: { $sum: '$amount' }, count: { $sum: 1 } } }]),
      this.expenseModel.aggregate([{ $match: { ...paidFilter } }, { $group: { _id: '$category', total: { $sum: '$amount' }, count: { $sum: 1 } } }]),
    ]);

    const byStatus: Record<string, { total: number; count: number }> = {};
    byStatusAgg.forEach((s: any) => { byStatus[s._id] = { total: s.total, count: s.count }; });
    const byCategory: Record<string, { total: number; count: number }> = {};
    byCategoryAgg.forEach((c: any) => { byCategory[c._id] = { total: c.total, count: c.count }; });

    return { totalPaid: paidAgg[0]?.total || 0, paidCount: paidAgg[0]?.count || 0, byStatus, byCategory };
  }
}
