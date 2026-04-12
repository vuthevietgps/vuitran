import { closeE2eResources } from './e2e-cleanup';
// NHÓM 5: CHUYỂN TIỀN, ĐIỀU CHỈNH THỦ CÔNG & ĐỐI SOÁT — Scenarios 5.1 → 5.3
//
// test.md §NHÓM 5: Wallet Transfer, Manual Adjustment, Bank Reconciliation Mismatch
//
// 5.1  Chuyển tiền giữa ví (Wallet Transfer) → TRANSFER_OUT + TRANSFER_IN
// 5.2  Kế toán điều chỉnh thủ công (Manual Adjustment) → ADJUSTMENT ledger
// 5.3  Đối soát ngân hàng lệch (Bank Reconciliation Mismatch) →
//        dùng POST /invoices/:id/cancel vì không có module reconciliation riêng
//        → ADJUSTMENT âm -amount, ví giảm
//
// Run:  npx jest --config ./test/jest-e2e.json --runInBand group5-wallets-adjustments

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
  role: 'DIRECTOR' | 'OPS' | 'TEACHER' | 'PARENT' | 'ACCOUNTING';
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

function todayYmd(): string {
  return new Date().toISOString().slice(0, 10);
}

// ─── Suite ──────────────────────────────────────────────────────────────────

