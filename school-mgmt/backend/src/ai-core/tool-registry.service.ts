import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ClassesService } from '../classes/classes.service';
import { DashboardService } from '../dashboard/dashboard.service';
import { PendingApprovalsService } from '../pending-approvals/pending-approvals.service';
import { FinancialControlService } from '../financial-control/financial-control.service';
import { AdsAnalyticsService } from '../ads/ads-analytics.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { Role } from '../common/interfaces/role.enum';
import { InvoicesService } from '../invoices/invoices.service';
import { LeadsService } from '../leads/leads.service';
import { MessagesService } from '../messages/messages.service';
import { StudentSupportSnapshotService } from '../messages/student-support-snapshot.service';
import { OrdersService } from '../orders/orders.service';
import { SessionsService } from '../sessions/sessions.service';
import { StudentsService } from '../students/students.service';
import { Student, StudentDocument } from '../students/schemas/student.schema';
import { TicketsService } from '../tickets/tickets.service';
import { QuizzesService } from '../quizzes/quizzes.service';
import { TeachingMaterialsService } from '../teaching-materials/teaching-materials.service';
import { TrialEnrollmentsService } from '../trial-enrollments/trial-enrollments.service';
import { AttendanceService } from '../attendance/attendance.service';
import { WorkSessionsService } from '../work-sessions/work-sessions.service';
import { TeachersService } from '../teachers/teachers.service';
import { TeacherStatus } from '../teachers/schemas/teacher-profile.schema';
import { WalletsService } from '../wallets/wallets.service';
import { PayrollService } from '../payroll/payroll.service';
import { StaffPayrollService } from '../staff-payroll/staff-payroll.service';
import { ExpensesService } from '../expenses/expenses.service';
import { LoansService } from '../loans/loans.service';
import { ChatbotService } from '../chatbot/chatbot.service';
import { ConversationStatus } from '../chatbot/schemas/conversation.schema';
import { OrderStatus } from '../orders/schemas/order.schema';
import { TrialEnrollmentStatus } from '../trial-enrollments/schemas/trial-enrollment.schema';
import { getAiCoreToolCatalog, getAiCoreToolDefinition } from './catalogs/tool.catalog';
import { AiAuthContext, AiCoreRiskLevel, AiEntityType, AiToolInput, AiToolResult } from './ai-core.types';
import { AiEntityResolverService } from './entity-resolver.service';

@Injectable()
export class AiToolRegistryService {
  constructor(
    private readonly dashboardService: DashboardService,
    private readonly pendingApprovalsService: PendingApprovalsService,
    private readonly financialControlService: FinancialControlService,
    private readonly adsAnalyticsService: AdsAnalyticsService,
    private readonly auditLogService: AuditLogService,
    private readonly classesService: ClassesService,
    private readonly invoicesService: InvoicesService,
    private readonly leadsService: LeadsService,
    private readonly messagesService: MessagesService,
    private readonly studentSupportSnapshotService: StudentSupportSnapshotService,
    private readonly ordersService: OrdersService,
    private readonly sessionsService: SessionsService,
    private readonly studentsService: StudentsService,
    private readonly ticketsService: TicketsService,
    private readonly quizzesService: QuizzesService,
    private readonly teachingMaterialsService: TeachingMaterialsService,
    private readonly trialEnrollmentsService: TrialEnrollmentsService,
    private readonly attendanceService: AttendanceService,
    private readonly workSessionsService: WorkSessionsService,
    private readonly teachersService: TeachersService,
    private readonly walletsService: WalletsService,
    private readonly payrollService: PayrollService,
    private readonly staffPayrollService: StaffPayrollService,
    private readonly expensesService: ExpensesService,
    private readonly loansService: LoansService,
    private readonly chatbotService: ChatbotService,
    private readonly entityResolver: AiEntityResolverService,
    @InjectModel(Student.name) private readonly studentModel: Model<StudentDocument>,
  ) {}

  listTools() {
    return getAiCoreToolCatalog();
  }

  getTool(key: string) {
    const tool = getAiCoreToolDefinition(key);
    if (!tool) {
      throw new NotFoundException(`AI tool khong ton tai: ${key}`);
    }
    return tool;
  }

  async execute(key: string, input: AiToolInput, auth: AiAuthContext): Promise<AiToolResult> {
    const tool = this.getTool(key);
    const data = await this.runTool(key, input, auth);
    return {
      key,
      label: tool.label,
      sourceRoute: tool.route,
      data,
      metadata: this.buildToolMetadata(data),
    };
  }

