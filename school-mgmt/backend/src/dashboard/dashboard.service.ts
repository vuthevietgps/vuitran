import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { Session, SessionDocument } from '../sessions/schemas/session.schema';
import { Wallet, WalletDocument } from '../wallets/schemas/wallet.schema';
import { LedgerEntry, LedgerEntryDocument, TransactionType, TransactionStatus } from '../wallets/schemas/ledger-entry.schema';
import { Payroll, PayrollDocument, PayrollStatus } from '../payroll/schemas/payroll.schema';
import { Ticket, TicketDocument, TicketStatus, TicketPriority } from '../tickets/schemas/ticket.schema';
import { TeacherProfile } from '../teachers/schemas/teacher-profile.schema';
import { Student, StudentDocument } from '../students/schemas/student.schema';
import { Classroom, ClassDocument } from '../classes/schemas/class.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { Invoice, InvoiceDocument } from '../invoices/schemas/invoice.schema';
import { Attendance, AttendanceDocument } from '../attendance/schemas/attendance.schema';
import { Expense, ExpenseDocument, PaymentStatus as ExpensePaymentStatus } from '../expenses/schemas/expense.schema';
import { Order, OrderDocument } from '../orders/schemas/order.schema';
import { Lead, LeadDocument } from '../leads/schemas/lead.schema';

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

// ─── Service ────────────────────────────────────────────────────────

@Injectable()
export class DashboardService {
  constructor(
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
