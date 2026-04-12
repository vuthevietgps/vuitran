import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { Session, SessionDocument } from '../sessions/schemas/session.schema';
import { Wallet, WalletDocument } from '../wallets/schemas/wallet.schema';
import { Payroll, PayrollDocument } from '../payroll/schemas/payroll.schema';
import {
  PayrollTransaction,
  PayrollTransactionDocument,
  PayrollTransactionStatus,
} from '../payroll/schemas/payroll-transaction.schema';
import { Ticket, TicketDocument, TicketStatus } from '../tickets/schemas/ticket.schema';
import { TeacherProfile } from '../teachers/schemas/teacher-profile.schema';
import { Student, StudentDocument } from '../students/schemas/student.schema';
import { Classroom, ClassDocument } from '../classes/schemas/class.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { Invoice, InvoiceDocument } from '../invoices/schemas/invoice.schema';
import { Expense, ExpenseDocument } from '../expenses/schemas/expense.schema';
import { Order, OrderDocument } from '../orders/schemas/order.schema';
import { Lead, LeadDocument } from '../leads/schemas/lead.schema';
import { buildDateFilter } from './dashboard.utils';

@Injectable()
export class DashboardAnalyticsService {
  constructor(
    @InjectModel(Session.name) private sessionModel: Model<SessionDocument>,
    @InjectModel(Wallet.name) private walletModel: Model<WalletDocument>,
    @InjectModel(Payroll.name) private payrollModel: Model<PayrollDocument>,
    @InjectModel(PayrollTransaction.name) private payrollTransactionModel: Model<PayrollTransactionDocument>,
    @InjectModel(Ticket.name) private ticketModel: Model<TicketDocument>,
    @InjectModel(TeacherProfile.name) private teacherModel: Model<any>,
    @InjectModel(Student.name) private studentModel: Model<StudentDocument>,
    @InjectModel(Classroom.name) private classModel: Model<ClassDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Invoice.name) private invoiceModel: Model<InvoiceDocument>,
    @InjectModel(Expense.name) private expenseModel: Model<ExpenseDocument>,
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    @InjectModel(Lead.name) private leadModel: Model<LeadDocument>,
  ) {}

  // ════════════════════════════════════════════════════════════════════
  // STAFF LISTS — Danh sách nhân sự theo vai trò
  // ════════════════════════════════════════════════════════════════════

  async getStaffLists() {
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

    const summary: Record<string, number> = {};
    for (const role of staffRoles) {
      if (byRole[role]?.length) summary[role] = byRole[role].length;
    }

    return { summary, totalStaff: users.length, teachers, byRole };
  }

  // ════════════════════════════════════════════════════════════════════
  // BIRTHDAY PROMOTIONS
  // ════════════════════════════════════════════════════════════════════

  async getBirthdaysByMonth(month?: number) {
    const targetMonth = month || new Date().getMonth() + 1;

    const [studentBirthdays, parentBirthdays] = await Promise.all([
      this.studentModel.find({ studentBirthMonth: targetMonth })
        .select('studentCode fullName age studentBirthMonth parentName parentPhone').lean(),
      this.studentModel.find({ parentBirthMonth: targetMonth })
        .select('studentCode fullName parentName parentPhone parentBirthMonth').lean(),
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
  // KPI & TEACHER PERFORMANCE
  // ════════════════════════════════════════════════════════════════════

  async getTeacherKPI(fromDate?: string, toDate?: string) {
    const dateFilter = buildDateFilter(fromDate, toDate);
    const dateMatch = dateFilter.createdAt ? { createdAt: dateFilter.createdAt } : {};
    const scheduledDateMatch = dateFilter.createdAt ? { scheduledDate: dateFilter.createdAt } : {};

    const teachers = await this.teacherModel.find().populate('userId', 'fullName email phone status').lean();

    const [sessionAgg, reportAgg, evalAgg, feedbackAgg, classAgg, payrollAgg, payrollPenaltyAgg] = await Promise.all([
      this.sessionModel.aggregate([
        { $match: { ...scheduledDateMatch } },
        { $group: { _id: { teacherId: '$teacherId', status: '$status' }, count: { $sum: 1 }, totalRevenue: { $sum: '$amountCharged' }, totalPayout: { $sum: '$teacherPayout' } } },
      ]),
      this.sessionModel.aggregate([
        { $match: { hasTeachingReport: true, ...scheduledDateMatch } },
        { $group: { _id: '$teacherId', totalReports: { $sum: 1 }, lateReports: { $sum: { $cond: ['$teachingReport.isLateSubmission', 1, 0] } } } },
      ]),
      this.sessionModel.aggregate([
        { $match: { 'evaluation.studentPerformance': { $exists: true }, ...scheduledDateMatch } },
        { $group: { _id: '$teacherId', avgStudentPerformance: { $avg: '$evaluation.studentPerformance' }, avgStudentEngagement: { $avg: '$evaluation.studentEngagement' }, avgComprehension: { $avg: '$evaluation.comprehensionLevel' }, evalCount: { $sum: 1 } } },
      ]),
      this.sessionModel.aggregate([
        { $match: { 'parentFeedback.overallRating': { $exists: true }, ...scheduledDateMatch } },
        { $group: { _id: '$teacherId', avgOverallRating: { $avg: '$parentFeedback.overallRating' }, avgTeachingQuality: { $avg: '$parentFeedback.teachingQualityRating' }, avgCommunication: { $avg: '$parentFeedback.communicationRating' }, satisfiedCount: { $sum: { $cond: ['$parentFeedback.isSatisfied', 1, 0] } }, feedbackCount: { $sum: 1 } } },
      ]),
      this.classModel.aggregate([
        { $match: { status: 'ACTIVE' } },
        { $group: { _id: '$teacher', activeClasses: { $sum: 1 }, totalStudents: { $sum: { $size: { $ifNull: ['$students', []] } } } } },
      ]),
      this.payrollModel.aggregate([
        { $match: { status: 'PAID', ...dateMatch } },
        { $group: { _id: '$teacherId', totalPaid: { $sum: '$netAmount' }, payrollCount: { $sum: 1 } } },
      ]),
      this.payrollTransactionModel.aggregate([
        {
          $match: {
            ...scheduledDateMatch,
            status: { $ne: PayrollTransactionStatus.EXCLUDED },
          },
        },
        {
          $group: {
            _id: '$teacherId',
            totalPenalty: { $sum: { $ifNull: ['$penaltyAmount', 0] } },
            penaltySessionCount: {
              $sum: {
                $cond: [{ $gt: [{ $ifNull: ['$penaltyAmount', 0] }, 0] }, 1, 0],
              },
            },
          },
        },
      ]),
    ]);

    // Build maps for quick lookup
    const sessionMap = new Map<string, any>();
    for (const s of sessionAgg) {
      const tid = s._id.teacherId.toString();
      if (!sessionMap.has(tid)) {
        sessionMap.set(tid, { total: 0, completed: 0, cancelled: 0, noShow: 0, totalRevenue: 0, totalPayout: 0, byStatus: {} });
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
    for (const r of reportAgg) reportMap.set(r._id.toString(), { totalReports: r.totalReports, lateReports: r.lateReports });

    const evalMap = new Map<string, any>();
    for (const e of evalAgg) evalMap.set(e._id.toString(), {
      avgStudentPerformance: Math.round((e.avgStudentPerformance || 0) * 10) / 10,
      avgStudentEngagement: Math.round((e.avgStudentEngagement || 0) * 10) / 10,
      avgComprehension: Math.round((e.avgComprehension || 0) * 10) / 10,
      evalCount: e.evalCount,
    });

    const feedbackMap = new Map<string, any>();
    for (const f of feedbackAgg) feedbackMap.set(f._id.toString(), {
      avgOverallRating: Math.round((f.avgOverallRating || 0) * 10) / 10,
      avgTeachingQuality: Math.round((f.avgTeachingQuality || 0) * 10) / 10,
      avgCommunication: Math.round((f.avgCommunication || 0) * 10) / 10,
      satisfactionRate: f.feedbackCount > 0 ? Math.round((f.satisfiedCount / f.feedbackCount) * 100) : 0,
      feedbackCount: f.feedbackCount,
    });

    const classMap = new Map<string, any>();
    for (const c of classAgg) classMap.set(c._id.toString(), { activeClasses: c.activeClasses, totalStudents: c.totalStudents });

    const payrollMap = new Map<string, any>();
    for (const p of payrollAgg) payrollMap.set(p._id.toString(), { totalPaid: p.totalPaid, payrollCount: p.payrollCount });

    const penaltyMap = new Map<string, any>();
    for (const p of payrollPenaltyAgg) {
      penaltyMap.set(p._id.toString(), {
        totalPenalty: p.totalPenalty || 0,
        penaltySessionCount: p.penaltySessionCount || 0,
      });
    }

    const teacherKPIs = teachers.map((t: any) => {
      const userId = t.userId?._id?.toString() || t.userId?.toString();
      const sessions = sessionMap.get(userId) || { total: 0, completed: 0, cancelled: 0, noShow: 0, totalRevenue: 0, totalPayout: 0, byStatus: {} };
      const reports = reportMap.get(userId) || { totalReports: 0, lateReports: 0 };
      const evals = evalMap.get(userId) || { avgStudentPerformance: 0, avgStudentEngagement: 0, avgComprehension: 0, evalCount: 0 };
      const feedback = feedbackMap.get(userId) || { avgOverallRating: 0, avgTeachingQuality: 0, avgCommunication: 0, satisfactionRate: 0, feedbackCount: 0 };
      const classes = classMap.get(userId) || { activeClasses: 0, totalStudents: 0 };
      const payroll = {
        totalPaid: 0,
        payrollCount: 0,
        totalPenalty: 0,
        penaltySessionCount: 0,
        ...(payrollMap.get(userId) || {}),
        ...(penaltyMap.get(userId) || {}),
      };

      const completionRate = sessions.total > 0 ? Math.round((sessions.completed / sessions.total) * 100) : 0;
      const reportSubmissionRate = sessions.completed > 0 ? Math.round((reports.totalReports / sessions.completed) * 100) : 0;
      const onTimeReportRate = reports.totalReports > 0 ? Math.round(((reports.totalReports - reports.lateReports) / reports.totalReports) * 100) : 0;

      const kpiScore = Math.round(
        (completionRate * 0.25) + (reportSubmissionRate * 0.15) + (onTimeReportRate * 0.10) +
        ((feedback.avgOverallRating || 0) * 20 * 0.25) + ((evals.avgStudentPerformance || 0) * 20 * 0.15) +
        ((feedback.satisfactionRate || 0) * 0.10),
      );

      return {
        profileId: t._id, userId,
        fullName: t.userId?.fullName || 'N/A', email: t.userId?.email || '', phone: t.userId?.phone || '',
        teacherStatus: t.status, subjects: t.subjects, grades: t.grades,
        profileRating: t.rating, yearsOfExperience: t.yearsOfExperience,
        kpiScore: Math.min(kpiScore, 100),
        sessions: { total: sessions.total, completed: sessions.completed, cancelled: sessions.cancelled, noShow: sessions.noShow, completionRate, totalRevenue: sessions.totalRevenue, totalPayout: sessions.totalPayout },
        reports: { submitted: reports.totalReports, late: reports.lateReports, submissionRate: reportSubmissionRate, onTimeRate: onTimeReportRate },
        evaluation: evals, parentFeedback: feedback, classes, payroll,
      };
    });

    teacherKPIs.sort((a, b) => b.kpiScore - a.kpiScore);

    const totalTeachers = teacherKPIs.length;
    const activeTeachers = teacherKPIs.filter(t => t.teacherStatus === 'ACTIVE').length;
    const avgKPI = totalTeachers > 0 ? Math.round(teacherKPIs.reduce((sum, t) => sum + t.kpiScore, 0) / totalTeachers) : 0;
    const avgRating = totalTeachers > 0
      ? Math.round(teacherKPIs.reduce((sum, t) => sum + (t.parentFeedback.avgOverallRating || 0), 0) / totalTeachers * 10) / 10
      : 0;

    return {
      summary: {
        totalTeachers, activeTeachers, avgKPI, avgRating,
        kpiDistribution: {
          excellent: teacherKPIs.filter(t => t.kpiScore >= 80).length,
          good: teacherKPIs.filter(t => t.kpiScore >= 60 && t.kpiScore < 80).length,
          average: teacherKPIs.filter(t => t.kpiScore >= 40 && t.kpiScore < 60).length,
          belowAverage: teacherKPIs.filter(t => t.kpiScore < 40).length,
        },
      },
      teachers: teacherKPIs,
    };
  }

  // ════════════════════════════════════════════════════════════════════
  // CALENDAR OVERVIEW
  // ════════════════════════════════════════════════════════════════════

  async getCalendarOverview(month?: number, year?: number, teacherId?: string, classId?: string) {
    const now = new Date();
    const targetMonth = month || now.getMonth() + 1;
    const targetYear = year || now.getFullYear();
    const startDate = new Date(targetYear, targetMonth - 1, 1);
    const endDate = new Date(targetYear, targetMonth, 0, 23, 59, 59, 999);
    const teacherObjectId = this.toObjectId(teacherId);
    const classObjectId = this.toObjectId(classId);
    const sessionFilter: Record<string, unknown> = {
      scheduledDate: { $gte: startDate, $lte: endDate },
    };
    if (teacherObjectId) sessionFilter.teacherId = teacherObjectId;
    if (classObjectId) sessionFilter.classId = classObjectId;

    const sessions = await this.sessionModel
      .find(sessionFilter)
      .select('classId studentId teacherId status sessionType scheduledDate scheduledStartTime scheduledEndTime durationMinutes teacherPayout amountCharged hasTeachingReport')
      .populate('teacherId', 'fullName').populate('studentId', 'fullName studentCode').populate('classId', 'name code')
      .sort({ scheduledDate: 1 }).lean();

    const byDate: Record<string, any[]> = {};
    for (const s of sessions) {
      const dateKey = new Date(s.scheduledDate).toISOString().split('T')[0];
      if (!byDate[dateKey]) byDate[dateKey] = [];
      byDate[dateKey].push(s);
    }

    const sessionStatusAgg = await this.sessionModel.aggregate([
      { $match: sessionFilter },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);
    const byStatus: Record<string, number> = {};
    let totalSessions = 0;
    for (const s of sessionStatusAgg) { byStatus[s._id] = s.count; totalSessions += s.count; }

    const payrollFilter: Record<string, unknown> = {
      $or: [
        { periodStart: { $lte: endDate }, periodEnd: { $gte: startDate } },
        { createdAt: { $gte: startDate, $lte: endDate } },
      ],
    };
    if (teacherObjectId) payrollFilter.teacherId = teacherObjectId;
    if (classObjectId) payrollFilter.classId = classObjectId;

    const payrolls = await this.payrollModel.find(payrollFilter).select('teacherId classId status periodStart periodEnd netAmount grossAmount createdAt')
      .populate('teacherId', 'fullName').sort({ createdAt: -1 }).lean();

    const ticketFilter: Record<string, unknown> = {
      createdAt: { $gte: startDate, $lte: endDate },
    };
    if (teacherObjectId) ticketFilter.teacherId = teacherObjectId;
    if (classObjectId) ticketFilter.classId = classObjectId;

    const tickets = await this.ticketModel.find(ticketFilter)
      .select('ticketCode subject status priority createdAt dueDate classId teacherId')
      .populate('createdBy', 'fullName').sort({ createdAt: -1 }).lean();

    const events: any[] = [];
    for (const [dateStr, dateSessions] of Object.entries(byDate)) {
      for (const s of dateSessions) {
        events.push({
          date: dateStr, type: 'SESSION',
          title: `${(s as any).classId?.name || 'Lớp'} - ${(s as any).teacherId?.fullName || 'GV'}`,
          detail: `HS: ${(s as any).studentId?.fullName || 'N/A'}`,
          status: (s as any).status, time: (s as any).scheduledStartTime || null, _id: (s as any)._id,
        });
      }
    }
    for (const t of tickets) {
      const dueDate = (t as any).dueDate;
      if (dueDate) {
        events.push({
          date: new Date(dueDate).toISOString().split('T')[0], type: 'TICKET_DUE',
          title: `Ticket ${(t as any).ticketCode}`, detail: (t as any).subject,
          status: (t as any).status, priority: (t as any).priority, _id: (t as any)._id,
        });
      }
      events.push({
        date: new Date((t as any).createdAt).toISOString().split('T')[0], type: 'TICKET_CREATED',
        title: `Ticket mới: ${(t as any).ticketCode}`, detail: (t as any).subject,
        status: (t as any).status, priority: (t as any).priority, _id: (t as any)._id,
      });
    }
    for (const p of payrolls) {
      events.push({
        date: new Date((p as any).createdAt).toISOString().split('T')[0], type: 'PAYROLL',
        title: `Lương: ${(p as any).teacherId?.fullName || 'GV'}`,
        detail: `${(p as any).netAmount?.toLocaleString()}đ - ${(p as any).status}`,
        status: (p as any).status, _id: (p as any)._id,
      });
    }
    events.sort((a, b) => a.date.localeCompare(b.date));

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
      filters: {
        teacherId: teacherObjectId?.toString() || null,
        classId: classObjectId?.toString() || null,
      },
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
  // SALES DASHBOARD
  // ════════════════════════════════════════════════════════════════════

  async getSalesDashboard(saleId?: string, fromDate?: string, toDate?: string) {
    const dateFilter: any = {};
    if (fromDate) dateFilter.$gte = new Date(fromDate);
    if (toDate) dateFilter.$lte = new Date(toDate);
    const hasDateFilter = Object.keys(dateFilter).length > 0;

    const leadFilter: any = {};
    if (saleId) leadFilter.saleId = new Types.ObjectId(saleId);
    if (hasDateFilter) leadFilter.createdAt = dateFilter;

    const leads = await this.leadModel.find(leadFilter).lean();
    const totalLeads = leads.length;
    const convertedLeads = leads.filter((l: any) => l.status === 'CONVERTED').length;
    const conversionRate = totalLeads > 0 ? Math.round((convertedLeads / totalLeads) * 100) : 0;

    const leadsByStatus: Record<string, number> = {};
    for (const l of leads) { leadsByStatus[(l as any).status] = (leadsByStatus[(l as any).status] || 0) + 1; }

    const activeLeads = leads.filter((l: any) => !['CONVERTED', 'NOT_INTERESTED', 'NO_RESPONSE'].includes(l.status)).length;

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);

    const followUpsDueToday = leads.filter(
      (l: any) => l.nextFollowUp && new Date(l.nextFollowUp) >= today && new Date(l.nextFollowUp) < tomorrow,
    );
    const followUpsOverdue = leads.filter(
      (l: any) => l.nextFollowUp && new Date(l.nextFollowUp) < today &&
        !['CONVERTED', 'NOT_INTERESTED', 'NO_RESPONSE'].includes(l.status),
    );

    const orderFilter: any = {};
    if (saleId) orderFilter.saleId = new Types.ObjectId(saleId);
    if (hasDateFilter) orderFilter.createdAt = dateFilter;

    const orders = await this.orderModel.find(orderFilter).lean();
    const revenueGenerated = orders.filter((o: any) => o.status === 'COMPLETED').reduce((sum, o: any) => sum + (o.finalAmount || 0), 0);
    const commissionEarned = orders.filter((o: any) => o.status === 'COMPLETED').reduce((sum, o: any) => sum + (o.saleCommission || 0), 0);
    const commissionPending = orders.filter((o: any) => o.status === 'APPROVED').reduce((sum, o: any) => sum + (o.saleCommission || 0), 0);

    const ordersByStatus: Record<string, number> = {};
    for (const o of orders) { ordersByStatus[(o as any).status] = (ordersByStatus[(o as any).status] || 0) + 1; }

    const recentOrders = orders
      .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 10)
      .map((o: any) => ({
        _id: o._id, orderCode: o.orderCode, parentName: o.parentName, studentName: o.studentName,
        finalAmount: o.finalAmount, saleCommission: o.saleCommission, status: o.status, createdAt: o.createdAt,
      }));

    return {
      leads: {
        total: totalLeads, converted: convertedLeads, conversionRate, active: activeLeads, byStatus: leadsByStatus,
        followUpsDueToday: followUpsDueToday.map((l: any) => ({
          _id: l._id, leadCode: l.leadCode, parentName: l.parentName, parentPhone: l.parentPhone, status: l.status, nextFollowUp: l.nextFollowUp,
        })),
        followUpsOverdue: followUpsOverdue.length,
      },
      orders: { total: orders.length, byStatus: ordersByStatus, revenueGenerated, commissionEarned, commissionPending, recentOrders },
    };
  }

  // ════════════════════════════════════════════════════════════════════
  // REVENUE & PROFIT REPORTS
  // ════════════════════════════════════════════════════════════════════

  async getRevenueReport(period: 'monthly' | 'quarterly' | 'yearly' = 'monthly', fromDate?: string, toDate?: string) {
    const dateFilter: any = {};
    if (fromDate) dateFilter.$gte = new Date(fromDate);
    if (toDate) dateFilter.$lte = new Date(toDate);
    const hasDate = Object.keys(dateFilter).length > 0;

    const invoiceFilter: any = { status: 'APPROVED' };
    if (hasDate) invoiceFilter.approvedAt = dateFilter;
    const invoices = await this.invoiceModel.find(invoiceFilter).lean();

    const expenseFilter: any = { paymentStatus: 'PAID' };
    if (hasDate) expenseFilter.paidAt = dateFilter;
    const expenses = await this.expenseModel.find(expenseFilter).lean();

    const payrollFilter: any = { status: 'PAID' };
    if (hasDate) payrollFilter.paidAt = dateFilter;
    const payrolls = await this.payrollModel.find(payrollFilter).lean();

    const getKey = (date: Date): string => {
      const d = new Date(date);
      if (period === 'yearly') return d.getFullYear().toString();
      if (period === 'quarterly') return `${d.getFullYear()}-Q${Math.ceil((d.getMonth() + 1) / 3)}`;
      return d.toISOString().slice(0, 7);
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

    const periods = Object.entries(periodData).map(([key, data]) => {
      const profit = data.revenue - data.expenses - data.payroll;
      const margin = data.revenue > 0 ? Math.round((profit / data.revenue) * 100) : 0;
      return { period: key, ...data, profit, margin };
    }).sort((a, b) => a.period.localeCompare(b.period));

    const totalRevenue = periods.reduce((s, p) => s + p.revenue, 0);
    const totalExpenses = periods.reduce((s, p) => s + p.expenses, 0);
    const totalPayroll = periods.reduce((s, p) => s + p.payroll, 0);
    const totalProfit = totalRevenue - totalExpenses - totalPayroll;

    return {
      periods,
      summary: { totalRevenue, totalExpenses, totalPayroll, totalProfit, overallMargin: totalRevenue > 0 ? Math.round((totalProfit / totalRevenue) * 100) : 0 },
    };
  }

  // ════════════════════════════════════════════════════════════════════
  // STUDENT RETENTION
  // ════════════════════════════════════════════════════════════════════

  async getRetentionMetrics() {
    const now = new Date();
    const d90ago = new Date(now); d90ago.setDate(d90ago.getDate() - 90);

    const activeStudentIds = await this.sessionModel.distinct('studentId', {
      scheduledDate: { $gte: d90ago }, status: { $nin: ['CANCELLED'] },
    });

    const renewalOrders = await this.orderModel.countDocuments({
      orderType: 'RENEWAL', status: { $in: ['APPROVED', 'COMPLETED'] }, createdAt: { $gte: d90ago },
    });

    const atRisk = await this.invoiceModel.find({ status: 'APPROVED', sessionsRemaining: { $gt: 0, $lt: 5 } })
      .populate('studentId', 'fullName studentCode parentName parentPhone')
      .populate('classId', 'name code').populate('saleId', 'fullName').lean();

    const atRiskMap = new Map();
    for (const inv of atRisk) {
      const sid = (inv as any).studentId?._id?.toString();
      if (!sid) continue;
      if (!atRiskMap.has(sid)) {
        atRiskMap.set(sid, { student: (inv as any).studentId, classes: [], totalRemaining: 0, saleInfo: (inv as any).saleId });
      }
      const entry = atRiskMap.get(sid)!;
      entry.totalRemaining += (inv as any).sessionsRemaining || 0;
      entry.classes.push({ className: (inv as any).classId?.name, sessionsRemaining: (inv as any).sessionsRemaining });
    }

    const totalActive = activeStudentIds.length;
    const retentionRate = totalActive > 0 ? Math.round((renewalOrders / totalActive) * 100) : 0;

    return {
      totalActiveStudents: totalActive, renewalOrders,
      retentionRate: Math.min(retentionRate, 100), churnRate: Math.max(0, 100 - retentionRate),
      studentsAtRisk: Array.from(atRiskMap.values()), atRiskCount: atRiskMap.size,
    };
  }

  // ════════════════════════════════════════════════════════════════════
  // EMPLOYEE PERFORMANCE
  // ════════════════════════════════════════════════════════════════════

  async getEmployeePerformance() {
    const teachers = await this.userModel.find({ role: 'TEACHER', isLocked: { $ne: true } }).select('fullName email').lean();
    const teacherPerf: any[] = [];
    for (const t of teachers) {
      const sessions = await this.sessionModel.countDocuments({ teacherId: t._id, status: 'FINALIZED' });
      const sessionsWithReport = await this.sessionModel.countDocuments({
        teacherId: t._id, status: 'FINALIZED', 'teachingReport.submittedAt': { $exists: true },
      });
      const reportRate = sessions > 0 ? Math.round((sessionsWithReport / sessions) * 100) : 0;
      const rated = await this.sessionModel.find({
        teacherId: t._id, 'parentFeedback.overallRating': { $exists: true },
      }).select('parentFeedback.overallRating').lean();
      const avgRating = rated.length > 0
        ? Math.round(rated.reduce((s, r: any) => s + (r.parentFeedback?.overallRating || 0), 0) / rated.length * 10) / 10
        : null;
      teacherPerf.push({ _id: t._id, name: t.fullName, email: t.email, totalSessions: sessions, reportRate, avgRating });
    }

    const sales = await this.userModel.find({ role: 'SALE', isLocked: { $ne: true } }).select('fullName email').lean();
    const salePerf: any[] = [];
    for (const s of sales) {
      const leads = await this.leadModel.countDocuments({ saleId: s._id });
      const converted = await this.leadModel.countDocuments({ saleId: s._id, status: 'CONVERTED' });
      const orders = await this.orderModel.find({ saleId: s._id, status: { $in: ['COMPLETED', 'APPROVED'] } }).lean();
      const revenue = orders.reduce((sum, o: any) => sum + (o.finalAmount || 0), 0);
      const commission = orders.reduce((sum, o: any) => sum + (o.saleCommission || 0), 0);
      salePerf.push({
        _id: s._id, name: s.fullName, email: s.email, totalLeads: leads, convertedLeads: converted,
        conversionRate: leads > 0 ? Math.round((converted / leads) * 100) : 0, revenue, commission,
      });
    }

    const ops = await this.userModel.find({ role: 'OPS', isLocked: { $ne: true } }).select('fullName email').lean();
    const opsPerf: any[] = [];
    for (const o of ops) {
      const tickets = await this.ticketModel.countDocuments({ assignedTo: o._id });
      const resolved = await this.ticketModel.countDocuments({
        assignedTo: o._id, status: { $in: [TicketStatus.RESOLVED, TicketStatus.CLOSED] },
      });
      opsPerf.push({
        _id: o._id, name: o.fullName, email: o.email, totalTickets: tickets, resolvedTickets: resolved,
        resolutionRate: tickets > 0 ? Math.round((resolved / tickets) * 100) : 0,
      });
    }

    return { teachers: teacherPerf, sales: salePerf, ops: opsPerf };
  }

  // ════════════════════════════════════════════════════════════════════
  // REVENUE FORECASTING
  // ════════════════════════════════════════════════════════════════════

  async getRevenueForecast() {
    const activeInvoices = await this.invoiceModel.find({ status: 'APPROVED', sessionsRemaining: { $gt: 0 } }).lean();
    const confirmedRevenue = activeInvoices.reduce((sum, inv: any) => sum + ((inv.sessionsRemaining || 0) * (inv.pricePerSession || 0)), 0);

    const pipelineOrders = await this.orderModel.find({ status: { $in: ['SUBMITTED', 'APPROVED'] } }).lean();
    const pipelineRevenue = pipelineOrders.reduce((s, o: any) => s + (o.finalAmount || 0), 0);

    const months: { month: string; revenue: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(); d.setMonth(d.getMonth() - i);
      const start = new Date(d.getFullYear(), d.getMonth(), 1);
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      const monthInvoices = await this.invoiceModel.find({ status: 'APPROVED', approvedAt: { $gte: start, $lte: end } }).lean();
      const rev = monthInvoices.reduce((s, inv: any) => s + (inv.amount || 0), 0);
      months.push({ month: start.toISOString().slice(0, 7), revenue: rev });
    }

    const recentRevenues = months.slice(-3).map((m) => m.revenue);
    const avgRecent = recentRevenues.reduce((s, v) => s + v, 0) / 3;

    return {
      confirmedRevenue, pipelineRevenue, historicalMonths: months,
      monthlyAverage: Math.round(avgRecent), forecast3Month: Math.round(avgRecent * 3),
    };
  }

  private toObjectId(value?: string): Types.ObjectId | null {
    if (!value || !Types.ObjectId.isValid(value)) return null;
    return new Types.ObjectId(value);
  }
}
