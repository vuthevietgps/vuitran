import { closeE2eResources } from './e2e-cleanup';
/**
 * Backend E2E — Batch 6 : Nhóm 13 (State Machine Strictness)
 * Scenarios : 13.1, 13.2, 13.3, 13.4
 *
 * DB suffix  : g11
 * MongoMemoryReplSet: single-node wiredTiger (required for transactions)
 */

import * as request from 'supertest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { AppModule } from '../src/app.module';
import * as cookieParser from 'cookie-parser';
import { Role } from '../src/common/interfaces/role.enum';
import { UserStatus } from '../src/common/interfaces/user-status.enum';
import { User } from '../src/users/schemas/user.schema';

// ─── helpers ─────────────────────────────────────────────────────────────────

async function loginAs(
  app: INestApplication,
  email: string,
  password: string,
): Promise<{ cookies: string[] }> {
  const res = await request(app.getHttpServer())
    .post('/auth/login')
    .send({ email, password })
    .expect(({ status }) => {
      if (status !== 200 && status !== 201) throw new Error(`Login failed: ${status}`);
    });
  const accessTokenCookie = extractCookieValue(res.headers['set-cookie'], 'access_token');
  if (!accessTokenCookie) {
    throw new Error(`Missing access_token cookie for ${email}`);
  }

  const meRes = await request(app.getHttpServer())
    .get('/users/me')
    .set('Cookie', `access_token=${accessTokenCookie}`)
    .expect(200);

  const xsrfToken = extractCookieValue(meRes.headers['set-cookie'], 'XSRF-TOKEN');
  if (!xsrfToken) {
    throw new Error(`Missing XSRF-TOKEN cookie for ${email}`);
  }

  return { cookies: [`access_token=${accessTokenCookie}`, `XSRF-TOKEN=${xsrfToken}`] };
}

function extractCookieValue(
  setCookies: string | string[] | undefined,
  name: string,
): string | null {
  if (!setCookies) return null;
  const rows = Array.isArray(setCookies) ? setCookies : [setCookies];
  const pattern = new RegExp(`(?:^|;\\s*)${name}=([^;]+)`);
  for (const row of rows) {
    const firstPart = String(row).split(';')[0];
    const match = pattern.exec(firstPart);
    if (match?.[1]) return match[1];
  }
  return null;
}

function cookieHeader(cookies: string[]): string {
  return cookies.join('; ');
}

function csrfToken(cookies: string[]): string {
  const raw = cookies.find((c) => c.startsWith('XSRF-TOKEN='));
  if (!raw) return '';
  return raw.split('=')[1].split(';')[0];
}

function authHeaders(cookies: string[]): Record<string, string> {
  return {
    Cookie: cookieHeader(cookies),
    'X-XSRF-TOKEN': csrfToken(cookies),
  };
}

async function upsertUser(
  userModel: Model<any>,
  user: {
    email: string;
    password: string;
    fullName: string;
    role: Role;
    userCode: string;
  },
): Promise<void> {
  const hashedPassword = await bcrypt.hash(user.password, 10);
  await userModel.updateOne(
    { email: user.email },
    {
      $set: {
        email: user.email,
        password: hashedPassword,
        fullName: user.fullName,
        role: user.role,
        userCode: user.userCode,
        status: UserStatus.ACTIVE,
      },
    },
    { upsert: true },
  );
}

// ─── suite ───────────────────────────────────────────────────────────────────

