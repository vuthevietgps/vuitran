import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { AdsAnalyticsService } from '../ads/ads-analytics.service';
import { ActionableSuggestion } from '../ads/ads.types';
import { Session, SessionDocument, SessionStatus } from '../sessions/schemas/session.schema';
import { Wallet, WalletDocument } from '../wallets/schemas/wallet.schema';
import { LedgerEntry, LedgerEntryDocument, TransactionType, TransactionStatus } from '../wallets/schemas/ledger-entry.schema';
import { Payroll, PayrollDocument, PayrollStatus } from '../payroll/schemas/payroll.schema';
import { Ticket, TicketDocument, TicketStatus, TicketPriority } from '../tickets/schemas/ticket.schema';
import { TeacherProfile, TeacherStatus } from '../teachers/schemas/teacher-profile.schema';
import { Student, StudentDocument } from '../students/schemas/student.schema';
import { Classroom, ClassDocument, ClassUpdateRequestStatus } from '../classes/schemas/class.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { Invoice, InvoiceDocument, InvoiceStatus } from '../invoices/schemas/invoice.schema';
import { Attendance, AttendanceDocument } from '../attendance/schemas/attendance.schema';
import { Expense, ExpenseDocument, PaymentStatus as ExpensePaymentStatus } from '../expenses/schemas/expense.schema';
import { Order, OrderDocument, OrderStatus } from '../orders/schemas/order.schema';
import { Lead, LeadDocument, LeadStatus } from '../leads/schemas/lead.schema';
import {
  TrialEnrollment,
  TrialEnrollmentDocument,
  TrialEnrollmentStatus,
} from '../trial-enrollments/schemas/trial-enrollment.schema';
import { Role } from '../common/interfaces/role.enum';

// ─── Interface definitions for dashboard responses ──────────────────

export interface DirectorDashboard {
  overview: {
    totalRevenue: number;
    totalTeacherCost: number;
    totalExpenses: number;
    grossProfit: number;
    netProfit: number;
    profitMargin: number;
  };
  sessions: {
    total: number;
    byStatus: Record<string, number>;
    completionRate: number;
  };
  users: {
    totalTeachers: number;
    activeTeachers: number;
    totalParents: number;
    totalStudents: number;
  };
  payroll: {
    totalPaid: number;
    pendingApproval: number;
    byStatus: Record<string, { count: number; totalNet: number }>;
  };
  tickets: {
    total: number;
    openCount: number;
    overdueCount: number;
    avgResolutionHours: number | null;
  };
  wallets: {
    totalBalance: number;
    totalTopUp: number;
    totalDeducted: number;
    totalRefunded: number;
  };
  recentActivity: {
    recentSessions: any[];
    recentTickets: any[];
    recentTopUps: any[];
  };
}

export interface AccountingDashboard {
  financialSummary: Record<string, { totalAmount: number; count: number }>;
  wallets: {
    totalBalance: number;
    totalTopUp: number;
    totalDeducted: number;
    totalRefunded: number;
    walletCount: number;
    frozenCount: number;
  };
  pendingTopUps: any[];
  payroll: {
    byStatus: Record<string, { count: number; totalNet: number; totalGross: number }>;
    totalPaidThisPeriod: number;
  };
  ledgerRecent: any[];
  revenue: {
    totalSessionRevenue: number;
    totalTeacherCost: number;
    grossProfit: number;
  };
}

export interface OpsDashboard {
  classes: {
    total: number;
    active: number;
    byStatus: Record<string, number>;
  };
  sessions: {
    total: number;
    byStatus: Record<string, number>;
    upcomingToday: number;
    needsFinalization: number;
  };
  teachers: {
    total: number;
    active: number;
    pendingApproval: number;
    suspended: number;
  };
  students: {
    total: number;
    pendingApproval: number;
  };
  tickets: {
    total: number;
    byStatus: Record<string, number>;
    byPriority: Record<string, number>;
    overdueCount: number;
    assignedToMe: number;
  };
  recentTickets: any[];
}

export interface TeacherDashboard {
  profile: any;
  sessions: {
    total: number;
    byStatus: Record<string, number>;
    upcomingCount: number;
    completedCount: number;
    cancelledCount: number;
    noShowCount: number;
  };
  earnings: {
    totalEarned: number;
    pendingPayout: number;
    lastPayroll: any;
  };
  classes: {
    activeCount: number;
    list: any[];
  };
  tickets: {
    myTickets: number;
    openTickets: number;
  };
  upcoming: any[];
}

export interface ParentDashboard {
  wallet: {
    balance: number;
    totalTopUp: number;
    totalDeducted: number;
    totalRefunded: number;
    status: string;
  } | null;
  children: {
    total: number;
    list: any[];
  };
  sessions: {
    total: number;
    byStatus: Record<string, number>;
    upcomingCount: number;
    needsConfirmation: number;
  };
  recentSessions: any[];
  recentTransactions: any[];
  invoices: {
    total: number;
    totalPaid: number;
    list: any[];
  };
  attendance: {
    total: number;
    byStatus: Record<string, number>;
    recentList: any[];
  };
  tickets: {
    myTickets: number;
    openTickets: number;
  };
}

export type DailyTaskPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | (string & {});

export interface DailyTaskItem {
  id: string;
  type: string;
  title: string;
  detail?: string;
  meta?: string[];
  count?: number;
  status?: string;
  priority: DailyTaskPriority;
  dueAt?: string;
  route: string;
  queryParams?: Record<string, string>;
  actionLabel?: string;
  overdue?: boolean;
}

export interface DailyTaskTab {
  key: string;
  label: string;
  description: string;
  emptyMessage: string;
  count: number;
  tasks: DailyTaskItem[];
}

export interface DailyTaskBoard {
  role: Role;
  title: string;
  subtitle: string;
  generatedAt: string;
  summary: {
    totalTasks: number;
    overdueTasks: number;
    dueTodayTasks: number;
    highPriorityTasks: number;
  };
  tabs: DailyTaskTab[];
}

type DailyTaskBucket = 'priority' | 'today' | 'followup';

// ─── Service ────────────────────────────────────────────────────────

@Injectable()
export class DashboardService {
  constructor(
    private readonly adsAnalyticsService: AdsAnalyticsService,
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
    @InjectModel(Lead.name) private leadModel: Model<LeadDocument>,
    @InjectModel(TrialEnrollment.name) private trialEnrollmentModel: Model<TrialEnrollmentDocument>,
  ) {}

  // ════════════════════════════════════════════════════════════════════
  // 1. DIRECTOR — Tổng quan toàn hệ thống
  // ════════════════════════════════════════════════════════════════════

  async getDirectorDashboard(fromDate?: string, toDate?: string): Promise<DirectorDashboard> {
    const dateFilter = this.buildDateFilter(fromDate, toDate);
    const expenseDateFilter: any = {};
    if (fromDate || toDate) {
      expenseDateFilter.expenseDate = {};
      if (fromDate) expenseDateFilter.expenseDate.$gte = new Date(fromDate);
      if (toDate) { const end = new Date(toDate); end.setHours(23, 59, 59, 999); expenseDateFilter.expenseDate.$lte = end; }
    }

    const [
      sessionStats,
      userStats,
      payrollStats,
      ticketStats,
      walletStats,
      expenseStats,
      recentSessions,
      recentTickets,
      recentTopUps,
    ] = await Promise.all([
      this.getSessionStats(dateFilter),
      this.getUserStats(),
      this.getPayrollStats(dateFilter),
      this.getTicketStats(),
      this.getWalletAggregates(),
      this.getExpenseAggregates(expenseDateFilter),
      this.sessionModel
        .find(dateFilter.createdAt ? dateFilter : {})
        .sort({ createdAt: -1 })
        .limit(10)
        .populate('teacherId', 'fullName')
        .populate('studentId', 'fullName')
        .lean(),
      this.ticketModel
        .find()
        .sort({ createdAt: -1 })
        .limit(10)
        .populate('createdBy', 'fullName')
        .lean(),
      this.ledgerModel
        .find({ type: TransactionType.TOP_UP, status: TransactionStatus.APPROVED })
        .sort({ createdAt: -1 })
        .limit(10)
        .populate('userId', 'fullName')
        .lean(),
    ]);

    const grossProfit = sessionStats.totalRevenue - sessionStats.totalTeacherCost;
    const netProfit = grossProfit - expenseStats.totalPaid;

    return {
      overview: {
        totalRevenue: sessionStats.totalRevenue,
        totalTeacherCost: sessionStats.totalTeacherCost,
        totalExpenses: expenseStats.totalPaid,
        grossProfit,
        netProfit,
        profitMargin: sessionStats.totalRevenue > 0
          ? Math.round((netProfit / sessionStats.totalRevenue) * 10000) / 100
          : 0,
      },
      sessions: {
        total: sessionStats.total,
        byStatus: sessionStats.byStatus,
        completionRate: sessionStats.total > 0
          ? Math.round(((sessionStats.byStatus['FINALIZED'] || 0) / sessionStats.total) * 10000) / 100
          : 0,
      },
      users: userStats,
      payroll: payrollStats,
      tickets: ticketStats,
      wallets: walletStats,
      recentActivity: {
        recentSessions,
        recentTickets,
        recentTopUps,
      },
    };
  }

  // ════════════════════════════════════════════════════════════════════
  // 2. ACCOUNTING — Tài chính
  // ════════════════════════════════════════════════════════════════════

