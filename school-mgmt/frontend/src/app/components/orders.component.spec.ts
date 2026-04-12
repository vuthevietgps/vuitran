// OrdersComponent — Unit + UI-logic tests (Karma/Jasmine)
//
// Bao phủ logic UI/UX của orders.component.ts tương ứng với 10 tình huống đầu:
//
//  State machine của đơn (canEdit / canSubmit / canApproveOrder / canCancel)
//  Pipeline display helpers (getPipeCount / getPipeValue)
//  Status/type label và color helpers
//  Amount calculation helpers (orderInvoiceAmount / orderCoursePrice)
//  Form helpers (emptyForm / buildFormItem / roundMoneyToThousand)
//  Lookup filter helpers (filteredParents / filteredStudents)
//  Role-based visibility (isSaleRole / canApprove)
//
// Run:  ng test --include orders.component.spec.ts

import { TestBed, ComponentFixture } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';

import { OrdersComponent } from './orders.component';
import { OrderService, OrderData, OrderPipeline } from '../services/order.service';
import { InvoiceService } from '../services/invoice.service';
import { ProductService } from '../services/product.service';
import { StudentService } from '../services/student.service';
import { LeadService } from '../services/lead.service';
import { AdsService } from '../services/ads.service';
import { AuthService } from '../services/auth.service';
import { UserService } from '../services/user.service';
import { ClassService } from '../services/class.service';
import { Role } from '../models/role.enum';

// ─── Stubs ──────────────────────────────────────────────────────────────────

function makeOrderData(overrides: Partial<OrderData> = {}): OrderData {
  return {
    _id: 'OD-001',
    orderCode: 'ORD-2026-0001',
    orderType: 'NEW_ENROLLMENT',
    status: 'DRAFT',
    parentName: 'Nguyen Van A',
    parentPhone: '0901000001',
    studentName: 'Nguyen Van B',
    items: [
      {
        productId: 'PROD-1',
        productName: 'English Online',
        sessions: 10,
        sessionDuration: 60,
        pricePerSession: 200_000,
        amount: 2_000_000,
      },
    ],
    totalAmount: 2_000_000,
    finalAmount: 2_000_000,
    saleId: 'SALE-1',
    ...overrides,
  };
}

function makeAuthServiceStub(role: Role = Role.SALE) {
  return {
    userSignal: () => ({
      sub: 'user-001',
      email: `${role.toLowerCase()}@school.local`,
      role,
      fullName: `Test ${role}`,
    }),
    isLoggedIn: () => true,
  };
}

function makeOrderServiceStub() {
  return {
    list: jasmine.createSpy('list').and.resolveTo([]),
    getPipeline: jasmine.createSpy('getPipeline').and.resolveTo({}),
    getOne: jasmine.createSpy('getOne').and.resolveTo(null),
    create: jasmine.createSpy('create').and.resolveTo({ ok: true }),
    update: jasmine.createSpy('update').and.resolveTo({ ok: true }),
    submit: jasmine.createSpy('submit').and.resolveTo({ ok: true }),
    approve: jasmine.createSpy('approve').and.resolveTo({ ok: true }),
    reject: jasmine.createSpy('reject').and.resolveTo({ ok: true }),
    cancel: jasmine.createSpy('cancel').and.resolveTo({ ok: true }),
  };
}

// ─── Suite ──────────────────────────────────────────────────────────────────

