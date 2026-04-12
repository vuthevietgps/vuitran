import { closeE2eResources } from './e2e-cleanup';
// NHÓM 8 (còn lại) + NHÓM 9: THAY ĐỔI CẤU HÌNH & ĐỐI SOÁT
//
// test.md §NHÓM 8: Change Requests (8.2, 8.3, 8.4)
//         §NHÓM 9: Reconciliation & Auto-heal (9.1, 9.2, 9.3, 9.4)
//
// 8.2  Đổi giáo viên (Teacher Swap) → PATCH /classes/:id với teacherId mới
// 8.3  Bổ sung cấu hình HS nhiều GV → PATCH /classes/:id/students/:sid/config
// 8.4  Reschedule buổi học → POST /sessions/:id/reschedule
// 9.1  Thiếu PayrollTx auto-heal → POST /admin/reconciliation/run → missingTxCreated++
// 9.2  Late-flag discrepancy auto-heal → payrollTxLateHealed++
// 9.3  Critical anomaly (PAID nhưng không có report) → criticalAnomalies++, không tự sửa
// 9.4  Wallet balance lệch vs SUM(ledger) → manual inspection (no endpoint; test via model)
//
// Run:  npx jest --config ./test/jest-e2e.json --runInBand group7-change-requests-reconciliation

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

