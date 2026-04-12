// Angular unit tests - Batch 7 (scenarios 15.3, 16.1-16.4, 17.1-17.3)
// Covers pure-method testing for:
//   AgentsComponent - canManage, isDirector, statusLabel (16.1, 16.2)
//   SupplierQuotesComponent - statusLabel DRAFT/SENT/ACCEPTED/REJECTED/EXPIRED (16.3)
//   SessionsComponent - canCreate, isDirector, formatCurrency, statusLabel,
//                        formatChangeRequestStatus (17.2, 17.3)
//   StaffPayrollComponent - isAdmin, isDirector, statusLabel bulk-generate context (15.3)

import { NO_ERRORS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { AgentsComponent } from './agents.component';
import { SupplierQuotesComponent } from './supplier-quotes.component';
import { SessionsComponent } from './sessions.component';
import { StaffPayrollComponent } from './staff-payroll.component';
import { AgentService } from '../services/agent.service';
import { SupplierQuoteService } from '../services/supplier-quote.service';
import { SessionService } from '../services/session.service';
import { ClassService } from '../services/class.service';
import { UserService } from '../services/user.service';
import { StaffPayrollService } from '../services/staff-payroll.service';
import { AuthService } from '../services/auth.service';
import { HttpClient } from '@angular/common/http';

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

function makeAgentServiceStub() {
  return {
    list: jasmine.createSpy('list').and.resolveTo({ data: [], total: 0 }),
    create: jasmine.createSpy('create').and.resolveTo({}),
    update: jasmine.createSpy('update').and.resolveTo({}),
    delete: jasmine.createSpy('delete').and.resolveTo(undefined),
    suspend: jasmine.createSpy('suspend').and.resolveTo({}),
    activate: jasmine.createSpy('activate').and.resolveTo({}),
  };
}

function makeSupplierQuoteServiceStub() {
  return {
    list: jasmine.createSpy('list').and.resolveTo({ data: [], total: 0 }),
    create: jasmine.createSpy('create').and.resolveTo({}),
    update: jasmine.createSpy('update').and.resolveTo({}),
  };
}

function makeSessionServiceStub() {
  return {
    list: jasmine.createSpy('list').and.resolveTo({ data: [], total: 0 }),
    getOne: jasmine.createSpy('getOne').and.resolveTo({}),
    create: jasmine.createSpy('create').and.resolveTo({}),
    update: jasmine.createSpy('update').and.resolveTo({}),
    remove: jasmine.createSpy('remove').and.resolveTo(true),
    getStats: jasmine.createSpy('getStats').and.resolveTo({}),
    teacherComplete: jasmine.createSpy('teacherComplete').and.resolveTo({}),
    parentConfirm: jasmine.createSpy('parentConfirm').and.resolveTo({}),
    finalize: jasmine.createSpy('finalize').and.resolveTo({}),
    cancel: jasmine.createSpy('cancel').and.resolveTo({}),
    bulkCreate: jasmine.createSpy('bulkCreate').and.resolveTo({ sessions: [] }),
  };
}

function makeClassServiceStub() {
  return { list: jasmine.createSpy('list').and.resolveTo({ data: [] }) };
}

function makeUserServiceStub() {
  return { list: jasmine.createSpy('list').and.resolveTo({ data: [] }) };
}

function makePayrollServiceStub() {
  return {
    list: jasmine.createSpy('list').and.resolveTo({ data: [], total: 0 }),
    getMy: jasmine.createSpy('getMy').and.resolveTo({ data: [], total: 0 }),
    getOne: jasmine.createSpy('getOne').and.resolveTo({}),
    generate: jasmine.createSpy('generate').and.resolveTo({}),
    bulkGenerate: jasmine.createSpy('bulkGenerate').and.resolveTo({ success: 0, failed: 0, errors: [] }),
    submit: jasmine.createSpy('submit').and.resolveTo({}),
    approve: jasmine.createSpy('approve').and.resolveTo({}),
    reject: jasmine.createSpy('reject').and.resolveTo({}),
    reopen: jasmine.createSpy('reopen').and.resolveTo({}),
    markPaid: jasmine.createSpy('markPaid').and.resolveTo({}),
    remove: jasmine.createSpy('remove').and.resolveTo({}),
  };
}

describe('AgentsComponent - RBAC & Status Labels (16.1, 16.2)', () => {
  let comp: AgentsComponent;
  let authStub: ReturnType<typeof makeMutableAuthStub>;

  beforeEach(async () => {
    authStub = makeMutableAuthStub();

    await TestBed.configureTestingModule({
      imports: [AgentsComponent, HttpClientTestingModule],
      providers: [
        { provide: AgentService, useValue: makeAgentServiceStub() },
        { provide: AuthService, useValue: authStub },
        { provide: HttpClient, useValue: {} },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    const fixture = TestBed.createComponent(AgentsComponent);
    comp = fixture.componentInstance;
  });

  describe('statusLabel()', () => {
    it('returns "Hoạt động" for ACTIVE', () => {
      expect(comp.statusLabel('ACTIVE')).toBe('Hoạt động');
    });

    it('returns "Tạm ngừng" for SUSPENDED', () => {
      expect(comp.statusLabel('SUSPENDED')).toBe('Tạm ngừng');
    });

    it('returns "Ngừng HĐ" for INACTIVE', () => {
      expect(comp.statusLabel('INACTIVE')).toBe('Ngừng HĐ');
    });

    it('returns raw value for unknown status', () => {
      expect(comp.statusLabel('UNKNOWN_STATUS')).toBe('UNKNOWN_STATUS');
    });
  });

  describe('canManage()', () => {
    it('returns true for DIRECTOR', () => {
      authStub.setRole('DIRECTOR');
      expect(comp.canManage()).toBe(true);
    });

    it('returns true for OPS', () => {
      authStub.setRole('OPS');
      expect(comp.canManage()).toBe(true);
    });

    it('returns false for SALE', () => {
      authStub.setRole('SALE');
      expect(comp.canManage()).toBe(false);
    });

    it('returns false for ACCOUNTING', () => {
      authStub.setRole('ACCOUNTING');
      expect(comp.canManage()).toBe(false);
    });

    it('returns false for TEACHER', () => {
      authStub.setRole('TEACHER');
      expect(comp.canManage()).toBe(false);
    });
  });

  describe('isDirector()', () => {
    it('returns true for DIRECTOR', () => {
      authStub.setRole('DIRECTOR');
      expect(comp.isDirector()).toBe(true);
    });

    it('returns false for OPS', () => {
      authStub.setRole('OPS');
      expect(comp.isDirector()).toBe(false);
    });

    it('returns false for SALE', () => {
      authStub.setRole('SALE');
      expect(comp.isDirector()).toBe(false);
    });
  });
});

describe('SupplierQuotesComponent - Status Labels (16.3)', () => {
  let comp: SupplierQuotesComponent;

  beforeEach(async () => {
    const authStub = makeMutableAuthStub();

    await TestBed.configureTestingModule({
      imports: [SupplierQuotesComponent, HttpClientTestingModule],
      providers: [
        { provide: SupplierQuoteService, useValue: makeSupplierQuoteServiceStub() },
        { provide: AuthService, useValue: authStub },
        { provide: HttpClient, useValue: {} },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    const fixture = TestBed.createComponent(SupplierQuotesComponent);
    comp = fixture.componentInstance;
  });

  it('statusLabel returns "Nháp" for DRAFT', () => {
    expect(comp.statusLabel('DRAFT')).toBe('Nháp');
  });

  it('statusLabel returns "Đã gửi" for SENT', () => {
    expect(comp.statusLabel('SENT')).toBe('Đã gửi');
  });

  it('statusLabel returns "Đã duyệt" for ACCEPTED', () => {
    expect(comp.statusLabel('ACCEPTED')).toBe('Đã duyệt');
  });

  it('statusLabel returns "Từ chối" for REJECTED', () => {
    expect(comp.statusLabel('REJECTED')).toBe('Từ chối');
  });

  it('statusLabel returns "Hết hạn" for EXPIRED', () => {
    expect(comp.statusLabel('EXPIRED')).toBe('Hết hạn');
  });

  it('statusLabel returns raw value for unknown status', () => {
    expect(comp.statusLabel('PENDING_REVIEW')).toBe('PENDING_REVIEW');
  });

  it('DRAFT -> SENT -> ACCEPTED reflects correct labels in sequence', () => {
    const statuses = ['DRAFT', 'SENT', 'ACCEPTED'];
    const labels = statuses.map((s) => comp.statusLabel(s));
    expect(labels).toEqual(['Nháp', 'Đã gửi', 'Đã duyệt']);
  });

  it('save() sets validation error when required fields are missing', () => {
    comp.form = { title: '', supplierName: '', quoteDate: '', items: [] };
    comp.save();
    TestBed.flushEffects();
    expect(comp.error()).toBe('Vui lòng điền đầy đủ thông tin bắt buộc');
  });
});

describe('SessionsComponent - Pure Methods (17.2, 17.3)', () => {
  let comp: SessionsComponent;
  let authStub: ReturnType<typeof makeMutableAuthStub>;

  beforeEach(async () => {
    authStub = makeMutableAuthStub();

    await TestBed.configureTestingModule({
      imports: [SessionsComponent, HttpClientTestingModule],
      providers: [
        { provide: SessionService, useValue: makeSessionServiceStub() },
        { provide: ClassService, useValue: makeClassServiceStub() },
        { provide: UserService, useValue: makeUserServiceStub() },
        { provide: AuthService, useValue: authStub },
        { provide: HttpClient, useValue: {} },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    const fixture = TestBed.createComponent(SessionsComponent);
    comp = fixture.componentInstance;
  });

  describe('formatCurrency()', () => {
    it('formats 300000 as Vietnamese locale currency', () => {
      const result = comp.formatCurrency(300000);
      expect(result).toContain('₫');
      expect(result).toMatch(/300/);
    });

    it('formats 0 without throwing', () => {
      const result = comp.formatCurrency(0);
      expect(result).toContain('₫');
    });

    it('handles undefined/null as 0', () => {
      const result = comp.formatCurrency(null as any);
      expect(result).toContain('₫');
    });
  });

  describe('statusLabel()', () => {
    it('maps SCHEDULED -> "Đã lên lịch"', () => {
      expect(comp.statusLabel('SCHEDULED')).toBe('Đã lên lịch');
    });

    it('maps TEACHER_COMPLETED -> "GV hoàn thành"', () => {
      expect(comp.statusLabel('TEACHER_COMPLETED')).toBe('GV hoàn thành');
    });

    it('maps PARENT_CONFIRMED -> "PH xác nhận"', () => {
      expect(comp.statusLabel('PARENT_CONFIRMED')).toBe('PH xác nhận');
    });

    it('maps FINALIZED -> "Đã chốt"', () => {
      expect(comp.statusLabel('FINALIZED')).toBe('Đã chốt');
    });

    it('maps CANCELLED -> "Đã hủy"', () => {
      expect(comp.statusLabel('CANCELLED')).toBe('Đã hủy');
    });

    it('maps NO_SHOW -> "Vắng"', () => {
      expect(comp.statusLabel('NO_SHOW')).toBe('Vắng');
    });
  });

  describe('canCreate() - RBAC guard (17.3)', () => {
    it('returns true for DIRECTOR', () => {
      authStub.setRole('DIRECTOR');
      expect(comp.canCreate()).toBe(true);
    });

    it('returns true for OPS', () => {
      authStub.setRole('OPS');
      expect(comp.canCreate()).toBe(true);
    });

    it('returns false for SALE (restricted from PATCH sessions)', () => {
      authStub.setRole('SALE');
      expect(comp.canCreate()).toBe(false);
    });

    it('returns false for TEACHER', () => {
      authStub.setRole('TEACHER');
      expect(comp.canCreate()).toBe(false);
    });

    it('returns false for PARENT', () => {
      authStub.setRole('PARENT');
      expect(comp.canCreate()).toBe(false);
    });
  });

  describe('isDirector()', () => {
    it('returns true for DIRECTOR', () => {
      authStub.setRole('DIRECTOR');
      expect(comp.isDirector()).toBe(true);
    });

    it('returns false for OPS', () => {
      authStub.setRole('OPS');
      expect(comp.isDirector()).toBe(false);
    });
  });
});

describe('StaffPayrollComponent - Bulk Payroll Context (15.3)', () => {
  let comp: StaffPayrollComponent;
  let authStub: ReturnType<typeof makeMutableAuthStub>;

  beforeEach(async () => {
    authStub = makeMutableAuthStub();

    await TestBed.configureTestingModule({
      imports: [StaffPayrollComponent, HttpClientTestingModule],
      providers: [
        { provide: StaffPayrollService, useValue: makePayrollServiceStub() },
        { provide: AuthService, useValue: authStub },
        { provide: HttpClient, useValue: {} },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    const fixture = TestBed.createComponent(StaffPayrollComponent);
    comp = fixture.componentInstance;
  });

  describe('isAdmin() - RBAC for bulk-generate', () => {
    it('returns true for DIRECTOR (authorized for bulk-generate)', () => {
      authStub.setRole('DIRECTOR');
      expect(comp.isAdmin()).toBe(true);
    });

    it('returns true for ACCOUNTING (authorized for bulk-generate)', () => {
      authStub.setRole('ACCOUNTING');
      expect(comp.isAdmin()).toBe(true);
    });

    it('returns true for OPS (isAdmin includes OPS)', () => {
      authStub.setRole('OPS');
      expect(comp.isAdmin()).toBe(true);
    });

    it('returns false for TEACHER', () => {
      authStub.setRole('TEACHER');
      expect(comp.isAdmin()).toBe(false);
    });

    it('returns false for PARENT', () => {
      authStub.setRole('PARENT');
      expect(comp.isAdmin()).toBe(false);
    });
  });

  describe('isDirector() - RBAC approval gate', () => {
    it('returns true for DIRECTOR', () => {
      authStub.setRole('DIRECTOR');
      expect(comp.isDirector()).toBe(true);
    });

    it('returns false for ACCOUNTING', () => {
      authStub.setRole('ACCOUNTING');
      expect(comp.isDirector()).toBe(false);
    });
  });

  describe('statusLabel() - payroll workflow states', () => {
    it('maps DRAFT -> "Nháp"', () => {
      expect(comp.statusLabel('DRAFT')).toBe('Nháp');
    });

    it('maps PENDING_REVIEW -> "Chờ duyệt"', () => {
      expect(comp.statusLabel('PENDING_REVIEW')).toBe('Chờ duyệt');
    });

    it('maps APPROVED -> "Đã duyệt"', () => {
      expect(comp.statusLabel('APPROVED')).toBe('Đã duyệt');
    });

    it('maps PAID -> "Đã thanh toán"', () => {
      expect(comp.statusLabel('PAID')).toBe('Đã thanh toán');
    });

    it('maps REJECTED -> "Từ chối"', () => {
      expect(comp.statusLabel('REJECTED')).toBe('Từ chối');
    });
  });
});
