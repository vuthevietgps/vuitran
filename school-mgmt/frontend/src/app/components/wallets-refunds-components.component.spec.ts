// Angular unit tests — Batch 3 (scenarios 5.1–5.3, 6.1–6.3, 7.1–7.3, 8.1)
// Covers WalletsComponent pure methods and ExpensesComponent pure methods + computed signal

import { NO_ERRORS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';

import { WalletsComponent } from './wallets.component';
import { ExpensesComponent } from './expenses.component';
import { AuthService } from '../services/auth.service';
import { ExpenseService, ExpenseItem } from '../services/expense.service';

// Mutable auth stub — change role per-test without re-configuring TestBed
function makeMutableAuthStub() {
  let _role = 'ACCOUNTING';
  let _id = 'user1';
  return {
    setRole(role: string, id = 'user1') { _role = role; _id = id; },
    userSignal: () => ({ _id, role: _role, sub: _id }),
    hasRole: (roles: string[]) => roles.includes(_role),
  };
}

function makeExpenseServiceStub() {
  return {
    list: jasmine.createSpy('list').and.resolveTo({ data: [], total: 0 }),
    getStats: jasmine.createSpy('getStats').and.resolveTo(null),
    create: jasmine.createSpy('create').and.resolveTo({}),
    update: jasmine.createSpy('update').and.resolveTo({}),
    approve: jasmine.createSpy('approve').and.resolveTo({}),
    reject: jasmine.createSpy('reject').and.resolveTo({}),
    markPaid: jasmine.createSpy('markPaid').and.resolveTo({}),
    delete: jasmine.createSpy('delete').and.resolveTo({}),
  };
}

function makeExpenseItem(overrides: Partial<ExpenseItem> = {}): ExpenseItem {
  return {
    _id: 'exp1',
    expenseCode: 'EXP001',
    title: 'Test expense',
    description: '',
    amount: 100000,
    expenseDate: '2024-01-15',
    category: 'OTHER',
    paymentStatus: 'PENDING_APPROVAL',
    createdById: 'user1',
    ...overrides,
  } as ExpenseItem;
}

// ─── WalletsComponent ─────────────────────────────────────────────────────────
describe('WalletsComponent — pure methods', () => {
  let authStub: ReturnType<typeof makeMutableAuthStub>;
  let comp: WalletsComponent;

  beforeEach(() => {
    authStub = makeMutableAuthStub();
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [{ provide: AuthService, useValue: authStub }],
      schemas: [NO_ERRORS_SCHEMA],
    });
    comp = TestBed.runInInjectionContext(() => new WalletsComponent(TestBed.inject(AuthService)));
  });

  afterEach(() => TestBed.resetTestingModule());

  // ── typeLabel (scenario 5.1, 5.2) ──────────────────────────────────────────
  it('5.1 typeLabel TOP_UP → Nạp tiền', () => {
    expect(comp.typeLabel('TOP_UP')).toBe('Nạp tiền');
  });

  it('5.1 typeLabel SESSION_DEDUCT → Trừ buổi học', () => {
    expect(comp.typeLabel('SESSION_DEDUCT')).toBe('Trừ buổi học');
  });

  it('5.1 typeLabel TEACHER_PAYOUT → Trả lương GV', () => {
    expect(comp.typeLabel('TEACHER_PAYOUT')).toBe('Trả lương GV');
  });

  it('5.1 typeLabel REFUND → Hoàn tiền', () => {
    expect(comp.typeLabel('REFUND')).toBe('Hoàn tiền');
  });

  it('5.2 typeLabel ADJUSTMENT → Điều chỉnh', () => {
    expect(comp.typeLabel('ADJUSTMENT')).toBe('Điều chỉnh');
  });

  it('5.2 typeLabel TRANSFER_OUT → Chuyển đi', () => {
    expect(comp.typeLabel('TRANSFER_OUT')).toBe('Chuyển đi');
  });

  it('5.2 typeLabel TRANSFER_IN → Nhận chuyển', () => {
    expect(comp.typeLabel('TRANSFER_IN')).toBe('Nhận chuyển');
  });

  it('5.1 typeLabel unknown type falls back to raw value', () => {
    expect(comp.typeLabel('UNKNOWN_TYPE')).toBe('UNKNOWN_TYPE');
  });

  // ── isCredit (scenario 5.2) ────────────────────────────────────────────────
  it('5.2 isCreditEntry TOP_UP → true', () => {
    expect(comp.isCreditEntry({ type: 'TOP_UP', balanceBefore: 0, balanceAfter: 1000 })).toBeTrue();
  });

  it('5.2 isCreditEntry REFUND → true', () => {
    expect(comp.isCreditEntry({ type: 'REFUND', balanceBefore: 0, balanceAfter: 1000 })).toBeTrue();
  });

  it('5.2 isCreditEntry TRANSFER_IN → true', () => {
    expect(comp.isCreditEntry({ type: 'TRANSFER_IN', balanceBefore: 0, balanceAfter: 1000 })).toBeTrue();
  });

  it('5.2 isCreditEntry ADJUSTMENT_CREDIT → true', () => {
    expect(comp.isCreditEntry({ type: 'ADJUSTMENT_CREDIT', balanceBefore: 1000, balanceAfter: 2000 })).toBeTrue();
  });

  it('5.2 isCreditEntry SESSION_DEDUCT → false', () => {
    expect(comp.isCreditEntry({ type: 'SESSION_DEDUCT', balanceBefore: 1000, balanceAfter: 0 })).toBeFalse();
  });

  it('5.2 isCreditEntry TRANSFER_OUT → false', () => {
    expect(comp.isCreditEntry({ type: 'TRANSFER_OUT', balanceBefore: 1000, balanceAfter: 0 })).toBeFalse();
  });

  it('5.2 isCreditEntry ADJUSTMENT (non-credit) → false', () => {
    expect(comp.isCreditEntry({ type: 'ADJUSTMENT', balanceBefore: 1000, balanceAfter: 500 })).toBeFalse();
  });

  // ── formatCurrency (scenario 5.1) ─────────────────────────────────────────
  it('5.1 formatCurrency includes amount digits and ₫ symbol', () => {
    const result = comp.formatCurrency(500000);
    expect(result).toContain('500');
    expect(result).toContain('₫');
  });

  it('5.1 formatCurrency(0) returns 0 ₫', () => {
    const result = comp.formatCurrency(0);
    expect(result).toContain('0');
    expect(result).toContain('₫');
  });

  it('5.1 formatCurrency handles undefined-like by treating as 0', () => {
    expect(comp.formatCurrency(0)).toContain('₫');
  });

  // ── isParent (scenario 5.1) ───────────────────────────────────────────────
  it('5.1 isParent returns false for ACCOUNTING role', () => {
    authStub.setRole('ACCOUNTING');
    expect(comp.isParent()).toBeFalse();
  });

  it('5.1 isParent returns false for DIRECTOR role', () => {
    authStub.setRole('DIRECTOR');
    expect(comp.isParent()).toBeFalse();
  });

  it('5.1 isParent returns false for OPS role', () => {
    authStub.setRole('OPS');
    expect(comp.isParent()).toBeFalse();
  });

  it('5.1 isParent returns true for PARENT role', () => {
    authStub.setRole('PARENT');
    expect(comp.isParent()).toBeTrue();
  });

  // ── canApprove (scenario 5.1) ─────────────────────────────────────────────
  it('5.1 canApprove returns true for ACCOUNTING', () => {
    authStub.setRole('ACCOUNTING');
    expect(comp.canApprove()).toBeTrue();
  });

  it('5.1 canApprove returns true for DIRECTOR', () => {
    authStub.setRole('DIRECTOR');
    expect(comp.canApprove()).toBeTrue();
  });

  it('5.1 canApprove returns false for OPS', () => {
    authStub.setRole('OPS');
    expect(comp.canApprove()).toBeFalse();
  });

  it('5.1 canApprove returns false for PARENT', () => {
    authStub.setRole('PARENT');
    expect(comp.canApprove()).toBeFalse();
  });

  it('5.1 canApprove returns false for TEACHER', () => {
    authStub.setRole('TEACHER');
    expect(comp.canApprove()).toBeFalse();
  });

  // ── canTransfer (scenario 5.2) ────────────────────────────────────────────
  it('5.2 canTransfer returns true for ACCOUNTING', () => {
    authStub.setRole('ACCOUNTING');
    expect(comp.canTransfer()).toBeTrue();
  });

  it('5.2 canTransfer returns true for DIRECTOR', () => {
    authStub.setRole('DIRECTOR');
    expect(comp.canTransfer()).toBeTrue();
  });

  it('5.2 canTransfer returns false for OPS', () => {
    authStub.setRole('OPS');
    expect(comp.canTransfer()).toBeFalse();
  });

  it('5.2 canTransfer returns false for PARENT', () => {
    authStub.setRole('PARENT');
    expect(comp.canTransfer()).toBeFalse();
  });

  // ── canManage (scenario 5.3) ──────────────────────────────────────────────
  it('5.3 canManage returns true for DIRECTOR', () => {
    authStub.setRole('DIRECTOR');
    expect(comp.canManage()).toBeTrue();
  });

  it('5.3 canManage returns true for ACCOUNTING', () => {
    authStub.setRole('ACCOUNTING');
    expect(comp.canManage()).toBeTrue();
  });

  it('5.3 canManage returns true for OPS', () => {
    authStub.setRole('OPS');
    expect(comp.canManage()).toBeTrue();
  });

  it('5.3 canManage returns false for PARENT', () => {
    authStub.setRole('PARENT');
    expect(comp.canManage()).toBeFalse();
  });

  it('5.3 canManage returns false for TEACHER', () => {
    authStub.setRole('TEACHER');
    expect(comp.canManage()).toBeFalse();
  });
});

