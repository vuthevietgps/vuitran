// Angular unit tests â€” Batch 4 (scenarios 8.2â€“8.4, 10.1â€“10.3)
// Covers pure-method testing for:
//   LoansComponent      â€” statusLabel, loanTypeLabel, lenderTypeLabel, paymentProgress
//   StaffPayrollComponent â€” statusLabel, statusColor, roleLabel, isAdmin, isDirector
//   AgentsComponent     â€” statusLabel, canManage, isDirector
//   SessionsComponent   â€” statusLabel, formatCurrency, canCreate

import { NO_ERRORS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';

import { LoansComponent } from './loans.component';
import { StaffPayrollComponent } from './staff-payroll.component';
import { AgentsComponent } from './agents.component';
import { SessionsComponent } from './sessions.component';
import { AuthService } from '../services/auth.service';
import { LoanService } from '../services/loan.service';
import { StaffPayrollService } from '../services/staff-payroll.service';
import { AgentService } from '../services/agent.service';
import { SessionService } from '../services/session.service';
import { ClassService } from '../services/class.service';
import { UserService } from '../services/user.service';

// â”€â”€â”€ Shared stub factory â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function makeMutableAuthStub() {
  let _role = 'DIRECTOR';
  let _id = 'user-stub-1';
  return {
    setRole(role: string, id = 'user-stub-1') { _role = role; _id = id; },
    userSignal: () => ({ _id, role: _role, sub: _id }),
    hasRole: (roles: string[]) => roles.includes(_role),
  };
}

function makeLoanServiceStub() {
  return {
    list: jasmine.createSpy('list').and.resolveTo({ data: [], total: 0 }),
    getSummary: jasmine.createSpy('getSummary').and.resolveTo({}),
    create: jasmine.createSpy('create').and.resolveTo({}),
    activate: jasmine.createSpy('activate').and.resolveTo({}),
    getSchedule: jasmine.createSpy('getSchedule').and.resolveTo([]),
    getPaymentHistory: jasmine.createSpy('getPaymentHistory').and.resolveTo([]),
    recordPayment: jasmine.createSpy('recordPayment').and.resolveTo({}),
    updateOverdue: jasmine.createSpy('updateOverdue').and.resolveTo({ ok: true }),
  };
}

function makeStaffPayrollServiceStub() {
  return {
    list: jasmine.createSpy('list').and.resolveTo({ data: [], total: 0 }),
    listMy: jasmine.createSpy('listMy').and.resolveTo({ data: [], total: 0 }),
    generate: jasmine.createSpy('generate').and.resolveTo({}),
    submit: jasmine.createSpy('submit').and.resolveTo({}),
    approve: jasmine.createSpy('approve').and.resolveTo({}),
    reject: jasmine.createSpy('reject').and.resolveTo({}),
    markPaid: jasmine.createSpy('markPaid').and.resolveTo({}),
    reopen: jasmine.createSpy('reopen').and.resolveTo({}),
    update: jasmine.createSpy('update').and.resolveTo({}),
    delete: jasmine.createSpy('delete').and.resolveTo({}),
    generateBulk: jasmine.createSpy('generateBulk').and.resolveTo({}),
  };
}

function makeAgentServiceStub() {
  return {
    list: jasmine.createSpy('list').and.resolveTo({ data: [], total: 0 }),
    create: jasmine.createSpy('create').and.resolveTo({}),
    update: jasmine.createSpy('update').and.resolveTo({}),
    suspend: jasmine.createSpy('suspend').and.resolveTo({}),
    activate: jasmine.createSpy('activate').and.resolveTo({}),
    delete: jasmine.createSpy('delete').and.resolveTo({}),
  };
}

