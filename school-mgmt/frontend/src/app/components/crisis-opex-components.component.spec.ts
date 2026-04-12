// crisis-opex-components.component.spec.ts
//
// Angular Jasmine/Karma unit tests — Batch 2 (scenarios 3.1 – 4.4)
//
// Phạm vi kiểm thử:
//   SupplierPaymentsComponent  —  statusLabel, totalPages, save() validation
//   TicketsComponent           —  statusLabel, priorityLabel, isOpsOrDirector,
//                                  isStaff, filteredTickets, getStatCount
//   StaffPayrollComponent      —  statusLabel, roleLabel, isAdmin, totalPages
//
// Run: ng test --include crisis-opex-components.component.spec.ts

import { TestBed, ComponentFixture } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { of } from 'rxjs';

import { SupplierPaymentsComponent } from './supplier-payments.component';
import { TicketsComponent } from './tickets.component';
import { StaffPayrollComponent } from './staff-payroll.component';

import { SupplierPaymentService } from '../services/supplier-payment.service';
import { TicketService } from '../services/ticket.service';
import { StaffPayrollService } from '../services/staff-payroll.service';
import { AuthService } from '../services/auth.service';
import { Role } from '../models/role.enum';

// ─── Auth stub helpers ────────────────────────────────────────────────────────

function makeAuthStub(role: string) {
  return {
    userSignal: () => ({ sub: 'u-001', role, fullName: `Test ${role}` }),
    isLoggedIn: () => true,
    hasRole: (roles: string[]) => roles.includes(role),
  };
}

// ─── SupplierPayment service stub ────────────────────────────────────────────

