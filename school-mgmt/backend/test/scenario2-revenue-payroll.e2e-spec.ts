/**
 * KỊCH BẢN E2E SỐ 2: Revenue Consumption & Payroll Generation
 *
 * Mục tiêu: Đảm bảo khi một buổi học diễn ra và hoàn thành, hệ thống:
 *   - Trừ đúng tiền ví phụ huynh (SESSION_DEDUCT)
 *   - Trừ đúng số buổi hóa đơn (sessionsRemaining -1)
 *   - Ghi nhận công nợ lương cho giáo viên (PayrollTransaction PENDING)
 *   - Phản ánh chính xác lên báo cáo P&L (sessionRevenue, teacherCost)
 *
 * API Flow:
 *   Step 1: POST /attendance/mark (OPS)              → Session TEACHER_COMPLETED
 *   Step 2: PATCH /sessions/:id/teaching-report (TEACHER) → PayrollTransaction PENDING
 *   Step 3: POST /sessions/:id/finalize (OPS)         → Wallet deducted, Invoice consumed, P&L updated
 *
 * Edge Cases:
 *   - Race condition double-finalize → second request blocked
 *   - Insufficient wallet balance → soft fail (isPaid=false), session still FINALIZED
 *   - Freeze: cannot edit report when PayrollTransaction is APPROVED
 */

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import * as request from 'supertest';
import * as cookieParser from 'cookie-parser';
import * as bcrypt from 'bcrypt';
import { AppModule } from '../src/app.module';

// ─── Types ───────────────────────────────────────────────────────────────────

type SessionCookies = {
  accessToken: string;
  xsrfToken: string;
  cookieHeader: string;
};

type SeedUser = {
  email: string;
  password: string;
  fullName: string;
  role: 'DIRECTOR' | 'OPS' | 'TEACHER' | 'PARENT';
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function extractCookieValue(
  setCookies: string | string[] | undefined,
  name: string,
): string | null {
  if (!setCookies) return null;
  const rows = Array.isArray(setCookies) ? setCookies : [setCookies];
  if (rows.length === 0) return null;
  const pattern = new RegExp(`(?:^|;\\s*)${name}=([^;]+)`);
  for (const row of rows) {
    const firstPart = String(row).split(';')[0];
    const match = pattern.exec(firstPart);
    if (match?.[1]) return match[1];
  }
  return null;
}

function utcDaysAgo(days: number): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d;
}

function toUtcDate(ymd: string, hhmm: string): Date {
  return new Date(`${ymd}T${hhmm}:00.000Z`);
}

function todayYmd(): string {
  return new Date().toISOString().slice(0, 10);
}

// ─── Suite ───────────────────────────────────────────────────────────────────