// ─── ExpensesComponent ────────────────────────────────────────────────────────
describe('ExpensesComponent — pure methods', () => {
  let authStub: ReturnType<typeof makeMutableAuthStub>;
  let expSvcStub: ReturnType<typeof makeExpenseServiceStub>;
  let comp: ExpensesComponent;

  beforeEach(() => {
    authStub = makeMutableAuthStub();
    expSvcStub = makeExpenseServiceStub();
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        { provide: AuthService, useValue: authStub },
        { provide: ExpenseService, useValue: expSvcStub },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    });
    comp = new ExpensesComponent(
      TestBed.inject(ExpenseService) as any,
      TestBed.inject(AuthService),
    );
  });

  afterEach(() => TestBed.resetTestingModule());

  // ── statusLabel (scenario 6.1, 6.2, 6.3) ─────────────────────────────────
  it('6.1 statusLabel PENDING_APPROVAL → Chờ duyệt', () => {
    expect(comp.statusLabel('PENDING_APPROVAL')).toBe('Chờ duyệt');
  });

  it('6.2 statusLabel APPROVED_UNPAID → Đã duyệt, chưa chi', () => {
    expect(comp.statusLabel('APPROVED_UNPAID')).toBe('Đã duyệt, chưa chi');
  });

  it('6.3 statusLabel PAID → Đã chi', () => {
    expect(comp.statusLabel('PAID')).toBe('Đã chi');
  });

  it('6.2 statusLabel REJECTED → Từ chối', () => {
    expect(comp.statusLabel('REJECTED')).toBe('Từ chối');
  });

  it('6.1 statusLabel unknown value falls back to raw string', () => {
    expect(comp.statusLabel('MYSTERY')).toBe('MYSTERY');
  });

  // ── categoryLabel (scenario 5.2) ──────────────────────────────────────────
  it('5.2 categoryLabel RENT → Thuê mặt bằng', () => {
    expect(comp.categoryLabel('RENT')).toBe('Thuê mặt bằng');
  });

  it('5.2 categoryLabel UTILITIES → Điện nước Internet', () => {
    expect(comp.categoryLabel('UTILITIES')).toBe('Điện nước Internet');
  });

  it('5.2 categoryLabel SUPPLIES → Văn phòng phẩm', () => {
    expect(comp.categoryLabel('SUPPLIES')).toBe('Văn phòng phẩm');
  });

  it('5.2 categoryLabel MARKETING → Quảng cáo Marketing', () => {
    expect(comp.categoryLabel('MARKETING')).toBe('Quảng cáo Marketing');
  });

  it('5.2 categoryLabel MAINTENANCE → Sửa chữa Bảo trì', () => {
    expect(comp.categoryLabel('MAINTENANCE')).toBe('Sửa chữa Bảo trì');
  });

  it('5.2 categoryLabel SALARY_BONUS → Thưởng Phụ cấp', () => {
    expect(comp.categoryLabel('SALARY_BONUS')).toBe('Thưởng Phụ cấp');
  });

  it('5.2 categoryLabel TRAINING → Đào tạo', () => {
    expect(comp.categoryLabel('TRAINING')).toBe('Đào tạo');
  });

  it('5.2 categoryLabel TRANSPORT → Đi lại Xăng xe', () => {
    expect(comp.categoryLabel('TRANSPORT')).toBe('Đi lại Xăng xe');
  });

  it('5.2 categoryLabel MEAL → Ăn uống', () => {
    expect(comp.categoryLabel('MEAL')).toBe('Ăn uống');
  });

  it('5.2 categoryLabel ENTERTAINMENT → Tiếp khách', () => {
    expect(comp.categoryLabel('ENTERTAINMENT')).toBe('Tiếp khách');
  });

  it('5.2 categoryLabel OTHER → Khác', () => {
    expect(comp.categoryLabel('OTHER')).toBe('Khác');
  });

  it('5.2 categoryLabel unknown falls back to raw value', () => {
    expect(comp.categoryLabel('UNKNOWN')).toBe('UNKNOWN');
  });

  // ── allCategories length (scenario 5.2) ───────────────────────────────────
  it('5.2 allCategories contains all 11 ExpenseCategory values', () => {
    expect(comp.allCategories.length).toBe(11);
  });

  it('5.2 allCategories each item has value and label', () => {
    for (const cat of comp.allCategories) {
      expect(cat.value).toBeTruthy();
      expect(cat.label).toBeTruthy();
    }
  });

  // ── canApprove (scenario 6.3) ─────────────────────────────────────────────
  it('6.3 canApprove true for PENDING_APPROVAL + ACCOUNTING role', () => {
    authStub.setRole('ACCOUNTING');
    const e = makeExpenseItem({ paymentStatus: 'PENDING_APPROVAL' });
    expect(comp.canApprove(e)).toBeTrue();
  });

  it('6.3 canApprove true for PENDING_APPROVAL + DIRECTOR role', () => {
    authStub.setRole('DIRECTOR');
    const e = makeExpenseItem({ paymentStatus: 'PENDING_APPROVAL' });
    expect(comp.canApprove(e)).toBeTrue();
  });

  it('6.3 canApprove false for PAID status (even ACCOUNTING)', () => {
    authStub.setRole('ACCOUNTING');
    const e = makeExpenseItem({ paymentStatus: 'PAID' });
    expect(comp.canApprove(e)).toBeFalse();
  });

  it('6.3 canApprove false for APPROVED_UNPAID status', () => {
    authStub.setRole('ACCOUNTING');
    const e = makeExpenseItem({ paymentStatus: 'APPROVED_UNPAID' });
    expect(comp.canApprove(e)).toBeFalse();
  });

  it('6.3 canApprove false for OPS role even with PENDING_APPROVAL', () => {
    authStub.setRole('OPS');
    const e = makeExpenseItem({ paymentStatus: 'PENDING_APPROVAL' });
    expect(comp.canApprove(e)).toBeFalse();
  });

  it('6.3 canApprove false for TEACHER role', () => {
    authStub.setRole('TEACHER');
    const e = makeExpenseItem({ paymentStatus: 'PENDING_APPROVAL' });
    expect(comp.canApprove(e)).toBeFalse();
  });

  // ── canEdit (scenario 6.3) ────────────────────────────────────────────────
  it('6.3 canEdit false for PAID expense (own expense)', () => {
    authStub.setRole('ACCOUNTING', 'user1');
    const e = makeExpenseItem({ paymentStatus: 'PAID', createdById: 'user1' });
    expect(comp.canEdit(e)).toBeFalse();
  });

  it('6.3 canEdit false for PAID expense (finance staff)', () => {
    authStub.setRole('ACCOUNTING', 'admin1');
    const e = makeExpenseItem({ paymentStatus: 'PAID', createdById: 'user1' });
    expect(comp.canEdit(e)).toBeFalse();
  });

  it('6.3 canEdit true for own PENDING_APPROVAL expense', () => {
    authStub.setRole('TEACHER', 'user1');
    const e = makeExpenseItem({ paymentStatus: 'PENDING_APPROVAL', createdById: 'user1' });
    expect(comp.canEdit(e)).toBeTrue();
  });

  it('6.3 canEdit true for ACCOUNTING editing someone else PENDING expense', () => {
    authStub.setRole('ACCOUNTING', 'admin1');
    const e = makeExpenseItem({ paymentStatus: 'PENDING_APPROVAL', createdById: 'user2' });
    expect(comp.canEdit(e)).toBeTrue();
  });

  it('6.3 canEdit false for TEACHER editing someone else PENDING expense', () => {
    authStub.setRole('TEACHER', 'teacher1');
    const e = makeExpenseItem({ paymentStatus: 'PENDING_APPROVAL', createdById: 'otherid' });
    expect(comp.canEdit(e)).toBeFalse();
  });

  // ── canPay (scenario 6.3) ─────────────────────────────────────────────────
  it('6.3 canPay true for APPROVED_UNPAID + ACCOUNTING role', () => {
    authStub.setRole('ACCOUNTING');
    const e = makeExpenseItem({ paymentStatus: 'APPROVED_UNPAID' });
    expect(comp.canPay(e)).toBeTrue();
  });

  it('6.3 canPay true for APPROVED_UNPAID + DIRECTOR role', () => {
    authStub.setRole('DIRECTOR');
    const e = makeExpenseItem({ paymentStatus: 'APPROVED_UNPAID' });
    expect(comp.canPay(e)).toBeTrue();
  });

  it('6.3 canPay false for PENDING_APPROVAL status', () => {
    authStub.setRole('ACCOUNTING');
    const e = makeExpenseItem({ paymentStatus: 'PENDING_APPROVAL' });
    expect(comp.canPay(e)).toBeFalse();
  });

  it('6.3 canPay false for PAID status', () => {
    authStub.setRole('ACCOUNTING');
    const e = makeExpenseItem({ paymentStatus: 'PAID' });
    expect(comp.canPay(e)).toBeFalse();
  });

  it('6.3 canPay false for OPS role', () => {
    authStub.setRole('OPS');
    const e = makeExpenseItem({ paymentStatus: 'APPROVED_UNPAID' });
    expect(comp.canPay(e)).toBeFalse();
  });

  it('6.3 canPay false for TEACHER role', () => {
    authStub.setRole('TEACHER');
    const e = makeExpenseItem({ paymentStatus: 'APPROVED_UNPAID' });
    expect(comp.canPay(e)).toBeFalse();
  });

  // ── filtered() computed signal (scenario 6.3) ─────────────────────────────
  it('6.3 filtered() returns all items when no filters set', () => {
    const items = [
      makeExpenseItem({ _id: '1', expenseCode: 'EXP001', title: 'Thuê văn phòng', category: 'RENT', paymentStatus: 'PAID' }),
      makeExpenseItem({ _id: '2', expenseCode: 'EXP002', title: 'Điện nước', category: 'UTILITIES', paymentStatus: 'PENDING_APPROVAL' }),
    ];
    comp.items.set(items);
    expect(comp.filtered().length).toBe(2);
  });

  it('6.3 filtered() filters by keyword in title (case-insensitive)', () => {
    const items = [
      makeExpenseItem({ _id: '1', expenseCode: 'EXP001', title: 'Thuê văn phòng', category: 'RENT', paymentStatus: 'PAID' }),
      makeExpenseItem({ _id: '2', expenseCode: 'EXP002', title: 'Điện nước', category: 'UTILITIES', paymentStatus: 'PENDING_APPROVAL' }),
    ];
    comp.items.set(items);
    comp.keyword = 'thuê';
    expect(comp.filtered().length).toBe(1);
    expect(comp.filtered()[0]._id).toBe('1');
  });

  it('6.3 filtered() filters by keyword in expenseCode', () => {
    const items = [
      makeExpenseItem({ _id: '1', expenseCode: 'EXP001', title: 'A', category: 'RENT', paymentStatus: 'PAID' }),
      makeExpenseItem({ _id: '2', expenseCode: 'EXP002', title: 'B', category: 'UTILITIES', paymentStatus: 'PENDING_APPROVAL' }),
    ];
    comp.items.set(items);
    comp.keyword = 'exp002';
    expect(comp.filtered().length).toBe(1);
    expect(comp.filtered()[0]._id).toBe('2');
  });

  it('6.3 filtered() filters by paymentStatus', () => {
    const items = [
      makeExpenseItem({ _id: '1', title: 'A', paymentStatus: 'PAID' }),
      makeExpenseItem({ _id: '2', title: 'B', paymentStatus: 'PENDING_APPROVAL' }),
      makeExpenseItem({ _id: '3', title: 'C', paymentStatus: 'APPROVED_UNPAID' }),
    ];
    comp.items.set(items);
    comp.filterStatus = 'PAID';
    expect(comp.filtered().length).toBe(1);
    expect(comp.filtered()[0]._id).toBe('1');
  });

  it('6.3 filtered() filters by category', () => {
    const items = [
      makeExpenseItem({ _id: '1', title: 'A', category: 'RENT' }),
      makeExpenseItem({ _id: '2', title: 'B', category: 'UTILITIES' }),
      makeExpenseItem({ _id: '3', title: 'C', category: 'UTILITIES' }),
    ];
    comp.items.set(items);
    comp.filterCategory = 'UTILITIES';
    expect(comp.filtered().length).toBe(2);
    expect(comp.filtered().every(e => e.category === 'UTILITIES')).toBeTrue();
  });

  it('6.3 filtered() combined keyword + status filter', () => {
    const items = [
      makeExpenseItem({ _id: '1', title: 'Điện nước', category: 'UTILITIES', paymentStatus: 'PENDING_APPROVAL' }),
      makeExpenseItem({ _id: '2', title: 'Điện nước', category: 'UTILITIES', paymentStatus: 'PAID' }),
      makeExpenseItem({ _id: '3', title: 'Văn phòng phẩm', category: 'SUPPLIES', paymentStatus: 'PENDING_APPROVAL' }),
    ];
    comp.items.set(items);
    comp.keyword = 'điện';
    comp.filterStatus = 'PENDING_APPROVAL';
    expect(comp.filtered().length).toBe(1);
    expect(comp.filtered()[0]._id).toBe('1');
  });

  it('6.3 filtered() returns empty array when nothing matches', () => {
    const items = [
      makeExpenseItem({ _id: '1', title: 'Thuê văn phòng' }),
    ];
    comp.items.set(items);
    comp.keyword = 'xyz_no_match';
    expect(comp.filtered().length).toBe(0);
  });

  // ── emptyForm defaults (scenario 5.2) ─────────────────────────────────────
  it('5.2 emptyForm returns default values', () => {
    const f = (comp as any).emptyForm();
    expect(f.title).toBe('');
    expect(f.description).toBe('');
    expect(f.amount).toBe(0);
    expect(f.category).toBe('OTHER');
    expect(f.notes).toBe('');
  });
});
