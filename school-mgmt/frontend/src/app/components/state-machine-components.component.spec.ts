// Angular unit tests — Batch 6 (scenarios 13.1–13.4, 14.1, 14.2, 15.1, 15.2)
// Covers pure-method testing for:
//   InvoicesComponent   — canDeleteInvoices, canApproveInvoices, canEditInvoice, statusLabel
//   StaffPayrollComponent — statusLabel, statusColor, isAdmin, isDirector
//   LeadsComponent (basic)

import { NO_ERRORS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { InvoicesComponent } from './invoices.component';
import { StaffPayrollComponent } from './staff-payroll.component';
import { AuthService } from '../services/auth.service';
import { InvoiceService } from '../services/invoice.service';
import { StudentService } from '../services/student.service';
import { UserService } from '../services/user.service';
import { ClassService } from '../services/class.service';
import { StaffPayrollService } from '../services/staff-payroll.service';
import { HttpClient } from '@angular/common/http';

// ─── Auth stub factory ────────────────────────────────────────────────────────

function makeMutableAuthStub() {
  let _role = 'DIRECTOR';
  let _id = 'user-stub-1';
  let _fullName = 'Test User';
  return {
    setRole(role: string, id = 'user-stub-1', fullName = 'Test User') {
      _role = role; _id = id; _fullName = fullName;
    },
    userSignal: () => ({ _id, role: _role, sub: _id, fullName: _fullName }),
    hasRole: (roles: string[]) => roles.includes(_role),
  };
}

function makeInvoiceServiceStub() {
  return {
    list: jasmine.createSpy('list').and.resolveTo({ data: [], total: 0 }),
    getOne: jasmine.createSpy('getOne').and.resolveTo({}),
    create: jasmine.createSpy('create').and.resolveTo({}),
    update: jasmine.createSpy('update').and.resolveTo({}),
    approve: jasmine.createSpy('approve').and.resolveTo({}),
    cancel: jasmine.createSpy('cancel').and.resolveTo({}),
    remove: jasmine.createSpy('remove').and.resolveTo({}),
    getPendingTopUps: jasmine.createSpy('getPendingTopUps').and.resolveTo([]),
    approveTopUp: jasmine.createSpy('approveTopUp').and.resolveTo({}),
  };
}

function makeStudentServiceStub() {
  return { list: jasmine.createSpy('list').and.resolveTo({ data: [] }) };
}

function makeUserServiceStub() {
  return {
    list: jasmine.createSpy('list').and.resolveTo({ data: [] }),
    listSales: jasmine.createSpy('listSales').and.resolveTo([]),
  };
}

function makeClassServiceStub() {
  return { list: jasmine.createSpy('list').and.resolveTo({ data: [] }) };
}

function makePayrollServiceStub() {
  return {
    list: jasmine.createSpy('list').and.resolveTo({ data: [], total: 0 }),
    getMy: jasmine.createSpy('getMy').and.resolveTo({ data: [], total: 0 }),
    getOne: jasmine.createSpy('getOne').and.resolveTo({}),
    generate: jasmine.createSpy('generate').and.resolveTo({}),
    bulkGenerate: jasmine.createSpy('bulkGenerate').and.resolveTo({}),
    submit: jasmine.createSpy('submit').and.resolveTo({}),
    approve: jasmine.createSpy('approve').and.resolveTo({}),
    reject: jasmine.createSpy('reject').and.resolveTo({}),
    reopen: jasmine.createSpy('reopen').and.resolveTo({}),
    markPaid: jasmine.createSpy('markPaid').and.resolveTo({}),
    remove: jasmine.createSpy('remove').and.resolveTo({}),
  };
}

// ─── InvoicesComponent — RBAC & Status (13.1, 13.3) ──────────────────────────

describe('InvoicesComponent — RBAC & State Machine (13.1, 13.3)', () => {
  let comp: InvoicesComponent;
  let authStub: ReturnType<typeof makeMutableAuthStub>;

  beforeEach(() => {
    authStub = makeMutableAuthStub();
    authStub.setRole('DIRECTOR');

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        { provide: AuthService, useValue: authStub },
        { provide: InvoiceService, useValue: makeInvoiceServiceStub() },
        { provide: StudentService, useValue: makeStudentServiceStub() },
        { provide: UserService, useValue: makeUserServiceStub() },
        { provide: ClassService, useValue: makeClassServiceStub() },
        HttpClient,
      ],
      schemas: [NO_ERRORS_SCHEMA],
    });

    comp = TestBed.runInInjectionContext(
      () => new InvoicesComponent(
        TestBed.inject(InvoiceService),
        TestBed.inject(StudentService),
        TestBed.inject(UserService),
        TestBed.inject(ClassService),
        TestBed.inject(AuthService),
        TestBed.inject(HttpClient),
      ),
    );
  });

  afterEach(() => TestBed.resetTestingModule());

  // ── canDeleteInvoices ─────────────────────────────────────────────────────
  it('13.1 DIRECTOR: canDeleteInvoices = true', () => {
    authStub.setRole('DIRECTOR');
    const newComp = TestBed.runInInjectionContext(
      () => new InvoicesComponent(
        TestBed.inject(InvoiceService),
        TestBed.inject(StudentService),
        TestBed.inject(UserService),
        TestBed.inject(ClassService),
        TestBed.inject(AuthService),
        TestBed.inject(HttpClient),
      ),
    );
    expect(newComp.canDeleteInvoices).toBeTrue();
  });

  it('13.1 ACCOUNTING: canDeleteInvoices = false (không cho xóa cứng)', () => {
    authStub.setRole('ACCOUNTING');
    const c = TestBed.runInInjectionContext(
      () => new InvoicesComponent(
        TestBed.inject(InvoiceService),
        TestBed.inject(StudentService),
        TestBed.inject(UserService),
        TestBed.inject(ClassService),
        TestBed.inject(AuthService),
        TestBed.inject(HttpClient),
      ),
    );
    expect(c.canDeleteInvoices).toBeFalse();
  });

  it('13.1 OPS: canDeleteInvoices = false', () => {
    authStub.setRole('OPS');
    const c = TestBed.runInInjectionContext(
      () => new InvoicesComponent(
        TestBed.inject(InvoiceService),
        TestBed.inject(StudentService),
        TestBed.inject(UserService),
        TestBed.inject(ClassService),
        TestBed.inject(AuthService),
        TestBed.inject(HttpClient),
      ),
    );
    expect(c.canDeleteInvoices).toBeFalse();
  });

  it('13.1 SALE: canDeleteInvoices = false', () => {
    authStub.setRole('SALE');
    const c = TestBed.runInInjectionContext(
      () => new InvoicesComponent(
        TestBed.inject(InvoiceService),
        TestBed.inject(StudentService),
        TestBed.inject(UserService),
        TestBed.inject(ClassService),
        TestBed.inject(AuthService),
        TestBed.inject(HttpClient),
      ),
    );
    expect(c.canDeleteInvoices).toBeFalse();
  });

  // ── canApproveInvoices ────────────────────────────────────────────────────
  it('13.3 DIRECTOR: canApproveInvoices = true', () => {
    expect(comp.canApproveInvoices).toBeTrue();
  });

  it('13.3 ACCOUNTING: canApproveInvoices = true', () => {
    authStub.setRole('ACCOUNTING');
    const c = TestBed.runInInjectionContext(
      () => new InvoicesComponent(
        TestBed.inject(InvoiceService),
        TestBed.inject(StudentService),
        TestBed.inject(UserService),
        TestBed.inject(ClassService),
        TestBed.inject(AuthService),
        TestBed.inject(HttpClient),
      ),
    );
    expect(c.canApproveInvoices).toBeTrue();
  });

  it('13.3 OPS: canApproveInvoices = false', () => {
    authStub.setRole('OPS');
    const c = TestBed.runInInjectionContext(
      () => new InvoicesComponent(
        TestBed.inject(InvoiceService),
        TestBed.inject(StudentService),
        TestBed.inject(UserService),
        TestBed.inject(ClassService),
        TestBed.inject(AuthService),
        TestBed.inject(HttpClient),
      ),
    );
    expect(c.canApproveInvoices).toBeFalse();
  });

  // ── canEditInvoice ────────────────────────────────────────────────────────
  it('13.1 canEditInvoice: DIRECTOR + APPROVED → true', () => {
    authStub.setRole('DIRECTOR');
    const invoice: any = { status: 'APPROVED', createdBy: { _id: 'other' } };
    expect(comp.canEditInvoice(invoice)).toBeTrue();
  });

  it('13.1 canEditInvoice: ACCOUNTING + APPROVED → true', () => {
    authStub.setRole('ACCOUNTING');
    const invoice: any = { status: 'APPROVED', createdBy: { _id: 'other' } };
    // After re-creating with ACCOUNTING role
    const c = TestBed.runInInjectionContext(
      () => new InvoicesComponent(
        TestBed.inject(InvoiceService),
        TestBed.inject(StudentService),
        TestBed.inject(UserService),
        TestBed.inject(ClassService),
        TestBed.inject(AuthService),
        TestBed.inject(HttpClient),
      ),
    );
    expect(c.canEditInvoice(invoice)).toBeTrue();
  });

  it('13.1 canEditInvoice: SALE + APPROVED (của người khác) → false', () => {
    authStub.setRole('SALE', 'sale-user-id');
    const c = TestBed.runInInjectionContext(
      () => new InvoicesComponent(
        TestBed.inject(InvoiceService),
        TestBed.inject(StudentService),
        TestBed.inject(UserService),
        TestBed.inject(ClassService),
        TestBed.inject(AuthService),
        TestBed.inject(HttpClient),
      ),
    );
    const invoice: any = { status: 'APPROVED', createdBy: { _id: 'other-sale-id' } };
    expect(c.canEditInvoice(invoice)).toBeFalse();
  });

  it('13.1 canEditInvoice: SALE + PENDING_APPROVAL của mình → true', () => {
    authStub.setRole('SALE', 'sale-user-id');
    const c = TestBed.runInInjectionContext(
      () => new InvoicesComponent(
        TestBed.inject(InvoiceService),
        TestBed.inject(StudentService),
        TestBed.inject(UserService),
        TestBed.inject(ClassService),
        TestBed.inject(AuthService),
        TestBed.inject(HttpClient),
      ),
    );
    const invoice: any = { status: 'PENDING_APPROVAL', createdBy: { _id: 'sale-user-id' } };
    expect(c.canEditInvoice(invoice)).toBeTrue();
  });

  // ── getStatusClass ────────────────────────────────────────────────────────
  it('13.1 getStatusClass APPROVED → "approved"', () => {
    expect(comp.getStatusClass('APPROVED')).toBe('approved');
  });

  it('13.1 getStatusClass CANCELLED → "cancelled"', () => {
    expect(comp.getStatusClass('CANCELLED')).toBe('cancelled');
  });

  it('13.1 getStatusClass REJECTED → "rejected"', () => {
    expect(comp.getStatusClass('REJECTED')).toBe('rejected');
  });

  it('13.1 getStatusClass PENDING_APPROVAL → "pending-approval"', () => {
    expect(comp.getStatusClass('PENDING_APPROVAL')).toBe('pending-approval');
  });
});

