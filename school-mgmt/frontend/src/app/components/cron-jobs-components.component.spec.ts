// cron-jobs-components.component.spec.ts
//
// Angular Jasmine/Karma unit tests — Batch 12 (scenarios 30.1–30.10)
//
// Phạm vi kiểm thử:
//   TicketsComponent   — filteredTickets, getStatCount, role guards (isStaff, isOpsOrDirector,
//                        isParent, isCreator, canComment), default activeTab by role
//   SessionsComponent  — statusLabel (all 6 statuses), changeRequestStatusLabel,
//                        canCreate, canRequestChange, isTeacher, isParent, isDirector
//
// Run: ng test --include cron-jobs-components.component.spec.ts

import { TestBed, ComponentFixture } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { of } from 'rxjs';

import { TicketsComponent } from './tickets.component';
import { SessionsComponent } from './sessions.component';

import { TicketService } from '../services/ticket.service';
import { SessionService } from '../services/session.service';
import { ClassService } from '../services/class.service';
import { UserService } from '../services/user.service';
import { AuthService } from '../services/auth.service';
import { Role } from '../models/role.enum';

// ─── Auth stub ────────────────────────────────────────────────────────────────

function makeAuthStub(role: string) {
  return {
    userSignal: () => ({ sub: 'user-001', role, fullName: `Test ${role}` }),
    isLoggedIn: () => true,
    hasRole: (roles: string[]) => roles.includes(role),
  };
}

// ─── TicketService stub ───────────────────────────────────────────────────────

function makeTicketStub() {
  const emptyPage = { data: [], meta: { total: 0, page: 1, limit: 20, totalPages: 1 } };
  return {
    findAll:        jasmine.createSpy('findAll').and.resolveTo(emptyPage),
    getMyTickets:   jasmine.createSpy('getMyTickets').and.resolveTo(emptyPage),
    getAssignedToMe: jasmine.createSpy('getAssignedToMe').and.resolveTo(emptyPage),
    getStats:       jasmine.createSpy('getStats').and.resolveTo({ byStatus: [], overdueCount: 0 }),
    findById:       jasmine.createSpy('findById').and.resolveTo(null),
    create:         jasmine.createSpy('create').and.resolveTo({}),
    addComment:     jasmine.createSpy('addComment').and.resolveTo({}),
    getComments:    jasmine.createSpy('getComments').and.resolveTo([]),
    updateStatus:   jasmine.createSpy('updateStatus').and.resolveTo({}),
    resolve:        jasmine.createSpy('resolve').and.resolveTo({}),
    close:          jasmine.createSpy('close').and.resolveTo({}),
    cancel:         jasmine.createSpy('cancel').and.resolveTo({}),
    reopen:         jasmine.createSpy('reopen').and.resolveTo({}),
    updatePriority: jasmine.createSpy('updatePriority').and.resolveTo({}),
    assign:         jasmine.createSpy('assign').and.resolveTo({}),
    updateAssignee: jasmine.createSpy('updateAssignee').and.resolveTo({}),
    unassign:       jasmine.createSpy('unassign').and.resolveTo({}),
    waitInfo:       jasmine.createSpy('waitInfo').and.resolveTo({}),
    start:          jasmine.createSpy('start').and.resolveTo({}),
  };
}

// ─── SessionService stub ──────────────────────────────────────────────────────

function makeSessionStub() {
  const emptyPage = { data: [], meta: { totalPages: 1, page: 1, limit: 20, total: 0 } };
  return {
    list:         jasmine.createSpy('list').and.resolveTo(emptyPage),
    getStats:     jasmine.createSpy('getStats').and.resolveTo(null),
    create:       jasmine.createSpy('create').and.resolveTo({}),
    bulkCreate:   jasmine.createSpy('bulkCreate').and.resolveTo([]),
    complete:     jasmine.createSpy('complete').and.resolveTo({}),
    confirm:      jasmine.createSpy('confirm').and.resolveTo({}),
    finalize:     jasmine.createSpy('finalize').and.resolveTo({}),
    remove:       jasmine.createSpy('remove').and.resolveTo(true),
    getChangeRequests: jasmine.createSpy('getChangeRequests').and.resolveTo([]),
    createChangeRequest: jasmine.createSpy('createChangeRequest').and.resolveTo({}),
    approveChangeRequest: jasmine.createSpy('approveChangeRequest').and.resolveTo({}),
    rejectChangeRequest: jasmine.createSpy('rejectChangeRequest').and.resolveTo({}),
  };
}

