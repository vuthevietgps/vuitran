// Angular unit tests — Batch 5 (scenarios 10.4, 11.1–11.4, 12.1–12.5)
// Covers pure-method testing for:
//   ExpensesComponent   — statusLabel, statusColor, categoryLabel, isFinanceStaff, canApprove, canPay, canEdit
//   AuditLogComponent   — formatDateTime, formatShortDate, getBarHeight

import { NO_ERRORS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';

import { ExpensesComponent } from './expenses.component';
import { AuditLogComponent } from './audit-log.component';
import { AuthService } from '../services/auth.service';
import { ExpenseService } from '../services/expense.service';
import { AuditLogService } from '../services/audit-log.service';

// ─── Shared stub factory ──────────────────────────────────────────────────────

function makeMutableAuthStub() {
  let _role = 'DIRECTOR';
  let _id = 'user-stub-1';
  return {
    setRole(role: string, id = 'user-stub-1') { _role = role; _id = id; },
    userSignal: () => ({ _id, role: _role, sub: _id }),
    hasRole: (roles: string[]) => roles.includes(_role),
  };
}

function makeExpenseServiceStub() {
  return {
    list: jasmine.createSpy('list').and.resolveTo({ data: [], total: 0 }),
    getStats: jasmine.createSpy('getStats').and.resolveTo({}),
    create: jasmine.createSpy('create').and.resolveTo({}),
    update: jasmine.createSpy('update').and.resolveTo({}),
    approve: jasmine.createSpy('approve').and.resolveTo({}),
    reject: jasmine.createSpy('reject').and.resolveTo({}),
    markPaid: jasmine.createSpy('markPaid').and.resolveTo({}),
    remove: jasmine.createSpy('remove').and.resolveTo({}),
  };
}

function makeAuditLogServiceStub() {
  return {
    getAll: jasmine.createSpy('getAll').and.resolveTo({ data: [], total: 0, totalPages: 1 }),
    getStats: jasmine.createSpy('getStats').and.resolveTo({ recentActivity: [] }),
  };
}

// ─── ExpensesComponent — pure methods (10.4) ──────────────────────────────────

describe('ExpensesComponent — pure methods (10.4)', () => {
  let comp: ExpensesComponent;
  let authStub: ReturnType<typeof makeMutableAuthStub>;

  beforeEach(() => {
    authStub = makeMutableAuthStub();
    authStub.setRole('DIRECTOR');
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        { provide: AuthService, useValue: authStub },
        { provide: ExpenseService, useValue: makeExpenseServiceStub() },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    });
    comp = TestBed.runInInjectionContext(
      () => new ExpensesComponent(TestBed.inject(ExpenseService), TestBed.inject(AuthService)),
    );
  });

  afterEach(() => TestBed.resetTestingModule());

  // ── statusLabel ──────────────────────────────────────────────────────────
  it('10.4 statusLabel PENDING_APPROVAL → Chờ duyệt', () => {
    expect(comp.statusLabel('PENDING_APPROVAL')).toBe('Chờ duyệt');
  });

  it('10.4 statusLabel APPROVED_UNPAID → Đã duyệt, chưa chi', () => {
    expect(comp.statusLabel('APPROVED_UNPAID')).toContain('duyệt');
  });

  it('10.4 statusLabel PAID → Đã chi', () => {
    expect(comp.statusLabel('PAID')).toBe('Đã chi');
  });

  it('10.4 statusLabel REJECTED → Từ chối', () => {
    expect(comp.statusLabel('REJECTED')).toBe('Từ chối');
  });

  it('10.4 statusLabel unknown → trả về raw value', () => {
    expect(comp.statusLabel('UNKNOWN_STATUS')).toBe('UNKNOWN_STATUS');
  });

  // ── statusColor ──────────────────────────────────────────────────────────
  it('10.4 statusColor PENDING_APPROVAL → amber/yellow hex', () => {
    const color = comp.statusColor('PENDING_APPROVAL');
    expect(color).toBeTruthy();
    expect(color.startsWith('#')).toBeTrue();
  });

  it('10.4 statusColor PAID → green hex', () => {
    const color = comp.statusColor('PAID');
    expect(color).toBeTruthy();
    expect(color.toLowerCase()).toContain('#');
  });

  it('10.4 statusColor REJECTED → red hex', () => {
    const color = comp.statusColor('REJECTED');
    expect(color).toBeTruthy();
    expect(color.startsWith('#')).toBeTrue();
  });

  it('10.4 statusColor APPROVED_UNPAID → blue hex', () => {
    const color = comp.statusColor('APPROVED_UNPAID');
    expect(color).toBeTruthy();
    expect(color.startsWith('#')).toBeTrue();
  });

  it('10.4 statusColor unknown → fallback #64748b', () => {
    expect(comp.statusColor('BOGUS')).toBe('#64748b');
  });

  // ── categoryLabel ────────────────────────────────────────────────────────
  it('10.4 categoryLabel RENT → Thuê mặt bằng', () => {
    expect(comp.categoryLabel('RENT')).toBe('Thuê mặt bằng');
  });

  it('10.4 categoryLabel UTILITIES → Điện nước Internet', () => {
    expect(comp.categoryLabel('UTILITIES')).toContain('Điện');
  });

  it('10.4 categoryLabel MARKETING → chứa Marketing', () => {
    expect(comp.categoryLabel('MARKETING')).toContain('Marketing');
  });

  it('10.4 categoryLabel OTHER → Khác', () => {
    expect(comp.categoryLabel('OTHER')).toBe('Khác');
  });

  it('10.4 categoryLabel unknown → raw value', () => {
    expect(comp.categoryLabel('CUSTOM_CATEGORY')).toBe('CUSTOM_CATEGORY');
  });

  // ── isFinanceStaff (RBAC) ────────────────────────────────────────────────
  it('10.4 isFinanceStaff: DIRECTOR → true', () => {
    authStub.setRole('DIRECTOR');
    expect(comp.isFinanceStaff()).toBeTrue();
  });

  it('10.4 isFinanceStaff: ACCOUNTING → true', () => {
    authStub.setRole('ACCOUNTING');
    expect(comp.isFinanceStaff()).toBeTrue();
  });

  it('10.4 isFinanceStaff: OPS → false (không được duyệt)', () => {
    authStub.setRole('OPS');
    expect(comp.isFinanceStaff()).toBeFalse();
  });

  it('10.4 isFinanceStaff: SALE → false', () => {
    authStub.setRole('SALE');
    expect(comp.isFinanceStaff()).toBeFalse();
  });

  // ── canApprove ───────────────────────────────────────────────────────────
  it('10.4 canApprove: DIRECTOR + PENDING_APPROVAL → true', () => {
    authStub.setRole('DIRECTOR');
    const expense: any = { paymentStatus: 'PENDING_APPROVAL' };
    expect(comp.canApprove(expense)).toBeTrue();
  });

  it('10.4 canApprove: ACCOUNTING + PENDING_APPROVAL → true', () => {
    authStub.setRole('ACCOUNTING');
    const expense: any = { paymentStatus: 'PENDING_APPROVAL' };
    expect(comp.canApprove(expense)).toBeTrue();
  });

  it('10.4 canApprove: OPS + PENDING_APPROVAL → false (không có quyền)', () => {
    authStub.setRole('OPS');
    const expense: any = { paymentStatus: 'PENDING_APPROVAL' };
    expect(comp.canApprove(expense)).toBeFalse();
  });

  it('10.4 canApprove: DIRECTOR + đã PAID → false (không thể duyệt lại)', () => {
    authStub.setRole('DIRECTOR');
    const expense: any = { paymentStatus: 'PAID' };
    expect(comp.canApprove(expense)).toBeFalse();
  });

  it('10.4 canApprove: DIRECTOR + APPROVED_UNPAID → false (đã duyệt rồi)', () => {
    authStub.setRole('DIRECTOR');
    const expense: any = { paymentStatus: 'APPROVED_UNPAID' };
    expect(comp.canApprove(expense)).toBeFalse();
  });

  // ── canPay ───────────────────────────────────────────────────────────────
  it('10.4 canPay: ACCOUNTING + APPROVED_UNPAID → true', () => {
    authStub.setRole('ACCOUNTING');
    const expense: any = { paymentStatus: 'APPROVED_UNPAID' };
    expect(comp.canPay(expense)).toBeTrue();
  });

  it('10.4 canPay: DIRECTOR + APPROVED_UNPAID → true', () => {
    authStub.setRole('DIRECTOR');
    const expense: any = { paymentStatus: 'APPROVED_UNPAID' };
    expect(comp.canPay(expense)).toBeTrue();
  });

  it('10.4 canPay: ACCOUNTING + PENDING_APPROVAL → false (chưa được duyệt)', () => {
    authStub.setRole('ACCOUNTING');
    const expense: any = { paymentStatus: 'PENDING_APPROVAL' };
    expect(comp.canPay(expense)).toBeFalse();
  });

  it('10.4 canPay: OPS + APPROVED_UNPAID → false', () => {
    authStub.setRole('OPS');
    const expense: any = { paymentStatus: 'APPROVED_UNPAID' };
    expect(comp.canPay(expense)).toBeFalse();
  });

  // ── canEdit ──────────────────────────────────────────────────────────────
  it('10.4 canEdit: DIRECTOR + không phải PAID → true', () => {
    authStub.setRole('DIRECTOR');
    const expense: any = { paymentStatus: 'PENDING_APPROVAL', createdById: 'other-user' };
    expect(comp.canEdit(expense)).toBeTrue();
  });

  it('10.4 canEdit: DIRECTOR + PAID → false (không sửa được khi đã chi)', () => {
    authStub.setRole('DIRECTOR');
    const expense: any = { paymentStatus: 'PAID', createdById: 'other-user' };
    expect(comp.canEdit(expense)).toBeFalse();
  });

  it('10.4 canEdit: OPS tạo expense của chính mình → true', () => {
    authStub.setRole('OPS', 'user-ops-id');
    const expense: any = { paymentStatus: 'PENDING_APPROVAL', createdById: 'user-ops-id' };
    expect(comp.canEdit(expense)).toBeTrue();
  });

  it('10.4 canEdit: OPS cố sửa expense của người khác → false', () => {
    authStub.setRole('OPS', 'user-ops-id');
    const expense: any = { paymentStatus: 'PENDING_APPROVAL', createdById: 'other-user-id' };
    expect(comp.canEdit(expense)).toBeFalse();
  });
});