describe('Nhóm 5: Chuyển tiền, Điều chỉnh & Đối soát (e2e)', () => {
  let app: INestApplication;
  let moduleRef: TestingModule;
  let replSet: MongoMemoryReplSet;

  // Models
  let userModel: Model<any>;
  let walletModel: Model<any>;
  let ledgerModel: Model<any>;
  let invoiceModel: Model<any>;
  let studentModel: Model<any>;
  let classModel: Model<any>;

  // Seed users
  const director: SeedUser = {
    email: 'director.g5.e2e@school.local',
    password: 'E2ePass123!',
    fullName: 'Director G5',
    role: 'DIRECTOR',
  };
  const accounting: SeedUser = {
    email: 'accounting.g5.e2e@school.local',
    password: 'E2ePass123!',
    fullName: 'Accounting G5',
    role: 'ACCOUNTING',
  };
  const ops: SeedUser = {
    email: 'ops.g5.e2e@school.local',
    password: 'E2ePass123!',
    fullName: 'Ops G5',
    role: 'OPS',
  };
  const parentA: SeedUser = {
    email: 'parentA.g5.e2e@school.local',
    password: 'E2ePass123!',
    fullName: 'Parent A G5',
    role: 'PARENT',
  };
  const parentB: SeedUser = {
    email: 'parentB.g5.e2e@school.local',
    password: 'E2ePass123!',
    fullName: 'Parent B G5',
    role: 'PARENT',
  };

  let directorSession: AuthSession;
  let accountingSession: AuthSession;
  let opsSession: AuthSession;

  let directorId: string;
  let accountingId: string;
  let parentAId: string;
  let parentBId: string;

  // ── Setup helpers ──────────────────────────────────────────────────────

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
    return request(app.getHttpServer()).get(path).set('Cookie', sess.cookieHeader);
  }

  // Seed wallet với balance cho userId
  async function seedWallet(userId: string, balance: number): Promise<any> {
    return walletModel.findOneAndUpdate(
      { userId: new Types.ObjectId(userId) },
      {
        $set: {
          userId: new Types.ObjectId(userId),
          balance,
          totalTopUp: balance,
          totalDeducted: 0,
          totalRefunded: 0,
          status: 'ACTIVE',
        },
      },
      { upsert: true, new: true },
    );
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────

  beforeAll(async () => {
    process.env.REDIS_ENABLED = 'false';
    replSet = await MongoMemoryReplSet.create({
      replSet: { count: 1, storageEngine: 'wiredTiger' },
    });
    process.env.MONGODB_URI = replSet.getUri('school-mgmt-g5-e2e');

    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.use(require('express').json({ limit: '10mb' }));
    app.use(require('express').urlencoded({ limit: '10mb', extended: true }));
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();

    userModel = moduleRef.get<Model<any>>(getModelToken('User'));
    walletModel = moduleRef.get<Model<any>>(getModelToken('Wallet'));
    ledgerModel = moduleRef.get<Model<any>>(getModelToken('LedgerEntry'));
    invoiceModel = moduleRef.get<Model<any>>(getModelToken('Invoice'));
    studentModel = moduleRef.get<Model<any>>(getModelToken('Student'));
    classModel = moduleRef.get<Model<any>>(getModelToken('Classroom'));

    // Seed users
    const dirUser = await upsertUser(director);
    const accUser = await upsertUser(accounting);
    await upsertUser(ops);
    const pA = await upsertUser(parentA);
    const pB = await upsertUser(parentB);

    directorId = String(dirUser._id);
    accountingId = String(accUser._id);
    parentAId = String(pA._id);
    parentBId = String(pB._id);

    // Login sessions
    directorSession = await loginAndGetSession(director.email, director.password);
    accountingSession = await loginAndGetSession(accounting.email, accounting.password);
    opsSession = await loginAndGetSession(ops.email, ops.password);
  }, 120_000);

  afterAll(async () => {
    await closeE2eResources({ app, moduleRef, mongoReplSet: replSet });
  });

  // ══════════════════════════════════════════════════════════════════════
  //  5.1  Chuyển tiền giữa ví (Wallet Transfer)
  // ══════════════════════════════════════════════════════════════════════

  describe('5.1 Wallet Transfer — PH_A → PH_B', () => {
    beforeEach(async () => {
      // Reset balances for each test
      await seedWallet(parentAId, 500_000);
      await seedWallet(parentBId, 200_000);
    });

    it('ACCOUNTING chuyển 300k từ PH_A sang PH_B thành công', async () => {
      const res = await authedPost(accountingSession, '/wallets/transfer').send({
        fromUserId: parentAId,
        toUserId: parentBId,
        amount: 300_000,
        description: 'Chuyển cho em G5-51',
      });

      expect([200, 201]).toContain(res.status);

      // Kiểm tra balance sau transfer
      const walletA = await walletModel.findOne({ userId: new Types.ObjectId(parentAId) }).lean() as any;
      const walletB = await walletModel.findOne({ userId: new Types.ObjectId(parentBId) }).lean() as any;
      expect(walletA.balance).toBe(200_000);
      expect(walletB.balance).toBe(500_000);

      // Kiểm tra ledger entries
      const transferOut = await ledgerModel.findOne({
        userId: new Types.ObjectId(parentAId),
        type: 'TRANSFER_OUT',
      }).lean() as any;
      expect(transferOut).toBeTruthy();
      expect(Number(transferOut.amount)).toBe(300_000);

      const transferIn = await ledgerModel.findOne({
        userId: new Types.ObjectId(parentBId),
        type: 'TRANSFER_IN',
      }).lean() as any;
      expect(transferIn).toBeTruthy();
      expect(Number(transferIn.amount)).toBe(300_000);
    });

    it('DIRECTOR chuyển tiền → thành công (DIRECTOR = ACCOUNTING privileges)', async () => {
      const res = await authedPost(directorSession, '/wallets/transfer').send({
        fromUserId: parentAId,
        toUserId: parentBId,
        amount: 100_000,
        description: 'Director transfer test G5-51',
      });

      expect([200, 201]).toContain(res.status);
    });

    it('OPS cố chuyển tiền → 403 Forbidden', async () => {
      const res = await authedPost(opsSession, '/wallets/transfer').send({
        fromUserId: parentAId,
        toUserId: parentBId,
        amount: 100_000,
      });
      expect(res.status).toBe(403);
    });

    it('Chuyển vượt số dư → 400 Insufficient balance', async () => {
      const res = await authedPost(accountingSession, '/wallets/transfer').send({
        fromUserId: parentAId,
        toUserId: parentBId,
        amount: 999_999_999,
        description: 'Overflow test G5-51',
      });
      expect(res.status).toBe(400);
    });

    it('Chuyển cho chính mình (self-transfer) → 400', async () => {
      const res = await authedPost(accountingSession, '/wallets/transfer').send({
        fromUserId: parentAId,
        toUserId: parentAId,
        amount: 100_000,
        description: 'Self transfer G5-51',
      });
      expect(res.status).toBe(400);
    });

    it('amount < 1000 (quá nhỏ) → 400 validation error', async () => {
      const res = await authedPost(accountingSession, '/wallets/transfer').send({
        fromUserId: parentAId,
        toUserId: parentBId,
        amount: 500,
        description: 'Small amount G5-51',
      });
      expect(res.status).toBe(400);
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  //  5.2  Kế toán điều chỉnh số dư ví (Manual Adjustment)
  // ══════════════════════════════════════════════════════════════════════

  describe('5.2 Manual Adjustment — ACCOUNTING adjusts balance', () => {
    beforeEach(async () => {
      await seedWallet(parentAId, 500_000);
    });

    it('ACCOUNTING cộng 200k vào ví PH_A → ADJUSTMENT ledger, balance tăng', async () => {
      const res = await authedPost(accountingSession, '/wallets/adjust').send({
        userId: parentAId,
        amount: 200_000,
        direction: 'ADD',
        description: 'Đền bù lỗi trừ sai G5-52',
        reason: 'Điều chỉnh số dư theo nghiệp vụ G5-52',
      });

      expect([200, 201]).toContain(res.status);

      // Kiểm tra balance tăng
      const wallet = await walletModel.findOne({ userId: new Types.ObjectId(parentAId) }).lean() as any;
      expect(wallet.balance).toBe(700_000);

      // Kiểm tra ADJUSTMENT ledger entry
      const adjustment = await ledgerModel.findOne({
        userId: new Types.ObjectId(parentAId),
        type: 'ADJUSTMENT',
      }).sort({ createdAt: -1 }).lean() as any;
      expect(adjustment).toBeTruthy();
      expect(Number(adjustment.amount)).toBe(200_000);
    });

    it('ACCOUNTING trừ 200k khỏi ví PH_A (direction=SUBTRACT) → balance giảm', async () => {
      const res = await authedPost(accountingSession, '/wallets/adjust').send({
        userId: parentAId,
        amount: 200_000,
        direction: 'SUBTRACT',
        description: 'Thu hồi tiền phát nhầm G5-52',
        reason: 'Điều chỉnh số dư theo nghiệp vụ G5-52',
      });

      expect([200, 201]).toContain(res.status);

      const wallet = await walletModel.findOne({ userId: new Types.ObjectId(parentAId) }).lean() as any;
      expect(wallet.balance).toBe(300_000);
    });

    it('Adjust SUBTRACT vượt số dư → ví có thể âm (xem debt policy)', async () => {
      const res = await authedPost(accountingSession, '/wallets/adjust').send({
        userId: parentAId,
        amount: 600_000,
        direction: 'SUBTRACT',
        description: 'Adjust âm G5-52',
      });

      // Tùy policy: có thể 200 (cho phép âm) hoặc 400 (chặn)
      expect([200, 201, 400]).toContain(res.status);
    });

    it('description trống → 400 (reason bắt buộc)', async () => {
      const res = await authedPost(accountingSession, '/wallets/adjust').send({
        userId: parentAId,
        amount: 100_000,
        direction: 'ADD',
        description: '',
      });
      expect(res.status).toBe(400);
    });

    it('OPS cố adjust → 403 Forbidden (chỉ ACCOUNTING/DIRECTOR)', async () => {
      const res = await authedPost(opsSession, '/wallets/adjust').send({
        userId: parentAId,
        amount: 100_000,
        direction: 'ADD',
        description: 'OPS trái phép G5-52',
      });
      expect(res.status).toBe(403);
    });

    it('DIRECTOR adjust thành công (same privileges as ACCOUNTING)', async () => {
      const res = await authedPost(directorSession, '/wallets/adjust').send({
        userId: parentAId,
        amount: 50_000,
        direction: 'ADD',
        description: 'Director adjust G5-52',
        reason: 'Director điều chỉnh số dư theo nghiệp vụ G5-52',
      });
      expect([200, 201]).toContain(res.status);
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  //  5.3  Đối soát ngân hàng lệch (Bank Reconciliation Mismatch)
  //       Không có /reconciliation route → dùng POST /invoices/:id/cancel
  //       Hủy invoice đã APPROVED → ADJUSTMENT âm, ví giảm
  // ══════════════════════════════════════════════════════════════════════

  describe('5.3 Bank Reconciliation Mismatch — Cancel Approved Invoice (ADJUSTMENT reversal)', () => {
    it('Hủy invoice đã APPROVED → ADJUSTMENT entry âm, balance ví giảm tương ứng', async () => {
      const suffix = `53-${Date.now()}`;
      const invoiceAmount = 2_000_000;

      // Seed student + class
      const student = await studentModel.create({
        studentCode: `G5-STU-${suffix}`,
        fullName: `Student G5 ${suffix}`,
        age: 10,
        parentUserId: new Types.ObjectId(parentAId),
        parentName: parentA.fullName,
        parentPhone: `090${suffix.slice(-7).padStart(7, '0')}`,
        faceImage: 'seed-face.png',
        approvalStatus: 'APPROVED',
      });
      const cls = await classModel.create({
        name: `Lop G5 ${suffix}`,
        code: `G5-CLS-${suffix}`,
        teacher: new Types.ObjectId(directorId),
        students: [student._id],
        classMode: 'ONLINE',
        baseDuration: 60,
        sessionDuration: 60,
        pricePerSession: 200_000,
        teacherPayPerSession: 100_000,
        status: 'ACTIVE',
      });

      // Seed invoice APPROVED + wallet đã được top-up
      const invoice = await invoiceModel.create({
        invoiceNumber: `G5-INV-${suffix}`,
        invoiceType: 'TUITION',
        studentId: student._id,
        classId: cls._id,
        sessions: 10,
        sessionsRemaining: 10,
        pricePerSession: 200_000,
        amount: invoiceAmount,
        paymentDate: new Date(),
        status: 'APPROVED',
        walletTopUpDone: true,
        createdBy: new Types.ObjectId(accountingId),
      });

      // Seed ví PH đã có 2tr cùng TOP_UP ledger gốc để rollback bám đúng contract hiện tại
      const wallet = await seedWallet(parentAId, invoiceAmount);
      await ledgerModel.create({
        walletId: wallet._id,
        userId: new Types.ObjectId(parentAId),
        type: 'TOP_UP',
        status: 'APPROVED',
        amount: invoiceAmount,
        balanceBefore: 0,
        balanceAfter: invoiceAmount,
        description: `Seed invoice top-up ${invoice.invoiceNumber}`,
        studentId: student._id,
        classId: cls._id,
        invoiceId: invoice._id,
        paymentMethod: 'SYSTEM',
        approvedBy: new Types.ObjectId(accountingId),
        approvedAt: new Date(),
        createdBy: new Types.ObjectId(accountingId),
      });

      const invoiceId = String(invoice._id);

      // Hủy hóa đơn (Bank Reconciliation Mismatch flow)
      const cancelRes = await authedPost(accountingSession, `/invoices/${invoiceId}/cancel`)
        .send({ reason: 'Bank statement không khớp G5-53' });

      expect([200, 201]).toContain(cancelRes.status);

      // Invoice đã bị hủy
      const updatedInvoice = await invoiceModel.findById(invoiceId).lean() as any;
      expect(updatedInvoice.status).toBe('CANCELLED');

      // Ví PH phải giảm (ADJUSTMENT âm tạo ra)
      const walletAfterCancel = await walletModel.findOne({ userId: new Types.ObjectId(parentAId) }).lean() as any;
      // Balance ban đầu 2tr, sau khi hủy invoice 2tr → rollback về 0
      expect(walletAfterCancel.balance).toBe(0);

      // Phải có ADJUSTMENT ledger entry
      const adjustmentEntry = await ledgerModel.findOne({
        type: 'ADJUSTMENT',
        invoiceId: new Types.ObjectId(invoiceId),
      }).lean() as any;
      expect(adjustmentEntry).toBeTruthy();
      expect(Number(adjustmentEntry.amount)).toBe(invoiceAmount);
      expect(adjustmentEntry.adjustmentType).toBe('INVOICE_CANCEL_ROLLBACK');
    });

    it('Cancel invoice PENDING (chưa approve) → chỉ đổi status, KHÔNG tạo ADJUSTMENT', async () => {
      const suffix = `53b-${Date.now()}`;

      const student2 = await studentModel.create({
        studentCode: `G5-STU2-${suffix}`,
        fullName: `Student G5 2 ${suffix}`,
        age: 11,
        parentUserId: new Types.ObjectId(parentBId),
        parentName: parentB.fullName,
        parentPhone: `091${suffix.slice(-7).padStart(7, '0')}`,
        faceImage: 'seed-face.png',
        approvalStatus: 'APPROVED',
      });
      const cls2 = await classModel.create({
        name: `Lop G5 2 ${suffix}`,
        code: `G5-CLS2-${suffix}`,
        teacher: new Types.ObjectId(directorId),
        students: [student2._id],
        classMode: 'ONLINE',
        baseDuration: 60,
        sessionDuration: 60,
        pricePerSession: 200_000,
        teacherPayPerSession: 100_000,
        status: 'ACTIVE',
      });

      // Invoice PENDING (chưa approve - chưa top-up ví)
      const pendingInvoice = await invoiceModel.create({
        invoiceNumber: `G5-INVP-${suffix}`,
        invoiceType: 'TUITION',
        studentId: student2._id,
        classId: cls2._id,
        sessions: 5,
        sessionsRemaining: 5,
        pricePerSession: 200_000,
        amount: 1_000_000,
        paymentDate: new Date(),
        status: 'PENDING',
        walletTopUpDone: false,
        createdBy: new Types.ObjectId(accountingId),
      });

      const pendingId = String(pendingInvoice._id);
      const ledgerCountBefore = await ledgerModel.countDocuments({
        userId: new Types.ObjectId(parentBId),
      });

      const cancelRes = await authedPost(accountingSession, `/invoices/${pendingId}/cancel`)
        .send({ reason: 'Test cancel pending G5-53b' });

      // Có thể 200 hoặc 400 tùy policy; nếu 200, không được có thêm ledger entry
      if (cancelRes.status === 200 || cancelRes.status === 201) {
        const updatedPending = await invoiceModel.findById(pendingId).lean() as any;
        expect(updatedPending.status).toBe('CANCELLED');

        const ledgerCountAfter = await ledgerModel.countDocuments({
          userId: new Types.ObjectId(parentBId),
        });
        // Không tạo thêm ADJUSTMENT entry vì ví chưa được nạp
        expect(ledgerCountAfter).toBe(ledgerCountBefore);
      } else {
        // Policy không cho hủy PENDING — cũng chấp nhận
        expect([400, 422]).toContain(cancelRes.status);
      }
    });

    it('OPS cố hủy invoice → 403 (chỉ DIRECTOR/ACCOUNTING)', async () => {
      // Tạo invoice dummy
      const suffix = `53c-${Date.now()}`;
      const inv = await invoiceModel.create({
        invoiceNumber: `G5-INVC-${suffix}`,
        invoiceType: 'TUITION',
        studentId: new Types.ObjectId(directorId),
        classId: new Types.ObjectId(directorId),
        sessions: 1,
        sessionsRemaining: 1,
        pricePerSession: 100_000,
        amount: 100_000,
        paymentDate: new Date(),
        status: 'APPROVED',
        walletTopUpDone: false,
        createdBy: new Types.ObjectId(directorId),
      });

      const cancelRes = await authedPost(opsSession, `/invoices/${String(inv._id)}/cancel`)
        .send({ reason: 'OPS trái phép G5-53c' });

      expect(cancelRes.status).toBe(403);
    });
  });
});