// ─── ClassService stub ────────────────────────────────────────────────────────

function makeClassStub() {
  return {
    list: jasmine.createSpy('list').and.resolveTo([]),
    getOne: jasmine.createSpy('getOne').and.resolveTo(null),
    getStudents: jasmine.createSpy('getStudents').and.resolveTo([]),
  };
}

// ─── UserService stub ─────────────────────────────────────────────────────────

function makeUserStub() {
  return {
    list:   jasmine.createSpy('list').and.resolveTo({ data: [], total: 0 }),
    getOne: jasmine.createSpy('getOne').and.resolveTo(null),
  };
}

// ─── ActivatedRoute stub ──────────────────────────────────────────────────────

const activatedRouteStub = {
  snapshot: { queryParamMap: { get: (_: string) => null } },
  queryParams: of({}),
};

const routerStub = {
  navigate: jasmine.createSpy('navigate'),
};

// ════════════════════════════════════════════════════════════════════════════
// SUITE 1 — TicketsComponent (Batch 12: Scenarios 30.1, 30.6)
// ════════════════════════════════════════════════════════════════════════════

describe('TicketsComponent — Batch 12 Unit Tests (30.1, 30.6)', () => {
  let fixture: ComponentFixture<TicketsComponent>;
  let component: TicketsComponent;
  let ticketStub: ReturnType<typeof makeTicketStub>;

  async function create(role: string = Role.OPS) {
    ticketStub = makeTicketStub();
    await TestBed.configureTestingModule({
      imports: [TicketsComponent, HttpClientTestingModule],
      providers: [
        { provide: TicketService, useValue: ticketStub },
        { provide: AuthService, useValue: makeAuthStub(role) },
        { provide: ActivatedRoute, useValue: activatedRouteStub },
        { provide: Router, useValue: routerStub },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(TicketsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  }

  afterEach(() => TestBed.resetTestingModule());

  // ── Component creation ──────────────────────────────────────────────────
  describe('Khởi tạo — Scenario 30.6', () => {
    beforeEach(async () => create(Role.OPS));

    it('should create the component', () => {
      expect(component).toBeTruthy();
    });
  });

  // ── filteredTickets — tìm kiếm từ khóa ────────────────────────────────────
  describe('filteredTickets — computed filter (Scenario 30.6)', () => {
    beforeEach(async () => create(Role.OPS));

    it('empty keyword → trả về tất cả tickets', () => {
      const items = [
        { ticketCode: 'TKT-001', subject: 'Hỏi về học phí', createdBy: { fullName: 'Phụ huynh A' }, status: 'OPEN' },
        { ticketCode: 'TKT-002', subject: 'Lịch học bị trùng', createdBy: { fullName: 'Phụ huynh B' }, status: 'OPEN' },
      ] as any;
      component.tickets.set(items);
      component.searchKeyword.set('');
      expect(component.filteredTickets().length).toBe(2);
    });

    it('keyword khớp ticketCode (case-insensitive) → lọc đúng', () => {
      const items = [
        { ticketCode: 'TKT-001', subject: 'Hỏi về học phí', createdBy: { fullName: 'A' }, status: 'OPEN' },
        { ticketCode: 'TKT-002', subject: 'Lịch học', createdBy: { fullName: 'B' }, status: 'OPEN' },
      ] as any;
      component.tickets.set(items);
      component.searchKeyword.set('tkt-001');
      expect(component.filteredTickets().length).toBe(1);
      expect(component.filteredTickets()[0].ticketCode).toBe('TKT-001');
    });

    it('keyword khớp subject', () => {
      const items = [
        { ticketCode: 'TKT-010', subject: 'Hoàn tiền học phí', createdBy: { fullName: 'A' }, status: 'OPEN' },
        { ticketCode: 'TKT-011', subject: 'Lịch học tháng 7', createdBy: { fullName: 'B' }, status: 'OPEN' },
      ] as any;
      component.tickets.set(items);
      component.searchKeyword.set('học phí');
      const result = component.filteredTickets();
      expect(result.length).toBe(1);
      expect(result[0].ticketCode).toBe('TKT-010');
    });

    it('keyword khớp createdBy.fullName', () => {
      const items = [
        { ticketCode: 'TKT-020', subject: 'Hỏi A', createdBy: { fullName: 'Nguyễn Văn An' }, status: 'OPEN' },
        { ticketCode: 'TKT-021', subject: 'Hỏi B', createdBy: { fullName: 'Trần Thị Bình' }, status: 'OPEN' },
      ] as any;
      component.tickets.set(items);
      component.searchKeyword.set('nguyễn văn an');
      const result = component.filteredTickets();
      expect(result.length).toBe(1);
      expect(result[0].ticketCode).toBe('TKT-020');
    });

    it('keyword không khớp → trả về mảng rỗng', () => {
      const items = [
        { ticketCode: 'TKT-030', subject: 'Topic', createdBy: { fullName: 'User' }, status: 'OPEN' },
      ] as any;
      component.tickets.set(items);
      component.searchKeyword.set('xyznonexistent');
      expect(component.filteredTickets().length).toBe(0);
    });

    it('keyword khớp một phần (substring)', () => {
      const items = [
        { ticketCode: 'TKT-040', subject: 'Yêu cầu hoàn tiền học phí tháng 6', createdBy: { fullName: 'C' }, status: 'OPEN' },
        { ticketCode: 'TKT-041', subject: 'Lịch học tuần tới', createdBy: { fullName: 'D' }, status: 'OPEN' },
      ] as any;
      component.tickets.set(items);
      component.searchKeyword.set('hoàn tiền');
      const result = component.filteredTickets();
      expect(result.length).toBe(1);
      expect(result[0].ticketCode).toBe('TKT-040');
    });
  });

  // ── statusLabel() ─────────────────────────────────────────────────────────
  describe('statusLabel() — tất cả 7 trạng thái (Scenario 30.1)', () => {
    beforeEach(async () => create(Role.OPS));

    it('OPEN → "Mới tạo"',            () => expect(component.statusLabel('OPEN')).toBe('Mới tạo'));
    it('IN_PROGRESS → "Đang xử lý"',  () => expect(component.statusLabel('IN_PROGRESS')).toBe('Đang xử lý'));
    it('WAITING_INFO → "Chờ thông tin"', () => expect(component.statusLabel('WAITING_INFO')).toBe('Chờ thông tin'));
    it('WAITING_REFUND → "Chờ hoàn tiền"', () => expect(component.statusLabel('WAITING_REFUND')).toBe('Chờ hoàn tiền'));
    it('RESOLVED → "Đã giải quyết"',  () => expect(component.statusLabel('RESOLVED')).toBe('Đã giải quyết'));
    it('CLOSED → "Đã đóng"',          () => expect(component.statusLabel('CLOSED')).toBe('Đã đóng'));
    it('CANCELLED → "Đã hủy"',        () => expect(component.statusLabel('CANCELLED')).toBe('Đã hủy'));
    it('Unknown status → passthrough', () => expect(component.statusLabel('UNKNOWN_XYZ')).toBe('UNKNOWN_XYZ'));
  });

  // ── priorityLabel() ───────────────────────────────────────────────────────
  describe('priorityLabel() — tất cả 4 mức ưu tiên (Scenario 30.1)', () => {
    beforeEach(async () => create(Role.OPS));

    it('LOW → "Thấp"',           () => expect(component.priorityLabel('LOW')).toBe('Thấp'));
    it('MEDIUM → "Trung bình"',  () => expect(component.priorityLabel('MEDIUM')).toBe('Trung bình'));
    it('HIGH → "Cao"',           () => expect(component.priorityLabel('HIGH')).toBe('Cao'));
    it('URGENT → "Khẩn cấp"',   () => expect(component.priorityLabel('URGENT')).toBe('Khẩn cấp'));
    it('Unknown → passthrough',  () => expect(component.priorityLabel('XYZ')).toBe('XYZ'));
  });

  // ── Role guards ───────────────────────────────────────────────────────────
  describe('isStaff() — OPS, DIRECTOR, ACCOUNTING = true; PARENT, TEACHER = false', () => {
    it('OPS → isStaff = true', async () => {
      await create(Role.OPS);
      expect(component.isStaff()).toBe(true);
    });

    it('DIRECTOR → isStaff = true', async () => {
      await create(Role.DIRECTOR);
      expect(component.isStaff()).toBe(true);
    });

    it('ACCOUNTING → isStaff = true', async () => {
      await create(Role.ACCOUNTING);
      expect(component.isStaff()).toBe(true);
    });

    it('PARENT → isStaff = false', async () => {
      await create(Role.PARENT);
      expect(component.isStaff()).toBe(false);
    });

    it('TEACHER → isStaff = false', async () => {
      await create(Role.TEACHER);
      expect(component.isStaff()).toBe(false);
    });
  });

  describe('isOpsOrDirector() — OPS, DIRECTOR = true; ACCOUNTING, PARENT = false', () => {
    it('OPS → true',       async () => { await create(Role.OPS);       expect(component.isOpsOrDirector()).toBe(true); });
    it('DIRECTOR → true',  async () => { await create(Role.DIRECTOR);  expect(component.isOpsOrDirector()).toBe(true); });
    it('ACCOUNTING → false', async () => { await create(Role.ACCOUNTING); expect(component.isOpsOrDirector()).toBe(false); });
    it('PARENT → false',   async () => { await create(Role.PARENT);    expect(component.isOpsOrDirector()).toBe(false); });
  });

  describe('isParent()', () => {
    it('PARENT → true',   async () => { await create(Role.PARENT);  expect(component.isParent()).toBe(true); });
    it('OPS → false',     async () => { await create(Role.OPS);     expect(component.isParent()).toBe(false); });
    it('TEACHER → false', async () => { await create(Role.TEACHER); expect(component.isParent()).toBe(false); });
  });

  // ── Default activeTab by role ─────────────────────────────────────────────
  describe('activeTab mặc định theo role (Scenario 30.6)', () => {
    it('OPS → activeTab = "assigned"', async () => {
      await create(Role.OPS);
      expect(component.activeTab).toBe('assigned');
    });

    it('DIRECTOR → activeTab = "all"', async () => {
      await create(Role.DIRECTOR);
      expect(component.activeTab).toBe('all');
    });

    it('ACCOUNTING → activeTab = "all"', async () => {
      await create(Role.ACCOUNTING);
      expect(component.activeTab).toBe('all');
    });

    it('PARENT → activeTab = "my"', async () => {
      await create(Role.PARENT);
      expect(component.activeTab).toBe('my');
    });

    it('TEACHER → activeTab = "my"', async () => {
      await create(Role.TEACHER);
      expect(component.activeTab).toBe('my');
    });

    it('SALE → activeTab = "my"', async () => {
      await create(Role.SALE);
      expect(component.activeTab).toBe('my');
    });
  });

  // ── getStatCount() ────────────────────────────────────────────────────────
  describe('getStatCount() — đếm ticket theo status (Scenario 30.6)', () => {
    beforeEach(async () => create(Role.DIRECTOR));

    it('không có stats → 0', () => {
      component.serverStats.set(null);
      expect(component.getStatCount('OPEN')).toBe(0);
    });

    it('stats có OPEN = 5 → 5', () => {
      component.serverStats.set({
        byStatus: [{ _id: 'OPEN', count: 5 }, { _id: 'IN_PROGRESS', count: 2 }],
        overdueCount: 0,
      } as any);
      expect(component.getStatCount('OPEN')).toBe(5);
    });

    it('stats có IN_PROGRESS = 2 → 2', () => {
      component.serverStats.set({
        byStatus: [{ _id: 'OPEN', count: 5 }, { _id: 'IN_PROGRESS', count: 2 }],
        overdueCount: 0,
      } as any);
      expect(component.getStatCount('IN_PROGRESS')).toBe(2);
    });

    it('status không có trong stats → 0', () => {
      component.serverStats.set({
        byStatus: [{ _id: 'OPEN', count: 3 }],
        overdueCount: 0,
      } as any);
      expect(component.getStatCount('RESOLVED')).toBe(0);
    });
  });
});

// ════════════════════════════════════════════════════════════════════════════
// SUITE 2 — SessionsComponent (Batch 12: Scenarios 30.2, 30.7–30.10)
// ════════════════════════════════════════════════════════════════════════════

describe('SessionsComponent — Batch 12 Unit Tests (30.2, 30.7–30.10)', () => {
  let fixture: ComponentFixture<SessionsComponent>;
  let component: SessionsComponent;
  let sessionStub: ReturnType<typeof makeSessionStub>;

  async function create(role: string = Role.DIRECTOR) {
    sessionStub = makeSessionStub();
    await TestBed.configureTestingModule({
      imports: [SessionsComponent, HttpClientTestingModule],
      providers: [
        { provide: SessionService, useValue: sessionStub },
        { provide: ClassService, useValue: makeClassStub() },
        { provide: UserService, useValue: makeUserStub() },
        { provide: AuthService, useValue: makeAuthStub(role) },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(SessionsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  }

  afterEach(() => TestBed.resetTestingModule());

  // ── Component creation ──────────────────────────────────────────────────
  describe('Khởi tạo — Scenario 30.2', () => {
    beforeEach(async () => create(Role.DIRECTOR));

    it('should create the component', () => {
      expect(component).toBeTruthy();
    });
  });

  // ── statusLabel() — tất cả 6 trạng thái ──────────────────────────────────
  describe('statusLabel() — 6 trạng thái buổi học', () => {
    beforeEach(async () => create(Role.DIRECTOR));

    it('SCHEDULED → "Đã lên lịch"',            () => expect(component.statusLabel('SCHEDULED')).toBe('Đã lên lịch'));
    it('TEACHER_COMPLETED → "GV hoàn thành"',  () => expect(component.statusLabel('TEACHER_COMPLETED')).toBe('GV hoàn thành'));
    it('PARENT_CONFIRMED → "PH xác nhận"',     () => expect(component.statusLabel('PARENT_CONFIRMED')).toBe('PH xác nhận'));
    it('FINALIZED → "Đã chốt"',                () => expect(component.statusLabel('FINALIZED')).toBe('Đã chốt'));
    it('CANCELLED → "Đã hủy"',                 () => expect(component.statusLabel('CANCELLED')).toBe('Đã hủy'));
    it('NO_SHOW → "Vắng"',                     () => expect(component.statusLabel('NO_SHOW')).toBe('Vắng'));
    it('Unknown status → passthrough',          () => expect(component.statusLabel('UNKNOWN_STATE')).toBe('UNKNOWN_STATE'));
  });

  // ── formatChangeRequestStatus() ────────────────────────────────────────────
  describe('formatChangeRequestStatus()', () => {
    beforeEach(async () => create(Role.OPS));
    const sessionsAny = () => component as any;

    it('PENDING → "Chờ duyệt"',         () => expect(sessionsAny().formatChangeRequestStatus('PENDING')).toBe('Chờ duyệt'));
    it('APPROVED → "Đã duyệt"',         () => expect(sessionsAny().formatChangeRequestStatus('APPROVED')).toBe('Đã duyệt'));
    it('REJECTED → "Từ chối"',          () => expect(sessionsAny().formatChangeRequestStatus('REJECTED')).toBe('Từ chối'));
    it('CANCELLED → "Đã hủy"',          () => expect(sessionsAny().formatChangeRequestStatus('CANCELLED')).toBe('Đã hủy'));
    it('Unknown → passthrough',          () => expect(sessionsAny().formatChangeRequestStatus('OTHER')).toBe('OTHER'));
  });

  // ── canCreate() — DIRECTOR, OPS → true; SALE, TEACHER, PARENT → false ────
  describe('canCreate() — Scenario 30.7', () => {
    it('DIRECTOR → canCreate = true',  async () => { await create(Role.DIRECTOR); expect(component.canCreate()).toBe(true); });
    it('OPS → canCreate = true',       async () => { await create(Role.OPS);      expect(component.canCreate()).toBe(true); });
    it('SALE → canCreate = false',     async () => { await create(Role.SALE);     expect(component.canCreate()).toBe(false); });
    it('TEACHER → canCreate = false',  async () => { await create(Role.TEACHER);  expect(component.canCreate()).toBe(false); });
    it('PARENT → canCreate = false',   async () => { await create(Role.PARENT);   expect(component.canCreate()).toBe(false); });
    it('ACCOUNTING → canCreate = false', async () => { await create(Role.ACCOUNTING); expect(component.canCreate()).toBe(false); });
  });

  // ── canRequestChange() — SALE only ───────────────────────────────────────
  describe('canRequestSessionChange() — Scenario 30.8', () => {
    const makeSession = (status: string = 'SCHEDULED') => ({ status } as any);

    it('SALE → canRequestChange = true',    async () => { await create(Role.SALE);    expect(component.canRequestSessionChange(makeSession())).toBe(true); });
    it('DIRECTOR → canRequestChange = false', async () => { await create(Role.DIRECTOR); expect(component.canRequestSessionChange(makeSession())).toBe(false); });
    it('OPS → canRequestChange = false',    async () => { await create(Role.OPS);    expect(component.canRequestSessionChange(makeSession())).toBe(false); });
    it('TEACHER → canRequestChange = false', async () => { await create(Role.TEACHER); expect(component.canRequestSessionChange(makeSession())).toBe(false); });
    it('SALE → non-SCHEDULED = false', async () => { await create(Role.SALE); expect(component.canRequestSessionChange(makeSession('FINALIZED'))).toBe(false); });
  });

  // ── Role predicates ───────────────────────────────────────────────────────
  describe('isTeacher() — Scenario 30.10', () => {
    it('TEACHER → true',   async () => { await create(Role.TEACHER);  expect(component.isTeacher()).toBe(true); });
    it('DIRECTOR → false', async () => { await create(Role.DIRECTOR); expect(component.isTeacher()).toBe(false); });
    it('OPS → false',      async () => { await create(Role.OPS);      expect(component.isTeacher()).toBe(false); });
  });

  describe('isParent() — Scenario 30.9', () => {
    it('PARENT → true',    async () => { await create(Role.PARENT);   expect(component.isParent()).toBe(true); });
    it('DIRECTOR → false', async () => { await create(Role.DIRECTOR); expect(component.isParent()).toBe(false); });
    it('TEACHER → false',  async () => { await create(Role.TEACHER);  expect(component.isParent()).toBe(false); });
  });

  describe('isDirector() — Scenario 30.9', () => {
    it('DIRECTOR → true',  async () => { await create(Role.DIRECTOR); expect(component.isDirector()).toBe(true); });
    it('OPS → false',      async () => { await create(Role.OPS);      expect(component.isDirector()).toBe(false); });
    it('ACCOUNTING → false', async () => { await create(Role.ACCOUNTING); expect(component.isDirector()).toBe(false); });
  });

  // ── formatCurrency() ─────────────────────────────────────────────────────
  describe('formatCurrency() — Scenario 30.7', () => {
    beforeEach(async () => create(Role.DIRECTOR));

    it('100000 → bao gồm "₫"', () => {
      const result = component.formatCurrency(100000);
      expect(result).toContain('₫');
    });

    it('0 → không ném lỗi', () => {
      expect(() => component.formatCurrency(0)).not.toThrow();
    });

    it('giá trị undefined/null → xử lý an toàn (0)', () => {
      expect(() => component.formatCurrency(undefined as any)).not.toThrow();
    });
  });
});