  async getAccountingDashboard(fromDate?: string, toDate?: string): Promise<AccountingDashboard> {
    const dateFilter = this.buildDateFilter(fromDate, toDate);
    const dateMatch = dateFilter.createdAt ? { createdAt: dateFilter.createdAt } : {};

    const [
      financialSummary,
      walletAgg,
      pendingTopUps,
      payrollAgg,
      ledgerRecent,
      sessionRevenue,
    ] = await Promise.all([
      // Tổng hợp theo TransactionType
      this.ledgerModel.aggregate([
        { $match: { status: TransactionStatus.COMPLETED, ...dateMatch } },
        { $group: { _id: '$type', totalAmount: { $sum: '$amount' }, count: { $sum: 1 } } },
      ]),
      // Wallet aggregates
      this.getWalletAggregates(),
      // Pending top-ups
      this.ledgerModel
        .find({ type: TransactionType.TOP_UP, status: TransactionStatus.PENDING })
        .sort({ createdAt: -1 })
        .populate('userId', 'fullName email')
        .lean(),
      // Payroll by status
      this.payrollModel.aggregate([
        ...(dateMatch.createdAt ? [{ $match: dateMatch }] : []),
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            totalNet: { $sum: '$netAmount' },
            totalGross: { $sum: '$grossAmount' },
          },
        },
      ]),
      // Recent ledger
      this.ledgerModel
        .find(dateMatch)
        .sort({ createdAt: -1 })
        .limit(20)
        .populate('userId', 'fullName')
        .lean(),
      // Session revenue
      this.sessionModel.aggregate([
        { $match: { status: 'FINALIZED', ...dateMatch } },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: '$amountCharged' },
            totalTeacherCost: { $sum: '$teacherPayout' },
          },
        },
      ]),
    ]);

    // Convert financial summary array to map
    const summaryMap: Record<string, { totalAmount: number; count: number }> = {};
    financialSummary.forEach((item: any) => {
      summaryMap[item._id] = { totalAmount: item.totalAmount, count: item.count };
    });

    // Convert payroll agg to map
    const payrollMap: Record<string, { count: number; totalNet: number; totalGross: number }> = {};
    let totalPaidThisPeriod = 0;
    payrollAgg.forEach((item: any) => {
      payrollMap[item._id] = { count: item.count, totalNet: item.totalNet, totalGross: item.totalGross };
      if (item._id === PayrollStatus.PAID) totalPaidThisPeriod = item.totalNet;
    });

    const rev = sessionRevenue[0] || { totalRevenue: 0, totalTeacherCost: 0 };

    // Frozen wallets count
    const frozenCount = await this.walletModel.countDocuments({ status: 'FROZEN' });

    return {
      financialSummary: summaryMap,
      wallets: {
        ...walletAgg,
        walletCount: await this.walletModel.countDocuments(),
        frozenCount,
      },
      pendingTopUps,
      payroll: {
        byStatus: payrollMap,
        totalPaidThisPeriod,
      },
      ledgerRecent,
      revenue: {
        totalSessionRevenue: rev.totalRevenue,
        totalTeacherCost: rev.totalTeacherCost,
        grossProfit: rev.totalRevenue - rev.totalTeacherCost,
      },
    };
  }

  // ════════════════════════════════════════════════════════════════════
  // 3. OPS — Vận hành
  // ════════════════════════════════════════════════════════════════════

  async getOpsDashboard(opsUserId: string): Promise<OpsDashboard> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [
      classCounts,
      sessionCounts,
      teacherCounts,
      studentCounts,
      ticketCounts,
      upcomingToday,
      needsFinalization,
      assignedToMe,
      recentTickets,
    ] = await Promise.all([
      // Class by status
      this.classModel.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      // Session by status
      this.sessionModel.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      // Teacher counts
      this.teacherModel.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      // Student stats
      Promise.all([
        this.studentModel.countDocuments(),
        this.studentModel.countDocuments({ status: 'PENDING' }),
      ]),
      // Ticket by status & priority
      Promise.all([
        this.ticketModel.aggregate([
          { $group: { _id: '$status', count: { $sum: 1 } } },
        ]),
        this.ticketModel.aggregate([
          { $group: { _id: '$priority', count: { $sum: 1 } } },
        ]),
        this.ticketModel.countDocuments({
          status: { $nin: [TicketStatus.RESOLVED, TicketStatus.CLOSED, TicketStatus.CANCELLED] },
          dueDate: { $lt: new Date() },
        }),
      ]),
      // Sessions happening today
      this.sessionModel.countDocuments({
        scheduledDate: { $gte: today, $lt: tomorrow },
        status: 'SCHEDULED',
      }),
      // Need finalization (teacher completed but parent hasn't confirmed)
      this.sessionModel.countDocuments({ status: 'TEACHER_COMPLETED' }),
      // Tickets assigned to this OPS user
      opsUserId && Types.ObjectId.isValid(opsUserId)
        ? this.ticketModel.countDocuments({ assignedTo: opsUserId })
        : Promise.resolve(0),
      // Recent tickets
      this.ticketModel
        .find()
        .sort({ createdAt: -1 })
        .limit(15)
        .populate('createdBy', 'fullName')
        .populate('assignedTo', 'fullName')
        .lean(),
    ]);

    // Map aggregations
    const classByStatus: Record<string, number> = {};
    let totalClasses = 0, activeClasses = 0;
    classCounts.forEach((c: any) => {
      classByStatus[c._id] = c.count;
      totalClasses += c.count;
      if (c._id === 'ACTIVE') activeClasses = c.count;
    });

    const sessionByStatus: Record<string, number> = {};
    let totalSessions = 0;
    sessionCounts.forEach((s: any) => {
      sessionByStatus[s._id] = s.count;
      totalSessions += s.count;
    });

    const teacherByStatus: Record<string, number> = {};
    let totalTeachers = 0, activeT = 0, pendingT = 0, suspendedT = 0;
    teacherCounts.forEach((t: any) => {
      teacherByStatus[t._id] = t.count;
      totalTeachers += t.count;
      if (t._id === 'ACTIVE') activeT = t.count;
      if (t._id === 'PENDING') pendingT = t.count;
      if (t._id === 'SUSPENDED') suspendedT = t.count;
    });

    const ticketByStatus: Record<string, number> = {};
    let totalTickets = 0;
    ticketCounts[0].forEach((t: any) => {
      ticketByStatus[t._id] = t.count;
      totalTickets += t.count;
    });
    const ticketByPriority: Record<string, number> = {};
    ticketCounts[1].forEach((t: any) => {
      ticketByPriority[t._id] = t.count;
    });

    return {
      classes: {
        total: totalClasses,
        active: activeClasses,
        byStatus: classByStatus,
      },
      sessions: {
        total: totalSessions,
        byStatus: sessionByStatus,
        upcomingToday,
        needsFinalization,
      },
      teachers: {
        total: totalTeachers,
        active: activeT,
        pendingApproval: pendingT,
        suspended: suspendedT,
      },
      students: {
        total: studentCounts[0],
        pendingApproval: studentCounts[1],
      },
      tickets: {
        total: totalTickets,
        byStatus: ticketByStatus,
        byPriority: ticketByPriority,
        overdueCount: ticketCounts[2],
        assignedToMe: assignedToMe,
      },
      recentTickets,
    };
  }

  // ════════════════════════════════════════════════════════════════════
  // 4. TEACHER — Giáo viên
  // ════════════════════════════════════════════════════════════════════

  async getTeacherDashboard(teacherUserId: string): Promise<TeacherDashboard> {
    const now = new Date();
    const teacherObjId = new Types.ObjectId(teacherUserId);

    const [
      profile,
      sessionAgg,
      upcomingSessions,
      payrollData,
      activeClasses,
      ticketData,
    ] = await Promise.all([
      // Teacher profile
      this.teacherModel.findOne({ userId: teacherUserId }).lean(),
      // Sessions aggregated
      this.sessionModel.aggregate([
        { $match: { teacherId: teacherObjId } },
        { $group: { _id: '$status', count: { $sum: 1 }, totalPayout: { $sum: '$teacherPayout' } } },
      ]),
      // Upcoming sessions
      this.sessionModel
        .find({ teacherId: teacherObjId, status: 'SCHEDULED', scheduledDate: { $gte: now } })
        .sort({ scheduledDate: 1 })
        .limit(10)
        .populate('studentId', 'fullName')
        .populate('classId', 'name')
        .lean(),
      // Latest payroll
      this.payrollModel
        .find({ teacherId: teacherObjId })
        .sort({ createdAt: -1 })
        .limit(1)
        .lean(),
      // Active classes
      this.classModel
        .find({
          status: 'ACTIVE',
          $or: [
            { teacher: teacherObjId },
            {
              substituteTeachers: {
                $elemMatch: {
                  teacherId: teacherObjId,
                  fromDate: { $lte: now },
                  toDate: { $gte: now },
                },
              },
            },
          ],
        })
        .select('name subject grade students schedule')
        .lean(),
      // Tickets created by or related to this teacher
      Promise.all([
        this.ticketModel.countDocuments({ createdBy: teacherObjId }),
        this.ticketModel.countDocuments({
          createdBy: teacherObjId,
          status: { $in: [TicketStatus.OPEN, TicketStatus.IN_PROGRESS, TicketStatus.WAITING_INFO] },
        }),
      ]),
    ]);

    // Map session stats
    const byStatus: Record<string, number> = {};
    let totalSessions = 0, totalEarned = 0;
    let completedCount = 0, cancelledCount = 0, noShowCount = 0;
    sessionAgg.forEach((s: any) => {
      byStatus[s._id] = s.count;
      totalSessions += s.count;
      if (s._id === 'FINALIZED') {
        totalEarned += s.totalPayout;
        completedCount = s.count;
      }
      if (s._id === 'CANCELLED') cancelledCount = s.count;
      if (s._id === 'NO_SHOW') noShowCount = s.count;
    });

    // Pending payout = FINALIZED sessions not yet paid
    const pendingPayout = await this.sessionModel.aggregate([
      { $match: { teacherId: teacherObjId, status: 'FINALIZED', isTeacherPaid: false } },
      { $group: { _id: null, total: { $sum: '$teacherPayout' } } },
    ]);

    return {
      profile,
      sessions: {
        total: totalSessions,
        byStatus,
        upcomingCount: upcomingSessions.length,
        completedCount,
        cancelledCount,
        noShowCount,
      },
      earnings: {
        totalEarned,
        pendingPayout: pendingPayout[0]?.total || 0,
        lastPayroll: payrollData[0] || null,
      },
      classes: {
        activeCount: activeClasses.length,
        list: activeClasses,
      },
      tickets: {
        myTickets: ticketData[0],
        openTickets: ticketData[1],
      },
      upcoming: upcomingSessions,
    };
  }

  // ════════════════════════════════════════════════════════════════════
  // 5. PARENT — Phụ huynh
  // ════════════════════════════════════════════════════════════════════

  async getParentDashboard(parentUserId: string): Promise<ParentDashboard> {
    const now = new Date();
    const parentObjId = new Types.ObjectId(parentUserId);

    // Find children of this parent
    const children = await this.studentModel
      .find({ parentUserId: parentObjId })
      .select('fullName grade subjects')
      .lean();
    const childIds = children.map((c) => c._id);

    const [
      wallet,
      sessionAgg,
      upcomingSessions,
      needsConfirm,
      recentTransactions,
      ticketData,
      invoicesList,
      invoiceTotalsAgg,
      attendanceAgg,
      recentAttendance,
    ] = await Promise.all([
      this.walletModel.findOne({ userId: parentObjId }).lean(),
      // Session stats for this parent's children
      this.sessionModel.aggregate([
        { $match: { studentId: { $in: childIds } } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      // Upcoming sessions
      this.sessionModel
        .find({ studentId: { $in: childIds }, status: 'SCHEDULED', scheduledDate: { $gte: now } })
        .sort({ scheduledDate: 1 })
        .limit(10)
        .populate('teacherId', 'fullName')
        .populate('studentId', 'fullName')
        .populate('classId', 'name')
        .lean(),
      // Sessions needing parent confirmation
      this.sessionModel.countDocuments({
        studentId: { $in: childIds },
        status: 'TEACHER_COMPLETED',
      }),
      // Recent wallet transactions
      this.ledgerModel
        .find({ userId: parentObjId })
        .sort({ createdAt: -1 })
        .limit(15)
        .lean(),
      // Tickets
      Promise.all([
        this.ticketModel.countDocuments({ createdBy: parentObjId }),
        this.ticketModel.countDocuments({
          createdBy: parentObjId,
          status: { $in: [TicketStatus.OPEN, TicketStatus.IN_PROGRESS, TicketStatus.WAITING_INFO] },
        }),
      ]),
      // Invoices for parent's children
      this.invoiceModel
        .find({ studentId: { $in: childIds } })
        .sort({ paymentDate: -1 })
        .limit(20)
        .populate('studentId', 'fullName studentCode')
        .populate('classId', 'name code')
        .lean(),
      this.invoiceModel.aggregate([
        { $match: { studentId: { $in: childIds } } },
        {
          $group: {
            _id: null,
            totalCount: { $sum: 1 },
            totalPaid: {
              $sum: {
                $cond: [
                  { $in: ['$status', ['APPROVED', 'PAID']] },
                  '$amount',
                  0,
                ],
              },
            },
          },
        },
      ]),
      // Attendance aggregation by status
      this.attendanceModel.aggregate([
        { $match: { studentId: { $in: childIds } } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      // Recent attendance records
      this.attendanceModel
        .find({ studentId: { $in: childIds } })
        .sort({ date: -1 })
        .limit(20)
        .populate('studentId', 'fullName studentCode')
        .populate('classId', 'name code')
        .populate('teacherId', 'fullName')
        .lean(),
    ]);

    const byStatus: Record<string, number> = {};
    let totalSessions = 0;
    sessionAgg.forEach((s: any) => {
      byStatus[s._id] = s.count;
      totalSessions += s.count;
    });

    // Invoice stats (count/paid must include all invoices, not only recent list)
    const invoiceSummary = (invoiceTotalsAgg as any[])[0] || { totalCount: 0, totalPaid: 0 };
    const invoiceTotalPaid = invoiceSummary.totalPaid || 0;
    const invoiceTotalCount = invoiceSummary.totalCount || 0;

    // Attendance stats
    const attendByStatus: Record<string, number> = {};
    let totalAttendance = 0;
    (attendanceAgg as any[]).forEach((a: any) => {
      attendByStatus[a._id] = a.count;
      totalAttendance += a.count;
    });

    return {
      wallet: wallet
        ? {
            balance: wallet.balance,
            totalTopUp: wallet.totalTopUp,
            totalDeducted: wallet.totalDeducted,
            totalRefunded: wallet.totalRefunded,
            status: wallet.status,
          }
        : null,
      children: {
        total: children.length,
        list: children,
      },
      sessions: {
        total: totalSessions,
        byStatus,
        upcomingCount: byStatus['SCHEDULED'] || 0,
        needsConfirmation: needsConfirm,
      },
      recentSessions: upcomingSessions,
      recentTransactions,
      invoices: {
        total: invoiceTotalCount,
        totalPaid: invoiceTotalPaid,
        list: invoicesList,
      },
      attendance: {
        total: totalAttendance,
        byStatus: attendByStatus,
        recentList: recentAttendance,
      },
      tickets: {
        myTickets: ticketData[0],
        openTickets: ticketData[1],
      },
    };
  }

  // ════════════════════════════════════════════════════════════════════
  // Private Helpers
  // ════════════════════════════════════════════════════════════════════

  async getDailyTasks(role: Role, userId: string): Promise<DailyTaskBoard> {
    switch (role) {
      case Role.DIRECTOR:
        return this.getDirectorDailyTasks();
      case Role.ACCOUNTING:
        return this.getAccountingDailyTasks();
      case Role.OPS:
        return this.getOpsDailyTasks(userId);
      case Role.TEACHER:
        return this.getTeacherDailyTasks(userId);
      case Role.PARENT:
        return this.getParentDailyTasks(userId);
      case Role.SALE:
        return this.getSaleDailyTasks(userId);
      case Role.ADSMANAGER:
        return this.getAdsDailyTasks();
      default:
        return this.buildDailyTaskBoard(role, []);
    }
  }

  private async getDirectorDailyTasks(): Promise<DailyTaskBoard> {
    const now = new Date();
    const today = this.startOfDay(now);
    const tomorrow = this.addDays(today, 1);

    const [
      pendingPayrolls,
      pendingInvoices,
      pendingTopUps,
      pendingTeachers,
      pendingClassUpdates,
      sessionsWaitingFinalization,
      overdueTickets,
      leadFollowUps,
      submittedOrders,
      trialDecisions,
    ] = await Promise.all([
      this.payrollModel
        .find({ status: PayrollStatus.PENDING_REVIEW })
        .sort({ createdAt: 1 })
        .limit(10)
        .populate('teacherId', 'fullName email')
        .lean(),
      this.invoiceModel
        .find({ status: InvoiceStatus.PENDING_APPROVAL })
        .sort({ createdAt: 1 })
        .limit(10)
        .populate('studentId', 'fullName studentCode')
        .populate('createdBy', 'fullName email')
        .lean(),
      this.ledgerModel
        .find({ type: TransactionType.TOP_UP, status: TransactionStatus.PENDING })
        .sort({ createdAt: 1 })
        .limit(10)
        .populate('userId', 'fullName email')
        .lean(),
      this.teacherModel
        .find({ status: TeacherStatus.PENDING })
        .sort({ createdAt: 1 })
        .limit(10)
        .populate('userId', 'fullName email phone')
        .lean(),
      this.classModel
        .find({ 'pendingSaleUpdate.status': ClassUpdateRequestStatus.PENDING })
        .sort({ 'pendingSaleUpdate.requestedAt': 1 })
        .limit(10)
        .populate('sale', 'fullName email')
        .populate('pendingSaleUpdate.requestedBy', 'fullName email')
        .lean(),
      this.sessionModel
        .find({ status: SessionStatus.TEACHER_COMPLETED })
        .sort({ scheduledDate: 1 })
        .limit(10)
        .populate('teacherId', 'fullName')
        .populate('studentId', 'fullName studentCode')
        .populate('classId', 'name code')
        .lean(),
      this.ticketModel
        .find({
          status: { $in: this.getOpenTicketStatuses() },
          dueDate: { $lt: now },
        })
        .sort({ dueDate: 1 })
        .limit(10)
        .populate('createdBy', 'fullName')
        .populate('assignedTo', 'fullName')
        .lean(),
      this.leadModel
        .find({
          nextFollowUp: { $lte: tomorrow },
          status: { $in: this.getActiveLeadStatuses() },
        })
        .sort({ nextFollowUp: 1 })
        .limit(10)
        .lean(),
      this.orderModel
        .find({ status: OrderStatus.SUBMITTED })
        .sort({ createdAt: 1 })
        .limit(10)
        .lean(),
      this.trialEnrollmentModel
        .find({
          status: {
            $in: [TrialEnrollmentStatus.PENDING_TRIAL, TrialEnrollmentStatus.WAITING_DECISION],
          },
        })
        .sort({ updatedAt: 1, createdAt: 1 })
        .limit(10)
        .populate('classId', 'name code')
        .populate('saleId', 'fullName')
        .populate('studentId', 'fullName studentCode')
        .lean(),
    ]);

    const approvalTasks: DailyTaskItem[] = [
      ...pendingPayrolls.map((payroll: any) => ({
        id: `director-payroll-${String(payroll._id)}`,
        type: 'PENDING_PAYROLL',
        title: `Duyet bang luong ${payroll.payrollCode}`,
        detail: payroll.teacherId?.fullName || 'Bang luong cho duyet',
        meta: this.compactMeta([
          payroll.teacherId?.email,
          payroll.periodStart && payroll.periodEnd
            ? `${this.toShortDate(payroll.periodStart)} - ${this.toShortDate(payroll.periodEnd)}`
            : undefined,
        ]),
        status: payroll.status,
        priority: 'HIGH',
        dueAt: this.toIso(payroll.createdAt),
        route: '/app/pending-approvals',
        queryParams: { tab: 'payroll' },
        actionLabel: 'Mo cho duyet',
      })),
      ...pendingInvoices.map((invoice: any) => ({
        id: `director-invoice-${String(invoice._id)}`,
        type: 'PENDING_INVOICE',
        title: `Duyet hoa don ${invoice.invoiceNumber}`,
        detail: this.studentName(invoice.studentId) || 'Hoa don dang cho duyet',
        meta: this.compactMeta([invoice.createdBy?.fullName]),
        status: invoice.status,
        priority: 'HIGH',
        dueAt: this.toIso(invoice.createdAt),
        route: '/app/pending-approvals',
        queryParams: { tab: 'invoices' },
        actionLabel: 'Mo cho duyet',
      })),
      ...pendingTopUps.map((entry: any) => ({
        id: `director-topup-${String(entry._id)}`,
        type: 'PENDING_TOP_UP',
        title: `Duyet nap vi ${this.formatCurrency(entry.amount)}`,
        detail: this.personName(entry.userId) || 'Yeu cau nap vi',
        meta: this.compactMeta([entry.userId?.email]),
        status: entry.status,
        priority: 'HIGH',
        dueAt: this.toIso(entry.createdAt),
        route: '/app/pending-approvals',
        queryParams: { tab: 'topups' },
        actionLabel: 'Mo cho duyet',
      })),
      ...pendingTeachers.map((teacher: any) => ({
        id: `director-teacher-${String(teacher._id)}`,
        type: 'PENDING_TEACHER',
        title: `Duyet giao vien ${teacher.userId?.fullName || 'moi'}`,
        detail: teacher.userId?.email || 'Ho so giao vien cho duyet',
        meta: this.compactMeta([teacher.userId?.phone]),
        status: teacher.status,
        priority: 'MEDIUM',
        dueAt: this.toIso(teacher.createdAt),
        route: '/app/pending-approvals',
        queryParams: { tab: 'teachers' },
        actionLabel: 'Mo cho duyet',
      })),
      ...pendingClassUpdates.map((classItem: any) => ({
        id: `director-class-update-${String(classItem._id)}`,
        type: 'PENDING_CLASS_UPDATE',
        title: `Duyet cap nhat lop ${classItem.code || classItem.name || ''}`.trim(),
        detail: classItem.name || 'Yeu cau sua lop hoc',
        meta: this.compactMeta([
          classItem.pendingSaleUpdate?.requestedBy?.fullName,
          classItem.pendingSaleUpdate?.requestType,
        ]),
        status: classItem.pendingSaleUpdate?.status,
        priority: classItem.pendingSaleUpdate?.requestType === 'DURATION_CHANGE' ? 'HIGH' : 'MEDIUM',
        dueAt: this.toIso(classItem.pendingSaleUpdate?.requestedAt),
        route: '/app/pending-approvals',
        queryParams: { tab: 'classes' },
        actionLabel: 'Mo cho duyet',
      })),
    ];

    const operationsTasks: DailyTaskItem[] = [
      ...sessionsWaitingFinalization.map((session: any) => ({
        id: `director-session-finalize-${String(session._id)}`,
        type: 'SESSION_WAITING_FINALIZATION',
        title: `Chot buoi hoc ${this.studentName(session.studentId) || ''}`.trim(),
        detail: this.className(session.classId) || 'Buoi hoc cho xu ly',
        meta: this.compactMeta([this.personName(session.teacherId)]),
        status: session.status,
        priority: this.isOverdue(session.scheduledDate, today) ? 'HIGH' : 'MEDIUM',
        dueAt: this.toIso(session.scheduledDate),
        route: '/app/sessions',
        actionLabel: 'Mo buoi hoc',
        overdue: this.isOverdue(session.scheduledDate, today),
      })),
      ...overdueTickets.map((ticket: any) => ({
        id: `director-ticket-${String(ticket._id)}`,
        type: 'OVERDUE_TICKET',
        title: `Xu ly ticket ${ticket.ticketCode || ''}`.trim(),
        detail: ticket.subject || 'Ticket qua han',
        meta: this.compactMeta([
          this.personName(ticket.createdBy),
          this.personName(ticket.assignedTo),
        ]),
        status: ticket.status,
        priority: this.mapTicketPriority(ticket.priority),
        dueAt: this.toIso(ticket.dueDate),
        route: '/app/tickets',
        actionLabel: 'Mo ticket',
        overdue: true,
      })),
    ];

    const salesTasks: DailyTaskItem[] = [
      ...leadFollowUps.map((lead: any) => ({
        id: `director-lead-${String(lead._id)}`,
        type: 'LEAD_FOLLOW_UP',
        title: `Follow-up lead ${lead.leadCode || ''}`.trim(),
        detail: lead.parentName || 'Lead can lien he',
        meta: this.compactMeta([lead.parentPhone, lead.status]),
        status: lead.status,
        priority: this.isOverdue(lead.nextFollowUp, today) ? 'HIGH' : 'MEDIUM',
        dueAt: this.toIso(lead.nextFollowUp),
        route: '/app/leads',
        actionLabel: 'Mo lead',
        overdue: this.isOverdue(lead.nextFollowUp, today),
      })),
      ...submittedOrders.map((order: any) => ({
        id: `director-order-${String(order._id)}`,
        type: 'ORDER_SUBMITTED',
        title: `Ra soat don ${order.orderCode}`,
        detail: this.compactMeta([order.parentName, order.studentName]).join(' · ') || 'Don dang cho xu ly',
        meta: this.compactMeta([this.formatCurrency(order.finalAmount)]),
        status: order.status,
        priority: 'HIGH',
        dueAt: this.toIso(order.createdAt),
        route: '/app/orders',
        actionLabel: 'Mo don hang',
      })),
      ...trialDecisions.map((trial: any) => ({
        id: `director-trial-${String(trial._id)}`,
        type: 'TRIAL_ENROLLMENT',
        title:
          trial.status === TrialEnrollmentStatus.WAITING_DECISION
            ? `Chot hoc thu ${trial.trialCode || ''}`.trim()
            : `Theo doi hoc thu ${trial.trialCode || ''}`.trim(),
        detail: trial.studentName || this.studentName(trial.studentId) || 'Hoc thu offline',
        meta: this.compactMeta([
          this.className(trial.classId),
          this.personName(trial.saleId),
          `${trial.trialSessionsUsed || 0}/${trial.maxTrialSessions || 2} buoi`,
        ]),
        status: trial.status,
        priority:
          trial.status === TrialEnrollmentStatus.WAITING_DECISION
            ? 'HIGH'
            : (trial.trialSessionsUsed || 0) > 0
              ? 'MEDIUM'
              : 'LOW',
        dueAt: this.toIso(trial.updatedAt || trial.createdAt),
        route: '/app/trial-enrollments',
        actionLabel: 'Mo hoc thu',
        overdue:
          trial.status === TrialEnrollmentStatus.WAITING_DECISION &&
          this.isOverdue(trial.updatedAt || trial.createdAt, today),
      })),
    ];

    return this.buildDailyTaskBoard(Role.DIRECTOR, [
      {
        key: 'approvals',
        label: 'Cho duyet',
        description: 'Cac muc can phe duyet va phan hoi som trong ngay.',
        emptyMessage: 'Khong co hang muc cho duyet.',
        count: 0,
        tasks: approvalTasks,
      },
      {
        key: 'operations',
        label: 'Van hanh',
        description: 'Buoi hoc va ticket dang can xu ly ngay.',
        emptyMessage: 'Khong co viec van hanh cap bach.',
        count: 0,
        tasks: operationsTasks,
      },
      {
        key: 'sales',
        label: 'Kinh doanh',
        description: 'Lead den han va don dang cho ra quyet dinh.',
        emptyMessage: 'Khong co lead hay don can theo doi ngay.',
        count: 0,
        tasks: salesTasks,
      },
    ]);
  }

  private async getAccountingDailyTasks(): Promise<DailyTaskBoard> {
    const [pendingTopUps, pendingInvoices, approvedPayrolls, pendingPayrolls] = await Promise.all([
      this.ledgerModel
        .find({ type: TransactionType.TOP_UP, status: TransactionStatus.PENDING })
        .sort({ createdAt: 1 })
        .limit(10)
        .populate('userId', 'fullName email')
        .lean(),
      this.invoiceModel
        .find({ status: InvoiceStatus.PENDING_APPROVAL })
        .sort({ createdAt: 1 })
        .limit(10)
        .populate('studentId', 'fullName studentCode')
        .populate('createdBy', 'fullName email')
        .lean(),
      this.payrollModel
        .find({ status: PayrollStatus.APPROVED })
        .sort({ updatedAt: 1, createdAt: 1 })
        .limit(10)
        .populate('teacherId', 'fullName email')
        .lean(),
      this.payrollModel
        .find({ status: PayrollStatus.PENDING_REVIEW })
        .sort({ createdAt: 1 })
        .limit(10)
        .populate('teacherId', 'fullName email')
        .lean(),
    ]);

    const incomingTasks: DailyTaskItem[] = [
      ...pendingTopUps.map((entry: any) => ({
        id: `accounting-topup-${String(entry._id)}`,
        type: 'PENDING_TOP_UP',
        title: `Xac nhan nap vi ${this.formatCurrency(entry.amount)}`,
        detail: this.personName(entry.userId) || 'Yeu cau nap vi',
        meta: this.compactMeta([entry.userId?.email, entry.paymentMethod]),
        status: entry.status,
        priority: 'HIGH',
        dueAt: this.toIso(entry.createdAt),
        route: '/app/wallets',
        actionLabel: 'Mo vi',
      })),
      ...pendingInvoices.map((invoice: any) => ({
        id: `accounting-invoice-${String(invoice._id)}`,
        type: 'PENDING_INVOICE',
        title: `Ra soat hoa don ${invoice.invoiceNumber}`,
        detail: this.studentName(invoice.studentId) || 'Hoa don cho xu ly',
        meta: this.compactMeta([invoice.createdBy?.fullName]),
        status: invoice.status,
        priority: 'HIGH',
        dueAt: this.toIso(invoice.createdAt),
        route: '/app/invoices',
        actionLabel: 'Mo hoa don',
      })),
    ];

    const payrollTasks: DailyTaskItem[] = [
      ...approvedPayrolls.map((payroll: any) => ({
        id: `accounting-approved-payroll-${String(payroll._id)}`,
        type: 'APPROVED_PAYROLL',
        title: `Chi luong ${payroll.payrollCode}`,
        detail: payroll.teacherId?.fullName || 'Bang luong da duyet',
        meta: this.compactMeta([
          this.formatCurrency(payroll.netAmount),
          payroll.periodStart && payroll.periodEnd
            ? `${this.toShortDate(payroll.periodStart)} - ${this.toShortDate(payroll.periodEnd)}`
            : undefined,
        ]),
        status: payroll.status,
        priority: 'HIGH',
        dueAt: this.toIso(payroll.updatedAt || payroll.createdAt),
        route: '/app/payroll',
        actionLabel: 'Mo payroll',
      })),
      ...pendingPayrolls.map((payroll: any) => ({
        id: `accounting-pending-payroll-${String(payroll._id)}`,
        type: 'PAYROLL_WAITING_APPROVAL',
        title: `Theo doi bang luong ${payroll.payrollCode}`,
        detail: 'Dang cho director duyet truoc khi chi tra',
        meta: this.compactMeta([payroll.teacherId?.fullName]),
        status: payroll.status,
        priority: 'MEDIUM',
        dueAt: this.toIso(payroll.createdAt),
        route: '/app/payroll',
        actionLabel: 'Mo payroll',
      })),
    ];

    return this.buildDailyTaskBoard(Role.ACCOUNTING, [
      {
        key: 'incoming',
        label: 'Thu vao',
        description: 'Top-up va hoa don moi can duoc xu ly.',
        emptyMessage: 'Khong co top-up hay hoa don dang cho xu ly.',
        count: 0,
        tasks: incomingTasks,
      },
      {
        key: 'payroll',
        label: 'Luong',
        description: 'Bang luong da duyet de chi tra va bang luong dang theo doi.',
        emptyMessage: 'Khong co bang luong can xu ly ngay.',
        count: 0,
        tasks: payrollTasks,
      },
    ]);
  }

  private async getOpsDailyTasks(opsUserId: string): Promise<DailyTaskBoard> {
    const now = new Date();
    const today = this.startOfDay(now);
    const tomorrow = this.addDays(today, 1);

    const [
      sessionsToday,
      sessionsWaitingFinalization,
      overdueTickets,
      pendingTeachers,
      pendingClassUpdates,
      pendingStudents,
      trialQueue,
    ] = await Promise.all([
      this.sessionModel
        .find({
          status: SessionStatus.SCHEDULED,
          scheduledDate: { $gte: today, $lt: tomorrow },
        })
        .sort({ scheduledDate: 1 })
        .limit(10)
        .populate('teacherId', 'fullName')
        .populate('studentId', 'fullName studentCode')
        .populate('classId', 'name code')
        .lean(),
      this.sessionModel
        .find({ status: SessionStatus.TEACHER_COMPLETED })
        .sort({ scheduledDate: 1 })
        .limit(10)
        .populate('teacherId', 'fullName')
        .populate('studentId', 'fullName studentCode')
        .populate('classId', 'name code')
        .lean(),
      this.ticketModel
        .find({
          status: { $in: this.getOpenTicketStatuses() },
          dueDate: { $lt: now },
          ...(Types.ObjectId.isValid(opsUserId) ? { assignedTo: new Types.ObjectId(opsUserId) } : {}),
        })
        .sort({ dueDate: 1 })
        .limit(10)
        .populate('createdBy', 'fullName')
        .populate('assignedTo', 'fullName')
        .lean(),
      this.teacherModel
        .find({ status: TeacherStatus.PENDING })
        .sort({ createdAt: 1 })
        .limit(10)
        .populate('userId', 'fullName email phone')
        .lean(),
      this.classModel
        .find({
          'pendingSaleUpdate.status': ClassUpdateRequestStatus.PENDING,
          'pendingSaleUpdate.requestType': { $ne: 'DURATION_CHANGE' },
        })
        .sort({ 'pendingSaleUpdate.requestedAt': 1 })
        .limit(10)
        .populate('sale', 'fullName email')
        .populate('pendingSaleUpdate.requestedBy', 'fullName email')
        .lean(),
      this.studentModel
        .find({ status: 'PENDING' })
        .sort({ createdAt: 1 })
        .limit(10)
        .select('fullName name studentCode parentName createdAt status')
        .lean(),
      this.trialEnrollmentModel
        .find({
          status: {
            $in: [TrialEnrollmentStatus.PENDING_TRIAL, TrialEnrollmentStatus.WAITING_DECISION],
          },
        })
        .sort({ updatedAt: 1, createdAt: 1 })
        .limit(12)
        .populate('classId', 'name code')
        .populate('saleId', 'fullName')
        .populate('studentId', 'fullName studentCode')
        .lean(),
    ]);

    const sessionTasks: DailyTaskItem[] = [
      ...sessionsToday.map((session: any) => ({
        id: `ops-session-today-${String(session._id)}`,
        type: 'SESSION_TODAY',
        title: `Dieu phoi buoi ${this.studentName(session.studentId) || ''}`.trim(),
        detail: this.className(session.classId) || 'Buoi hoc hom nay',
        meta: this.compactMeta([this.personName(session.teacherId)]),
        status: session.status,
        priority: 'MEDIUM',
        dueAt: this.toIso(session.scheduledDate),
        route: '/app/sessions',
        actionLabel: 'Mo buoi hoc',
      })),
      ...sessionsWaitingFinalization.map((session: any) => ({
        id: `ops-session-finalize-${String(session._id)}`,
        type: 'SESSION_WAITING_FINALIZATION',
        title: `Chot buoi ${this.studentName(session.studentId) || ''}`.trim(),
        detail: this.className(session.classId) || 'Buoi hoc can chot',
        meta: this.compactMeta([this.personName(session.teacherId)]),
        status: session.status,
        priority: this.isOverdue(session.scheduledDate, today) ? 'HIGH' : 'MEDIUM',
        dueAt: this.toIso(session.scheduledDate),
        route: '/app/sessions',
        actionLabel: 'Mo buoi hoc',
        overdue: this.isOverdue(session.scheduledDate, today),
      })),
    ];

    const supportTasks: DailyTaskItem[] = overdueTickets.map((ticket: any) => ({
      id: `ops-ticket-${String(ticket._id)}`,
      type: 'OVERDUE_TICKET',
      title: `Xu ly ticket ${ticket.ticketCode || ''}`.trim(),
      detail: ticket.subject || 'Ticket qua han',
      meta: this.compactMeta([this.personName(ticket.createdBy), this.personName(ticket.assignedTo)]),
      status: ticket.status,
      priority: this.mapTicketPriority(ticket.priority),
      dueAt: this.toIso(ticket.dueDate),
      route: '/app/tickets',
      actionLabel: 'Mo ticket',
      overdue: true,
    }));

    const resourceTasks: DailyTaskItem[] = [
      ...pendingTeachers.map((teacher: any) => ({
        id: `ops-teacher-${String(teacher._id)}`,
        type: 'PENDING_TEACHER',
        title: `Ra soat giao vien ${teacher.userId?.fullName || 'moi'}`,
        detail: teacher.userId?.email || 'Ho so giao vien can tiep nhan',
        meta: this.compactMeta([teacher.userId?.phone]),
        status: teacher.status,
        priority: 'MEDIUM',
        dueAt: this.toIso(teacher.createdAt),
        route: '/app/pending-approvals',
        queryParams: { tab: 'teachers' },
        actionLabel: 'Mo cho duyet',
      })),
      ...pendingClassUpdates.map((classItem: any) => ({
        id: `ops-class-update-${String(classItem._id)}`,
        type: 'PENDING_CLASS_UPDATE',
        title: `Cap nhat lop ${classItem.code || classItem.name || ''}`.trim(),
        detail: classItem.name || 'Yeu cau sua lop',
        meta: this.compactMeta([classItem.pendingSaleUpdate?.requestedBy?.fullName]),
        status: classItem.pendingSaleUpdate?.status,
        priority: 'MEDIUM',
        dueAt: this.toIso(classItem.pendingSaleUpdate?.requestedAt),
        route: '/app/pending-approvals',
        queryParams: { tab: 'classes' },
        actionLabel: 'Mo cho duyet',
      })),
      ...pendingStudents.map((student: any) => ({
        id: `ops-student-${String(student._id)}`,
        type: 'PENDING_STUDENT',
        title: `Ra soat hoc sinh ${student.fullName || student.name || ''}`.trim(),
        detail: student.studentCode || 'Hoc sinh cho xu ly',
        meta: this.compactMeta([student.parentName]),
        status: student.status,
        priority: 'LOW',
        dueAt: this.toIso(student.createdAt),
        route: '/app/students',
        actionLabel: 'Mo hoc sinh',
      })),
    ];

    const trialTasks: DailyTaskItem[] = trialQueue.map((trial: any) => ({
      id: `ops-trial-${String(trial._id)}`,
      type: 'TRIAL_ENROLLMENT',
      title:
        trial.status === TrialEnrollmentStatus.WAITING_DECISION
          ? `Chot hoc thu ${trial.trialCode || ''}`.trim()
          : `Theo doi hoc thu ${trial.trialCode || ''}`.trim(),
      detail: trial.studentName || this.studentName(trial.studentId) || 'Hoc thu offline',
      meta: this.compactMeta([
        this.className(trial.classId),
        this.personName(trial.saleId),
        `${trial.trialSessionsUsed || 0}/${trial.maxTrialSessions || 2} buoi`,
      ]),
      status: trial.status,
      priority:
        trial.status === TrialEnrollmentStatus.WAITING_DECISION
          ? 'HIGH'
          : (trial.trialSessionsUsed || 0) > 0
            ? 'MEDIUM'
            : 'LOW',
      dueAt: this.toIso(trial.updatedAt || trial.createdAt),
      route: '/app/trial-enrollments',
      actionLabel: 'Mo hoc thu',
      overdue:
        trial.status === TrialEnrollmentStatus.WAITING_DECISION &&
        this.isOverdue(trial.updatedAt || trial.createdAt, today),
    }));

    return this.buildDailyTaskBoard(Role.OPS, [
      {
        key: 'sessions',
        label: 'Buoi hoc',
        description: 'Nhung buoi hom nay va buoi can chot ngay.',
        emptyMessage: 'Khong co buoi hoc nao can xu ly them.',
        count: 0,
        tasks: sessionTasks,
      },
      {
        key: 'support',
        label: 'Ticket',
        description: 'Ticket qua han dang duoc giao cho van hanh.',
        emptyMessage: 'Khong co ticket qua han dang giao cho ban.',
        count: 0,
        tasks: supportTasks,
      },
      {
        key: 'resources',
        label: 'Nhan su & lop',
        description: 'Nhan su, lop hoc va hoc sinh can tiep nhan.',
        emptyMessage: 'Khong co hang muc nhan su hay lop can xu ly.',
        count: 0,
        tasks: resourceTasks,
      },
      {
        key: 'trials',
        label: 'Hoc thu',
        description: 'Hoc thu dang hoc va hoc thu can chot quyet dinh.',
        emptyMessage: 'Khong co hoc thu nao can xu ly.',
        count: 0,
        tasks: trialTasks,
      },
    ]);
  }

  private async getTeacherDailyTasks(teacherUserId: string): Promise<DailyTaskBoard> {
    const now = new Date();
    const today = this.startOfDay(now);
    const teacherObjId = new Types.ObjectId(teacherUserId);

    const [missedCompletions, upcomingSessions, waitingParentConfirm, openTickets] = await Promise.all([
      this.sessionModel
        .find({
          teacherId: teacherObjId,
          status: SessionStatus.SCHEDULED,
          scheduledDate: { $lt: now },
        })
        .sort({ scheduledDate: 1 })
        .limit(10)
        .populate('studentId', 'fullName studentCode')
        .populate('classId', 'name code')
        .lean(),
      this.sessionModel
        .find({
          teacherId: teacherObjId,
          status: SessionStatus.SCHEDULED,
          scheduledDate: { $gte: now },
        })
        .sort({ scheduledDate: 1 })
        .limit(10)
        .populate('studentId', 'fullName studentCode')
        .populate('classId', 'name code')
        .lean(),
      this.sessionModel
        .find({
          teacherId: teacherObjId,
          status: SessionStatus.TEACHER_COMPLETED,
        })
        .sort({ scheduledDate: 1 })
        .limit(10)
        .populate('studentId', 'fullName studentCode')
        .populate('classId', 'name code')
        .lean(),
      this.ticketModel
        .find({
          createdBy: teacherObjId,
          status: { $in: this.getOpenTicketStatuses() },
        })
        .sort({ updatedAt: -1, createdAt: -1 })
        .limit(10)
        .lean(),
    ]);

    const completionTasks: DailyTaskItem[] = missedCompletions.map((session: any) => ({
      id: `teacher-missed-${String(session._id)}`,
      type: 'MISSING_SESSION_COMPLETION',
      title: `Cap nhat buoi ${this.studentName(session.studentId) || ''}`.trim(),
      detail: this.className(session.classId) || 'Buoi da qua gio nhung chua chot',
      meta: [],
      status: session.status,
      priority: 'HIGH',
      dueAt: this.toIso(session.scheduledDate),
      route: '/app/sessions',
      actionLabel: 'Mo buoi hoc',
      overdue: true,
    }));

    const upcomingTasks: DailyTaskItem[] = upcomingSessions.map((session: any) => ({
      id: `teacher-upcoming-${String(session._id)}`,
      type: 'UPCOMING_SESSION',
      title: `Sap day ${this.studentName(session.studentId) || ''}`.trim(),
      detail: this.className(session.classId) || 'Buoi hoc sap toi',
      meta: [],
      status: session.status,
      priority: this.isSameDay(session.scheduledDate, today) ? 'HIGH' : 'MEDIUM',
      dueAt: this.toIso(session.scheduledDate),
      route: '/app/sessions',
      actionLabel: 'Mo lich day',
    }));

    const confirmationTasks: DailyTaskItem[] = waitingParentConfirm.map((session: any) => ({
      id: `teacher-wait-parent-${String(session._id)}`,
      type: 'WAITING_PARENT_CONFIRMATION',
      title: `Cho PH xac nhan ${this.studentName(session.studentId) || ''}`.trim(),
      detail: this.className(session.classId) || 'Buoi hoc dang cho PH xac nhan',
      meta: [],
      status: session.status,
      priority: this.isOverdue(session.scheduledDate, today) ? 'MEDIUM' : 'LOW',
      dueAt: this.toIso(session.scheduledDate),
      route: '/app/sessions',
      actionLabel: 'Mo buoi hoc',
      overdue: this.isOverdue(session.scheduledDate, today),
    }));

    const supportTasks: DailyTaskItem[] = openTickets.map((ticket: any) => ({
      id: `teacher-ticket-${String(ticket._id)}`,
      type: 'TEACHER_OPEN_TICKET',
      title: `Theo doi ticket ${ticket.ticketCode || ''}`.trim(),
      detail: ticket.subject || 'Ticket dang mo',
      meta: this.compactMeta([ticket.priority]),
      status: ticket.status,
      priority: this.mapTicketPriority(ticket.priority),
      dueAt: this.toIso(ticket.dueDate),
      route: '/app/tickets',
      actionLabel: 'Mo ticket',
      overdue: this.isOverdue(ticket.dueDate, now),
    }));

    return this.buildDailyTaskBoard(Role.TEACHER, [
      {
        key: 'completion',
        label: 'Can cap nhat',
        description: 'Buoi da qua gio nhung chua duoc giao vien chot.',
        emptyMessage: 'Khong co buoi nao bi tre cap nhat.',
        count: 0,
        tasks: completionTasks,
      },
      {
        key: 'upcoming',
        label: 'Sap toi',
        description: 'Nhung buoi day can mo ra de chuan bi trong ngay.',
        emptyMessage: 'Khong co buoi day sap toi nao.',
        count: 0,
        tasks: upcomingTasks,
      },
      {
        key: 'confirmations',
        label: 'Cho PH',
        description: 'Buoi hoc da nop nhung dang cho phu huynh xac nhan.',
        emptyMessage: 'Khong co buoi nao dang cho PH xac nhan.',
        count: 0,
        tasks: confirmationTasks,
      },
      {
        key: 'support',
        label: 'Ho tro',
        description: 'Ticket giao vien dang mo can tiep tuc theo doi.',
        emptyMessage: 'Khong co ticket nao dang mo.',
        count: 0,
        tasks: supportTasks,
      },
    ]);
  }

  private async getParentDailyTasks(parentUserId: string): Promise<DailyTaskBoard> {
    const now = new Date();
    const today = this.startOfDay(now);
    const parentObjId = new Types.ObjectId(parentUserId);
    const children = await this.studentModel
      .find({ parentUserId: parentObjId })
      .select('fullName name studentCode')
      .lean();
    const childIds = children.map((child) => child._id);

    const [needsConfirmation, upcomingSessions, pendingTopUps, openTickets] = await Promise.all([
      this.sessionModel
        .find({
          studentId: { $in: childIds },
          status: SessionStatus.TEACHER_COMPLETED,
        })
        .sort({ scheduledDate: 1 })
        .limit(10)
        .populate('teacherId', 'fullName')
        .populate('studentId', 'fullName studentCode')
        .populate('classId', 'name code')
        .lean(),
      this.sessionModel
        .find({
          studentId: { $in: childIds },
          status: SessionStatus.SCHEDULED,
          scheduledDate: { $gte: now },
        })
        .sort({ scheduledDate: 1 })
        .limit(10)
        .populate('teacherId', 'fullName')
        .populate('studentId', 'fullName studentCode')
        .populate('classId', 'name code')
        .lean(),
      this.ledgerModel
        .find({
          userId: parentObjId,
          type: TransactionType.TOP_UP,
          status: TransactionStatus.PENDING,
        })
        .sort({ createdAt: 1 })
        .limit(10)
        .lean(),
      this.ticketModel
        .find({
          createdBy: parentObjId,
          status: { $in: this.getOpenTicketStatuses() },
        })
        .sort({ updatedAt: -1, createdAt: -1 })
        .limit(10)
        .lean(),
    ]);

    const confirmationTasks: DailyTaskItem[] = needsConfirmation.map((session: any) => ({
      id: `parent-confirm-${String(session._id)}`,
      type: 'PARENT_CONFIRM_SESSION',
      title: `Xac nhan buoi ${this.studentName(session.studentId) || ''}`.trim(),
      detail: this.className(session.classId) || 'Buoi hoc dang cho phu huynh xac nhan',
      meta: this.compactMeta([this.personName(session.teacherId)]),
      status: session.status,
      priority: this.isOverdue(session.scheduledDate, today) ? 'HIGH' : 'MEDIUM',
      dueAt: this.toIso(session.scheduledDate),
      route: '/app/sessions',
      actionLabel: 'Mo buoi hoc',
      overdue: this.isOverdue(session.scheduledDate, today),
    }));

    const upcomingTasks: DailyTaskItem[] = upcomingSessions.map((session: any) => ({
      id: `parent-upcoming-${String(session._id)}`,
      type: 'PARENT_UPCOMING_SESSION',
      title: `Sap hoc ${this.studentName(session.studentId) || ''}`.trim(),
      detail: this.className(session.classId) || 'Buoi hoc sap toi',
      meta: this.compactMeta([this.personName(session.teacherId)]),
      status: session.status,
      priority: this.isSameDay(session.scheduledDate, today) ? 'HIGH' : 'LOW',
      dueAt: this.toIso(session.scheduledDate),
      route: '/app/parent-calendar',
      actionLabel: 'Mo lich hoc',
    }));

    const financeTasks: DailyTaskItem[] = pendingTopUps.map((entry: any) => ({
      id: `parent-topup-${String(entry._id)}`,
      type: 'PARENT_PENDING_TOP_UP',
      title: `Theo doi yeu cau nap vi ${this.formatCurrency(entry.amount)}`,
      detail: 'Yeu cau nap vi dang cho xac nhan',
      meta: this.compactMeta([entry.paymentMethod]),
      status: entry.status,
      priority: 'MEDIUM',
      dueAt: this.toIso(entry.createdAt),
      route: '/app/wallets',
      actionLabel: 'Mo vi',
    }));

    const supportTasks: DailyTaskItem[] = openTickets.map((ticket: any) => ({
      id: `parent-ticket-${String(ticket._id)}`,
      type: 'PARENT_OPEN_TICKET',
      title: `Theo doi ticket ${ticket.ticketCode || ''}`.trim(),
      detail: ticket.subject || 'Yeu cau ho tro dang mo',
      meta: this.compactMeta([ticket.priority]),
      status: ticket.status,
      priority: this.mapTicketPriority(ticket.priority),
      dueAt: this.toIso(ticket.dueDate),
      route: '/app/tickets',
      actionLabel: 'Mo ticket',
      overdue: this.isOverdue(ticket.dueDate, now),
    }));

    return this.buildDailyTaskBoard(Role.PARENT, [
      {
        key: 'confirmations',
        label: 'Can xac nhan',
        description: 'Nhung buoi hoc phu huynh can vao xac nhan.',
        emptyMessage: 'Khong co buoi hoc nao can xac nhan.',
        count: 0,
        tasks: confirmationTasks,
      },
      {
        key: 'upcoming',
        label: 'Sap hoc',
        description: 'Lich hoc sap toi cua con de chuan bi trong ngay.',
        emptyMessage: 'Khong co buoi hoc sap toi nao.',
        count: 0,
        tasks: upcomingTasks,
      },
      {
        key: 'finance',
        label: 'Giao dich',
        description: 'Yeu cau nap vi dang cho xac nhan.',
        emptyMessage: 'Khong co giao dich nao dang cho xu ly.',
        count: 0,
        tasks: financeTasks,
      },
      {
        key: 'support',
        label: 'Ho tro',
        description: 'Ticket dang mo can theo doi tiep.',
        emptyMessage: 'Khong co ticket nao dang mo.',
        count: 0,
        tasks: supportTasks,
      },
    ]);
  }

  private async getSaleDailyTasks(saleUserId: string): Promise<DailyTaskBoard> {
    const today = this.startOfDay(new Date());
    const tomorrow = this.addDays(today, 1);
    const saleObjId = new Types.ObjectId(saleUserId);

    const [leadFollowUps, orderQueue, pendingInvoices, trialQueue] = await Promise.all([
      this.leadModel
        .find({
          saleId: saleObjId,
          nextFollowUp: { $lte: tomorrow },
          status: { $in: this.getActiveLeadStatuses() },
        })
        .sort({ nextFollowUp: 1 })
        .limit(12)
        .lean(),
      this.orderModel
        .find({
          saleId: saleObjId,
          status: { $in: [OrderStatus.SUBMITTED, 'NEEDS_INFO', OrderStatus.APPROVED] },
        })
        .sort({ createdAt: 1 })
        .limit(12)
        .lean(),
      this.invoiceModel
        .find({
          $or: [
            { createdBy: saleObjId },
            { saleId: saleObjId },
          ],
          status: InvoiceStatus.PENDING_APPROVAL,
        })
        .sort({ createdAt: 1 })
        .limit(10)
        .populate('studentId', 'fullName studentCode')
        .lean(),
      this.trialEnrollmentModel
        .find({
          saleId: saleObjId,
          status: {
            $in: [TrialEnrollmentStatus.PENDING_TRIAL, TrialEnrollmentStatus.WAITING_DECISION],
          },
        })
        .sort({ updatedAt: 1, createdAt: 1 })
        .limit(12)
        .populate('classId', 'name code')
        .populate('studentId', 'fullName studentCode')
        .lean(),
    ]);

    const followUpTasks: DailyTaskItem[] = leadFollowUps.map((lead: any) => ({
      id: `sale-lead-${String(lead._id)}`,
      type: 'SALE_FOLLOW_UP',
      title: `Follow-up ${lead.parentName || lead.leadCode || 'lead'}`,
      detail: lead.parentPhone || 'Lead den han lien he',
      meta: this.compactMeta([lead.leadCode, lead.status]),
      status: lead.status,
      priority: this.isOverdue(lead.nextFollowUp, today) ? 'HIGH' : 'MEDIUM',
      dueAt: this.toIso(lead.nextFollowUp),
      route: '/app/leads',
      actionLabel: 'Mo leads',
      overdue: this.isOverdue(lead.nextFollowUp, today),
    }));

    const orderTasks: DailyTaskItem[] = orderQueue.map((order: any) => ({
      id: `sale-order-${String(order._id)}`,
      type: 'SALE_ORDER_QUEUE',
      title: `Theo doi don ${order.orderCode}`,
      detail: this.compactMeta([order.parentName, order.studentName]).join(' · ') || 'Don hang can theo doi',
      meta: this.compactMeta([this.formatCurrency(order.finalAmount)]),
      status: order.status,
      priority: order.status === 'NEEDS_INFO' ? 'HIGH' : 'MEDIUM',
      dueAt: this.toIso(order.createdAt),
      route: '/app/orders',
      actionLabel: 'Mo don hang',
    }));

    const financeTasks: DailyTaskItem[] = pendingInvoices.map((invoice: any) => ({
      id: `sale-invoice-${String(invoice._id)}`,
      type: 'SALE_PENDING_INVOICE',
      title: `Theo doi hoa don ${invoice.invoiceNumber}`,
      detail: this.studentName(invoice.studentId) || 'Hoa don dang cho duyet',
      meta: [],
      status: invoice.status,
      priority: 'MEDIUM',
      dueAt: this.toIso(invoice.createdAt),
      route: '/app/invoices',
      actionLabel: 'Mo hoa don',
    }));

    const trialTasks: DailyTaskItem[] = trialQueue.map((trial: any) => ({
      id: `sale-trial-${String(trial._id)}`,
      type: 'TRIAL_ENROLLMENT',
      title:
        trial.status === TrialEnrollmentStatus.WAITING_DECISION
          ? `Chot PH sau hoc thu ${trial.trialCode || ''}`.trim()
          : `Xep hoc thu ${trial.trialCode || ''}`.trim(),
      detail: trial.studentName || this.studentName(trial.studentId) || 'Hoc thu offline',
      meta: this.compactMeta([
        this.className(trial.classId),
        `${trial.trialSessionsUsed || 0}/${trial.maxTrialSessions || 2} buoi`,
        trial.parentPhone,
      ]),
      status: trial.status,
      priority:
        trial.status === TrialEnrollmentStatus.WAITING_DECISION
          ? 'HIGH'
          : (trial.trialSessionsUsed || 0) > 0
            ? 'MEDIUM'
            : 'LOW',
      dueAt: this.toIso(trial.updatedAt || trial.createdAt),
      route: '/app/trial-enrollments',
      actionLabel: 'Mo hoc thu',
      overdue:
        trial.status === TrialEnrollmentStatus.WAITING_DECISION &&
        this.isOverdue(trial.updatedAt || trial.createdAt, today),
    }));

    return this.buildDailyTaskBoard(Role.SALE, [
      {
        key: 'followups',
        label: 'Follow-up',
        description: 'Lead den han va lead da qua han can lien he ngay.',
        emptyMessage: 'Khong co lead nao den han follow-up.',
        count: 0,
        tasks: followUpTasks,
      },
      {
        key: 'orders',
        label: 'Don hang',
        description: 'Don dang cho duyet, bo sung hoac tiep tuc handover.',
        emptyMessage: 'Khong co don hang nao can theo doi hom nay.',
        count: 0,
        tasks: orderTasks,
      },
      {
        key: 'finance',
        label: 'Hoa don',
        description: 'Hoa don do sale tao dang cho duyet.',
        emptyMessage: 'Khong co hoa don nao dang cho duyet.',
        count: 0,
        tasks: financeTasks,
      },
      {
        key: 'trials',
        label: 'Hoc thu',
        description: 'Ban ghi hoc thu dang hoc va hoc thu can chot voi phu huynh.',
        emptyMessage: 'Khong co hoc thu nao can theo doi.',
        count: 0,
        tasks: trialTasks,
      },
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
      .map((action) => this.mapAdsActionToTask(action));
    const growthTasks = actions
      .filter((action) => action.priority !== 'CRITICAL' && action.priority !== 'HIGH')
      .map((action) => this.mapAdsActionToTask(action));

    return this.buildDailyTaskBoard(Role.ADSMANAGER, [
      {
        key: 'urgent',
        label: 'Xu ly ngay',
        description: 'Nhung de xuat uu tien cao can mo analytics hoac management de thao tac.',
        emptyMessage: 'Khong co de xuat cap bach nao tu he thong ads.',
        count: 0,
        tasks: urgentTasks,
      },
      {
        key: 'growth',
        label: 'Mo rong',
        description: 'Nhung de xuat toi uu budget va mo rong nhom quang cao.',
        emptyMessage: 'Khong co de xuat mo rong nao can xu ly ngay.',
        count: 0,
        tasks: growthTasks,
      },
    ]);
  }

  private buildDateFilter(fromDate?: string, toDate?: string): any {
    if (!fromDate && !toDate) return {};
    const filter: any = {};
    if (fromDate) filter.$gte = new Date(fromDate);
    if (toDate) {
      const end = new Date(toDate);
      end.setHours(23, 59, 59, 999);
      filter.$lte = end;
    }
    return { createdAt: filter };
  }

  private buildDailyTaskBoard(role: Role, tabs: DailyTaskTab[]): DailyTaskBoard {
    const normalizedTabs = tabs.map((tab) => ({
      ...tab,
      tasks: this.sortDailyTasks(tab.tasks),
      count: tab.tasks.length,
    }));
    const allTasks = normalizedTabs.flatMap((tab) => tab.tasks);
    const today = this.startOfDay(new Date());

    return {
      role,
      title: 'Viec trong ngay',
      subtitle: 'Danh sach can xu ly tu cac module theo role hien tai.',
      generatedAt: new Date().toISOString(),
      summary: {
        totalTasks: allTasks.length,
        overdueTasks: allTasks.filter((task) => task.overdue).length,
        dueTodayTasks: allTasks.filter((task) => task.dueAt && this.isSameDay(task.dueAt, today)).length,
        highPriorityTasks: allTasks.filter((task) => task.priority === 'CRITICAL' || task.priority === 'HIGH').length,
      },
      tabs: normalizedTabs,
    };
  }

  private sortDailyTasks(tasks: DailyTaskItem[]): DailyTaskItem[] {
    return [...tasks].sort((left, right) => {
      const overdueDiff = Number(Boolean(right.overdue)) - Number(Boolean(left.overdue));
      if (overdueDiff !== 0) return overdueDiff;

      const priorityDiff = this.getPriorityWeight(left.priority) - this.getPriorityWeight(right.priority);
      if (priorityDiff !== 0) return priorityDiff;

      const leftTime = left.dueAt ? new Date(left.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
      const rightTime = right.dueAt ? new Date(right.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
      return leftTime - rightTime;
    });
  }

  private getPriorityWeight(priority: DailyTaskPriority): number {
    switch (priority) {
      case 'CRITICAL':
        return 0;
      case 'HIGH':
        return 1;
      case 'MEDIUM':
        return 2;
      default:
        return 3;
    }
  }

  private getOpenTicketStatuses(): TicketStatus[] {
    return [TicketStatus.OPEN, TicketStatus.IN_PROGRESS, TicketStatus.WAITING_INFO];
  }

  private getActiveLeadStatuses(): LeadStatus[] {
    return [LeadStatus.NEW, LeadStatus.CONTACTED, LeadStatus.CONSULTING, LeadStatus.INTERESTED];
  }

  private mapTicketPriority(priority?: TicketPriority): DailyTaskPriority {
    switch (priority) {
      case TicketPriority.URGENT:
        return 'CRITICAL';
      case TicketPriority.HIGH:
        return 'HIGH';
      case TicketPriority.MEDIUM:
        return 'MEDIUM';
      default:
        return 'LOW';
    }
  }

  private mapAdsActionToTask(action: ActionableSuggestion): DailyTaskItem {
    const route = action.type === 'CREATE_GROUP' ? '/app/ads-management' : '/app/ads-analytics';
    return {
      id: `ads-action-${action.type}-${action.relatedEntity?.id || action.title}`,
      type: action.type,
      title: action.title,
      detail: action.description,
      meta: this.compactMeta([
        action.relatedEntity?.name,
        action.estimatedImpact?.monthlyProfitChange != null
          ? `${this.formatCurrency(action.estimatedImpact.monthlyProfitChange)}/thang`
          : undefined,
      ]),
      priority: action.priority,
      dueAt: undefined,
      route,
      actionLabel: route === '/app/ads-management' ? 'Mo ads management' : 'Mo ads analytics',
      overdue: action.priority === 'CRITICAL',
    };
  }

  private startOfDay(date: Date): Date {
    const clone = new Date(date);
    clone.setHours(0, 0, 0, 0);
    return clone;
  }

  private addDays(date: Date, days: number): Date {
    const clone = new Date(date);
    clone.setDate(clone.getDate() + days);
    return clone;
  }

  private isSameDay(value: string | Date, reference: Date): boolean {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return false;
    const start = this.startOfDay(reference);
    const end = this.addDays(start, 1);
    return date >= start && date < end;
  }

  private isOverdue(value: string | Date | undefined | null, reference: Date): boolean {
    if (!value) return false;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return false;
    return date.getTime() < reference.getTime();
  }

  private toIso(value: string | Date | undefined | null): string | undefined {
    if (!value) return undefined;
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return undefined;
    return date.toISOString();
  }

  private toShortDate(value: string | Date | undefined | null): string {
    if (!value) return '';
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString('vi-VN');
  }

  private formatCurrency(value: number | undefined | null): string {
    const amount = Number(value || 0);
    return `${amount.toLocaleString('vi-VN')}d`;
  }

  private compactMeta(values: Array<string | undefined | null>): string[] {
    return values.filter((value): value is string => Boolean(value && value.trim()));
  }

  private personName(person?: { fullName?: string; name?: string } | null): string {
    return person?.fullName || person?.name || '';
  }

  private studentName(student?: { fullName?: string; name?: string; studentCode?: string } | null): string {
    const name = student?.fullName || student?.name || '';
    if (!name) return '';
    return student?.studentCode ? `${name} (${student.studentCode})` : name;
  }

  private className(classRef?: { name?: string; code?: string } | null): string {
    if (!classRef?.name) return '';
    return classRef.code ? `${classRef.code} - ${classRef.name}` : classRef.name;
  }

  private async getSessionStats(dateFilter: any) {
    const match = dateFilter.createdAt ? dateFilter : {};
    const agg = await this.sessionModel.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          revenue: { $sum: '$amountCharged' },
          teacherCost: { $sum: '$teacherPayout' },
        },
      },
    ]);
    const byStatus: Record<string, number> = {};
    let total = 0, totalRevenue = 0, totalTeacherCost = 0;
    agg.forEach((item: any) => {
      byStatus[item._id] = item.count;
      total += item.count;
      if (item._id === 'FINALIZED') {
        totalRevenue += item.revenue;
        totalTeacherCost += item.teacherCost;
      }
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
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalNet: { $sum: '$netAmount' },
        },
      },
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
      this.ticketModel.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      // Average resolution time
      this.ticketModel.aggregate([
        { $match: { status: { $in: [TicketStatus.RESOLVED, TicketStatus.CLOSED] }, 'resolution.resolvedAt': { $exists: true } } },
        {
          $project: {
            resolutionMs: { $subtract: ['$resolution.resolvedAt', '$createdAt'] },
          },
        },
        { $group: { _id: null, avgMs: { $avg: '$resolutionMs' } } },
      ]),
      this.ticketModel.countDocuments({
        status: { $nin: [TicketStatus.RESOLVED, TicketStatus.CLOSED, TicketStatus.CANCELLED] },
        dueDate: { $lt: new Date() },
      }),
    ]);

    let total = 0, openCount = 0;
    statusAgg.forEach((s: any) => {
      total += s.count;
      if (s._id === TicketStatus.OPEN) openCount = s.count;
    });

    const avgResolutionHours = resolvedAgg[0]?.avgMs
      ? Math.round((resolvedAgg[0].avgMs / (1000 * 60 * 60)) * 10) / 10
      : null;

    return { total, openCount, overdueCount, avgResolutionHours };
  }

  private async getWalletAggregates() {
    const agg = await this.walletModel.aggregate([
      { $match: { status: { $ne: 'CLOSED' } } },
      {
        $group: {
          _id: null,
          totalBalance: { $sum: '$balance' },
          totalTopUp: { $sum: '$totalTopUp' },
          totalDeducted: { $sum: '$totalDeducted' },
          totalRefunded: { $sum: '$totalRefunded' },
        },
      },
    ]);
    return agg[0] || { totalBalance: 0, totalTopUp: 0, totalDeducted: 0, totalRefunded: 0 };
  }

  private async getExpenseAggregates(dateFilter: any = {}) {
    const paidFilter = { paymentStatus: ExpensePaymentStatus.PAID, ...dateFilter };
    const allFilter = { ...dateFilter };

    const [paidAgg, byStatusAgg, byCategoryAgg] = await Promise.all([
      this.expenseModel.aggregate([
        { $match: paidFilter },
        { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
      ]),
      this.expenseModel.aggregate([
        { $match: allFilter },
        { $group: { _id: '$paymentStatus', total: { $sum: '$amount' }, count: { $sum: 1 } } },
      ]),
      this.expenseModel.aggregate([
        { $match: { ...paidFilter } },
        { $group: { _id: '$category', total: { $sum: '$amount' }, count: { $sum: 1 } } },
      ]),
    ]);

    const byStatus: Record<string, { total: number; count: number }> = {};
    byStatusAgg.forEach((s: any) => { byStatus[s._id] = { total: s.total, count: s.count }; });

    const byCategory: Record<string, { total: number; count: number }> = {};
    byCategoryAgg.forEach((c: any) => { byCategory[c._id] = { total: c.total, count: c.count }; });

    return {
      totalPaid: paidAgg[0]?.total || 0,
      paidCount: paidAgg[0]?.count || 0,
      byStatus,
      byCategory,
    };
  }

  // ════════════════════════════════════════════════════════════════════
  // DIRECTOR COMPREHENSIVE — All dashboards combined for testing
  // ════════════════════════════════════════════════════════════════════

  async getDirectorComprehensive(fromDate?: string, toDate?: string, userId?: string) {
    const [director, accounting, ops, birthdays, staffLists] = await Promise.all([
      this.getDirectorDashboard(fromDate, toDate),
      this.getAccountingDashboard(fromDate, toDate),
      this.getOpsDashboard(userId || ''),
      this.getBirthdaysByMonth(),
      this.getStaffLists(),
    ]);

    return {
      director,
      accounting,
      ops,
      birthdays,
      staffLists,
    };
  }

  // ════════════════════════════════════════════════════════════════════
  // STAFF LISTS — Danh sách nhân sự theo vai trò
  // ════════════════════════════════════════════════════════════════════

  async getStaffLists() {
    // Tất cả user trừ PARENT (nhân sự nội bộ)
    const staffRoles = ['DIRECTOR', 'ACCOUNTING', 'OPS', 'TEACHER', 'SALE', 'ADSMANAGER', 'HCNS', 'MANAGER', 'STAFF', 'PARTIME'];

    const [users, teacherProfiles] = await Promise.all([
      this.userModel.find(
        { role: { $in: staffRoles } },
        'fullName email role status createdAt',
      ).sort({ role: 1, fullName: 1 }).lean(),

      this.teacherModel.find(
        {},
        'userId status subjects grades teachingMode pricePerSession rating totalSessions activeClasses yearsOfExperience',
      ).populate('userId', 'fullName email status').lean(),
    ]);

    // Group users by role
    const byRole: Record<string, any[]> = {};
    for (const u of users) {
      const role = (u as any).role;
      if (!byRole[role]) byRole[role] = [];
      byRole[role].push({
        _id: (u as any)._id,
        fullName: (u as any).fullName,
        email: (u as any).email,
        role,
        status: (u as any).status,
        createdAt: (u as any).createdAt,
      });
    }

    // Enrich teachers with profile data
    const teachers = teacherProfiles.map((tp: any) => ({
      _id: tp._id,
      userId: tp.userId?._id,
      fullName: tp.userId?.fullName || 'N/A',
      email: tp.userId?.email,
      userStatus: tp.userId?.status,
      teacherStatus: tp.status,
      subjects: tp.subjects,
      grades: tp.grades,
      teachingMode: tp.teachingMode,
      pricePerSession: tp.pricePerSession,
      rating: tp.rating,
      totalSessions: tp.totalSessions,
      activeClasses: tp.activeClasses,
      yearsOfExperience: tp.yearsOfExperience,
    }));

    // Summary counts
    const summary: Record<string, number> = {};
    for (const role of staffRoles) {
      if (byRole[role]?.length) summary[role] = byRole[role].length;
    }

    return {
      summary,
      totalStaff: users.length,
      teachers,
      byRole,
    };
  }

  // ════════════════════════════════════════════════════════════════════
  // BIRTHDAY PROMOTIONS — Students/Parents with birthday this month
  // ════════════════════════════════════════════════════════════════════

  async getBirthdaysByMonth(month?: number) {
    const targetMonth = month || new Date().getMonth() + 1; // 1-12

    const [studentBirthdays, parentBirthdays] = await Promise.all([
      this.studentModel.find({ studentBirthMonth: targetMonth })
        .select('studentCode fullName age studentBirthMonth parentName parentPhone')
        .lean(),
      this.studentModel.find({ parentBirthMonth: targetMonth })
        .select('studentCode fullName parentName parentPhone parentBirthMonth')
        .lean(),
    ]);

    return {
      month: targetMonth,
      studentBirthdays,
      parentBirthdays,
      totalStudentBirthdays: studentBirthdays.length,
      totalParentBirthdays: parentBirthdays.length,
    };
  }

  // ════════════════════════════════════════════════════════════════════
  // KPI & TEACHER PERFORMANCE — Đánh giá hiệu suất giáo viên
  // ════════════════════════════════════════════════════════════════════

  async getTeacherKPI(fromDate?: string, toDate?: string) {
    const dateFilter = this.buildDateFilter(fromDate, toDate);
    const dateMatch = dateFilter.createdAt ? { createdAt: dateFilter.createdAt } : {};
    const scheduledDateMatch = dateFilter.createdAt
      ? { scheduledDate: dateFilter.createdAt }
      : {};

    // Get all teacher profiles with user info
    const teachers = await this.teacherModel
      .find()
      .populate('userId', 'fullName email phone status')
      .lean();

    // Get session stats per teacher
    const sessionAgg = await this.sessionModel.aggregate([
      { $match: { ...scheduledDateMatch } },
      {
        $group: {
          _id: {
            teacherId: '$teacherId',
            status: '$status',
          },
          count: { $sum: 1 },
          totalRevenue: { $sum: '$amountCharged' },
          totalPayout: { $sum: '$teacherPayout' },
        },
      },
    ]);

    // Get teaching report stats per teacher
    const reportAgg = await this.sessionModel.aggregate([
      {
        $match: {
          hasTeachingReport: true,
          ...scheduledDateMatch,
        },
      },
      {
        $group: {
          _id: '$teacherId',
          totalReports: { $sum: 1 },
          lateReports: {
            $sum: { $cond: ['$teachingReport.isLateSubmission', 1, 0] },
          },
        },
      },
    ]);

    // Get session evaluation averages per teacher
    const evalAgg = await this.sessionModel.aggregate([
      {
        $match: {
          'evaluation.studentPerformance': { $exists: true },
          ...scheduledDateMatch,
        },
      },
      {
        $group: {
          _id: '$teacherId',
          avgStudentPerformance: { $avg: '$evaluation.studentPerformance' },
          avgStudentEngagement: { $avg: '$evaluation.studentEngagement' },
          avgComprehension: { $avg: '$evaluation.comprehensionLevel' },
          evalCount: { $sum: 1 },
        },
      },
    ]);

    // Get parent feedback averages per teacher
    const feedbackAgg = await this.sessionModel.aggregate([
      {
        $match: {
          'parentFeedback.overallRating': { $exists: true },
          ...scheduledDateMatch,
        },
      },
      {
        $group: {
          _id: '$teacherId',
          avgOverallRating: { $avg: '$parentFeedback.overallRating' },
          avgTeachingQuality: { $avg: '$parentFeedback.teachingQualityRating' },
          avgCommunication: { $avg: '$parentFeedback.communicationRating' },
          satisfiedCount: {
            $sum: { $cond: ['$parentFeedback.isSatisfied', 1, 0] },
          },
          feedbackCount: { $sum: 1 },
        },
      },
    ]);

    // Get active classes per teacher
    const classAgg = await this.classModel.aggregate([
      { $match: { status: 'ACTIVE' } },
      {
        $group: {
          _id: '$teacher',
          activeClasses: { $sum: 1 },
          totalStudents: { $sum: { $size: { $ifNull: ['$students', []] } } },
        },
      },
    ]);

    // Get payroll data per teacher
    const payrollAgg = await this.payrollModel.aggregate([
      { $match: { status: 'PAID', ...dateMatch } },
      {
        $group: {
          _id: '$teacherId',
          totalPaid: { $sum: '$netAmount' },
          payrollCount: { $sum: 1 },
        },
      },
    ]);

    // Build maps for quick lookup
    const sessionMap = new Map<string, any>();
    for (const s of sessionAgg) {
      const tid = s._id.teacherId.toString();
      if (!sessionMap.has(tid)) {
        sessionMap.set(tid, {
          total: 0, completed: 0, cancelled: 0, noShow: 0,
          totalRevenue: 0, totalPayout: 0, byStatus: {},
        });
      }
      const entry = sessionMap.get(tid);
      entry.total += s.count;
      entry.totalRevenue += s.totalRevenue || 0;
      entry.totalPayout += s.totalPayout || 0;
      entry.byStatus[s._id.status] = s.count;
      if (s._id.status === 'FINALIZED') entry.completed += s.count;
      if (s._id.status === 'CANCELLED') entry.cancelled += s.count;
      if (s._id.status === 'NO_SHOW') entry.noShow += s.count;
    }

    const reportMap = new Map<string, any>();
    for (const r of reportAgg) {
      reportMap.set(r._id.toString(), {
        totalReports: r.totalReports,
        lateReports: r.lateReports,
      });
    }

    const evalMap = new Map<string, any>();
    for (const e of evalAgg) {
      evalMap.set(e._id.toString(), {
        avgStudentPerformance: Math.round((e.avgStudentPerformance || 0) * 10) / 10,
        avgStudentEngagement: Math.round((e.avgStudentEngagement || 0) * 10) / 10,
        avgComprehension: Math.round((e.avgComprehension || 0) * 10) / 10,
        evalCount: e.evalCount,
      });
    }

    const feedbackMap = new Map<string, any>();
    for (const f of feedbackAgg) {
      feedbackMap.set(f._id.toString(), {
        avgOverallRating: Math.round((f.avgOverallRating || 0) * 10) / 10,
        avgTeachingQuality: Math.round((f.avgTeachingQuality || 0) * 10) / 10,
        avgCommunication: Math.round((f.avgCommunication || 0) * 10) / 10,
        satisfactionRate: f.feedbackCount > 0
          ? Math.round((f.satisfiedCount / f.feedbackCount) * 100)
          : 0,
        feedbackCount: f.feedbackCount,
      });
    }

    const classMap = new Map<string, any>();
    for (const c of classAgg) {
      classMap.set(c._id.toString(), {
        activeClasses: c.activeClasses,
        totalStudents: c.totalStudents,
      });
    }

    const payrollMap = new Map<string, any>();
    for (const p of payrollAgg) {
      payrollMap.set(p._id.toString(), {
        totalPaid: p.totalPaid,
        payrollCount: p.payrollCount,
      });
    }

    // Build KPI result for each teacher  
    const teacherKPIs = teachers.map((t: any) => {
      const userId = t.userId?._id?.toString() || t.userId?.toString();
      const sessions = sessionMap.get(userId) || {
        total: 0, completed: 0, cancelled: 0, noShow: 0,
        totalRevenue: 0, totalPayout: 0, byStatus: {},
      };
      const reports = reportMap.get(userId) || { totalReports: 0, lateReports: 0 };
      const evals = evalMap.get(userId) || {
        avgStudentPerformance: 0, avgStudentEngagement: 0, avgComprehension: 0, evalCount: 0,
      };
      const feedback = feedbackMap.get(userId) || {
        avgOverallRating: 0, avgTeachingQuality: 0, avgCommunication: 0,
        satisfactionRate: 0, feedbackCount: 0,
      };
      const classes = classMap.get(userId) || { activeClasses: 0, totalStudents: 0 };
      const payroll = payrollMap.get(userId) || { totalPaid: 0, payrollCount: 0 };

      // Calculate KPI scores
      const completionRate = sessions.total > 0
        ? Math.round((sessions.completed / sessions.total) * 100)
        : 0;
      const reportSubmissionRate = sessions.completed > 0
        ? Math.round((reports.totalReports / sessions.completed) * 100)
        : 0;
      const onTimeReportRate = reports.totalReports > 0
        ? Math.round(((reports.totalReports - reports.lateReports) / reports.totalReports) * 100)
        : 0;

      // Overall KPI score (weighted)
      const kpiScore = Math.round(
        (completionRate * 0.25) +
        (reportSubmissionRate * 0.15) +
        (onTimeReportRate * 0.10) +
        ((feedback.avgOverallRating || 0) * 20 * 0.25) +
        ((evals.avgStudentPerformance || 0) * 20 * 0.15) +
        ((feedback.satisfactionRate || 0) * 0.10)
      );

      return {
        profileId: t._id,
        userId,
        fullName: t.userId?.fullName || 'N/A',
        email: t.userId?.email || '',
        phone: t.userId?.phone || '',
        teacherStatus: t.status,
        subjects: t.subjects,
        grades: t.grades,
        profileRating: t.rating,
        yearsOfExperience: t.yearsOfExperience,
        kpiScore: Math.min(kpiScore, 100),
        sessions: {
          total: sessions.total,
          completed: sessions.completed,
          cancelled: sessions.cancelled,
          noShow: sessions.noShow,
          completionRate,
          totalRevenue: sessions.totalRevenue,
          totalPayout: sessions.totalPayout,
        },
        reports: {
          submitted: reports.totalReports,
          late: reports.lateReports,
          submissionRate: reportSubmissionRate,
          onTimeRate: onTimeReportRate,
        },
        evaluation: evals,
        parentFeedback: feedback,
        classes,
        payroll,
      };
    });

    // Sort by KPI score descending
    teacherKPIs.sort((a, b) => b.kpiScore - a.kpiScore);

    // Summary statistics
    const totalTeachers = teacherKPIs.length;
    const activeTeachers = teacherKPIs.filter(t => t.teacherStatus === 'ACTIVE').length;
    const avgKPI = totalTeachers > 0
      ? Math.round(teacherKPIs.reduce((sum, t) => sum + t.kpiScore, 0) / totalTeachers)
      : 0;
    const avgRating = totalTeachers > 0
      ? Math.round(
          teacherKPIs.reduce((sum, t) => sum + (t.parentFeedback.avgOverallRating || 0), 0) / totalTeachers * 10
        ) / 10
      : 0;

    const kpiDistribution = {
      excellent: teacherKPIs.filter(t => t.kpiScore >= 80).length,
      good: teacherKPIs.filter(t => t.kpiScore >= 60 && t.kpiScore < 80).length,
      average: teacherKPIs.filter(t => t.kpiScore >= 40 && t.kpiScore < 60).length,
      belowAverage: teacherKPIs.filter(t => t.kpiScore < 40).length,
    };

    return {
      summary: {
        totalTeachers,
        activeTeachers,
        avgKPI,
        avgRating,
        kpiDistribution,
      },
      teachers: teacherKPIs,
    };
  }

  // ════════════════════════════════════════════════════════════════════
  // CALENDAR OVERVIEW — Lịch tổng quan
  // ════════════════════════════════════════════════════════════════════

  async getCalendarOverview(month?: number, year?: number) {
    const now = new Date();
    const targetMonth = month || now.getMonth() + 1; // 1-12
    const targetYear = year || now.getFullYear();

    const startDate = new Date(targetYear, targetMonth - 1, 1);
    const endDate = new Date(targetYear, targetMonth, 0, 23, 59, 59, 999);

    // Get all sessions in this month
    const sessions = await this.sessionModel
      .find({
        scheduledDate: { $gte: startDate, $lte: endDate },
      })
      .select('classId studentId teacherId status sessionType scheduledDate scheduledStartTime scheduledEndTime durationMinutes teacherPayout amountCharged hasTeachingReport')
      .populate('teacherId', 'fullName')
      .populate('studentId', 'fullName studentCode')
      .populate('classId', 'name code')
      .sort({ scheduledDate: 1 })
      .lean();

    // Group sessions by date
    const byDate: Record<string, any[]> = {};
    for (const s of sessions) {
      const dateKey = new Date(s.scheduledDate).toISOString().split('T')[0];
      if (!byDate[dateKey]) byDate[dateKey] = [];
      byDate[dateKey].push(s);
    }

    // Session summary for the month
    const sessionStatusAgg = await this.sessionModel.aggregate([
      {
        $match: {
          scheduledDate: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]);
    const byStatus: Record<string, number> = {};
    let totalSessions = 0;
    for (const s of sessionStatusAgg) {
      byStatus[s._id] = s.count;
      totalSessions += s.count;
    }

    // Get payroll deadlines in this month
    const payrolls = await this.payrollModel
      .find({
        $or: [
          { periodStart: { $lte: endDate }, periodEnd: { $gte: startDate } },
          { createdAt: { $gte: startDate, $lte: endDate } },
        ],
      })
      .select('teacherId status periodStart periodEnd netAmount grossAmount createdAt')
      .populate('teacherId', 'fullName')
      .sort({ createdAt: -1 })
      .lean();

    // Get tickets created this month
    const tickets = await this.ticketModel
      .find({
        createdAt: { $gte: startDate, $lte: endDate },
      })
      .select('ticketCode subject status priority createdAt dueDate')
      .populate('createdBy', 'fullName')
      .sort({ createdAt: -1 })
      .lean();

    // Build calendar event list
    const events: any[] = [];

    // Add sessions as events
    for (const [dateStr, dateSessions] of Object.entries(byDate)) {
      for (const s of dateSessions) {
        events.push({
          date: dateStr,
          type: 'SESSION',
          title: `${(s as any).classId?.name || 'Lớp'} - ${(s as any).teacherId?.fullName || 'GV'}`,
          detail: `HS: ${(s as any).studentId?.fullName || 'N/A'}`,
          status: (s as any).status,
          time: (s as any).scheduledStartTime || null,
          _id: (s as any)._id,
        });
      }
    }

    // Add ticket due dates
    for (const t of tickets) {
      const dueDate = (t as any).dueDate;
      if (dueDate) {
        events.push({
          date: new Date(dueDate).toISOString().split('T')[0],
          type: 'TICKET_DUE',
          title: `Ticket ${(t as any).ticketCode}`,
          detail: (t as any).subject,
          status: (t as any).status,
          priority: (t as any).priority,
          _id: (t as any)._id,
        });
      }
      events.push({
        date: new Date((t as any).createdAt).toISOString().split('T')[0],
        type: 'TICKET_CREATED',
        title: `Ticket mới: ${(t as any).ticketCode}`,
        detail: (t as any).subject,
        status: (t as any).status,
        priority: (t as any).priority,
        _id: (t as any)._id,
      });
    }

    // Add payroll events
    for (const p of payrolls) {
      events.push({
        date: new Date((p as any).createdAt).toISOString().split('T')[0],
        type: 'PAYROLL',
        title: `Lương: ${(p as any).teacherId?.fullName || 'GV'}`,
        detail: `${(p as any).netAmount?.toLocaleString()}đ - ${(p as any).status}`,
        status: (p as any).status,
        _id: (p as any)._id,
      });
    }

    // Sort events by date
    events.sort((a, b) => a.date.localeCompare(b.date));

    // Daily summary (sessions per day)
    const dailySummary: Record<string, { sessions: number; completed: number; cancelled: number }> = {};
    for (const [dateStr, dateSessions] of Object.entries(byDate)) {
      dailySummary[dateStr] = {
        sessions: dateSessions.length,
        completed: dateSessions.filter((s: any) => s.status === 'FINALIZED').length,
        cancelled: dateSessions.filter((s: any) => s.status === 'CANCELLED').length,
      };
    }

    return {
      month: targetMonth,
      year: targetYear,
      totalSessions,
      byStatus,
      dailySummary,
      events,
      sessions,
      payrolls,
      tickets,
    };
  }

  // ════════════════════════════════════════════════════════════════════
  // SALES DASHBOARD (Phase 1.3)
  // ════════════════════════════════════════════════════════════════════

  async getSalesDashboard(saleId?: string, fromDate?: string, toDate?: string) {
    const dateFilter: any = {};
    if (fromDate) dateFilter.$gte = new Date(fromDate);
    if (toDate) dateFilter.$lte = new Date(toDate);
    const hasDateFilter = Object.keys(dateFilter).length > 0;

    // ── Leads ──
    const leadFilter: any = {};
    if (saleId) leadFilter.saleId = new Types.ObjectId(saleId);
    if (hasDateFilter) leadFilter.createdAt = dateFilter;

    const leads = await this.leadModel.find(leadFilter).lean();
    const totalLeads = leads.length;
    const convertedLeads = leads.filter((l: any) => l.status === 'CONVERTED').length;
    const conversionRate = totalLeads > 0 ? Math.round((convertedLeads / totalLeads) * 100) : 0;

    const leadsByStatus: Record<string, number> = {};
    for (const l of leads) {
      leadsByStatus[(l as any).status] = (leadsByStatus[(l as any).status] || 0) + 1;
    }

    // Active leads (not converted, not lost)
    const activeLeads = leads.filter(
      (l: any) => !['CONVERTED', 'NOT_INTERESTED', 'NO_RESPONSE'].includes(l.status),
    ).length;

    // Follow-ups due today/overdue
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const followUpsDueToday = leads.filter(
      (l: any) => l.nextFollowUp && new Date(l.nextFollowUp) >= today && new Date(l.nextFollowUp) < tomorrow,
    );
    const followUpsOverdue = leads.filter(
      (l: any) => l.nextFollowUp && new Date(l.nextFollowUp) < today &&
        !['CONVERTED', 'NOT_INTERESTED', 'NO_RESPONSE'].includes(l.status),
    );

    // ── Orders ──
    const orderFilter: any = {};
    if (saleId) orderFilter.saleId = new Types.ObjectId(saleId);
    if (hasDateFilter) orderFilter.createdAt = dateFilter;

    const orders = await this.orderModel.find(orderFilter).lean();

    const revenueGenerated = orders
      .filter((o: any) => o.status === 'COMPLETED')
      .reduce((sum, o: any) => sum + (o.finalAmount || 0), 0);

    const commissionEarned = orders
      .filter((o: any) => o.status === 'COMPLETED')
      .reduce((sum, o: any) => sum + (o.saleCommission || 0), 0);

    const commissionPending = orders
      .filter((o: any) => o.status === 'APPROVED')
      .reduce((sum, o: any) => sum + (o.saleCommission || 0), 0);

    const ordersByStatus: Record<string, number> = {};
    for (const o of orders) {
      ordersByStatus[(o as any).status] = (ordersByStatus[(o as any).status] || 0) + 1;
    }

    // Recent orders (last 10)
    const recentOrders = orders
      .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 10)
      .map((o: any) => ({
        _id: o._id,
        orderCode: o.orderCode,
        parentName: o.parentName,
        studentName: o.studentName,
        finalAmount: o.finalAmount,
        saleCommission: o.saleCommission,
        status: o.status,
        createdAt: o.createdAt,
      }));

    return {
      leads: {
        total: totalLeads,
        converted: convertedLeads,
        conversionRate,
        active: activeLeads,
        byStatus: leadsByStatus,
        followUpsDueToday: followUpsDueToday.map((l: any) => ({
          _id: l._id,
          leadCode: l.leadCode,
          parentName: l.parentName,
          parentPhone: l.parentPhone,
          status: l.status,
          nextFollowUp: l.nextFollowUp,
        })),
        followUpsOverdue: followUpsOverdue.length,
      },
      orders: {
        total: orders.length,
        byStatus: ordersByStatus,
        revenueGenerated,
        commissionEarned,
        commissionPending,
        recentOrders,
      },
    };
  }

  // ════════════════════════════════════════════════════════════════════
  // REVENUE & PROFIT REPORTS (Phase 2.1)
  // ════════════════════════════════════════════════════════════════════

  async getRevenueReport(period: 'monthly' | 'quarterly' | 'yearly' = 'monthly', fromDate?: string, toDate?: string) {
    const dateFilter: any = {};
    if (fromDate) dateFilter.$gte = new Date(fromDate);
    if (toDate) dateFilter.$lte = new Date(toDate);
    const hasDate = Object.keys(dateFilter).length > 0;

    // Revenue from approved invoices
    const invoiceFilter: any = { status: 'APPROVED' };
    if (hasDate) invoiceFilter.approvedAt = dateFilter;
    const invoices = await this.invoiceModel.find(invoiceFilter).lean();

    // Expenses paid
    const expenseFilter: any = { paymentStatus: 'PAID' };
    if (hasDate) expenseFilter.paidAt = dateFilter;
    const expenses = await this.expenseModel.find(expenseFilter).lean();

    // Payroll paid
    const payrollFilter: any = { status: 'PAID' };
    if (hasDate) payrollFilter.paidAt = dateFilter;
    const payrolls = await this.payrollModel.find(payrollFilter).lean();

    const getKey = (date: Date): string => {
      const d = new Date(date);
      if (period === 'yearly') return d.getFullYear().toString();
      if (period === 'quarterly') return `${d.getFullYear()}-Q${Math.ceil((d.getMonth() + 1) / 3)}`;
      return d.toISOString().slice(0, 7); // monthly: YYYY-MM
    };

    const periodData: Record<string, { revenue: number; expenses: number; payroll: number }> = {};

    for (const inv of invoices) {
      const key = getKey((inv as any).approvedAt || (inv as any).createdAt);
      if (!periodData[key]) periodData[key] = { revenue: 0, expenses: 0, payroll: 0 };
      periodData[key].revenue += (inv as any).amount || 0;
    }
    for (const exp of expenses) {
      const key = getKey((exp as any).paidAt || (exp as any).createdAt);
      if (!periodData[key]) periodData[key] = { revenue: 0, expenses: 0, payroll: 0 };
      periodData[key].expenses += (exp as any).amount || 0;
    }
    for (const p of payrolls) {
      const key = getKey((p as any).paidAt || (p as any).createdAt);
      if (!periodData[key]) periodData[key] = { revenue: 0, expenses: 0, payroll: 0 };
      periodData[key].payroll += (p as any).netAmount || 0;
    }

    const periods = Object.entries(periodData)
      .map(([key, data]) => {
        const profit = data.revenue - data.expenses - data.payroll;
        const margin = data.revenue > 0 ? Math.round((profit / data.revenue) * 100) : 0;
        return { period: key, ...data, profit, margin };
      })
      .sort((a, b) => a.period.localeCompare(b.period));

    const totalRevenue = periods.reduce((s, p) => s + p.revenue, 0);
    const totalExpenses = periods.reduce((s, p) => s + p.expenses, 0);
    const totalPayroll = periods.reduce((s, p) => s + p.payroll, 0);
    const totalProfit = totalRevenue - totalExpenses - totalPayroll;

    return {
      periods,
      summary: {
        totalRevenue,
        totalExpenses,
        totalPayroll,
        totalProfit,
        overallMargin: totalRevenue > 0 ? Math.round((totalProfit / totalRevenue) * 100) : 0,
      },
    };
  }

  // ════════════════════════════════════════════════════════════════════
  // STUDENT RETENTION (Phase 2.2)
  // ════════════════════════════════════════════════════════════════════

  async getRetentionMetrics() {
    const now = new Date();

    // Active students (have at least one non-cancelled session in last 90 days)
    const d90ago = new Date(now);
    d90ago.setDate(d90ago.getDate() - 90);

    const activeStudentIds = await this.sessionModel.distinct('studentId', {
      scheduledDate: { $gte: d90ago },
      status: { $nin: ['CANCELLED'] },
    });

    // Renewal orders
    const renewalOrders = await this.orderModel.countDocuments({
      orderType: 'RENEWAL',
      status: { $in: ['APPROVED', 'COMPLETED'] },
      createdAt: { $gte: d90ago },
    });

    // Students with expiring invoices (sessionsRemaining < 5)
    const atRisk = await this.invoiceModel.find({
      status: 'APPROVED',
      sessionsRemaining: { $gt: 0, $lt: 5 },
    })
      .populate('studentId', 'fullName studentCode parentName parentPhone')
      .populate('classId', 'name code')
      .populate('saleId', 'fullName')
      .lean();

    // Unique students at risk
    const atRiskMap = new Map();
    for (const inv of atRisk) {
      const sid = (inv as any).studentId?._id?.toString();
      if (!sid) continue;
      if (!atRiskMap.has(sid)) {
        atRiskMap.set(sid, {
          student: (inv as any).studentId,
          classes: [],
          totalRemaining: 0,
          saleInfo: (inv as any).saleId,
        });
      }
      const entry = atRiskMap.get(sid)!;
      entry.totalRemaining += (inv as any).sessionsRemaining || 0;
      entry.classes.push({
        className: (inv as any).classId?.name,
        sessionsRemaining: (inv as any).sessionsRemaining,
      });
    }

    const totalActive = activeStudentIds.length;
    const retentionRate = totalActive > 0 ? Math.round((renewalOrders / totalActive) * 100) : 0;

    return {
      totalActiveStudents: totalActive,
      renewalOrders,
      retentionRate: Math.min(retentionRate, 100),
      churnRate: Math.max(0, 100 - retentionRate),
      studentsAtRisk: Array.from(atRiskMap.values()),
      atRiskCount: atRiskMap.size,
    };
  }

  // ════════════════════════════════════════════════════════════════════
  // EMPLOYEE PERFORMANCE (Phase 3.5)
  // ════════════════════════════════════════════════════════════════════

  async getEmployeePerformance() {
    // Teachers performance
    const teachers = await this.userModel.find({ role: 'TEACHER', isLocked: { $ne: true } }).select('fullName email').lean();
    const teacherPerf: any[] = [];
    for (const t of teachers) {
      const sessions = await this.sessionModel.countDocuments({ teacherId: t._id, status: 'FINALIZED' });
      const sessionsWithReport = await this.sessionModel.countDocuments({
        teacherId: t._id,
        status: 'FINALIZED',
        'teachingReport.submittedAt': { $exists: true },
      });
      const reportRate = sessions > 0 ? Math.round((sessionsWithReport / sessions) * 100) : 0;

      // Avg parent rating from evaluations
      const rated = await this.sessionModel.find({
        teacherId: t._id,
        'parentFeedback.overallRating': { $exists: true },
      }).select('parentFeedback.overallRating').lean();
      const avgRating = rated.length > 0
        ? Math.round(rated.reduce((s, r: any) => s + (r.parentFeedback?.overallRating || 0), 0) / rated.length * 10) / 10
        : null;

      teacherPerf.push({
        _id: t._id,
        name: t.fullName,
        email: t.email,
        totalSessions: sessions,
        reportRate,
        avgRating,
      });
    }

    // Sales performance
    const sales = await this.userModel.find({ role: 'SALE', isLocked: { $ne: true } }).select('fullName email').lean();
    const salePerf: any[] = [];
    for (const s of sales) {
      const leads = await this.leadModel.countDocuments({ saleId: s._id });
      const converted = await this.leadModel.countDocuments({ saleId: s._id, status: 'CONVERTED' });
      const orders = await this.orderModel.find({ saleId: s._id, status: { $in: ['COMPLETED', 'APPROVED'] } }).lean();
      const revenue = orders.reduce((sum, o: any) => sum + (o.finalAmount || 0), 0);
      const commission = orders.reduce((sum, o: any) => sum + (o.saleCommission || 0), 0);

      salePerf.push({
        _id: s._id,
        name: s.fullName,
        email: s.email,
        totalLeads: leads,
        convertedLeads: converted,
        conversionRate: leads > 0 ? Math.round((converted / leads) * 100) : 0,
        revenue,
        commission,
      });
    }

    // OPS performance
    const ops = await this.userModel.find({ role: 'OPS', isLocked: { $ne: true } }).select('fullName email').lean();
    const opsPerf: any[] = [];
    for (const o of ops) {
      const tickets = await this.ticketModel.countDocuments({ assignedTo: o._id });
      const resolved = await this.ticketModel.countDocuments({
        assignedTo: o._id,
        status: { $in: [TicketStatus.RESOLVED, TicketStatus.CLOSED] },
      });

      opsPerf.push({
        _id: o._id,
        name: o.fullName,
        email: o.email,
        totalTickets: tickets,
        resolvedTickets: resolved,
        resolutionRate: tickets > 0 ? Math.round((resolved / tickets) * 100) : 0,
      });
    }

    return { teachers: teacherPerf, sales: salePerf, ops: opsPerf };
  }

  // ════════════════════════════════════════════════════════════════════
  // REVENUE FORECASTING (Phase 3.6)
  // ════════════════════════════════════════════════════════════════════

  async getRevenueForecast() {
    // Confirmed future revenue: active invoices × sessionsRemaining × pricePerSession
    const activeInvoices = await this.invoiceModel.find({
      status: 'APPROVED',
      sessionsRemaining: { $gt: 0 },
    }).lean();

    const confirmedRevenue = activeInvoices.reduce((sum, inv: any) => {
      return sum + ((inv.sessionsRemaining || 0) * (inv.pricePerSession || 0));
    }, 0);

    // Pipeline revenue: orders in SUBMITTED/APPROVED
    const pipelineOrders = await this.orderModel.find({
      status: { $in: ['SUBMITTED', 'APPROVED'] },
    }).lean();
    const pipelineRevenue = pipelineOrders.reduce((s, o: any) => s + (o.finalAmount || 0), 0);

    // Historical monthly revenue (last 6 months)
    const months: { month: string; revenue: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const start = new Date(d.getFullYear(), d.getMonth(), 1);
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);

      const monthInvoices = await this.invoiceModel.find({
        status: 'APPROVED',
        approvedAt: { $gte: start, $lte: end },
      }).lean();
      const rev = monthInvoices.reduce((s, inv: any) => s + (inv.amount || 0), 0);
      months.push({ month: start.toISOString().slice(0, 7), revenue: rev });
    }

    // Simple 3-month average growth rate
    const recentRevenues = months.slice(-3).map((m) => m.revenue);
    const avgRecent = recentRevenues.reduce((s, v) => s + v, 0) / 3;

    return {
      confirmedRevenue,
      pipelineRevenue,
      historicalMonths: months,
      monthlyAverage: Math.round(avgRecent),
      forecast3Month: Math.round(avgRecent * 3),
    };
  }
}
