import { AiAssistantType } from '../chatbot/schemas/ai-assistant-profile.schema';
import { Role } from '../common/interfaces/role.enum';
import { AiSituationRouterService } from './situation-router.service';

describe('AiSituationRouterService', () => {
  let service: AiSituationRouterService;
  const accountingUser = {
    sub: '64b000000000000000000003',
    _id: '64b000000000000000000003',
    userId: '64b000000000000000000003',
    email: 'accounting@example.com',
    role: Role.ACCOUNTING,
    fullName: 'Accounting Demo',
  };
  const parentUser = {
    sub: '64b000000000000000000001',
    _id: '64b000000000000000000001',
    userId: '64b000000000000000000001',
    email: 'parent@example.com',
    role: Role.PARENT,
    fullName: 'Parent Demo',
  };
  const saleUser = {
    sub: '64b000000000000000000004',
    _id: '64b000000000000000000004',
    userId: '64b000000000000000000004',
    email: 'sale@example.com',
    role: Role.SALE,
    fullName: 'Sale Demo',
  };
  const teacherUser = {
    sub: '64b000000000000000000005',
    _id: '64b000000000000000000005',
    userId: '64b000000000000000000005',
    email: 'teacher@example.com',
    role: Role.TEACHER,
    fullName: 'Teacher Demo',
  };
  const experienceTeacherUser = {
    sub: '64b000000000000000000006',
    _id: '64b000000000000000000006',
    userId: '64b000000000000000000006',
    email: 'reviewer@example.com',
    role: Role.EXPERIENCE_TEACHER,
    fullName: 'Reviewer Demo',
  };
  const opsUser = {
    sub: '64b000000000000000000006',
    _id: '64b000000000000000000006',
    userId: '64b000000000000000000006',
    email: 'ops@example.com',
    role: Role.OPS,
    fullName: 'Ops Demo',
  };

  beforeEach(() => {
    service = new AiSituationRouterService();
  });

  it('routes Vietnamese đ/Đ keywords after normalization', () => {
    const situation = service.route(
      'Tôi muốn đổi lịch buổi học tuần này',
      AiAssistantType.PARENT_SUPPORT,
      {
        sub: '64b000000000000000000001',
        _id: '64b000000000000000000001',
        userId: '64b000000000000000000001',
        email: 'parent@example.com',
        role: Role.PARENT,
        fullName: 'Parent Demo',
      },
    );

    expect(situation.key).toBe('parent_support_ticket');
  });

  it('routes shareholder finance mode to the finance risk packet', () => {
    const situation = service.route(
      'Tong quan nhanh',
      AiAssistantType.SHAREHOLDER_INSIGHTS,
      {
        sub: '64b000000000000000000002',
        _id: '64b000000000000000000002',
        userId: '64b000000000000000000002',
        email: 'shareholder@example.com',
        role: Role.SHAREHOLDER,
        fullName: 'Shareholder Demo',
      },
      'FINANCE',
    );

    expect(situation.key).toBe('shareholder_finance_risk_packet');
  });

  it('uses the deep daily review packet as fallback for experience teachers', () => {
    const situation = service.route(
      'Hom nay toi can lam gi?',
      AiAssistantType.EXPERIENCE_TEACHER_SUPPORT,
      experienceTeacherUser,
    );

    expect(situation.key).toBe('experience_teacher_daily_review_packet');
  });

  it.each([
    ['Vi cua toi con bao nhieu va lich su giao dich thang nay?', 'parent_wallet_ledger_detail'],
    ['Con toi vang hoc hay di muon buoi nao trong thang nay?', 'parent_attendance_schedule_risk'],
    ['Bai tap cua con chua xong va hoc lieu nao can on tap?', 'parent_homework_materials_focus'],
    ['Tuan nay con can lam gi va co hoa don nao can xu ly?', 'parent_weekly_child_success_packet'],
  ])('routes parent question "%s"', (message, expectedKey) => {
    const situation = service.route(
      message,
      AiAssistantType.PARENT_SUPPORT,
      parentUser,
    );

    expect(situation.key).toBe(expectedKey);
  });

  it.each([
    ['Rui ro tai chinh lon nhat la gi?', 'shareholder_finance_risk_packet'],
    ['Neu burn rate tang thi runway con bao nhieu?', 'shareholder_runway_sensitivity_packet'],
    ['Unit economics va LTV/CAC co tot khong?', 'shareholder_unit_economics_packet'],
    ['Nen hoi ban dieu hanh cau nao trong board Q&A?', 'shareholder_board_qna_packet'],
  ])('routes shareholder question "%s"', (message, expectedKey) => {
    const situation = service.route(
      message,
      AiAssistantType.SHAREHOLDER_INSIGHTS,
      {
        sub: '64b000000000000000000002',
        _id: '64b000000000000000000002',
        userId: '64b000000000000000000002',
        email: 'shareholder@example.com',
        role: Role.SHAREHOLDER,
        fullName: 'Shareholder Demo',
      },
    );

    expect(situation.key).toBe(expectedKey);
  });
  it('routes accounting bank and expense questions to the specialized packet even in finance mode', () => {
    const situation = service.route(
      'Can xem giao dich ngan hang va chi phi thang nay',
      AiAssistantType.ACCOUNTING_OPERATIONS,
      accountingUser,
      'FINANCE',
    );

    expect(situation.key).toBe('accounting_bank_fund_expense_control');
  });

  it('routes accounting loan and payroll questions to specialized packets', () => {
    const loanSituation = service.route(
      'Lich tra vay den han va no vay hien tai?',
      AiAssistantType.ACCOUNTING_OPERATIONS,
      accountingUser,
      'FINANCE',
    );
    const payrollSituation = service.route(
      'Payroll nao can kiem tra truoc khi tra luong?',
      AiAssistantType.ACCOUNTING_OPERATIONS,
      accountingUser,
    );

    expect(loanSituation.key).toBe('accounting_loan_debt_control');
    expect(payrollSituation.key).toBe('accounting_payroll_payout_packet');
  });

  it('routes sale prioritization questions to the scored next-best-action packet', () => {
    const situation = service.route(
      'Hom nay toi can lam gi de chot doanh thu va pipeline cua toi dang nghen o dau?',
      AiAssistantType.SALE_OPERATIONS,
      saleUser,
    );

    expect(situation.key).toBe('sale_next_best_actions_packet');
  });

  it('uses the sale packet for SALES context mode when the actor is sale', () => {
    const situation = service.route(
      'Tong hop viec uu tien',
      AiAssistantType.SALE_OPERATIONS,
      saleUser,
      'SALES',
    );

    expect(situation.key).toBe('sale_next_best_actions_packet');
  });

  it('routes OPS daily prioritization questions to the deep SLA packet', () => {
    const situation = service.route(
      'Hom nay van hanh can xu ly gi ve SLA, session va ticket?',
      AiAssistantType.OPS_OPERATIONS,
      opsUser,
    );

    expect(situation.key).toBe('ops_daily_sla_packet');
  });

  it.each([
    ['Diem danh lop hom nay the nao?', 'teacher_attendance_support'],
    ['Tim hoc lieu worksheet cho buoi toi', 'teacher_material_preparation'],
    ['Toi co tin nhan hay ticket nao chua xu ly?', 'teacher_ticket_message_support'],
    ['Bang luong gan nhat cua toi?', 'teacher_personal_payroll'],
  ])('routes teacher question "%s"', (message, expectedKey) => {
    const situation = service.route(
      message,
      AiAssistantType.TEACHER_SUPPORT,
      teacherUser,
    );

    expect(situation.key).toBe(expectedKey);
  });
});