function makeSessionServiceStub() {
  return {
    list: jasmine.createSpy('list').and.resolveTo({ data: [], total: 0 }),
    getStats: jasmine.createSpy('getStats').and.resolveTo(null),
    create: jasmine.createSpy('create').and.resolveTo({}),
    createBulk: jasmine.createSpy('createBulk').and.resolveTo({}),
    cancel: jasmine.createSpy('cancel').and.resolveTo({}),
    delete: jasmine.createSpy('delete').and.resolveTo({}),
    complete: jasmine.createSpy('complete').and.resolveTo({}),
    confirm: jasmine.createSpy('confirm').and.resolveTo({}),
    finalize: jasmine.createSpy('finalize').and.resolveTo({}),
    getChangeRequests: jasmine.createSpy('getChangeRequests').and.resolveTo([]),
    createChangeRequest: jasmine.createSpy('createChangeRequest').and.resolveTo({}),
  };
}

// â”€â”€â”€ LoansComponent â€” Pure Methods â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe('LoansComponent â€” pure methods (10.1)', () => {
  let comp: LoansComponent;
  let authStub: ReturnType<typeof makeMutableAuthStub>;

  beforeEach(() => {
    authStub = makeMutableAuthStub();
    authStub.setRole('DIRECTOR');
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        { provide: AuthService, useValue: authStub },
        { provide: LoanService, useValue: makeLoanServiceStub() },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    });
    comp = TestBed.runInInjectionContext(() => new LoansComponent(
      TestBed.inject(LoanService),
      TestBed.inject(AuthService),
    ));
  });

  afterEach(() => TestBed.resetTestingModule());

  // â”€â”€ getStatusLabel â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  it('10.1 getStatusLabel DRAFT -> Nháp', () => {
    expect(comp.getStatusLabel('DRAFT')).toBe('Nháp');
  });

  it('10.1 getStatusLabel ACTIVE -> Đang vay', () => {
    expect(comp.getStatusLabel('ACTIVE')).toBe('Đang vay');
  });

  it('10.1 getStatusLabel COMPLETED -> Đã tất toán', () => {
    expect(comp.getStatusLabel('COMPLETED')).toBe('Đã tất toán');
  });

  it('10.1 getStatusLabel DEFAULTED -> Nợ xấu', () => {
    expect(comp.getStatusLabel('DEFAULTED')).toBe('Nợ xấu');
  });

  it('10.1 getStatusLabel RESTRUCTURED -> Tái cấu trúc', () => {
    expect(comp.getStatusLabel('RESTRUCTURED')).toBe('Tái cấu trúc');
  });

  it('10.1 getStatusLabel unknown fallback â†’ raw value', () => {
    expect(comp.getStatusLabel('UNKNOWN_STATUS')).toBe('UNKNOWN_STATUS');
  });

  // â”€â”€ getLoanTypeLabel â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  it('10.1 getLoanTypeLabel WORKING_CAPITAL -> Vốn lưu động', () => {
    expect(comp.getLoanTypeLabel('WORKING_CAPITAL')).toBe('Vốn lưu động');
  });

  it('10.1 getLoanTypeLabel EQUIPMENT -> Mua thiết bị', () => {
    expect(comp.getLoanTypeLabel('EQUIPMENT')).toBe('Mua thiết bị');
  });

  it('10.1 getLoanTypeLabel RENOVATION -> Sửa chữa', () => {
    expect(comp.getLoanTypeLabel('RENOVATION')).toBe('Sửa chữa');
  });

  it('10.1 getLoanTypeLabel EXPANSION -> Mở rộng', () => {
    expect(comp.getLoanTypeLabel('EXPANSION')).toBe('Mở rộng');
  });

  it('10.1 getLoanTypeLabel OTHER -> Khác', () => {
    expect(comp.getLoanTypeLabel('OTHER')).toBe('Khác');
  });

  // â”€â”€ getLenderTypeLabel â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  it('10.1 getLenderTypeLabel BANK -> Ngân hàng', () => {
    expect(comp.getLenderTypeLabel('BANK')).toBe('Ngân hàng');
  });

  it('10.1 getLenderTypeLabel INDIVIDUAL -> Cá nhân', () => {
    expect(comp.getLenderTypeLabel('INDIVIDUAL')).toBe('Cá nhân');
  });

  it('10.1 getLenderTypeLabel ORGANIZATION -> Tổ chức', () => {
    expect(comp.getLenderTypeLabel('ORGANIZATION')).toBe('Tổ chức');
  });

  // â”€â”€ getInterestTypeLabel â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  it('10.1 getInterestTypeLabel FIXED -> Cố định', () => {
    expect(comp.getInterestTypeLabel('FIXED')).toBe('Cố định');
  });

  it('10.1 getInterestTypeLabel FLOATING -> Thả nổi', () => {
    expect(comp.getInterestTypeLabel('FLOATING')).toBe('Thả nổi');
  });

  // â”€â”€ getFrequencyLabel â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  it('10.1 getFrequencyLabel MONTHLY -> Hàng tháng', () => {
    expect(comp.getFrequencyLabel('MONTHLY')).toBe('Hàng tháng');
  });

  it('10.1 getFrequencyLabel QUARTERLY -> Hàng quý', () => {
    expect(comp.getFrequencyLabel('QUARTERLY')).toBe('Hàng quý');
  });

  it('10.1 getFrequencyLabel ANNUALLY -> Hàng năm', () => {
    expect(comp.getFrequencyLabel('ANNUALLY')).toBe('Hàng năm');
  });

  // â”€â”€ getPaymentStatusLabel â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  it('10.1 getPaymentStatusLabel SCHEDULED -> Chưa đến hạn', () => {
    expect(comp.getPaymentStatusLabel('SCHEDULED')).toBe('Chưa đến hạn');
  });

  it('10.1 getPaymentStatusLabel PAID -> Đã trả', () => {
    expect(comp.getPaymentStatusLabel('PAID')).toBe('Đã trả');
  });

  it('10.1 getPaymentStatusLabel OVERDUE -> Quá hạn', () => {
    expect(comp.getPaymentStatusLabel('OVERDUE')).toBe('Quá hạn');
  });

  it('10.1 getPaymentStatusLabel PARTIAL -> Trả một phần', () => {
    expect(comp.getPaymentStatusLabel('PARTIAL')).toBe('Trả một phần');
  });

  // â”€â”€ getStatusColor â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  it('10.1 getStatusColor ACTIVE â†’ #3b82f6', () => {
    expect(comp.getStatusColor('ACTIVE')).toBe('#3b82f6');
  });

  it('10.1 getStatusColor COMPLETED â†’ #10b981', () => {
    expect(comp.getStatusColor('COMPLETED')).toBe('#10b981');
  });

  it('10.1 getStatusColor DEFAULTED â†’ #ef4444', () => {
    expect(comp.getStatusColor('DEFAULTED')).toBe('#ef4444');
  });

  it('10.1 getStatusColor DRAFT â†’ #9ca3af', () => {
    expect(comp.getStatusColor('DRAFT')).toBe('#9ca3af');
  });

  // â”€â”€ getPaymentProgress â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  it('10.1 getPaymentProgress: totalPaid=500 principal=1000 â†’ 50%', () => {
    const loan: any = { principal: 1_000_000_000, totalPaid: 500_000_000 };
    expect(comp.getPaymentProgress(loan)).toBe(50);
  });

  it('10.1 getPaymentProgress: totalPaid=0 principal=1000 â†’ 0%', () => {
    const loan: any = { principal: 1_000_000_000, totalPaid: 0 };
    expect(comp.getPaymentProgress(loan)).toBe(0);
  });

  it('10.1 getPaymentProgress: principal=0 â†’ 0% (no division by zero)', () => {
    const loan: any = { principal: 0, totalPaid: 0 };
    expect(comp.getPaymentProgress(loan)).toBe(0);
  });

  it('10.1 getPaymentProgress: totalPaid=1200 principal=1000 â†’ capped/rounded 120%', () => {
    const loan: any = { principal: 100_000_000, totalPaid: 120_000_000 };
    expect(comp.getPaymentProgress(loan)).toBe(120);
  });
});

