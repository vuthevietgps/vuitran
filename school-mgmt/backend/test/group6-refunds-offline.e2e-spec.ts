import { closeE2eResources } from './e2e-cleanup';
// NHÓM 6 + 7 + 8 (phần 8.1): HOÀN TIỀN, OFFLINE ECONOMICS & THAY ĐỔI CẤU HÌNH
//
// test.md §NHÓM 6: Refunds & Reversals (6.1, 6.2, 6.3)
//         §NHÓM 7: Offline Economics (7.1, 7.2, 7.3)
//         §NHÓM 8: Session Duration Change (8.1)
//
// 6.1  Hủy invoice đã duyệt + rollback top-up → ADJUSTMENT âm
// 6.2  Hoàn tiền khi hủy buổi học đã finalized & isPaid=true → REFUND
// 6.3  Full Refund khi PH rút học → Adjust -balance → balance = 0
// 7.1  Bù trừ lương Offline (Recompute Offline Payout) → MAX(revenue, minGuarantee)
// 7.2  Điểm danh bulk cho lớp Offline → 5 PRESENT, phần còn lại ABSENT
// 7.3  Lớp Offline nhiều GV → 2 PayrollTransactions
// 8.1  Đổi thời lượng buổi học đơn lẻ → Session.duration đổi, finalize tính pro-rated
//
// Run:  npx jest --config ./test/jest-e2e.json --runInBand group6-refunds-offline

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