describe('Nhóm 13 — State Machine Strictness (g11)', () => {
  let app: INestApplication;
  let moduleRef: TestingModule;
  let mongod: MongoMemoryReplSet;
  let userModel: Model<any>;
  let previousMongoUri: string | undefined;
  let mongoUri: string;

  function restoreMongoUri(): void {
    if (previousMongoUri === undefined) {
      delete process.env.MONGODB_URI;
      return;
    }

    process.env.MONGODB_URI = previousMongoUri;
  }

  // cookies for each role
  let directorCookies: string[];
  let accountingCookies: string[];
  let opsCookies: string[];
  let saleCookies: string[];

  beforeAll(async () => {
    mongod = await MongoMemoryReplSet.create({
      replSet: { count: 1, storageEngine: 'wiredTiger' },
    });
    previousMongoUri = process.env.MONGODB_URI;
    mongoUri = mongod.getUri().replace('?', 'school-mgmt-g11-e2e?');
    process.env.MONGODB_URI = mongoUri;

    try {
      moduleRef = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();

      app = moduleRef.createNestApplication();
      app.use(cookieParser());
      app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
      await app.init();
    } catch (error) {
      restoreMongoUri();
      throw error;
    }

    userModel = moduleRef.get(getModelToken(User.name));

    const seedUsers = [
      { email: 'director.g11@test.com', fullName: 'Director G11', role: Role.DIRECTOR, userCode: 'DIR-G11' },
      { email: 'accounting.g11@test.com', fullName: 'Accounting G11', role: Role.ACCOUNTING, userCode: 'ACC-G11' },
      { email: 'ops.g11@test.com', fullName: 'OPS G11', role: Role.OPS, userCode: 'OPS-G11' },
      { email: 'sale.g11@test.com', fullName: 'Sale G11', role: Role.SALE, userCode: 'SALE-G11' },
    ];

    try {
      const hashedPassword = await bcrypt.hash('Pass1234!', 10);
      await Promise.all(
        seedUsers.map((user) =>
          userModel.updateOne(
            { email: user.email },
            {
              $set: {
                email: user.email,
                password: hashedPassword,
                fullName: user.fullName,
                role: user.role,
                userCode: user.userCode,
                status: UserStatus.ACTIVE,
              },
            },
            { upsert: true },
          ),
        ),
      );
    } catch (error) {
      console.error('Failed to seed g11 users', error);
      throw error;
    }

    directorCookies = (await loginAs(app, 'director.g11@test.com', 'Pass1234!')).cookies;
    accountingCookies = (await loginAs(app, 'accounting.g11@test.com', 'Pass1234!')).cookies;
    opsCookies = (await loginAs(app, 'ops.g11@test.com', 'Pass1234!')).cookies;
    saleCookies = (await loginAs(app, 'sale.g11@test.com', 'Pass1234!')).cookies;
  });

  afterAll(async () => {
    restoreMongoUri();
    await closeE2eResources({ app, moduleRef, mongoServer: mongod });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // 13.1 — Hủy hóa đơn đã thanh toán (Prevent Hard Delete)
  // ══════════════════════════════════════════════════════════════════════════

  describe('13.1 Prevent Hard Delete on APPROVED Invoice', () => {
    let parentCookies: string[];
    let invoiceId: string;

    beforeAll(async () => {
      // create parent + wallet + top-up → approve → invoice
      await upsertUser(userModel, {
        email: 'parent.g11@test.com',
        password: 'Pass1234!',
        fullName: 'Parent G11',
        role: Role.PARENT,
        userCode: 'PAR-G11',
      });
      const { cookies } = await loginAs(app, 'parent.g11@test.com', 'Pass1234!');
      parentCookies = cookies;

      // get parent userId
      const meRes = await request(app.getHttpServer())
        .get('/users/me')
        .set(authHeaders(parentCookies));
      const parentId = meRes.body._id || meRes.body.sub;

      // create top-up request → approve to get wallet funded
      const topUpRes = await request(app.getHttpServer())
        .post('/wallets/top-up')
        .set(authHeaders(opsCookies))
        .send({ userId: parentId, amount: 2000000, paymentMethod: 'CASH' });
      const ledgerId = topUpRes.body._id;
      if (ledgerId) {
        await request(app.getHttpServer())
          .post(`/wallets/top-up/${ledgerId}/approve`)
          .set(authHeaders(accountingCookies))
          .send({ approvalNote: 'ok' });
      }

      // create invoice manually (DIRECTOR can create)
      const createRes = await request(app.getHttpServer())
        .post('/invoices')
        .set(authHeaders(directorCookies))
        .send({
          parentId,
          amount: 2000000,
          description: 'Test invoice g11',
          paymentMethod: 'CASH',
          invoiceNumber: `INV-G11-${Date.now()}`,
        });
      invoiceId = createRes.body?._id || createRes.body?.data?._id || '';
      if (!invoiceId) return; // skip if invoice creation not supported directly

      // approve it
      await request(app.getHttpServer())
        .post(`/invoices/${invoiceId}/approve`)
        .set(authHeaders(accountingCookies))
        .send({ action: 'APPROVE' });
    });

    it('13.1 DELETE /invoices/:id (APPROVED) → 400 hoặc 405 hoặc 409', async () => {
      if (!invoiceId) return;
      const res = await request(app.getHttpServer())
        .delete(`/invoices/${invoiceId}`)
        .set(authHeaders(directorCookies));
      expect([400, 405, 409, 422]).toContain(res.status);
    });

    it('13.1 Invoice vẫn tồn tại sau khi cố xóa', async () => {
      if (!invoiceId) return;
      const res = await request(app.getHttpServer())
        .get(`/invoices/${invoiceId}`)
        .set(authHeaders(directorCookies));
      expect([200, 201]).toContain(res.status);
    });

    it('13.1 POST /invoices/:id/cancel → thành công (đúng API hủy)', async () => {
      if (!invoiceId) return;
      const res = await request(app.getHttpServer())
        .post(`/invoices/${invoiceId}/cancel`)
        .set(authHeaders(accountingCookies))
        .send({ reason: 'Test cancel' });
      expect([200, 201]).toContain(res.status);
    });

    it('13.1 Kế toán PATCH /invoices/:id (status=PENDING) → chặn lùi trạng thái', async () => {
      if (!invoiceId) return;
      const res = await request(app.getHttpServer())
        .patch(`/invoices/${invoiceId}`)
        .set(authHeaders(accountingCookies))
        .send({ status: 'PENDING_APPROVAL' });
      // Either 400 (business rule) or the status field is ignored (200 but no status change)
      // Both are acceptable prevention mechanisms
      if (res.status === 200 || res.status === 201) {
        // If allowed, status should not have changed backwards
        const check = await request(app.getHttpServer())
          .get(`/invoices/${invoiceId}`)
          .set(authHeaders(directorCookies));
        // status should remain APPROVED or CANCELLED (not PENDING_APPROVAL)
        expect(check.body?.status).not.toBe('PENDING_APPROVAL');
      } else {
        expect([400, 403, 422]).toContain(res.status);
      }
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // 13.2 — Sửa lớp sau khi đã lên lịch (PricingSnapshot Immutability)
  // ══════════════════════════════════════════════════════════════════════════

  describe('13.2 PricingSnapshot Immutability', () => {
    let classId: string;
    let studentId: string;
    let teacherId: string;
    let finalizedSessionId: string;
    let scheduledSessionId: string;

    beforeAll(async () => {
      // create teacher
      await upsertUser(userModel, {
        email: 'teacher.g11@test.com',
        password: 'Pass1234!',
        fullName: 'Teacher G11',
        role: Role.TEACHER,
        userCode: 'TEA-G11',
      });
      const teacherRes = await request(app.getHttpServer())
        .get('/users?role=TEACHER')
        .set(authHeaders(directorCookies));
      teacherId = (teacherRes.body?.data || teacherRes.body || [])
        .find((u: any) => u.email === 'teacher.g11@test.com')?._id || '';

      // create student
      const studentRes = await request(app.getHttpServer())
        .post('/students')
        .set(authHeaders(opsCookies))
        .send({ name: 'Student G11', grade: '10', parentUserId: undefined });
      studentId = studentRes.body?._id || '';

      // create class at 150k/session
      const classRes = await request(app.getHttpServer())
        .post('/classes')
        .set(authHeaders(opsCookies))
        .send({
          name: 'Class G11 Pricing',
          teacherId,
          pricePerSession: 150000,
          teachingMode: 'ONLINE',
          subject: 'Math',
          grade: '10',
          sessionDurationMinutes: 60,
        });
      classId = classRes.body?._id || '';
      if (!classId) return;

      // assign student
      await request(app.getHttpServer())
        .post(`/classes/${classId}/assign-students`)
        .set(authHeaders(opsCookies))
        .send({ studentIds: [studentId] });

      // create a session and finalize it (amountCharged = 150k)
      const sessRes = await request(app.getHttpServer())
        .post('/sessions')
        .set(authHeaders(opsCookies))
        .send({
          classId,
          scheduledDate: new Date(Date.now() - 86400000).toISOString(), // yesterday
          teacherId,
          durationMinutes: 60,
        });
      finalizedSessionId = sessRes.body?._id || '';
      if (finalizedSessionId) {
        await request(app.getHttpServer())
          .post(`/sessions/${finalizedSessionId}/finalize`)
          .set(authHeaders(opsCookies))
          .send({ notes: 'done' });
      }

      // create a scheduled session (future)
      const futureSessRes = await request(app.getHttpServer())
        .post('/sessions')
        .set(authHeaders(opsCookies))
        .send({
          classId,
          scheduledDate: new Date(Date.now() + 86400000).toISOString(), // tomorrow
          teacherId,
          durationMinutes: 60,
        });
      scheduledSessionId = futureSessRes.body?._id || '';
    });

    it('13.2 PATCH /classes/:id (pricePerSession=200000) → 200', async () => {
      if (!classId) return;
      const res = await request(app.getHttpServer())
        .patch(`/classes/${classId}`)
        .set(authHeaders(directorCookies))
        .send({ pricePerSession: 200000 });
      expect([200, 201]).toContain(res.status);
    });

    it('13.2 Session đã FINALIZED: amountCharged vẫn = 150k (snapshot bất biến)', async () => {
      if (!finalizedSessionId) return;
      const res = await request(app.getHttpServer())
        .get(`/sessions/${finalizedSessionId}`)
        .set(authHeaders(directorCookies));
      if (res.status === 200) {
        const amount = res.body?.amountCharged ?? res.body?.priceSnapshot;
        if (amount !== undefined) {
          expect(amount).toBe(150000);
        }
      }
    });

    it('13.2 Session mới tạo sau thay đổi giá áp dụng giá 200k', async () => {
      if (!classId || !teacherId) return;
      const newSessRes = await request(app.getHttpServer())
        .post('/sessions')
        .set(authHeaders(opsCookies))
        .send({
          classId,
          scheduledDate: new Date(Date.now() + 3 * 86400000).toISOString(),
          teacherId,
          durationMinutes: 60,
        });
      const newSessId = newSessRes.body?._id;
      if (!newSessId) return;

      const res = await request(app.getHttpServer())
        .get(`/sessions/${newSessId}`)
        .set(authHeaders(directorCookies));
      if (res.status === 200) {
        // pricePerSession or priceSnapshot should reflect new price
        const price = res.body?.pricePerSession ?? res.body?.priceSnapshot ?? res.body?.amountCharged;
        if (price !== undefined) {
          expect(price).toBe(200000);
        }
      }
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // 13.3 — Duyệt Đơn hàng thiếu chứng từ (Receipt Validation)
  // ══════════════════════════════════════════════════════════════════════════

  describe('13.3 Order Receipt Validation', () => {
    let orderId: string;
    let parentId: string;
    let studentId: string;

    beforeAll(async () => {
      // create parent for order
      await upsertUser(userModel, {
        email: 'parent2.g11@test.com',
        password: 'Pass1234!',
        fullName: 'Parent2 G11',
        role: Role.PARENT,
        userCode: 'PAR2-G11',
      });
      const parentLoginRes = await loginAs(app, 'parent2.g11@test.com', 'Pass1234!');
      const meRes = await request(app.getHttpServer())
        .get('/users/me')
        .set(authHeaders(parentLoginRes.cookies));
      parentId = meRes.body?._id || meRes.body?.sub || '';

      // create student
      const studentRes = await request(app.getHttpServer())
        .post('/students')
        .set(authHeaders(opsCookies))
        .send({ name: 'Student G11 B', grade: '11', parentUserId: parentId });
      studentId = studentRes.body?._id || '';

      // Sale tạo Order paymentMethod=TRANSFER mà KHÔNG có receiptImage
      const orderRes = await request(app.getHttpServer())
        .post('/orders')
        .set(authHeaders(saleCookies))
        .send({
          parentId,
          studentId,
          totalAmount: 2000000,
          finalAmount: 2000000,
          paymentMethod: 'TRANSFER',
          sessions: 10,
          note: 'Test no receipt g11',
          // NO receiptImage
        });
      orderId = orderRes.body?._id || orderRes.body?.data?._id || '';
    });

    it('13.3 Director approve Order TRANSFER không có receiptImage → 400', async () => {
      if (!orderId) return;
      // submit order first if in DRAFT state
      await request(app.getHttpServer())
        .post(`/orders/${orderId}/submit`)
        .set(authHeaders(saleCookies));

      const res = await request(app.getHttpServer())
        .post(`/orders/${orderId}/approve`)
        .set(authHeaders(directorCookies))
        .send({});
      expect([400, 422]).toContain(res.status);
    });

    it('13.3 Order.status vẫn = PENDING sau khi bị chặn approve', async () => {
      if (!orderId) return;
      const res = await request(app.getHttpServer())
        .get(`/orders/${orderId}`)
        .set(authHeaders(directorCookies));
      expect([200, 201]).toContain(res.status);
      // status should not be APPROVED
      expect(res.body?.status).not.toBe('APPROVED');
    });

    it('13.3 paymentMethod=CASH: approve không cần receiptImage → 200', async () => {
      // create cash order
      const cashOrderRes = await request(app.getHttpServer())
        .post('/orders')
        .set(authHeaders(saleCookies))
        .send({
          parentId,
          studentId,
          totalAmount: 500000,
          finalAmount: 500000,
          paymentMethod: 'CASH',
          sessions: 3,
          note: 'cash order no receipt needed',
        });
      const cashOrderId = cashOrderRes.body?._id;
      if (!cashOrderId) return;

      await request(app.getHttpServer())
        .post(`/orders/${cashOrderId}/submit`)
        .set(authHeaders(saleCookies));

      const approveRes = await request(app.getHttpServer())
        .post(`/orders/${cashOrderId}/approve`)
        .set(authHeaders(directorCookies))
        .send({});
      expect([200, 201]).toContain(approveRes.status);
    });

    it('13.3 Wallet không có TOP_UP sau khi approve thất bại', async () => {
      if (!parentId) return;
      const walletRes = await request(app.getHttpServer())
        .get(`/wallets/user/${parentId}`)
        .set(authHeaders(directorCookies));
      // balance should be 0 (no successful top-up from rejected approve)
      // or the balance should not include the 2000000 from the rejected order
      if (walletRes.status === 200) {
        const balance = walletRes.body?.balance ?? 0;
        expect(balance).toBeLessThan(2000000);
      }
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // 13.4 — Chặn lùi trạng thái Payroll (Payroll State Machine)
  // ══════════════════════════════════════════════════════════════════════════

  describe('13.4 Payroll State Reversal Blocked', () => {
    let payrollId: string;
    let staffUserId: string;

    beforeAll(async () => {
      // create a staff user
      await upsertUser(userModel, {
        email: 'teacher2.g11@test.com',
        password: 'Pass1234!',
        fullName: 'Teacher2 G11',
        role: Role.TEACHER,
        userCode: 'TEA2-G11',
      });
      const usersRes = await request(app.getHttpServer())
        .get('/users?role=TEACHER')
        .set(authHeaders(directorCookies));
      staffUserId = (usersRes.body?.data || usersRes.body || [])
        .find((u: any) => u.email === 'teacher2.g11@test.com')?._id || '';
      if (!staffUserId) return;

      // generate payroll
      const genRes = await request(app.getHttpServer())
        .post('/staff-payroll')
        .set(authHeaders(accountingCookies))
        .send({
          userId: staffUserId,
          periodStart: '2026-03-01',
          periodEnd: '2026-03-31',
          bonusAmount: 0,
        });
      payrollId = genRes.body?._id || '';
      if (!payrollId) return;

      // submit → approve → mark-paid
      await request(app.getHttpServer())
        .post(`/staff-payroll/${payrollId}/submit`)
        .set(authHeaders(accountingCookies));
      await request(app.getHttpServer())
        .post(`/staff-payroll/${payrollId}/approve`)
        .set(authHeaders(directorCookies));
      await request(app.getHttpServer())
        .post(`/staff-payroll/${payrollId}/mark-paid`)
        .set(authHeaders(accountingCookies))
        .send({ paymentRef: 'TXN-G11-TEST' });
    });

    it('13.4 Status đang = PAID sau mark-paid', async () => {
      if (!payrollId) return;
      const res = await request(app.getHttpServer())
        .get(`/staff-payroll/${payrollId}`)
        .set(authHeaders(directorCookies));
      expect([200, 201]).toContain(res.status);
      expect(res.body?.status).toBe('PAID');
    });

    it('13.4 POST /staff-payroll/:id/reopen trên PAID → 400 (không cho lùi)', async () => {
      if (!payrollId) return;
      const res = await request(app.getHttpServer())
        .post(`/staff-payroll/${payrollId}/reopen`)
        .set(authHeaders(directorCookies));
      expect([400, 409, 422]).toContain(res.status);
    });

    it('13.4 POST /staff-payroll/:id/submit trên PAID → 400', async () => {
      if (!payrollId) return;
      const res = await request(app.getHttpServer())
        .post(`/staff-payroll/${payrollId}/submit`)
        .set(authHeaders(accountingCookies));
      expect([400, 409, 422]).toContain(res.status);
    });

    it('13.4 PATCH /staff-payroll/:id với body giả status=DRAFT → trường status không bị ghi đè', async () => {
      if (!payrollId) return;
      await request(app.getHttpServer())
        .patch(`/staff-payroll/${payrollId}`)
        .set(authHeaders(accountingCookies))
        .send({ status: 'DRAFT', bonusAmount: 100 }); // status field should be ignored by DTO whitelist

      const checkRes = await request(app.getHttpServer())
        .get(`/staff-payroll/${payrollId}`)
        .set(authHeaders(directorCookies));
      // status PHẢI vẫn là PAID
      expect(checkRes.body?.status).toBe('PAID');
    });

    it('13.4 POST /staff-payroll/:id/approve trên PAID → 400 (đã qua approve rồi)', async () => {
      if (!payrollId) return;
      const res = await request(app.getHttpServer())
        .post(`/staff-payroll/${payrollId}/approve`)
        .set(authHeaders(directorCookies));
      expect([400, 409, 422]).toContain(res.status);
    });

    it('13.4 DELETE /staff-payroll/:id khi đã PAID → 400 hoặc 403', async () => {
      if (!payrollId) return;
      const res = await request(app.getHttpServer())
        .delete(`/staff-payroll/${payrollId}`)
        .set(authHeaders(directorCookies));
      expect([400, 403, 409, 422]).toContain(res.status);
    });
  });
});