describe('Scenario 2: Revenue Consumption & Payroll Generation (e2e)', () => {
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

  // User stubs
  const director: SeedUser = {
    email: 'director.sc2.e2e@school.local',
    password: 'E2ePass123!',
    fullName: 'Director SC2',
    role: 'DIRECTOR',
  };
  const ops: SeedUser = {
    email: 'ops.sc2.e2e@school.local',
    password: 'E2ePass123!',
    fullName: 'Ops SC2',
    role: 'OPS',
  };
  const teacher: SeedUser = {
    email: 'teacher.sc2.e2e@school.local',
    password: 'E2ePass123!',
    fullName: 'Teacher SC2',
    role: 'TEACHER',
  };
  const parent: SeedUser = {
    email: 'parent.sc2.e2e@school.local',
    password: 'E2ePass123!',
    fullName: 'Parent SC2',
    role: 'PARENT',
  };

  // Auth sessions
  let directorSession: SessionCookies;
  let opsSession: SessionCookies;
  let teacherSession: SessionCookies;

  // Seeded IDs
  let teacherId: string;
  let parentId: string;
  let classId: string;
  let studentId: string;
  let invoiceId: string;

  // Captured in test steps
  let mainSessionId: string;

  // ── Setup ───────────────────────────────────────────────────────────────

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

  async function loginAndGetSession(
    email: string,
    password: string,
  ): Promise<SessionCookies> {
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect((res) => {
        expect([200, 201]).toContain(res.status);
      });

    const accessToken = extractCookieValue(
      loginRes.headers['set-cookie'],
      'access_token',
    );
    expect(accessToken).toBeTruthy();

    const meRes = await request(app.getHttpServer())
      .get('/users/me')
      .set('Cookie', `access_token=${accessToken}`)
      .expect(200);

    const xsrfToken = extractCookieValue(
      meRes.headers['set-cookie'],
      'XSRF-TOKEN',
    );
    expect(xsrfToken).toBeTruthy();

    return {
      accessToken: accessToken as string,
      xsrfToken: xsrfToken as string,
      cookieHeader: `access_token=${accessToken}; XSRF-TOKEN=${xsrfToken}`,
    };
  }

  function authGet(req: any, session: SessionCookies) {
    return req.set('Cookie', session.cookieHeader);
  }

  function authWrite(req: any, session: SessionCookies) {
    return req
      .set('Cookie', session.cookieHeader)
      .set('X-XSRF-TOKEN', session.xsrfToken);
  }

  async function submitTeachingReport(
    sessionId: string,
    overrides: Record<string, unknown> = {},
  ) {
    const res = await authWrite(
      request(app.getHttpServer()).patch(`/sessions/${sessionId}/teaching-report`),
      teacherSession,
    ).send({
      lessonContent: 'E2E teaching report content',
      studentAttitude: 'Student participated well',
      teacherComment: 'Session completed and verified for payroll flow',
      ...overrides,
    });

    expect(res.status).toBe(200);
    return res;
  }

  beforeAll(async () => {
    // ── 1. Khởi tạo in-memory replica set (required for transactions) ──
    replSet = await MongoMemoryReplSet.create({
      replSet: { count: 1, storageEngine: 'wiredTiger' },
    });
    process.env.MONGODB_URI = replSet.getUri('school-mgmt-sc2-e2e');

    // ── 2. Compile NestJS application ──────────────────────────────────
    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.use(require('express').json({ limit: '10mb' }));
    app.use(require('express').urlencoded({ limit: '10mb', extended: true }));
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    // ── 3. Inject models ───────────────────────────────────────────────
    userModel = moduleRef.get<Model<any>>(getModelToken('User'));
    studentModel = moduleRef.get<Model<any>>(getModelToken('Student'));
    classModel = moduleRef.get<Model<any>>(getModelToken('Classroom'));
    sessionModel = moduleRef.get<Model<any>>(getModelToken('Session'));
    attendanceModel = moduleRef.get<Model<any>>(getModelToken('Attendance'));
    invoiceModel = moduleRef.get<Model<any>>(getModelToken('Invoice'));
    walletModel = moduleRef.get<Model<any>>(getModelToken('Wallet'));
    ledgerModel = moduleRef.get<Model<any>>(getModelToken('LedgerEntry'));
    payrollTxModel = moduleRef.get<Model<any>>(
      getModelToken('PayrollTransaction'),
    );

    // ── 4. Seed users ──────────────────────────────────────────────────
    const directorDoc = await upsertUser(director);
    await upsertUser(ops);
    const teacherDoc = await upsertUser(teacher);
    const parentDoc = await upsertUser(parent);

    teacherId = String(teacherDoc._id);
    parentId = String(parentDoc._id);

    // ── 5. Seed classroom ─────────────────────────────────────────────
    //    pricePerSession = 200,000đ / teacherPayPerSession = 100,000đ (ONLINE)
    const studentDoc = await studentModel.create({
      studentCode: 'SC2-STU-001',
      fullName: 'Nguyen Van A (SC2)',
      age: 12,
      parentUserId: new Types.ObjectId(parentId),
      parentName: parent.fullName,
      parentPhone: '0900010001',
      faceImage: 'sc2-face.png',
      approvalStatus: 'APPROVED',
      approvedBy: new Types.ObjectId(directorDoc._id),
      approvedAt: new Date(),
      subjects: ['Toan'],
      grade: '7',
    });
    studentId = String(studentDoc._id);

    const classDoc = await classModel.create({
      name: 'Lop SC2 Toan 7A',
      code: 'SC2-TOAN7A',
      teacher: new Types.ObjectId(teacherId),
      students: [new Types.ObjectId(studentId)],
      classMode: 'ONLINE',
      baseDuration: 60,
      sessionDuration: 60,
      pricePerSession: 200_000,
      teacherPayPerSession: 100_000,
      teacherPayPerStudent: 0,
      status: 'ACTIVE',
    });
    classId = String(classDoc._id);

    // ── 6. Seed Invoice APPROVED (10 buổi, sessionsRemaining = 10) ─────
    const invoiceDoc = await invoiceModel.create({
      invoiceNumber: `SC2-INV-${Date.now()}`,
      invoiceType: 'TUITION',
      studentId: new Types.ObjectId(studentId),
      classId: new Types.ObjectId(classId),
      sessions: 10,
      sessionsRemaining: 10,
      pricePerSession: 200_000,
      amount: 2_000_000,
      paymentDate: new Date(),
      status: 'APPROVED',
      walletTopUpDone: true,
      createdBy: new Types.ObjectId(directorDoc._id),
    });
    invoiceId = String(invoiceDoc._id);

    // ── 7. Seed Wallet phụ huynh (balance = 2,000,000đ) ───────────────
    await walletModel.findOneAndUpdate(
      { userId: new Types.ObjectId(parentId) },
      {
        $set: {
          userId: new Types.ObjectId(parentId),
          balance: 2_000_000,
          debtLimit: 0,
          trialDebtSessions: 0,
          totalTopUp: 2_000_000,
          totalDeducted: 0,
          status: 'ACTIVE',
        },
      },
      { upsert: true, new: true },
    );

    // ── 8. Đăng nhập tất cả actors ─────────────────────────────────────
    directorSession = await loginAndGetSession(director.email, director.password);
    opsSession = await loginAndGetSession(ops.email, ops.password);
    teacherSession = await loginAndGetSession(teacher.email, teacher.password);
  }, 180_000);

  afterAll(async () => {
    await app.close();
    await replSet.stop();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // BƯỚC 1: OPS điểm danh → Hệ thống tự tạo Session TEACHER_COMPLETED
  // ─────────────────────────────────────────────────────────────────────────

  it('Step 1: OPS marks attendance PRESENT → Session auto-created (TEACHER_COMPLETED)', async () => {
    const today = todayYmd();

    const res = await authWrite(
      request(app.getHttpServer()).post('/attendance/mark'),
      opsSession,
    ).send({
      classId,
      studentId,
      date: today,
      status: 'PRESENT',
    });

    expect(res.status).toBe(201);

    // Attendance record trả về kèm sessionCreated flag
    expect(res.body.sessionCreated).toBe(true);

    // sessionId phải tồn tại trên attendance record
    const attendanceDoc = await attendanceModel
      .findOne({
        classId: new Types.ObjectId(classId),
        studentId: new Types.ObjectId(studentId),
      })
      .lean() as any;
    expect(attendanceDoc).toBeTruthy();
    expect(attendanceDoc.status).toBe('PRESENT');
    expect(attendanceDoc.sessionId).toBeTruthy();

    // Lưu sessionId để dùng cho các bước tiếp theo
    mainSessionId = String(attendanceDoc.sessionId);

    // Session phải ở trạng thái TEACHER_COMPLETED
    const sessionDoc = await sessionModel.findById(mainSessionId).lean() as any;
    expect(sessionDoc).toBeTruthy();
    expect(sessionDoc.status).toBe('TEACHER_COMPLETED');
    // Tài chính của session phải được populate từ class pricing
    expect(sessionDoc.amountCharged).toBe(200_000);
    expect(sessionDoc.teacherPayout).toBe(100_000);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // BƯỚC 2: GV nộp báo cáo giảng dạy → Tạo PayrollTransaction PENDING
  // ─────────────────────────────────────────────────────────────────────────

  it('Step 2: TEACHER submits teaching report → PayrollTransaction PENDING created', async () => {
    const res = await authWrite(
      request(app.getHttpServer()).patch(`/sessions/${mainSessionId}/teaching-report`),
      teacherSession,
    ).send({
      lessonContent: 'Ôn tập phương trình bậc nhất và bậc hai',
      studentAttitude: 'Học sinh tập trung, tích cực tham gia',
      teacherComment: 'Buổi học diễn ra tốt đẹp',
    });

    expect(res.status).toBe(200);

    // Session phải được cập nhật hasTeachingReport = true
    const sessionDoc = await sessionModel.findById(mainSessionId).lean() as any;
    expect(sessionDoc.hasTeachingReport).toBe(true);
    expect(sessionDoc.teachingReport).toBeTruthy();
    expect(sessionDoc.teachingReport.lessonContent).toBe(
      'Ôn tập phương trình bậc nhất và bậc hai',
    );

    // PayrollTransaction phải được tạo tự động
    const payrollTx = await payrollTxModel
      .findOne({ sessionId: new Types.ObjectId(mainSessionId) })
      .lean() as any;
    expect(payrollTx).toBeTruthy();
    expect(payrollTx.status).toBe('PENDING');
    expect(payrollTx.baseSalary).toBe(100_000);
    expect(payrollTx.teacherId.toString()).toBe(teacherId);
    // Báo cáo nộp đúng hạn (session mới tạo hôm nay)
    expect(payrollTx.isLateReport).toBe(false);
    expect(payrollTx.penaltyAmount).toBe(0);
    expect(payrollTx.finalSalary).toBe(100_000);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // BƯỚC 2b (Negative): Nộp báo cáo trễ → Ghi nhận phạt
  // ─────────────────────────────────────────────────────────────────────────

  it('Step 2b (negative): Late report submission → PayrollTransaction has penalty', async () => {
    // Tạo session trực tiếp trong DB với scheduledDate = 3 ngày trước
    //   → deadline sẽ là 2 ngày + 23h trước → tức là đã vượt quá 24h deadline
    const pastDate = utcDaysAgo(3);
    const lateSession = await sessionModel.create({
      classId: new Types.ObjectId(classId),
      studentId: new Types.ObjectId(studentId),
      teacherId: new Types.ObjectId(teacherId),
      parentUserId: new Types.ObjectId(parentId),
      sessionType: 'REGULAR',
      scheduledDate: pastDate,
      durationMinutes: 60,
      amountCharged: 200_000,
      teacherPayout: 100_000,
      status: 'TEACHER_COMPLETED',
      confirmation: { teacherCompletedAt: pastDate },
      autoConfirmAfterHours: 48,
      createdBy: new Types.ObjectId(teacherId),
    });
    const lateSessionId = String(lateSession._id);

    const res = await authWrite(
      request(app.getHttpServer()).patch(`/sessions/${lateSessionId}/teaching-report`),
      teacherSession,
    ).send({
      lessonContent: 'Bài nộp trễ - kiểm tra phạt',
    });

    expect(res.status).toBe(200);

    const payrollTx = await payrollTxModel
      .findOne({ sessionId: new Types.ObjectId(lateSessionId) })
      .lean() as any;
    expect(payrollTx).toBeTruthy();

    // Nộp trễ phải được đánh dấu
    expect(payrollTx.isLateReport).toBe(true);
    expect(payrollTx.lateHours).toBeGreaterThan(0);

    // Penalty phải lớn hơn 0
    expect(payrollTx.penaltyAmount).toBeGreaterThan(0);

    // finalSalary = baseSalary - penaltyAmount (tối thiểu 0)
    expect(payrollTx.finalSalary).toBe(
      Math.max(0, payrollTx.baseSalary - payrollTx.penaltyAmount),
    );

    // finalSalary phải nhỏ hơn baseSalary
    expect(payrollTx.finalSalary).toBeLessThan(payrollTx.baseSalary);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // BƯỚC 3: OPS chốt buổi học → Trừ ví, tiêu hao HĐ, cập nhật P&L
  // ─────────────────────────────────────────────────────────────────────────

  it('Step 3: OPS finalizes Session → wallet deducted, invoice consumed, P&L updated', async () => {
    // 3.1 - Capture baseline trước khi chốt
    const baselinePnLRes = await authGet(
      request(app.getHttpServer()).get('/financial-control/profit-and-loss?basis=accrual'),
      directorSession,
    );
    expect(baselinePnLRes.status).toBe(200);
    const initialSessionRevenue: number =
      baselinePnLRes.body.revenue.sessionRevenue ?? 0;
    const initialTeacherCost: number =
      baselinePnLRes.body.costs.teacherCost ?? 0;

    const walletBefore = await walletModel
      .findOne({ userId: new Types.ObjectId(parentId) })
      .lean() as any;
    expect(walletBefore).toBeTruthy();
    const initialWalletBalance: number = walletBefore.balance;

    const invoiceBefore = await invoiceModel.findById(invoiceId).lean() as any;
    expect(invoiceBefore.sessionsRemaining).toBe(10);

    // 3.2 - Chốt buổi học
    const finalizeRes = await authWrite(
      request(app.getHttpServer()).post(`/sessions/${mainSessionId}/finalize`),
      opsSession,
    ).send();

    expect(finalizeRes.status).toBe(201);

    // 3.3 - Kiểm chứng session status
    const sessionDoc = await sessionModel.findById(mainSessionId).lean() as any;
    expect(sessionDoc.status).toBe('FINALIZED');
    expect(sessionDoc.isPaid).toBe(true);

    // 3.4 - Kiểm chứng ví phụ huynh bị trừ đúng 200,000đ
    const walletAfter = await walletModel
      .findOne({ userId: new Types.ObjectId(parentId) })
      .lean() as any;
    expect(walletAfter.balance).toBe(initialWalletBalance - 200_000);

    // 3.5 - Kiểm chứng sổ cái có bản ghi SESSION_DEDUCT
    const ledgerEntry = await ledgerModel
      .findOne({
        sessionId: new Types.ObjectId(mainSessionId),
        type: 'SESSION_DEDUCT',
      })
      .lean() as any;
    expect(ledgerEntry).toBeTruthy();
    expect(ledgerEntry.amount).toBe(200_000);
    expect(ledgerEntry.userId.toString()).toBe(parentId);
    expect(ledgerEntry.balanceBefore).toBe(initialWalletBalance);
    expect(ledgerEntry.balanceAfter).toBe(initialWalletBalance - 200_000);

    // 3.6 - Kiểm chứng hóa đơn tiêu hao: sessionsRemaining giảm từ 10 xuống 9
    const invoiceAfter = await invoiceModel.findById(invoiceId).lean() as any;
    expect(invoiceAfter.sessionsRemaining).toBe(9);

    // 3.7 - Kiểm chứng P&L phản ánh doanh thu và chi phí mới
    const currentPnLRes = await authGet(
      request(app.getHttpServer()).get('/financial-control/profit-and-loss?basis=accrual'),
      directorSession,
    );
    expect(currentPnLRes.status).toBe(200);

    const currentPnL = currentPnLRes.body;
    // Doanh thu buổi học tăng thêm 200,000đ
    expect(currentPnL.revenue.sessionRevenue).toBe(initialSessionRevenue + 200_000);
    // Chi phí giáo viên tăng thêm 100,000đ
    expect(currentPnL.costs.teacherCost).toBe(initialTeacherCost + 100_000);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // EDGE CASE 1: Race Condition — chốt 2 lần cùng lúc
  // ─────────────────────────────────────────────────────────────────────────

  it('Edge case 1 (race condition): Concurrent finalize requests → only one succeeds, wallet deducted once', async () => {
    // Tạo một session mới ở trạng thái TEACHER_COMPLETED để test race condition
    // Dùng walletModel để tạo ví có đủ tiền cho parent (đã có từ beforeAll, chỉ cần balance đủ)
    // Reset wallet balance lên đủ số dư cho race test
    await walletModel.findOneAndUpdate(
      { userId: new Types.ObjectId(parentId) },
      { $set: { balance: 1_000_000 } },
    );

    const raceSession = await sessionModel.create({
      classId: new Types.ObjectId(classId),
      studentId: new Types.ObjectId(studentId),
      teacherId: new Types.ObjectId(teacherId),
      parentUserId: new Types.ObjectId(parentId),
      sessionType: 'REGULAR',
      scheduledDate: utcDaysAgo(1),
      durationMinutes: 60,
      amountCharged: 200_000,
      teacherPayout: 100_000,
      status: 'TEACHER_COMPLETED',
      confirmation: { teacherCompletedAt: utcDaysAgo(1) },
      autoConfirmAfterHours: 48,
      createdBy: new Types.ObjectId(teacherId),
    });
    const raceSessionId = String(raceSession._id);

    await submitTeachingReport(raceSessionId, {
      lessonContent: 'Race condition finalize coverage',
    });

    // Bắn 2 request finalize ĐỒNG THỜI
    const [res1, res2] = await Promise.all([
      authWrite(
        request(app.getHttpServer()).post(`/sessions/${raceSessionId}/finalize`),
        opsSession,
      ).send(),
      authWrite(
        request(app.getHttpServer()).post(`/sessions/${raceSessionId}/finalize`),
        opsSession,
      ).send(),
    ]);

    const statuses = [res1.status, res2.status].sort();

    // Một request thành công (201), một request thất bại (400 hoặc 201 idempotent)
    // Hành vi hệ thống: request 2 thấy session đã FINALIZED → trả 201 (idempotent confirm)
    // HOẶC request 2 không thể atomic lock → BadRequestException 400
    // Cả hai đều acceptable: quan trọng là ví chỉ bị trừ ĐÚNG 1 LẦN
    expect(statuses[0]).toBeGreaterThanOrEqual(200);
    expect(statuses[0]).toBeLessThan(500);

    // Kiểm chứng session FINALIZED
    const raceSessionDoc = await sessionModel.findById(raceSessionId).lean() as any;
    expect(raceSessionDoc.status).toBe('FINALIZED');

    // Kiểm chứng ví chỉ bị trừ ĐÚNG 1 LẦN
    const ledgerEntries = await ledgerModel
      .find({
        sessionId: new Types.ObjectId(raceSessionId),
        type: 'SESSION_DEDUCT',
      })
      .lean() as any[];
    expect(ledgerEntries.length).toBe(1);

    // isPaid phải là true (chỉ deduct 1 lần)
    const finalRaceSession = await sessionModel.findById(raceSessionId).lean() as any;
    expect(finalRaceSession.isPaid).toBe(true);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // EDGE CASE 2: Ví không đủ tiền — finalize vẫn thành công nhưng isPaid=false
  // ─────────────────────────────────────────────────────────────────────────

  it('Edge case 2 (insufficient balance): Wallet = 0 → finalize succeeds but isPaid=false, no LedgerEntry', async () => {
    // Tạo parent2 và ví rỗng chuyên cho test này
    const emptyParent = await userModel.findOneAndUpdate(
      { email: 'parent.empty.sc2.e2e@school.local' },
      {
        $set: {
          email: 'parent.empty.sc2.e2e@school.local',
          password: await bcrypt.hash('E2ePass123!', 10),
          fullName: 'Parent Empty Wallet SC2',
          role: 'PARENT',
          status: 'ACTIVE',
        },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true, new: true },
    );
    const emptyParentId = String(emptyParent._id);

    // Tạo ví với balance = 0 và debtLimit = 0 (không cho nợ)
    await walletModel.findOneAndUpdate(
      { userId: new Types.ObjectId(emptyParentId) },
      {
        $set: {
          userId: new Types.ObjectId(emptyParentId),
          balance: 0,
          debtLimit: 0,
          trialDebtSessions: 0,
          status: 'ACTIVE',
        },
      },
      { upsert: true, new: true },
    );

    // Tạo session cho empty parent
    const emptySession = await sessionModel.create({
      classId: new Types.ObjectId(classId),
      studentId: new Types.ObjectId(studentId),
      teacherId: new Types.ObjectId(teacherId),
      parentUserId: new Types.ObjectId(emptyParentId),
      sessionType: 'REGULAR',
      scheduledDate: utcDaysAgo(2),
      durationMinutes: 60,
      amountCharged: 200_000,
      teacherPayout: 100_000,
      status: 'TEACHER_COMPLETED',
      confirmation: { teacherCompletedAt: utcDaysAgo(2) },
      autoConfirmAfterHours: 48,
      createdBy: new Types.ObjectId(teacherId),
    });
    const emptySessionId = String(emptySession._id);

    await submitTeachingReport(emptySessionId, {
      lessonContent: 'Insufficient balance finalize coverage',
    });

    // Gọi finalize — hệ thống chốt session NHƯNG deduct ví thất bại (soft-fail)
    const finalizeRes = await authWrite(
      request(app.getHttpServer()).post(`/sessions/${emptySessionId}/finalize`),
      opsSession,
    ).send();

    // Finalize API trả về 201 (hệ thống không throw exception khi deduct thất bại)
    expect(finalizeRes.status).toBe(201);

    // Session đã FINALIZED nhưng isPaid = false (wallet deduction failed)
    const emptySessionDoc = await sessionModel.findById(emptySessionId).lean() as any;
    expect(emptySessionDoc.status).toBe('FINALIZED');
    expect(emptySessionDoc.isPaid).toBe(false);
    expect(emptySessionDoc.walletDeductError).toBeTruthy(); // Ghi nhận lỗi

    // Không có LedgerEntry nào được tạo
    const ledgerEntry = await ledgerModel
      .findOne({
        sessionId: new Types.ObjectId(emptySessionId),
        type: 'SESSION_DEDUCT',
      })
      .lean() as any;
    expect(ledgerEntry).toBeNull();

    // Ví vẫn = 0 (không thay đổi)
    const emptyWalletAfter = await walletModel
      .findOne({ userId: new Types.ObjectId(emptyParentId) })
      .lean() as any;
    expect(emptyWalletAfter.balance).toBe(0);
  });

  it('treats remaining bonus sessions as complimentary attendance without wallet deduction', async () => {
    await invoiceModel.updateOne(
      { _id: new Types.ObjectId(invoiceId) },
      {
        $set: {
          sessionsRemaining: 0,
          bonusSessions: 1,
          bonusSessionsRemaining: 1,
        },
      },
    );

    await walletModel.updateOne(
      { userId: new Types.ObjectId(parentId) },
      { $set: { balance: 1_234_567 } },
    );

    const bonusSession = await sessionModel.create({
      classId: new Types.ObjectId(classId),
      studentId: new Types.ObjectId(studentId),
      teacherId: new Types.ObjectId(teacherId),
      parentUserId: new Types.ObjectId(parentId),
      sessionType: 'REGULAR',
      scheduledDate: utcDaysAgo(1),
      durationMinutes: 60,
      amountCharged: 200_000,
      referenceAmountCharged: 200_000,
      teacherPayout: 100_000,
      status: 'TEACHER_COMPLETED',
      confirmation: { teacherCompletedAt: utcDaysAgo(1) },
      autoConfirmAfterHours: 48,
      createdBy: new Types.ObjectId(teacherId),
    });
    const bonusSessionId = String(bonusSession._id);

    await submitTeachingReport(bonusSessionId, {
      lessonContent: 'Bonus session finalize coverage',
    });

    const finalizeRes = await authWrite(
      request(app.getHttpServer()).post(`/sessions/${bonusSessionId}/finalize`),
      opsSession,
    ).send();

    expect(finalizeRes.status).toBe(201);

    const storedSession = await sessionModel.findById(bonusSessionId).lean() as any;
    expect(storedSession.status).toBe('FINALIZED');
    expect(storedSession.isPaid).toBe(false);
    expect(storedSession.isBonusSession).toBe(true);
    expect(storedSession.amountCharged).toBe(0);
    expect(storedSession.referenceAmountCharged).toBe(200_000);
    expect(storedSession.teacherPayout).toBe(100_000);
    expect(storedSession.invoiceConsumptionApplied).toBe(true);
    expect(storedSession.consumedBonusUnits).toBe(1);
    expect(storedSession.consumedBonusAmount).toBe(200_000);
    expect(storedSession.bonusInvoiceId?.toString()).toBe(invoiceId);

    const walletAfter = await walletModel
      .findOne({ userId: new Types.ObjectId(parentId) })
      .lean() as any;
    expect(walletAfter.balance).toBe(1_234_567);

    const deductEntry = await ledgerModel
      .findOne({
        sessionId: new Types.ObjectId(bonusSessionId),
        type: 'SESSION_DEDUCT',
      })
      .lean();
    expect(deductEntry).toBeNull();

    const invoiceAfter = await invoiceModel.findById(invoiceId).lean() as any;
    expect(invoiceAfter.sessionsRemaining).toBe(0);
    expect(invoiceAfter.bonusSessionsRemaining).toBe(0);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // EDGE CASE 3: Khóa báo cáo — không cho sửa khi lương đã APPROVED
  // ─────────────────────────────────────────────────────────────────────────

  it('consumes converted trial sessions from trialSessionsRemaining without touching paid sessions', async () => {
    await invoiceModel.updateOne(
      { _id: new Types.ObjectId(invoiceId) },
      {
        $set: {
          sessionsRemaining: 5,
          bonusSessions: 0,
          bonusSessionsRemaining: 0,
          trialSessions: 1,
          trialSessionsRemaining: 1,
        },
      },
    );

    await walletModel.updateOne(
      { userId: new Types.ObjectId(parentId) },
      { $set: { balance: 9_999_999 } },
    );

    const trialSession = await sessionModel.create({
      classId: new Types.ObjectId(classId),
      studentId: new Types.ObjectId(studentId),
      teacherId: new Types.ObjectId(teacherId),
      parentUserId: new Types.ObjectId(parentId),
      sessionType: 'TRIAL',
      trialConverted: true,
      scheduledDate: utcDaysAgo(1),
      durationMinutes: 60,
      amountCharged: 200_000,
      teacherPayout: 100_000,
      status: 'TEACHER_COMPLETED',
      confirmation: { teacherCompletedAt: utcDaysAgo(1) },
      autoConfirmAfterHours: 48,
      createdBy: new Types.ObjectId(teacherId),
    });
    const trialSessionId = String(trialSession._id);

    await submitTeachingReport(trialSessionId, {
      lessonContent: 'Converted trial session should consume trial invoice units',
    });

    const finalizeRes = await authWrite(
      request(app.getHttpServer()).post(`/sessions/${trialSessionId}/finalize`),
      opsSession,
    ).send();

    expect(finalizeRes.status).toBe(201);

    const invoiceAfter = await invoiceModel.findById(invoiceId).lean() as any;
    expect(invoiceAfter.sessionsRemaining).toBe(5);
    expect(invoiceAfter.trialSessionsRemaining).toBe(0);
  });

  it('Edge case 3 (freeze): Cannot edit teaching report when PayrollTransaction is APPROVED', async () => {
    // PayrollTransaction cho mainSession đã được tạo ở Step 2
    // Approve trực tiếp trong DB (mô phỏng kế toán đã duyệt)
    const approveResult = await payrollTxModel.updateOne(
      { sessionId: new Types.ObjectId(mainSessionId) },
      { $set: { status: 'APPROVED' } },
    );
    expect(approveResult.modifiedCount).toBe(1);

    // Thử update teaching report sau khi lương đã APPROVED → phải bị chặn
    const editRes = await authWrite(
      request(app.getHttpServer()).patch(
        `/sessions/${mainSessionId}/teaching-report`,
      ),
      teacherSession,
    ).send({
      lessonContent: 'Cập nhật nội dung sau khi lương đã duyệt (phải bị từ chối)',
    });

    expect(editRes.status).toBe(400);
    // Error message phải đề cập đến việc lương đã được duyệt
    const errorMsg: string =
      editRes.body?.message ?? editRes.body?.error ?? '';
    expect(errorMsg.toLowerCase()).toMatch(/duyệt|approved|lương|bao cao/i);

    // Teaching report không bị thay đổi
    const sessionDoc = await sessionModel.findById(mainSessionId).lean() as any;
    expect(sessionDoc.teachingReport?.lessonContent).toBe(
      'Ôn tập phương trình bậc nhất và bậc hai',
    );
  });
});