  private runTool(key: string, input: AiToolInput, auth: AiAuthContext): Promise<unknown> | unknown {
    const { user } = auth;
    const fromDate = input.fromDate;
    const toDate = input.toDate;

    switch (key) {
      case 'daily_tasks':
        return this.dashboardService.getDailyTasks(user.role, user.sub);
      case 'pending_approvals_summary':
        return this.pendingApprovalsService.getSummary();
      case 'pending_approval_payrolls':
        return this.getLimitedPendingApprovalList(() => this.pendingApprovalsService.getPendingPayrolls());
      case 'pending_approval_invoices':
        return this.getLimitedPendingApprovalList(() => this.pendingApprovalsService.getPendingInvoices());
      case 'pending_approval_topups':
        return this.getLimitedPendingApprovalList(() => this.pendingApprovalsService.getPendingTopUps());
      case 'pending_approval_teachers':
        return this.getLimitedPendingApprovalList(() => this.pendingApprovalsService.getPendingTeachers());
      case 'pending_approval_classes':
        return this.getLimitedPendingApprovalList(() => this.pendingApprovalsService.getPendingClassUpdates());
      case 'pending_approval_session_changes':
        return this.getLimitedPendingApprovalList(() => this.pendingApprovalsService.getPendingSessionChanges());
      case 'director_dashboard':
        return this.dashboardService.getDirectorDashboard(fromDate, toDate);
      case 'accounting_dashboard':
        return this.dashboardService.getAccountingDashboard(fromDate, toDate);
      case 'ops_dashboard':
        return this.dashboardService.getOpsDashboard(user.sub);
      case 'ops_deep_sla_packet':
        return this.getOpsDeepSlaPacket(input, user);
      case 'teacher_dashboard':
        return this.dashboardService.getTeacherDashboard(user.sub);
      case 'teacher_upcoming_sessions': {
        const today = this.todayDateOnly();
        const upcomingToDate = toDate && toDate > today ? toDate : this.addDaysDateOnly(today, 7);
        return this.sessionsService.findAll({
          fromDate: today,
          toDate: upcomingToDate,
          status: 'SCHEDULED',
          limit: '20',
          sort: 'scheduledDate',
        } as any, user);
      }
      case 'teacher_my_sessions':
        return this.sessionsService.findAll({
          fromDate,
          toDate,
          limit: '20',
          sort: 'scheduledDate',
        } as any, user);
      case 'teacher_pending_reports':
        return this.sessionsService.findAll({
          fromDate,
          toDate,
          hasReport: 'false',
          limit: '20',
          sort: 'scheduledDate',
        } as any, user);
      case 'teacher_completed_reports':
        return this.sessionsService.findAll({
          fromDate,
          toDate,
          hasReport: 'true',
          limit: '20',
          sort: '-scheduledDate',
        } as any, user);
      case 'teacher_attendance_classes':
        return this.attendanceService.getAttendanceReportClasses(
          user,
          input.filters?.search as string | undefined,
          this.normalizeLimit(input.filters?.limit, 20),
        );
      case 'teacher_attendance_report':
        return this.attendanceService.getAttendanceReport(
          fromDate || this.todayDateOnly(),
          toDate || this.todayDateOnly(),
          input.filters?.classId as string | undefined,
          user,
          1,
          this.normalizeLimit(input.filters?.limit, 20),
        );
      case 'teacher_materials':
        return this.teachingMaterialsService.findAll(user, this.getTeachingMaterialFilters(input, 18));
      case 'teacher_material_stats':
        return this.teachingMaterialsService.getStats(user);
      case 'teacher_my_tickets':
        return this.ticketsService.findMyTickets(user.sub, {
          fromDate,
          toDate,
          status: input.filters?.status as any,
          type: input.filters?.type as any,
          priority: input.filters?.priority as any,
          overdue: input.filters?.overdue as string | undefined,
          page: 1,
          limit: this.normalizeLimit(input.filters?.limit, 20),
          sort: '-createdAt',
        } as any);
      case 'teacher_messages_unread':
        return this.messagesService.getUnreadCount(user.sub);
      case 'teacher_conversations':
        return this.getLimitedList(
          this.messagesService.listConversations(user.sub),
          this.normalizeLimit(input.filters?.limit, 20),
        );
      case 'teacher_payrolls':
        return this.payrollService.findAll({
          fromDate,
          toDate,
          teacherId: user.sub,
          status: input.filters?.status as any,
          page: 1,
          limit: this.normalizeLimit(input.filters?.limit, 12),
          sort: '-createdAt',
        } as any);
      case 'homework_grading_queue':
        return this.sessionsService.listHomeworkForGrading({
          status: String(input.filters?.status || 'pending'),
          limit: String(input.filters?.limit || 30),
        }, user);
      case 'quiz_grading_queue':
        return this.quizzesService.listAttemptsForGrading({
          status: String(input.filters?.status || 'pending'),
          limit: String(input.filters?.limit || 30),
        }, user);
      case 'quiz_attempt_detail':
        return this.getQuizAttemptDetail(input, user);
      case 'teaching_materials_search':
        return this.teachingMaterialsService.findAll(user, this.getTeachingMaterialFilters(input, 12));
      case 'teaching_material_chunks_search':
        return this.teachingMaterialsService.searchKnowledgeChunks(user, this.getTeachingMaterialFilters(input, 8));
      case 'teaching_material_detail':
        return this.getTeachingMaterialDetail(input, user);
      case 'parent_dashboard':
        return this.dashboardService.getParentDashboard(user.sub);
      case 'parent_success_packet':
        return this.getParentSuccessPacket(input, user);
      case 'accounting_invoices':
        return this.getAccountingInvoices(user);
      case 'accounting_pending_invoices':
        return this.invoicesService.findPendingApproval();
      case 'accounting_my_tickets':
        return this.ticketsService.findMyTickets(user.sub, {
          fromDate,
          toDate,
          page: 1,
          limit: 20,
          sort: '-createdAt',
        } as any);
      case 'accounting_pending_topups':
        return this.getLimitedList(this.walletsService.getPendingTopUps(), 30);
      case 'accounting_wallets':
        return this.walletsService.getAllWallets(
          1,
          this.normalizeLimit(input.filters?.limit, 30),
          input.filters?.search as string | undefined,
          input.filters?.status as string | undefined,
        );
      case 'accounting_ledger':
        return this.walletsService.queryLedger({
          fromDate,
          toDate,
          page: 1,
          limit: this.normalizeLimit(input.filters?.limit, 30),
          sort: '-createdAt',
          userId: input.filters?.userId as string | undefined,
          walletId: input.filters?.walletId as string | undefined,
          type: input.filters?.type as any,
          status: input.filters?.status as any,
        } as any);
      case 'accounting_wallet_financial_summary':
        return this.walletsService.getFinancialSummary(fromDate, toDate);
      case 'accounting_payroll_summary':
        return this.payrollService.getPayrollSummary();
      case 'accounting_payrolls':
        return this.payrollService.findAll({
          fromDate,
          toDate,
          status: input.filters?.status as any,
          teacherId: input.filters?.teacherId as string | undefined,
          page: 1,
          limit: this.normalizeLimit(input.filters?.limit, 30),
          sort: '-createdAt',
        } as any);
      case 'accounting_staff_payroll_summary':
        return this.staffPayrollService.getSummary();
      case 'accounting_staff_payrolls':
        return this.staffPayrollService.findAll({
          fromDate,
          toDate,
          status: input.filters?.status as any,
          userId: input.filters?.userId as string | undefined,
          page: 1,
          limit: this.normalizeLimit(input.filters?.limit, 30),
        });
      case 'accounting_expense_stats':
        return this.expensesService.getStats(fromDate, toDate);
      case 'accounting_expenses':
        return this.expensesService.findAll({
          startDate: fromDate,
          endDate: toDate,
          category: input.filters?.category as string | undefined,
          paymentStatus: input.filters?.paymentStatus as string | undefined,
          keyword: input.filters?.keyword as string | undefined,
          page: 1,
          limit: this.normalizeLimit(input.filters?.limit, 30),
        } as any);
      case 'accounting_loan_summary':
        return this.loansService.getLoanSummary();
      case 'accounting_loans':
        return this.getLimitedList(
          this.loansService.findAll({
            status: input.filters?.status as string | undefined,
            lenderType: input.filters?.lenderType as string | undefined,
            loanType: input.filters?.loanType as string | undefined,
            keyword: input.filters?.keyword as string | undefined,
          }),
          30,
        );
      case 'accounting_loan_payments_due':
        return this.getAccountingLoanPaymentsDue(input);
      case 'accounting_bank_accounts_summary':
        return this.financialControlService.getBankAccountSummary();
      case 'accounting_bank_transactions':
        return this.getLimitedList(
          this.financialControlService.findBankTransactions({
            startDate: fromDate,
            endDate: toDate,
            bankAccountId: input.filters?.bankAccountId as string | undefined,
            type: input.filters?.type as string | undefined,
            category: input.filters?.category as string | undefined,
            keyword: input.filters?.keyword as string | undefined,
          } as any),
          30,
        );
      case 'accounting_funds_summary':
        return this.financialControlService.getFundsSummary();
      case 'accounting_fund_transactions':
        return this.getLimitedList(
          this.financialControlService.findFundTransactions({
            startDate: fromDate,
            endDate: toDate,
            fundId: input.filters?.fundId as string | undefined,
            type: input.filters?.type as string | undefined,
          } as any),
          30,
        );
      case 'accounting_bank_reconciliation':
        return this.getAccountingBankReconciliation(input);
      case 'ops_classes':
        return this.classesService.findAll(user);
      case 'ops_sessions':
        return this.sessionsService.findAll({
          fromDate,
          toDate,
          page: 1,
          limit: 30,
          sort: '-scheduledDate',
        } as any, user);
      case 'ops_open_tickets':
        return this.ticketsService.findAll({
          status: String(input.filters?.status || 'OPEN'),
          page: 1,
          limit: 30,
          sort: '-createdAt',
        } as any);
      case 'ops_assigned_tickets':
        return this.ticketsService.findAll({
          fromDate,
          toDate,
          assignedTo: user.sub,
          page: 1,
          limit: 30,
          sort: '-createdAt',
        } as any);
      case 'ops_attendance_report':
        return this.attendanceService.getAttendanceReport(
          fromDate || this.todayDateOnly(),
          toDate || this.todayDateOnly(),
          input.filters?.classId as string | undefined,
          user,
          1,
          30,
        );
      case 'ops_attendance_classes':
        return this.attendanceService.getAttendanceReportClasses(
          user,
          input.filters?.search as string | undefined,
          this.normalizeLimit(input.filters?.limit, 30),
        );
      case 'ops_trial_summary':
        return this.trialEnrollmentsService.getSummary(user);
      case 'ops_trial_enrollments':
        return this.trialEnrollmentsService.findAll({
          fromDate,
          toDate,
          page: 1,
          limit: 30,
          needsDecision: String(input.filters?.needsDecision || ''),
          status: input.filters?.status as any,
          search: input.filters?.search as string | undefined,
        } as any, user);
      case 'ops_trial_available_slots':
        return this.trialEnrollmentsService.getAvailableSlots({
          fromDate: fromDate || this.todayDateOnly(),
          toDate,
          preferredStart: input.filters?.preferredStart as string | undefined,
          preferredEnd: input.filters?.preferredEnd as string | undefined,
          experienceTeacherId: input.filters?.experienceTeacherId as string | undefined,
          limit: this.normalizeLimit(input.filters?.limit, 20),
        } as any, user);
      case 'ops_work_sessions':
        return this.workSessionsService.findAll({
          fromDate: fromDate || this.currentMonthStartDateOnly(),
          toDate: toDate || this.todayDateOnly(),
          status: input.filters?.status as any,
          search: input.filters?.search as string | undefined,
          page: 1,
          limit: this.normalizeLimit(input.filters?.limit, 30),
        } as any);
      case 'ops_work_sessions_summary':
        return this.getWorkSessionsMonthlySummary(input);
      case 'ops_teacher_suggestions':
        return this.classesService.suggestTeachers({
          subject: input.filters?.subject as string | undefined,
          grade: input.filters?.grade as string | undefined,
          teachingMode: input.filters?.teachingMode as string | undefined,
        });
      case 'ops_teachers':
        return this.getOpsTeachers(input, user);
      case 'ops_teacher_stats':
        return this.teachersService.getStats();
      case 'ops_pending_students':
        return this.getLimitedList(this.studentsService.findPendingApproval());
      case 'parent_my_students':
        return this.studentsService.findAll(user);
      case 'parent_my_sessions':
        return this.sessionsService.findAll({
          fromDate,
          toDate,
          parentUserId: user.sub,
          page: 1,
          limit: 30,
          sort: '-scheduledDate',
        } as any, user);
      case 'parent_children_progress':
        return this.sessionsService.getChildrenProgress(user.sub);
      case 'parent_invoices':
        return this.invoicesService.getParentInvoices(user.sub);
      case 'parent_wallet_summary':
        return this.walletsService.getOrCreateWalletView(user.sub);
      case 'parent_wallet_ledger':
        return this.walletsService.queryLedger({
          fromDate,
          toDate,
          page: 1,
          limit: this.normalizeLimit(input.filters?.limit, 20),
          sort: '-createdAt',
          userId: user.sub,
          type: input.filters?.type as any,
          status: input.filters?.status as any,
        } as any);
      case 'parent_attendance_summary':
        return this.getParentAttendanceSummary(input, user);
      case 'parent_my_tickets':
        return this.ticketsService.findMyTickets(user.sub, {
          fromDate,
          toDate,
          page: 1,
          limit: 20,
          sort: '-createdAt',
        } as any);
      case 'student_learning_snapshot':
        return this.getStudentLearningSnapshot(user);
      case 'ads_analytics_overview':
        return this.adsAnalyticsService.getAnalytics(
          fromDate || this.currentMonthStartDateOnly(),
          toDate || this.todayDateOnly(),
          input.filters?.adGroupId as string | undefined,
          input.filters?.platform as string | undefined,
        );
      case 'shareholder_investor_metrics':
        return this.financialControlService.getInvestorMetrics(input.filters?.monthCount as string | undefined);
      case 'sales_dashboard':
        return this.dashboardService.getSalesDashboard(
          user.role === Role.SALE ? user.sub : undefined,
          fromDate,
          toDate,
        );
      case 'sale_followups_due':
        return this.getSaleFollowUpsDue(user);
      case 'sale_lead_pipeline':
        return this.leadsService.getPipeline(user);
      case 'sale_my_leads':
        return this.getSaleLeadList(input, user);
      case 'sale_order_pipeline':
        return this.ordersService.getPipeline(user);
      case 'sale_my_orders':
        return this.ordersService.findAll({
          fromDate,
          toDate,
          page: 1,
          limit: 30,
        } as any, user);
      case 'sale_commission_report':
        return this.ordersService.getCommissionReport(
          user.role === Role.SALE ? user.sub : undefined,
          fromDate,
          toDate,
        );
      case 'sale_next_best_actions':
        return this.getSaleNextBestActions(input, user);
      case 'sale_conversations':
        return this.getSaleConversations(input, user);
      case 'sale_trial_enrollments':
        return this.trialEnrollmentsService.findAll({
          fromDate,
          toDate,
          page: 1,
          limit: 30,
          needsDecision: String(input.filters?.needsDecision || ''),
        } as any, user);
      case 'sale_trial_summary':
        return this.trialEnrollmentsService.getSummary(user);
      case 'financial_overview':
        return this.financialControlService.getFinancialOverview(fromDate, toDate);
      case 'financial_alerts':
        return this.financialControlService.getFinancialAlerts();
      case 'profit_and_loss':
        return this.financialControlService.getProfitAndLoss(fromDate, toDate);
      case 'cash_flow':
        return this.financialControlService.getCashFlow({
          startDate: fromDate,
          endDate: toDate,
          groupBy: 'week',
          basis: 'cash',
        } as any);
      case 'aging_report':
        return this.financialControlService.getAgingReport(user);
      case 'ads_actions_required':
        return this.adsAnalyticsService.getActionsRequired();
      case 'audit_stats':
        return this.auditLogService.getStats();
      case 'retention':
        return this.dashboardService.getRetentionMetrics();
      case 'forecast':
        return this.dashboardService.getRevenueForecast();
      case 'user_detail':
        return this.getEntityDetail(input, auth, [AiEntityType.USER, AiEntityType.PARENT, AiEntityType.TEACHER]);
      case 'student_detail':
        return this.getEntityDetail(input, auth, [AiEntityType.STUDENT]);
      case 'class_detail':
        return this.getEntityDetail(input, auth, [AiEntityType.CLASS]);
      case 'invoice_detail':
        return this.getEntityDetail(input, auth, [AiEntityType.INVOICE]);
      case 'order_detail':
        return this.getEntityDetail(input, auth, [AiEntityType.ORDER]);
      case 'lead_detail':
        return this.getEntityDetail(input, auth, [AiEntityType.LEAD]);
      case 'ticket_detail':
        return this.getEntityDetail(input, auth, [AiEntityType.TICKET]);
      case 'session_detail':
        return this.getEntityDetail(input, auth, [AiEntityType.SESSION]);
      case 'ad_group_detail':
        return this.getEntityDetail(input, auth, [AiEntityType.AD_GROUP]);
      case 'system_guide':
        return this.getSystemGuideContext(user.role);
      case 'teacher_guide':
        return this.getTeacherGuideContext(user.role);
      case 'sale_guide':
        return this.getSaleGuideContext(user.role);
      case 'accounting_guide':
        return this.getAccountingGuideContext(user.role);
      case 'ops_guide':
        return this.getOpsGuideContext(user.role);
      case 'parent_guide':
        return this.getParentGuideContext(user.role);
      case 'student_guide':
        return this.getStudentGuideContext(user.role);
      case 'ads_guide':
        return this.getAdsGuideContext(user.role);
      case 'shareholder_guide':
        return this.getShareholderGuideContext(user.role);
      default:
        throw new NotFoundException(`AI tool chua co executor: ${key}`);
    }
  }

  private async getAccountingInvoices(user: AiAuthContext['user']) {
    const invoices = await this.invoicesService.findAll(user);
    return Array.isArray(invoices) ? invoices.slice(0, 30) : invoices;
  }

  private async getOpsDeepSlaPacket(input: AiToolInput, user: AiAuthContext['user']) {
    const fromDate = input.fromDate || this.todayDateOnly();
    const toDate = input.toDate || fromDate;
    const limit = this.normalizeLimit(input.filters?.limit, 30);

    const settled = await Promise.allSettled([
      this.dashboardService.getDailyTasks(user.role, user.sub),
      this.dashboardService.getOpsDashboard(user.sub),
      this.sessionsService.findAll({
        fromDate,
        toDate,
        page: 1,
        limit,
        sort: '-scheduledDate',
      } as any, user),
      this.ticketsService.findAll({
        status: 'OPEN',
        page: 1,
        limit,
        sort: '-createdAt',
      } as any),
      this.ticketsService.findAll({
        fromDate,
        toDate,
        assignedTo: user.sub,
        page: 1,
        limit,
        sort: '-createdAt',
      } as any),
      this.attendanceService.getAttendanceReport(fromDate, toDate, input.filters?.classId as string | undefined, user, 1, limit),
      this.trialEnrollmentsService.getSummary(user),
      this.trialEnrollmentsService.findAll({
        fromDate,
        toDate,
        page: 1,
        limit,
        needsDecision: 'true',
      } as any, user),
      this.pendingApprovalsService.getSummary(),
      this.teachersService.getStats(),
    ]);

    const [
      dailyTasks,
      dashboard,
      sessions,
      openTickets,
      assignedTickets,
      attendance,
      trialSummary,
      trialQueue,
      approvals,
      teacherStats,
    ] = settled.map((item) => this.settledValue(item));
    const warnings = this.settledWarnings(settled);

    const dashboardAny = dashboard as any || {};
    const sessionItems = this.toDataItems(sessions);
    const openTicketItems = this.toDataItems(openTickets);
    const assignedTicketItems = this.toDataItems(assignedTickets);
    const attendanceItems = this.toDataItems(attendance);
    const trialItems = this.toDataItems(trialQueue);
    const riskItems = this.buildOpsRiskItems({
      dailyTasks,
      dashboard: dashboardAny,
      sessions: sessionItems,
      openTickets: openTicketItems,
      assignedTickets: assignedTicketItems,
      attendance: attendanceItems,
      trialSummary,
      trialQueue: trialItems,
      approvals,
      teacherStats,
    });

    const needsFinalization = this.toNumber(dashboardAny.sessions?.needsFinalization);
    const overdueTickets = this.toNumber(dashboardAny.tickets?.overdueCount);
    const pendingApprovals = this.countApprovalBacklog(approvals);
    const waitingTrials = this.countTrialWaitingDecision(trialSummary, trialItems);
    const attendanceIssues = this.countAttendanceIssues(attendanceItems);

    return {
      generatedAt: new Date().toISOString(),
      dateRange: { fromDate, toDate },
      decisionOrder: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'],
      executiveSummary: {
        dailyTasks: this.compactDailyTaskSummary(dailyTasks),
        sessions: {
          inRangeShown: sessionItems.length,
          upcomingToday: this.toNumber(dashboardAny.sessions?.upcomingToday),
          needsFinalization,
          byStatus: dashboardAny.sessions?.byStatus || {},
        },
        tickets: {
          openShown: openTicketItems.length,
          assignedToMeShown: assignedTicketItems.length,
          overdueCount: overdueTickets,
          byPriority: dashboardAny.tickets?.byPriority || {},
          byStatus: dashboardAny.tickets?.byStatus || {},
        },
        attendance: {
          rowsShown: attendanceItems.length,
          issueLikeRows: attendanceIssues,
        },
        trialTest: {
          waitingDecision: waitingTrials,
          queueShown: trialItems.length,
        },
        approvals: {
          pendingTotal: pendingApprovals,
        },
        teachers: {
          pendingApproval: this.toNumber(dashboardAny.teachers?.pendingApproval)
            || this.toNumber((teacherStats as any)?.pendingApproval),
          suspended: this.toNumber(dashboardAny.teachers?.suspended)
            || this.toNumber((teacherStats as any)?.suspended),
        },
      },
      riskItems,
      nextActions: riskItems.slice(0, 8).map((item, index) => ({
        order: index + 1,
        severity: item.severity,
        title: item.title,
        action: item.action,
        route: item.route,
        entityContext: item.entityContext,
        sourceTool: item.sourceTool,
      })),
      sources: {
        dailyTasks: this.compactDailyTaskBoard(dailyTasks),
        dashboard,
        sessions: {
          totalItems: this.countItems(sessions),
          shownItems: sessionItems.length,
          items: sessionItems.slice(0, 12).map((item) => this.compactOpsRecord(item)),
        },
        openTickets: {
          totalItems: this.countItems(openTickets),
          shownItems: openTicketItems.length,
          items: openTicketItems.slice(0, 12).map((item) => this.compactOpsRecord(item)),
        },
        assignedTickets: {
          totalItems: this.countItems(assignedTickets),
          shownItems: assignedTicketItems.length,
          items: assignedTicketItems.slice(0, 12).map((item) => this.compactOpsRecord(item)),
        },
        attendance: {
          totalItems: this.countItems(attendance),
          shownItems: attendanceItems.length,
          items: attendanceItems.slice(0, 12).map((item) => this.compactOpsRecord(item)),
        },
        trial: {
          summary: trialSummary,
          totalItems: this.countItems(trialQueue),
          shownItems: trialItems.length,
          items: trialItems.slice(0, 12).map((item) => this.compactOpsRecord(item)),
        },
        approvals,
        teacherStats,
      },
      warnings,
    };
  }

