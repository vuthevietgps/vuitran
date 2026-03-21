/**
 * KỊCH BẢN E2E SỐ 4: Month-end Payroll Generation & Fund Fluctuation
 *
 * Mục tiêu: Kiểm chứng tính toàn vẹn của việc tổng hợp lương từ các sổ phụ
 * (PayrollTransaction), cơ chế đóng băng dữ liệu (Session data freeze) và
 * khả năng đối soát trừ tiền quỹ tự động khi chi lương.
 *
 * Pre-requisites (Seeded trong beforeAll):
 *   - Users: ACCOUNTING, DIRECTOR, TEACHER, OPS
 *   - 1 BankAccount ACTIVE (isPrimary=true, balance=100,000,000đ)
 *   - 2 FINALIZED Sessions của TEACHER trong tháng 03/2026
 *   - 2 PayrollTransactions APPROVED tương ứng (freeze guard)
 *   - Attendance PRESENT cho từng session
 *
 * API Flow (Happy Path):
 *   Step 1: POST /payroll/bulk-generate (ACCOUNTING)
 *           → Payroll DRAFT + sessions isTeacherPaid=true (frozen)
 *           [Negative] TEACHER cố sửa teaching-report session đã frozen → 400
 *   Step 1b: POST /payroll/bulk-generate lần 2 → created=0 (idempotency)
 *   Step 2: POST /payroll/:id/submit  (ACCOUNTING) → PENDING_REVIEW
 *           POST /payroll/:id/approve (DIRECTOR)   → APPROVED
 *   Step 3: GET /financial-control/cash-flow       → capture baseline
 *           POST /payroll/:id/mark-paid (ACCOUNTING, with bankAccountId)
 *           → Payroll PAID + BankTransaction WITHDRAWAL/PAYROLL created
 *           → totalOutflow tăng đúng bằng netAmount
 *
 * Edge Cases:
 *   EC-1 (idempotency): bulk-generate 2 lần cho cùng 1 kỳ → không tạo đúp
 *   EC-2 (fallback bankAccount): mark-paid không có bankAccountId
 *           → hệ thống tự dùng tài khoản ACTIVE mặc định, vẫn tạo BankTransaction
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
  role: 'DIRECTOR' | 'ACCOUNTING' | 'OPS' | 'TEACHER' | 'PARENT';
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

function toUtcDate(ymd: string, hhmm: string): Date {
  return new Date(`${ymd}T${hhmm}:00.000Z`);
}

// ─── Constants ───────────────────────────────────────────────────────────────

// Sử dụng kỳ lương cố định tháng 03/2026 (ngày hiện tại là 2026-03-15)
const PERIOD_START = '2026-03-01';
const PERIOD_END   = '2026-03-31';

// Ngày cụ thể của 2 buổi học (trước ngày hiện tại, trong tháng 3)
const SESSION_DATE_1 = '2026-03-05';
const SESSION_DATE_2 = '2026-03-07';

// Lương GV mỗi buổi → tổng = 200,000đ
const TEACHER_PAYOUT_1 = 100_000;
const TEACHER_PAYOUT_2 = 100_000;
const TOTAL_PAYOUT     = TEACHER_PAYOUT_1 + TEACHER_PAYOUT_2;

// ─── Suite ───────────────────────────────────────────────────────────────────

describe('Scenario 4: Month-end Payroll Generation & Fund Fluctuation (e2e)', () => {
  let app: INestApplication;
  let moduleRef: TestingModule;
  let replSet: MongoMemoryReplSet;

  // ── Models ───────────────────────────────────────────────────────────────
  let userModel:             Model<any>;
  let studentModel:          Model<any>;
  let classModel:            Model<any>;
  let sessionModel:          Model<any>;
  let attendanceModel:       Model<any>;
  let payrollModel:          Model<any>;
  let payrollTxModel:        Model<any>;
  let bankAccountModel:      Model<any>;
  let bankTransactionModel:  Model<any>;

  // ── Users ────────────────────────────────────────────────────────────────
  const director: SeedUser = {
    email:    'director.sc4.e2e@school.local',
    password: 'E2ePass123!',
    fullName: 'Director SC4',
    role:     'DIRECTOR',
  };
  const accounting: SeedUser = {
    email:    'accounting.sc4.e2e@school.local',
    password: 'E2ePass123!',
    fullName: 'Accounting SC4',
    role:     'ACCOUNTING',
  };
  const ops: SeedUser = {
    email:    'ops.sc4.e2e@school.local',
    password: 'E2ePass123!',
    fullName: 'Ops SC4',
    role:     'OPS',
  };
  const teacher: SeedUser = {
    email:    'teacher.sc4.e2e@school.local',
    password: 'E2ePass123!',
    fullName: 'Teacher SC4',
    role:     'TEACHER',
  };
  // Teacher thứ 2 dùng cho Edge Case 2 (fallback bankAccountId)
  const teacher2: SeedUser = {
    email:    'teacher2.sc4.e2e@school.local',
    password: 'E2ePass123!',
    fullName: 'Teacher2 SC4',
    role:     'TEACHER',
  };
  const parent: SeedUser = {
    email:    'parent.sc4.e2e@school.local',
    password: 'E2ePass123!',
    fullName: 'Parent SC4',
    role:     'PARENT',
  };

  // ── Auth sessions ────────────────────────────────────────────────────────
  let directorSession:   SessionCookies;
  let accountingSession: SessionCookies;
  let teacherSession:    SessionCookies;
  let teacher2Session:   SessionCookies;

  // ── Seeded entity IDs ────────────────────────────────────────────────────
  let opsId:      string;
  let teacherId:  string;
  let teacher2Id: string;
  let parentId:   string;

  let classId:    string;
  let class2Id:   string;
  let studentId:  string;
  let student2Id: string;

  let session1Id: string; // buổi học 1 của teacher
  let session2Id: string; // buổi học 2 của teacher

  let bankAccountId: string;

  // ── Captured across test steps ────────────────────────────────────────────
  let payrollId: string;
  let baselineOutflow: number; // totalOutflow trước khi mark-paid

  // ─────────────────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────────────────

  async function upsertUser(u: SeedUser): Promise<any> {
    const hashed = await bcrypt.hash(u.password, 10);
    await userModel.updateOne(
      { email: u.email },
      {
        $set: {
          email:    u.email,
          password: hashed,
          fullName: u.fullName,
          role:     u.role,
          status:   'ACTIVE',
        },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true },
    );
    return userModel.findOne({ email: u.email }).lean();
  }

  async function loginAndGetSession(email: string, password: string): Promise<SessionCookies> {
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect((res) => {
        expect([200, 201]).toContain(res.status);
      });

    const accessToken = extractCookieValue(loginRes.headers['set-cookie'], 'access_token');
    expect(accessToken).toBeTruthy();

    const meRes = await request(app.getHttpServer())
      .get('/users/me')
      .set('Cookie', `access_token=${accessToken}`)
      .expect(200);

    const xsrfToken = extractCookieValue(meRes.headers['set-cookie'], 'XSRF-TOKEN');
    expect(xsrfToken).toBeTruthy();

    return {
      accessToken:  accessToken as string,
      xsrfToken:    xsrfToken as string,
      cookieHeader: `access_token=${accessToken}; XSRF-TOKEN=${xsrfToken}`,
    };
  }

  function authGet(agent: any, session: SessionCookies): any {
    return agent.set('Cookie', session.cookieHeader);
  }

  function authWrite(agent: any, session: SessionCookies): any {
    return agent
      .set('Cookie', session.cookieHeader)
      .set('X-XSRF-TOKEN', session.xsrfToken);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // beforeAll: Khởi tạo app + seed dữ liệu tiền quyết định
  // ─────────────────────────────────────────────────────────────────────────

  beforeAll(async () => {
    // 1. Khởi tạo MongoDB in-memory replica set (bắt buộc cho transactions)
    replSet = await MongoMemoryReplSet.create({
      replSet: { count: 1, storageEngine: 'wiredTiger' },
    });
    process.env.MONGODB_URI = replSet.getUri('school-mgmt-sc4-e2e');

    // 2. Compile NestJS application
    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.use(require('express').json({ limit: '10mb' }));
    app.use(require('express').urlencoded({ limit: '10mb', extended: true }));
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();

    // 3. Inject models
    userModel            = moduleRef.get<Model<any>>(getModelToken('User'));
    studentModel         = moduleRef.get<Model<any>>(getModelToken('Student'));
    classModel           = moduleRef.get<Model<any>>(getModelToken('Classroom'));
    sessionModel         = moduleRef.get<Model<any>>(getModelToken('Session'));
    attendanceModel      = moduleRef.get<Model<any>>(getModelToken('Attendance'));
    payrollModel         = moduleRef.get<Model<any>>(getModelToken('Payroll'));
    payrollTxModel       = moduleRef.get<Model<any>>(getModelToken('PayrollTransaction'));
    bankAccountModel     = moduleRef.get<Model<any>>(getModelToken('BankAccount'));
    bankTransactionModel = moduleRef.get<Model<any>>(getModelToken('BankTransaction'));

    // 4. Seed users
    const directorDoc    = await upsertUser(director);
    const opsDoc         = await upsertUser(ops);
    const teacherDoc     = await upsertUser(teacher);
    const teacher2Doc    = await upsertUser(teacher2);
    const parentDoc      = await upsertUser(parent);
    await upsertUser(accounting);

    opsId      = String(opsDoc._id);
    teacherId  = String(teacherDoc._id);
    teacher2Id = String(teacher2Doc._id);
    parentId   = String(parentDoc._id);

    // 5. Seed student 1 (cho teacher)
    const studentDoc = await studentModel.create({
      studentCode:    'SC4-STU-001',
      fullName:       'Nguyen Van C (SC4)',
      age:            12,
      parentUserId:   new Types.ObjectId(parentId),
      parentName:     parent.fullName,
      parentPhone:    '0900040001',
      faceImage:      'sc4-face-1.png',
      approvalStatus: 'APPROVED',
      approvedBy:     new Types.ObjectId(directorDoc._id),
      approvedAt:     new Date(),
      subjects:       ['Toan'],
      grade:          '7',
    });
    studentId = String(studentDoc._id);

    // 6. Seed student 2 (cho teacher2, dùng cho EC-2)
    const student2Doc = await studentModel.create({
      studentCode:    'SC4-STU-002',
      fullName:       'Tran Thi D (SC4)',
      age:            11,
      parentUserId:   new Types.ObjectId(parentId),
      parentName:     parent.fullName,
      parentPhone:    '0900040002',
      faceImage:      'sc4-face-2.png',
      approvalStatus: 'APPROVED',
      approvedBy:     new Types.ObjectId(directorDoc._id),
      approvedAt:     new Date(),
      subjects:       ['Van'],
      grade:          '6',
    });
    student2Id = String(student2Doc._id);

    // 7. Seed classroom 1 (teacher)
    const classDoc = await classModel.create({
      name:                 'Lop SC4 Toan 7A',
      code:                 'SC4-TOAN7A',
      teacher:              new Types.ObjectId(teacherId),
      students:             [new Types.ObjectId(studentId)],
      classMode:            'ONLINE',
      baseDuration:         60,
      sessionDuration:      60,
      pricePerSession:      200_000,
      teacherPayPerSession: TEACHER_PAYOUT_1,
      teacherPayPerStudent: 0,
      status:               'ACTIVE',
    });
    classId = String(classDoc._id);

    // 8. Seed classroom 2 (teacher2 — dùng cho EC-2 sau bước 3)
    const class2Doc = await classModel.create({
      name:                 'Lop SC4 Van 6B',
      code:                 'SC4-VAN6B',
      teacher:              new Types.ObjectId(teacher2Id),
      students:             [new Types.ObjectId(student2Id)],
      classMode:            'ONLINE',
      baseDuration:         60,
      sessionDuration:      60,
      pricePerSession:      180_000,
      teacherPayPerSession: 90_000,
      teacherPayPerStudent: 0,
      status:               'ACTIVE',
    });
    class2Id = String(class2Doc._id);

    // 9. Seed 2 FINALIZED sessions cho teacher (eligibility: FINALIZED + report + attendance)
    //    Điều kiện countFinalizedForPayroll:
    //    ✔ status = FINALIZED
    //    ✔ isTeacherPaid = false
    //    ✔ hasTeachingReport = true + lessonContent non-empty
    //    ✔ confirmation.finalizedBy set (xác nhận OPS)
    //    ✔ Attendance PRESENT tương ứng

    const sess1 = await sessionModel.create({
      classId:              new Types.ObjectId(classId),
      studentId:            new Types.ObjectId(studentId),
      teacherId:            new Types.ObjectId(teacherId),
      parentUserId:         new Types.ObjectId(parentId),
      scheduledDate:        toUtcDate(SESSION_DATE_1, '09:00'),
      scheduledStartTime:   '09:00',
      scheduledEndTime:     '10:00',
      durationMinutes:      60,
      teacherPayout:        TEACHER_PAYOUT_1,
      amountCharged:        200_000,
      status:               'FINALIZED',
      hasTeachingReport:    true,
      teachingReport: {
        lessonContent:   'Ôn tập phương trình bậc nhất – Buổi 1',
        submittedAt:     toUtcDate(SESSION_DATE_1, '11:00'),
      },
      confirmation: {
        finalizedAt: toUtcDate(SESSION_DATE_1, '10:30'),
        finalizedBy: new Types.ObjectId(opsId),   // OPS xác nhận chốt
      },
      isTeacherPaid: false,
      isPaid:        true,
    });
    session1Id = String(sess1._id);

    const sess2 = await sessionModel.create({
      classId:              new Types.ObjectId(classId),
      studentId:            new Types.ObjectId(studentId),
      teacherId:            new Types.ObjectId(teacherId),
      parentUserId:         new Types.ObjectId(parentId),
      scheduledDate:        toUtcDate(SESSION_DATE_2, '09:00'),
      scheduledStartTime:   '09:00',
      scheduledEndTime:     '10:00',
      durationMinutes:      60,
      teacherPayout:        TEACHER_PAYOUT_2,
      amountCharged:        200_000,
      status:               'FINALIZED',
      hasTeachingReport:    true,
      teachingReport: {
        lessonContent:   'Ôn tập phương trình bậc nhất – Buổi 2',
        submittedAt:     toUtcDate(SESSION_DATE_2, '11:00'),
      },
      confirmation: {
        finalizedAt: toUtcDate(SESSION_DATE_2, '10:30'),
        finalizedBy: new Types.ObjectId(opsId),
      },
      isTeacherPaid: false,
      isPaid:        true,
    });
    session2Id = String(sess2._id);

    // 10. Seed attendance PRESENT cho cả 2 session (bắt buộc cho countFinalizedForPayroll)
    await attendanceModel.create({
      classId:   new Types.ObjectId(classId),
      studentId: new Types.ObjectId(studentId),
      teacherId: new Types.ObjectId(teacherId),
      date:      toUtcDate(SESSION_DATE_1, '09:00'),
      status:    'PRESENT',
      sessionId: new Types.ObjectId(session1Id),
    });

    await attendanceModel.create({
      classId:   new Types.ObjectId(classId),
      studentId: new Types.ObjectId(studentId),
      teacherId: new Types.ObjectId(teacherId),
      date:      toUtcDate(SESSION_DATE_2, '09:00'),
      status:    'PRESENT',
      sessionId: new Types.ObjectId(session2Id),
    });

    // 11. Seed 2 PayrollTransaction APPROVED — tạo "freeze lock" cho teaching-report
    //     (freeze check trong sessions.service.ts: nếu PayrollTx = APPROVED → chặn edit)
    await payrollTxModel.create({
      teacherId:  new Types.ObjectId(teacherId),
      sessionId:  new Types.ObjectId(session1Id),
      classId:    new Types.ObjectId(classId),
      studentId:  new Types.ObjectId(studentId),
      sessionDate: toUtcDate(SESSION_DATE_1, '09:00'),
      baseSalary:  TEACHER_PAYOUT_1,
      penaltyAmount: 0,
      finalSalary: TEACHER_PAYOUT_1,
      status:      'APPROVED',
    });

    await payrollTxModel.create({
      teacherId:  new Types.ObjectId(teacherId),
      sessionId:  new Types.ObjectId(session2Id),
      classId:    new Types.ObjectId(classId),
      studentId:  new Types.ObjectId(studentId),
      sessionDate: toUtcDate(SESSION_DATE_2, '09:00'),
      baseSalary:  TEACHER_PAYOUT_2,
      penaltyAmount: 0,
      finalSalary: TEACHER_PAYOUT_2,
      status:      'APPROVED',
    });

    // 12. Seed BankAccount ACTIVE (PRIMARY) — dùng cả ở happy path và EC-2 fallback
    const bankAccountDoc = await bankAccountModel.create({
      accountCode:    'BA-SC4-E2E-001',
      bankName:       'Vietcombank',
      accountNumber:  '4000000001',
      accountHolder:  'Trung Tam SC4 E2E',
      currentBalance: 100_000_000,
      openingBalance: 100_000_000,
      status:         'ACTIVE',
      isPrimary:      true,
      createdById:    new Types.ObjectId(directorDoc._id),
      createdByName:  director.fullName,
    });
    bankAccountId = String(bankAccountDoc._id);

    // 13. Đăng nhập tất cả actors
    directorSession   = await loginAndGetSession(director.email,   director.password);
    accountingSession = await loginAndGetSession(accounting.email, accounting.password);
    teacherSession    = await loginAndGetSession(teacher.email,    teacher.password);
    teacher2Session   = await loginAndGetSession(teacher2.email,   teacher2.password);
  }, 180_000);

  afterAll(async () => {
    await app.close();
    await replSet.stop();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  //  BƯỚC 1: Kế toán "Tạo bảng lương hàng loạt" (Bulk Generate)
  // ═══════════════════════════════════════════════════════════════════════════

  it('Step 1: Accounting bulk-generates payroll → DRAFT created & sessions frozen', async () => {
    const res = await authWrite(
      request(app.getHttpServer()).post('/payroll/bulk-generate'),
      accountingSession,
    ).send({ periodStart: PERIOD_START, periodEnd: PERIOD_END });

    expect([200, 201]).toContain(res.status);
    // Phải tạo ít nhất 1 bảng lương (cho teacher1)
    expect(res.body.created).toBeGreaterThanOrEqual(1);
    expect(res.body.errors).toHaveLength(0);

    // Tìm payroll vừa được tạo cho teacher (chỉ DRAFT)
    const payroll: any = await payrollModel
      .findOne({ teacherId: new Types.ObjectId(teacherId), status: 'DRAFT' })
      .lean();
    expect(payroll).toBeTruthy();
    expect(payroll.status).toBe('DRAFT');
    // netAmount phải khớp với tổng teacherPayout của 2 session
    expect(payroll.netAmount).toBe(TOTAL_PAYOUT);
    // Kỳ lương phải bao phủ các session trong period
    expect(new Date(payroll.periodStart).toISOString().slice(0, 10)).toBe(PERIOD_START);
    expect(new Date(payroll.periodEnd).toISOString().slice(0, 10)).toBe(PERIOD_END);

    payrollId = String(payroll._id);

    // ── Kiểm chứng: sessions đã bị "đóng băng" (isTeacherPaid = true) ───────
    const s1: any = await sessionModel.findById(session1Id).lean();
    const s2: any = await sessionModel.findById(session2Id).lean();
    expect(s1?.isTeacherPaid).toBe(true);
    expect(s2?.isTeacherPaid).toBe(true);
  });

  // ─────────────────────────────────────────────────────────────────────────
  //  Negative Test: TEACHER không thể sửa teaching-report đã bị khóa
  // ─────────────────────────────────────────────────────────────────────────

  it('Step 1 (negative/freeze): Teacher cannot edit teaching-report of a frozen session', async () => {
    // PayrollTransaction của session1 đang APPROVED → hệ thống phải ngăn chặn
    const editRes = await authWrite(
      request(app.getHttpServer()).patch(`/sessions/${session1Id}/teaching-report`),
      teacherSession,
    ).send({ lessonContent: 'Cố tình ghi đè dữ liệu đã chốt lương' });

    // Phải nhận 400 Bad Request (FIX FREEZE trong sessions.service.ts)
    expect(editRes.status).toBeGreaterThanOrEqual(400);
    expect(editRes.status).toBeLessThan(500);

    // Nội dung teaching-report KHÔNG được thay đổi
    const s1: any = await sessionModel.findById(session1Id).lean();
    expect(s1?.teachingReport?.lessonContent).not.toBe('Cố tình ghi đè dữ liệu đã chốt lương');
  });

  // ─────────────────────────────────────────────────────────────────────────
  //  Edge Case 1: Idempotency — bulk-generate lần 2 cho cùng kỳ
  // ─────────────────────────────────────────────────────────────────────────

  it('EC-1 (idempotency): Second bulk-generate for same period creates no duplicate payroll', async () => {
    const res = await authWrite(
      request(app.getHttpServer()).post('/payroll/bulk-generate'),
      accountingSession,
    ).send({ periodStart: PERIOD_START, periodEnd: PERIOD_END });

    expect([200, 201]).toContain(res.status);
    // Sessions đã bị lock (isTeacherPaid=true), không còn session nào để tạo mới
    // → created = 0, KHÔNG có thêm payroll nào được sinh ra
    expect(res.body.created).toBe(0);
    expect(res.body.errors).toHaveLength(0);

    // Xác nhận chỉ có đúng 1 payroll cho teacher trong kỳ này
    const count = await payrollModel.countDocuments({
      teacherId: new Types.ObjectId(teacherId),
      status: { $in: ['DRAFT', 'PENDING_REVIEW', 'APPROVED', 'PAID'] },
    });
    expect(count).toBe(1);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  //  BƯỚC 2: Giám đốc duyệt bảng lương (Submit → Approve)
  // ═══════════════════════════════════════════════════════════════════════════

  it('Step 2a: Accounting submits payroll for review → PENDING_REVIEW', async () => {
    const submitRes = await authWrite(
      request(app.getHttpServer()).post(`/payroll/${payrollId}/submit`),
      accountingSession,
    );

    expect([200, 201]).toContain(submitRes.status);
    expect(submitRes.body.status).toBe('PENDING_REVIEW');
  });

  it('Step 2b: Director approves payroll → APPROVED', async () => {
    // Non-director không được duyệt
    const forbiddenRes = await authWrite(
      request(app.getHttpServer()).post(`/payroll/${payrollId}/approve`),
      accountingSession,
    );
    expect(forbiddenRes.status).toBe(403);

    // Director duyệt thành công
    const approveRes = await authWrite(
      request(app.getHttpServer()).post(`/payroll/${payrollId}/approve`),
      directorSession,
    ).expect(201);

    expect(approveRes.body.status).toBe('APPROVED');

    // Xác nhận DB
    const payroll: any = await payrollModel.findById(payrollId).lean();
    expect(payroll?.status).toBe('APPROVED');
    expect(payroll?.approvedBy).toBeTruthy();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  //  BƯỚC 3: Kế toán xác nhận "Đã chi" → Chốt Quỹ & Cashflow
  // ═══════════════════════════════════════════════════════════════════════════

  it('Step 3a: Capture baseline cash-flow outflow before mark-paid', async () => {
    const cfRes = await authGet(
      request(app.getHttpServer()).get(
        `/financial-control/cash-flow?startDate=${PERIOD_START}&endDate=${PERIOD_END}`,
      ),
      directorSession,
    ).expect(200);

    baselineOutflow = cfRes.body.totalOutflow ?? 0;
    // Baseline phải là số hợp lệ
    expect(typeof baselineOutflow).toBe('number');
  });

  it('Step 3b: Accounting marks payroll PAID with bankAccountId → BankTransaction + CashFlow updated', async () => {
    // Ghi nhớ số dư trước khi chi
    const bankBefore: any = await bankAccountModel.findById(bankAccountId).lean();
    expect(bankBefore).toBeTruthy();
    const balanceBefore: number = bankBefore.currentBalance;

    // ── Hành động: mark-paid ──────────────────────────────────────────────
    const markPaidRes = await authWrite(
      request(app.getHttpServer()).post(`/payroll/${payrollId}/mark-paid`),
      accountingSession,
    ).send({ bankAccountId, paymentRef: 'UNC-SC4-2026-001' });

    expect([200, 201]).toContain(markPaidRes.status);

    // ── Kiểm chứng 1: Payroll status = PAID ──────────────────────────────
    expect(markPaidRes.body.status).toBe('PAID');
    expect(markPaidRes.body.paidAt).toBeTruthy();
    expect(markPaidRes.body.paymentRef).toBe('UNC-SC4-2026-001');

    const payroll: any = await payrollModel.findById(payrollId).lean();
    expect(payroll?.status).toBe('PAID');
    expect(payroll?.paidAt).toBeTruthy();

    // ── Kiểm chứng 2: BankTransaction được tạo đúng ──────────────────────
    const bankTx: any = await bankTransactionModel
      .findOne({ referenceId: new Types.ObjectId(payrollId) })
      .lean();

    expect(bankTx).toBeTruthy();
    expect(bankTx.type).toBe('WITHDRAWAL');
    expect(bankTx.category).toBe('PAYROLL');
    expect(bankTx.amount).toBe(payroll?.netAmount);
    expect(bankTx.bankAccountId.toString()).toBe(bankAccountId);
    expect(bankTx.referenceType).toBe('PAYROLL');

    // ── Kiểm chứng 3: Số dư ngân hàng giảm đúng bằng netAmount ──────────
    const bankAfter: any = await bankAccountModel.findById(bankAccountId).lean();
    expect(bankAfter?.currentBalance).toBe(balanceBefore - payroll?.netAmount);

    // ── Kiểm chứng 4: CashFlow totalOutflow tăng đúng bằng netAmount ─────
    // Lưu ý: paidAt được set lúc mark-paid (hôm nay = 2026-03-15), nằm trong kỳ
    const cfRes = await authGet(
      request(app.getHttpServer()).get(
        `/financial-control/cash-flow?startDate=${PERIOD_START}&endDate=${PERIOD_END}`,
      ),
      directorSession,
    ).expect(200);

    const currentOutflow: number = cfRes.body.totalOutflow ?? 0;
    expect(currentOutflow).toBe(baselineOutflow + payroll?.netAmount);

    // Tổng outflow.payroll trong timeline phải chứa khoản vừa chi
    const payrollOutflowSum: number = (cfRes.body.timeline as any[]).reduce(
      (acc: number, day: any) => acc + (day.outflow?.payroll ?? 0),
      0,
    );
    expect(payrollOutflowSum).toBeGreaterThanOrEqual(payroll?.netAmount);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  //  Edge Case 2: Fallback bankAccountId — hệ thống tự dùng tài khoản ACTIVE
  // ═══════════════════════════════════════════════════════════════════════════
  //
  //  Kịch bản: Kế toán gọi mark-paid KHÔNG gửi bankAccountId.
  //  Mong đợi:  resolveActiveBankAccountId() tự tìm tài khoản ACTIVE mặc định
  //             và vẫn sinh ra BankTransaction hợp lệ.
  //
  //  Để test độc lập, ta tạo session/payroll cho teacher2 ngay trong test này
  //  (sau khi teacher1's sessions đã bị lock, bulk-generate chỉ pick up teacher2).
  // ═══════════════════════════════════════════════════════════════════════════

  it('EC-2 (fallback): mark-paid without bankAccountId uses primary ACTIVE account', async () => {
    // ── 1. Seed 1 FINALIZED session cho teacher2 (chưa được tạo trong beforeAll) ─
    const SESSION_DATE_EC2 = '2026-03-10';

    const sess3 = await sessionModel.create({
      classId:              new Types.ObjectId(class2Id),
      studentId:            new Types.ObjectId(student2Id),
      teacherId:            new Types.ObjectId(teacher2Id),
      parentUserId:         new Types.ObjectId(parentId),
      scheduledDate:        toUtcDate(SESSION_DATE_EC2, '14:00'),
      scheduledStartTime:   '14:00',
      scheduledEndTime:     '15:00',
      durationMinutes:      60,
      teacherPayout:        90_000,
      amountCharged:        180_000,
      status:               'FINALIZED',
      hasTeachingReport:    true,
      teachingReport: {
        lessonContent:   'Tập làm văn – buổi EC2',
        submittedAt:     toUtcDate(SESSION_DATE_EC2, '15:30'),
      },
      confirmation: {
        finalizedAt: toUtcDate(SESSION_DATE_EC2, '15:15'),
        finalizedBy: new Types.ObjectId(opsId),
      },
      isTeacherPaid: false,
      isPaid:        true,
    });
    const session3Id = String(sess3._id);

    // ── 2. Attendance PRESENT ──────────────────────────────────────────────
    await attendanceModel.create({
      classId:   new Types.ObjectId(class2Id),
      studentId: new Types.ObjectId(student2Id),
      teacherId: new Types.ObjectId(teacher2Id),
      date:      toUtcDate(SESSION_DATE_EC2, '14:00'),
      status:    'PRESENT',
      sessionId: new Types.ObjectId(session3Id),
    });

    // ── 3. PayrollTransaction APPROVED cho teacher2 ────────────────────────
    await payrollTxModel.create({
      teacherId:   new Types.ObjectId(teacher2Id),
      sessionId:   new Types.ObjectId(session3Id),
      classId:     new Types.ObjectId(class2Id),
      studentId:   new Types.ObjectId(student2Id),
      sessionDate: toUtcDate(SESSION_DATE_EC2, '14:00'),
      baseSalary:  90_000,
      penaltyAmount: 0,
      finalSalary: 90_000,
      status:      'APPROVED',
    });

    // ── 4. Bulk-generate kỳ tháng 3 → chỉ pick up teacher2 (teacher1 đã locked) ─
    const bulkRes = await authWrite(
      request(app.getHttpServer()).post('/payroll/bulk-generate'),
      accountingSession,
    ).send({ periodStart: PERIOD_START, periodEnd: PERIOD_END });

    expect([200, 201]).toContain(bulkRes.status);
    expect(bulkRes.body.created).toBe(1); // Chỉ teacher2

    const payroll2: any = await payrollModel
      .findOne({ teacherId: new Types.ObjectId(teacher2Id), status: 'DRAFT' })
      .lean();
    expect(payroll2).toBeTruthy();
    const payroll2Id = String(payroll2._id);

    // ── 5. Submit + Approve payroll2 ──────────────────────────────────────
    await authWrite(
      request(app.getHttpServer()).post(`/payroll/${payroll2Id}/submit`),
      accountingSession,
    ).expect((r) => { expect([200, 201]).toContain(r.status); });

    await authWrite(
      request(app.getHttpServer()).post(`/payroll/${payroll2Id}/approve`),
      directorSession,
    ).expect(201);

    // ── 6. Mark-paid BỎ TRỐNG bankAccountId → fallback dùng tài khoản ACTIVE ─
    const bankBefore: any = await bankAccountModel.findById(bankAccountId).lean();
    const balanceBefore: number = bankBefore.currentBalance;

    const fallbackRes = await authWrite(
      request(app.getHttpServer()).post(`/payroll/${payroll2Id}/mark-paid`),
      accountingSession,
    ).send({ paymentRef: 'UNC-SC4-EC2-FALLBACK' });
    // Không gửi bankAccountId!

    expect([200, 201]).toContain(fallbackRes.status);
    expect(fallbackRes.body.status).toBe('PAID');

    // ── 7. BankTransaction phải được tạo với tài khoản ACTIVE mặc định ────
    const bankTx2: any = await bankTransactionModel
      .findOne({ referenceId: new Types.ObjectId(payroll2Id) })
      .lean();

    expect(bankTx2).toBeTruthy();
    expect(bankTx2.type).toBe('WITHDRAWAL');
    expect(bankTx2.category).toBe('PAYROLL');
    // Phải dùng đúng bankAccountId duy nhất đang ACTIVE (auto-resolved)
    expect(bankTx2.bankAccountId.toString()).toBe(bankAccountId);

    // ── 8. Số dư ngân hàng giảm đúng khoản vừa chi ───────────────────────
    const bankAfter: any = await bankAccountModel.findById(bankAccountId).lean();
    const payroll2Loaded: any = await payrollModel.findById(payroll2Id).lean();
    expect(bankAfter?.currentBalance).toBe(balanceBefore - payroll2Loaded?.netAmount);
  });
});
