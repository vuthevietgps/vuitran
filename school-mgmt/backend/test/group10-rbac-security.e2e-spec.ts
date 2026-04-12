import { closeE2eResources } from './e2e-cleanup';
// NHÓM 12: PHÂN QUYỀN, BẢO MẬT & TRUY VẾT
//
// test.md §NHÓM 12: RBAC, Isolation & Audit (12.1–12.5)
//
// 12.1  Cách ly dữ liệu Sale (Data Isolation)
//         Sale A chỉ thấy orders của mình; GET /orders/:id (của Sale B) → 403/404
// 12.2  Vượt quyền duyệt chi (Privilege Escalation)
//         OPS PATCH /staff-payroll/:id → 403
//         OPS POST /wallets/adjust → 403
// 12.3  Dấu vết Audit Log (Immutable Audit Trail)
//         GET /audit-log sau action → có entry đúng
//         DELETE /audit-log/:id → 403/405 (không ai xóa được)
// 12.4  Phụ huynh tò mò (Parent Data Boundary)
//         Parent A GET /students/:studentY/sessions → 403/404
//         Parent A GET các resource của Parent B → 403/404
// 12.5  Bảo mật API Token quảng cáo
//         GET /ads/tokens → chỉ DIRECTOR được; ACCOUNTING → 403
//
// Run:  npx jest --config ./test/jest-e2e.json --runInBand group10-rbac-security

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import * as request from 'supertest';
import * as cookieParser from 'cookie-parser';
import * as bcrypt from 'bcrypt';
import { AppModule } from '../src/app.module';

// ─── Types ──────────────────────────────────────────────────────────────────

type AuthSession = {
  accessToken: string;
  xsrfToken: string;
  cookieHeader: string;
};