  private settledValue(result: PromiseSettledResult<unknown>) {
    return result.status === 'fulfilled' ? result.value : null;
  }

  private settledWarnings(results: PromiseSettledResult<unknown>[]) {
    return results
      .filter((item): item is PromiseRejectedResult => item.status === 'rejected')
      .map((item) => item.reason instanceof Error ? item.reason.message : String(item.reason))
      .filter(Boolean)
      .slice(0, 8);
  }

  private buildOpsRiskItems(input: {
    dailyTasks: unknown;
    dashboard: any;
    sessions: any[];
    openTickets: any[];
    assignedTickets: any[];
    attendance: any[];
    trialSummary: unknown;
    trialQueue: any[];
    approvals: unknown;
    teacherStats: unknown;
  }) {
    const risks: Array<{
      severity: AiCoreRiskLevel;
      area: string;
      title: string;
      evidence: Record<string, unknown>;
      action: string;
      sourceTool: string;
      route: string;
      entityContext?: { type: string; id: string };
    }> = [];

    const needsFinalization = this.toNumber(input.dashboard.sessions?.needsFinalization);
    if (needsFinalization > 0) {
      risks.push({
        severity: 'HIGH',
        area: 'SESSION',
        title: `${needsFinalization} buoi da giao vien hoan tat nhung OPS chua finalize`,
        evidence: {
          needsFinalization,
          byStatus: input.dashboard.sessions?.byStatus || {},
        },
        action: 'Mo Sessions, loc TEACHER_COMPLETED, doi chieu report/attendance roi tao draft FINALIZE_SESSION tung buoi.',
        sourceTool: 'ops_dashboard',
        route: '/app/sessions',
      });
    }

    const overdueTickets = this.toNumber(input.dashboard.tickets?.overdueCount);
    if (overdueTickets > 0) {
      risks.push({
        severity: 'CRITICAL',
        area: 'TICKET_SLA',
        title: `${overdueTickets} ticket OPS qua SLA`,
        evidence: {
          overdueCount: overdueTickets,
          byPriority: input.dashboard.tickets?.byPriority || {},
        },
        action: 'Xu ly ticket qua han truoc: mo ticket, comment noi bo neu can thong tin, assign/uu tien lai bang draft.',
        sourceTool: 'ops_dashboard',
        route: '/app/tickets',
      });
    }

    for (const task of this.extractDailyTasks(input.dailyTasks).slice(0, 12)) {
      const severity = this.mapTaskSeverity(task.priority, task.overdue);
      if (!['CRITICAL', 'HIGH'].includes(severity)) continue;
      risks.push({
        severity,
        area: String(task.type || 'DAILY_TASK'),
        title: String(task.title || task.detail || 'Viec van hanh can xu ly'),
        evidence: {
          status: task.status,
          dueAt: task.dueAt,
          overdue: task.overdue,
          detail: task.detail,
          meta: task.meta,
        },
        action: String(task.actionLabel || 'Mo man hinh lien quan de xu ly'),
        sourceTool: 'daily_tasks',
        route: String(task.route || '/app/dashboard'),
        entityContext: this.entityContextFromTask(task),
      });
    }

    const now = new Date();
    for (const ticket of [...input.openTickets, ...input.assignedTickets].slice(0, 16)) {
      const priority = String(ticket.priority || '').toUpperCase();
      const dueDate = ticket.dueDate ? new Date(ticket.dueDate) : null;
      const isOverdue = Boolean(ticket.isOverdue) || Boolean(dueDate && !Number.isNaN(dueDate.getTime()) && dueDate < now);
      if (!isOverdue && !['URGENT', 'HIGH'].includes(priority)) continue;
      const id = this.readId(ticket);
      risks.push({
        severity: isOverdue ? 'CRITICAL' : 'HIGH',
        area: 'TICKET_SLA',
        title: `${ticket.ticketCode || id || 'Ticket'} - ${ticket.subject || 'ticket can xu ly'}`,
        evidence: {
          status: ticket.status,
          priority: ticket.priority,
          dueDate: ticket.dueDate,
          assignedTo: this.compactName(ticket.assignedTo),
        },
        action: 'Mo ticket detail, kiem tra conversation/session lien quan, cap nhat priority/assign/comment bang draft neu can.',
        sourceTool: 'ops_open_tickets',
        route: '/app/tickets',
        entityContext: id ? { type: 'ticket', id } : undefined,
      });
    }

    for (const session of input.sessions.slice(0, 16)) {
      const status = String(session.status || '').toUpperCase();
      const scheduledDate = session.scheduledDate ? new Date(session.scheduledDate) : null;
      const isOld = Boolean(scheduledDate && !Number.isNaN(scheduledDate.getTime()) && scheduledDate < now);
      if (status !== 'TEACHER_COMPLETED' && !(status === 'SCHEDULED' && isOld)) continue;
      const id = this.readId(session);
      risks.push({
        severity: status === 'TEACHER_COMPLETED' ? 'HIGH' : 'MEDIUM',
        area: 'SESSION',
        title: `${status === 'TEACHER_COMPLETED' ? 'Can finalize' : 'Can kiem tra no-show'} - ${this.compactRecordTitle(session)}`,
        evidence: {
          status: session.status,
          scheduledDate: session.scheduledDate,
          scheduledStartTime: session.scheduledStartTime,
          class: this.compactName(session.classId),
          student: this.compactName(session.studentId),
          teacher: this.compactName(session.teacherId),
        },
        action: status === 'TEACHER_COMPLETED'
          ? 'Mo session detail, doi chieu attendance/report roi tao draft FINALIZE_SESSION.'
          : 'Mo session detail, xac minh giao vien/phu huynh roi tao draft MARK_SESSION_NO_SHOW hoac RESCHEDULE_SESSION neu dung.',
        sourceTool: 'ops_sessions',
        route: '/app/sessions',
        entityContext: id ? { type: 'session', id } : undefined,
      });
    }

    const attendanceIssues = this.countAttendanceIssues(input.attendance);
    if (attendanceIssues > 0) {
      risks.push({
        severity: 'MEDIUM',
        area: 'ATTENDANCE',
        title: `${attendanceIssues} dong attendance co vang/tre/sai lech can doi soat`,
        evidence: {
          issueLikeRows: attendanceIssues,
          rowsShown: input.attendance.length,
        },
        action: 'Mo Attendance report theo ngay/lop, doi chieu session truoc khi tao draft MARK_ATTENDANCE.',
        sourceTool: 'ops_attendance_report',
        route: '/app/attendance',
      });
    }

    const waitingTrials = this.countTrialWaitingDecision(input.trialSummary, input.trialQueue);
    if (waitingTrials > 0) {
      risks.push({
        severity: 'HIGH',
        area: 'TRIAL_TEST',
        title: `${waitingTrials} ho so hoc thu/test dang can chot quyet dinh`,
        evidence: {
          waitingDecision: waitingTrials,
          queueShown: input.trialQueue.length,
        },
        action: 'Mo Trial enrollments, xem assessment/order/invoice lien quan roi tao draft UPDATE_TRIAL_ENROLLMENT neu du thong tin.',
        sourceTool: 'ops_trial_enrollments',
        route: '/app/trial-enrollments',
      });
    }

    const pendingApprovals = this.countApprovalBacklog(input.approvals);
    if (pendingApprovals > 0) {
      risks.push({
        severity: 'MEDIUM',
        area: 'APPROVAL',
        title: `${pendingApprovals} muc cho duyet co the anh huong van hanh`,
        evidence: {
          summary: input.approvals,
        },
        action: 'Mo Pending approvals, uu tien doi lich/lop/giao vien truoc neu dang chan session hoac ticket.',
        sourceTool: 'pending_approvals_summary',
        route: '/app/pending-approvals',
      });
    }

    return this.dedupeAndSortRisks(risks).slice(0, 20);
  }

  private toDataItems(value: unknown): any[] {
    if (Array.isArray(value)) return value;
    if (!value || typeof value !== 'object') return [];
    const record = value as Record<string, any>;
    for (const key of ['data', 'items', 'results', 'docs', 'rows']) {
      if (Array.isArray(record[key])) return record[key];
    }
    if (Array.isArray(record.tasks)) return record.tasks;
    if (Array.isArray(record.recentTickets)) return record.recentTickets;
    return [];
  }

  private countItems(value: unknown) {
    if (Array.isArray(value)) return value.length;
    if (!value || typeof value !== 'object') return 0;
    const record = value as Record<string, any>;
    const explicit = Number(record.meta?.total ?? record.total ?? record.totalItems ?? record.count);
    if (Number.isFinite(explicit)) return explicit;
    return this.toDataItems(value).length;
  }

  private extractDailyTasks(value: unknown): any[] {
    if (!value || typeof value !== 'object') return [];
    const board = value as Record<string, any>;
    if (Array.isArray(board.tasks)) return board.tasks;
    if (!Array.isArray(board.tabs)) return [];
    return board.tabs.flatMap((tab) => Array.isArray(tab?.tasks) ? tab.tasks : []);
  }

  private compactDailyTaskSummary(value: unknown) {
    if (!value || typeof value !== 'object') {
      return { totalTasks: 0, overdueTasks: 0, highPriorityTasks: 0 };
    }
    const board = value as Record<string, any>;
    const tasks = this.extractDailyTasks(value);
    return {
      totalTasks: this.toNumber(board.summary?.totalTasks) || tasks.length,
      overdueTasks: this.toNumber(board.summary?.overdueTasks)
        || tasks.filter((task) => task?.overdue).length,
      highPriorityTasks: this.toNumber(board.summary?.highPriorityTasks)
        || tasks.filter((task) => ['CRITICAL', 'HIGH'].includes(String(task?.priority || '').toUpperCase())).length,
      tabs: Array.isArray(board.tabs)
        ? board.tabs.map((tab: any) => ({
            key: tab.key,
            label: tab.label,
            count: this.toNumber(tab.count) || (Array.isArray(tab.tasks) ? tab.tasks.length : 0),
          }))
        : [],
    };
  }

  private compactDailyTaskBoard(value: unknown) {
    if (!value || typeof value !== 'object') return value;
    const board = value as Record<string, any>;
    if (!Array.isArray(board.tabs)) return board;
    return {
      role: board.role,
      title: board.title,
      generatedAt: board.generatedAt,
      summary: board.summary,
      tabs: board.tabs.map((tab: any) => ({
        key: tab.key,
        label: tab.label,
        count: tab.count,
        tasks: Array.isArray(tab.tasks)
          ? tab.tasks.slice(0, 6).map((task: any) => ({
              id: task.id,
              type: task.type,
              title: task.title,
              detail: task.detail,
              status: task.status,
              priority: task.priority,
              dueAt: task.dueAt,
              route: task.route,
              overdue: task.overdue,
            }))
          : [],
      })),
    };
  }

  private countApprovalBacklog(value: unknown) {
    if (!value || typeof value !== 'object') return 0;
    const record = value as Record<string, any>;
    const explicit = Number(record.total ?? record.totalPending ?? record.pendingTotal ?? record.count);
    if (Number.isFinite(explicit)) return explicit;

    let total = 0;
    for (const [key, child] of Object.entries(record)) {
      if (['generatedAt', 'updatedAt'].includes(key)) continue;
      if (typeof child === 'number') {
        total += child;
      } else if (child && typeof child === 'object') {
        total += this.toNumber((child as any).count ?? (child as any).total ?? (child as any).pending);
      }
    }
    return total;
  }