function makeSupplierPaymentServiceStub() {
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

// ─── TicketService stub ──────────────────────────────────────────────────────

function makeTicketServiceStub() {
  const emptyPage = { data: [], meta: { total: 0, page: 1, limit: 20, totalPages: 1 } };
  return {
    findAll: jasmine.createSpy('findAll').and.resolveTo(emptyPage),
    getMyTickets: jasmine.createSpy('getMyTickets').and.resolveTo(emptyPage),
    getAssignedToMe: jasmine.createSpy('getAssignedToMe').and.resolveTo(emptyPage),
    getStats: jasmine.createSpy('getStats').and.resolveTo({ byStatus: [], overdueCount: 0 }),
    findById: jasmine.createSpy('findById').and.resolveTo(null),
    create: jasmine.createSpy('create').and.resolveTo({}),
    addComment: jasmine.createSpy('addComment').and.resolveTo({}),
    getComments: jasmine.createSpy('getComments').and.resolveTo([]),
    updateStatus: jasmine.createSpy('updateStatus').and.resolveTo({}),
    resolve: jasmine.createSpy('resolve').and.resolveTo({}),
    close: jasmine.createSpy('close').and.resolveTo({}),
    cancel: jasmine.createSpy('cancel').and.resolveTo({}),
    reopen: jasmine.createSpy('reopen').and.resolveTo({}),
    updatePriority: jasmine.createSpy('updatePriority').and.resolveTo({}),
    assign: jasmine.createSpy('assign').and.resolveTo({}),
    updateAssignee: jasmine.createSpy('updateAssignee').and.resolveTo({}),
    unassign: jasmine.createSpy('unassign').and.resolveTo({}),
    waitInfo: jasmine.createSpy('waitInfo').and.resolveTo({}),
  };
}

// ─── StaffPayrollService stub ─────────────────────────────────────────────────

function makeStaffPayrollServiceStub() {
  const emptyPage = { data: [], total: 0 };
  return {
    list: jasmine.createSpy('list').and.resolveTo(emptyPage),
    getMy: jasmine.createSpy('getMy').and.resolveTo(emptyPage),
    getOne: jasmine.createSpy('getOne').and.resolveTo(null),
    create: jasmine.createSpy('create').and.resolveTo({}),
    bulkGenerate: jasmine.createSpy('bulkGenerate').and.resolveTo({ created: 0, skipped: 0, errors: [] }),
    update: jasmine.createSpy('update').and.resolveTo({}),
    submit: jasmine.createSpy('submit').and.resolveTo({}),
    approve: jasmine.createSpy('approve').and.resolveTo({}),
    reject: jasmine.createSpy('reject').and.resolveTo({}),
    reopen: jasmine.createSpy('reopen').and.resolveTo({}),
    markPaid: jasmine.createSpy('markPaid').and.resolveTo({}),
    delete: jasmine.createSpy('delete').and.resolveTo({}),
  };
}

// ════════════════════════════════════════════════════════════════════════════
// SUITE 1 – SupplierPaymentsComponent (scenarios 4.2)
// ════════════════════════════════════════════════════════════════════════════

describe('SupplierPaymentsComponent — Unit Tests (Scenario 4.2)', () => {
  let fixture: ComponentFixture<SupplierPaymentsComponent>;
  let component: SupplierPaymentsComponent;
  let svcStub: ReturnType<typeof makeSupplierPaymentServiceStub>;

  async function create(role = 'ACCOUNTING') {
    svcStub = makeSupplierPaymentServiceStub();
    await TestBed.configureTestingModule({
      imports: [SupplierPaymentsComponent, HttpClientTestingModule],
      providers: [
        { provide: SupplierPaymentService, useValue: svcStub },
        { provide: AuthService, useValue: makeAuthStub(role) },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(SupplierPaymentsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  }

  afterEach(() => TestBed.resetTestingModule());

  // ── Component creation ───────────────────────────────────────────────────
  describe('Khởi tạo', () => {
    beforeEach(async () => create());

    it('should create the component', () => {
      expect(component).toBeTruthy();
    });

    it('ngOnInit gọi list() và getStats() một lần', () => {
      expect(svcStub.list).toHaveBeenCalledTimes(1);
      expect(svcStub.getStats).toHaveBeenCalledTimes(1);
    });
  });

  // ── statusLabel() ────────────────────────────────────────────────────────
  describe('statusLabel() — Scenario 4.2: hiển thị trạng thái NCC', () => {
    beforeEach(async () => create());

    it('PENDING_APPROVAL → "Chờ duyệt"', () => {
      expect(component.statusLabel('PENDING_APPROVAL')).toBe('Chờ duyệt');
    });

    it('APPROVED → "Đã duyệt"', () => {
      expect(component.statusLabel('APPROVED')).toBe('Đã duyệt');
    });

    it('PAID → "Đã TT"', () => {
      expect(component.statusLabel('PAID')).toBe('Đã TT');
    });

    it('REJECTED → "Từ chối"', () => {
      expect(component.statusLabel('REJECTED')).toBe('Từ chối');
    });

    it('unknown status → trả về raw value (fallback)', () => {
      const raw = 'UNKNOWN_STATUS_XYZ';
      expect(component.statusLabel(raw)).toBe(raw);
    });
  });

  // ── totalPages computed ──────────────────────────────────────────────────
  describe('totalPages computed signal — phân trang NCC', () => {
    beforeEach(async () => create());

    it('0 bản ghi → totalPages = 0 (ceil(0/20))', () => {
      component.total.set(0);
      expect(component.totalPages()).toBe(0);
    });

    it('1 bản ghi → totalPages = 1', () => {
      component.total.set(1);
      expect(component.totalPages()).toBe(1);
    });

    it('20 bản ghi → totalPages = 1', () => {
      component.total.set(20);
      expect(component.totalPages()).toBe(1);
    });

    it('21 bản ghi → totalPages = 2', () => {
      component.total.set(21);
      expect(component.totalPages()).toBe(2);
    });

    it('100 bản ghi → totalPages = 5', () => {
      component.total.set(100);
      expect(component.totalPages()).toBe(5);
    });

    it('limit = 20 (cố định trong component)', () => {
      expect(component.limit).toBe(20);
    });
  });

  // ── save() validation ────────────────────────────────────────────────────
  describe('save() — validate required fields (Scenario 4.2 edge)', () => {
    beforeEach(async () => create());

    it('form trống → error set, không gọi create()', async () => {
      component.form = { title: '', supplierName: '', amount: 0, paymentDate: '' } as any;
      await component.save();
      expect(component.error()).toBeTruthy();
      expect(svcStub.create).not.toHaveBeenCalled();
    });

    it('form đủ trường → gọi create() một lần', async () => {
      component.editing.set(false);
      component.form = {
        title: 'Mua bàn ghế', supplierName: 'Công ty ABC',
        amount: 5_000_000, paymentDate: '2026-06-01',
        supplierPhone: '', supplierEmail: '', supplierBankAccount: '',
        supplierBankName: '', notes: '',
      };
      await component.save();
      expect(svcStub.create).toHaveBeenCalledTimes(1);
    });

    it('edit mode đủ trường → gọi update() một lần', async () => {
      component.editing.set(true);
      component.editingId = 'SP-001';
      component.form = {
        title: 'Sửa tiêu đề', supplierName: 'Công ty XYZ',
        amount: 2_000_000, paymentDate: '2026-07-01',
        supplierPhone: '', supplierEmail: '', supplierBankAccount: '',
        supplierBankName: '', notes: '',
      };
      await component.save();
      expect(svcStub.update).toHaveBeenCalledWith('SP-001', component.form);
    });
  });

  // ── goPage() ─────────────────────────────────────────────────────────────
  describe('goPage() — cập nhật trang và gọi lại list()', () => {
    beforeEach(async () => create());

    it('goPage(2) → currentPage = 2 và list được gọi lần 2', () => {
      component.goPage(2);
      expect(component.currentPage()).toBe(2);
      expect(svcStub.list.calls.count()).toBeGreaterThanOrEqual(2);
    });
  });
});

// ════════════════════════════════════════════════════════════════════════════
// SUITE 2 – TicketsComponent (scenarios 3.1 / 3.2)
// ════════════════════════════════════════════════════════════════════════════

describe('TicketsComponent — Unit Tests (Scenarios 3.1 – 3.2)', () => {
  let fixture: ComponentFixture<TicketsComponent>;
  let component: TicketsComponent;
  let ticketStub: ReturnType<typeof makeTicketServiceStub>;

  async function create(role = Role.OPS) {
    ticketStub = makeTicketServiceStub();
    const authStub = makeAuthStub(role);

    await TestBed.configureTestingModule({
      imports: [TicketsComponent, HttpClientTestingModule],
      providers: [
        { provide: TicketService, useValue: ticketStub },
        { provide: AuthService, useValue: authStub },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { queryParamMap: { get: (_: string) => null } },
            queryParams: of({}),
          },
        },
        { provide: Router, useValue: { navigate: jasmine.createSpy('navigate') } },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(TicketsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  }

  afterEach(() => TestBed.resetTestingModule());

  // ── Component creation ───────────────────────────────────────────────────
  describe('Khởi tạo', () => {
    beforeEach(async () => create(Role.OPS));

    it('should create the component', () => {
      expect(component).toBeTruthy();
    });
  });

  // ── statusLabel() ────────────────────────────────────────────────────────
  describe('statusLabel() — Scenario 3.1: trạng thái ticket', () => {
    beforeEach(async () => create(Role.OPS));

    it('OPEN → "Mới tạo"', () => {
      expect(component.statusLabel('OPEN')).toBe('Mới tạo');
    });

    it('IN_PROGRESS → "Đang xử lý"', () => {
      expect(component.statusLabel('IN_PROGRESS')).toBe('Đang xử lý');
    });

    it('WAITING_INFO → "Chờ thông tin"', () => {
      expect(component.statusLabel('WAITING_INFO')).toBe('Chờ thông tin');
    });

    it('WAITING_REFUND → "Chờ hoàn tiền"', () => {
      expect(component.statusLabel('WAITING_REFUND')).toBe('Chờ hoàn tiền');
    });

    it('RESOLVED → "Đã giải quyết"', () => {
      expect(component.statusLabel('RESOLVED')).toBe('Đã giải quyết');
    });

    it('CLOSED → "Đã đóng"', () => {
      expect(component.statusLabel('CLOSED')).toBe('Đã đóng');
    });

    it('CANCELLED → "Đã hủy"', () => {
      expect(component.statusLabel('CANCELLED')).toBe('Đã hủy');
    });
  });

  // ── priorityLabel() ──────────────────────────────────────────────────────
  describe('priorityLabel() — Scenario 3.2: mức ưu tiên ticket', () => {
    beforeEach(async () => create(Role.OPS));

    it('LOW → "Thấp"', () => {
      expect(component.priorityLabel('LOW')).toBe('Thấp');
    });

    it('MEDIUM → "Trung bình"', () => {
      expect(component.priorityLabel('MEDIUM')).toBe('Trung bình');
    });

    it('HIGH → "Cao"', () => {
      expect(component.priorityLabel('HIGH')).toBe('Cao');
    });

    it('URGENT → "Khẩn cấp"', () => {
      expect(component.priorityLabel('URGENT')).toBe('Khẩn cấp');
    });
  });

  // ── Role helpers ─────────────────────────────────────────────────────────
  describe('Role helpers — RBAC visibility (Scenario 3.3)', () => {
    it('OPS role: isOpsOrDirector() = true, isStaff() = true', async () => {
      await create(Role.OPS);
      expect(component.isOpsOrDirector()).toBe(true);
      expect(component.isStaff()).toBe(true);
      expect(component.isOps()).toBe(true);
      expect(component.isParent()).toBe(false);
    });

    it('DIRECTOR role: isOpsOrDirector() = true', async () => {
      await create(Role.DIRECTOR);
      expect(component.isOpsOrDirector()).toBe(true);
    });

    it('ACCOUNTING role: isOpsOrDirector() = false, isStaff() = true', async () => {
      await create(Role.ACCOUNTING);
      expect(component.isOpsOrDirector()).toBe(false);
      expect(component.isStaff()).toBe(true);
    });

    it('PARENT role: isOpsOrDirector() = false, isStaff() = false', async () => {
      await create(Role.PARENT);
      expect(component.isOpsOrDirector()).toBe(false);
      expect(component.isStaff()).toBe(false);
      expect(component.isParent()).toBe(true);
    });

    it('TEACHER role: isOpsOrDirector() = false', async () => {
      await create(Role.TEACHER);
      expect(component.isOpsOrDirector()).toBe(false);
    });
  });

  // ── filteredTickets computed ─────────────────────────────────────────────
  describe('filteredTickets() — tìm kiếm local (Scenario 3.1 edge)', () => {
    beforeEach(async () => create(Role.OPS));

    it('không có keyword → trả về toàn bộ tickets', () => {
      const items = [
        { ticketCode: 'TK-001', subject: 'Khiếu nại giáo viên', createdBy: { fullName: 'Nguyen A' } },
        { ticketCode: 'TK-002', subject: 'Vấn đề thanh toán', createdBy: { fullName: 'Tran B' } },
      ] as any[];
      component.tickets.set(items);
      component.searchKeyword.set('');
      expect(component.filteredTickets()).toEqual(items);
    });

    it('keyword khớp ticketCode → chỉ trả về ticket tương ứng', () => {
      const items = [
        { ticketCode: 'TK-001', subject: 'Khiếu nại giáo viên', createdBy: { fullName: 'Nguyen A' } },
        { ticketCode: 'TK-002', subject: 'Vấn đề thanh toán', createdBy: { fullName: 'Tran B' } },
      ] as any[];
      component.tickets.set(items);
      component.searchKeyword.set('TK-001');
      expect(component.filteredTickets().length).toBe(1);
      expect(component.filteredTickets()[0].ticketCode).toBe('TK-001');
    });

    it('keyword khớp subject → lọc đúng', () => {
      const items = [
        { ticketCode: 'TK-003', subject: 'Phạt không hợp lệ', createdBy: { fullName: 'Le C' } },
        { ticketCode: 'TK-004', subject: 'Lịch học thay đổi', createdBy: { fullName: 'Pham D' } },
      ] as any[];
      component.tickets.set(items);
      component.searchKeyword.set('phạt');
      expect(component.filteredTickets().length).toBe(1);
      expect(component.filteredTickets()[0].ticketCode).toBe('TK-003');
    });

    it('keyword khớp tên người tạo → lọc đúng', () => {
      const items = [
        { ticketCode: 'TK-005', subject: 'Bất kỳ', createdBy: { fullName: 'Nguyen Van A' } },
        { ticketCode: 'TK-006', subject: 'Bất kỳ 2', createdBy: { fullName: 'Tran Thi B' } },
      ] as any[];
      component.tickets.set(items);
      component.searchKeyword.set('nguyen van');
      expect(component.filteredTickets().length).toBe(1);
    });

    it('keyword không khớp → trả về mảng rỗng', () => {
      const items = [
        { ticketCode: 'TK-007', subject: 'Test', createdBy: { fullName: 'User X' } },
      ] as any[];
      component.tickets.set(items);
      component.searchKeyword.set('ZZZNOMATCH');
      expect(component.filteredTickets().length).toBe(0);
    });
  });

  // ── getStatCount() ───────────────────────────────────────────────────────
  describe('getStatCount() — đếm ticket theo trạng thái (Scenario 3.1 stats)', () => {
    beforeEach(async () => create(Role.OPS));

    it('serverStats = null → count = 0', () => {
      component.serverStats.set(null);
      expect(component.getStatCount('OPEN')).toBe(0);
    });

    it('có byStatus data → trả về đúng count', () => {
      component.serverStats.set({
        byStatus: [
          { _id: 'OPEN', count: 5 },
          { _id: 'IN_PROGRESS', count: 3 },
          { _id: 'RESOLVED', count: 10 },
        ],
        overdueCount: 2,
      } as any);
      expect(component.getStatCount('OPEN')).toBe(5);
      expect(component.getStatCount('IN_PROGRESS')).toBe(3);
      expect(component.getStatCount('RESOLVED')).toBe(10);
    });

    it('trạng thái không có trong byStatus → count = 0', () => {
      component.serverStats.set({
        byStatus: [{ _id: 'OPEN', count: 2 }],
        overdueCount: 0,
      } as any);
      expect(component.getStatCount('WAITING_REFUND')).toBe(0);
    });
  });

  // ── canComment() ─────────────────────────────────────────────────────────
  describe('canComment() — control comment input visibility', () => {
    beforeEach(async () => create(Role.OPS));

    it('selectedTicket = null → canComment = false', () => {
      component.selectedTicket.set(null);
      expect(component.canComment()).toBe(false);
    });

    it('ticket OPEN → canComment = true', () => {
      component.selectedTicket.set({ status: 'OPEN' } as any);
      expect(component.canComment()).toBe(true);
    });

    it('ticket CLOSED → canComment = false', () => {
      component.selectedTicket.set({ status: 'CLOSED' } as any);
      expect(component.canComment()).toBe(false);
    });

    it('ticket CANCELLED → canComment = false', () => {
      component.selectedTicket.set({ status: 'CANCELLED' } as any);
      expect(component.canComment()).toBe(false);
    });
  });

  // ── typeLabel() ──────────────────────────────────────────────────────────
  describe('typeLabel() — loại ticket', () => {
    beforeEach(async () => create(Role.OPS));

    it('TEACHER_COMPLAINT → "Khiếu nại giáo viên"', () => {
      expect(component.typeLabel('TEACHER_COMPLAINT')).toBe('Khiếu nại giáo viên');
    });

    it('REFUND_REQUEST → "Yêu cầu hoàn tiền"', () => {
      expect(component.typeLabel('REFUND_REQUEST')).toBe('Yêu cầu hoàn tiền');
    });
  });
});

// ════════════════════════════════════════════════════════════════════════════
// SUITE 3 – StaffPayrollComponent (scenarios 4.3)
// ════════════════════════════════════════════════════════════════════════════

describe('StaffPayrollComponent — Unit Tests (Scenario 4.3)', () => {
  let fixture: ComponentFixture<StaffPayrollComponent>;
  let component: StaffPayrollComponent;
  let payrollStub: ReturnType<typeof makeStaffPayrollServiceStub>;

  async function create(role = 'ACCOUNTING') {
    payrollStub = makeStaffPayrollServiceStub();
    await TestBed.configureTestingModule({
      imports: [StaffPayrollComponent, HttpClientTestingModule],
      providers: [
        { provide: StaffPayrollService, useValue: payrollStub },
        { provide: AuthService, useValue: makeAuthStub(role) },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(StaffPayrollComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  }

  afterEach(() => TestBed.resetTestingModule());

  // ── Component creation ───────────────────────────────────────────────────
  describe('Khởi tạo', () => {
    beforeEach(async () => create('ACCOUNTING'));

    it('should create the component', () => {
      expect(component).toBeTruthy();
    });

    it('isAdmin = true → gọi list() khi khởi tạo', () => {
      expect(payrollStub.list).toHaveBeenCalledTimes(1);
    });
  });

  // ── statusLabel() ────────────────────────────────────────────────────────
  describe('statusLabel() — Scenario 4.3: trạng thái bảng lương', () => {
    beforeEach(async () => create('ACCOUNTING'));

    it('DRAFT → "Nháp"', () => {
      expect(component.statusLabel('DRAFT')).toBe('Nháp');
    });

    it('PENDING_REVIEW → "Chờ duyệt"', () => {
      expect(component.statusLabel('PENDING_REVIEW')).toBe('Chờ duyệt');
    });

    it('APPROVED → "Đã duyệt"', () => {
      expect(component.statusLabel('APPROVED')).toBe('Đã duyệt');
    });

    it('PAID → "Đã thanh toán"', () => {
      expect(component.statusLabel('PAID')).toBe('Đã thanh toán');
    });

    it('REJECTED → "Từ chối"', () => {
      expect(component.statusLabel('REJECTED')).toBe('Từ chối');
    });

    it('unknown → trả về raw value', () => {
      expect(component.statusLabel('UNKNOWN')).toBe('UNKNOWN');
    });
  });

  // ── roleLabel() ──────────────────────────────────────────────────────────
  describe('roleLabel() — hiển thị vai trò nhân viên', () => {
    beforeEach(async () => create('ACCOUNTING'));

    it('DIRECTOR → "Giám đốc"', () => {
      expect(component.roleLabel('DIRECTOR')).toBe('Giám đốc');
    });

    it('ACCOUNTING → "Kế toán"', () => {
      expect(component.roleLabel('ACCOUNTING')).toBe('Kế toán');
    });

    it('OPS → "Vận hành"', () => {
      expect(component.roleLabel('OPS')).toBe('Vận hành');
    });

    it('ADSMANAGER → "Ads manager"', () => {
      expect(component.roleLabel('ADSMANAGER')).toBe('Ads manager');
    });

    it('TEACHER → "Giáo viên"', () => {
      expect(component.roleLabel('TEACHER')).toBe('Giáo viên');
    });

    it('SALES → "Kinh doanh"', () => {
      expect(component.roleLabel('SALES')).toBe('Kinh doanh');
    });

    it('unknown role → trả về raw value', () => {
      expect(component.roleLabel('UNKNOWN_ROLE')).toBe('UNKNOWN_ROLE');
    });
  });

  // ── isAdmin() ────────────────────────────────────────────────────────────
  describe('isAdmin() — role-based access (Scenario 4.3 RBAC)', () => {
    it('DIRECTOR → isAdmin = true', async () => {
      await create('DIRECTOR');
      expect(component.isAdmin()).toBe(true);
    });

    it('ACCOUNTING → isAdmin = true', async () => {
      await create('ACCOUNTING');
      expect(component.isAdmin()).toBe(true);
    });

    it('OPS → isAdmin = true', async () => {
      await create('OPS');
      expect(component.isAdmin()).toBe(true);
    });

    it('TEACHER → isAdmin = false, gọi getMy() thay vì list()', async () => {
      await create('TEACHER');
      expect(component.isAdmin()).toBe(false);
      expect(payrollStub.getMy).toHaveBeenCalled();
      expect(payrollStub.list).not.toHaveBeenCalled();
    });

    it('SALES → isAdmin = false', async () => {
      await create('SALES');
      expect(component.isAdmin()).toBe(false);
    });
  });

  // ── isDirector() ─────────────────────────────────────────────────────────
  describe('isDirector() — chỉ director mới duyệt', () => {
    it('DIRECTOR → isDirector = true', async () => {
      await create('DIRECTOR');
      expect(component.isDirector()).toBe(true);
    });

    it('ACCOUNTING → isDirector = false', async () => {
      await create('ACCOUNTING');
      expect(component.isDirector()).toBe(false);
    });

    it('OPS → isDirector = false', async () => {
      await create('OPS');
      expect(component.isDirector()).toBe(false);
    });
  });

  // ── totalPages computed ──────────────────────────────────────────────────
  describe('totalPages computed signal — phân trang bảng lương', () => {
    beforeEach(async () => create('ACCOUNTING'));

    it('0 bản ghi → totalPages = 1 (Math.max(1, …))', () => {
      component.total.set(0);
      expect(component.totalPages()).toBe(1);
    });

    it('1 bản ghi → totalPages = 1', () => {
      component.total.set(1);
      expect(component.totalPages()).toBe(1);
    });

    it('20 bản ghi → totalPages = 1', () => {
      component.total.set(20);
      expect(component.totalPages()).toBe(1);
    });

    it('21 bản ghi → totalPages = 2', () => {
      component.total.set(21);
      expect(component.totalPages()).toBe(2);
    });

    it('75 bản ghi (limit=20) → totalPages = 4', () => {
      component.total.set(75);
      expect(component.totalPages()).toBe(4);
    });
  });

  // ── resetFilters() ───────────────────────────────────────────────────────
  describe('resetFilters() — xóa bộ lọc và tải lại', () => {
    beforeEach(async () => create('ACCOUNTING'));

    it('reset → filterStatus rỗng, page = 1', () => {
      component.filterStatus = 'PAID';
      component.page = 3;
      component.resetFilters();
      expect(component.filterStatus).toBe('');
      expect(component.page).toBe(1);
    });

    it('sau reset → list() được gọi thêm một lần', () => {
      const countBefore = (payrollStub.list as jasmine.Spy).calls.count();
      component.resetFilters();
      expect((payrollStub.list as jasmine.Spy).calls.count()).toBeGreaterThan(countBefore);
    });
  });

  // ── prevPage() / nextPage() ──────────────────────────────────────────────
  describe('prevPage() / nextPage() — điều hướng trang', () => {
    beforeEach(async () => create('ACCOUNTING'));

    it('prevPage() khi page=1 → không giảm page', () => {
      component.page = 1;
      component.prevPage();
      expect(component.page).toBe(1);
    });

    it('prevPage() khi page=3 → page = 2', () => {
      component.page = 3;
      component.total.set(100);
      component.prevPage();
      expect(component.page).toBe(2);
    });

    it('nextPage() khi ở trang cuối → không tăng page', () => {
      component.total.set(10);
      component.page = 1;
      component.nextPage();
      expect(component.page).toBe(1);
    });

    it('nextPage() khi còn trang → tăng page', () => {
      component.total.set(50);
      component.page = 1;
      component.nextPage();
      expect(component.page).toBe(2);
    });
  });
});