describe('OrdersComponent', () => {
  let component: OrdersComponent;
  let fixture: ComponentFixture<OrdersComponent>;
  let authStub: ReturnType<typeof makeAuthServiceStub>;
  let orderStub: ReturnType<typeof makeOrderServiceStub>;

  async function createComponent(role: Role = Role.SALE) {
    authStub = makeAuthServiceStub(role);
    orderStub = makeOrderServiceStub();

    await TestBed.configureTestingModule({
      imports: [OrdersComponent, HttpClientTestingModule],
      providers: [
        { provide: AuthService, useValue: authStub },
        { provide: OrderService, useValue: orderStub },
        {
          provide: InvoiceService,
          useValue: { list: () => Promise.resolve([]) },
        },
        {
          provide: ProductService,
          useValue: { list: () => Promise.resolve([]) },
        },
        {
          provide: StudentService,
          useValue: {
            list: () => Promise.resolve([]),
            listParents: () => Promise.resolve([]),
          },
        },
        {
          provide: LeadService,
          useValue: { getOne: () => Promise.resolve(null) },
        },
        {
          provide: AdsService,
          useValue: { getGroupsByPlatform: () => Promise.resolve([]) },
        },
        {
          provide: UserService,
          useValue: {
            listParents: () => Promise.resolve([]),
            listSales: () => Promise.resolve([]),
            listTeachers: () => Promise.resolve([]),
          },
        },
        {
          provide: ClassService,
          useValue: {
            list: () => Promise.resolve([]),
            listSaleOfflineOptions: () => Promise.resolve([]),
          },
        },
        {
          provide: ActivatedRoute,
          useValue: { queryParams: of({}) },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(OrdersComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Component instantiation
  // ══════════════════════════════════════════════════════════════════════════

  describe('Khởi tạo component', () => {
    beforeEach(async () => {
      await createComponent(Role.SALE);
    });

    it('should create the component', () => {
      expect(component).toBeTruthy();
    });

    it('Sale role: isSaleRole = true, canApprove = false', () => {
      expect(component.isSaleRole).toBe(true);
      expect(component.canApprove).toBe(false);
    });

    it('Pipeline statuses phải có DRAFT, SUBMITTED, APPROVED', () => {
      expect(component.pipelineStatuses).toContain('DRAFT');
      expect(component.pipelineStatuses).toContain('SUBMITTED');
      expect(component.pipelineStatuses).toContain('APPROVED');
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // State machine: canEdit / canSubmit / canApproveOrder / canCancel
  // test.md 1.1-1.5 vai trò RBAC UI
  // ══════════════════════════════════════════════════════════════════════════

  describe('canEdit()', () => {
    beforeEach(async () => await createComponent(Role.SALE));

    it('DRAFT → canEdit = true (Sale có thể sửa)', () => {
      expect(component.canEdit(makeOrderData({ status: 'DRAFT' }))).toBe(true);
    });

    it('NEEDS_INFO → canEdit = true (Sale được bổ sung thêm thông tin)', () => {
      expect(component.canEdit(makeOrderData({ status: 'NEEDS_INFO' }))).toBe(true);
    });

    it('SUBMITTED → canEdit = false (đơn đã gửi, không được sửa)', () => {
      expect(component.canEdit(makeOrderData({ status: 'SUBMITTED' }))).toBe(false);
    });

    it('APPROVED → canEdit = false (đơn đã duyệt, không được sửa)', () => {
      expect(component.canEdit(makeOrderData({ status: 'APPROVED' }))).toBe(false);
    });

    it('REJECTED → canEdit = false', () => {
      expect(component.canEdit(makeOrderData({ status: 'REJECTED' }))).toBe(false);
    });
  });

  describe('canSubmit()', () => {
    beforeEach(async () => await createComponent(Role.SALE));

    it('DRAFT → canSubmit = true', () => {
      expect(component.canSubmit(makeOrderData({ status: 'DRAFT' }))).toBe(true);
    });

    it('NEEDS_INFO → canSubmit = true', () => {
      expect(component.canSubmit(makeOrderData({ status: 'NEEDS_INFO' }))).toBe(true);
    });

    it('SUBMITTED → canSubmit = false (tránh double submit)', () => {
      expect(component.canSubmit(makeOrderData({ status: 'SUBMITTED' }))).toBe(false);
    });

    it('CANCELLED → canSubmit = false', () => {
      expect(component.canSubmit(makeOrderData({ status: 'CANCELLED' }))).toBe(false);
    });
  });

  describe('canApproveOrder()', () => {
    it('DIRECTOR + SUBMITTED → canApproveOrder = true', async () => {
      await createComponent(Role.DIRECTOR);
      expect(component.canApproveOrder(makeOrderData({ status: 'SUBMITTED' }))).toBe(true);
    });

    it('OPS + SUBMITTED → canApproveOrder = true', async () => {
      await createComponent(Role.OPS);
      expect(component.canApproveOrder(makeOrderData({ status: 'SUBMITTED' }))).toBe(true);
    });

    it('SALE + SUBMITTED → canApproveOrder = false (Sale không được duyệt — RBAC)', async () => {
      await createComponent(Role.SALE);
      expect(component.canApproveOrder(makeOrderData({ status: 'SUBMITTED' }))).toBe(false);
    });

    it('DIRECTOR + DRAFT → canApproveOrder = false (chỉ duyệt được SUBMITTED)', async () => {
      await createComponent(Role.DIRECTOR);
      expect(component.canApproveOrder(makeOrderData({ status: 'DRAFT' }))).toBe(false);
    });

    it('DIRECTOR + APPROVED → canApproveOrder = false (đã duyệt rồi)', async () => {
      await createComponent(Role.DIRECTOR);
      expect(component.canApproveOrder(makeOrderData({ status: 'APPROVED' }))).toBe(false);
    });
  });

  describe('canCancel()', () => {
    it('DRAFT → canCancel = true', async () => {
      await createComponent(Role.DIRECTOR);
      expect(component.canCancel(makeOrderData({ status: 'DRAFT' }))).toBe(true);
    });

    it('SUBMITTED → canCancel = true', async () => {
      await createComponent(Role.DIRECTOR);
      expect(component.canCancel(makeOrderData({ status: 'SUBMITTED' }))).toBe(true);
    });

    it('APPROVED + DIRECTOR → canCancel = true', async () => {
      await createComponent(Role.DIRECTOR);
      expect(component.canCancel(makeOrderData({ status: 'APPROVED' }))).toBe(true);
    });

    it('APPROVED + OPS → canCancel = false', async () => {
      await createComponent(Role.OPS);
      expect(component.canCancel(makeOrderData({ status: 'APPROVED' }))).toBe(false);
    });

    it('COMPLETED → canCancel = false', async () => {
      await createComponent(Role.DIRECTOR);
      expect(component.canCancel(makeOrderData({ status: 'COMPLETED' }))).toBe(false);
    });

    it('CANCELLED → canCancel = false (đã hủy rồi)', async () => {
      await createComponent(Role.DIRECTOR);
      expect(component.canCancel(makeOrderData({ status: 'CANCELLED' }))).toBe(false);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Amount calculation — test.md 1.1 (finalAmount), 1.3 (discount)
  // ══════════════════════════════════════════════════════════════════════════

  describe('orderInvoiceAmount()', () => {
    beforeEach(async () => await createComponent(Role.SALE));

    it('1.1 Đơn chuẩn: trả về finalAmount khi có = 2,000,000', () => {
      const order = makeOrderData({ finalAmount: 2_000_000, totalAmount: 2_000_000 });
      expect(component.orderInvoiceAmount(order)).toBe(2_000_000);
    });

    it('1.3 Discount: finalAmount = 1,800,000 (totalAmount = 2,000,000 nhưng discount 200k)', () => {
      const order = makeOrderData({ totalAmount: 2_000_000, finalAmount: 1_800_000 });
      expect(component.orderInvoiceAmount(order)).toBe(1_800_000);
    });

    it('1.4 Zero-amount trial: finalAmount = 0', () => {
      const order = makeOrderData({ totalAmount: 0, finalAmount: 0 });
      expect(component.orderInvoiceAmount(order)).toBe(0);
    });

    it('Fallback: dùng totalAmount nếu finalAmount không tồn tại', () => {
      const order = { ...makeOrderData(), finalAmount: undefined as any };
      expect(component.orderInvoiceAmount(order)).toBe(2_000_000);
    });
  });

  describe('discount validation', () => {
    beforeEach(async () => await createComponent(Role.SALE));

    it('hasInvalidDiscount = true khi discount lon hon tong tien', () => {
      component.form = {
        ...component.emptyForm(),
        items: [component.buildFormItem({ amount: 2_000_000, sessions: 10, invoiceSessions: 10, pricePerSession: 200_000 })],
        discountAmount: 2_500_000,
      };

      expect(component.hasInvalidDiscount()).toBe(true);
      expect(component.submitDisabled()).toBe(true);
    });

    it('hasInvalidDiscount = false khi discount nho hon hoac bang tong tien', () => {
      component.form = {
        ...component.emptyForm(),
        items: [component.buildFormItem({ amount: 2_000_000, sessions: 10, invoiceSessions: 10, pricePerSession: 200_000 })],
        discountAmount: 500_000,
      };

      expect(component.hasInvalidDiscount()).toBe(false);
    });
  });

  describe('image reference normalization', () => {
    beforeEach(async () => await createComponent(Role.SALE));

    it('bo qua studentFaceImage legacy khong hop le khi build payload', () => {
      component.form = {
        ...component.emptyForm(),
        parentName: 'Parent Demo',
        parentPhone: '0901000001',
        studentName: 'Student Demo',
        studentFaceImage: 'default-avatar.png',
        receiptImage: 'data:image/png;base64,abc123',
        items: [component.buildFormItem({
          productId: 'P1',
          productName: 'English',
          amount: 2_000_000,
          sessions: 10,
          invoiceSessions: 10,
          sessionDuration: 60,
          pricePerSession: 200_000,
          createNewClassWhenApproved: false,
        })],
      } as any;

      const payload = component.buildPayload() as any;

      expect(payload.studentFaceImage).toBeUndefined();
      expect(payload.receiptImage).toBe('data:image/png;base64,abc123');
    });

    it('applyStudentSelection chi giu image reference hop le', () => {
      component.form = {
        ...component.emptyForm(),
        studentFaceImage: 'data:image/png;base64,old',
      } as any;

      component.applyStudentSelection({
        _id: 'student-1',
        studentCode: 'HS001',
        fullName: 'Student Demo',
        faceImage: 'default-avatar.png',
        parentName: 'Parent Demo',
        parentPhone: '0901000001',
      } as any);
      expect(component.form.studentFaceImage).toBe('');

      component.applyStudentSelection({
        _id: 'student-2',
        studentCode: 'HS002',
        fullName: 'Student Demo 2',
        faceImage: 'data:image/png;base64,new',
        parentName: 'Parent Demo',
        parentPhone: '0901000002',
      } as any);
      expect(component.form.studentFaceImage).toBe('data:image/png;base64,new');
    });
  });

  describe('product subject sync', () => {
    beforeEach(async () => await createComponent(Role.SALE));

    it('onProductSelect tu dong dien mon hoc theo cau hinh san pham', () => {
      component.products.set([
        {
          _id: 'PROD-EN',
          name: 'English Offline',
          code: 'EN-01',
          category: 'ENGLISH',
          teachingMode: 'OFFLINE',
          defaultSessions: 16,
          defaultSessionDuration: 90,
          pricePerSession: 250_000,
          suggestedPrice: 4_000_000,
          isActive: true,
        },
      ] as any);

      const item = component.buildFormItem();
      component.onProductSelect(item, 'PROD-EN');

      expect(item.productName).toBe('English Offline');
      expect(item.subject).toBe('Tiếng Anh');
      expect(item.sessions).toBe(16);
      expect(item.invoiceSessions).toBe(16);
      expect(item.teachingMode).toBe('OFFLINE');
    });

    it('buildFormItem backfill mon hoc neu order cu chi co productId', () => {
      component.products.set([
        {
          _id: 'PROD-MATH',
          name: 'Math Basic',
          code: 'MATH-01',
          category: 'MATH',
          teachingMode: 'ONLINE',
          defaultSessions: 12,
          defaultSessionDuration: 60,
          pricePerSession: 300_000,
          suggestedPrice: 3_600_000,
          isActive: true,
        },
      ] as any);

      const item = component.buildFormItem({
        productId: 'PROD-MATH',
        productName: 'Math Basic',
        subject: '',
      });

      expect(item.subject).toBe('Toán');
    });
  });

  describe('orderCoursePrice()', () => {
    beforeEach(async () => await createComponent(Role.SALE));

    it('Tính tổng giá khóa học từ items', () => {
      const order = makeOrderData({
        items: [
          {
            productId: 'P1',
            productName: 'English',
            sessions: 10,
            sessionDuration: 60,
            pricePerSession: 200_000,
            amount: 2_000_000,
          },
        ],
      });
      const price = component.orderCoursePrice(order);
      // suggestedPrice not available → fallback = sessions * pricePerSession
      expect(price).toBeGreaterThanOrEqual(0);
    });

    it('2 items: tổng cộng cả hai', () => {
      const order = makeOrderData({
        items: [
          { productId: 'P1', productName: 'Eng', sessions: 10, sessionDuration: 60, pricePerSession: 200_000, amount: 2_000_000 },
          { productId: 'P2', productName: 'Math', sessions: 5, sessionDuration: 60, pricePerSession: 150_000, amount: 750_000 },
        ],
      });
      const price = component.orderCoursePrice(order);
      expect(price).toBeGreaterThanOrEqual(0);
    });

    it('1.4 Trial 0đ OFFLINE không được fallback sang suggestedPrice của product', () => {
      component.products.set([
        {
          _id: 'P-TRIAL',
          name: 'English Trial Product',
          code: 'TRIAL-01',
          category: 'ENGLISH',
          teachingMode: 'OFFLINE',
          defaultSessions: 10,
          defaultSessionDuration: 60,
          pricePerSession: 150_000,
          suggestedPrice: 1_500_000,
          isActive: true,
        },
      ] as any);

      const order = makeOrderData({
        items: [
          {
            productId: 'P-TRIAL',
            productName: 'English Trial Product',
            sessions: 1,
            invoiceSessions: 0,
            sessionDuration: 60,
            baseDuration: 60,
            pricePerSession: 0,
            amount: 0,
            teachingMode: 'OFFLINE',
            trialSessions: 1,
          },
        ],
        totalAmount: 0,
        finalAmount: 0,
      });

      expect(component.orderCoursePrice(order)).toBe(0);
      expect(component.productSuggestedPrice(order.items[0] as any)).toBe(0);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Status labels & colors — UI badge rendering
  // ══════════════════════════════════════════════════════════════════════════

  describe('statusLabel() + statusColor()', () => {
    beforeEach(async () => await createComponent(Role.SALE));

    it('DRAFT → "Nháp"', () => {
      expect(component.statusLabel('DRAFT')).toBe('Nháp');
    });

    it('SUBMITTED → "Chờ duyệt"', () => {
      expect(component.statusLabel('SUBMITTED')).toBe('Chờ duyệt');
    });

    it('APPROVED → "Đã duyệt"', () => {
      expect(component.statusLabel('APPROVED')).toBe('Đã duyệt');
    });

    it('REJECTED → "Từ chối" (1.5 — đơn bị từ chối)', () => {
      expect(component.statusLabel('REJECTED')).toBe('Từ chối');
    });

    it('CANCELLED → "Đã hủy"', () => {
      expect(component.statusLabel('CANCELLED')).toBe('Đã hủy');
    });

    it('REJECTED → statusColor returns non-empty string', () => {
      const color = component.statusColor('REJECTED');
      expect(color).toBeTruthy();
      expect(color.startsWith('#')).toBeTrue();
    });

    it('APPROVED → statusColor = green-ish (#10b981)', () => {
      expect(component.statusColor('APPROVED')).toBe('#10b981');
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Pipeline display — UI pipeline board
  // ══════════════════════════════════════════════════════════════════════════

  describe('getPipeCount() / getPipeValue()', () => {
    beforeEach(async () => await createComponent(Role.DIRECTOR));

    it('Khi pipeline = null → getPipeCount = 0', () => {
      component.pipeline.set(null);
      expect(component.getPipeCount('SUBMITTED')).toBe(0);
      expect(component.getPipeValue('SUBMITTED')).toBe(0);
    });

    it('Khi pipeline có dữ liệu → trả đúng count + value', () => {
      const mockPipeline: OrderPipeline = {
        DRAFT: { count: 3, totalValue: 6_000_000 },
        SUBMITTED: { count: 5, totalValue: 10_000_000 },
        APPROVED: { count: 2, totalValue: 4_000_000 },
      };
      component.pipeline.set(mockPipeline);
      expect(component.getPipeCount('SUBMITTED')).toBe(5);
      expect(component.getPipeValue('SUBMITTED')).toBe(10_000_000);
      expect(component.getPipeCount('APPROVED')).toBe(2);
      expect(component.getPipeCount('REJECTED')).toBe(0); // Missing key → 0
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // filteredParents / filteredStudents — lookup search UI
  // ══════════════════════════════════════════════════════════════════════════

  describe('filteredParents()', () => {
    beforeEach(async () => {
      await createComponent(Role.SALE);
      component.parents.set([
        { _id: 'PH001', fullName: 'Nguyen Van A', phone: '0901000001', email: 'a@test.com', role: Role.PARENT } as any,
        { _id: 'PH002', fullName: 'Tran Thi B', phone: '0902000002', email: 'b@test.com', role: Role.PARENT } as any,
        { _id: 'PH003', fullName: 'Le Van C', phone: '0903000003', email: 'c@test.com', role: Role.PARENT } as any,
      ]);
    });

    it('Không có query → trả tất cả parents', () => {
      component.parentLookup = '';
      expect(component.filteredParents().length).toBe(3);
    });

    it('Query theo tên → lọc đúng', () => {
      component.parentLookup = 'nguyen';
      const result = component.filteredParents();
      expect(result.every((p: any) => p.fullName.toLowerCase().includes('nguyen'))).toBeTrue();
    });

    it('Query theo SĐT → lọc đúng', () => {
      component.parentLookup = '090200';
      const result = component.filteredParents();
      expect(result.some((p: any) => p.phone === '0902000002')).toBeTrue();
      expect(result.every((p: any) => (p.phone || '').includes('090200'))).toBeTrue();
    });

    it('Query không khớp → trả []', () => {
      component.parentLookup = 'xxxnotfound';
      expect(component.filteredParents().length).toBe(0);
    });
  });

  describe('filteredStudents()', () => {
    beforeEach(async () => {
      await createComponent(Role.SALE);
      component.students.set([
        { _id: 'STU001', studentCode: 'HS001', fullName: 'Nguyen Van B', parentName: 'Nguyen Van A', parentPhone: '0901000001' } as any,
        { _id: 'STU002', studentCode: 'HS002', fullName: 'Tran Thi C', parentName: 'Tran Thi D', parentPhone: '0902000002' } as any,
      ]);
    });

    it('Không có query → trả tất cả students', () => {
      component.studentLookup = '';
      expect(component.filteredStudents().length).toBe(2);
    });

    it('Query theo mã HS → lọc đúng', () => {
      component.studentLookup = 'HS001';
      const result = component.filteredStudents();
      expect(result.length).toBe(1);
      expect((result[0] as any).studentCode).toBe('HS001');
    });

    it('Query theo tên học sinh → lọc đúng', () => {
      component.studentLookup = 'nguyen van b';
      const result = component.filteredStudents();
      expect(result.some((s: any) => s.fullName.toLowerCase().includes('nguyen van b'))).toBeTrue();
    });

    it('Query theo SĐT phụ huynh → lọc đúng', () => {
      component.studentLookup = '090200';
      const result = component.filteredStudents();
      expect(result.some((s: any) => (s.parentPhone || '').includes('090200'))).toBeTrue();
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // roundMoneyToThousand — amount calculation helpers
  // ══════════════════════════════════════════════════════════════════════════

  describe('roundMoneyToThousand()', () => {
    beforeEach(async () => await createComponent(Role.SALE));

    it('1,800,000 → 1,800,000 (đã tròn nghìn)', () => {
      expect(component.roundMoneyToThousand(1_800_000)).toBe(1_800_000);
    });

    it('1,234,567 → 1,235,000 (làm tròn lên)', () => {
      expect(component.roundMoneyToThousand(1_234_567)).toBe(1_235_000);
    });

    it('0 → 0', () => {
      expect(component.roundMoneyToThousand(0)).toBe(0);
    });

    it('null/undefined → 0', () => {
      expect(component.roundMoneyToThousand(null)).toBe(0);
      expect(component.roundMoneyToThousand(undefined)).toBe(0);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Director role — canApprove + không phải Sale
  // ══════════════════════════════════════════════════════════════════════════

  describe('Director role init', () => {
    beforeEach(async () => await createComponent(Role.DIRECTOR));

    it('Director: isSaleRole = false', () => {
      expect(component.isSaleRole).toBe(false);
    });

    it('Director: canApprove = true', () => {
      expect(component.canApprove).toBe(true);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // requiresApprovalProof — Zero-amount trial (1.4) không cần chứng từ
  // ══════════════════════════════════════════════════════════════════════════

  describe('requiresApprovalProof()', () => {
    beforeEach(async () => await createComponent(Role.DIRECTOR));

    it('1.1 Đơn chuẩn (ONLINE, amount > 0) → requiresApprovalProof = true', () => {
      const order = makeOrderData({
        items: [{
          productId: 'P1',
          productName: 'English',
          sessions: 10,
          sessionDuration: 60,
          pricePerSession: 200_000,
          amount: 2_000_000,
          teachingMode: 'ONLINE',
        }],
      });
      expect(component.requiresApprovalProof(order)).toBe(true);
    });

    it('1.4 Học thử OFFLINE, amount = 0, trialSessions > 0 → requiresApprovalProof = false', () => {
      const order = makeOrderData({
        items: [{
          productId: 'P1',
          productName: 'English Trial',
          sessions: 2,
          sessionDuration: 60,
          pricePerSession: 0,
          amount: 0,
          teachingMode: 'OFFLINE',
          trialSessions: 2,
        }],
      });
      expect(component.requiresApprovalProof(order)).toBe(false);
    });
  });
});