  private countTrialWaitingDecision(summary: unknown, trialRows: any[]) {
    const summaryRecord = summary as any;
    return this.toNumber(summaryRecord?.waitingDecision)
      || this.toNumber(summaryRecord?.byStatus?.WAITING_DECISION)
      || this.toNumber(summaryRecord?.statusCounts?.WAITING_DECISION)
      || trialRows.filter((trial) => String(trial?.status || '').toUpperCase() === 'WAITING_DECISION').length;
  }

  private countAttendanceIssues(rows: any[]) {
    return rows.filter((row) => {
      const status = String(row?.status || row?.attendanceStatus || '').toUpperCase();
      const parentConfirm = String(row?.parentConfirm || '').toUpperCase();
      return ['ABSENT', 'LATE', 'EXCUSED'].includes(status)
        || parentConfirm === 'ISSUE'
        || Boolean(row?.issue || row?.hasIssue || row?.missingAttendance);
    }).length;
  }

  private compactOpsRecord(item: any) {
    if (!item || typeof item !== 'object') return item;
    return {
      id: this.readId(item),
      code: item.code || item.ticketCode || item.trialCode || item.sessionCode || item.studentCode,
      title: this.compactRecordTitle(item),
      status: item.status,
      priority: item.priority,
      dueDate: item.dueDate,
      scheduledDate: item.scheduledDate || item.date || item.testDate,
      scheduledStartTime: item.scheduledStartTime || item.testStartTime,
      scheduledEndTime: item.scheduledEndTime || item.testEndTime,
      class: this.compactName(item.classId || item.class),
      student: this.compactName(item.studentId || item.student),
      teacher: this.compactName(item.teacherId || item.teacher || item.experienceTeacherId),
      assignedTo: this.compactName(item.assignedTo),
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }

  private compactRecordTitle(item: any) {
    return [
      item.ticketCode || item.trialCode || item.sessionCode || item.code,
      item.subject || item.title || item.name || item.fullName || item.studentName || item.parentName,
    ].filter(Boolean).join(' - ') || this.readId(item) || 'record';
  }

  private compactName(value: unknown): unknown {
    if (!value || typeof value !== 'object') return value;
    const record = value as Record<string, any>;
    return {
      id: this.readId(record),
      name: record.fullName || record.name || record.code || record.studentCode || record.email,
    };
  }

  private readId(value: unknown): string | undefined {
    if (!value) return undefined;
    if (typeof value === 'string') return value;
    if (typeof (value as any).toHexString === 'function') return (value as any).toHexString();
    if (typeof value === 'object') {
      const record = value as Record<string, any>;
      if (record._id) return this.readId(record._id);
      if (record.id) return this.readId(record.id);
    }
    return undefined;
  }

  private entityContextFromTask(task: any): { type: string; id: string } | undefined {
    const id = this.readId(task?.entityId) || this.readId(task?._id);
    if (!id) return undefined;
    const type = String(task?.entityType || task?.type || '').toLowerCase();
    if (type.includes('ticket')) return { type: 'ticket', id };
    if (type.includes('session')) return { type: 'session', id };
    if (type.includes('trial')) return { type: 'trial_enrollment', id };
    if (type.includes('class')) return { type: 'class', id };
    return undefined;
  }

  private mapTaskSeverity(priority: unknown, overdue?: unknown): AiCoreRiskLevel {
    const value = String(priority || '').toUpperCase();
    if (value === 'CRITICAL') return 'CRITICAL';
    if (value === 'HIGH' || overdue) return 'HIGH';
    if (value === 'MEDIUM') return 'MEDIUM';
    return 'LOW';
  }

  private dedupeAndSortRisks<T extends { severity: AiCoreRiskLevel; title: string; area: string }>(risks: T[]) {
    const seen = new Set<string>();
    const severityWeight: Record<AiCoreRiskLevel, number> = {
      CRITICAL: 4,
      HIGH: 3,
      MEDIUM: 2,
      LOW: 1,
    };

    return risks
      .filter((risk) => {
        const key = `${risk.severity}:${risk.area}:${risk.title}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((left, right) => severityWeight[right.severity] - severityWeight[left.severity]);
  }

  private toNumber(value: unknown) {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : 0;
  }

  private buildToolMetadata(data: unknown): AiToolResult['metadata'] {
    const metadata: AiToolResult['metadata'] = { truncated: false };
    const warnings: string[] = [];

    if (Array.isArray(data)) {
      metadata.totalItems = data.length;
      metadata.shownItems = data.length;
    } else if (data && typeof data === 'object') {
      const paginated = this.readPaginationMetadata(data as Record<string, any>);
      if (paginated) {
        metadata.totalItems = paginated.totalItems;
        metadata.shownItems = paginated.shownItems;
        metadata.truncated = paginated.totalItems > paginated.shownItems;
      }

      const directWarning = (data as any).warning;
      if (typeof directWarning === 'string' && directWarning.trim()) {
        warnings.push(directWarning.trim());
      }
      const directWarnings = (data as any).warnings;
      if (Array.isArray(directWarnings)) {
        warnings.push(...directWarnings.map((item) => String(item).trim()).filter(Boolean));
      }
    }

    if (metadata.truncated && metadata.totalItems !== undefined && metadata.shownItems !== undefined) {
      warnings.unshift(`Tool result truncated: shown ${metadata.shownItems}/${metadata.totalItems}.`);
    }

    if (warnings.length) {
      metadata.warnings = Array.from(new Set(warnings)).slice(0, 5);
    }

    return metadata;
  }

  private readPaginationMetadata(data: Record<string, any>) {
    if (!Array.isArray(data.data)) {
      return undefined;
    }

    const metaTotal = Number(data.meta?.total);
    const rootTotal = Number(data.total);
    const totalItems = Number.isFinite(metaTotal)
      ? metaTotal
      : Number.isFinite(rootTotal)
        ? rootTotal
        : data.data.length;

    return {
      totalItems,
      shownItems: data.data.length,
    };
  }

  private async getAccountingLoanPaymentsDue(input: AiToolInput) {
    const fromDate = input.fromDate || this.todayDateOnly();
    const toDate = input.toDate || this.addDaysDateOnly(fromDate, 30);
    const [overdue, scheduled, partial] = await Promise.all([
      this.getLimitedList(this.loansService.findPayments({ status: 'OVERDUE' } as any), 30),
      this.getLimitedList(
        this.loansService.findPayments({
          status: 'SCHEDULED',
          startDate: fromDate,
          endDate: toDate,
        } as any),
        30,
      ),
      this.getLimitedList(
        this.loansService.findPayments({
          status: 'PARTIAL',
          startDate: fromDate,
          endDate: toDate,
        } as any),
        30,
      ),
    ]);

    return {
      window: { fromDate, toDate },
      overdue,
      scheduled,
      partial,
    };
  }

  private async getAccountingBankReconciliation(input: AiToolInput) {
    const bankAccountId = input.filters?.bankAccountId as string | undefined;
    const fromDate = input.fromDate || this.currentMonthStartDateOnly();
    const toDate = input.toDate || this.todayDateOnly();

    if (!bankAccountId) {
      return {
        window: { fromDate, toDate },
        warning: 'Can filter bankAccountId de lay reconciliation chi tiet; dang tra ve summary tai khoan ngan hang.',
        bankAccountSummary: await this.financialControlService.getBankAccountSummary(),
      };
    }

    return this.financialControlService.getReconciliation(bankAccountId, fromDate, toDate);
  }

  private async getLimitedPendingApprovalList(loader: () => Promise<unknown[]>) {
    return this.getLimitedList(loader());
  }

  private async getLimitedList<T>(value: Promise<T[]> | T[], limit = 30) {
    const rows = await value;
    return Array.isArray(rows) ? rows.slice(0, limit) : rows;
  }

  private async getWorkSessionsMonthlySummary(input: AiToolInput) {
    const fromDate = input.fromDate || this.currentMonthStartDateOnly();
    const toDate = input.toDate || this.todayDateOnly();
    return this.getLimitedList(
      this.workSessionsService.getMonthlySummary(
        this.toDateBoundary(fromDate, false),
        this.toDateBoundary(toDate, true),
      ),
      30,
    );
  }

  private async getOpsTeachers(input: AiToolInput, user: AiAuthContext['user']) {
    const teachers = await this.teachersService.findAll({
      status: this.normalizeTeacherStatus(input.filters?.status),
      subjects: this.normalizeStringList(input.filters?.subjects),
      grades: this.normalizeStringList(input.filters?.grades),
    }, user);
    return Array.isArray(teachers) ? teachers.slice(0, 30) : teachers;
  }

  private async getSaleLeadList(input: AiToolInput, user: AiAuthContext['user']) {
    const leads = await this.leadsService.findAll({
      fromDate: input.fromDate,
      toDate: input.toDate,
      status: input.filters?.status as string | undefined,
      stale: input.filters?.stale as string | undefined,
      search: input.filters?.search as string | undefined,
    } as any, user);

    return Array.isArray(leads) ? leads.slice(0, 30) : leads;
  }

  private async getSaleFollowUpsDue(user: AiAuthContext['user']) {
    const followUps = await this.leadsService.getFollowUps(user);
    return Array.isArray(followUps) ? followUps.slice(0, 30) : followUps;
  }

  private async getSaleConversations(input: AiToolInput, user: AiAuthContext['user']) {
    const status = typeof input.filters?.status === 'string'
      ? input.filters.status
      : undefined;
    const limit = this.normalizeLimit(input.filters?.limit, 20);

    return this.chatbotService.findAllConversations({
      assignedAgentId: user.sub,
      status,
      page: '1',
      limit: String(limit),
    } as any);
  }

  private async getSaleNextBestActions(input: AiToolInput, user: AiAuthContext['user']) {
    const fromDate = input.fromDate || this.currentMonthStartDateOnly();
    const toDate = input.toDate || this.todayDateOnly();

    const [
      dashboard,
      followUps,
      leadPipeline,
      staleLeads,
      orderPipeline,
      ordersResult,
      trialSummary,
      trialsResult,
      commissionReport,
      conversationsResult,
    ] = await Promise.all([
      this.dashboardService.getSalesDashboard(user.sub, fromDate, toDate),
      this.getSaleFollowUpsDue(user),
      this.leadsService.getPipeline(user),
      this.getSaleLeadList({ fromDate, toDate, filters: { stale: 'true' } }, user),
      this.ordersService.getPipeline(user),
      this.ordersService.findAll({ fromDate, toDate, page: 1, limit: 30 } as any, user),
      this.trialEnrollmentsService.getSummary(user),
      this.trialEnrollmentsService.findAll({ page: 1, limit: 30, needsDecision: 'true' } as any, user),
      this.ordersService.getCommissionReport(user.sub, fromDate, toDate),
      this.chatbotService.findAllConversations({
        assignedAgentId: user.sub,
        status: ConversationStatus.HUMAN_HANDLING,
        page: '1',
        limit: '20',
      } as any),
    ]);

    const orders = this.extractItems(ordersResult);
    const activeTrials = this.extractItems(trialsResult);
    const humanConversations = this.extractItems(conversationsResult);
    const actions = [
      ...this.buildFollowUpActions(followUps),
      ...this.buildStaleLeadActions(staleLeads),
      ...this.buildOrderActions(orders),
      ...this.buildTrialActions(activeTrials),
      ...this.buildConversationActions(humanConversations),
    ]
      .sort((a, b) => b.score - a.score)
      .slice(0, 12)
      .map((action, index) => ({ rank: index + 1, ...action }));

    return {
      dateRange: { fromDate, toDate },
      generatedAt: new Date().toISOString(),
      scope: 'JWT sale only',
      rankingModel: {
        scale: '0-100+',
        order: 'WAITING_DECISION trial > overdue follow-up > needs-info order > hot conversation > stale lead > submitted/approved order',
        writeGuard: 'Moi update lead/order/trial/message can action draft, preview va xac nhan.',
      },
      summary: {
        followUpsDue: followUps.length,
        staleLeads: staleLeads.length,
        orderQueue: orders.filter((order) => this.isOpenSaleOrder(order.status)).length,
        trialActive: Number((trialSummary as any)?.active || 0),
        trialWaitingDecision: Number((trialSummary as any)?.waitingDecision || 0),
        humanConversations: humanConversations.length,
        leadPipeline,
        orderPipeline,
        commission: (commissionReport as any)?.summary,
        dashboard: {
          leads: (dashboard as any)?.leads
            ? {
                total: (dashboard as any).leads.total,
                converted: (dashboard as any).leads.converted,
                conversionRate: (dashboard as any).leads.conversionRate,
                active: (dashboard as any).leads.active,
                followUpsOverdue: (dashboard as any).leads.followUpsOverdue,
              }
            : undefined,
          orders: (dashboard as any)?.orders
            ? {
                total: (dashboard as any).orders.total,
                revenueGenerated: (dashboard as any).orders.revenueGenerated,
                commissionEarned: (dashboard as any).orders.commissionEarned,
                commissionPending: (dashboard as any).orders.commissionPending,
              }
            : undefined,
        },
      },
      nextBestActions: actions,
      warnings: [
        actions.length ? undefined : 'Khong co action uu tien cao trong context da nap.',
        'Conversation chi tinh cac hoi thoai da assigned cho sale dang dang nhap.',
      ].filter(Boolean),
    };
  }

  private buildFollowUpActions(leads: any[]) {
    return leads.slice(0, 12).map((lead) => {
      const overdueDays = this.daysOverdue(lead.nextFollowUp);
      const score = 90 + Math.min(overdueDays * 3, 18) + this.leadValueScore(lead);
      return {
        score,
        priority: overdueDays > 0 ? 'HIGH' : 'MEDIUM',
        type: overdueDays > 0 ? 'FOLLOW_UP_OVERDUE' : 'FOLLOW_UP_DUE',
        title: `Lien he lai ${lead.parentName || lead.leadCode || 'lead'}`,
        reason: overdueDays > 0
          ? `Lead da qua han follow-up ${overdueDays} ngay.`
          : 'Lead den han follow-up trong ngay.',
        evidence: [
          this.compactCode('lead', lead.leadCode, lead._id),
          lead.status ? `status=${lead.status}` : undefined,
          lead.nextFollowUp ? `nextFollowUp=${this.toIso(lead.nextFollowUp)}` : undefined,
          lead.parentPhone ? `phone=${lead.parentPhone}` : undefined,
        ].filter(Boolean),
        entity: this.entitySummary('lead', lead._id, lead.leadCode, lead.parentName || lead.studentName),
        route: '/app/leads',
        suggestedNextStep: 'Mo lead, doc lich su lien he, goi/nhan tin va tao draft add contact/nextFollowUp.',
        sourceTools: ['sale_followups_due'],
        requiresConfirmationForWrite: true,
      };
    });
  }

  private buildStaleLeadActions(leads: any[]) {
    return leads.slice(0, 8).map((lead) => {
      const inactiveDays = Math.max(this.daysSince(lead.lastContactAt || lead.assignedAt || lead.createdAt), 0);
      return {
        score: 72 + Math.min(inactiveDays, 18) + this.leadValueScore(lead),
        priority: inactiveDays >= 14 ? 'HIGH' : 'MEDIUM',
        type: 'STALE_LEAD_RECOVERY',
        title: `Cuu lead nguoi ${lead.parentName || lead.leadCode || ''}`.trim(),
        reason: `Lead chua co lien he moi trong khoang ${inactiveDays || 'khong ro'} ngay.`,
        evidence: [
          this.compactCode('lead', lead.leadCode, lead._id),
          lead.status ? `status=${lead.status}` : undefined,
          lead.lastContactAt ? `lastContactAt=${this.toIso(lead.lastContactAt)}` : undefined,
          lead.estimatedValue ? `estimatedValue=${lead.estimatedValue}` : undefined,
        ].filter(Boolean),
        entity: this.entitySummary('lead', lead._id, lead.leadCode, lead.parentName || lead.studentName),
        route: '/app/leads',
        suggestedNextStep: 'Kiem tra ly do nguoi, soan message re-engage va hen next follow-up neu phu huynh con quan tam.',
        sourceTools: ['sale_my_leads'],
        requiresConfirmationForWrite: true,
      };
    });
  }

  private buildOrderActions(orders: any[]) {
    return orders
      .filter((order) => this.isOpenSaleOrder(order.status))
      .slice(0, 10)
      .map((order) => {
        const status = String(order.status || '');
        const createdDays = this.daysSince(order.createdAt);
        const baseScore = status === OrderStatus.NEEDS_INFO
          ? 88
          : status === OrderStatus.SUBMITTED
            ? 76
            : status === OrderStatus.APPROVED
              ? 64
              : 58;
        return {
          score: baseScore + Math.min(createdDays, 12) + this.moneyScore(order.finalAmount),
          priority: status === OrderStatus.NEEDS_INFO ? 'HIGH' : 'MEDIUM',
          type: status === OrderStatus.NEEDS_INFO ? 'ORDER_NEEDS_INFO' : 'ORDER_PIPELINE',
          title: `Xu ly don ${order.orderCode || ''}`.trim(),
          reason: status === OrderStatus.NEEDS_INFO
            ? 'Order dang can bo sung, co nguy co khong duoc tinh doanh thu/hoa hong dung han.'
            : `Order dang o trang thai ${status}, can theo doi buoc tiep theo.`,
          evidence: [
            this.compactCode('order', order.orderCode, order._id),
            `status=${status}`,
            order.finalAmount ? `amount=${order.finalAmount}` : undefined,
            order.createdAt ? `createdAt=${this.toIso(order.createdAt)}` : undefined,
          ].filter(Boolean),
          entity: this.entitySummary('order', order._id, order.orderCode, order.parentName || order.studentName),
          route: '/app/orders',
          suggestedNextStep: status === OrderStatus.NEEDS_INFO
            ? 'Mo order, bo sung ho so/chung tu con thieu roi tao draft gui lai duyet.'
            : 'Kiem tra trang thai duyet/thanh toan va ghi chu handover neu can.',
          sourceTools: ['sale_my_orders', 'sale_order_pipeline'],
          requiresConfirmationForWrite: true,
        };
      });
  }

  private buildTrialActions(trials: any[]) {
    return trials.slice(0, 10).map((trial) => {
      const status = String(trial.status || '');
      const waitingDecision = status === TrialEnrollmentStatus.WAITING_DECISION;
      const ageDays = this.daysSince(trial.updatedAt || trial.createdAt);
      return {
        score: (waitingDecision ? 96 : 74) + Math.min(ageDays * 2, 16),
        priority: waitingDecision ? 'HIGH' : 'MEDIUM',
        type: waitingDecision ? 'TRIAL_WAITING_DECISION' : 'TRIAL_PENDING',
        title: waitingDecision
          ? `Chot quyet dinh sau test ${trial.trialCode || ''}`.trim()
          : `Xep/cham soc buoi test ${trial.trialCode || ''}`.trim(),
        reason: waitingDecision
          ? 'Trial da den buoc waiting decision, can chot phu huynh truoc khi nguoi lead.'
          : 'Trial/test dang active, can dam bao lich test va giao vien trai nghiem ro rang.',
        evidence: [
          this.compactCode('trial', trial.trialCode, trial._id),
          `status=${status}`,
          trial.testDate ? `testDate=${this.toIso(trial.testDate)}` : undefined,
          trial.parentPhone ? `phone=${trial.parentPhone}` : undefined,
        ].filter(Boolean),
        entity: this.entitySummary('trial', trial._id, trial.trialCode, trial.parentName || trial.studentName),
        route: '/app/trial-enrollments',
        suggestedNextStep: waitingDecision
          ? 'Goi phu huynh, tom tat ket qua test va tao draft convert/reject khi co quyet dinh.'
          : 'Kiem tra slot/giao vien trai nghiem, cap nhat lich test neu thieu.',
        sourceTools: ['sale_trial_enrollments', 'sale_trial_summary'],
        requiresConfirmationForWrite: true,
      };
    });
  }

  private buildConversationActions(conversations: any[]) {
    return conversations.slice(0, 8).map((conversation) => {
      const idleHours = this.hoursSince(conversation.lastMessageAt || conversation.updatedAt || conversation.createdAt);
      return {
        score: 82 + Math.min(Math.floor(idleHours / 4), 12),
        priority: idleHours >= 24 ? 'HIGH' : 'MEDIUM',
        type: 'CONVERSATION_HUMAN_HANDLING',
        title: `Tra loi hoi thoai ${conversation.customerName || conversation.conversationCode || ''}`.trim(),
        reason: 'Hoi thoai dang o che do human handling va assigned cho sale.',
        evidence: [
          this.compactCode('conversation', conversation.conversationCode, conversation._id),
          conversation.status ? `status=${conversation.status}` : undefined,
          conversation.lastMessageAt ? `lastMessageAt=${this.toIso(conversation.lastMessageAt)}` : undefined,
          conversation.customerPhone ? `phone=${conversation.customerPhone}` : undefined,
        ].filter(Boolean),
        entity: this.entitySummary('conversation', conversation._id, conversation.conversationCode, conversation.customerName),
        route: '/app/conversations',
        suggestedNextStep: 'Doc tin nhan gan nhat, soan cau tra loi va chi gui khi da confirm noi dung.',
        sourceTools: ['sale_conversations'],
        requiresConfirmationForWrite: true,
      };
    });
  }

  private extractItems(value: any): any[] {
    if (Array.isArray(value)) return value;
    if (Array.isArray(value?.data)) return value.data;
    if (Array.isArray(value?.items)) return value.items;
    return [];
  }

  private isOpenSaleOrder(status: unknown) {
    return [
      OrderStatus.DRAFT,
      OrderStatus.SUBMITTED,
      OrderStatus.NEEDS_INFO,
      OrderStatus.APPROVED,
    ].includes(status as OrderStatus);
  }

  private entitySummary(type: string, id: unknown, code?: unknown, label?: unknown) {
    return {
      type,
      id: id?.toString?.() || String(id || ''),
      code: code ? String(code) : undefined,
      label: label ? String(label) : undefined,
    };
  }

  private compactCode(prefix: string, code?: unknown, id?: unknown) {
    if (code) return `${prefix}=${String(code)}`;
    if (id) return `${prefix}Id=${id?.toString?.() || String(id)}`;
    return undefined;
  }

  private leadValueScore(lead: any) {
    return this.moneyScore(Number(lead?.estimatedValue || 0));
  }

  private moneyScore(value: unknown) {
    const amount = Number(value || 0);
    if (!Number.isFinite(amount) || amount <= 0) return 0;
    if (amount >= 20_000_000) return 8;
    if (amount >= 10_000_000) return 5;
    if (amount >= 5_000_000) return 3;
    return 1;
  }

  private daysOverdue(value: unknown) {
    const date = this.toValidDate(value);
    if (!date) return 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.max(0, Math.floor((today.getTime() - date.getTime()) / 86_400_000));
  }

  private daysSince(value: unknown) {
    const date = this.toValidDate(value);
    if (!date) return 0;
    return Math.max(0, Math.floor((Date.now() - date.getTime()) / 86_400_000));
  }

  private hoursSince(value: unknown) {
    const date = this.toValidDate(value);
    if (!date) return 0;
    return Math.max(0, Math.floor((Date.now() - date.getTime()) / 3_600_000));
  }

  private toValidDate(value: unknown): Date | undefined {
    if (!value) return undefined;
    const date = value instanceof Date ? value : new Date(String(value));
    return Number.isNaN(date.getTime()) ? undefined : date;
  }

  private toIso(value: unknown) {
    return this.toValidDate(value)?.toISOString();
  }

  private async getStudentLearningSnapshot(user: AiAuthContext['user']) {
    if (user.role === Role.PARENT) {
      const children = await this.studentsService.findAll(user);
      const firstChild = Array.isArray(children) ? children[0] : undefined;
      if (!firstChild?._id) {
        return {
          children: [],
          warning: 'Tai khoan phu huynh chua lien ket hoc sinh.',
        };
      }
      return this.studentSupportSnapshotService.getOrBuild(user.sub, firstChild._id);
    }

    const student = await this.studentModel
      .findOne({ studentUserId: user.sub })
      .select('_id parentUserId parentUserIds fullName studentCode')
      .lean();
    const parentUserId = (student as any)?.parentUserId?.toString?.();
    const studentId = (student as any)?._id?.toString?.();
    if (!parentUserId || !studentId) {
      return {
        student: student || null,
        warning: 'Tai khoan hoc sinh chua lien ket du ho so hoc vien/phu huynh de tao learning snapshot.',
      };
    }

    return this.studentSupportSnapshotService.getOrBuild(parentUserId, studentId);
  }

  private async getParentSuccessPacket(input: AiToolInput, user: AiAuthContext['user']) {
    const fromDate = input.fromDate || this.currentMonthStartDateOnly();
    const toDate = input.toDate || this.todayDateOnly();
    const ledgerLimit = this.normalizeLimit(input.filters?.ledgerLimit || input.filters?.limit, 20);

    const [
      dashboard,
      children,
      sessions,
      progress,
      invoices,
      wallet,
      ledger,
      attendanceStats,
      attendance,
      tickets,
    ] = await Promise.all([
      this.dashboardService.getParentDashboard(user.sub),
      this.studentsService.findAll(user),
      this.sessionsService.findAll({
        fromDate,
        toDate,
        parentUserId: user.sub,
        page: 1,
        limit: 30,
        sort: '-scheduledDate',
      } as any, user),
      this.sessionsService.getChildrenProgress(user.sub),
      this.invoicesService.getParentInvoices(user.sub),
      this.walletsService.getOrCreateWalletView(user.sub),
      this.walletsService.queryLedger({
        fromDate,
        toDate,
        page: 1,
        limit: ledgerLimit,
        sort: '-createdAt',
        userId: user.sub,
      } as any),
      this.attendanceService.getChildrenAttendanceStats(user.sub, fromDate, toDate),
      this.attendanceService.getChildrenAttendance(user.sub, fromDate, toDate),
      this.ticketsService.findMyTickets(user.sub, {
        fromDate,
        toDate,
        page: 1,
        limit: 20,
        sort: '-createdAt',
      } as any),
    ]);

    const childRows = Array.isArray(children) ? children : [];
    const learningSnapshots = await this.getParentLearningSnapshots(user.sub, childRows);
    const sessionRows = this.extractRows(sessions);
    const ledgerRows = this.extractRows(ledger);
    const ticketRows = this.extractRows(tickets);
    const compactAttendance = this.compactParentAttendance(attendanceStats, attendance);
    const compactProgress = this.compactParentProgress(progress, learningSnapshots);

    return {
      window: { fromDate, toDate },
      scope: 'OWN_CHILDREN_AND_OWN_WALLET',
      children: this.compactParentChildren(childRows),
      priorityActions: this.buildParentPriorityActions({
        childCount: childRows.length,
        progress: compactProgress,
        invoices,
        wallet,
        ledgerRows,
        attendance: compactAttendance,
        ticketRows,
        sessionRows,
      }),
      learning: compactProgress,
      schedule: this.compactParentSessions(sessionRows),
      attendance: compactAttendance,
      finance: this.compactParentFinance(invoices, wallet, ledgerRows),
      support: this.compactParentTickets(ticketRows, tickets),
      dashboard,
      warnings: childRows.length
        ? []
        : ['Tai khoan phu huynh chua lien ket hoc sinh nen packet chua co du lieu con.'],
    };
  }

  private async getParentAttendanceSummary(input: AiToolInput, user: AiAuthContext['user']) {
    const fromDate = input.fromDate || this.currentMonthStartDateOnly();
    const toDate = input.toDate || this.todayDateOnly();
    const [stats, records] = await Promise.all([
      this.attendanceService.getChildrenAttendanceStats(user.sub, fromDate, toDate),
      this.attendanceService.getChildrenAttendance(user.sub, fromDate, toDate),
    ]);

    return {
      window: { fromDate, toDate },
      ...this.compactParentAttendance(stats, records),
    };
  }

  private async getParentLearningSnapshots(parentUserId: string, children: any[]) {
    const rows = children.slice(0, 3);
    return Promise.all(rows.map(async (child) => {
      const studentId = child?._id?.toString?.() || String(child?._id || '');
      if (!studentId) {
        return {
          studentId: '',
          studentName: child?.fullName || '',
          warning: 'Hoc sinh khong co _id hop le de tao learning snapshot.',
        };
      }

      try {
        const snapshot = await this.studentSupportSnapshotService.getOrBuild(parentUserId, studentId);
        return {
          studentId,
          studentName: child?.fullName || '',
          snapshot: this.compactLearningSnapshot(snapshot),
        };
      } catch (err) {
        return {
          studentId,
          studentName: child?.fullName || '',
          warning: this.getErrorMessage(err),
        };
      }
    }));
  }

  private compactParentChildren(children: any[]) {
    return children.slice(0, 8).map((child) => ({
      studentId: child?._id?.toString?.() || String(child?._id || ''),
      fullName: child?.fullName || child?.name || '',
      studentCode: child?.studentCode || '',
      grade: child?.grade || '',
      subjects: Array.isArray(child?.subjects) ? child.subjects.slice(0, 5) : child?.subjects,
    }));
  }

  private compactParentProgress(progress: any, learningSnapshots: any[]) {
    const children = Array.isArray(progress?.children) ? progress.children : [];
    return {
      children: children.slice(0, 8).map((item: any) => ({
        student: this.compactStudentRef(item.student),
        totalSessions: item.totalSessions || 0,
        evaluation: item.evaluation || {},
        homework: {
          pending: Number(item.homework?.pending || 0),
          list: Array.isArray(item.homework?.list)
            ? item.homework.list.slice(0, 5).map((homework: any) => ({
              sessionId: homework.sessionId,
              className: homework.className,
              topic: this.limitText(homework.topic || homework.homework, 160),
              dueDate: homework.dueDate || homework.deadline,
              status: homework.status,
              score: homework.score,
              materialCount: Array.isArray(homework.materialIds) ? homework.materialIds.length : 0,
              quizCount: Array.isArray(homework.quizIds) ? homework.quizIds.length : 0,
            }))
            : [],
        },
        recentComments: Array.isArray(item.recentComments)
          ? item.recentComments.slice(0, 3).map((comment: any) => ({
            sessionDate: comment.sessionDate,
            className: comment.className,
            teacherComment: this.limitText(comment.teacherComment, 160),
            overallComment: this.limitText(comment.overallComment, 160),
          }))
          : [],
        curriculumProgress: Array.isArray(item.curriculumProgress)
          ? item.curriculumProgress.slice(0, 5)
          : [],
      })),
      snapshots: learningSnapshots,
    };
  }

  private compactLearningSnapshot(snapshot: any) {
    return {
      generatedAt: snapshot?.generatedAt,
      sourceUpdatedAt: snapshot?.sourceUpdatedAt,
      dataCompletenessScore: snapshot?.dataCompletenessScore,
      dataWarnings: Array.isArray(snapshot?.dataWarnings) ? snapshot.dataWarnings.slice(0, 3) : [],
      sessionCount: snapshot?.sessionCount || 0,
      averagePerformance: snapshot?.averagePerformance,
      averageEngagement: snapshot?.averageEngagement,
      averageComprehension: snapshot?.averageComprehension,
      pendingHomework: Array.isArray(snapshot?.pendingHomework) ? snapshot.pendingHomework.slice(0, 5) : [],
      recentComments: Array.isArray(snapshot?.recentComments) ? snapshot.recentComments.slice(0, 3) : [],
      curriculumProgress: Array.isArray(snapshot?.curriculumProgress) ? snapshot.curriculumProgress.slice(0, 5) : [],
      upcomingSessions: Array.isArray(snapshot?.upcomingSessions) ? snapshot.upcomingSessions.slice(0, 5) : [],
      teachingMaterials: Array.isArray(snapshot?.teachingMaterials) ? snapshot.teachingMaterials.slice(0, 5) : [],
    };
  }

  private compactParentSessions(sessionRows: any[]) {
    const today = this.todayDateOnly();
    const upcoming = sessionRows
      .filter((session) => this.dateOnlyValue(session?.scheduledDate) >= today)
      .slice(0, 8)
      .map((session) => this.compactSessionRef(session));
    const recent = sessionRows
      .filter((session) => this.dateOnlyValue(session?.scheduledDate) < today)
      .slice(0, 8)
      .map((session) => this.compactSessionRef(session));

    return {
      totalLoaded: sessionRows.length,
      upcoming,
      recent,
      needsParentConfirmation: sessionRows
        .filter((session) => String(session?.status || '') === 'TEACHER_COMPLETED')
        .slice(0, 8)
        .map((session) => this.compactSessionRef(session)),
    };
  }

  private compactParentAttendance(stats: any, records: any) {
    const statChildren = Array.isArray(stats?.children) ? stats.children : [];
    const recordChildren = Array.isArray(records?.children) ? records.children : [];
    const recentRecords = recordChildren.flatMap((child: any) =>
      (Array.isArray(child.records) ? child.records : []).slice(0, 5).map((record: any) => ({
        student: this.compactStudentRef(child.student),
        date: record.date,
        status: record.status,
        className: record.className,
        classCode: record.classCode,
        parentConfirm: record.parentConfirm,
        notes: this.limitText(record.notes, 120),
      })),
    ).slice(0, 12);

    return {
      children: statChildren.slice(0, 8).map((child: any) => ({
        student: this.compactStudentRef(child.student),
        total: child.total || 0,
        present: child.present || 0,
        absent: child.absent || 0,
        late: child.late || 0,
        presentRate: child.presentRate || 0,
        absentRate: child.absentRate || 0,
        lateRate: child.lateRate || 0,
      })),
      recentRecords,
    };
  }

  private compactParentFinance(invoices: any, wallet: any, ledgerRows: any[]) {
    const invoiceChildren = Array.isArray(invoices?.children) ? invoices.children : [];
    const recentInvoices = invoiceChildren.flatMap((child: any) =>
      (Array.isArray(child.invoices) ? child.invoices : []).slice(0, 4).map((invoice: any) => ({
        student: this.compactStudentRef(child.student),
        invoiceId: invoice?._id?.toString?.() || String(invoice?._id || ''),
        invoiceNumber: invoice.invoiceNumber,
        className: invoice.classId?.name || invoice.className || '',
        amount: invoice.amount,
        status: invoice.status,
        createdAt: invoice.createdAt,
        remainingSessions: invoice.remainingSessions,
      })),
    ).slice(0, 12);

    return {
      invoiceSummary: invoices?.summary || {},
      recentInvoices,
      wallet: {
        walletId: wallet?._id?.toString?.() || String(wallet?._id || ''),
        balance: wallet?.balance,
        status: wallet?.status,
        totalTopUp: wallet?.totalTopUp,
        totalDeducted: wallet?.totalDeducted,
      },
      ledger: ledgerRows.slice(0, 10).map((entry) => ({
        ledgerEntryId: entry?._id?.toString?.() || String(entry?._id || ''),
        type: entry.type,
        status: entry.status,
        amount: entry.amount,
        createdAt: entry.createdAt,
        className: entry.classId?.name || '',
        studentName: entry.studentId?.fullName || '',
        sessionDate: entry.sessionId?.scheduledDate,
      })),
    };
  }

  private compactParentTickets(ticketRows: any[], tickets: any) {
    return {
      total: tickets?.meta?.total ?? ticketRows.length,
      openOrPending: ticketRows
        .filter((ticket) => !['RESOLVED', 'CLOSED'].includes(String(ticket.status || '')))
        .slice(0, 8)
        .map((ticket) => ({
          ticketId: ticket?._id?.toString?.() || String(ticket?._id || ''),
          ticketCode: ticket.ticketCode,
          type: ticket.type,
          subject: this.limitText(ticket.subject, 160),
          status: ticket.status,
          priority: ticket.priority,
          isOverdue: ticket.isOverdue,
          dueDate: ticket.dueDate,
          assignedTo: ticket.assignedTo?.fullName || '',
        })),
    };
  }

  private buildParentPriorityActions(input: {
    childCount: number;
    progress: any;
    invoices: any;
    wallet: any;
    ledgerRows: any[];
    attendance: any;
    ticketRows: any[];
    sessionRows: any[];
  }) {
    const actions: Array<{ type: string; severity: string; title: string; evidence?: unknown }> = [];
    if (!input.childCount) {
      actions.push({
        type: 'LINK_CHILD',
        severity: 'HIGH',
        title: 'Tai khoan phu huynh chua lien ket hoc sinh.',
      });
      return actions;
    }

    const totalPending = Number(input.invoices?.summary?.totalPending || 0);
    if (totalPending > 0) {
      actions.push({
        type: 'FINANCE_PENDING',
        severity: 'MEDIUM',
        title: 'Co hoa don dang cho xu ly hoac can doi chieu thanh toan.',
        evidence: { totalPending },
      });
    }

    const walletBalance = Number(input.wallet?.balance || 0);
    if (walletBalance <= 0) {
      actions.push({
        type: 'LOW_WALLET_BALANCE',
        severity: 'MEDIUM',
        title: 'Vi hien khong con so du duong; can kiem tra truoc cac buoi sap toi.',
        evidence: { balance: walletBalance },
      });
    }

    const pendingLedger = input.ledgerRows
      .filter((entry) => String(entry.status || '') === 'PENDING')
      .slice(0, 3);
    if (pendingLedger.length) {
      actions.push({
        type: 'PENDING_LEDGER',
        severity: 'MEDIUM',
        title: 'Co giao dich vi dang cho doi soat.',
        evidence: pendingLedger.map((entry) => ({
          type: entry.type,
          amount: entry.amount,
          createdAt: entry.createdAt,
        })),
      });
    }

    const homeworkPending = (Array.isArray(input.progress?.children) ? input.progress.children : [])
      .reduce((sum: number, child: any) => sum + Number(child.homework?.pending || 0), 0);
    if (homeworkPending > 0) {
      actions.push({
        type: 'HOMEWORK_PENDING',
        severity: 'LOW',
        title: 'Co bai tap cua con chua hoan tat/chua review xong.',
        evidence: { pending: homeworkPending },
      });
    }

    const attendanceRisks = (Array.isArray(input.attendance?.children) ? input.attendance.children : [])
      .filter((child: any) => Number(child.absent || 0) > 0 || Number(child.late || 0) > 0)
      .slice(0, 5);
    if (attendanceRisks.length) {
      actions.push({
        type: 'ATTENDANCE_RISK',
        severity: 'LOW',
        title: 'Co vang/muon trong khoang ngay dang xem.',
        evidence: attendanceRisks.map((child: any) => ({
          student: child.student?.fullName,
          absent: child.absent,
          late: child.late,
        })),
      });
    }

    const ticketsNeedingFollowUp = input.ticketRows
      .filter((ticket) => ticket.isOverdue || ['OPEN', 'IN_PROGRESS', 'REQUEST_INFO'].includes(String(ticket.status || '')))
      .slice(0, 5);
    if (ticketsNeedingFollowUp.length) {
      actions.push({
        type: 'SUPPORT_FOLLOW_UP',
        severity: ticketsNeedingFollowUp.some((ticket) => ticket.isOverdue) ? 'HIGH' : 'MEDIUM',
        title: 'Co ticket ho tro dang mo hoac qua han can theo doi.',
        evidence: ticketsNeedingFollowUp.map((ticket) => ({
          ticketCode: ticket.ticketCode,
          status: ticket.status,
          priority: ticket.priority,
          isOverdue: ticket.isOverdue,
        })),
      });
    }

    const needsConfirmation = input.sessionRows
      .filter((session) => String(session.status || '') === 'TEACHER_COMPLETED')
      .slice(0, 5);
    if (needsConfirmation.length) {
      actions.push({
        type: 'SESSION_CONFIRMATION',
        severity: 'LOW',
        title: 'Co buoi hoc da co bao cao va dang cho phu huynh xac nhan.',
        evidence: needsConfirmation.map((session) => this.compactSessionRef(session)),
      });
    }

    return actions.slice(0, 8);
  }

  private extractRows(value: any): any[] {
    if (Array.isArray(value)) return value;
    if (Array.isArray(value?.data)) return value.data;
    if (Array.isArray(value?.items)) return value.items;
    if (Array.isArray(value?.records)) return value.records;
    return [];
  }

  private compactStudentRef(value: any) {
    if (!value) return undefined;
    return {
      studentId: value?._id?.toString?.() || value?.studentId || String(value?._id || ''),
      fullName: value.fullName || value.name || '',
      studentCode: value.studentCode || '',
    };
  }

  private compactSessionRef(session: any) {
    return {
      sessionId: session?._id?.toString?.() || String(session?._id || ''),
      scheduledDate: session?.scheduledDate,
      scheduledStartTime: session?.scheduledStartTime,
      scheduledEndTime: session?.scheduledEndTime,
      status: session?.status,
      className: session?.classId?.name || session?.className || '',
      studentName: session?.studentId?.fullName || session?.studentName || '',
      teacherName: session?.teacherId?.fullName || session?.teacherName || '',
    };
  }

  private dateOnlyValue(value: unknown) {
    if (!value) return '';
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    const raw = String(value);
    if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
    const date = new Date(raw);
    return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
  }

  private limitText(value: unknown, limit: number) {
    const text = String(value || '').trim();
    if (text.length <= limit) return text;
    return `${text.slice(0, Math.max(0, limit - 3)).trim()}...`;
  }

  private getErrorMessage(error: unknown) {
    if (error instanceof Error && error.message.trim()) return error.message;
    return 'Unknown error';
  }

  private async getEntityDetail(input: AiToolInput, auth: AiAuthContext, allowedTypes: AiEntityType[]) {
    const entityContext = input.entityContext;
    if (!entityContext?.id || !entityContext?.type) {
      throw new BadRequestException('Detail tool can entityContext.type va entityContext.id');
    }

    const requestedType = entityContext.type as AiEntityType;
    if (!allowedTypes.includes(requestedType)) {
      throw new BadRequestException(`Detail tool khong nhan entity type: ${entityContext.type}`);
    }

    const detail = await this.entityResolver.getScopedEntityDetail(requestedType, entityContext.id, auth.user);
    if (!detail) {
      throw new NotFoundException('Khong tim thay entity trong pham vi duoc phep');
    }
    return detail;
  }

  private async getQuizAttemptDetail(input: AiToolInput, user: AiAuthContext['user']) {
    const entityContext = input.entityContext;
    if (entityContext?.type !== AiEntityType.QUIZ_ATTEMPT || !entityContext.id) {
      throw new BadRequestException('quiz_attempt_detail can entityContext.type=quiz_attempt va id');
    }
    return this.quizzesService.findAttemptForGrading(entityContext.id, user);
  }

  private async getTeachingMaterialDetail(input: AiToolInput, user: AiAuthContext['user']) {
    const entityContext = input.entityContext;
    if (entityContext?.type !== AiEntityType.TEACHING_MATERIAL || !entityContext.id) {
      throw new BadRequestException('teaching_material_detail can entityContext.type=teaching_material va id');
    }
    return this.teachingMaterialsService.findOne(entityContext.id, user);
  }

  private getSystemGuideContext(role: Role) {
    const common = {
      principles: [
        'Doc dashboard/queue truoc khi drill-down chi tiet.',
        'Khong thao tac ghi tien, duyet, xoa, gui hang loat neu chua co preview va confirm.',
        'Neu context thieu, phai noi ro can mo them tool/API nao.',
      ],
      screens: [
        '/app/dashboard',
        '/app/pending-approvals',
        '/app/financial-control',
        '/app/tickets',
        '/app/messages',
      ],
    };

    const byRole: Record<string, unknown> = {
      [Role.DIRECTOR]: {
        routine: ['Daily brief', 'Pending approvals', 'Finance risk', 'Ops bottleneck', 'Audit anomalies'],
        keyScreens: ['/app/dashboard', '/app/pending-approvals', '/app/financial-control', '/app/audit-log'],
      },
      [Role.ACCOUNTING]: {
        routine: ['Invoices cho duyet', 'Wallet/top-up', 'Payroll', 'Cashflow', 'Cong no', 'Reconciliation'],
        keyScreens: ['/app/invoices', '/app/wallets', '/app/payroll', '/app/financial-control', '/app/tickets'],
      },
      [Role.OPS]: {
        routine: ['Classes', 'Sessions', 'Tickets/SLA', 'Teacher/student operations', 'Trial/test operations'],
        keyScreens: ['/app/classes', '/app/sessions', '/app/tickets', '/app/attendance', '/app/trial-enrollments'],
      },
      [Role.TEACHER]: {
        routine: ['Lich day', 'Bao cao day', 'Hoc lieu', 'Ticket cua minh'],
        keyScreens: [
          '/app/teacher-dashboard',
          '/app/teacher-calendar',
          '/app/teaching-report',
          '/app/teaching-materials',
          '/app/tickets',
        ],
      },
      [Role.EXPERIENCE_TEACHER]: {
        routine: ['Queue cham bai', 'Review bai tap', 'Hoc lieu/quiz duoc giao', 'Ticket lien quan'],
        keyScreens: ['/app/homework-grading', '/app/teaching-materials', '/app/quizzes', '/app/tickets'],
      },
      [Role.PARENT]: {
        routine: ['Lich hoc cua con', 'Hoa don', 'Vi', 'Tien do hoc tap', 'Bai tap/hoc lieu', 'Support ticket'],
        keyScreens: ['/app/parent-dashboard', '/app/parent-invoices', '/app/parent-wallets', '/app/tickets'],
      },
      [Role.STUDENT]: {
        routine: ['Lich hoc', 'Bai tap/quiz', 'Hoc lieu', 'Tien do ca nhan'],
        keyScreens: ['/app/student-dashboard', '/app/student-quiz', '/app/teaching-materials'],
      },
      [Role.SALE]: {
        routine: [
          'Lead follow-up den han',
          'Cap nhat pipeline lead va don hang cua minh',
          'Theo doi hoc thu/test dang cho quyet dinh',
          'Kiem tra hoa hong/doanh thu ca nhan',
          'Cham soc conversation dang xu ly',
        ],
        keyScreens: [
          '/app/sale-dashboard',
          '/app/leads',
          '/app/orders',
          '/app/trial-enrollments',
          '/app/conversations',
        ],
      },
      [Role.ADSMANAGER]: {
        routine: ['Ads analytics', 'Actions required', 'Ad groups', 'Landing performance', 'Attribution'],
        keyScreens: ['/app/ads-analytics', '/app/ads-management', '/app/landing-pages'],
      },
      [Role.SHAREHOLDER]: {
        routine: ['Investor summary', 'Aggregate finance', 'Retention', 'Ads profit', 'Runway/burn rate'],
        keyScreens: ['/app/investor-dashboard'],
      },
    };

    return {
      ...common,
      role,
      roleGuide: byRole[role] || {
        routine: ['Hoi huong dan theo man hinh dang dung'],
        keyScreens: ['/app/dashboard'],
      },
    };
  }

  private getTeacherGuideContext(role: Role) {
    const commonRules = [
      'Chi xem va thao tac tren lop/buoi hoc duoc phan cong.',
      'Bao cao day, hoan thanh buoi hoc, huy buoi/no-show deu can dung dung man hinh va ly do.',
      'Khong xem luong nguoi khac, khong sua hoc phi, vi, hoa don hoac thong tin ngoai scope giao vien.',
      'Neu cau hoi thieu ma buoi/lop/hoc sinh, AI phai hoi lai hoac goi drill-down truoc khi de xuat thao tac.',
    ];

    if (role === Role.EXPERIENCE_TEACHER) {
      return {
        role,
        title: 'Huong dan tro ly giao vien review',
        dailyRoutine: [
          'Mo Homework Grading de xem bai tap da nop dang cho cham/review.',
          'Kiem tra queue quiz can cham tay va cau tra loi tu luan/short text.',
          'Doc yeu cau, bai nop, attempt quiz va rubric/hoc lieu READY neu co truoc khi cham.',
          'Soan diem va nhan xet co bang chung; chi publish/cham sau khi tao draft va nguoi dung xac nhan.',
          'Neu bai nop thieu file/noi dung, tao ghi chu ro can bo sung gi.',
        ],
        keyScreens: [
          { route: '/app/homework-grading', purpose: 'Cham/review bai tap hoc sinh' },
          { route: '/app/teaching-materials', purpose: 'Tra cuu hoc lieu lien quan' },
          { route: '/app/quizzes', purpose: 'Tra cuu quiz va cau hoi luyen tap' },
          { route: '/app/tickets', purpose: 'Theo doi ticket lien quan bai tap/hoc lieu' },
        ],
        allowedActions: [
          'Doc queue bai tap can cham.',
          'Doc queue quiz can cham tay.',
          'Tra cuu hoc lieu/rubric scoped va chunk ngan da extract.',
          'Soan nhan xet/draft diem theo bai nop.',
          'Goi y hoc lieu/quiz bo sung neu du lieu cho phep.',
        ],
        writeActionsNeedConfirmation: [
          'Cham diem bai tap.',
          'Cham diem quiz/attempt.',
          'Gui file/nhan xet review.',
          'Cap nhat hoc lieu/quiz neu duoc phan quyen.',
        ],
        commonRules,
      };
    }

    return {
      role,
      title: 'Huong dan tro ly giao vien',
      dailyRoutine: [
        'Dau ngay: xem Dashboard giao vien va Lich day de biet buoi sap toi.',
        'Truoc buoi hoc: mo chi tiet buoi, kiem tra lop, hoc sinh, diem danh gan day, muc tieu bai hoc va hoc lieu.',
        'Sau buoi hoc: bam hoan thanh buoi, nhap noi dung da day va bai tap neu co.',
        'Trong ngay: vao Bao cao day de nop cac buoi con thieu, tranh tre deadline.',
        'Khi co su co hoac tin nhan: xem unread/conversation, tao ticket hoac cap nhat ticket cua minh kem session/lop lien quan.',
      ],
      keyScreens: [
        { route: '/app/teacher-dashboard', purpose: 'Tong quan lich, lop, thu nhap va ticket cua giao vien' },
        { route: '/app/teacher-calendar', purpose: 'Xem lich day theo ngay/tuan/thang' },
        { route: '/app/sessions', purpose: 'Tra cuu buoi hoc duoc phan cong' },
        { route: '/app/teaching-report', purpose: 'Nop va xem lich su bao cao day' },
        { route: '/app/teaching-materials', purpose: 'Tra cuu hoc lieu giao/bai tap' },
        { route: '/app/tickets', purpose: 'Tao/theo doi su co, doi lich, ho tro lop hoc' },
      ],
      allowedActions: [
        'Hoi lich day, buoi sap toi, lop dang phu trach.',
        'Hoi buoi nao chua nop bao cao hoac da nop bao cao.',
        'Hoi diem danh, lop co hoc sinh vang/muon va attendance trong scope cua minh.',
        'Tim hoc lieu, worksheet, slide, lesson plan, rubric va bai tap trong kho hoc lieu cua minh.',
        'Hoi ticket, tin nhan chua doc va conversation cua chinh minh.',
        'Hoi thu nhap/pending payout/bang luong cua chinh minh.',
        'Soan nhap bao cao day, noi dung bai hoc, bai tap va nhan xet hoc sinh.',
        'Tao ticket ho tro cua chinh minh neu du thong tin bat buoc.',
      ],
      writeActionsNeedConfirmation: [
        'Danh dau/sua diem danh.',
        'Hoan thanh buoi day.',
        'Nop/cap nhat bao cao day.',
        'Huy buoi hoc hoac bao no-show.',
        'Tao/sua/giao hoc lieu hoac homework.',
        'Tao ticket ho tro.',
        'Gui tin nhan.',
      ],
      commonRules,
      responseStyle: [
        'Tra loi ngan gon theo viec can lam, buoi/lop lien quan va man hinh can vao.',
        'Neu la bao cao day, tach ro: noi dung da day, danh gia hoc sinh, bai tap, viec can xac nhan.',
        'Neu la lich day, uu tien ngay gio gan nhat va trang thai buoi hoc.',
        'Neu la diem danh/ticket/hoc lieu, neu ro khoang ngay/filter dang dung va phan biet viec da co du lieu voi viec can thao tac xac nhan.',
      ],
    };
  }

  private getSaleGuideContext(role: Role) {
    return {
      role,
      title: 'Huong dan tro ly sales',
      dailyRoutine: [
        'Dau ngay: xem Sale Dashboard va Viec trong ngay de nam lead/order can xu ly.',
        'Xu ly lead co nextFollowUp den han truoc, ghi lai ket qua lien he va hen follow-up tiep theo.',
        'Kiem tra pipeline lead theo trang thai NEW/CONTACTED/CONSULTING/INTERESTED de chon uu tien cham soc.',
        'Theo doi order dang Draft/Needs info/Submitted de bo sung ho so dung han.',
        'Kiem tra hoc thu/test dang pending hoac waiting decision de chot buoc tiep theo.',
        'Cuoi ngay: doi chieu doanh thu/hoa hong ca nhan va cac lead chua co lich follow-up.',
      ],
      keyScreens: [
        { route: '/app/sale-dashboard', purpose: 'Tong quan lead, order, conversion va doanh thu cua sale' },
        { route: '/app/leads', purpose: 'Quan ly lead, lich su lien he, follow-up va trang thai cham soc' },
        { route: '/app/orders', purpose: 'Tao/theo doi don dang ky, bo sung thong tin va trang thai duyet' },
        { route: '/app/trial-enrollments', purpose: 'Theo doi hoc thu/test, giao vien trai nghiem va quyet dinh sau test' },
        { route: '/app/conversations', purpose: 'Cham soc hoi thoai tu phu huynh/lead' },
      ],
      allowedActions: [
        'Hoi lead nao can follow-up trong ngay.',
        'Hoi pipeline lead/order cua chinh minh.',
        'Hoi don hang nao dang cho bo sung, cho duyet hoac da duyet.',
        'Hoi danh sach hoc thu/test dang can chot quyet dinh.',
        'Hoi doanh thu/hoa hong ca nhan theo khoang ngay.',
        'Soan noi dung cham soc lead, ghi chu lien he hoac checklist bo sung order.',
      ],
      writeActionsNeedConfirmation: [
        'Cap nhat trang thai lead.',
        'Them lich su lien he/follow-up cho lead.',
        'Tao/sua/gui duyet order.',
        'Cap nhat hoc thu/test hoac chot ket qua sau test.',
        'Gui tin nhan cho phu huynh/lead.',
      ],
      commonRules: [
        'Sale chi xem lead, order, hoc thu va conversation trong scope cua minh.',
        'Khong truyen saleId tu cau hoi cua user vao tool sale; saleId lay tu JWT.',
        'Khong tu cam ket hoc phi, uu dai, lich hoc hoac hoa hong neu context khong co du lieu xac nhan.',
        'Moi thao tac ghi phai co preview noi dung thay doi va nguoi dung xac nhan.',
      ],
      responseStyle: [
        'Uu tien danh sach viec can lam theo muc do khan cap va trang thai.',
        'Khi noi ve lead/order, neu co thi neu ma lead/order, ten phu huynh/hoc sinh, trang thai va buoc tiep theo.',
        'Neu thieu lead/order cu the, hoi lai ma hoac goi y vao man hinh dung de loc.',
      ],
    };
  }

  private getAccountingGuideContext(role: Role) {
    return {
      role,
      title: 'Huong dan tro ly ke toan',
      dailyRoutine: [
        'Dau ngay: xem dashboard ke toan, pending approvals va canh bao tai chinh.',
        'Xu ly hoa don/top-up/payout theo hang cho duyet, doi chieu chung tu truoc khi duyet.',
        'Theo doi cong no, aging report va cashflow de uu tien thu/chi.',
        'Kiem tra payroll/hoa hong/bang luong theo ky, moi dieu chinh can co ly do.',
        'Xu ly ticket tai chinh cua minh va ghi ro can bo sung chung tu nao.',
      ],
      keyScreens: [
        { route: '/app/invoices', purpose: 'Danh sach hoa don, hoa don cho duyet va chung tu' },
        { route: '/app/wallets', purpose: 'Vi phu huynh/hoc vien va top-up' },
        { route: '/app/payroll', purpose: 'Bang luong giao vien/nhan su theo ky' },
        { route: '/app/financial-control', purpose: 'Cashflow, cong no, P&L va reconciliation' },
        { route: '/app/tickets', purpose: 'Ticket lien quan tai chinh/chung tu' },
      ],
      writeActionsNeedConfirmation: ['Duyet/tu choi hoa don', 'Xac nhan thanh toan', 'Dieu chinh vi/payroll', 'Ghi giao dich quy/ngan hang'],
      commonRules: ['Khong ghi giao dich tien khi chua co preview va confirm.', 'Khong xem/sua ngoai pham vi tai chinh duoc phan quyen.'],
    };
  }

  private getOpsGuideContext(role: Role) {
    return {
      role,
      title: 'Huong dan tro ly van hanh',
      dailyRoutine: [
        'Dau ngay: xem OPS dashboard, daily tasks va ticket/SLA.',
        'Kiem tra session sap toi, session chua finalize/no-show va lich giao vien.',
        'Theo doi lop active, hoc sinh moi, pending assignment va trial/test.',
        'Xu ly ticket theo muc do uu tien, assign dung nguoi va cap nhat SLA.',
      ],
      keyScreens: [
        { route: '/app/classes', purpose: 'Quan ly lop, giao vien, hoc sinh va cau hinh lop' },
        { route: '/app/sessions', purpose: 'Lich/buoi hoc, finalize, doi lich va attendance' },
        { route: '/app/tickets', purpose: 'Ticket van hanh va SLA' },
        { route: '/app/trial-enrollments', purpose: 'Hoc thu/test va giao vien trai nghiem' },
        { route: '/app/attendance', purpose: 'Diem danh va doi soat buoi hoc' },
      ],
      writeActionsNeedConfirmation: ['Doi/huy/finalize buoi hoc', 'Assign/resolve ticket', 'Sua lop/hoc sinh/giao vien', 'Dat lich test'],
      commonRules: ['Uu tien aggregate/queue truoc khi drill-down.', 'Moi thay doi lich/lop/ticket can preview va confirm.'],
    };
  }

  private getParentGuideContext(role: Role) {
    return {
      role,
      title: 'Huong dan tro ly phu huynh',
      dailyRoutine: [
        'Xem lich hoc sap toi cua con va cac buoi da hoan thanh.',
        'Theo doi hoa don, vi, so buoi con lai va cong no neu co.',
        'Doc tien do hoc tap, bai tap, nhan xet giao vien va hoc lieu gan day.',
        'Tao ticket khi can doi lich, hoi hoc phi hoac can ho tro lop hoc.',
      ],
      keyScreens: [
        { route: '/app/parent-dashboard', purpose: 'Tong quan con, lich hoc, tien do va viec can lam' },
        { route: '/app/parent-invoices', purpose: 'Hoa don va lich su thanh toan' },
        { route: '/app/parent-wallets', purpose: 'Vi va so du' },
        { route: '/app/tickets', purpose: 'Yeu cau ho tro cua phu huynh' },
      ],
      writeActionsNeedConfirmation: ['Tao ticket', 'Gui feedback phu huynh', 'Xac nhan/yeu cau doi lich neu workflow cho phep'],
      commonRules: ['Chi xem du lieu cua con lien ket voi tai khoan phu huynh.', 'Khong hien thong tin hoc sinh/phu huynh khac.'],
    };
  }

  private getStudentGuideContext(role: Role) {
    return {
      role,
      title: 'Huong dan tro ly hoc sinh',
      dailyRoutine: [
        'Xem lich hoc va buoi sap toi.',
        'Lam quiz/bai tap duoc giao va xem feedback neu co.',
        'Doc hoc lieu gan day va ghi chu noi dung can on.',
        'Hoi tien do ca nhan va diem can luyen them.',
      ],
      keyScreens: [
        { route: '/app/student-dashboard', purpose: 'Tong quan lich hoc va tien do ca nhan' },
        { route: '/app/student-quiz', purpose: 'Lam quiz va xem ket qua' },
        { route: '/app/teaching-materials', purpose: 'Hoc lieu duoc chia se' },
      ],
      writeActionsNeedConfirmation: ['Nop quiz/bai tap', 'Gui cau hoi/feedback neu workflow cho phep'],
      commonRules: ['Chi xem du lieu cua hoc sinh dang dang nhap.', 'Khong xem tai chinh phu huynh hoac hoc sinh khac.'],
    };
  }

  private getAdsGuideContext(role: Role) {
    return {
      role,
      title: 'Huong dan tro ly ads',
      dailyRoutine: [
        'Xem actions required va ads analytics theo khoang ngay.',
        'Kiem tra ad group co spend cao, CPL/CPA bat thuong hoac conversion thap.',
        'Doi chieu attribution lead/order va landing performance.',
        'De xuat dung/tang/giam ngan sach chi o muc preview.',
      ],
      keyScreens: [
        { route: '/app/ads-analytics', purpose: 'Hieu qua ads, ROI, cohort va actions required' },
        { route: '/app/ads-management', purpose: 'Tai khoan/nhom quang cao va chi phi' },
        { route: '/app/landing-pages', purpose: 'Landing page va tracking' },
      ],
      writeActionsNeedConfirmation: ['Doi ngan sach', 'Dung/bat campaign/ad group', 'Sync cost/token', 'Sua tracking/landing'],
      commonRules: ['Moi thay doi ads phai preview va confirm/approval.', 'Khong ket luan ROI neu data chua sync du.'],
    };
  }

  private getShareholderGuideContext(role: Role) {
    return {
      role,
      title: 'Huong dan tro ly co dong',
      dailyRoutine: [
        'Xem investor metrics va aggregate finance.',
        'Theo doi runway, burn rate, retention, churn va unit economics.',
        'Chi drill-down o muc aggregate/summary, tranh PII va chi tiet noi bo nhay cam.',
      ],
      keyScreens: [
        { route: '/app/investor-dashboard', purpose: 'Bao cao co dong va chi so tang truong' },
        { route: '/app/financial-control', purpose: 'Chi xem aggregate tai chinh duoc phep' },
      ],
      writeActionsNeedConfirmation: [],
      commonRules: ['Shareholder read-only.', 'Mac dinh khong hien PII, audit noi bo, token, conversation chi tiet.'],
    };
  }

  private todayDateOnly() {
    return new Date().toISOString().slice(0, 10);
  }

  private addDaysDateOnly(dateOnly: string, days: number) {
    const date = new Date(`${dateOnly}T00:00:00.000Z`);
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
  }

  private currentMonthStartDateOnly() {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
  }

  private normalizeLimit(value: unknown, fallback: number) {
    const parsed = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(parsed) || parsed < 1) {
      return fallback;
    }
    return Math.min(Math.floor(parsed), 30);
  }

  private getTeachingMaterialFilters(input: AiToolInput, fallbackLimit: number) {
    return {
      search: input.filters?.search as string | undefined,
      materialId: input.filters?.materialId as string | undefined,
      subject: input.filters?.subject as string | undefined,
      grade: input.filters?.grade as string | undefined,
      classId: input.filters?.classId as string | undefined,
      productId: input.filters?.productId as string | undefined,
      courseName: input.filters?.courseName as string | undefined,
      unitCode: input.filters?.unitCode as string | undefined,
      lessonCode: input.filters?.lessonCode as string | undefined,
      fileCategory: input.filters?.fileCategory as any,
      extractionStatus: input.filters?.extractionStatus as any,
      materialScope: input.filters?.materialScope as any,
      materialType: input.filters?.materialType as any,
      usagePhase: input.filters?.usagePhase as any,
      difficulty: input.filters?.difficulty as any,
      status: input.filters?.status as any,
      assignableAsHomework: this.normalizeOptionalBoolean(input.filters?.assignableAsHomework),
      page: 1,
      limit: this.normalizeLimit(input.filters?.limit, fallbackLimit),
    };
  }

  private normalizeOptionalBoolean(value: unknown): boolean | undefined {
    if (typeof value === 'boolean') {
      return value;
    }
    if (typeof value !== 'string') {
      return undefined;
    }
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes'].includes(normalized)) {
      return true;
    }
    if (['false', '0', 'no'].includes(normalized)) {
      return false;
    }
    return undefined;
  }

  private normalizeTeacherStatus(value: unknown): TeacherStatus | undefined {
    if (typeof value !== 'string') {
      return undefined;
    }
    return Object.values(TeacherStatus).includes(value as TeacherStatus)
      ? value as TeacherStatus
      : undefined;
  }

  private normalizeStringList(value: unknown): string[] | undefined {
    if (Array.isArray(value)) {
      const items = value.map((item) => String(item).trim()).filter(Boolean);
      return items.length ? items : undefined;
    }
    if (typeof value !== 'string') {
      return undefined;
    }
    const items = value.split(',').map((item) => item.trim()).filter(Boolean);
    return items.length ? items : undefined;
  }

  private normalizeBoolean(value: unknown): boolean | undefined {
    if (typeof value === 'boolean') return value;
    if (typeof value !== 'string') return undefined;
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes'].includes(normalized)) return true;
    if (['false', '0', 'no'].includes(normalized)) return false;
    return undefined;
  }

  private toDateBoundary(dateOnly: string, endOfDay: boolean) {
    return new Date(`${dateOnly}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`);
  }
}
