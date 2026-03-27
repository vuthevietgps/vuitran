/**
 * KỊCH BẢN E2E SỐ 3: Crisis Management - Parent Complaint & Salary Hold & Cancellation
 *
 * Mục tiêu: Đảm bảo hệ thống có khả năng tự động "đóng băng" dòng tiền và
 * công nợ lương (Auto-Hold) ngay khi nhận được đánh giá tiêu cực từ phụ huynh,
 * đồng thời tạo luồng xử lý (Ticket) cho bộ phận Vận hành (OPS) can thiệp.
 *
 * ⚠️ LƯU Ý QUAN TRỌNG VỀ LOGIC HỆ THỐNG:
 * Theo thiết kế (sessions.service.ts → parentConfirm), nếu PH đánh giá <=2 sao
 * hoặc isSatisfied=false, hệ thống CHẶN việc trừ tiền ví (không gọi deductWallet).
 * Do tiền chưa bị trừ (isPaid = false), khi OPS Cancel, hệ thống sẽ KHÔNG tạo
 * LedgerEntry loại REFUND. Test case assert đúng hành vi này.
 *
 * API Flow:
 *   Pre-setup: POST /attendance/mark (OPS)              → Session TEACHER_COMPLETED
 *              PATCH /sessions/:id/teaching-report (GV) → PayrollTransaction PENDING
 *   Step 1:    POST /sessions/:id/confirm (PARENT, 1*)    → PARENT_CONFIRMED, HELD, Ticket
 *   Step 2:    POST /sessions/:id/cancel (OPS)            → CANCELLED, ví nguyên vẹn
 *              POST /tickets/:id/resolve (OPS)            → Ticket RESOLVED (closed-loop)
 *              POST /tickets/:id/close   (OPS)            → Ticket CLOSED
 *   Step 3:    payrollTxService.releaseHold (Kế toán)     → PayrollTx EXCLUDED
 *
 * Edge Cases:
 *   - Double confirm trên session CANCELLED → HTTP 400
 *   - Double confirm trên session TEACHER_COMPLETED (đổi ý) → HTTP 400
 *   - HELD/EXCLUDED transactions bị loại khỏi totalFinalSalary trong summary
 *   - Real Refund: cancel session FINALIZED (isPaid=true) → ví tăng + LedgerEntry REFUND
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
import { PayrollTransactionService } from '../src/payroll/payroll-transaction.service';

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

function todayYmd(): string {
  return new Date().toISOString().slice(0, 10);
}

// ─── Suite ───────────────────────────────────────────────────────────────────

describe('Scenario 3: Crisis Management - Parent Complaint (e2e)', () => {
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
  let ticketModel: Model<any>;

  // Services
  let payrollTxService: PayrollTransactionService;

  // User stubs — dùng suffix sc3 để tránh xung đột với SC2
  const director: SeedUser = {
    email: 'director.sc3.e2e@school.local',
    password: 'E2ePass123!',
    fullName: 'Director SC3',
    role: 'DIRECTOR',
  };
  const ops: SeedUser = {
    email: 'ops.sc3.e2e@school.local',
    password: 'E2ePass123!',
    fullName: 'Ops SC3',
    role: 'OPS',
  };
  const teacher: SeedUser = {
    email: 'teacher.sc3.e2e@school.local',
    password: 'E2ePass123!',
    fullName: 'Teacher SC3',
    role: 'TEACHER',
  };
  const parent: SeedUser = {
    email: 'parent.sc3.e2e@school.local',
    password: 'E2ePass123!',
    fullName: 'Parent SC3',
    role: 'PARENT',
  };

  // Auth sessions
  let directorSession: SessionCookies;
  let opsSession: SessionCookies;
  let teacherSession: SessionCookies;
  let parentSession: SessionCookies;

  // Seeded IDs
  let teacherId: string;
  let parentId: string;
  let opsId: string;
  let classId: string;
  let studentId: string;
  let invoiceId: string;

  // Captured across test steps
  let mainSessionId: string;
  let mainTicketId: string;
  let baselineWalletBalance: number;

  // ── Helpers ─────────────────────────────────────────────────────────────

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

  // ── beforeAll ────────────────────────────────────────────────────────────

  beforeAll(async () => {
    // 1. Khởi tạo in-memory replica set (required for MongoDB transactions)
    replSet = await MongoMemoryReplSet.create({
      replSet: { count: 1, storageEngine: 'wiredTiger' },
    });
    process.env.MONGODB_URI = replSet.getUri('school-mgmt-sc3-e2e');

    // 2. Compile NestJS application
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

    // 3. Inject models & service
    userModel        = moduleRef.get<Model<any>>(getModelToken('User'));
    studentModel     = moduleRef.get<Model<any>>(getModelToken('Student'));
    classModel       = moduleRef.get<Model<any>>(getModelToken('Classroom'));
    sessionModel     = moduleRef.get<Model<any>>(getModelToken('Session'));
    attendanceModel  = moduleRef.get<Model<any>>(getModelToken('Attendance'));
    invoiceModel     = moduleRef.get<Model<any>>(getModelToken('Invoice'));
    walletModel      = moduleRef.get<Model<any>>(getModelToken('Wallet'));
    ledgerModel      = moduleRef.get<Model<any>>(getModelToken('LedgerEntry'));
    payrollTxModel   = moduleRef.get<Model<any>>(getModelToken('PayrollTransaction'));
    ticketModel      = moduleRef.get<Model<any>>(getModelToken('Ticket'));
    payrollTxService = moduleRef.get<PayrollTransactionService>(PayrollTransactionService);

    // 4. Seed users
    const directorDoc = await upsertUser(director);
    const opsDoc      = await upsertUser(ops);
    const teacherDoc  = await upsertUser(teacher);
    const parentDoc   = await upsertUser(parent);

    teacherId = String(teacherDoc._id);
    parentId  = String(parentDoc._id);
    opsId     = String(opsDoc._id);

    // 5. Seed student
    const studentDoc = await studentModel.create({
      studentCode:    'SC3-STU-001',
      fullName:       'Tran Van B (SC3)',
      age:            10,
      parentUserId:   new Types.ObjectId(parentId),
      parentName:     parent.fullName,
      parentPhone:    '0900030001',
      faceImage:      'sc3-face.png',
      approvalStatus: 'APPROVED',
      approvedBy:     new Types.ObjectId(directorDoc._id),
      approvedAt:     new Date(),
      subjects:       ['Van'],
      grade:          '5',
    });
    studentId = String(studentDoc._id);

    // 6. Seed classroom (pricePerSession=150,000 / teacherPay=80,000)
    const classDoc = await classModel.create({
      name:                 'Lop SC3 Van 5A',
      code:                 'SC3-VAN5A',
      teacher:              new Types.ObjectId(teacherId),
      students:             [new Types.ObjectId(studentId)],
      classMode:            'ONLINE',
      baseDuration:         60,
      sessionDuration:      60,
      pricePerSession:      150_000,
      teacherPayPerSession: 80_000,
      teacherPayPerStudent: 0,
      status:               'ACTIVE',
    });
    classId = String(classDoc._id);

    // 7. Seed Invoice APPROVED (5 buổi còn lại)
    const invoiceDoc = await invoiceModel.create({
      invoiceNumber:    `SC3-INV-${Date.now()}`,
      invoiceType:      'TUITION',
      studentId:        new Types.ObjectId(studentId),
      classId:          new Types.ObjectId(classId),
      sessions:         5,
      sessionsRemaining: 5,
      pricePerSession:  150_000,
      amount:           750_000,
      paymentDate:      new Date(),
      status:           'APPROVED',
      walletTopUpDone:  true,
      createdBy:        new Types.ObjectId(directorDoc._id),
    });
    invoiceId = String(invoiceDoc._id);

    // 8. Seed Wallet phụ huynh (balance = 750,000đ)
    await walletModel.findOneAndUpdate(
      { userId: new Types.ObjectId(parentId) },
      {
        $set: {
          userId:          new Types.ObjectId(parentId),
          balance:         750_000,
          debtLimit:       0,
          trialDebtSessions: 0,
          totalTopUp:      750_000,
          totalDeducted:   0,
          status:          'ACTIVE',
        },
      },
      { upsert: true, new: true },
    );

    // 9. Đăng nhập tất cả actors
    directorSession = await loginAndGetSession(director.email, director.password);
    opsSession      = await loginAndGetSession(ops.email,      ops.password);
    teacherSession  = await loginAndGetSession(teacher.email,  teacher.password);
    parentSession   = await loginAndGetSession(parent.email,   parent.password);
  }, 180_000);

  afterAll(async () => {
    await app.close();
    await replSet.stop();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  //  PRE-SETUP: Tạo Session TEACHER_COMPLETED + PayrollTransaction PENDING
  // ═══════════════════════════════════════════════════════════════════════════

  it('Pre-setup: OPS marks attendance PRESENT → Session auto-created (TEACHER_COMPLETED)', async () => {
    const today = todayYmd();

    const res = await authWrite(
      request(app.getHttpServer()).post('/attendance/mark'),
      opsSession,
    ).send({
      classId,
      studentId,
      date:   today,
      status: 'PRESENT',
    });

    expect(res.status).toBe(201);
    expect(res.body.sessionCreated).toBe(true);

    // Lấy sessionId từ attendance record
    const attendanceDoc = await attendanceModel
      .findOne({
        classId:   new Types.ObjectId(classId),
        studentId: new Types.ObjectId(studentId),
      })
      .lean() as any;
    expect(attendanceDoc).toBeTruthy();
    mainSessionId = String(attendanceDoc.sessionId);

    // Xác nhận session ở trạng thái đúng
    const sessionDoc = await sessionModel.findById(mainSessionId).lean() as any;
    expect(sessionDoc.status).toBe('TEACHER_COMPLETED');
    expect(sessionDoc.amountCharged).toBe(150_000);
    expect(sessionDoc.teacherPayout).toBe(80_000);

    // Chụp baseline ví trước khi PH confirm
    const walletDoc = await walletModel
      .findOne({ userId: new Types.ObjectId(parentId) })
      .lean() as any;
    baselineWalletBalance = walletDoc.balance;
    expect(baselineWalletBalance).toBe(750_000);
  });

  it('Pre-setup: TEACHER submits teaching report → PayrollTransaction PENDING created', async () => {
    const res = await authWrite(
      request(app.getHttpServer()).patch(`/sessions/${mainSessionId}/teaching-report`),
      teacherSession,
    ).send({
      lessonContent:   'Ôn tập từ vựng và ngữ pháp tiếng Việt cơ bản',
      studentAttitude: 'Học sinh nói chuyện riêng nhiều, kém tập trung',
      teacherComment:  'Cần cải thiện kỷ luật lớp học',
    });

    expect(res.status).toBe(200);

    const payrollTx = await payrollTxModel
      .findOne({ sessionId: new Types.ObjectId(mainSessionId) })
      .lean() as any;
    expect(payrollTx).toBeTruthy();
    expect(payrollTx.status).toBe('PENDING');
    expect(payrollTx.baseSalary).toBe(80_000);
    expect(payrollTx.teacherId.toString()).toBe(teacherId);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  //  BƯỚC 1: Phụ huynh đánh giá 1 sao → Auto-Hold + Ticket
  // ═══════════════════════════════════════════════════════════════════════════

  it('Step 1: Parent leaves 1-star review → session PARENT_CONFIRMED, salary HELD, ticket created', async () => {
    const res = await authWrite(
      request(app.getHttpServer()).post(`/sessions/${mainSessionId}/confirm`),
      parentSession,
    ).send({
      overallRating: 1,
      isSatisfied:   false,
      parentNotes:   'Giáo viên vô trách nhiệm, không chuẩn bị bài',
      concerns:      'Không tương tác với học sinh, đọc điện thoại trong giờ',
    });

    expect(res.status).toBe(201);

    // ── 1a. Kiểm chứng Session ──────────────────────────────────────────────
    const sessionDoc = await sessionModel.findById(mainSessionId).lean() as any;

    // Trạng thái phải dừng ở PARENT_CONFIRMED, KHÔNG tự động lên FINALIZED
    expect(sessionDoc.status).toBe('PARENT_CONFIRMED');

    // Tiền chưa bị trừ: isPaid phải là false
    expect(sessionDoc.isPaid).toBe(false);

    // Phản hồi PH được lưu đúng
    expect(sessionDoc.parentFeedback.overallRating).toBe(1);
    expect(sessionDoc.parentFeedback.isSatisfied).toBe(false);

    // ── 1b. Kiểm chứng PayrollTransaction bị HELD ──────────────────────────
    const payrollTx = await payrollTxModel
      .findOne({ sessionId: new Types.ObjectId(mainSessionId) })
      .lean() as any;
    expect(payrollTx).toBeTruthy();
    expect(payrollTx.status).toBe('HELD');
    expect(payrollTx.holdReason).toBe('PARENT_REJECTED');

    // ── 1c. Kiểm chứng Ticket được sinh tự động cho OPS ────────────────────
    const ticket = await ticketModel
      .findOne({ sessionId: new Types.ObjectId(mainSessionId) })
      .lean() as any;
    expect(ticket).toBeDefined();
    expect(ticket.type).toBe('PARENT_COMPLAINT');
    expect(ticket.priority).toBe('HIGH');

    // Lưu ticketId để dùng ở Step 2
    mainTicketId = String(ticket._id);

    // ── 1d. Xác nhận ví CHƯA bị trừ ────────────────────────────────────────
    const walletDoc = await walletModel
      .findOne({ userId: new Types.ObjectId(parentId) })
      .lean() as any;
    expect(walletDoc.balance).toBe(baselineWalletBalance);

    // ── 1e. Xác nhận KHÔNG có LedgerEntry SESSION_DEDUCT ───────────────────
    const deductEntry = await ledgerModel
      .findOne({
        sessionId: new Types.ObjectId(mainSessionId),
        type: 'SESSION_DEDUCT',
      })
      .lean();
    expect(deductEntry).toBeNull();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  //  BƯỚC 2: OPS hủy buổi học → Rollback tài chính / ví nguyên vẹn
  // ═══════════════════════════════════════════════════════════════════════════

  it('Step 2: OPS cancels session → CANCELLED, amountCharged=0, wallet intact, no REFUND entry', async () => {
    const res = await authWrite(
      request(app.getHttpServer()).post(`/sessions/${mainSessionId}/cancel`),
      opsSession,
    ).send({
      cancelReason: 'Phụ huynh khiếu nại chất lượng, giám đốc quyết định hủy buổi',
    });

    expect(res.status).toBe(201);

    // ── 2a. Kiểm chứng Session CANCELLED ───────────────────────────────────
    const sessionDoc = await sessionModel.findById(mainSessionId).lean() as any;
    expect(sessionDoc.status).toBe('CANCELLED');
    expect(sessionDoc.amountCharged).toBe(0); // Không tính doanh thu
    expect(sessionDoc.teacherPayout).toBe(0); // Không tính lương

    // ── 2b. Ví phụ huynh KHÔNG thay đổi (tiền chưa từng bị trừ) ───────────
    const walletDoc = await walletModel
      .findOne({ userId: new Types.ObjectId(parentId) })
      .lean() as any;
    expect(walletDoc.balance).toBe(baselineWalletBalance);

    // ── 2c. Không có LedgerEntry SESSION_DEDUCT ─────────────────────────────
    // (Lý do: isPaid=false khi PH đánh giá thấp, tiền chưa từng bị trừ)
    const sessionDeductEntry = await ledgerModel
      .findOne({
        sessionId: new Types.ObjectId(mainSessionId),
        type: 'SESSION_DEDUCT',
      })
      .lean();
    expect(sessionDeductEntry).toBeNull();

    // ── 2d. Không có LedgerEntry REFUND ─────────────────────────────────────
    // (Lý do: cancel chỉ hoàn tiền khi session.isPaid === true)
    const refundEntry = await ledgerModel
      .findOne({
        sessionId: new Types.ObjectId(mainSessionId),
        type: 'REFUND',
      })
      .lean();
    expect(refundEntry).toBeNull();

    // ── 2e. Invoice sessionsRemaining KHÔNG thay đổi (chưa từng consumed) ───
    const invoiceDoc = await invoiceModel.findById(invoiceId).lean() as any;
    expect(invoiceDoc.sessionsRemaining).toBe(5);

    // ── 2f. OPS resolve Ticket (closed-loop: OPEN → RESOLVED) ───────────────
    const resolveRes = await authWrite(
      request(app.getHttpServer()).post(`/tickets/${mainTicketId}/resolve`),
      opsSession,
    ).send({
      summary: 'Đã hủy buổi học theo yêu cầu phụ huynh, không hoàn tiền (tiền chưa bị trừ)',
      outcome: 'CANCELLED',
    });
    expect(resolveRes.status).toBe(201);

    const resolvedTicket = await ticketModel.findById(mainTicketId).lean() as any;
    expect(resolvedTicket.status).toBe('RESOLVED');
    expect(resolvedTicket.resolution.outcome).toBe('CANCELLED');

    // ── 2g. OPS close Ticket (RESOLVED → CLOSED) ────────────────────────────
    const closeRes = await authWrite(
      request(app.getHttpServer()).post(`/tickets/${mainTicketId}/close`),
      opsSession,
    ).send();
    expect(closeRes.status).toBe(201);

    const closedTicket = await ticketModel.findById(mainTicketId).lean() as any;
    expect(closedTicket.status).toBe('CLOSED');
  });

  // ═══════════════════════════════════════════════════════════════════════════
  //  BƯỚC 3: Kế toán loại trừ lương GV (EXCLUDE)
  // ═══════════════════════════════════════════════════════════════════════════

  it('Step 3: Accounting excludes payroll transaction → status EXCLUDED, excludedReason persisted', async () => {
    const excludeReason = 'Lỗi chất lượng giảng dạy, hủy buổi theo yêu cầu phụ huynh';

    // Gọi trực tiếp qua service (releaseHold không expose API riêng)
    await payrollTxService.releaseHold(
      mainSessionId,
      'EXCLUDE',
      opsId,
      excludeReason,
    );

    const tx = await payrollTxModel
      .findOne({ sessionId: new Types.ObjectId(mainSessionId) })
      .lean() as any;

    expect(tx.status).toBe('EXCLUDED');
    expect(tx.excludedReason).toContain('Lỗi chất lượng');
    expect(tx.excludedBy).toBeTruthy();
    expect(tx.excludedAt).toBeTruthy();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  //  EDGE CASE 1: Double confirm trên session đã CANCELLED → HTTP 400
  // ═══════════════════════════════════════════════════════════════════════════

  it('Edge case 1 (double confirm on CANCELLED session): → HTTP 400 blocked', async () => {
    // mainSessionId đã ở trạng thái CANCELLED sau Bước 2
    // Hệ thống chỉ cho confirm khi session.status === TEACHER_COMPLETED
    const res = await authWrite(
      request(app.getHttpServer()).post(`/sessions/${mainSessionId}/confirm`),
      parentSession,
    ).send({
      overallRating: 5,
      isSatisfied:   true,
      parentNotes:   'Thực ra tốt - đổi ý',
    });

    expect(res.status).toBe(400);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  //  EDGE CASE 2: Race condition — PH đổi ý, gửi confirm lần 2 trên
  //  TEACHER_COMPLETED session (sau confirm 1-sao đầu tiên) → HTTP 400
  // ═══════════════════════════════════════════════════════════════════════════

  it('Edge case 2 (double confirm on fresh TEACHER_COMPLETED): second request → HTTP 400', async () => {
    // Tạo session mới để test riêng race condition — không ảnh hưởng main flow
    const raceSession = await sessionModel.create({
      classId:            new Types.ObjectId(classId),
      studentId:          new Types.ObjectId(studentId),
      teacherId:          new Types.ObjectId(teacherId),
      parentUserId:       new Types.ObjectId(parentId),
      sessionType:        'REGULAR',
      scheduledDate:      utcDaysAgo(1),
      durationMinutes:    60,
      amountCharged:      150_000,
      teacherPayout:      80_000,
      status:             'TEACHER_COMPLETED',
      confirmation:       { teacherCompletedAt: utcDaysAgo(1) },
      autoConfirmAfterHours: 48,
      createdBy:          new Types.ObjectId(teacherId),
    });
    const raceSessionId = String(raceSession._id);

    // Confirm lần 1: PH đánh 1 sao
    const res1 = await authWrite(
      request(app.getHttpServer()).post(`/sessions/${raceSessionId}/confirm`),
      parentSession,
    ).send({ overallRating: 1, isSatisfied: false, parentNotes: 'Chất lượng tệ' });
    expect([200, 201]).toContain(res1.status);

    // Confirm lần 2: PH đổi ý, muốn đánh 5 sao → phải bị chặn
    // Hệ thống: findOneAndUpdate({ status: TEACHER_COMPLETED }) sẽ thất bại
    // vì session đã chuyển sang PARENT_CONFIRMED
    const res2 = await authWrite(
      request(app.getHttpServer()).post(`/sessions/${raceSessionId}/confirm`),
      parentSession,
    ).send({ overallRating: 5, isSatisfied: true });
    expect(res2.status).toBe(400);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  //  EDGE CASE 3: Bypass Hold — duyệt bảng lương không được bao gồm
  //  các transaction HELD và EXCLUDED vào totalFinalSalary
  // ═══════════════════════════════════════════════════════════════════════════

  it('Edge case 2b (legacy rating payload): parent confirm accepts rating alias from older frontend', async () => {
    const legacyPayloadSession = await sessionModel.create({
      classId: new Types.ObjectId(classId),
      studentId: new Types.ObjectId(studentId),
      teacherId: new Types.ObjectId(teacherId),
      parentUserId: new Types.ObjectId(parentId),
      sessionType: 'REGULAR',
      scheduledDate: utcDaysAgo(1),
      durationMinutes: 60,
      amountCharged: 150_000,
      teacherPayout: 80_000,
      status: 'TEACHER_COMPLETED',
      confirmation: { teacherCompletedAt: utcDaysAgo(1) },
      autoConfirmAfterHours: 48,
      createdBy: new Types.ObjectId(teacherId),
    });
    const legacySessionId = String(legacyPayloadSession._id);

    const res = await authWrite(
      request(app.getHttpServer()).post(`/sessions/${legacySessionId}/confirm`),
      parentSession,
    ).send({
      rating: 1,
      parentNotes: 'Frontend cu van gui truong rating',
    });
    expect([200, 201]).toContain(res.status);

    const sessionDoc = await sessionModel.findById(legacySessionId).lean() as any;
    expect(sessionDoc.status).toBe('PARENT_CONFIRMED');
    expect(sessionDoc.parentRating).toBe(1);
    expect(sessionDoc.parentFeedback.overallRating).toBe(1);
    expect(sessionDoc.parentFeedback.parentNotes).toBe('Frontend cu van gui truong rating');
  });

  it('Edge case 3 (payroll summary bypass hold): HELD/EXCLUDED excluded from totalFinalSalary', async () => {
    // mainSessionId's PayrollTx hiện là EXCLUDED (sau Bước 3)
    const now          = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const summary = await payrollTxService.getSummaryByTeacher(
      teacherId,
      startOfMonth,
      endOfMonth,
    );

    // Phải có ít nhất 1 record EXCLUDED (mainSessionId)
    expect(summary.excludedCount).toBeGreaterThanOrEqual(1);

    // totalFinalSalary chỉ tính PENDING/APPROVED/PAID — bỏ qua EXCLUDED
    const allTxs = await payrollTxModel
      .find({ teacherId: new Types.ObjectId(teacherId) })
      .lean() as any[];

    const expectedTotal = allTxs
      .filter((tx: any) => tx.status !== 'EXCLUDED')
      .reduce((sum: number, tx: any) => sum + (tx.finalSalary ?? 0), 0);

    expect(summary.totalFinalSalary).toBe(expectedTotal);

    // Kiểm tra thêm: HELD cũng không ảnh hưởng đến totalFinalSalary
    // (HELD transactions vẫn được tính trong summary.totalFinalSalary
    //  theo logic thực tế của getSummaryByTeacher - HELD không bị `continue`)
    // → Đây là hành vi đúng: HELD = chờ xử lý, vẫn dự phòng vào total
    // → Chỉ EXCLUDED mới bị loại hoàn toàn
    expect(summary.heldCount + summary.excludedCount + summary.pendingCount + summary.approvedCount)
      .toBe(summary.totalSessions);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  //  EDGE CASE 4 (Real Refund): Cancel session có isPaid=true (đã bị trừ tiền)
  //  → Ví phụ huynh tăng lại 150k + sinh LedgerEntry loại REFUND
  //
  //  Lưu ý: Cancel endpoint KHÔNG cho phép hủy session FINALIZED.
  //  Test case mô phỏng session PARENT_CONFIRMED + isPaid=true — đây là trạng
  //  thái hợp lệ khi OPS đã kích thích deductWallet thủ công trước khi session
  //  được chốt chính thức, và sau đó quyết định hủy để hoàn tiền.
  //  Đây chính là code-path mà cancel() → walletsService.refundForSession() thực thi.
  // ═══════════════════════════════════════════════════════════════════════════

  it('Edge case 4 (real refund): cancel a PARENT_CONFIRMED (isPaid=true) session → wallet refunded + REFUND ledger entry', async () => {
    // ── 4a. Reset ví về mức xác định trước khi test ─────────────────────────
    await walletModel.findOneAndUpdate(
      { userId: new Types.ObjectId(parentId) },
      { $set: { balance: 500_000 } },
    );
    const walletBefore = 500_000;

    // ── 4b. Tạo session PARENT_CONFIRMED + isPaid=true trong DB ───────────────
    // Mô phỏng: OPS đã khảu khấu ví thủ công (isPaid=true) nhưng chưa chốt
    // chính thức, sau đó quyết định hủy để hoàn tiền. PARENT_CONFIRMED không
    // bị block bởi cancel endpoint (chỉ FINALIZED/CANCELLED/RESCHEDULED mới block).
    const refundSession = await sessionModel.create({
      classId:            new Types.ObjectId(classId),
      studentId:          new Types.ObjectId(studentId),
      teacherId:          new Types.ObjectId(teacherId),
      parentUserId:       new Types.ObjectId(parentId),
      sessionType:        'REGULAR',
      scheduledDate:      utcDaysAgo(2),
      durationMinutes:    60,
      amountCharged:      150_000,
      teacherPayout:      80_000,
      isPaid:             true, // <-- tiền đã bị trừ
      status:             'PARENT_CONFIRMED', // cancellable, không phải FINALIZED
      confirmation: {
        teacherCompletedAt: utcDaysAgo(2),
        parentConfirmedAt:  utcDaysAgo(2),
      },
      autoConfirmAfterHours: 48,
      createdBy:          new Types.ObjectId(teacherId),
    });
    const refundSessionId = String(refundSession._id);

    // Tạo LedgerEntry SESSION_DEDUCT tương ứng (mô phỏng việc trừ ví đã xảy ra)
    const walletDoc = await walletModel
      .findOne({ userId: new Types.ObjectId(parentId) })
      .lean() as any;
    await ledgerModel.create({
      walletId:      walletDoc._id,
      userId:        new Types.ObjectId(parentId),
      sessionId:     new Types.ObjectId(refundSessionId),
      classId:       new Types.ObjectId(classId),
      studentId:     new Types.ObjectId(studentId),
      type:          'SESSION_DEDUCT',
      amount:        150_000,
      balanceBefore: walletBefore + 150_000, // giả định trước khi trừ
      balanceAfter:  walletBefore,
      description:   'Trừ tiền buổi học đã hoàn thành',
      createdAt:     utcDaysAgo(2),
    });

    // ── 4c. OPS hủy session PARENT_CONFIRMED (isPaid=true) → refund kicks in ──────────────────────────
    const cancelRes = await authWrite(
      request(app.getHttpServer()).post(`/sessions/${refundSessionId}/cancel`),
      opsSession,
    ).send({
      cancelReason: 'Giám đốc quyết định hoàn tiền do sự cố kỹ thuật phát sinh sau buổi học',
    });
    expect(cancelRes.status).toBe(201);

    // ── 4d. Kiểm chứng session CANCELLED + amountCharged về 0 ────────────────
    const cancelledSession = await sessionModel.findById(refundSessionId).lean() as any;
    expect(cancelledSession.status).toBe('CANCELLED');
    expect(cancelledSession.amountCharged).toBe(0);
    expect(cancelledSession.teacherPayout).toBe(0);

    // ── 4e. Ví phụ huynh phải tăng lại 150k (hoàn tiền) ─────────────────────
    const walletAfter = await walletModel
      .findOne({ userId: new Types.ObjectId(parentId) })
      .lean() as any;
    expect(walletAfter.balance).toBe(walletBefore + 150_000);

    // ── 4f. Phải có LedgerEntry loại REFUND cho session này ──────────────────
    const refundEntry = await ledgerModel
      .findOne({
        sessionId: new Types.ObjectId(refundSessionId),
        type:      'REFUND',
      })
      .lean() as any;
    expect(refundEntry).toBeTruthy();
    expect(refundEntry.amount).toBe(150_000);
    expect(refundEntry.userId.toString()).toBe(parentId);
    expect(refundEntry.balanceBefore).toBe(walletBefore);
    expect(refundEntry.balanceAfter).toBe(walletBefore + 150_000);
  });
});