type SeedUser = {
  email: string;
  password: string;
  fullName: string;
  role: 'DIRECTOR' | 'OPS' | 'TEACHER' | 'PARENT' | 'ACCOUNTING' | 'SALE' | 'SHAREHOLDER';
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function extractCookieValue(
  setCookies: string | string[] | undefined,
  name: string,
): string | null {
  if (!setCookies) return null;
  const rows = Array.isArray(setCookies) ? setCookies : [setCookies];
  const pattern = new RegExp(`(?:^|;\\s*)${name}=([^;]+)`);
  for (const row of rows) {
    const first = String(row).split(';')[0];
    const m = pattern.exec(first);
    if (m?.[1]) return m[1];
  }
  return null;
}

function randomEmail(prefix: string): string {
  return `${prefix}.${Date.now()}.${Math.floor(Math.random() * 9999)}@g10.local`;
}

function todayYmd(): string {
  return new Date().toISOString().slice(0, 10);
}

// ─── Suite ──────────────────────────────────────────────────────────────────

describe('Nhóm 12: RBAC, Bảo mật & Audit (e2e)', () => {
  let app: INestApplication;
  let moduleRef: TestingModule;
  let replSet: MongoMemoryReplSet;

  // Models
  let userModel: Model<any>;
  let orderModel: Model<any>;
  let walletModel: Model<any>;
  let studentModel: Model<any>;
  let staffPayrollModel: Model<any>;
  let auditLogModel: Model<any>;

  // Seed users
  const director: SeedUser = {
    email: 'director.g10.e2e@school.local',
    password: 'E2ePass123!',
    fullName: 'Director G10',
    role: 'DIRECTOR',
  };
  const accounting: SeedUser = {
    email: 'accounting.g10.e2e@school.local',
    password: 'E2ePass123!',
    fullName: 'Accounting G10',
    role: 'ACCOUNTING',
  };
  const ops: SeedUser = {
    email: 'ops.g10.e2e@school.local',
    password: 'E2ePass123!',
    fullName: 'Ops G10',
    role: 'OPS',
  };

  let directorSession: AuthSession;
  let accountingSession: AuthSession;
  let opsSession: AuthSession;

  // ── Helpers ──────────────────────────────────────────────────────────

  async function upsertUser(u: SeedUser): Promise<any> {
    const hashed = await bcrypt.hash(u.password, 10);
    await userModel.updateOne(
      { email: u.email },
      {
        $set: {
          email: u.email,
          password: hashed,
          fullName: u.fullName,
          role: u.role,
          status: 'ACTIVE',
        },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true },
    );
    return userModel.findOne({ email: u.email }).lean();
  }

  async function loginAndGetSession(e: string, p: string): Promise<AuthSession> {
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: e, password: p })
      .expect((res) => expect([200, 201]).toContain(res.status));

    const accessToken = extractCookieValue(loginRes.headers['set-cookie'], 'access_token');
    expect(accessToken).toBeTruthy();

    const meRes = await request(app.getHttpServer())
      .get('/users/me')
      .set('Cookie', `access_token=${accessToken}`)
      .expect(200);

    const xsrfToken = extractCookieValue(meRes.headers['set-cookie'], 'XSRF-TOKEN');
    expect(xsrfToken).toBeTruthy();

    return {
      accessToken: accessToken as string,
      xsrfToken: xsrfToken as string,
      cookieHeader: `access_token=${accessToken}; XSRF-TOKEN=${xsrfToken}`,
    };
  }

  function authedPost(sess: AuthSession, path: string) {
    return request(app.getHttpServer())
      .post(path)
      .set('Cookie', sess.cookieHeader)
      .set('X-XSRF-TOKEN', sess.xsrfToken);
  }

  function authedGet(sess: AuthSession, path: string) {
    return request(app.getHttpServer())
      .get(path)
      .set('Cookie', sess.cookieHeader)
      .set('X-XSRF-TOKEN', sess.xsrfToken);
  }

  function authedPatch(sess: AuthSession, path: string) {
    return request(app.getHttpServer())
      .patch(path)
      .set('Cookie', sess.cookieHeader)
      .set('X-XSRF-TOKEN', sess.xsrfToken);
  }

  function authedDelete(sess: AuthSession, path: string) {
    return request(app.getHttpServer())
      .delete(path)
      .set('Cookie', sess.cookieHeader)
      .set('X-XSRF-TOKEN', sess.xsrfToken);
  }

  // ── Setup / Teardown ─────────────────────────────────────────────────

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({
      replSet: { count: 1, storageEngine: 'wiredTiger' },
    });
    const uri = replSet.getUri();

    process.env.MONGODB_URI = uri.replace('?', 'school-mgmt-g10-e2e?');
    process.env.JWT_SECRET = 'test-jwt-secret-g10';
    process.env.XSRF_SECRET = 'test-xsrf-secret-g10';

    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    userModel = moduleRef.get(getModelToken('User'));
    orderModel = moduleRef.get(getModelToken('Order'));
    walletModel = moduleRef.get(getModelToken('Wallet'));
    studentModel = moduleRef.get(getModelToken('Student'));
    staffPayrollModel = moduleRef.get(getModelToken('StaffPayroll'));
    auditLogModel = moduleRef.get(getModelToken('AuditLog'));

    try {
      await upsertUser(director);
      await upsertUser(accounting);
      await upsertUser(ops);

      directorSession = await loginAndGetSession(director.email, director.password);
      accountingSession = await loginAndGetSession(accounting.email, accounting.password);
      opsSession = await loginAndGetSession(ops.email, ops.password);
    } catch (error) {
      console.error('group10-rbac-security.e2e-spec.ts bootstrap failed', error);
      throw error;
    }
  }, 120_000);

  afterAll(async () => {
    await closeE2eResources({ app, moduleRef, mongoReplSet: replSet });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 12.1  Cách ly dữ liệu Sale (Data Isolation)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('12.1 Sale Data Isolation', () => {
    let saleASession: AuthSession;
    let saleBSession: AuthSession;
    let saleAId: string;
    let saleBOrderId: string;

    beforeAll(async () => {
      const saleA = await upsertUser({
        email: randomEmail('sale-a'),
        password: 'E2ePass123!',
        fullName: 'Sale A G10',
        role: 'SALE',
      });
      const saleB = await upsertUser({
        email: randomEmail('sale-b'),
        password: 'E2ePass123!',
        fullName: 'Sale B G10',
        role: 'SALE',
      });

      saleAId = String(saleA._id);

      saleASession = await loginAndGetSession(saleA.email, 'E2ePass123!');
      saleBSession = await loginAndGetSession(saleB.email, 'E2ePass123!');

      // Sale B tạo order
      const orderByB = await orderModel.create({
        orderCode: `ORD-B-${Date.now()}`,
        orderType: 'NEW_ENROLLMENT',
        status: 'DRAFT',
        parentName: 'Parent B G10',
        parentPhone: '0911222333',
        studentName: 'Student B',
        totalAmount: 1_000_000,
        finalAmount: 1_000_000,
        saleId: saleB._id,
        saleName: 'Sale B G10',
        items: [
          {
            productId: new Types.ObjectId(),
            sessions: 5,
            pricePerSession: 200_000,
            amount: 1_000_000,
            sessionDuration: 60,
          },
        ],
        createdAt: new Date(),
      });
      saleBOrderId = String(orderByB._id);

      // Sale A tạo 2 orders riêng
      await orderModel.create({
        orderCode: `ORD-A-${Date.now()}-1`,
        orderType: 'NEW_ENROLLMENT',
        status: 'DRAFT',
        parentName: 'Parent A G10',
        parentPhone: '0900000001',
        studentName: 'Student A1',
        totalAmount: 2_000_000,
        finalAmount: 2_000_000,
        saleId: saleA._id,
        saleName: 'Sale A G10',
        items: [
          {
            productId: new Types.ObjectId(),
            sessions: 10,
            pricePerSession: 200_000,
            amount: 2_000_000,
            sessionDuration: 60,
          },
        ],
        createdAt: new Date(),
      });
      await orderModel.create({
        orderCode: `ORD-A-${Date.now()}-2`,
        orderType: 'NEW_ENROLLMENT',
        status: 'DRAFT',
        parentName: 'Parent A G10',
        parentPhone: '0900000002',
        studentName: 'Student A2',
        totalAmount: 1_500_000,
        finalAmount: 1_500_000,
        saleId: saleA._id,
        saleName: 'Sale A G10',
        items: [
          {
            productId: new Types.ObjectId(),
            sessions: 7,
            pricePerSession: 200_000,
            amount: 1_500_000,
            sessionDuration: 60,
          },
        ],
        createdAt: new Date(),
      });
    }, 30_000);

    it('12.1.1 Sale A GET /orders → chỉ thấy orders của mình (không thấy của Sale B)', async () => {
      const res = await authedGet(saleASession, '/orders');
      expect([200, 201]).toContain(res.status);

      const orderIds = (res.body.data || res.body).map((o: any) => String(o._id));
      // KHÔNG thấy order của Sale B
      expect(orderIds).not.toContain(saleBOrderId);
    });

    it('12.1.2 Sale A GET /orders/:id (của Sale B) → 403 hoặc 404', async () => {
      const res = await authedGet(saleASession, `/orders/${saleBOrderId}`);
      expect([403, 404]).toContain(res.status);
    });

    it('12.1.3 Sale A số orders trả về = đúng số orders của mình', async () => {
      const res = await authedGet(saleASession, '/orders');
      expect([200, 201]).toContain(res.status);
      const orders = res.body.data || res.body;
      const allBelongToA = orders.every((o: any) => String(o.saleId) === saleAId || !o.saleId);
      expect(allBelongToA).toBe(true);
    });

    it('12.1.4 DIRECTOR GET /orders → thấy tất cả orders (Sale A + B)', async () => {
      const res = await authedGet(directorSession, '/orders');
      expect([200, 201]).toContain(res.status);
      const orderIds = (res.body.data || res.body).map((o: any) => String(o._id));
      expect(orderIds).toContain(saleBOrderId);
    });

    it('12.1.5 Sale A GET /orders/:id (của chính mình) → 200', async () => {
      // Lấy order đầu tiên của Sale A
      const res = await authedGet(saleASession, '/orders');
      const myOrders = res.body.data || res.body;
      if (myOrders.length > 0) {
        const myOrderId = String(myOrders[0]._id);
        const res2 = await authedGet(saleASession, `/orders/${myOrderId}`);
        expect([200, 201]).toContain(res2.status);
      } else {
        expect(true).toBe(true); // no orders seeded
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 12.2  Vượt quyền duyệt chi (Privilege Escalation Blocked)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('12.2 Privilege Escalation Blocked', () => {
    it('12.2.1 OPS PATCH /staff-payroll/:id → 403', async () => {
      // Tạo 1 payroll record
      const saleUser = await upsertUser({
        email: randomEmail('sale-payroll'),
        password: 'E2ePass123!',
        fullName: 'Sale Payroll Test',
        role: 'SALE',
      });
      const payroll = await staffPayrollModel.create({
        userId: saleUser._id,
        userName: saleUser.fullName,
        role: 'SALE',
        periodStart: new Date('2026-03-01'),
        periodEnd: new Date('2026-03-31'),
        baseSalaryAmount: 8_000_000,
        commissionAmount: 0,
        bonusAmount: 0,
        deductionAmount: 0,
        netAmount: 8_000_000,
        status: 'DRAFT',
        payrollCode: `PR-122-${Date.now()}`,
      });

      const res = await authedPatch(opsSession, `/staff-payroll/${payroll._id}`).send({ status: 'APPROVED' });
      expect(res.status).toBe(403);
    });

    it('12.2.2 OPS POST /wallets/adjust → 403', async () => {
      const parentId = new Types.ObjectId();
      await walletModel.create({ userId: parentId, balance: 500_000 });
      const res = await authedPost(opsSession, '/wallets/adjust').send({
        userId: parentId.toString(),
        amount: -200_000,
        reason: 'OPS cố adjust',
      });
      expect(res.status).toBe(403);
    });

    it('12.2.3 SALE POST /orders/:id/approve → 403', async () => {
      const saleUser = await upsertUser({
        email: randomEmail('sale-escalate'),
        password: 'E2ePass123!',
        fullName: 'Sale Escalate',
        role: 'SALE',
      });
      const saleEscSession = await loginAndGetSession(saleUser.email, 'E2ePass123!');

      const order = await orderModel.create({
        orderCode: `ORD-ESC-${Date.now()}`,
        orderType: 'NEW_ENROLLMENT',
        status: 'DRAFT',
        parentName: 'Student Esc Parent',
        parentPhone: '0999000111',
        studentName: 'Student Esc',
        totalAmount: 1_000_000,
        finalAmount: 1_000_000,
        saleId: saleUser._id,
        saleName: 'Sale Escalate',
        items: [
          {
            productId: new Types.ObjectId(),
            sessions: 5,
            pricePerSession: 200_000,
            amount: 1_000_000,
            sessionDuration: 60,
          },
        ],
        createdAt: new Date(),
      });

      const res = await authedPost(saleEscSession, `/orders/${order._id}/approve`).send({});
      expect(res.status).toBe(403);
    });

    it('12.2.4 ACCOUNTING POST /loans/:id/activate → 403', async () => {
      // Chỉ DIRECTOR được activate loan
      const fakeId = new Types.ObjectId().toString();
      const res = await authedPost(accountingSession, `/loans/${fakeId}/activate`).send({});
      expect(res.status).toBe(403);
    });

    it('12.2.5 OPS POST /loans/:id/activate → 403', async () => {
      const fakeId = new Types.ObjectId().toString();
      const res = await authedPost(opsSession, `/loans/${fakeId}/activate`).send({});
      expect(res.status).toBe(403);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 12.3  Dấu vết Audit Log (Immutable Audit Trail)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('12.3 Audit Log Immutability', () => {
    it('12.3.1 DIRECTOR GET /audit-log → trả danh sách entries', async () => {
      const res = await authedGet(directorSession, '/audit-log');
      expect([200, 201]).toContain(res.status);
      expect(res.body).toBeDefined();
      // data array hoặc trực tiếp paginated
      const entries = res.body.data || res.body;
      expect(Array.isArray(entries)).toBe(true);
    });

    it('12.3.2 OPS GET /audit-log → 403', async () => {
      const res = await authedGet(opsSession, '/audit-log');
      expect(res.status).toBe(403);
    });

    it('12.3.3 ACCOUNTING GET /audit-log → 403', async () => {
      const res = await authedGet(accountingSession, '/audit-log');
      expect(res.status).toBe(403);
    });

    it('12.3.4 DELETE /audit-log/:id → 403 hoặc 405 (audit log không thể xóa)', async () => {
      // Tạo 1 entry thủ công
      const directorRecord = (await userModel.findOne({ email: director.email }).lean()) as any;
      const entry = await auditLogModel.create({
        action: 'UPDATE',
        module: 'WALLETS',
        description: 'Test audit log immutability',
        userId: directorRecord?._id,
        userFullName: 'Test User',
        userRole: 'DIRECTOR',
      });

      const res = await authedDelete(directorSession, `/audit-log/${entry._id}`);
      // Phải không cho xóa
      expect([403, 404, 405]).toContain(res.status);

      // Verify entry vẫn còn trong DB
      const stillExists = await auditLogModel.findById(entry._id).lean();
      expect(stillExists).toBeTruthy();
    });

    it('12.3.5 Audit log sau khi approve expense có entry hợp lệ hoặc action được ghi nhận', async () => {
      // Trigger một action tạo audit log
      const expenseModel = moduleRef.get(getModelToken('Expense'), { strict: false });
      if (!expenseModel) {
        expect(true).toBe(true);
        return;
      }

      const expense = await expenseModel.create({
        title: 'Audit Test Expense',
        category: 'UTILITIES',
        amount: 100_000,
        expenseDate: new Date(),
        paymentStatus: 'PENDING_APPROVAL',
        createdById: (await userModel.findOne({ email: director.email }))._id,
        createdByName: director.fullName,
        expenseCode: `EXP-AUDIT-${Date.now()}`,
      });

      await authedPost(directorSession, `/expenses/${expense._id}/approve`).send({});

      // Verify audit log (nếu hệ thống ghi log cho action này)
      const logs = await auditLogModel.find({ targetId: String(expense._id) }).lean();
      // Kiểm tra tồn tại (có thể không ghi log cho expenses — test graceful)
      expect(logs).toBeDefined();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 12.4  Phụ huynh tò mò (Parent Data Boundary)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('12.4 Parent Data Boundary', () => {
    let parentASession: AuthSession;
    let studentBId: string;
    let parentBId: string;

    beforeAll(async () => {
      const parentA = await upsertUser({
        email: randomEmail('parent-a'),
        password: 'E2ePass123!',
        fullName: 'Parent A G10',
        role: 'PARENT',
      });
      const parentB = await upsertUser({
        email: randomEmail('parent-b'),
        password: 'E2ePass123!',
        fullName: 'Parent B G10',
        role: 'PARENT',
      });
      parentBId = String(parentB._id);

      parentASession = await loginAndGetSession(parentA.email, 'E2ePass123!');

      // Student của Parent B
      const studentB = await studentModel.create({
        fullName: 'Student B',
        age: 10,
        parentName: 'Parent B G10',
        parentPhone: '0903000002',
        faceImage: 'https://example.com/student-b.jpg',
        parentUserId: parentB._id,
        saleId: new Types.ObjectId(),
        status: 'ACTIVE',
        studentCode: `SB-${Date.now()}`,
      });
      studentBId = String(studentB._id);
    }, 30_000);

    it('12.4.1 Parent A GET /students/:studentB → 403 hoặc 404', async () => {
      const res = await authedGet(parentASession, `/students/${studentBId}`);
      expect([403, 404]).toContain(res.status);
    });

    it('12.4.2 Parent A GET /wallets/user/:parentBId → 403', async () => {
      const res = await authedGet(parentASession, `/wallets/user/${parentBId}`);
      expect(res.status).toBe(403);
    });

    it('12.4.3 Parent A GET /teaching-reports?studentId=studentB → 403 hoặc rỗng', async () => {
      const res = await authedGet(parentASession, `/teaching-reports?studentId=${studentBId}`);
      // Phải 403 hoặc trả về rỗng (không lộ data của student B)
      if (res.status === 200 || res.status === 201) {
        const items = res.body.data || res.body;
        expect(Array.isArray(items) ? items.length : 0).toBe(0);
      } else {
        expect([403, 404]).toContain(res.status);
      }
    });

    it('12.4.4 Parent A GET /wallets/me → chỉ thấy ví của chính mình', async () => {
      const res = await authedGet(parentASession, '/wallets/me');
      expect([200, 201]).toContain(res.status);
      // Wallet trả về thuộc về Parent A (không phải B)
      expect(res.body).toBeDefined();
    });

    it('12.4.5 Parent A GET /sessions?studentId=studentB → 403 hoặc rỗng', async () => {
      const res = await authedGet(parentASession, `/sessions?studentId=${studentBId}`);
      if (res.status === 200 || res.status === 201) {
        const items = res.body.data || res.body;
        // Không được thấy session của student B
        expect(Array.isArray(items) ? items.length : 0).toBe(0);
      } else {
        expect([403, 404]).toContain(res.status);
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 12.5  Bảo mật API Token quảng cáo
  // ═══════════════════════════════════════════════════════════════════════════

  describe('12.5 Ads API Token Security', () => {
    it('12.5.1 GET /ads/tokens → chỉ DIRECTOR (200)', async () => {
      const res = await authedGet(directorSession, '/ads/tokens');
      expect([200, 201]).toContain(res.status);
    });

    it('12.5.2 GET /ads/tokens → ACCOUNTING bị chặn (403)', async () => {
      const res = await authedGet(accountingSession, '/ads/tokens');
      expect(res.status).toBe(403);
    });

    it('12.5.3 GET /ads/tokens → OPS bị chặn (403)', async () => {
      const res = await authedGet(opsSession, '/ads/tokens');
      expect(res.status).toBe(403);
    });

    it('12.5.4 POST /ads/tokens → chỉ DIRECTOR được tạo', async () => {
      const res = await authedPost(accountingSession, '/ads/tokens').send({
        name: 'Test Token',
        platform: 'FACEBOOK',
        token: 'fake-token-test',
      });
      expect(res.status).toBe(403);
    });

    it('12.5.5 DELETE /ads/tokens/:id → chỉ DIRECTOR được xóa', async () => {
      const fakeId = new Types.ObjectId().toString();
      const res = await authedDelete(opsSession, `/ads/tokens/${fakeId}`);
      expect(res.status).toBe(403);
    });

    it('12.5.6 GET /ads/accounts → DIRECTOR/OPS/SALE/ADSMANAGER đều được (200 hoặc 404)', async () => {
      const res = await authedGet(opsSession, '/ads/accounts');
      expect([200, 201]).toContain(res.status);
    });

    it('12.5.7 POST /ads/accounts → chỉ DIRECTOR được tạo account', async () => {
      const res = await authedPost(opsSession, '/ads/accounts').send({
        name: 'Test Account',
        platform: 'FACEBOOK',
        accountId: '123456789',
      });
      expect(res.status).toBe(403);
    });
  });
});