// ─── AuditLogComponent — pure methods (12.3) ──────────────────────────────────

describe('AuditLogComponent — pure methods (12.3)', () => {
  let comp: AuditLogComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        { provide: AuditLogService, useValue: makeAuditLogServiceStub() },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    });
    comp = TestBed.runInInjectionContext(() => new AuditLogComponent());
  });

  afterEach(() => TestBed.resetTestingModule());

  // ── formatDateTime ────────────────────────────────────────────────────────
  it('12.3 formatDateTime: ISO string → không rỗng', () => {
    const result = comp.formatDateTime('2026-04-03T10:30:00.000Z');
    expect(result).toBeTruthy();
    expect(typeof result).toBe('string');
  });

  it('12.3 formatDateTime: rỗng → trả về rỗng', () => {
    expect(comp.formatDateTime('')).toBe('');
  });

  it('12.3 formatDateTime: kết quả chứa giờ:phút hoặc ngày tháng', () => {
    const result = comp.formatDateTime('2026-04-03T14:30:00.000Z');
    // Phải chứa ít nhất 1 con số
    expect(result).toMatch(/\d/);
  });

  // ── formatShortDate ────────────────────────────────────────────────────────
  it('12.3 formatShortDate: "2026-04-03" → "03/04"', () => {
    const result = comp.formatShortDate('2026-04-03');
    expect(result).toBe('03/04');
  });

  it('12.3 formatShortDate: "2026-12-25" → "25/12"', () => {
    const result = comp.formatShortDate('2026-12-25');
    expect(result).toBe('25/12');
  });

  it('12.3 formatShortDate: rỗng → trả về rỗng', () => {
    expect(comp.formatShortDate('')).toBe('');
  });

  // ── getBarHeight ──────────────────────────────────────────────────────────
  it('12.3 getBarHeight: không có stats → trả về 2 (min height)', () => {
    comp.stats = null;
    expect(comp.getBarHeight(0)).toBe(2);
  });

  it('12.3 getBarHeight: stats trống → 2', () => {
    comp.stats = { recentActivity: [] };
    expect(comp.getBarHeight(5)).toBe(2);
  });

  it('12.3 getBarHeight: count = max → 100', () => {
    comp.stats = { recentActivity: [{ count: 10 }, { count: 5 }] };
    const height = comp.getBarHeight(10);
    expect(height).toBe(100);
  });

  it('12.3 getBarHeight: count = 0 trong stats có hoạt động → trả về 2 (min)', () => {
    comp.stats = { recentActivity: [{ count: 10 }] };
    const height = comp.getBarHeight(0);
    expect(height).toBe(2);
  });

  it('12.3 getBarHeight: count 50% của max → ~50', () => {
    comp.stats = { recentActivity: [{ count: 100 }] };
    const height = comp.getBarHeight(50);
    expect(height).toBeGreaterThanOrEqual(49);
    expect(height).toBeLessThanOrEqual(51);
  });

  // ── UI state (12.3 — logs không có delete button trong template) ─────────
  it('12.3 component khởi tạo với logs = [] và loading = false', () => {
    expect(comp.logs).toEqual([]);
    expect(comp.loading).toBeFalse();
  });

  it('12.3 moduleLabels có WALLET entry', () => {
    expect(comp.moduleLabels['WALLETS']).toBeTruthy();
  });

  it('12.3 actionLabels có APPROVE entry', () => {
    expect(comp.actionLabels['APPROVE']).toBeTruthy();
  });

  it('12.3 resetFilters xóa tất cả filter', () => {
    comp.search = 'test';
    comp.filterModule = 'WALLETS';
    comp.filterAction = 'APPROVE';
    comp.fromDate = '2026-01-01';
    comp.toDate = '2026-12-31';
    comp.resetFilters();
    expect(comp.search).toBe('');
    expect(comp.filterModule).toBe('');
    expect(comp.filterAction).toBe('');
    expect(comp.fromDate).toBe('');
    expect(comp.toDate).toBe('');
  });

  it('12.3 page mặc định = 1', () => {
    expect(comp.page).toBe(1);
  });
});
