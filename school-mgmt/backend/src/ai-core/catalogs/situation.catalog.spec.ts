import { AiAssistantType } from '../../chatbot/schemas/ai-assistant-profile.schema';
import { Role } from '../../common/interfaces/role.enum';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import {
  getAiCoreSituationCatalog,
  getAiCoreSituationDefinition,
} from './situation.catalog';
import { getAiCoreToolDefinition } from './tool.catalog';
import { AiPolicyEngineService } from '../policy-engine.service';

const MANAGEMENT_PACKET_KEYS = [
  'director_daily_control_packet',
  'director_approval_risk_triage',
  'director_admin_security_governance',
  'accounting_collections_aging_packet',
  'accounting_month_end_close_packet',
  'accounting_payroll_payout_packet',
  'ops_daily_sla_packet',
  'ops_pending_approval_detail',
  'ops_attendance_reconciliation',
  'ops_trial_test_control',
  'ops_work_sessions_control',
  'ops_student_teacher_onboarding',
  'ops_capacity_teacher_risk_packet',
  'teacher_daily_teaching_packet',
  'experience_teacher_daily_review_packet',
  'experience_teacher_quality_packet',
  'parent_weekly_child_success_packet',
  'student_weekly_execution_packet',
  'sale_next_best_actions_packet',
  'sale_pipeline_recovery_packet',
  'sale_revenue_commitment_packet',
  'ads_optimization_packet',
  'shareholder_board_packet',
  'shareholder_finance_risk_packet',
  'shareholder_runway_sensitivity_packet',
  'shareholder_growth_retention_packet',
  'shareholder_unit_economics_packet',
  'shareholder_board_qna_packet',
] as const;

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

describe('AI_CORE_SITUATION_CATALOG', () => {
  it('uses unique stable situation keys', () => {
    const keys = getAiCoreSituationCatalog().map((situation) => situation.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('references existing tool catalog keys', () => {
    for (const situation of getAiCoreSituationCatalog()) {
      for (const toolKey of situation.candidateTools) {
        expect(getAiCoreToolDefinition(toolKey)).toBeDefined();
      }
    }
  });

  it('keeps non-guide situations within the context tool budget', () => {
    for (const situation of getAiCoreSituationCatalog()) {
      if (situation.key === 'system_guide') continue;
      expect(situation.candidateTools.length).toBeLessThanOrEqual(5);
    }
  });

  it('adds repeatable management packets for all primary assistant groups', () => {
    for (const key of MANAGEMENT_PACKET_KEYS) {
      const situation = getAiCoreSituationDefinition(key);
      expect(situation).toBeDefined();
      expect(situation?.candidateTools.length).toBeGreaterThan(0);
      expect(situation?.candidateTools.length).toBeLessThanOrEqual(5);
      expect(situation?.contextPolicy).toMatch(/aggregate|queue|summary|packet|limit|gioi han|khong nap|own records|own children/i);
    }
  });

  it('leaves at least one allowed read tool for every situation primary actor', () => {
    const policy = new AiPolicyEngineService();

    for (const situation of getAiCoreSituationCatalog()) {
      const role = situation.allowedRoles[0];
      const assistantType = situation.allowedAssistantTypes[0] as AiAssistantType;
      const tools = policy.getAllowedToolsForSituation(user(role), assistantType, situation);
      expect(tools.length).toBeGreaterThan(0);
      expect(tools.every((tool) => tool.operation !== 'WRITE_EXECUTE')).toBe(true);
    }
  });
});