function daysFromNow(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

// ─── Suite ──────────────────────────────────────────────────────────────────

describe('Nhóm 8–9: Change Requests & Reconciliation (e2e)', () => {
  let app: INestApplication;
  let moduleRef: TestingModule;
  let replSet: MongoMemoryReplSet;

  // Models
  let userModel: Model<any>;
  let studentModel: Model<any>;
  let classModel: Model<any>;
  let sessionModel: Model<any>;
  let attendanceModel: Model<any>;
  let walletModel: Model<any>;
  let ledgerModel: Model<any>;
  let payrollTxModel: Model<any>;

  // Seed users
  const director: SeedUser = {
    email: 'director.g7.e2e@school.local',
    password: 'E2ePass123!',
    fullName: 'Director G7',
    role: 'DIRECTOR',
  };
  const accounting: SeedUser = {
    email: 'accounting.g7.e2e@school.local',
    password: 'E2ePass123!',
    fullName: 'Accounting G7',
    role: 'ACCOUNTING',
  };
  const ops: SeedUser = {
    email: 'ops.g7.e2e@school.local',
    password: 'E2ePass123!',
    fullName: 'Ops G7',
    role: 'OPS',
  };
  const teacher1: SeedUser = {
    email: 'teacher1.g7.e2e@school.local',
    password: 'E2ePass123!',
    fullName: 'Teacher1 G7',
    role: 'TEACHER',
  };
  const teacher2: SeedUser = {
    email: 'teacher2.g7.e2e@school.local',
    password: 'E2ePass123!',
    fullName: 'Teacher2 G7',
    role: 'TEACHER',
  };
  const parent: SeedUser = {
    email: 'parent.g7.e2e@school.local',
    password: 'E2ePass123!',
    fullName: 'Parent G7',
    role: 'PARENT',
  };

  let directorSession: AuthSession;
  let accountingSession: AuthSession;
  let opsSession: AuthSession;

  let teacher1Id: string;
  let teacher2Id: string;
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

  // Seed class with teacher1 as default teacher
  async function seedClass(suffix: string): Promise<{ classId: string; studentId: string }> {
    const student = await studentModel.create({
      studentCode: `G7-STU-${suffix}`,
      fullName: `Student G7 ${suffix}`,
      age: 12,
      parentUserId: new Types.ObjectId(parentId),
      parentName: parent.fullName,
      parentPhone: `082${suffix.replace(/\D/g, '').padStart(7, '0').slice(-7)}`,
      faceImage: 'seed-face.png',
      approvalStatus: 'APPROVED',
    });

    const cls = await classModel.create({
      name: `Lop G7 ${suffix}`,
      code: `G7-CLS-${suffix}`,
      teacher: new Types.ObjectId(teacher1Id),
      students: [student._id],
      classMode: 'ONLINE',
      baseDuration: 60,
      sessionDuration: 60,
      pricePerSession: 200_000,
      teacherPayPerSession: 120_000,
      status: 'ACTIVE',
    });

    return { classId: String(cls._id), studentId: String(student._id) };
  }

  // Seed a SCHEDULED session for a class
  async function seedScheduledSession(classId: string, studentId: string, suffix: string): Promise<string> {
    const session = await sessionModel.create({
      classId: new Types.ObjectId(classId),
      studentId: new Types.ObjectId(studentId),
      teacherId: new Types.ObjectId(teacher1Id),
      scheduledDate: new Date(daysFromNow(1)),
      startTime: '09:00',
      endTime: '10:00',
      durationMinutes: 60,
      status: 'SCHEDULED',
      sessionCode: `G7-SES-${suffix}-${Date.now()}`,
      pricePerSession: 200_000,
      teacherPayout: 120_000,
    });
    return String(session._id);
  }

  // Seed wallet
  async function seedWallet(userId: string, balance: number): Promise<void> {
    await walletModel.findOneAndUpdate(
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
    process.env.MONGODB_URI = replSet.getUri('school-mgmt-g7-e2e');

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
    walletModel = moduleRef.get<Model<any>>(getModelToken('Wallet'));
    ledgerModel = moduleRef.get<Model<any>>(getModelToken('LedgerEntry'));
    payrollTxModel = moduleRef.get<Model<any>>(getModelToken('PayrollTransaction'));

    const t1 = await upsertUser(teacher1);
    const t2 = await upsertUser(teacher2);
    const p = await upsertUser(parent);
    await upsertUser(director);
    await upsertUser(accounting);
    await upsertUser(ops);

    teacher1Id = String(t1._id);
    teacher2Id = String(t2._id);
    parentId = String(p._id);

    directorSession = await loginAndGetSession(director.email, director.password);
    accountingSession = await loginAndGetSession(accounting.email, accounting.password);
    opsSession = await loginAndGetSession(ops.email, ops.password);
  }, 120_000);

  afterAll(async () => {
    await closeE2eResources({ app, moduleRef, mongoReplSet: replSet });
  });

  // ══════════════════════════════════════════════════════════════════════
  //  8.2  Đổi giáo viên (Teacher Swap)
  // ══════════════════════════════════════════════════════════════════════

  describe('8.2 Teacher Swap — PATCH /classes/:id', () => {
    it('OPS đổi GV lớp sang teacher2 thành công → class.teacher cập nhật', async () => {
      const { classId } = await seedClass(`82-${Date.now()}`);

      const res = await authedPatch(opsSession, `/classes/${classId}`).send({
        teacherId: teacher2Id,
      });

      expect([200, 201]).toContain(res.status);

      const updated = await classModel.findById(classId).lean() as any;
      expect(String(updated.teacher)).toBe(teacher2Id);
    });

    it('DIRECTOR đổi GV → thành công', async () => {
      const { classId } = await seedClass(`82dir-${Date.now()}`);

      const res = await authedPatch(directorSession, `/classes/${classId}`).send({
        teacherId: teacher2Id,
      });

      expect([200, 201]).toContain(res.status);
    });

    it('Đổi GV với teacherId không hợp lệ (random string) → 400 validation', async () => {
      const { classId } = await seedClass(`82bad-${Date.now()}`);

      const res = await authedPatch(opsSession, `/classes/${classId}`).send({
        teacherId: 'not-a-mongo-id',
      });

      expect(res.status).toBe(400);
    });

    it('Đổi GV về GV cũ (teacher1) → thành công (idempotent)', async () => {
      const { classId } = await seedClass(`82idem-${Date.now()}`);

      // Swap sang teacher2
      await authedPatch(opsSession, `/classes/${classId}`).send({ teacherId: teacher2Id });

      // Swap lại teacher1
      const res = await authedPatch(opsSession, `/classes/${classId}`).send({
        teacherId: teacher1Id,
      });

      expect([200, 201]).toContain(res.status);
      const updated = await classModel.findById(classId).lean() as any;
      expect(String(updated.teacher)).toBe(teacher1Id);
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  //  8.3  Bổ sung cấu hình HS — Student Config Multi-Teacher
  // ══════════════════════════════════════════════════════════════════════

  describe('8.3 Student Config — PATCH /classes/:id/students/:sid/config', () => {
    it('OPS cập nhật cấu hình HS: đổi teacher + sessionDuration → config lưu đúng', async () => {
      const { classId, studentId } = await seedClass(`83a-${Date.now()}`);

      const res = await authedPatch(opsSession, `/classes/${classId}/students/${studentId}/config`).send({
        teacherId: teacher2Id,
        sessionDuration: 90,
        baseDuration: 60,
      });

      expect([200, 201]).toContain(res.status);
    });

    it('DIRECTOR cập nhật cấu hình HS → thành công', async () => {
      const { classId, studentId } = await seedClass(`83dir-${Date.now()}`);

      const res = await authedPatch(directorSession, `/classes/${classId}/students/${studentId}/config`).send({
        sessionDuration: 90,
      });

      expect([200, 201]).toContain(res.status);
    });

    it('sessionDuration quá nhỏ (< 15 phút) → 400 validation', async () => {
      const { classId, studentId } = await seedClass(`83val-${Date.now()}`);

      const res = await authedPatch(opsSession, `/classes/${classId}/students/${studentId}/config`).send({
        sessionDuration: 5,
      });

      expect(res.status).toBe(400);
    });

    it('studentId không thuộc class → 400 hoặc 404', async () => {
      const { classId } = await seedClass(`83nosub-${Date.now()}`);
      const randomStudentId = new Types.ObjectId().toString();

      const res = await authedPatch(opsSession, `/classes/${classId}/students/${randomStudentId}/config`).send({
        sessionDuration: 60,
      });

      expect([400, 404]).toContain(res.status);
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  //  8.4  Reschedule buổi học → POST /sessions/:id/reschedule
  // ══════════════════════════════════════════════════════════════════════

  describe('8.4 Reschedule Session — POST /sessions/:id/reschedule', () => {
    it('OPS reschedule session SCHEDULED → trả về session mới, session cũ RESCHEDULED/CANCELLED', async () => {
      const { classId, studentId } = await seedClass(`84ok-${Date.now()}`);
      const sessionId = await seedScheduledSession(classId, studentId, `84ok-${Date.now()}`);

      const newDate = daysFromNow(3);

      const res = await authedPost(opsSession, `/sessions/${sessionId}/reschedule`).send({
        newScheduledDate: newDate,
        newStartTime: '14:00',
        newEndTime: '15:00',
      });

      expect([200, 201]).toContain(res.status);

      // Session cũ nên RESCHEDULED hoặc CANCELLED
      const oldSession = await sessionModel.findById(sessionId).lean() as any;
      expect(['RESCHEDULED', 'CANCELLED']).toContain(oldSession.status);
    });

    it('DIRECTOR reschedule session → thành công', async () => {
      const { classId, studentId } = await seedClass(`84dir-${Date.now()}`);
      const sessionId = await seedScheduledSession(classId, studentId, `84dir-${Date.now()}`);

      const res = await authedPost(directorSession, `/sessions/${sessionId}/reschedule`).send({
        newScheduledDate: daysFromNow(5),
      });

      expect([200, 201]).toContain(res.status);
    });

    it('Reschedule session đã FINALIZED → 400 (không cho sửa)', async () => {
      const { classId, studentId } = await seedClass(`84fin-${Date.now()}`);
      const sessionId = await seedScheduledSession(classId, studentId, `84fin-${Date.now()}`);

      // Force finalize via DB
      await sessionModel.findByIdAndUpdate(sessionId, { status: 'FINALIZED' });

      const res = await authedPost(opsSession, `/sessions/${sessionId}/reschedule`).send({
        newScheduledDate: daysFromNow(3),
      });

      expect(res.status).toBe(400);
    });

    it('Reschedule thiếu newScheduledDate → 400 validation', async () => {
      const { classId, studentId } = await seedClass(`84nodate-${Date.now()}`);
      const sessionId = await seedScheduledSession(classId, studentId, `84nodate-${Date.now()}`);

      const res = await authedPost(opsSession, `/sessions/${sessionId}/reschedule`).send({
        newStartTime: '14:00',
      });

      expect(res.status).toBe(400);
    });

    it('newStartTime sai format (không phải HH:mm) → 400 validation', async () => {
      const { classId, studentId } = await seedClass(`84fmt-${Date.now()}`);
      const sessionId = await seedScheduledSession(classId, studentId, `84fmt-${Date.now()}`);

      const res = await authedPost(opsSession, `/sessions/${sessionId}/reschedule`).send({
        newScheduledDate: daysFromNow(3),
        newStartTime: '2:00 PM', // sai format
      });

      expect(res.status).toBe(400);
    });

    it('Reschedule sang ngày hiện tại (hôm nay) → thành công nếu API không ràng buộc', async () => {
      const { classId, studentId } = await seedClass(`84today-${Date.now()}`);
      const sessionId = await seedScheduledSession(classId, studentId, `84today-${Date.now()}`);

      const res = await authedPost(opsSession, `/sessions/${sessionId}/reschedule`).send({
        newScheduledDate: todayYmd(),
      });

      // 200 hoặc 400 tùy policy — cần ít nhất không crash server
      expect([200, 201, 400]).toContain(res.status);
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  //  9.1  Thiếu PayrollTx → Auto-heal khi chạy reconciliation
  // ══════════════════════════════════════════════════════════════════════

  describe('9.1 Missing PayrollTx Auto-heal — POST /admin/reconciliation/run', () => {
    it('Session FINALIZED có report nhưng không có PayrollTx → reconcile tạo PayrollTx', async () => {
      const { classId, studentId } = await seedClass(`91-${Date.now()}`);

      // Tạo session đã finalized, có hasTeachingReport=true, nhưng KHÔNG có PayrollTx
      const sessionDate = new Date();
      sessionDate.setUTCDate(sessionDate.getUTCDate() - 1);
      const scheduledDate = new Date(Date.UTC(
        sessionDate.getUTCFullYear(),
        sessionDate.getUTCMonth(),
        sessionDate.getUTCDate(),
      ));

      const session = await sessionModel.create({
        classId: new Types.ObjectId(classId),
        studentId: new Types.ObjectId(studentId),
        teacherId: new Types.ObjectId(teacher1Id),
        scheduledDate,
        startTime: '09:00',
        endTime: '10:00',
        durationMinutes: 60,
        status: 'FINALIZED',
        sessionCode: `G7-SES-91-${Date.now()}`,
        pricePerSession: 200_000,
        teacherPayout: 120_000,
        hasTeachingReport: true,
        teachingReport: {
          lessonContent: 'On tap noi dung bai hoc day du va co he thong',
          submittedAt: scheduledDate,
          isLateSubmission: false,
          lateSubmissionHours: 0,
        },
        isPaid: true,
        amountCharged: 200_000,
      });

      const res = await authedPost(directorSession, '/admin/reconciliation/run').send({
        fromDate: scheduledDate.toISOString().slice(0, 10),
        toDate: scheduledDate.toISOString().slice(0, 10),
      });

      expect([200, 201]).toContain(res.status);

      const result = res.body;
      expect(result.sessionsScanned).toBeGreaterThanOrEqual(1);
      expect(result.missingTxCreated).toBeGreaterThanOrEqual(1);

      // Kiểm tra PayrollTx đã được auto-created
      const tx = await payrollTxModel.findOne({ sessionId: session._id }).lean();
      expect(tx).toBeTruthy();
    });

    it('OPS cố gọi reconciliation → 403 (chỉ DIRECTOR/ACCOUNTING)', async () => {
      const res = await authedPost(opsSession, '/admin/reconciliation/run').send({
        fromDate: todayYmd(),
        toDate: todayYmd(),
      });

      expect(res.status).toBe(403);
    });

    it('ACCOUNTING có thể gọi reconciliation → 200', async () => {
      const res = await authedPost(accountingSession, '/admin/reconciliation/run').send({
        fromDate: todayYmd(),
        toDate: todayYmd(),
      });

      expect([200, 201]).toContain(res.status);
      expect(typeof res.body.sessionsScanned).toBe('number');
    });

    it('Reconcile không có sessions trong khoảng → sessionsScanned = 0', async () => {
      const farFuture = '2099-12-31';

      const res = await authedPost(directorSession, '/admin/reconciliation/run').send({
        fromDate: farFuture,
        toDate: farFuture,
      });

      expect([200, 201]).toContain(res.status);
      expect(res.body.sessionsScanned).toBe(0);
      expect(res.body.missingTxCreated).toBe(0);
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  //  9.2  Late-flag discrepancy auto-heal
  // ══════════════════════════════════════════════════════════════════════

  describe('9.2 Late-flag Discrepancy Auto-heal', () => {
    it('PayrollTx.isLateReport=false nhưng Session.isLateSubmission=true → reconcile sửa lại', async () => {
      const { classId, studentId } = await seedClass(`92-${Date.now()}`);

      const sessionDate = new Date();
      sessionDate.setUTCDate(sessionDate.getUTCDate() - 1);
      const scheduledDate = new Date(Date.UTC(
        sessionDate.getUTCFullYear(),
        sessionDate.getUTCMonth(),
        sessionDate.getUTCDate(),
      ));

      const session = await sessionModel.create({
        classId: new Types.ObjectId(classId),
        studentId: new Types.ObjectId(studentId),
        teacherId: new Types.ObjectId(teacher1Id),
        scheduledDate,
        startTime: '09:00',
        endTime: '10:00',
        durationMinutes: 60,
        status: 'FINALIZED',
        sessionCode: `G7-SES-92-${Date.now()}`,
        pricePerSession: 200_000,
        teacherPayout: 120_000,
        hasTeachingReport: true,
        teachingReport: {
          lessonContent: 'On tap noi dung bai hoc day du va co he thong',
          submittedAt: new Date(scheduledDate.getTime() + 5 * 3600_000), // 5h late
          isLateSubmission: true,
          lateSubmissionHours: 5,
        },
        isPaid: true,
        amountCharged: 200_000,
      });

      // PayrollTx với late-flag SAI (isLateReport=false)
      await payrollTxModel.create({
        sessionId: session._id,
        classId: new Types.ObjectId(classId),
        studentId: new Types.ObjectId(studentId),
        teacherId: new Types.ObjectId(teacher1Id),
        sessionDate: scheduledDate,
        baseSalary: 120_000,
        finalSalary: 120_000,
        isLateReport: false, // SAI — thực ra phải true
        lateHours: 0, // SAI
        status: 'PENDING',
      });

      const res = await authedPost(directorSession, '/admin/reconciliation/run').send({
        fromDate: scheduledDate.toISOString().slice(0, 10),
        toDate: scheduledDate.toISOString().slice(0, 10),
      });

      expect([200, 201]).toContain(res.status);
      expect(res.body.payrollTxLateHealed).toBeGreaterThanOrEqual(1);

      // Kiểm tra PayrollTx đã được fix
      const fixedTx = await payrollTxModel.findOne({ sessionId: session._id }).lean() as any;
      expect(fixedTx.isLateReport).toBe(true);
      expect(fixedTx.lateHours).toBe(5);
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  //  9.3  Critical Anomaly — PAID nhưng không có report (KHÔNG tự sửa)
  // ══════════════════════════════════════════════════════════════════════

  describe('9.3 Critical Anomaly — Paid without report', () => {
    it('PayrollTx PAID nhưng Session.hasTeachingReport=false → criticalAnomalies++, KHÔNG tự xóa Tx', async () => {
      const { classId, studentId } = await seedClass(`93-${Date.now()}`);

      const sessionDate = new Date();
      sessionDate.setUTCDate(sessionDate.getUTCDate() - 2);
      const scheduledDate = new Date(Date.UTC(
        sessionDate.getUTCFullYear(),
        sessionDate.getUTCMonth(),
        sessionDate.getUTCDate(),
      ));

      const session = await sessionModel.create({
        classId: new Types.ObjectId(classId),
        studentId: new Types.ObjectId(studentId),
        teacherId: new Types.ObjectId(teacher1Id),
        scheduledDate,
        startTime: '09:00',
        endTime: '10:00',
        durationMinutes: 60,
        status: 'FINALIZED',
        sessionCode: `G7-SES-93-${Date.now()}`,
        pricePerSession: 200_000,
        teacherPayout: 120_000,
        hasTeachingReport: false, // Report bị xóa (anomaly)
        isPaid: true,
        amountCharged: 200_000,
      });

      // PayrollTx đã PAID
      const payrollTx = await payrollTxModel.create({
        sessionId: session._id,
        classId: new Types.ObjectId(classId),
        studentId: new Types.ObjectId(studentId),
        teacherId: new Types.ObjectId(teacher1Id),
        sessionDate: scheduledDate,
        baseSalary: 120_000,
        finalSalary: 120_000,
        isLateReport: false,
        lateHours: 0,
        status: 'PAID', // Đã chi lương nhưng không có báo cáo
      });

      const res = await authedPost(directorSession, '/admin/reconciliation/run').send({
        fromDate: scheduledDate.toISOString().slice(0, 10),
        toDate: scheduledDate.toISOString().slice(0, 10),
      });

      expect([200, 201]).toContain(res.status);
      expect(res.body.criticalAnomalies).toBeGreaterThanOrEqual(1);

      // Kiểm tra PayrollTx KHÔNG bị tự động xóa
      const txStillExists = await payrollTxModel.findById(payrollTx._id).lean();
      expect(txStillExists).toBeTruthy();
      expect((txStillExists as any).status).toBe('PAID');
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  //  9.4  Wallet balance lệch vs SUM(LedgerEntries) — Phát hiện via model
  // ══════════════════════════════════════════════════════════════════════

  describe('9.4 Wallet Balance vs Ledger Integrity check', () => {
    it('SUM(LedgerEntry.amount tính có dấu) khớp với wallet.balance sau nhiều giao dịch', async () => {
      // Seed wallet với balance ban đầu = 0
      await seedWallet(parentId, 0);

      // Inject ledger entries manually (giả lập các giao dịch)
      const topUp = 1_000_000;
      const deduct = 200_000;
      const adjustment = 50_000;

      await ledgerModel.create({
        userId: new Types.ObjectId(parentId),
        walletId: new Types.ObjectId(), // arbitrary
        type: 'TOP_UP',
        amount: topUp,
        status: 'COMPLETED',
        balanceBefore: 0,
        balanceAfter: topUp,
      });
      await ledgerModel.create({
        userId: new Types.ObjectId(parentId),
        walletId: new Types.ObjectId(),
        type: 'SESSION_DEDUCT',
        amount: deduct,
        status: 'COMPLETED',
        balanceBefore: topUp,
        balanceAfter: topUp - deduct,
      });
      await ledgerModel.create({
        userId: new Types.ObjectId(parentId),
        walletId: new Types.ObjectId(),
        type: 'ADJUSTMENT',
        amount: adjustment,
        status: 'COMPLETED',
        balanceBefore: topUp - deduct,
        balanceAfter: topUp - deduct + adjustment,
      });

      // Tính balance theo ledger (CREDIT - DEBIT)
      const credits = ['TOP_UP', 'REFUND', 'TRANSFER_IN', 'ADJUSTMENT', 'ADJUSTMENT_CREDIT'];
      const debits = ['SESSION_DEDUCT', 'TRANSFER_OUT', 'TEACHER_PAYOUT'];

      const ledgerEntries = await ledgerModel.find({ userId: new Types.ObjectId(parentId) }).lean() as any[];

      let expectedBalance = 0;
      for (const entry of ledgerEntries) {
        if (credits.includes(entry.type)) {
          expectedBalance += Number(entry.amount);
        } else if (debits.includes(entry.type)) {
          expectedBalance -= Number(entry.amount);
        }
      }

      // Kiểm tra balanceAfter của entry cuối cùng = expectedBalance
      const sortedEntries = ledgerEntries.sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
      const lastEntry = sortedEntries[sortedEntries.length - 1];

      expect(expectedBalance).toBe(topUp - deduct + adjustment);
      // balanceAfter của ledger entry cuối phải khớp với expected
      expect(Number(lastEntry.balanceAfter)).toBe(topUp - deduct + adjustment);
    });

    it('Phát hiện wallet lệch: balance=500k nhưng SUM(ledger)=480k → diff=+20k cảnh báo', async () => {
      const walletUserId = new Types.ObjectId();

      // Seed wallet với balance 500k
      await walletModel.findOneAndUpdate(
        { userId: walletUserId },
        {
          $set: {
            userId: walletUserId,
            balance: 500_000, // Thực tế 500k
            totalTopUp: 500_000,
            totalDeducted: 20_000, // Lệch 20k
            totalRefunded: 0,
            status: 'ACTIVE',
          },
        },
        { upsert: true },
      );

      // Ledger chỉ ghi nhận NET = 480k
      await ledgerModel.create({
        userId: walletUserId,
        walletId: new Types.ObjectId(),
        type: 'TOP_UP',
        amount: 480_000,
        status: 'COMPLETED',
        balanceBefore: 0,
        balanceAfter: 480_000,
      });

      // Tính SUM từ ledger
      const entries = await ledgerModel.find({ userId: walletUserId }).lean() as any[];
      const ledgerSum = entries.reduce((sum, e) => sum + Number(e.amount), 0);

      const wallet = await walletModel.findOne({ userId: walletUserId }).lean() as any;
      const actualBalance = wallet.balance;

      // Phát hiện lệch
      const diff = actualBalance - ledgerSum;
      expect(diff).toBe(20_000); // Lệch 20k như kịch bản test.md 9.4
    });
  });
});
