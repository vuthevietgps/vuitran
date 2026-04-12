import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import * as request from 'supertest';
import * as cookieParser from 'cookie-parser';
import * as bcrypt from 'bcrypt';
import { AppModule } from '../src/app.module';
import { closeE2eResources } from './e2e-cleanup';

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

function dateYmdFromNow(offsetDays: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

function toUtcDate(ymd: string, hhmm: string): Date {
  return new Date(`${ymd}T${hhmm}:00.000Z`);
}

describe('Payroll module (e2e)', () => {
  let app: INestApplication;
  let moduleRef: TestingModule;
  let replSet: MongoMemoryReplSet;

  let userModel: Model<any>;
  let studentModel: Model<any>;
  let classModel: Model<any>;
  let sessionModel: Model<any>;
  let attendanceModel: Model<any>;
  let payrollItemModel: Model<any>;
  let bankAccountModel: Model<any>;
  let bankTransactionModel: Model<any>;

  const director: SeedUser = {
    email: 'director.pay.e2e@school.local',
    password: 'E2ePass123!',
    fullName: 'Director Payroll',
    role: 'DIRECTOR',
  };
  const accounting: SeedUser = {
    email: 'accounting.pay.e2e@school.local',
    password: 'E2ePass123!',
    fullName: 'Accounting Payroll',
    role: 'ACCOUNTING',
  };
  const ops: SeedUser = {
    email: 'ops.pay.e2e@school.local',
    password: 'E2ePass123!',
    fullName: 'Ops Payroll',
    role: 'OPS',
  };
  const teacherA: SeedUser = {
    email: 'teacher.a.pay.e2e@school.local',
    password: 'E2ePass123!',
    fullName: 'Teacher A Payroll',
    role: 'TEACHER',
  };
  const teacherB: SeedUser = {
    email: 'teacher.b.pay.e2e@school.local',
    password: 'E2ePass123!',
    fullName: 'Teacher B Payroll',
    role: 'TEACHER',
  };
  const parent: SeedUser = {
    email: 'parent.pay.e2e@school.local',
    password: 'E2ePass123!',
    fullName: 'Parent Payroll',
    role: 'PARENT',
  };

  let directorSession: SessionCookies;
  let accountingSession: SessionCookies;
  let opsSession: SessionCookies;
  let teacherASession: SessionCookies;
  let teacherBSession: SessionCookies;
  let parentSession: SessionCookies;

  let opsId: string;
  let parentId: string;
  let teacherAId: string;
  let teacherBId: string;
  let classAId: string;
  let classBId: string;
  let student1Id: string;
  let student2Id: string;

  let eligibleA1SessionId: string;
  let eligibleA2SessionId: string;
  let eligibleB1SessionId: string;

  let payrollAId: string;
  let payrollBId: string;
  let excludedItemId: string;
  let excludedSessionId: string;
  let bankAccountId: string;

  const periodStart = dateYmdFromNow(-30);
  const periodEnd = dateYmdFromNow(5);

  const dA1 = dateYmdFromNow(-10);
  const dA2 = dateYmdFromNow(-9);
  const dFinalizedNoReport = dateYmdFromNow(-8);
  const dTeacherCompleted = dateYmdFromNow(-7);
  const dParentConfirmed = dateYmdFromNow(-6);
  const dAlreadyPaid = dateYmdFromNow(-5);
  const dCancelled = dateYmdFromNow(-4);
  const dNoShow = dateYmdFromNow(-3);
  const dB1 = dateYmdFromNow(-2);

  async function upsertUser(user: SeedUser): Promise<any> {
    const hashedPassword = await bcrypt.hash(user.password, 10);
    await userModel.updateOne(
      { email: user.email },
      {
        $set: {
          email: user.email,
          password: hashedPassword,
          fullName: user.fullName,
          role: user.role,
          status: 'ACTIVE',
        },
        $setOnInsert: {
          createdAt: new Date(),
        },
      },
      { upsert: true },
    );

    return userModel.findOne({ email: user.email }).lean();
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
      accessToken: accessToken as string,
      xsrfToken: xsrfToken as string,
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

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({
      replSet: { count: 1, storageEngine: 'wiredTiger' },
    });
    process.env.MONGODB_URI = replSet.getUri('school-mgmt-payroll-e2e');

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

    userModel = moduleRef.get<Model<any>>(getModelToken('User'));
    studentModel = moduleRef.get<Model<any>>(getModelToken('Student'));
    classModel = moduleRef.get<Model<any>>(getModelToken('Classroom'));
    sessionModel = moduleRef.get<Model<any>>(getModelToken('Session'));
    attendanceModel = moduleRef.get<Model<any>>(getModelToken('Attendance'));
    payrollItemModel = moduleRef.get<Model<any>>(getModelToken('PayrollItem'));
    bankAccountModel = moduleRef.get<Model<any>>(getModelToken('BankAccount'));
    bankTransactionModel = moduleRef.get<Model<any>>(getModelToken('BankTransaction'));

    const directorDoc = await upsertUser(director);
    const accountingDoc = await upsertUser(accounting);
    const opsDoc = await upsertUser(ops);
    const teacherADoc = await upsertUser(teacherA);
    const teacherBDoc = await upsertUser(teacherB);
    const parentDoc = await upsertUser(parent);

    opsId = String(opsDoc._id);
    parentId = String(parentDoc._id);
    teacherAId = String(teacherADoc._id);
    teacherBId = String(teacherBDoc._id);

    const student1 = await studentModel.create({
      studentCode: 'PAY-S1',
      fullName: 'Payroll Student One',
      age: 10,
      parentUserId: new Types.ObjectId(parentId),
      parentName: parent.fullName,
      parentPhone: '0900001111',
      faceImage: 'seed-face-pay-1.jpg',
      approvalStatus: 'APPROVED',
      approvedBy: new Types.ObjectId(directorDoc._id),
      approvedAt: new Date(),
      subjects: ['Toan'],
      grade: '5',
    });
    student1Id = String(student1._id);

    const student2 = await studentModel.create({
      studentCode: 'PAY-S2',
      fullName: 'Payroll Student Two',
      age: 11,
      parentUserId: new Types.ObjectId(parentId),
      parentName: parent.fullName,
      parentPhone: '0900001111',
      faceImage: 'seed-face-pay-2.jpg',
      approvalStatus: 'APPROVED',
      approvedBy: new Types.ObjectId(directorDoc._id),
      approvedAt: new Date(),
      subjects: ['Van'],
      grade: '6',
    });
    student2Id = String(student2._id);

    const classA = await classModel.create({
      name: 'Class Payroll A',
      code: 'PAY-CLASS-A',
      teacher: new Types.ObjectId(teacherAId),
      students: [new Types.ObjectId(student1Id), new Types.ObjectId(student2Id)],
      classMode: 'ONLINE',
      baseDuration: 60,
      sessionDuration: 60,
      pricePerSession: 200000,
      teacherPayPerSession: 70000,
      teacherPayPerStudent: 30000,
      status: 'ACTIVE',
    });
    classAId = String(classA._id);

    const classB = await classModel.create({
      name: 'Class Payroll B',
      code: 'PAY-CLASS-B',
      teacher: new Types.ObjectId(teacherBId),
      students: [new Types.ObjectId(student2Id)],
      classMode: 'ONLINE',
      baseDuration: 60,
      sessionDuration: 60,
      pricePerSession: 180000,
      teacherPayPerSession: 65000,
      teacherPayPerStudent: 30000,
      status: 'ACTIVE',
    });
    classBId = String(classB._id);

    const sessionA1 = await sessionModel.create({
      classId: new Types.ObjectId(classAId),
      studentId: new Types.ObjectId(student1Id),
      teacherId: new Types.ObjectId(teacherAId),
      parentUserId: new Types.ObjectId(parentId),
      scheduledDate: toUtcDate(dA1, '09:00'),
      scheduledStartTime: '09:00',
      scheduledEndTime: '10:00',
      durationMinutes: 60,
      teacherPayout: 70000,
      amountCharged: 150000,
      status: 'FINALIZED',
      hasTeachingReport: true,
      teachingReport: {
        lessonContent: 'Eligible A1 with full lesson summary.',
        submittedAt: toUtcDate(dA1, '11:00'),
      },
      confirmation: {
        finalizedAt: toUtcDate(dA1, '10:30'),
        finalizedBy: new Types.ObjectId(opsId),
      },
    });
    eligibleA1SessionId = String(sessionA1._id);

    const sessionA2 = await sessionModel.create({
      classId: new Types.ObjectId(classAId),
      studentId: new Types.ObjectId(student2Id),
      teacherId: new Types.ObjectId(teacherAId),
      parentUserId: new Types.ObjectId(parentId),
      scheduledDate: toUtcDate(dA2, '09:00'),
      scheduledStartTime: '09:00',
      scheduledEndTime: '10:00',
      durationMinutes: 60,
      teacherPayout: 80000,
      amountCharged: 160000,
      status: 'FINALIZED',
      hasTeachingReport: true,
      teachingReport: {
        lessonContent: 'Eligible A2 with full lesson summary.',
        submittedAt: toUtcDate(dA2, '11:00'),
      },
      confirmation: {
        finalizedAt: toUtcDate(dA2, '10:30'),
      },
    });
    eligibleA2SessionId = String(sessionA2._id);

    await sessionModel.create({
      classId: new Types.ObjectId(classAId),
      studentId: new Types.ObjectId(student1Id),
      teacherId: new Types.ObjectId(teacherAId),
      parentUserId: new Types.ObjectId(parentId),
      scheduledDate: toUtcDate(dFinalizedNoReport, '09:00'),
      scheduledStartTime: '09:00',
      scheduledEndTime: '10:00',
      durationMinutes: 60,
      teacherPayout: 60000,
      amountCharged: 130000,
      status: 'FINALIZED',
      hasTeachingReport: false,
      confirmation: {
        finalizedAt: toUtcDate(dFinalizedNoReport, '10:30'),
        finalizedBy: new Types.ObjectId(opsId),
      },
    });

    await sessionModel.create({
      classId: new Types.ObjectId(classAId),
      studentId: new Types.ObjectId(student2Id),
      teacherId: new Types.ObjectId(teacherAId),
      parentUserId: new Types.ObjectId(parentId),
      scheduledDate: toUtcDate(dTeacherCompleted, '09:00'),
      scheduledStartTime: '09:00',
      scheduledEndTime: '10:00',
      durationMinutes: 60,
      teacherPayout: 55000,
      amountCharged: 120000,
      status: 'TEACHER_COMPLETED',
      hasTeachingReport: false,
    });

    await sessionModel.create({
      classId: new Types.ObjectId(classAId),
      studentId: new Types.ObjectId(student1Id),
      teacherId: new Types.ObjectId(teacherAId),
      parentUserId: new Types.ObjectId(parentId),
      scheduledDate: toUtcDate(dParentConfirmed, '09:00'),
      scheduledStartTime: '09:00',
      scheduledEndTime: '10:00',
      durationMinutes: 60,
      teacherPayout: 65000,
      amountCharged: 140000,
      status: 'PARENT_CONFIRMED',
      hasTeachingReport: true,
      teachingReport: {
        lessonContent: 'Waiting finalize',
        submittedAt: toUtcDate(dParentConfirmed, '11:00'),
      },
    });

    const alreadyPaid = await sessionModel.create({
      classId: new Types.ObjectId(classAId),
      studentId: new Types.ObjectId(student2Id),
      teacherId: new Types.ObjectId(teacherAId),
      parentUserId: new Types.ObjectId(parentId),
      scheduledDate: toUtcDate(dAlreadyPaid, '09:00'),
      scheduledStartTime: '09:00',
      scheduledEndTime: '10:00',
      durationMinutes: 60,
      teacherPayout: 90000,
      amountCharged: 170000,
      status: 'FINALIZED',
      hasTeachingReport: true,
      isTeacherPaid: true,
      teachingReport: {
        lessonContent: 'Already paid',
        submittedAt: toUtcDate(dAlreadyPaid, '11:00'),
      },
      confirmation: {
        finalizedAt: toUtcDate(dAlreadyPaid, '10:30'),
        finalizedBy: new Types.ObjectId(opsId),
      },
    });

    await sessionModel.create({
      classId: new Types.ObjectId(classAId),
      studentId: new Types.ObjectId(student1Id),
      teacherId: new Types.ObjectId(teacherAId),
      parentUserId: new Types.ObjectId(parentId),
      scheduledDate: toUtcDate(dCancelled, '09:00'),
      scheduledStartTime: '09:00',
      scheduledEndTime: '10:00',
      durationMinutes: 60,
      teacherPayout: 0,
      amountCharged: 0,
      status: 'CANCELLED',
      hasTeachingReport: false,
    });

    await sessionModel.create({
      classId: new Types.ObjectId(classAId),
      studentId: new Types.ObjectId(student2Id),
      teacherId: new Types.ObjectId(teacherAId),
      parentUserId: new Types.ObjectId(parentId),
      scheduledDate: toUtcDate(dNoShow, '09:00'),
      scheduledStartTime: '09:00',
      scheduledEndTime: '10:00',
      durationMinutes: 60,
      teacherPayout: 0,
      amountCharged: 0,
      status: 'NO_SHOW',
      hasTeachingReport: false,
    });

    const sessionB1 = await sessionModel.create({
      classId: new Types.ObjectId(classBId),
      studentId: new Types.ObjectId(student2Id),
      teacherId: new Types.ObjectId(teacherBId),
      parentUserId: new Types.ObjectId(parentId),
      scheduledDate: toUtcDate(dB1, '09:00'),
      scheduledStartTime: '09:00',
      scheduledEndTime: '10:00',
      durationMinutes: 60,
      teacherPayout: 65000,
      amountCharged: 150000,
      status: 'FINALIZED',
      hasTeachingReport: true,
      teachingReport: {
        lessonContent: 'Eligible B1 with full lesson summary.',
        submittedAt: toUtcDate(dB1, '11:00'),
      },
      confirmation: {
        finalizedAt: toUtcDate(dB1, '10:30'),
      },
    });
    eligibleB1SessionId = String(sessionB1._id);

    await attendanceModel.create({
      classId: new Types.ObjectId(classAId),
      studentId: new Types.ObjectId(student1Id),
      teacherId: new Types.ObjectId(teacherAId),
      date: toUtcDate(dA1, '09:00'),
      status: 'PRESENT',
      sessionId: new Types.ObjectId(eligibleA1SessionId),
    });

    await attendanceModel.create({
      classId: new Types.ObjectId(classAId),
      studentId: new Types.ObjectId(student2Id),
      teacherId: new Types.ObjectId(teacherAId),
      date: toUtcDate(dA2, '09:00'),
      status: 'LATE',
      checkedBy: new Types.ObjectId(opsId),
      checkedAt: new Date(),
      sessionId: new Types.ObjectId(eligibleA2SessionId),
    });

    await attendanceModel.create({
      classId: new Types.ObjectId(classAId),
      studentId: new Types.ObjectId(student2Id),
      teacherId: new Types.ObjectId(teacherAId),
      date: toUtcDate(dAlreadyPaid, '09:00'),
      status: 'PRESENT',
      checkedBy: new Types.ObjectId(opsId),
      checkedAt: new Date(),
      sessionId: alreadyPaid._id,
    });

    await attendanceModel.create({
      classId: new Types.ObjectId(classBId),
      studentId: new Types.ObjectId(student2Id),
      teacherId: new Types.ObjectId(teacherBId),
      date: toUtcDate(dB1, '09:00'),
      status: 'PRESENT',
      checkedBy: new Types.ObjectId(opsId),
      checkedAt: new Date(),
      sessionId: new Types.ObjectId(eligibleB1SessionId),
    });

    const bankAccount = await bankAccountModel.create({
      accountCode: 'BA-PAY-E2E-001',
      bankName: 'Vietcombank',
      accountNumber: '123456789',
      accountHolder: 'Payroll E2E',
      currentBalance: 500000000,
      openingBalance: 500000000,
      status: 'ACTIVE',
      isPrimary: true,
      createdById: new Types.ObjectId(accountingDoc._id),
      createdByName: accounting.fullName,
    });
    bankAccountId = String(bankAccount._id);

    directorSession = await loginAndGetSession(director.email, director.password);
    accountingSession = await loginAndGetSession(accounting.email, accounting.password);
    opsSession = await loginAndGetSession(ops.email, ops.password);
    teacherASession = await loginAndGetSession(teacherA.email, teacherA.password);
    teacherBSession = await loginAndGetSession(teacherB.email, teacherB.password);
    parentSession = await loginAndGetSession(parent.email, parent.password);
  });

  afterAll(async () => {
    await closeE2eResources({ app, moduleRef, mongoReplSet: replSet });
  });

  it('returns teacher payroll preview with correct categorization and totals', async () => {
    const res = await authGet(
      request(app.getHttpServer()).get(
        `/payroll/teacher-preview?teacherId=${teacherBId}&periodStart=${periodStart}&periodEnd=${periodEnd}`,
      ),
      teacherASession,
    ).expect(200);

    expect(res.body.teacherId).toBe(teacherAId);
    expect(res.body.summary.totalSessions).toBe(8);
    expect(res.body.summary.totalAttended).toBe(6);
    expect(res.body.summary.eligibleForPayroll).toBe(2);
    expect(res.body.summary.missingReport).toBe(2);
    expect(res.body.summary.pendingParentConfirm).toBe(1);
    expect(res.body.summary.pendingFinalize).toBe(1);
    expect(res.body.summary.finalizedNoReport).toBe(1);
    expect(res.body.summary.alreadyPaid).toBe(1);
    expect(res.body.summary.cancelled).toBe(1);
    expect(res.body.summary.noShow).toBe(1);
    expect(res.body.amounts.totalEligiblePayout).toBe(150000);
  });

  it('denies non-accounting roles from generating payroll', async () => {
    await authWrite(
      request(app.getHttpServer()).post('/payroll'),
      parentSession,
    )
      .send({
        teacherId: teacherAId,
        periodStart,
        periodEnd,
      })
      .expect(403);

    await authWrite(
      request(app.getHttpServer()).post('/payroll'),
      teacherASession,
    )
      .send({
        teacherId: teacherAId,
        periodStart,
        periodEnd,
      })
      .expect(403);
  });

  it('allows accounting to generate teacher payroll and lock eligible sessions', async () => {
    const res = await authWrite(
      request(app.getHttpServer()).post('/payroll'),
      accountingSession,
    )
      .send({
        teacherId: teacherAId,
        periodStart,
        periodEnd,
        bonusAmount: 10000,
        deductionAmount: 5000,
        notes: 'Payroll A e2e',
      })
      .expect((r) => {
        expect([200, 201]).toContain(r.status);
      });

    payrollAId = String(res.body._id);
    expect(payrollAId).toBeTruthy();
    expect(res.body.status).toBe('DRAFT');
    expect(res.body.totalSessions).toBe(2);
    expect(res.body.grossAmount).toBe(150000);
    expect(res.body.netAmount).toBe(155000);
    expect(String(res.body.payrollCode || '')).toMatch(/^PRL-/);

    const lockedA1: any = await sessionModel.findById(eligibleA1SessionId).lean();
    const lockedA2: any = await sessionModel.findById(eligibleA2SessionId).lean();
    expect(lockedA1?.isTeacherPaid).toBe(true);
    expect(lockedA2?.isTeacherPaid).toBe(true);
  });

  it('blocks duplicate payroll generation in overlapping period', async () => {
    await authWrite(
      request(app.getHttpServer()).post('/payroll'),
      accountingSession,
    )
      .send({
        teacherId: teacherAId,
        periodStart,
        periodEnd,
      })
      .expect(400);
  });

  it('enforces payroll visibility by teacher ownership', async () => {
    const mine = await authGet(
      request(app.getHttpServer()).get('/payroll/my-payroll'),
      teacherASession,
    ).expect(200);
    expect(Array.isArray(mine.body.data)).toBe(true);
    expect(mine.body.data.some((p: any) => String(p._id) === payrollAId)).toBe(true);

    await authGet(
      request(app.getHttpServer()).get(`/payroll/${payrollAId}`),
      teacherBSession,
    ).expect(403);

    const items = await authGet(
      request(app.getHttpServer()).get(`/payroll/${payrollAId}/items`),
      teacherASession,
    ).expect(200);
    expect(Array.isArray(items.body)).toBe(true);
    expect(items.body).toHaveLength(2);

    await authGet(
      request(app.getHttpServer()).get(`/payroll/${payrollAId}/items`),
      teacherBSession,
    ).expect(403);
  });

  it('recalculates payroll totals when item is excluded and releases session lock', async () => {
    const item: any = await payrollItemModel
      .findOne({
        payrollId: new Types.ObjectId(payrollAId),
        teacherPayout: 70000,
      })
      .lean();
    expect(item).toBeTruthy();

    excludedItemId = String(item._id);
    excludedSessionId = String(item.sessionId);

    const patchedItem = await authWrite(
      request(app.getHttpServer()).patch(`/payroll/${payrollAId}/items/${excludedItemId}`),
      accountingSession,
    )
      .send({
        adjustedPayout: 0,
        status: 'EXCLUDED',
        adjustmentReason: 'Session disputed',
      })
      .expect(200);

    expect(patchedItem.body.status).toBe('EXCLUDED');

    const payroll = await authGet(
      request(app.getHttpServer()).get(`/payroll/${payrollAId}`),
      accountingSession,
    ).expect(200);

    expect(payroll.body.totalSessions).toBe(1);
    expect(payroll.body.grossAmount).toBe(80000);
    expect(payroll.body.netAmount).toBe(85000);

    const unlockedSession: any = await sessionModel.findById(excludedSessionId).lean();
    expect(unlockedSession?.isTeacherPaid).toBe(false);
  });

  it('supports submit and director approval workflow with role enforcement', async () => {
    const submitted = await authWrite(
      request(app.getHttpServer()).post(`/payroll/${payrollAId}/submit`),
      opsSession,
    ).expect((r) => {
      expect([200, 201]).toContain(r.status);
    });
    expect(submitted.body.status).toBe('PENDING_REVIEW');

    await authWrite(
      request(app.getHttpServer()).post(`/payroll/${payrollAId}/approve`),
      opsSession,
    ).expect(403);

    const approved = await authWrite(
      request(app.getHttpServer()).post(`/payroll/${payrollAId}/approve`),
      directorSession,
    ).expect(201);
    expect(approved.body.status).toBe('APPROVED');
  });

  it('marks approved payroll as paid and records bank outflow', async () => {
    const before: any = await bankAccountModel.findById(bankAccountId).lean();
    expect(before).toBeTruthy();

    const paid = await authWrite(
      request(app.getHttpServer()).post(`/payroll/${payrollAId}/mark-paid`),
      accountingSession,
    )
      .send({
        paymentRef: 'PAY-E2E-REF-001',
        bankAccountId,
      })
      .expect(201);

    expect(paid.body.status).toBe('PAID');
    expect(paid.body.paymentRef).toBe('PAY-E2E-REF-001');

    const after: any = await bankAccountModel.findById(bankAccountId).lean();
    expect(after.currentBalance).toBe(before.currentBalance - paid.body.netAmount);

    const txCount = await bankTransactionModel.countDocuments({
      referenceType: 'PAYROLL',
      referenceId: new Types.ObjectId(payrollAId),
    });
    expect(txCount).toBe(1);
  });

  it('supports reject and reopen flow while toggling teacher session lock', async () => {
    const generated = await authWrite(
      request(app.getHttpServer()).post('/payroll'),
      accountingSession,
    )
      .send({
        teacherId: teacherBId,
        periodStart,
        periodEnd,
        notes: 'Payroll B e2e',
      })
      .expect((r) => {
        expect([200, 201]).toContain(r.status);
      });

    payrollBId = String(generated.body._id);
    expect(generated.body.totalSessions).toBe(1);

    const afterGenerate: any = await sessionModel.findById(eligibleB1SessionId).lean();
    expect(afterGenerate?.isTeacherPaid).toBe(true);

    await authWrite(
      request(app.getHttpServer()).post(`/payroll/${payrollBId}/submit`),
      accountingSession,
    ).expect((r) => {
      expect([200, 201]).toContain(r.status);
    });

    const rejected = await authWrite(
      request(app.getHttpServer()).post(`/payroll/${payrollBId}/reject`),
      directorSession,
    )
      .send({ reason: 'Need manual verification' })
      .expect(201);

    expect(rejected.body.status).toBe('REJECTED');
    expect(rejected.body.rejectionReason).toBe('Need manual verification');

    const afterReject: any = await sessionModel.findById(eligibleB1SessionId).lean();
    expect(afterReject?.isTeacherPaid).toBe(false);

    const reopened = await authWrite(
      request(app.getHttpServer()).post(`/payroll/${payrollBId}/reopen`),
      accountingSession,
    ).expect(201);

    expect(reopened.body.status).toBe('DRAFT');
    expect(reopened.body.rejectionReason).toBeFalsy();

    const afterReopen: any = await sessionModel.findById(eligibleB1SessionId).lean();
    expect(afterReopen?.isTeacherPaid).toBe(true);
  });
});