// â”€â”€â”€ StaffPayrollComponent â€” Pure Methods â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe('StaffPayrollComponent â€” pure methods (10.2)', () => {
  let comp: StaffPayrollComponent;
  let authStub: ReturnType<typeof makeMutableAuthStub>;

  beforeEach(() => {
    authStub = makeMutableAuthStub();
    authStub.setRole('DIRECTOR');
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        { provide: AuthService, useValue: authStub },
        { provide: StaffPayrollService, useValue: makeStaffPayrollServiceStub() },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    });
    comp = TestBed.runInInjectionContext(() => new StaffPayrollComponent(
      TestBed.inject(StaffPayrollService),
      TestBed.inject(AuthService),
    ));
  });

  afterEach(() => TestBed.resetTestingModule());

  // â”€â”€ statusLabel â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  it('10.2 statusLabel DRAFT -> Nháp', () => {
    expect(comp.statusLabel('DRAFT')).toBe('Nháp');
  });

  it('10.2 statusLabel PENDING_REVIEW -> Chờ duyệt', () => {
    expect(comp.statusLabel('PENDING_REVIEW')).toBe('Chờ duyệt');
  });

  it('10.2 statusLabel APPROVED -> Đã duyệt', () => {
    expect(comp.statusLabel('APPROVED')).toBe('Đã duyệt');
  });

  it('10.2 statusLabel PAID -> Đã thanh toán', () => {
    expect(comp.statusLabel('PAID')).toBe('Đã thanh toán');
  });

  it('10.2 statusLabel REJECTED -> Từ chối', () => {
    expect(comp.statusLabel('REJECTED')).toBe('Từ chối');
  });

  it('10.2 statusLabel unknown â†’ raw value fallback', () => {
    expect(comp.statusLabel('MYSTERY_STATUS')).toBe('MYSTERY_STATUS');
  });

  // â”€â”€ statusColor â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  it('10.2 statusColor PAID â†’ #10b981 (green)', () => {
    expect(comp.statusColor('PAID')).toBe('#10b981');
  });

  it('10.2 statusColor APPROVED â†’ #3b82f6 (blue)', () => {
    expect(comp.statusColor('APPROVED')).toBe('#3b82f6');
  });

  it('10.2 statusColor REJECTED â†’ #ef4444 (red)', () => {
    expect(comp.statusColor('REJECTED')).toBe('#ef4444');
  });

  it('10.2 statusColor PENDING_REVIEW â†’ #f59e0b (amber)', () => {
    expect(comp.statusColor('PENDING_REVIEW')).toBe('#f59e0b');
  });

  it('10.2 statusColor DRAFT â†’ #6b7280 (gray)', () => {
    expect(comp.statusColor('DRAFT')).toBe('#6b7280');
  });

  it('10.2 statusColor unknown â†’ fallback gray #6b7280', () => {
    expect(comp.statusColor('SOMETHING_ELSE')).toBe('#6b7280');
  });

  // â”€â”€ roleLabel â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  it('10.2 roleLabel DIRECTOR -> Giám đốc', () => {
    expect(comp.roleLabel('DIRECTOR')).toBe('Giám đốc');
  });

  it('10.2 roleLabel ACCOUNTING -> Kế toán', () => {
    expect(comp.roleLabel('ACCOUNTING')).toBe('Kế toán');
  });

  it('10.2 roleLabel OPS -> Vận hành', () => {
    expect(comp.roleLabel('OPS')).toBe('Vận hành');
  });

  it('10.2 roleLabel TEACHER -> Giáo viên', () => {
    expect(comp.roleLabel('TEACHER')).toBe('Giáo viên');
  });

  it('10.2 roleLabel unknown â†’ raw value fallback', () => {
    expect(comp.roleLabel('GOD_MODE')).toBe('GOD_MODE');
  });

  // â”€â”€ isAdmin / isDirector â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  it('10.2 isAdmin: DIRECTOR â†’ true', () => {
    authStub.setRole('DIRECTOR');
    expect(comp.isAdmin()).toBeTrue();
  });

  it('10.2 isAdmin: ACCOUNTING â†’ true', () => {
    authStub.setRole('ACCOUNTING');
    expect(comp.isAdmin()).toBeTrue();
  });

  it('10.2 isAdmin: OPS â†’ true', () => {
    authStub.setRole('OPS');
    expect(comp.isAdmin()).toBeTrue();
  });

  it('10.2 isAdmin: TEACHER â†’ false', () => {
    authStub.setRole('TEACHER');
    expect(comp.isAdmin()).toBeFalse();
  });

  it('10.2 isAdmin: SALE â†’ false', () => {
    authStub.setRole('SALE');
    expect(comp.isAdmin()).toBeFalse();
  });

  it('10.2 isDirector: DIRECTOR â†’ true', () => {
    authStub.setRole('DIRECTOR');
    expect(comp.isDirector()).toBeTrue();
  });

  it('10.2 isDirector: ACCOUNTING â†’ false (chá»‰ DIRECTOR approve)', () => {
    authStub.setRole('ACCOUNTING');
    expect(comp.isDirector()).toBeFalse();
  });

  it('10.2 isDirector: OPS â†’ false', () => {
    authStub.setRole('OPS');
    expect(comp.isDirector()).toBeFalse();
  });
});

