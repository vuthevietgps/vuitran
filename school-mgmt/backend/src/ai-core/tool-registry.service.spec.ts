import { AiAssistantType } from '../chatbot/schemas/ai-assistant-profile.schema';
import { Role } from '../common/interfaces/role.enum';
import { AiToolRegistryService } from './tool-registry.service';

describe('AiToolRegistryService parent packet', () => {
  const parentUser = {
    sub: '64b000000000000000000001',
    _id: '64b000000000000000000001',
    userId: '64b000000000000000000001',
    email: 'parent@example.com',
    role: Role.PARENT,
    fullName: 'Parent Demo',
  };
  const accountingUser = {
    sub: '64b000000000000000000002',
    _id: '64b000000000000000000002',
    userId: '64b000000000000000000002',
    email: 'accounting@example.com',
    role: Role.ACCOUNTING,
    fullName: 'Accounting Demo',
  };
  const opsUser = {
    sub: '64b000000000000000000003',
    _id: '64b000000000000000000003',
    userId: '64b000000000000000000003',
    email: 'ops@example.com',
    role: Role.OPS,
    fullName: 'Ops Demo',
  };

  function buildService(overrides: Record<string, any> = {}) {
    const dashboardService = overrides.dashboardService || {
      getParentDashboard: jest.fn().mockResolvedValue({ todayTasks: 2 }),
    };
    const invoicesService = overrides.invoicesService || {
      getParentInvoices: jest.fn().mockResolvedValue({
        summary: { totalPaid: 1000000, totalPending: 200000, totalSessionsRemaining: 3 },
        children: [],
      }),
    };
    const studentSupportSnapshotService = overrides.studentSupportSnapshotService || {
      getOrBuild: jest.fn().mockResolvedValue({
        generatedAt: '2026-06-10T00:00:00.000Z',
        dataCompletenessScore: 90,
        sessionCount: 4,
        pendingHomework: [{ className: 'Math', homework: 'Worksheet 1', status: 'ASSIGNED' }],
        teachingMaterials: [{ title: 'Unit 1', className: 'Math' }],
      }),
    };
    const sessionsService = overrides.sessionsService || {
      findAll: jest.fn().mockResolvedValue([
        {
          _id: '64b000000000000000000101',
          status: 'TEACHER_COMPLETED',
          scheduledDate: '2026-06-10',
          classId: { name: 'Math 1' },
          studentId: { fullName: 'Minh' },
        },
      ]),
      getChildrenProgress: jest.fn().mockResolvedValue({
        children: [{
          student: { _id: '64b000000000000000000201', fullName: 'Minh', studentCode: 'HS001' },
          totalSessions: 4,
          evaluation: { avgPerformance: 8 },
          homework: {
            pending: 2,
            list: [{ topic: 'Worksheet 1', status: 'ASSIGNED', className: 'Math 1' }],
          },
          recentComments: [],
          curriculumProgress: [],
        }],
      }),
    };
    const studentsService = overrides.studentsService || {
      findAll: jest.fn().mockResolvedValue([
        { _id: '64b000000000000000000201', fullName: 'Minh', studentCode: 'HS001', grade: '5' },
      ]),
    };
    const ticketsService = overrides.ticketsService || {
      findMyTickets: jest.fn().mockResolvedValue({
        data: [{ ticketCode: 'TKT-1', status: 'OPEN', priority: 'HIGH', subject: 'Need support' }],
        meta: { total: 1 },
      }),
    };
    const attendanceService = overrides.attendanceService || {
      getChildrenAttendanceStats: jest.fn().mockResolvedValue({
        children: [{
          student: { _id: '64b000000000000000000201', fullName: 'Minh', studentCode: 'HS001' },
          total: 5,
          present: 3,
          absent: 1,
          late: 1,
          presentRate: 60,
          absentRate: 20,
          lateRate: 20,
        }],
      }),
      getChildrenAttendance: jest.fn().mockResolvedValue({
        children: [{
          student: { _id: '64b000000000000000000201', fullName: 'Minh', studentCode: 'HS001' },
          records: [{ date: '2026-06-09', status: 'ABSENT', className: 'Math 1' }],
        }],
      }),
    };
    const walletsService = overrides.walletsService || {
      getOrCreateWalletView: jest.fn().mockResolvedValue({
        _id: '64b000000000000000000301',
        balance: 0,
        totalTopUp: 500000,
        totalDeducted: 500000,
        status: 'ACTIVE',
      }),
      queryLedger: jest.fn().mockResolvedValue({
        data: [{ type: 'TOP_UP', status: 'PENDING', amount: 200000, createdAt: '2026-06-10' }],
        meta: { total: 1 },
      }),
    };
    const pendingApprovalsService = overrides.pendingApprovalsService || {};
    const trialEnrollmentsService = overrides.trialEnrollmentsService || {};
    const teachersService = overrides.teachersService || {};

    const service = new AiToolRegistryService(
      dashboardService as any,
      pendingApprovalsService as any,
      (overrides.financialControlService || {}) as any,
      {} as any,
      {} as any,
      {} as any,
      invoicesService as any,
      {} as any,
      {} as any,
      studentSupportSnapshotService as any,
      {} as any,
      sessionsService as any,
      studentsService as any,
      ticketsService as any,
      {} as any,
      {} as any,
      trialEnrollmentsService as any,
      attendanceService as any,
      {} as any,
      teachersService as any,
      walletsService as any,
      (overrides.payrollService || {}) as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    return { service, walletsService, attendanceService, studentSupportSnapshotService };
  }

  it('builds a parent packet with finance, attendance, homework, ticket and confirmation actions', async () => {
    const { service, walletsService, attendanceService, studentSupportSnapshotService } = buildService();

    const result = await service.execute(
      'parent_success_packet',
      { fromDate: '2026-06-01', toDate: '2026-06-10' },
      { user: parentUser, assistantType: AiAssistantType.PARENT_SUPPORT },
    );

    const data = result.data as any;
    expect(data.scope).toBe('OWN_CHILDREN_AND_OWN_WALLET');
    expect(data.priorityActions.map((action: any) => action.type)).toEqual(
      expect.arrayContaining([
        'FINANCE_PENDING',
        'LOW_WALLET_BALANCE',
        'PENDING_LEDGER',
        'HOMEWORK_PENDING',
        'ATTENDANCE_RISK',
        'SUPPORT_FOLLOW_UP',
        'SESSION_CONFIRMATION',
      ]),
    );
    expect(walletsService.queryLedger).toHaveBeenCalledWith(
      expect.objectContaining({ userId: parentUser.sub, limit: 20 }),
    );
    expect(attendanceService.getChildrenAttendanceStats).toHaveBeenCalledWith(
      parentUser.sub,
      '2026-06-01',
      '2026-06-10',
    );
    expect(studentSupportSnapshotService.getOrBuild).toHaveBeenCalledWith(
      parentUser.sub,
      '64b000000000000000000201',
    );
  });

  it('builds an OPS deep SLA packet with prioritized risks and next actions', async () => {
    const { service } = buildService({
      dashboardService: {
        getDailyTasks: jest.fn().mockResolvedValue({
          summary: { totalTasks: 2, overdueTasks: 1, highPriorityTasks: 2 },
          tabs: [{
            key: 'sessions',
            tasks: [{
              id: 'ops-session-finalize-64b000000000000000000111',
              type: 'SESSION_WAITING_FINALIZATION',
              title: 'Chot buoi Minh',
              status: 'TEACHER_COMPLETED',
              priority: 'HIGH',
              overdue: true,
              dueAt: '2026-06-09T00:00:00.000Z',
              route: '/app/sessions',
              actionLabel: 'Mo buoi hoc',
            }],
          }],
        }),
        getOpsDashboard: jest.fn().mockResolvedValue({
          sessions: { upcomingToday: 3, needsFinalization: 2, byStatus: { TEACHER_COMPLETED: 2 } },
          tickets: { overdueCount: 1, byPriority: { URGENT: 1 }, byStatus: { OPEN: 1 } },
          teachers: { pendingApproval: 1, suspended: 0 },
        }),
      },
      sessionsService: {
        findAll: jest.fn().mockResolvedValue({
          data: [{
            _id: '64b000000000000000000111',
            status: 'TEACHER_COMPLETED',
            scheduledDate: '2026-06-09',
            classId: { name: 'Math 1' },
            studentId: { fullName: 'Minh' },
            teacherId: { fullName: 'Teacher A' },
          }],
          meta: { total: 1 },
        }),
      },
      ticketsService: {
        findAll: jest.fn().mockResolvedValue({
          data: [{
            _id: '64b000000000000000000222',
            ticketCode: 'TKT-9',
            subject: 'Qua SLA',
            priority: 'URGENT',
            status: 'OPEN',
            dueDate: '2026-06-09T00:00:00.000Z',
          }],
          meta: { total: 1 },
        }),
      },
      attendanceService: {
        getAttendanceReport: jest.fn().mockResolvedValue({
          data: [{ status: 'ABSENT', studentId: { fullName: 'Minh' } }],
          meta: { total: 1 },
        }),
      },
      trialEnrollmentsService: {
        getSummary: jest.fn().mockResolvedValue({ byStatus: { WAITING_DECISION: 1 } }),
        findAll: jest.fn().mockResolvedValue({
          data: [{ _id: '64b000000000000000000333', status: 'WAITING_DECISION', trialCode: 'TRIAL-1' }],
          meta: { total: 1 },
        }),
      },
      pendingApprovalsService: {
        getSummary: jest.fn().mockResolvedValue({ teachers: { count: 1 }, classes: { count: 1 } }),
      },
      teachersService: {
        getStats: jest.fn().mockResolvedValue({ pendingApproval: 1 }),
      },
    });

    const result = await service.execute(
      'ops_deep_sla_packet',
      { fromDate: '2026-06-10', toDate: '2026-06-10' },
      { user: opsUser, assistantType: AiAssistantType.OPS_OPERATIONS },
    );
    const data = result.data as any;

    expect(data.executiveSummary.sessions.needsFinalization).toBe(2);
    expect(data.executiveSummary.tickets.overdueCount).toBe(1);
    expect(data.riskItems.map((item: any) => item.area)).toEqual(
      expect.arrayContaining(['TICKET_SLA', 'SESSION', 'TRIAL_TEST', 'ATTENDANCE']),
    );
    expect(data.nextActions[0]).toMatchObject({
      severity: 'CRITICAL',
      route: '/app/tickets',
    });
  });

  it('marks accounting paginated tool results as truncated when total exceeds shown rows', async () => {
    const { service } = buildService({
      payrollService: {
        findAll: jest.fn().mockResolvedValue({
          data: Array.from({ length: 30 }, (_, index) => ({ id: String(index + 1) })),
          meta: { total: 42, page: 1, limit: 30 },
        }),
      },
    });

    const result = await service.execute(
      'accounting_payrolls',
      { fromDate: '2026-06-01', toDate: '2026-06-10' },
      { user: accountingUser, assistantType: AiAssistantType.ACCOUNTING_OPERATIONS },
    );

    expect(result.metadata).toMatchObject({
      truncated: true,
      totalItems: 42,
      shownItems: 30,
    });
    expect(result.metadata.warnings?.join(' ')).toContain('shown 30/42');
  });

  it('surfaces accounting reconciliation warnings when bankAccountId is missing', async () => {
    const { service } = buildService({
      financialControlService: {
        getBankAccountSummary: jest.fn().mockResolvedValue({ totalBalance: 0, accountCount: 0, accounts: [] }),
      },
    });

    const result = await service.execute(
      'accounting_bank_reconciliation',
      { fromDate: '2026-06-01', toDate: '2026-06-10' },
      { user: accountingUser, assistantType: AiAssistantType.ACCOUNTING_OPERATIONS },
    );

    expect(result.metadata.truncated).toBe(false);
    expect(result.metadata.warnings?.join(' ')).toContain('bankAccountId');
  });
});