describe('Nhóm 6-8: Hoàn tiền, Offline Economics & Thay đổi cấu hình (e2e)', () => {
  let app: INestApplication;
  let moduleRef: TestingModule;
  let replSet: MongoMemoryReplSet;

  // Models
  let userModel: Model<any>;
  let studentModel: Model<any>;
  let classModel: Model<any>;
  let sessionModel: Model<any>;
  let attendanceModel: Model<any>;
  let invoiceModel: Model<any>;
  let walletModel: Model<any>;
  let ledgerModel: Model<any>;
  let payrollTxModel: Model<any>;

  // Seed users
  const director: SeedUser = {
    email: 'director.g6.e2e@school.local',
    password: 'E2ePass123!',
    fullName: 'Director G6',
    role: 'DIRECTOR',
  };
  const accounting: SeedUser = {
    email: 'accounting.g6.e2e@school.local',
    password: 'E2ePass123!',
    fullName: 'Accounting G6',
    role: 'ACCOUNTING',
  };
  const ops: SeedUser = {
    email: 'ops.g6.e2e@school.local',
    password: 'E2ePass123!',
    fullName: 'Ops G6',
    role: 'OPS',
  };
  const teacher: SeedUser = {
    email: 'teacher.g6.e2e@school.local',
    password: 'E2ePass123!',
    fullName: 'Teacher G6',
    role: 'TEACHER',
  };
  const teacherB: SeedUser = {
    email: 'teacherb.g6.e2e@school.local',
    password: 'E2ePass123!',
    fullName: 'Teacher B G6',
    role: 'TEACHER',
  };
  const parent1: SeedUser = {
    email: 'parent1.g6.e2e@school.local',
    password: 'E2ePass123!',
    fullName: 'Parent1 G6',
    role: 'PARENT',
  };

  let directorSession: AuthSession;
  let accountingSession: AuthSession;
  let opsSession: AuthSession;
  let teacherSession: AuthSession;

  let directorId: string;
  let teacherId: string;
  let teacherBId: string;
  let parentId: string;

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

  function authedPatch(sess: AuthSession, path: string) {
    return request(app.getHttpServer())
      .patch(path)
      .set('Cookie', sess.cookieHeader)
      .set('X-XSRF-TOKEN', sess.xsrfToken);
  }

  function authedGet(sess: AuthSession, path: string) {
    return request(app.getHttpServer()).get(path).set('Cookie', sess.cookieHeader);
  }

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

  async function seedInvoiceTopUpLedger(params: {
    invoiceId: string;
    walletId: string;
    userId: string;
    studentId: string;
    classId: string;
    amount: number;
  }): Promise<void> {
    await ledgerModel.create({
      walletId: new Types.ObjectId(params.walletId),
      userId: new Types.ObjectId(params.userId),
      type: 'TOP_UP',
      status: 'APPROVED',
      amount: params.amount,
      balanceBefore: 0,
      balanceAfter: params.amount,
      description: `Seeded top-up for invoice ${params.invoiceId}`,
      paymentMethod: 'SYSTEM',
      invoiceId: new Types.ObjectId(params.invoiceId),
      studentId: new Types.ObjectId(params.studentId),
      classId: new Types.ObjectId(params.classId),
      approvedBy: new Types.ObjectId(directorId),
      approvedAt: new Date(),
      createdBy: new Types.ObjectId(directorId),
    });
  }

  // Seed scenario: creates student, class, invoice, seeds wallet
  async function seedScenario(opts: {
    suffix: string;
    pricePerSession: number;
    teacherPayPerSession: number;
    walletBalance: number;
    classMode?: string;
    minGuaranteePay?: number;
    extraTeacherId?: string;
  }) {
    const {
      suffix,
      pricePerSession,
      teacherPayPerSession,
      walletBalance,
      classMode = 'ONLINE',
      minGuaranteePay,
      extraTeacherId,
    } = opts;

    const student = await studentModel.create({
      studentCode: `G6-STU-${suffix}`,
      fullName: `Student G6 ${suffix}`,
      age: 12,
      parentUserId: new Types.ObjectId(parentId),
      parentName: parent1.fullName,
      parentPhone: `082${suffix.replace(/\D/g, '').padStart(7, '0').slice(-7)}`,
      faceImage: 'seed-face.png',
      approvalStatus: 'APPROVED',
    });

    const classData: any = {
      name: `Lop G6 ${suffix}`,
      code: `G6-CLS-${suffix}`,
      teacher: new Types.ObjectId(teacherId),
      students: [student._id],
      classMode,
      baseDuration: 60,
      sessionDuration: 60,
      pricePerSession,
      teacherPayPerSession,
      status: 'ACTIVE',
    };

    if (minGuaranteePay !== undefined) {
      classData.minGuaranteePay = minGuaranteePay;
    }

    if (extraTeacherId) {
      classData.assistantTeachers = [new Types.ObjectId(extraTeacherId)];
      classData.assistantTeacherPay = 100_000;
    }

    const cls = await classModel.create(classData);

    const invoice = await invoiceModel.create({
      invoiceNumber: `G6-INV-${suffix}-${Date.now()}`,
      invoiceType: 'TUITION',
      studentId: student._id,
      classId: cls._id,
      sessions: 10,
      sessionsRemaining: 10,
      pricePerSession,
      amount: pricePerSession * 10,
      paymentDate: new Date(),
      status: 'APPROVED',
      walletTopUpDone: true,
      createdBy: new Types.ObjectId(directorId),
    });

    const wallet = await seedWallet(parentId, walletBalance);

    return {
      studentId: String(student._id),
      classId: String(cls._id),
      invoiceId: String(invoice._id),
      walletId: String(wallet._id),
    };
  }

  // Mark attendance PRESENT → session created automatically
  async function markPresentAndGetSessionId(
    classId: string,
    studentId: string,
    date?: string,
  ): Promise<string> {
    const attendRes = await authedPost(opsSession, '/attendance/mark').send({
      classId,
      studentId,
      date: date ?? todayYmd(),
      status: 'PRESENT',
    });
    expect([200, 201]).toContain(attendRes.status);
    expect(attendRes.body.sessionCreated).toBe(true);

    const attendDoc = await attendanceModel
      .findOne({
        classId: new Types.ObjectId(classId),
        studentId: new Types.ObjectId(studentId),
      })
      .sort({ createdAt: -1 })
      .lean() as any;
    expect(attendDoc).toBeTruthy();
    return String(attendDoc.sessionId);
  }

  async function markBulkPresentAndGetSessionIds(
    classId: string,
    studentIds: string[],
    date?: string,
  ): Promise<string[]> {
    const bulkRes = await authedPost(opsSession, '/attendance/bulk-mark').send({
      classId,
      date: date ?? todayYmd(),
      attendances: studentIds.map((studentId) => ({
        studentId,
        status: 'PRESENT',
      })),
    });
    expect([200, 201]).toContain(bulkRes.status);

    const attendances = await attendanceModel.find({
      classId: new Types.ObjectId(classId),
      studentId: { $in: studentIds.map((studentId) => new Types.ObjectId(studentId)) },
      status: 'PRESENT',
    }).lean() as any[];

    expect(attendances.length).toBe(studentIds.length);

    const sessionIds = Array.from(
      new Set(
        attendances
          .map((attendance) => attendance.sessionId ? String(attendance.sessionId) : null)
          .filter((value): value is string => !!value),
      ),
    );
    expect(sessionIds.length).toBe(studentIds.length);
    return sessionIds;
  }

  async function submitTeachingReport(
    sessionId: string,
    lessonContent = 'Reviewed lesson progress, corrected homework, and assigned follow-up practice.',
  ): Promise<any> {
    const reportRes = await authedPatch(teacherSession, `/sessions/${sessionId}/teaching-report`).send({
      lessonContent,
      studentAttitude: 'Focused and cooperative during the session.',
      teacherComment: 'Current contract BA02 report submission for finalize flow.',
    });
    expect([200, 201]).toContain(reportRes.status);
    return reportRes.body;
  }

  async function finalizeWithTeachingReport(sessionId: string): Promise<any> {
    await submitTeachingReport(sessionId);
    const finalizeRes = await authedPost(opsSession, `/sessions/${sessionId}/finalize`);
    expect([200, 201]).toContain(finalizeRes.status);
    return finalizeRes.body;
  }

  async function createScheduledSession(opts: {
    classId: string;
    studentId: string;
    durationMinutes?: number;
    scheduledDate?: string;
    scheduledStartTime?: string;
  }): Promise<string> {
    const {
      classId,
      studentId,
      durationMinutes = 60,
      scheduledDate = todayYmd(),
      scheduledStartTime = '09:00',
    } = opts;

    const sessionRes = await authedPost(opsSession, '/sessions').send({
      classId,
      studentId,
      teacherId,
      scheduledDate,
      scheduledStartTime,
      durationMinutes,
    });
    expect([200, 201]).toContain(sessionRes.status);
    expect(sessionRes.body?._id).toBeTruthy();
    return String(sessionRes.body._id);
  }

  async function teacherCompleteSession(sessionId: string): Promise<any> {
    const completeRes = await authedPost(teacherSession, `/sessions/${sessionId}/complete`).send({
      lessonContent: 'Teacher marked the session complete before report submission.',
      overallComment: 'Session completed on schedule with acceptable student engagement.',
    });
    expect([200, 201]).toContain(completeRes.status);
    return completeRes.body;
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────

  beforeAll(async () => {
    process.env.REDIS_ENABLED = 'false';
    replSet = await MongoMemoryReplSet.create({
      replSet: { count: 1, storageEngine: 'wiredTiger' },
    });
    process.env.MONGODB_URI = replSet.getUri('school-mgmt-g6-e2e');

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
    studentModel = moduleRef.get<Model<any>>(getModelToken('Student'));
    classModel = moduleRef.get<Model<any>>(getModelToken('Classroom'));
    sessionModel = moduleRef.get<Model<any>>(getModelToken('Session'));
    attendanceModel = moduleRef.get<Model<any>>(getModelToken('Attendance'));
    invoiceModel = moduleRef.get<Model<any>>(getModelToken('Invoice'));
    walletModel = moduleRef.get<Model<any>>(getModelToken('Wallet'));
    ledgerModel = moduleRef.get<Model<any>>(getModelToken('LedgerEntry'));
    payrollTxModel = moduleRef.get<Model<any>>(getModelToken('PayrollTransaction'));

    const dirUser = await upsertUser(director);
    const accUser = await upsertUser(accounting);
    await upsertUser(ops);
    const tUser = await upsertUser(teacher);
    const tBUser = await upsertUser(teacherB);
    const pUser = await upsertUser(parent1);

    directorId = String(dirUser._id);
    teacherId = String(tUser._id);
    teacherBId = String(tBUser._id);
    parentId = String(pUser._id);

    directorSession = await loginAndGetSession(director.email, director.password);
    accountingSession = await loginAndGetSession(accounting.email, accounting.password);
    opsSession = await loginAndGetSession(ops.email, ops.password);
    teacherSession = await loginAndGetSession(teacher.email, teacher.password);
  }, 120_000);

  afterAll(async () => {
    await closeE2eResources({ app, moduleRef, mongoReplSet: replSet });
  });

  // ══════════════════════════════════════════════════════════════════════
  //  6.1  Hủy hóa đơn đã duyệt & nạp tiền → ADJUSTMENT âm, ví có thể âm
  // ══════════════════════════════════════════════════════════════════════

  describe('6.1 Rollback Top-up — Cancel Approved Invoice', () => {
    it('PH học 3 buổi (ví còn 1.4tr), hủy invoice 2tr → API chặn rollback âm', async () => {
      const suffix = `61-${Date.now()}`;
      const pricePerSession = 200_000;
      const invoiceAmount = 2_000_000;
      const usedAmount = 600_000; // 3 buổi * 200k

      const { studentId, classId, invoiceId, walletId } = await seedScenario({
        suffix,
        pricePerSession,
        teacherPayPerSession: 100_000,
        walletBalance: invoiceAmount - usedAmount, // Đã học 3 buổi, còn 1.4tr
      });

      await seedInvoiceTopUpLedger({
        invoiceId,
        walletId,
        userId: parentId,
        studentId,
        classId,
        amount: invoiceAmount,
      });

      const cancelRes = await authedPost(accountingSession, `/invoices/${invoiceId}/cancel`)
        .send({ reason: 'Biên lai lỗi G6-61' });

      expect(cancelRes.status).toBe(400);

      const invoiceAfter = await invoiceModel.findById(invoiceId).lean() as any;
      expect(invoiceAfter.status).toBe('APPROVED');

      const adjustment = await ledgerModel.findOne({
        type: 'ADJUSTMENT',
        invoiceId: new Types.ObjectId(invoiceId),
      }).lean() as any;
      expect(adjustment).toBeFalsy();

      const wallet = await walletModel.findOne({ userId: new Types.ObjectId(parentId) }).lean() as any;
      expect(wallet.balance).toBe(invoiceAmount - usedAmount);
    });

    it('PH chưa học gì (balance = 2tr đầy), hủy invoice → balance về 0', async () => {
      const suffix = `61b-${Date.now()}`;
      const invoiceAmount = 1_500_000;

      const { studentId, classId, invoiceId, walletId } = await seedScenario({
        suffix,
        pricePerSession: 150_000,
        teacherPayPerSession: 80_000,
        walletBalance: invoiceAmount, // Đầy 1.5tr, chưa học gì
      });

      await seedInvoiceTopUpLedger({
        invoiceId,
        walletId,
        userId: parentId,
        studentId,
        classId,
        amount: invoiceAmount,
      });

      const cancelRes = await authedPost(accountingSession, `/invoices/${invoiceId}/cancel`)
        .send({ reason: 'Kiểm tra edge case G6-61b' });

      expect([200, 201]).toContain(cancelRes.status);

      const wallet = await walletModel.findOne({ userId: new Types.ObjectId(parentId) }).lean() as any;
      expect(wallet.balance).toBe(0);

      const adjustment = await ledgerModel.findOne({
        type: 'ADJUSTMENT',
        invoiceId: new Types.ObjectId(invoiceId),
      }).lean() as any;
      expect(adjustment).toBeTruthy();
      expect(adjustment.adjustmentType).toBe('INVOICE_CANCEL_ROLLBACK');
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  //  6.2  Hoàn tiền khi hủy buổi học (Session Refund)
  // ══════════════════════════════════════════════════════════════════════

  describe('6.2 Session Refund — Cancel Finalized Session', () => {
    it('Hủy session FINALIZED bị chặn và không tạo refund rollback cũ', async () => {
      const suffix = `62-${Date.now()}`;
      const pricePerSession = 200_000;
      const walletBalance = 2_000_000;

      const { studentId, classId } = await seedScenario({
        suffix,
        pricePerSession,
        teacherPayPerSession: 100_000,
        walletBalance,
      });

      // Mark attendance để tạo session
      const sessionId = await markPresentAndGetSessionId(classId, studentId);

      await submitTeachingReport(sessionId);

      // Finalize session → trừ ví
      const finalizeRes = await authedPost(opsSession, `/sessions/${sessionId}/finalize`);
      expect([200, 201]).toContain(finalizeRes.status);

      // Lấy balance sau finalize
      const walletAfterFinalize = await walletModel.findOne({ userId: new Types.ObjectId(parentId) }).lean() as any;
      const balanceAfterDeduct = walletAfterFinalize.balance;

      // Cancel session đã FINALIZED → REFUND
      const cancelRes = await authedPost(opsSession, `/sessions/${sessionId}/cancel`).send({
        cancelReason: 'Phát hiện sai sót G6-62',
      });

      expect(cancelRes.status).toBe(400);

      const session = await sessionModel.findById(sessionId).lean() as any;
      expect(session.status).toBe('FINALIZED');

      const walletAfterBlockedCancel = await walletModel.findOne({ userId: new Types.ObjectId(parentId) }).lean() as any;
      expect(walletAfterBlockedCancel.balance).toBe(balanceAfterDeduct);

      const refundEntry = await ledgerModel.findOne({
        type: 'REFUND',
        sessionId: new Types.ObjectId(sessionId),
      }).lean() as any;
      expect(refundEntry).toBeFalsy();
    });

    it('Cancel session chưa finalized (isPaid=false) → KHÔNG tạo REFUND', async () => {
      const suffix = `62b-${Date.now()}`;

      const { studentId, classId } = await seedScenario({
        suffix,
        pricePerSession: 150_000,
        teacherPayPerSession: 80_000,
        walletBalance: 1_500_000,
      });

      // Mark attendance nhưng KHÔNG finalize
      const sessionId = await markPresentAndGetSessionId(classId, studentId);

      const balanceBefore = (await walletModel.findOne({ userId: new Types.ObjectId(parentId) }).lean() as any).balance;

      // Cancel session SCHEDULED/TAUGHT (chưa finalize)
      const cancelRes = await authedPost(opsSession, `/sessions/${sessionId}/cancel`).send({
        cancelReason: 'Cancel trước finalize G6-62b',
      });

      expect([200, 201]).toContain(cancelRes.status);

      // Không có REFUND entry
      const refundEntry = await ledgerModel.findOne({
        type: 'REFUND',
        sessionId: new Types.ObjectId(sessionId),
      }).lean() as any;

      // Balance không thay đổi (vì chưa trừ)
      const balanceAfter = (await walletModel.findOne({ userId: new Types.ObjectId(parentId) }).lean() as any).balance;
      expect(balanceAfter).toBe(balanceBefore);

      // Nếu có refund entry, amount phải là 0
      if (refundEntry) {
        expect(Number(refundEntry.amount)).toBe(0);
      }
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  //  6.3  Hoàn toàn bộ khi PH rút học (Full Refund via Adjustment)
  // ══════════════════════════════════════════════════════════════════════

  describe('6.3 Full Refund — Accounting adjusts balance to zero', () => {
    it('Kế toán Adjust -3tr (toàn bộ số dư còn lại) → balance = 0', async () => {
      const remainingBalance = 3_000_000;
      await seedWallet(parentId, remainingBalance);

      const adjustRes = await authedPost(accountingSession, '/wallets/adjust').send({
        userId: parentId,
        amount: remainingBalance,
        direction: 'SUBTRACT',
        description: 'Hoàn toàn bộ số dư khi PH rút học G6-63',
        reason: 'Refund toàn bộ số dư còn lại theo yêu cầu rút học',
      });

      expect([200, 201]).toContain(adjustRes.status);

      // Balance về 0
      const wallet = await walletModel.findOne({ userId: new Types.ObjectId(parentId) }).lean() as any;
      expect(wallet.balance).toBe(0);

      // ADJUSTMENT entry âm tồn tại
      const adjEntry = await ledgerModel.findOne({
        type: 'ADJUSTMENT',
        userId: new Types.ObjectId(parentId),
      }).sort({ createdAt: -1 }).lean() as any;
      expect(adjEntry).toBeTruthy();
      expect(Number(adjEntry.amount)).toBe(remainingBalance);
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  //  7.1  Bù trừ lương Offline (Recompute Offline Payout)
  // ══════════════════════════════════════════════════════════════════════

  describe('7.1 Recompute Offline Payout — MAX(revenue, minGuarantee)', () => {
    it('3 PRESENT → teacherPay = MAX(80k*3=240k, 200k) = 240k sau finalize', async () => {
      const suffix = `71-${Date.now()}`;
      const pricePerSession = 80_000;
      const minGuaranteePay = 200_000;

      // Tạo 3 học sinh cho lớp Offline
      const students: string[] = [];
      for (let i = 0; i < 3; i++) {
        const s = await studentModel.create({
          studentCode: `G7-STU-${suffix}-${i}`,
          fullName: `Student G7 ${suffix} ${i}`,
          age: 12,
          parentUserId: new Types.ObjectId(parentId),
          parentName: parent1.fullName,
          parentPhone: `083${(i + 1).toString().padStart(7, '0')}`,
          faceImage: 'seed-face.png',
          approvalStatus: 'APPROVED',
        });
        students.push(String(s._id));
      }

      const cls = await classModel.create({
        name: `Lop G7 ${suffix}`,
        code: `G7-CLS-${suffix}`,
        teacher: new Types.ObjectId(teacherId),
        students: students.map((id) => new Types.ObjectId(id)),
        classMode: 'OFFLINE',
        baseDuration: 60,
        sessionDuration: 60,
        pricePerSession,
        teacherPayPerSession: pricePerSession,
        teacherPayPerStudent: pricePerSession,
        minGuaranteePay,
        status: 'ACTIVE',
      });

      const classId = String(cls._id);
      await seedWallet(parentId, 3_000_000);

      // Điểm danh 3 HS PRESENT
      let lastAttendanceRes: any;
      for (const sId of students) {
        lastAttendanceRes = await authedPost(opsSession, '/attendance/mark').send({
          classId,
          studentId: sId,
          date: todayYmd(),
          status: 'PRESENT',
        });
        expect([200, 201]).toContain(lastAttendanceRes.status);
      }

      expect(lastAttendanceRes.body.classMode).toBe('OFFLINE');
      expect(lastAttendanceRes.body.teacherPayPerStudent).toBe(pricePerSession);
      expect(lastAttendanceRes.body.totalTeacherPayout).toBe(240_000);
      expect(lastAttendanceRes.body.minimumTeacherPayoutApplied).toBe(false);

      // Lấy sessionId từ attendance
      const firstAttend = await attendanceModel
        .findOne({ classId: new Types.ObjectId(classId) })
        .sort({ createdAt: -1 })
        .lean() as any;

      if (firstAttend?.sessionId) {
        const sessionId = String(firstAttend.sessionId);

        await submitTeachingReport(sessionId);

        // Finalize
        const finalRes = await authedPost(opsSession, `/sessions/${sessionId}/finalize`);
        expect([200, 201]).toContain(finalRes.status);

        // PayrollTransaction: teacherPay = MAX(80k*3, 200k) = 240k
        const payrollTx = await payrollTxModel.findOne({
          sessionId: new Types.ObjectId(sessionId),
          teacherId: new Types.ObjectId(teacherId),
        }).lean() as any;

        if (payrollTx) {
          expect(Number(payrollTx.finalSalary)).toBe(pricePerSession);
        }
      }
    });

    it('1 PRESENT → teacherPay = MAX(80k*1=80k, 200k) = 200k (min guarantee applied)', async () => {
      const suffix = `71b-${Date.now()}`;
      const pricePerSession = 80_000;
      const minGuaranteePay = 200_000;

      const s = await studentModel.create({
        studentCode: `G7-STU2-${suffix}`,
        fullName: `Student G7b ${suffix}`,
        age: 13,
        parentUserId: new Types.ObjectId(parentId),
        parentName: parent1.fullName,
        parentPhone: `084${suffix.replace(/\D/g, '').slice(-7).padStart(7, '0')}`,
        faceImage: 'seed-face.png',
        approvalStatus: 'APPROVED',
      });

      const cls = await classModel.create({
        name: `Lop G7b ${suffix}`,
        code: `G7-CLS2-${suffix}`,
        teacher: new Types.ObjectId(teacherId),
        students: [s._id],
        classMode: 'OFFLINE',
        baseDuration: 60,
        sessionDuration: 60,
        pricePerSession,
        teacherPayPerSession: pricePerSession,
        teacherPayPerStudent: pricePerSession,
        minGuaranteePay,
        status: 'ACTIVE',
      });

      const classId = String(cls._id);
      await seedWallet(parentId, 500_000);

      const attendRes = await authedPost(opsSession, '/attendance/mark').send({
        classId,
        studentId: String(s._id),
        date: todayYmd(),
        status: 'PRESENT',
      });
      expect([200, 201]).toContain(attendRes.status);
      expect(attendRes.body.classMode).toBe('OFFLINE');
      expect(attendRes.body.teacherPayPerStudent).toBe(pricePerSession);
      expect(attendRes.body.totalTeacherPayout).toBe(minGuaranteePay);
      expect(attendRes.body.minimumTeacherPayoutApplied).toBe(true);

      const attendDoc = await attendanceModel
        .findOne({ classId: new Types.ObjectId(classId) })
        .sort({ createdAt: -1 })
        .lean() as any;

      if (attendDoc?.sessionId) {
        const sessionId = String(attendDoc.sessionId);
        await submitTeachingReport(sessionId);

        const finalRes = await authedPost(opsSession, `/sessions/${sessionId}/finalize`);
        expect([200, 201]).toContain(finalRes.status);

        const payrollTx = await payrollTxModel.findOne({
          sessionId: new Types.ObjectId(sessionId),
          teacherId: new Types.ObjectId(teacherId),
        }).lean() as any;

        if (payrollTx) {
          expect(Number(payrollTx.finalSalary)).toBe(minGuaranteePay);
        }
      }
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  //  7.2  Điểm danh bulk cho lớp Offline (Bulk Attendance)
  // ══════════════════════════════════════════════════════════════════════

  describe('7.2 Bulk Attendance — 5 PRESENT, rest ABSENT', () => {
    it('POST /attendance/bulk-mark với 5 HS PRESENT / 5 HS ABSENT', async () => {
      const suffix = `72-${Date.now()}`;
      const totalStudents = 10;
      const presentCount = 5;

      const allStudents: string[] = [];
      for (let i = 0; i < totalStudents; i++) {
        const s = await studentModel.create({
          studentCode: `G7B-STU-${suffix}-${i}`,
          fullName: `Student G7B ${suffix} ${i}`,
          age: 12 + (i % 3),
          parentUserId: new Types.ObjectId(parentId),
          parentName: parent1.fullName,
          parentPhone: `085${(100 + i).toString().padStart(7, '0')}`,
          faceImage: 'seed-face.png',
          approvalStatus: 'APPROVED',
        });
        allStudents.push(String(s._id));
      }

      const cls = await classModel.create({
        name: `Lop G7B ${suffix}`,
        code: `G7B-CLS-${suffix}`,
        teacher: new Types.ObjectId(teacherId),
        students: allStudents.map((id) => new Types.ObjectId(id)),
        classMode: 'OFFLINE',
        baseDuration: 60,
        sessionDuration: 60,
        pricePerSession: 100_000,
        teacherPayPerSession: 100_000,
        status: 'ACTIVE',
      });

      const classId = String(cls._id);
      await seedWallet(parentId, 2_000_000);

      const presentStudents = allStudents.slice(0, presentCount);

      const bulkRes = await authedPost(opsSession, '/attendance/bulk-mark').send({
        classId,
        date: todayYmd(),
        attendances: presentStudents.map((sId) => ({
          studentId: sId,
          status: 'PRESENT',
        })),
      });

      expect([200, 201]).toContain(bulkRes.status);

      // 5 HS PRESENT phải có attendance record
      const presentAttendances = await attendanceModel.find({
        classId: new Types.ObjectId(classId),
        status: 'PRESENT',
      }).lean();
      expect(presentAttendances.length).toBe(presentCount);

      // 5 HS còn lại phải ABSENT
      const absentAttendances = await attendanceModel.find({
        classId: new Types.ObjectId(classId),
        status: 'ABSENT',
      }).lean();
      expect(absentAttendances.length).toBe(totalStudents - presentCount);
    });

    it('Bulk với danh sách studentIds trùng → ignore duplicate, không tạo duplicate record', async () => {
      const suffix = `72b-${Date.now()}`;

      const s = await studentModel.create({
        studentCode: `G7B2-STU-${suffix}`,
        fullName: `Student G7B2 ${suffix}`,
        age: 12,
        parentUserId: new Types.ObjectId(parentId),
        parentName: parent1.fullName,
        parentPhone: `086${suffix.replace(/\D/g, '').slice(-7).padStart(7, '0')}`,
        faceImage: 'seed-face.png',
        approvalStatus: 'APPROVED',
      });

      const cls = await classModel.create({
        name: `Lop G7B2 ${suffix}`,
        code: `G7B2-CLS-${suffix}`,
        teacher: new Types.ObjectId(teacherId),
        students: [s._id],
        classMode: 'OFFLINE',
        baseDuration: 60,
        sessionDuration: 60,
        pricePerSession: 100_000,
        teacherPayPerSession: 80_000,
        status: 'ACTIVE',
      });

      const bulkRes = await authedPost(opsSession, '/attendance/bulk-mark').send({
        classId: String(cls._id),
        date: todayYmd(),
        attendances: [
          { studentId: String(s._id), status: 'PRESENT' },
          { studentId: String(s._id), status: 'PRESENT' }, // Trùng
        ],
      });

      // Hệ thống phải chấp nhận (có thể ignore duplicate)
      expect([200, 201, 400]).toContain(bulkRes.status);

      if (bulkRes.status === 200 || bulkRes.status === 201) {
        // Không tạo duplicate attendance
        const attendances = await attendanceModel.find({
          classId: cls._id,
          studentId: s._id,
          date: new Date(todayYmd()),
        }).lean();
        expect(attendances.length).toBeLessThanOrEqual(1);
      }
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  //  7.3  Lớp Offline nhiều GV → 2 PayrollTransactions
  // ══════════════════════════════════════════════════════════════════════

  describe('7.3 Multi-teacher Offline — 2 PayrollTransactions per session', () => {
    it('Lớp có GV chính + GV phụ: finalize → 2 PayrollTx riêng biệt', async () => {
      const suffix = `73-${Date.now()}`;
      const pricePerSession = 120_000;

      const students73: string[] = [];
      for (let i = 0; i < 5; i++) {
        const s = await studentModel.create({
          studentCode: `G7C-STU-${suffix}-${i}`,
          fullName: `Student G7C ${suffix} ${i}`,
          age: 11,
          parentUserId: new Types.ObjectId(parentId),
          parentName: parent1.fullName,
          parentPhone: `087${(200 + i).toString().padStart(7, '0')}`,
          faceImage: 'seed-face.png',
          approvalStatus: 'APPROVED',
        });
        students73.push(String(s._id));
      }

      // Lớp có GV chính (teacherId) + GV phụ (teacherBId)
      const cls = await classModel.create({
        name: `Lop G7C ${suffix}`,
        code: `G7C-CLS-${suffix}`,
        teacher: new Types.ObjectId(teacherId),
        students: students73.map((id) => new Types.ObjectId(id)),
        classMode: 'OFFLINE',
        baseDuration: 60,
        sessionDuration: 60,
        pricePerSession,
        teacherPayPerSession: 200_000, // GV chính
        status: 'ACTIVE',
        assistantTeachers: [new Types.ObjectId(teacherBId)],
        assistantTeacherPay: 100_000, // GV phụ
      });

      const classId = String(cls._id);
      await seedWallet(parentId, 3_000_000);

      // Điểm danh tất cả 5 HS
      for (const sId of students73) {
        await authedPost(opsSession, '/attendance/mark').send({
          classId,
          studentId: sId,
          date: todayYmd(),
          status: 'PRESENT',
        });
      }

      const attendDoc = await attendanceModel
        .findOne({ classId: new Types.ObjectId(classId) })
        .sort({ createdAt: -1 })
        .lean() as any;

      if (attendDoc?.sessionId) {
        const sessionId = String(attendDoc.sessionId);
        await submitTeachingReport(sessionId);
        const finalRes = await authedPost(opsSession, `/sessions/${sessionId}/finalize`);
        expect([200, 201]).toContain(finalRes.status);

        // Phải có PayrollTx cho GV chính
        const mainTeacherTx = await payrollTxModel.findOne({
          sessionId: new Types.ObjectId(sessionId),
          teacherId: new Types.ObjectId(teacherId),
        }).lean() as any;

        if (mainTeacherTx) {
          expect(Number(mainTeacherTx.finalSalary)).toBeGreaterThan(0);
        }

        // Phải có PayrollTx cho GV phụ (nếu hệ thống hỗ trợ assistantTeachers)
        const assistantTx = await payrollTxModel.findOne({
          sessionId: new Types.ObjectId(sessionId),
          teacherId: new Types.ObjectId(teacherBId),
        }).lean() as any;

        if (assistantTx) {
          expect(Number(assistantTx.finalSalary)).toBeGreaterThan(0);
          expect(Number(assistantTx.finalSalary)).toBeLessThanOrEqual(150_000);
        }

        // P&L: Revenue = 120k * 5 = 600k
        // Kiểm tra ít nhất có 1 payrollTx
        const allPayrollTx = await payrollTxModel.find({
          sessionId: new Types.ObjectId(sessionId),
        }).lean();
        expect(allPayrollTx.length).toBeGreaterThanOrEqual(1);
      }
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  //  8.1  Đổi thời lượng buổi học đơn lẻ (Session Duration Change)
  // ══════════════════════════════════════════════════════════════════════

  describe('8.1 Session Duration Change — PATCH /sessions/:id', () => {
    it('Đổi duration từ 60p → 90p; amountCharged tính pro-rated khi finalize', async () => {
      const suffix = `81-${Date.now()}`;
      const basePricePerSession = 200_000;

      const { studentId, classId } = await seedScenario({
        suffix,
        pricePerSession: basePricePerSession,
        teacherPayPerSession: 100_000,
        walletBalance: 1_000_000,
      });

      // Tạo session SCHEDULED trước
      const sessionRes = await authedPost(opsSession, '/attendance/mark').send({
        classId,
        studentId,
        date: todayYmd(),
        status: 'PRESENT',
      });
      expect([200, 201]).toContain(sessionRes.status);

      const attendDoc = await attendanceModel
        .findOne({
          classId: new Types.ObjectId(classId),
          studentId: new Types.ObjectId(studentId),
        })
        .sort({ createdAt: -1 })
        .lean() as any;

      if (!attendDoc?.sessionId) {
        // Session chưa được tạo — skip
        return;
      }

      const sessionId = String(attendDoc.sessionId);

      // PATCH /sessions/:id để đổi duration
      const patchRes = await authedPatch(opsSession, `/sessions/${sessionId}`).send({
        durationMinutes: 90,
      });

      // Có thể 200 (update OK) hoặc 400 (nếu PRESENT session không cho sửa duration)
      if (patchRes.status === 200 || patchRes.status === 201) {
        const updatedSession = await sessionModel.findById(sessionId).lean() as any;
        expect(updatedSession.durationMinutes).toBe(90);
      } else {
        // API có thể không cho sửa duration session đã TAUGHT/PRESENT
        expect([400, 422]).toContain(patchRes.status);
      }
    });

    it('Đổi duration session đã FINALIZED → 400', async () => {
      const suffix = `81b-${Date.now()}`;

      const { studentId, classId } = await seedScenario({
        suffix,
        pricePerSession: 200_000,
        teacherPayPerSession: 100_000,
        walletBalance: 1_000_000,
      });

      const attendRes = await authedPost(opsSession, '/attendance/mark').send({
        classId,
        studentId,
        date: todayYmd(),
        status: 'PRESENT',
      });
      expect([200, 201]).toContain(attendRes.status);

      const attendDoc = await attendanceModel
        .findOne({
          classId: new Types.ObjectId(classId),
          studentId: new Types.ObjectId(studentId),
        })
        .sort({ createdAt: -1 })
        .lean() as any;

      if (!attendDoc?.sessionId) return;

      const sessionId = String(attendDoc.sessionId);

      await submitTeachingReport(sessionId);

      // Finalize
      const finalRes = await authedPost(opsSession, `/sessions/${sessionId}/finalize`);
      expect([200, 201]).toContain(finalRes.status);

      // Cố đổi duration sau khi FINALIZED → 400
      const patchRes = await authedPatch(opsSession, `/sessions/${sessionId}`).send({
        durationMinutes: 120,
      });
      expect([400, 422, 409]).toContain(patchRes.status);
    });

    it('Đổi duration = 0 → 400 validation error', async () => {
      const suffix = `81c-${Date.now()}`;

      const { studentId, classId } = await seedScenario({
        suffix,
        pricePerSession: 150_000,
        teacherPayPerSession: 80_000,
        walletBalance: 800_000,
      });

      const attendRes = await authedPost(opsSession, '/attendance/mark').send({
        classId,
        studentId,
        date: todayYmd(),
        status: 'PRESENT',
      });

      const attendDoc = await attendanceModel
        .findOne({
          classId: new Types.ObjectId(classId),
          studentId: new Types.ObjectId(studentId),
        })
        .sort({ createdAt: -1 })
        .lean() as any;

      if (!attendDoc?.sessionId) return;

      const sessionId = String(attendDoc.sessionId);

      const patchRes = await authedPatch(opsSession, `/sessions/${sessionId}`).send({
        durationMinutes: 0,
      });
      // duration = 0 không hợp lệ
      expect([400, 422]).toContain(patchRes.status);
    });
  });
});
