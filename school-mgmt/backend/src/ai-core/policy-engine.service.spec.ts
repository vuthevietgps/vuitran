import { ForbiddenException } from '@nestjs/common';
import { AiAssistantType } from '../chatbot/schemas/ai-assistant-profile.schema';
import { Role } from '../common/interfaces/role.enum';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { AiPolicyEngineService } from './policy-engine.service';
import { getAiCoreSituationDefinition } from './catalogs/situation.catalog';
import { getAiCoreToolDefinition } from './catalogs/tool.catalog';
import { AiSituationDefinition } from './ai-core.types';

function user(role: Role): JwtPayload {
  return {
    sub: '64b000000000000000000001',
    _id: '64b000000000000000000001',
    userId: '64b000000000000000000001',
    email: `${role.toLowerCase()}@example.com`,
    role,
    fullName: role,
  };
}

describe('AiPolicyEngineService', () => {
  let service: AiPolicyEngineService;

  beforeEach(() => {
    service = new AiPolicyEngineService();
  });

  it('denies a parent from using the director assistant', () => {
    expect(() =>
      service.assertAssistantAllowed(user(Role.PARENT), AiAssistantType.DIRECTOR_OPERATIONS),
    ).toThrow(ForbiddenException);
  });

  it('allows a teacher to use teacher-owned dashboard tools only', () => {
    const teacher = user(Role.TEACHER);
    const teacherTool = getAiCoreToolDefinition('teacher_dashboard')!;
    const parentTool = getAiCoreToolDefinition('parent_dashboard')!;

    expect(service.isToolAllowed(teacher, AiAssistantType.TEACHER_SUPPORT, teacherTool)).toBe(true);
    expect(service.isToolAllowed(teacher, AiAssistantType.TEACHER_SUPPORT, parentTool)).toBe(false);
  });

  it('loads teacher report queue tools for teacher support', () => {
    const teacher = user(Role.TEACHER);
    const situation = getAiCoreSituationDefinition('teacher_report_queue')!;

    const tools = service.getAllowedToolsForSituation(
      teacher,
      AiAssistantType.TEACHER_SUPPORT,
      situation,
    );

    expect(tools.map((tool) => tool.key)).toEqual(
      expect.arrayContaining(['daily_tasks', 'teacher_pending_reports', 'teacher_dashboard']),
    );
    expect(tools.some((tool) => tool.key === 'parent_dashboard')).toBe(false);
  });

  it('loads expanded teacher attendance, material, support and payroll tools', () => {
    const teacher = user(Role.TEACHER);

    const attendanceTools = service.getAllowedToolsForSituation(
      teacher,
      AiAssistantType.TEACHER_SUPPORT,
      getAiCoreSituationDefinition('teacher_attendance_support')!,
    );
    expect(attendanceTools.map((tool) => tool.key)).toEqual(
      expect.arrayContaining(['teacher_attendance_classes', 'teacher_attendance_report', 'teacher_my_sessions']),
    );

    const materialTools = service.getAllowedToolsForSituation(
      teacher,
      AiAssistantType.TEACHER_SUPPORT,
      getAiCoreSituationDefinition('teacher_material_preparation')!,
    );
    expect(materialTools.map((tool) => tool.key)).toEqual(
      expect.arrayContaining(['teacher_materials', 'teacher_material_stats', 'teacher_upcoming_sessions']),
    );

    const supportTools = service.getAllowedToolsForSituation(
      teacher,
      AiAssistantType.TEACHER_SUPPORT,
      getAiCoreSituationDefinition('teacher_ticket_message_support')!,
    );
    expect(supportTools.map((tool) => tool.key)).toEqual(
      expect.arrayContaining(['teacher_my_tickets', 'teacher_messages_unread', 'teacher_conversations']),
    );

    const payrollTools = service.getAllowedToolsForSituation(
      teacher,
      AiAssistantType.TEACHER_SUPPORT,
      getAiCoreSituationDefinition('teacher_personal_payroll')!,
    );
    expect(payrollTools.map((tool) => tool.key)).toEqual(
      expect.arrayContaining(['teacher_dashboard', 'teacher_payrolls', 'teacher_my_tickets']),
    );
  });

  it('adds the teacher guide when a teacher asks for system guidance', () => {
    const teacher = user(Role.TEACHER);
    const situation = getAiCoreSituationDefinition('system_guide')!;

    const tools = service.getAllowedToolsForSituation(
      teacher,
      AiAssistantType.TEACHER_SUPPORT,
      situation,
    );

    expect(tools.map((tool) => tool.key)).toEqual(expect.arrayContaining(['system_guide', 'teacher_guide']));
  });

  it('allows experience teachers to read deep review queues only through their assistant', () => {
    const reviewer = user(Role.EXPERIENCE_TEACHER);
    const situation = getAiCoreSituationDefinition('experience_teacher_homework_review')!;

    const tools = service.getAllowedToolsForSituation(
      reviewer,
      AiAssistantType.EXPERIENCE_TEACHER_SUPPORT,
      situation,
    );

    expect(tools.map((tool) => tool.key)).toEqual(expect.arrayContaining([
      'homework_grading_queue',
      'quiz_grading_queue',
      'teaching_materials_search',
      'teaching_material_chunks_search',
      'teacher_guide',
    ]));
    expect(() =>
      service.getAllowedToolsForSituation(
        reviewer,
        AiAssistantType.TEACHER_SUPPORT,
        situation,
      ),
    ).toThrow(ForbiddenException);
  });

  it('loads sale follow-up tools for sale operations', () => {
    const sale = user(Role.SALE);
    const situation = getAiCoreSituationDefinition('sale_daily_followups')!;

    const tools = service.getAllowedToolsForSituation(
      sale,
      AiAssistantType.SALE_OPERATIONS,
      situation,
    );

    expect(tools.map((tool) => tool.key)).toEqual(
      expect.arrayContaining(['daily_tasks', 'sale_followups_due', 'sale_lead_pipeline', 'sales_dashboard']),
    );
    expect(tools.some((tool) => tool.key === 'pending_approvals_summary')).toBe(false);
  });

  it('adds the sale guide when a sale asks for system guidance', () => {
    const sale = user(Role.SALE);
    const situation = getAiCoreSituationDefinition('system_guide')!;

    const tools = service.getAllowedToolsForSituation(
      sale,
      AiAssistantType.SALE_OPERATIONS,
      situation,
    );

    expect(tools.map((tool) => tool.key)).toEqual(expect.arrayContaining(['system_guide', 'sale_guide']));
    expect(tools.some((tool) => tool.key === 'teacher_guide')).toBe(false);
  });

  it('loads scored next-best-action packet tools for sale operations', () => {
    const sale = user(Role.SALE);
    const situation = getAiCoreSituationDefinition('sale_next_best_actions_packet')!;

    const tools = service.getAllowedToolsForSituation(
      sale,
      AiAssistantType.SALE_OPERATIONS,
      situation,
    );

    expect(tools.map((tool) => tool.key)).toEqual(
      expect.arrayContaining(['sale_next_best_actions', 'sale_conversations', 'sale_followups_due']),
    );
    expect(tools.every((tool) => tool.allowedRoles.includes(Role.SALE))).toBe(true);
    expect(tools.some((tool) => tool.key === 'financial_overview')).toBe(false);
  });

  it('does not expose sale next-best-action packet to lead care', () => {
    const sale = user(Role.SALE);
    const situation = getAiCoreSituationDefinition('sale_next_best_actions_packet')!;

    expect(() =>
      service.getAllowedToolsForSituation(
        sale,
        AiAssistantType.LEAD_CARE,
        situation,
      ),
    ).toThrow(ForbiddenException);
  });

  it('keeps order and commission situations on the sale operations assistant', () => {
    const sale = user(Role.SALE);
    const orderSituation = getAiCoreSituationDefinition('sale_order_pipeline_review')!;
    const commissionSituation = getAiCoreSituationDefinition('sale_commission_personal')!;

    expect(() =>
      service.getAllowedToolsForSituation(
        sale,
        AiAssistantType.LEAD_CARE,
        orderSituation,
      ),
    ).toThrow(ForbiddenException);
    expect(() =>
      service.getAllowedToolsForSituation(
        sale,
        AiAssistantType.LEAD_CARE,
        commissionSituation,
      ),
    ).toThrow(ForbiddenException);
  });

  it('denies parent access to sale-specific situations', () => {
    const parent = user(Role.PARENT);
    const situation = getAiCoreSituationDefinition('sale_daily_followups')!;

    expect(() =>
      service.getAllowedToolsForSituation(
        parent,
        AiAssistantType.PARENT_SUPPORT,
        situation,
      ),
    ).toThrow(ForbiddenException);
  });

  it('loads parent 9+ packet and drill-down tools for parent situations', () => {
    const parent = user(Role.PARENT);
    const weeklySituation = getAiCoreSituationDefinition('parent_weekly_child_success_packet')!;
    const walletSituation = getAiCoreSituationDefinition('parent_wallet_ledger_detail')!;
    const attendanceSituation = getAiCoreSituationDefinition('parent_attendance_schedule_risk')!;

    const weeklyTools = service.getAllowedToolsForSituation(
      parent,
      AiAssistantType.PARENT_SUPPORT,
      weeklySituation,
    );
    const walletTools = service.getAllowedToolsForSituation(
      parent,
      AiAssistantType.PARENT_SUPPORT,
      walletSituation,
    );
    const attendanceTools = service.getAllowedToolsForSituation(
      parent,
      AiAssistantType.PARENT_SUPPORT,
      attendanceSituation,
    );

    expect(weeklyTools.map((tool) => tool.key)).toEqual(
      expect.arrayContaining(['parent_success_packet', 'student_learning_snapshot', 'parent_wallet_ledger']),
    );
    expect(walletTools.map((tool) => tool.key)).toEqual(
      expect.arrayContaining(['parent_wallet_summary', 'parent_wallet_ledger', 'parent_invoices']),
    );
    expect(attendanceTools.map((tool) => tool.key)).toEqual(
      expect.arrayContaining(['parent_attendance_summary', 'parent_success_packet']),
    );
  });

  it('denies shareholder access to internal audit stats', () => {
    const shareholder = user(Role.SHAREHOLDER);
    const auditTool = getAiCoreToolDefinition('audit_stats')!;

    expect(service.isToolAllowed(shareholder, AiAssistantType.SHAREHOLDER_INSIGHTS, auditTool)).toBe(false);
  });

  it('allows shareholder investor risk packet to load aggregate alerts only', () => {
    const shareholder = user(Role.SHAREHOLDER);
    const situation = getAiCoreSituationDefinition('shareholder_finance_risk_packet')!;

    const tools = service.getAllowedToolsForSituation(
      shareholder,
      AiAssistantType.SHAREHOLDER_INSIGHTS,
      situation,
    );

    expect(tools.map((tool) => tool.key)).toEqual(
      expect.arrayContaining(['shareholder_investor_metrics', 'financial_alerts', 'cash_flow', 'aging_report']),
    );
    expect(tools.some((tool) => tool.key === 'audit_stats')).toBe(false);
  });

  it('requires director read context tools to pass role and assistant policy', () => {
    const director = user(Role.DIRECTOR);
    const situation = getAiCoreSituationDefinition('executive_overview')!;

    const tools = service.getAllowedToolsForSituation(
      director,
      AiAssistantType.DIRECTOR_OPERATIONS,
      situation,
    );

    expect(tools.map((tool) => tool.key)).toEqual(
      expect.arrayContaining(['daily_tasks', 'director_dashboard', 'pending_approvals_summary']),
    );
  });

  it('loads expanded invoice, wallet and ledger tools for accounting reconciliation', () => {
    const accounting = user(Role.ACCOUNTING);
    const situation = getAiCoreSituationDefinition('accounting_invoice_wallet_reconciliation')!;

    const tools = service.getAllowedToolsForSituation(
      accounting,
      AiAssistantType.ACCOUNTING_OPERATIONS,
      situation,
    );

    expect(tools.map((tool) => tool.key)).toEqual(
      expect.arrayContaining([
        'accounting_pending_invoices',
        'accounting_pending_topups',
        'accounting_wallets',
        'accounting_ledger',
      ]),
    );
    expect(tools.some((tool) => tool.key === 'pending_approvals_summary')).toBe(false);
  });

  it('keeps accounting-only finance control tools scoped to accounting operations', () => {
    const accounting = user(Role.ACCOUNTING);
    const director = user(Role.DIRECTOR);
    const bankTool = getAiCoreToolDefinition('accounting_bank_transactions')!;
    const loanSituation = getAiCoreSituationDefinition('accounting_loan_debt_control')!;

    expect(service.isToolAllowed(accounting, AiAssistantType.ACCOUNTING_OPERATIONS, bankTool)).toBe(true);
    expect(service.isToolAllowed(director, AiAssistantType.DIRECTOR_OPERATIONS, bankTool)).toBe(false);

    const loanTools = service.getAllowedToolsForSituation(
      accounting,
      AiAssistantType.ACCOUNTING_OPERATIONS,
      loanSituation,
    );
    expect(loanTools.map((tool) => tool.key)).toEqual(
      expect.arrayContaining(['accounting_loan_summary', 'accounting_loans', 'accounting_loan_payments_due']),
    );
  });

  it('rejects write execute situations in the read-only core', () => {
    const director = user(Role.DIRECTOR);
    const situation: AiSituationDefinition = {
      key: 'critical_write',
      capability: 'INVOICE_WALLET',
      userIntent: 'Duyet hoa don',
      examples: [],
      triggerKeywords: [],
      allowedAssistantTypes: [AiAssistantType.DIRECTOR_OPERATIONS],
      allowedRoles: [Role.DIRECTOR],
      operation: 'WRITE_EXECUTE',
      dataScope: 'GLOBAL',
      defaultWorkflow: 'WRITE_EXECUTE',
      candidateTools: [],
      requiredEntities: [],
      contextPolicy: 'Must read detail first.',
      missingDataPolicy: 'Need entity id.',
      writePolicy: 'Requires confirmation.',
      riskLevel: 'CRITICAL',
      requiresConfirmation: true,
      requiresApproval: true,
      requiresAudit: true,
    };

    expect(() =>
      service.assertSituationAllowed(director, AiAssistantType.DIRECTOR_OPERATIONS, situation),
    ).toThrow(ForbiddenException);
  });
});