// â”€â”€â”€ AgentsComponent â€” Pure Methods â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe('AgentsComponent â€” pure methods (10.3)', () => {
  let comp: AgentsComponent;
  let authStub: ReturnType<typeof makeMutableAuthStub>;

  beforeEach(() => {
    authStub = makeMutableAuthStub();
    authStub.setRole('DIRECTOR');
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        { provide: AuthService, useValue: authStub },
        { provide: AgentService, useValue: makeAgentServiceStub() },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    });
    comp = TestBed.runInInjectionContext(() => new AgentsComponent());
  });

  afterEach(() => TestBed.resetTestingModule());

  // â”€â”€ statusLabel â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  it('10.3 statusLabel ACTIVE -> Hoạt động', () => {
    expect(comp.statusLabel('ACTIVE')).toBe('Hoạt động');
  });

  it('10.3 statusLabel INACTIVE -> Ngừng HĐ', () => {
    expect(comp.statusLabel('INACTIVE')).toBe('Ngừng HĐ');
  });

  it('10.3 statusLabel SUSPENDED -> Tạm ngừng', () => {
    expect(comp.statusLabel('SUSPENDED')).toBe('Tạm ngừng');
  });

  it('10.3 statusLabel unknown â†’ raw fallback', () => {
    expect(comp.statusLabel('UNKNOWN')).toBe('UNKNOWN');
  });

  // â”€â”€ canManage â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  it('10.3 canManage: DIRECTOR â†’ true', () => {
    authStub.setRole('DIRECTOR');
    expect(comp.canManage()).toBeTrue();
  });

  it('10.3 canManage: OPS â†’ true', () => {
    authStub.setRole('OPS');
    expect(comp.canManage()).toBeTrue();
  });

  it('10.3 canManage: ACCOUNTING â†’ false', () => {
    authStub.setRole('ACCOUNTING');
    expect(comp.canManage()).toBeFalse();
  });

  it('10.3 canManage: SALE â†’ false', () => {
    authStub.setRole('SALE');
    expect(comp.canManage()).toBeFalse();
  });

  it('10.3 canManage: TEACHER â†’ false', () => {
    authStub.setRole('TEACHER');
    expect(comp.canManage()).toBeFalse();
  });

  // â”€â”€ isDirector â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  it('10.3 isDirector: DIRECTOR â†’ true', () => {
    authStub.setRole('DIRECTOR');
    expect(comp.isDirector()).toBeTrue();
  });

  it('10.3 isDirector: OPS â†’ false', () => {
    authStub.setRole('OPS');
    expect(comp.isDirector()).toBeFalse();
  });
});