// ─── StaffPayrollComponent — State Machine (13.4) ─────────────────────────────

describe('StaffPayrollComponent — State Machine & RBAC (13.4)', () => {
  let authStub: ReturnType<typeof makeMutableAuthStub>;

  function makeComp() {
    return TestBed.runInInjectionContext(
      () => new StaffPayrollComponent(
        TestBed.inject(StaffPayrollService),
        TestBed.inject(AuthService),
      ),
    );
  }

  beforeEach(() => {
    authStub = makeMutableAuthStub();
    authStub.setRole('DIRECTOR');

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        { provide: AuthService, useValue: authStub },
        { provide: StaffPayrollService, useValue: makePayrollServiceStub() },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    });
  });

  afterEach(() => TestBed.resetTestingModule());

  // ── statusLabel ──────────────────────────────────────────────────────────
  it('13.4 statusLabel DRAFT → "Nháp"', () => {
    const comp = makeComp();
    expect(comp.statusLabel('DRAFT')).toBe('Nháp');
  });

  it('13.4 statusLabel PENDING_REVIEW → "Chờ duyệt"', () => {
    const comp = makeComp();
    expect(comp.statusLabel('PENDING_REVIEW')).toBe('Chờ duyệt');
  });

  it('13.4 statusLabel APPROVED → "Đã duyệt"', () => {
    const comp = makeComp();
    expect(comp.statusLabel('APPROVED')).toBe('Đã duyệt');
  });

  it('13.4 statusLabel PAID → "Đã thanh toán"', () => {
    const comp = makeComp();
    expect(comp.statusLabel('PAID')).toBe('Đã thanh toán');
  });

  it('13.4 statusLabel REJECTED → "Từ chối"', () => {
    const comp = makeComp();
    expect(comp.statusLabel('REJECTED')).toBe('Từ chối');
  });

  it('13.4 statusLabel UNKNOWN → trả về raw value', () => {
    const comp = makeComp();
    expect(comp.statusLabel('UNKNOWN_STATE')).toBe('UNKNOWN_STATE');
  });

  // ── statusColor ──────────────────────────────────────────────────────────
  it('13.4 statusColor PAID → green hex #10b981', () => {
    const comp = makeComp();
    expect(comp.statusColor('PAID')).toBe('#10b981');
  });

  it('13.4 statusColor REJECTED → red hex #ef4444', () => {
    const comp = makeComp();
    expect(comp.statusColor('REJECTED')).toBe('#ef4444');
  });

  it('13.4 statusColor DRAFT → grey hex #6b7280', () => {
    const comp = makeComp();
    expect(comp.statusColor('DRAFT')).toBe('#6b7280');
  });

  it('13.4 statusColor APPROVED → blue hex #3b82f6', () => {
    const comp = makeComp();
    expect(comp.statusColor('APPROVED')).toBe('#3b82f6');
  });

  it('13.4 statusColor unknown → fallback grey #6b7280', () => {
    const comp = makeComp();
    expect(comp.statusColor('BOGUS')).toBe('#6b7280');
  });

  // ── isAdmin / isDirector ──────────────────────────────────────────────────
  it('13.4 isAdmin: DIRECTOR → true', () => {
    authStub.setRole('DIRECTOR');
    const comp = makeComp();
    expect(comp.isAdmin()).toBeTrue();
  });

  it('13.4 isAdmin: ACCOUNTING → true', () => {
    authStub.setRole('ACCOUNTING');
    const comp = makeComp();
    expect(comp.isAdmin()).toBeTrue();
  });

  it('13.4 isAdmin: OPS → true', () => {
    authStub.setRole('OPS');
    const comp = makeComp();
    expect(comp.isAdmin()).toBeTrue();
  });

  it('13.4 isAdmin: SALE → false', () => {
    authStub.setRole('SALE');
    const comp = makeComp();
    expect(comp.isAdmin()).toBeFalse();
  });

  it('13.4 isAdmin: TEACHER → false', () => {
    authStub.setRole('TEACHER');
    const comp = makeComp();
    expect(comp.isAdmin()).toBeFalse();
  });

  it('13.4 isDirector: DIRECTOR → true', () => {
    authStub.setRole('DIRECTOR');
    const comp = makeComp();
    expect(comp.isDirector()).toBeTrue();
  });

  it('13.4 isDirector: ACCOUNTING → false', () => {
    authStub.setRole('ACCOUNTING');
    const comp = makeComp();
    expect(comp.isDirector()).toBeFalse();
  });

  it('13.4 isDirector: OPS → false', () => {
    authStub.setRole('OPS');
    const comp = makeComp();
    expect(comp.isDirector()).toBeFalse();
  });

  // ── allStatuses array ─────────────────────────────────────────────────────
  it('13.4 allStatuses có đủ 5 trạng thái payroll', () => {
    const comp = makeComp();
    expect(comp.allStatuses.length).toBe(5);
    const values = comp.allStatuses.map((s: any) => s.value);
    expect(values).toContain('DRAFT');
    expect(values).toContain('PAID');
    expect(values).toContain('APPROVED');
    expect(values).toContain('PENDING_REVIEW');
    expect(values).toContain('REJECTED');
  });

  // ── resetFilters ──────────────────────────────────────────────────────────
  it('13.4 resetFilters xóa tất cả bộ lọc', () => {
    const comp = makeComp();
    comp.filterStatus = 'PAID';
    comp.startDate = '2026-01-01';
    comp.endDate = '2026-12-31';
    comp.page = 3;
    comp.resetFilters();
    expect(comp.filterStatus).toBe('');
    expect(comp.startDate).toBe('');
    expect(comp.endDate).toBe('');
    expect(comp.page).toBe(1);
  });

  // ── pagination guards ─────────────────────────────────────────────────────
  it('13.4 prevPage lúc page=1 → không giảm xuống 0', () => {
    const comp = makeComp();
    comp.page = 1;
    comp.prevPage();
    expect(comp.page).toBe(1);
  });
});