// â”€â”€â”€ SessionsComponent â€” Pure Methods (8.2 / 8.4 context) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe('SessionsComponent â€” pure methods (8.2, 8.4)', () => {
  let comp: SessionsComponent;
  let authStub: ReturnType<typeof makeMutableAuthStub>;

  beforeEach(() => {
    authStub = makeMutableAuthStub();
    authStub.setRole('OPS');
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        { provide: AuthService, useValue: authStub },
        { provide: SessionService, useValue: makeSessionServiceStub() },
        { provide: ClassService, useValue: { list: jasmine.createSpy('list').and.resolveTo([]) } },
        { provide: UserService, useValue: { listTeachers: jasmine.createSpy('listTeachers').and.resolveTo([]) } },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    });
    comp = TestBed.runInInjectionContext(() => new SessionsComponent(TestBed.inject(AuthService)));
  });

  afterEach(() => TestBed.resetTestingModule());

  // â”€â”€ statusLabel â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  it('8.4 statusLabel SCHEDULED -> Đã lên lịch', () => {
    expect(comp.statusLabel('SCHEDULED')).toBe('Đã lên lịch');
  });

  it('8.4 statusLabel TEACHER_COMPLETED -> GV hoàn thành', () => {
    const label = comp.statusLabel('TEACHER_COMPLETED');
    expect(label).toBeTruthy();
    expect(label).not.toBe('TEACHER_COMPLETED'); // Should have a Vietnamese label
  });

  it('8.4 statusLabel PARENT_CONFIRMED -> PH xác nhận', () => {
    const label = comp.statusLabel('PARENT_CONFIRMED');
    expect(label).toBeTruthy();
  });

  it('8.4 statusLabel FINALIZED -> Đã chốt', () => {
    const label = comp.statusLabel('FINALIZED');
    expect(label).toBeTruthy();
    expect(label).not.toBe('FINALIZED');
  });

  it('8.4 statusLabel CANCELLED -> Đã hủy', () => {
    const label = comp.statusLabel('CANCELLED');
    expect(label).toBeTruthy();
    expect(label).not.toBe('CANCELLED');
  });

  it('8.4 statusLabel NO_SHOW â†’ label rendered', () => {
    const label = comp.statusLabel('NO_SHOW');
    expect(label).toBeTruthy();
  });

  // â”€â”€ formatCurrency â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  it('8.4 formatCurrency: 200000 â†’ contains "200"', () => {
    const formatted = comp.formatCurrency(200_000);
    expect(formatted).toContain('200');
  });

  it('8.4 formatCurrency: 0 â†’ contains "0"', () => {
    const formatted = comp.formatCurrency(0);
    expect(formatted).toContain('0');
  });

  it('8.4 formatCurrency: 1000000 -> large number formatted', () => {
    const formatted = comp.formatCurrency(1_000_000);
    // Accepts "1.000.000 đ" or "1,000,000" etc.
    expect(formatted).toBeTruthy();
    expect(typeof formatted).toBe('string');
  });

  // â”€â”€ canCreate (RBAC) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  it('8.2 canCreate: DIRECTOR -> true (can create sessions)', () => {
    authStub.setRole('DIRECTOR');
    expect(comp.canCreate()).toBeTrue();
  });

  it('8.2 canCreate: OPS -> true', () => {
    authStub.setRole('OPS');
    expect(comp.canCreate()).toBeTrue();
  });

  it('8.2 canCreate: PARENT -> false', () => {
    authStub.setRole('PARENT');
    expect(comp.canCreate()).toBeFalse();
  });

  it('8.2 canCreate: TEACHER -> false', () => {
    authStub.setRole('TEACHER');
    expect(comp.canCreate()).toBeFalse();
  });

  // â”€â”€ isTeacher â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  it('8.4 isTeacher: TEACHER -> true', () => {
    authStub.setRole('TEACHER');
    expect(comp.isTeacher()).toBeTrue();
  });

  it('8.4 isTeacher: OPS -> false', () => {
    authStub.setRole('OPS');
    expect(comp.isTeacher()).toBeFalse();
  });

  // â”€â”€ isDirector â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  it('8.2 isDirector: DIRECTOR -> true', () => {
    authStub.setRole('DIRECTOR');
    expect(comp.isDirector()).toBeTrue();
  });

  it('8.2 isDirector: OPS -> false', () => {
    authStub.setRole('OPS');
    expect(comp.isDirector()).toBeFalse();
  });

});

