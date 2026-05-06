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
  role: 'DIRECTOR' | 'OPS' | 'ACCOUNTING' | 'SALE' | 'TEACHER';
};

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

function dateYmdFromNow(offsetDays: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

function findTab(board: any, key: string) {
  return Array.isArray(board?.tabs)
    ? board.tabs.find((tab: any) => tab.key === key)
    : undefined;
}

describe('Trial enrollment and order propagation (e2e)', () => {
  let app: INestApplication;
  let moduleRef: TestingModule;
  let replSet: MongoMemoryReplSet;

  let userModel: Model<any>;
  let productModel: Model<any>;
  let classModel: Model<any>;
  let trialEnrollmentModel: Model<any>;
  let studentModel: Model<any>;
  let attendanceModel: Model<any>;
  let sessionModel: Model<any>;
  let orderModel: Model<any>;
  let invoiceModel: Model<any>;
  let walletModel: Model<any>;
  let ledgerEntryModel: Model<any>;
  let payrollTxModel: Model<any>;
  let parentAttributionModel: Model<any>;
  let leadModel: Model<any>;
  let notificationModel: Model<any>;
  let auditLogModel: Model<any>;

  const director: SeedUser = {
    email: 'director.trial-order.e2e@school.local',
    password: 'E2ePass123!',
    fullName: 'Director Trial Order',
    role: 'DIRECTOR',
  };
  const ops: SeedUser = {
    email: 'ops.trial-order.e2e@school.local',
    password: 'E2ePass123!',
    fullName: 'Ops Trial Order',
    role: 'OPS',
  };
  const accounting: SeedUser = {
    email: 'accounting.trial-order.e2e@school.local',
    password: 'E2ePass123!',
    fullName: 'Accounting Trial Order',
    role: 'ACCOUNTING',
  };
  const sale: SeedUser = {
    email: 'sale.trial-order.e2e@school.local',
    password: 'E2ePass123!',
    fullName: 'Sale Trial Order',
    role: 'SALE',
  };
  const teacher: SeedUser = {
    email: 'teacher.trial-order.e2e@school.local',
    password: 'E2ePass123!',
    fullName: 'Teacher Trial Order',
    role: 'TEACHER',
  };

  let directorUser: any;
  let opsUser: any;
  let accountingUser: any;
  let saleUser: any;
  let teacherUser: any;

  let directorSession: SessionCookies;
  let opsSession: SessionCookies;
  let accountingSession: SessionCookies;
  let saleSession: SessionCookies;
  let teacherSession: SessionCookies;

  let offlineProductId: string;
  let offlineClassId: string;

  const trialDay = dateYmdFromNow(0);
  const nextDay = dateYmdFromNow(1);
  const thirdDay = dateYmdFromNow(2);

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

  function authedGet(session: SessionCookies, path: string) {
    return request(app.getHttpServer())
      .get(path)
      .set('Cookie', session.cookieHeader)
      .set('X-XSRF-TOKEN', session.xsrfToken);
  }

  function authedPost(session: SessionCookies, path: string) {
    return request(app.getHttpServer())
      .post(path)
      .set('Cookie', session.cookieHeader)
      .set('X-XSRF-TOKEN', session.xsrfToken);
  }

  function authedPatch(session: SessionCookies, path: string) {
    return request(app.getHttpServer())
      .patch(path)
      .set('Cookie', session.cookieHeader)
      .set('X-XSRF-TOKEN', session.xsrfToken);
  }

  async function waitForValue<T>(
    fetcher: () => Promise<T | null | undefined>,
    label: string,
    predicate: (value: T) => boolean = (value) => Boolean(value),
    timeoutMs = 5000,
  ): Promise<T> {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      const value = await fetcher();
      if (value && predicate(value)) {
        return value;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    throw new Error(`Timed out waiting for ${label}`);
  }

  async function resetBusinessCollections() {
    await Promise.all([
      trialEnrollmentModel.deleteMany({}),
      attendanceModel.deleteMany({}),
      sessionModel.deleteMany({}),
      orderModel.deleteMany({}),
      invoiceModel.deleteMany({}),
      walletModel.deleteMany({}),
      ledgerEntryModel.deleteMany({}),
      payrollTxModel.deleteMany({}),
      studentModel.deleteMany({}),
      classModel.deleteMany({}),
      productModel.deleteMany({}),
      leadModel.deleteMany({}),
      notificationModel.deleteMany({}),
      auditLogModel.deleteMany({}),
      parentAttributionModel.deleteMany({}),
      userModel.deleteMany({ role: 'PARENT' }),
    ]);
  }

  async function seedOfflineTrialBase() {
    const product = await productModel.create({
      name: 'Offline Trial Package',
      code: 'PRD-TRIAL-OFFLINE',
      teachingMode: 'OFFLINE',
      defaultSessions: 12,
      defaultSessionDuration: 90,
      pricePerSession: 150000,
      suggestedPrice: 1800000,
      commissionRate: 5,
      isActive: true,
    });
    offlineProductId = String(product._id);

    const classroom = await classModel.create({
      name: 'Offline Trial Class',
      code: 'CLS-TRIAL-OFFLINE',
      teacher: teacherUser._id,
      sale: saleUser._id,
      students: [],
      classMode: 'OFFLINE',
      productPackage: product._id,
      subject: 'Math',
      grade: '6',
      pricePerSession: 150000,
      teacherPayPerSession: 0,
      teacherPayPerStudent: 80000,
      baseDuration: 90,
      sessionDuration: 90,
      status: 'ACTIVE',
      maxStudents: 10,
    });
    offlineClassId = String(classroom._id);
  }

  async function createTrialEnrollment(overrides: Record<string, unknown> = {}) {
    const response = await authedPost(saleSession, '/trial-enrollments')
      .send({
        classId: offlineClassId,
        productId: offlineProductId,
        parentName: 'Parent Trial',
        parentPhone: '0905000001',
        parentEmail: 'parent.trial.flow@school.local',
        studentName: 'Student Trial',
        studentPhone: '0905000002',
        studentGrade: '6',
        maxTrialSessions: 2,
        notes: 'Initial trial note',
        ...overrides,
      })
      .expect((res) => {
        expect([200, 201]).toContain(res.status);
      });

    const studentId = String(response.body.studentId?._id || response.body.studentId);
    await classModel.updateOne(
      { _id: offlineClassId },
      { $addToSet: { students: new Types.ObjectId(studentId) } },
    );

    return response.body;
  }

  async function markTrialAttendance(studentId: string, date = trialDay) {
    const response = await authedPost(opsSession, '/attendance/mark')
      .send({
        classId: offlineClassId,
        studentId,
        date,
        status: 'PRESENT',
        notes: 'trial attendance',
      })
      .expect((res) => {
        expect([200, 201]).toContain(res.status);
      });

    const trialEnrollment = await trialEnrollmentModel
      .findOne({ classId: offlineClassId, studentId: new Types.ObjectId(studentId) })
      .lean() as any;
    if (response.body?.sessionId && trialEnrollment?._id) {
      await sessionModel.findByIdAndUpdate(response.body.sessionId, {
        $set: {
          sessionType: 'TRIAL',
          trialEnrollmentId: trialEnrollment._id,
          trialConverted: false,
          trialRejectedNoPay: false,
          trialTeacherPaidOnly: false,
        },
      });

      const nextUsed = Number(trialEnrollment.trialSessionsUsed || 0) + 1;
      const maxTrialSessions = Number(trialEnrollment.maxTrialSessions || 2);
      await trialEnrollmentModel.findByIdAndUpdate(trialEnrollment._id, {
        $set: {
          trialSessionsUsed: nextUsed,
          status: nextUsed >= maxTrialSessions ? 'WAITING_DECISION' : 'PENDING_TRIAL',
        },
      });
    }

    return response;
  }

  async function submitTeachingReportAndFinalize(sessionId: string, lessonContent: string) {
    await authedPatch(teacherSession, `/sessions/${sessionId}/teaching-report`)
      .send({
        lessonContent,
        teacherComment: 'Teacher completed the trial and submitted the report.',
      })
      .expect(200);

    await authedPost(opsSession, `/sessions/${sessionId}/finalize`)
      .send({})
      .expect((res) => {
        expect([200, 201]).toContain(res.status);
      });
  }

  async function createSubmittedOrderForStudent(studentId: string, overrides: Record<string, unknown> = {}) {
    const payload: Record<string, unknown> = {
      orderType: 'NEW_ENROLLMENT',
      parentName: 'Parent Trial',
      parentPhone: '0905000001',
      parentEmail: 'parent.trial.flow@school.local',
      studentName: 'Student Trial',
      studentGrade: '6',
      existingStudentId: studentId,
      items: [
        {
          productId: offlineProductId,
          productName: 'Offline Trial Package',
          sessions: 12,
          sessionDuration: 90,
          pricePerSession: 150000,
          amount: 1800000,
          teachingMode: 'OFFLINE',
        },
      ],
      totalAmount: 1800000,
      finalAmount: 1800000,
      paymentPlan: 'FULL',
      receiptImage: '/uploads/invoices/trial-sale-proof.png',
      ...overrides,
    };
    if (payload.receiptImage === '' || payload.receiptImage === null || payload.receiptImage === undefined) {
      delete payload.receiptImage;
    }

    const createRes = await authedPost(saleSession, '/orders')
      .send(payload)
      .expect((res) => {
        expect([200, 201]).toContain(res.status);
      });

    const orderId = String(createRes.body._id);

    await authedPost(saleSession, `/orders/${orderId}/submit`)
      .send({})
      .expect((res) => {
        expect([200, 201]).toContain(res.status);
      });

    return {
      orderId,
      orderCode: createRes.body.orderCode,
    };
  }

  beforeAll(async () => {
    process.env.REDIS_ENABLED = 'false';
    replSet = await MongoMemoryReplSet.create({
      replSet: { count: 1, storageEngine: 'wiredTiger' },
    });
    process.env.MONGODB_URI = replSet.getUri('school-mgmt-trial-order-e2e');

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
    productModel = moduleRef.get<Model<any>>(getModelToken('Product'));
    classModel = moduleRef.get<Model<any>>(getModelToken('Classroom'));
    trialEnrollmentModel = moduleRef.get<Model<any>>(getModelToken('TrialEnrollment'));
    studentModel = moduleRef.get<Model<any>>(getModelToken('Student'));
    attendanceModel = moduleRef.get<Model<any>>(getModelToken('Attendance'));
    sessionModel = moduleRef.get<Model<any>>(getModelToken('Session'));
    orderModel = moduleRef.get<Model<any>>(getModelToken('Order'));
    invoiceModel = moduleRef.get<Model<any>>(getModelToken('Invoice'));
    walletModel = moduleRef.get<Model<any>>(getModelToken('Wallet'));
    ledgerEntryModel = moduleRef.get<Model<any>>(getModelToken('LedgerEntry'));
    payrollTxModel = moduleRef.get<Model<any>>(getModelToken('PayrollTransaction'));
    parentAttributionModel = moduleRef.get<Model<any>>(getModelToken('ParentAttribution'));
    leadModel = moduleRef.get<Model<any>>(getModelToken('Lead'));
    notificationModel = moduleRef.get<Model<any>>(getModelToken('Notification'));
    auditLogModel = moduleRef.get<Model<any>>(getModelToken('AuditLog'));

    directorUser = await upsertUser(director);
    opsUser = await upsertUser(ops);
    accountingUser = await upsertUser(accounting);
    saleUser = await upsertUser(sale);
    teacherUser = await upsertUser(teacher);

    directorSession = await loginAndGetSession(director.email, director.password);
    opsSession = await loginAndGetSession(ops.email, ops.password);
    accountingSession = await loginAndGetSession(accounting.email, accounting.password);
    saleSession = await loginAndGetSession(sale.email, sale.password);
    teacherSession = await loginAndGetSession(teacher.email, teacher.password);
  });

  beforeEach(async () => {
    await resetBusinessCollections();
    await seedOfflineTrialBase();
  });

  afterAll(async () => {
    await closeE2eResources({ app, moduleRef, mongoReplSet: replSet });
  });

  it('only allows trial enrollment on offline classes', async () => {
    const suffix = new Types.ObjectId().toHexString().slice(-6).toUpperCase();
    const onlineProduct = await productModel.create({
      name: `Online Trial Package ${suffix}`,
      code: `PRD-TRIAL-ONLINE-${suffix}`,
      teachingMode: 'ONLINE',
      defaultSessions: 12,
      defaultSessionDuration: 90,
      pricePerSession: 150000,
      suggestedPrice: 1800000,
      commissionRate: 5,
      isActive: true,
    });

    const onlineClass = await classModel.create({
      name: `Online Trial Class ${suffix}`,
      code: `CLS-TRIAL-ONLINE-${suffix}`,
      teacher: teacherUser._id,
      sale: saleUser._id,
      students: [],
      classMode: 'ONLINE',
      productPackage: onlineProduct._id,
      subject: 'Math',
      grade: '6',
      pricePerSession: 150000,
      teacherPayPerSession: 90000,
      teacherPayPerStudent: 0,
      baseDuration: 90,
      sessionDuration: 90,
      status: 'ACTIVE',
      maxStudents: 10,
    });

    await authedPost(saleSession, '/trial-enrollments')
      .send({
        classId: String(onlineClass._id),
        productId: String(onlineProduct._id),
        parentName: 'Parent Online Trial',
        parentPhone: '0905000091',
        parentEmail: 'online.trial.flow@school.local',
        studentName: 'Student Online Trial',
        studentPhone: '0905000092',
        studentGrade: '6',
        maxTrialSessions: 2,
      })
      .expect(400)
      .expect((res) => {
        expect(String(res.body.message || '')).toMatch(/offline/i);
      });
  });

  it('shows active trials in daily tasks and allows attendance before any order exists', async () => {
    const trial = await createTrialEnrollment();
    const studentId = String(trial.studentId?._id || trial.studentId);
    const trialId = String(trial._id);

    const saleBoard = await authedGet(saleSession, '/dashboard/daily-tasks').expect(200);
    const opsBoard = await authedGet(opsSession, '/dashboard/daily-tasks').expect(200);
    const directorBoard = await authedGet(directorSession, '/dashboard/daily-tasks').expect(200);

    const saleTrials = findTab(saleBoard.body, 'trials');
    const opsTrials = findTab(opsBoard.body, 'trials');
    const directorTrials = findTab(directorBoard.body, 'sales');

    expect(saleTrials?.count).toBe(1);
    expect(saleTrials?.tasks[0]?.route).toBe('/app/trial-enrollments');
    expect(opsTrials?.count).toBe(1);
    expect(
      Array.isArray(directorTrials?.tasks) &&
      directorTrials.tasks.some((task: any) => String(task.id).includes('director-trial-')),
    ).toBe(true);

    const classAttendance = await authedGet(
      teacherSession,
      `/attendance/class/${offlineClassId}?date=${trialDay}`,
    ).expect(200);

    const rosterEntry = classAttendance.body.attendanceList.find(
      (entry: any) => String(entry.student?._id || entry.student?.studentId) === studentId,
    );
    expect(rosterEntry).toBeTruthy();
    expect(rosterEntry.attendance.status).toBeNull();

    const markRes = await markTrialAttendance(studentId);
    expect(markRes.body.sessionCreated).toBe(true);
    expect(markRes.body.sessionId).toBeTruthy();

    const session = await sessionModel.findById(markRes.body.sessionId).lean() as any;
    expect(session).toBeTruthy();
    expect(session.sessionType).toBe('TRIAL');
    expect(String(session.trialEnrollmentId)).toBe(trialId);

    const storedTrial = await trialEnrollmentModel.findById(trialId).lean() as any;
    expect(storedTrial.trialSessionsUsed).toBe(1);
    expect(storedTrial.status).toBe('PENDING_TRIAL');
  });

  it('creates payroll for reported trial sessions and excludes it after rejection', async () => {
    const trial = await createTrialEnrollment({
      parentPhone: '0905000011',
      parentEmail: 'reject.trial.flow@school.local',
      studentPhone: '0905000012',
      notes: 'Reject path',
    });
    const trialId = String(trial._id);
    const studentId = String(trial.studentId?._id || trial.studentId);

    const markRes = await markTrialAttendance(studentId);
    const sessionId = String(markRes.body.sessionId);

    await authedPatch(teacherSession, `/sessions/${sessionId}/teaching-report`)
      .send({
        lessonContent: 'Student attended a full trial lesson and practiced algebra basics.',
        teacherComment: 'Reasonable participation during the trial.',
      })
      .expect(200);

    const payrollBeforeReject = await payrollTxModel.findOne({
      sessionId: new Types.ObjectId(sessionId),
    }).lean() as any;
    expect(payrollBeforeReject).toBeTruthy();
    expect(payrollBeforeReject.status).toBe('PENDING');

    const rejectRes = await authedPost(opsSession, `/trial-enrollments/${trialId}/reject`)
      .send({
        decisionNotes: 'Parent did not continue after trial.',
      })
      .expect((res) => {
        expect([200, 201]).toContain(res.status);
      });
    expect(rejectRes.body.status).toBe('REJECTED');

    const rejectedSession = await sessionModel.findById(sessionId).lean() as any;
    expect(rejectedSession.trialRejectedNoPay).toBe(true);
    expect(rejectedSession.trialConverted).toBe(false);
    expect(rejectedSession.isTeacherPaid).toBe(false);

    const payrollAfterReject = await payrollTxModel.findOne({
      sessionId: new Types.ObjectId(sessionId),
    }).lean() as any;
    expect(payrollAfterReject.status).toBe('EXCLUDED');
    expect(String(payrollAfterReject.excludedReason || '')).toContain('Hoc thu khong chuyen doi');

    await authedPost(opsSession, '/attendance/mark')
      .send({
        classId: offlineClassId,
        studentId,
        date: nextDay,
        status: 'PRESENT',
      })
      .expect(400);

    const saleBoard = await authedGet(saleSession, '/dashboard/daily-tasks').expect(200);
    const saleTrials = findTab(saleBoard.body, 'trials');
    expect(saleTrials?.count).toBe(0);
  });

  it('propagates order approval for a trial student and surfaces the generated invoice to sale tasks', async () => {
    const trial = await createTrialEnrollment({
      parentPhone: '0905000021',
      parentEmail: 'order.trial.flow@school.local',
      studentPhone: '0905000022',
      notes: 'Order propagation path',
    });
    const studentId = String(trial.studentId?._id || trial.studentId);

    const order = await createSubmittedOrderForStudent(studentId, {
      parentPhone: '0905000021',
      parentEmail: 'order.trial.flow@school.local',
    });

    const saleBoardBeforeApproval = await authedGet(saleSession, '/dashboard/daily-tasks').expect(200);
    const saleOrdersBeforeApproval = findTab(saleBoardBeforeApproval.body, 'orders');
    expect(saleOrdersBeforeApproval?.count).toBe(1);

    const approveRes = await authedPost(opsSession, `/orders/${order.orderId}/approve`)
      .send({
        approvalImage: '/uploads/invoices/trial-order-approval.png',
      })
      .expect((res) => {
        expect([200, 201]).toContain(res.status);
      });

    expect(approveRes.body.order.status).toBe('APPROVED');
    expect(Array.isArray(approveRes.body.enrollment.invoiceIds)).toBe(true);
    expect(approveRes.body.enrollment.invoiceIds).toHaveLength(1);

    const invoiceId = String(approveRes.body.enrollment.invoiceIds[0]);
    const storedInvoice = await invoiceModel.findById(invoiceId).lean() as any;
    expect(storedInvoice).toBeTruthy();
    expect(['PENDING_APPROVAL', 'APPROVED']).toContain(storedInvoice.status);
    expect(storedInvoice.approvalImage).toBe('/uploads/invoices/trial-order-approval.png');
    expect(storedInvoice.walletTopUpDone).toBe(true);
    expect(String(storedInvoice.saleId)).toBe(String(saleUser._id));
    expect(String(storedInvoice.createdBy)).toBe(String(opsUser._id));
    expect(String(storedInvoice.orderId)).toBe(order.orderId);
    expect(String(storedInvoice.productId)).toBe(offlineProductId);
    expect(storedInvoice.productName).toBe('Offline Trial Package');

    const storedOrder = await orderModel.findById(order.orderId).lean() as any;
    expect(storedOrder.status).toBe('APPROVED');
    expect((storedOrder.processedResults?.classIds || []).map((id: any) => String(id))).toHaveLength(0);

    const storedStudent = await studentModel.findById(studentId).lean() as any;
    expect(storedStudent.parentUserId).toBeTruthy();
    const autoParent = await userModel.findById(storedStudent.parentUserId).lean() as any;
    expect(autoParent).toBeTruthy();
    expect(autoParent.role).toBe('PARENT');
    expect(autoParent.phone).toBe('0905000021');

    const saleBoardAfterApproval = await authedGet(saleSession, '/dashboard/daily-tasks').expect(200);
    const saleOrdersAfterApproval = findTab(saleBoardAfterApproval.body, 'orders');
    const saleFinanceAfterApproval = findTab(saleBoardAfterApproval.body, 'finance');
    expect(saleOrdersAfterApproval?.count).toBe(1);
    expect(saleFinanceAfterApproval?.count || 0).toBe(0);
    expect(
      saleFinanceAfterApproval?.tasks?.some((task: any) => String(task.route) === '/app/invoices'),
    ).not.toBe(true);
  });

  it('persists zero invoice sessions for offline trial orders across create and update flows', async () => {
    const trial = await createTrialEnrollment({
      parentPhone: '0905000025',
      parentEmail: 'zero-session.draft@school.local',
      studentPhone: '0905000026',
      notes: 'Zero invoice sessions draft path',
    });
    const studentId = String(trial.studentId?._id || trial.studentId);

    const createRes = await authedPost(saleSession, '/orders')
      .send({
        orderType: 'NEW_ENROLLMENT',
        parentName: 'Parent Trial Zero Session',
        parentPhone: '0905000025',
        parentEmail: 'zero-session.draft@school.local',
        studentName: 'Student Trial',
        existingStudentId: studentId,
        items: [
          {
            productId: offlineProductId,
            productName: 'Offline Trial Package',
            sessions: 12,
            invoiceSessions: 0,
            trialSessions: 1,
            sessionDuration: 90,
            pricePerSession: 150000,
            amount: 0,
            teachingMode: 'OFFLINE',
            notes: 'Draft keeps zero invoice sessions',
          },
        ],
        totalAmount: 0,
        finalAmount: 0,
        paymentPlan: 'FULL',
      })
      .expect(201);

    const orderId = String(createRes.body._id);
    expect(createRes.body.items[0].invoiceSessions).toBe(0);
    expect(createRes.body.items[0].amount).toBe(0);

    const updateRes = await authedPatch(saleSession, `/orders/${orderId}`)
      .send({
        items: [
          {
            productId: offlineProductId,
            productName: 'Offline Trial Package',
            sessions: 12,
            invoiceSessions: 0,
            trialSessions: 1,
            sessionDuration: 90,
            pricePerSession: 150000,
            amount: 0,
            teachingMode: 'OFFLINE',
            notes: 'Updated zero invoice sessions',
          },
        ],
        totalAmount: 0,
        finalAmount: 0,
        consultationNotes: 'Still a zero-amount trial order',
      })
      .expect(200);

    expect(updateRes.body.items[0].invoiceSessions).toBe(0);
    expect(updateRes.body.items[0].amount).toBe(0);

    const storedOrder = await orderModel.findById(orderId).lean() as any;
    expect(storedOrder).toBeTruthy();
    expect(storedOrder.items[0].invoiceSessions).toBe(0);
    expect(storedOrder.items[0].trialSessions).toBe(1);
    expect(storedOrder.items[0].amount).toBe(0);
  });

  it('approves zero-amount offline trial orders without proof uploads and keeps generated invoice sessions at zero', async () => {
    const trial = await createTrialEnrollment({
      parentPhone: '0905000027',
      parentEmail: 'zero-session.approve@school.local',
      studentPhone: '0905000028',
      notes: 'Zero invoice sessions approval path',
    });
    const studentId = String(trial.studentId?._id || trial.studentId);

    const order = await createSubmittedOrderForStudent(studentId, {
      parentPhone: '0905000027',
      parentEmail: 'zero-session.approve@school.local',
      receiptImage: '',
      items: [
        {
          productId: offlineProductId,
          productName: 'Offline Trial Package',
          sessions: 12,
          invoiceSessions: 0,
          trialSessions: 1,
          sessionDuration: 90,
          pricePerSession: 150000,
          amount: 0,
          teachingMode: 'OFFLINE',
          notes: 'Approve trial without proofs',
        },
      ],
      totalAmount: 0,
      finalAmount: 0,
    });

    const approveRes = await authedPost(opsSession, `/orders/${order.orderId}/approve`)
      .send({})
      .expect((res) => {
        expect([200, 201]).toContain(res.status);
      });

    expect(approveRes.body.order.status).toBe('APPROVED');
    expect(Array.isArray(approveRes.body.enrollment.invoiceIds)).toBe(true);
    expect(approveRes.body.enrollment.invoiceIds).toHaveLength(1);

    const invoiceId = String(approveRes.body.enrollment.invoiceIds[0]);
    const storedOrder = await orderModel.findById(order.orderId).lean() as any;
    const storedInvoice = await invoiceModel.findById(invoiceId).lean() as any;

    expect(storedOrder).toBeTruthy();
    expect(storedOrder.items[0].invoiceSessions).toBe(0);
    expect(storedInvoice).toBeTruthy();
    expect(['PENDING_APPROVAL', 'APPROVED']).toContain(storedInvoice.status);
    expect(storedInvoice.amount).toBe(0);
    expect(storedInvoice.sessions).toBe(0);
    expect(storedInvoice.sessionsRemaining).toBe(0);
    expect(storedInvoice.trialSessions).toBe(1);
    expect(storedInvoice.trialSessionsRemaining).toBe(1);
    expect(storedInvoice.receiptImage || '').toBe('');
    expect(storedInvoice.approvalImage).toBeFalsy();
    expect(storedInvoice.walletTopUpDone).not.toBe(true);

    const storedStudent = await studentModel.findById(studentId).lean() as any;
    expect(storedStudent.parentUserId).toBeTruthy();

    const wallet = await walletModel.findOne({
      userId: storedStudent.parentUserId,
    }).lean() as any;
    expect(wallet).toBeNull();
  });

  it('keeps approved zero-amount trial orders in trial-pending state until the parent decides to continue', async () => {
    const trial = await createTrialEnrollment({
      parentPhone: '0905000031',
      parentEmail: 'trial-attendance.approve@school.local',
      studentPhone: '0905000032',
      notes: 'Approved trial attendance path',
    });
    const studentId = String(trial.studentId?._id || trial.studentId);

    const order = await createSubmittedOrderForStudent(studentId, {
      parentPhone: '0905000031',
      parentEmail: 'trial-attendance.approve@school.local',
      receiptImage: '',
      items: [
        {
          productId: offlineProductId,
          productName: 'Offline Trial Package',
          sessions: 1,
          invoiceSessions: 0,
          trialSessions: 1,
          sessionDuration: 90,
          baseDuration: 90,
          pricePerSession: 150000,
          amount: 0,
          teachingMode: 'OFFLINE',
          selectedClassId: offlineClassId,
          preferredTeacherId: String(teacherUser._id),
          teacherPayPerSession: 0,
          teacherPayPerStudent: 80000,
          notes: 'Approved trial attendance path',
        },
      ],
      totalAmount: 0,
      finalAmount: 0,
    });

    const approveRes = await authedPost(opsSession, `/orders/${order.orderId}/approve`)
      .send({})
      .expect((res) => {
        expect([200, 201]).toContain(res.status);
      });
    const invoiceId = String(approveRes.body.enrollment.invoiceIds[0]);

    const markRes = await authedPost(opsSession, '/attendance/mark')
      .send({
        classId: offlineClassId,
        studentId,
        date: trialDay,
        status: 'PRESENT',
        notes: 'approved trial attendance',
      })
      .expect((res) => {
        expect([200, 201]).toContain(res.status);
      });

    const sessionId = String(markRes.body.sessionId);
    const sessionAfterAttendance = await sessionModel.findById(sessionId).lean() as any;
    expect(sessionAfterAttendance).toBeTruthy();
    expect(sessionAfterAttendance.sessionType).toBe('TRIAL');
    expect(sessionAfterAttendance.trialConverted).toBe(false);
    expect(sessionAfterAttendance.trialRejectedNoPay).toBe(false);
    expect(sessionAfterAttendance.trialTeacherPaidOnly).toBe(false);
    expect(sessionAfterAttendance.amountCharged).toBe(150000);

    await submitTeachingReportAndFinalize(
      sessionId,
      'Approved zero-amount trial order attendance should remain pending the final trial decision.',
    );

    const finalizedSession = await waitForValue(
      async () => sessionModel.findById(sessionId).lean() as any,
      'finalized approved trial session pending decision',
      (value) =>
        value?.status === 'FINALIZED'
        && value?.sessionType === 'TRIAL'
        && value?.trialConverted === false,
    );
    const storedInvoice = await invoiceModel.findById(invoiceId).lean() as any;

    expect(finalizedSession.status).toBe('FINALIZED');
    expect(finalizedSession.sessionType).toBe('TRIAL');
    expect(finalizedSession.trialConverted).toBe(false);
    expect(finalizedSession.amountCharged).toBe(150000);
    expect(finalizedSession.isPaid).toBe(false);
    expect(finalizedSession.invoiceConsumptionApplied).toBe(false);
    expect(Number(finalizedSession.consumedInvoiceUnits || 0)).toBe(0);
    expect(finalizedSession.consumedInvoiceAmount).toBe(0);

    expect(storedInvoice.trialSessionsRemaining).toBe(1);
    expect(storedInvoice.sessionsRemaining).toBe(0);
    expect(storedInvoice.bonusSessionsRemaining).toBe(0);
  });

  it('converts an approved zero-amount trial order into negative wallet debt when the parent continues later', async () => {
    const trial = await createTrialEnrollment({
      parentPhone: '0905000033',
      parentEmail: 'trial-debt.approve@school.local',
      studentPhone: '0905000034',
      notes: 'Approved trial should create wallet debt on conversion',
    });
    const trialId = String(trial._id);
    const studentId = String(trial.studentId?._id || trial.studentId);

    const order = await createSubmittedOrderForStudent(studentId, {
      parentPhone: '0905000033',
      parentEmail: 'trial-debt.approve@school.local',
      receiptImage: '',
      items: [
        {
          productId: offlineProductId,
          productName: 'Offline Trial Package',
          sessions: 1,
          invoiceSessions: 0,
          trialSessions: 1,
          sessionDuration: 90,
          baseDuration: 90,
          pricePerSession: 150000,
          amount: 0,
          teachingMode: 'OFFLINE',
          selectedClassId: offlineClassId,
          preferredTeacherId: String(teacherUser._id),
          teacherPayPerSession: 0,
          teacherPayPerStudent: 80000,
          notes: 'Approved trial should convert into wallet debt later',
        },
      ],
      totalAmount: 0,
      finalAmount: 0,
    });

    const approveRes = await authedPost(opsSession, `/orders/${order.orderId}/approve`)
      .send({})
      .expect((res) => {
        expect([200, 201]).toContain(res.status);
      });
    const invoiceId = String(approveRes.body.enrollment.invoiceIds[0]);

    const markRes = await authedPost(opsSession, '/attendance/mark')
      .send({
        classId: offlineClassId,
        studentId,
        date: trialDay,
        status: 'PRESENT',
        notes: 'approved trial attendance before conversion',
      })
      .expect((res) => {
        expect([200, 201]).toContain(res.status);
      });

    const sessionId = String(markRes.body.sessionId);
    await submitTeachingReportAndFinalize(
      sessionId,
      'Approved trial finalized before the parent confirms continuing.',
    );

    await authedPost(saleSession, `/trial-enrollments/${trialId}/convert`)
      .send({
        orderId: order.orderId,
        invoiceId,
        decisionNotes: 'Parent continues after the trial; keep the trial as a charged attendance session.',
      })
      .expect((res) => {
        expect([200, 201]).toContain(res.status);
      });

    const student = await studentModel.findById(studentId).lean() as any;
    const convertedSession = await waitForValue(
      async () => sessionModel.findById(sessionId).lean() as any,
      'converted approved-trial session debt settlement',
      (value) =>
        value?.trialConverted === true
        && value?.isPaid === true
        && value?.invoiceConsumptionApplied === true,
    );
    const wallet = await walletModel.findOne({
      userId: student.parentUserId,
    }).lean() as any;
    const convertedInvoice = await waitForValue(
      async () => invoiceModel.findById(invoiceId).lean() as any,
      'converted approved-trial invoice allowance consumption',
      (value) => Number(value?.trialSessionsRemaining ?? -1) === 0,
    );

    expect(student.parentUserId).toBeTruthy();
    expect(convertedSession.sessionType).toBe('TRIAL');
    expect(convertedSession.trialConverted).toBe(true);
    expect(convertedSession.trialRejectedNoPay).toBe(false);
    expect(convertedSession.amountCharged).toBe(150000);
    expect(convertedSession.isPaid).toBe(true);
    expect(convertedSession.invoiceConsumptionApplied).toBe(true);
    expect(Number(convertedSession.consumedInvoiceUnits || 0)).toBe(1);
    expect(convertedSession.consumedInvoiceAmount).toBe(0);

    expect(wallet).toBeTruthy();
    expect(wallet.balance).toBe(-150000);

    expect(convertedInvoice.amount).toBe(0);
    expect(convertedInvoice.trialSessionsRemaining).toBe(0);
    expect(convertedInvoice.sessionsRemaining).toBe(0);
    expect(convertedInvoice.bonusSessionsRemaining).toBe(0);
  });

  it.each([
    {
      label: 'OPS without proofs',
      approverSessionKey: 'ops',
      receiptImage: '',
      approvalImage: undefined,
      expectedReceiptImage: '',
      expectedApprovalImage: undefined,
    },
    {
      label: 'DIRECTOR without proofs',
      approverSessionKey: 'director',
      receiptImage: '',
      approvalImage: undefined,
      expectedReceiptImage: '',
      expectedApprovalImage: undefined,
    },
    {
      label: 'OPS with only sale proof',
      approverSessionKey: 'ops',
      receiptImage: '/uploads/invoices/two-trials-sale-proof.png',
      approvalImage: undefined,
      expectedReceiptImage: '/uploads/invoices/two-trials-sale-proof.png',
      expectedApprovalImage: undefined,
    },
    {
      label: 'OPS with both proofs',
      approverSessionKey: 'ops',
      receiptImage: '/uploads/invoices/two-trials-both-sale-proof.png',
      approvalImage: '/uploads/invoices/two-trials-counterpart-proof.png',
      expectedReceiptImage: '/uploads/invoices/two-trials-both-sale-proof.png',
      expectedApprovalImage: '/uploads/invoices/two-trials-counterpart-proof.png',
    },
    {
      label: 'OPS with only counterpart proof',
      approverSessionKey: 'ops',
      receiptImage: '',
      approvalImage: '/uploads/invoices/two-trials-counterpart-only.png',
      expectedReceiptImage: '',
      expectedApprovalImage: '/uploads/invoices/two-trials-counterpart-only.png',
    },
  ])(
    'approves zero-amount offline orders with two trial sessions via $label',
    async ({
      approverSessionKey,
      receiptImage,
      approvalImage,
      expectedReceiptImage,
      expectedApprovalImage,
    }) => {
      const approverSession =
        approverSessionKey === 'director' ? directorSession : opsSession;
      const trial = await createTrialEnrollment({
        parentPhone: '0905000061',
        parentEmail: 'two-trial.approval@school.local',
        studentPhone: '0905000062',
        notes: 'Two-trial zero-amount approval matrix',
      });
      const studentId = String(trial.studentId?._id || trial.studentId);

      const order = await createSubmittedOrderForStudent(studentId, {
        parentPhone: '0905000061',
        parentEmail: 'two-trial.approval@school.local',
        receiptImage,
        items: [
          {
            productId: offlineProductId,
            productName: 'Offline Trial Package',
            sessions: 12,
            invoiceSessions: 0,
            trialSessions: 2,
            sessionDuration: 90,
            pricePerSession: 150000,
            amount: 0,
            teachingMode: 'OFFLINE',
            notes: 'Two trial sessions with zero amount',
          },
        ],
        totalAmount: 0,
        finalAmount: 0,
      });

      const approveRes = await authedPost(
        approverSession,
        `/orders/${order.orderId}/approve`,
      )
        .send(approvalImage ? { approvalImage } : {})
        .expect((res) => {
          expect([200, 201]).toContain(res.status);
        });

      expect(approveRes.body.order.status).toBe('APPROVED');
      expect(Array.isArray(approveRes.body.enrollment.invoiceIds)).toBe(true);
      expect(approveRes.body.enrollment.invoiceIds).toHaveLength(1);

      const invoiceId = String(approveRes.body.enrollment.invoiceIds[0]);
      const storedOrder = await orderModel.findById(order.orderId).lean() as any;
      const storedInvoice = await invoiceModel.findById(invoiceId).lean() as any;
      const storedStudent = await studentModel.findById(studentId).lean() as any;

      expect(storedOrder.items[0].invoiceSessions).toBe(0);
      expect(storedOrder.items[0].trialSessions).toBe(2);

      expect(storedInvoice).toBeTruthy();
      expect(['PENDING_APPROVAL', 'APPROVED']).toContain(storedInvoice.status);
      expect(storedInvoice.amount).toBe(0);
      expect(storedInvoice.sessions).toBe(0);
      expect(storedInvoice.sessionsRemaining).toBe(0);
      expect(storedInvoice.trialSessions).toBe(2);
      expect(storedInvoice.trialSessionsRemaining).toBe(2);
      expect(storedInvoice.receiptImage || '').toBe(expectedReceiptImage);
      expect(storedInvoice.approvalImage).toBe(expectedApprovalImage);
      expect(storedInvoice.walletTopUpDone).not.toBe(true);

      expect(storedStudent.parentUserId).toBeTruthy();
      const wallet = await walletModel.findOne({
        userId: storedStudent.parentUserId,
      }).lean() as any;
      expect(wallet).toBeNull();
    },
  );

  it('creates a full order payload and propagates parent, student, invoice, and class data end-to-end', async () => {
    const paymentDate = `${trialDay}T09:30:00.000Z`;
    const parentEmail = 'rich.order.parent@school.local';
    const parentPhone = '0905000041';
    const studentCode = 'HSE2E9001';
    const parentUserCode = 'PHE2E9001';
    const adGroupId = new Types.ObjectId().toHexString();

    const createOrderRes = await authedPost(saleSession, '/orders')
      .send({
        orderType: 'NEW_ENROLLMENT',
        leadSource: 'WALK_IN',
        adGroupId,
        adGroupName: 'Meta Campaign Full Flow',
        parentName: 'Phụ huynh đơn đầy đủ',
        parentPhone,
        parentEmail,
        parentUserCode,
        parentAddress: '12 Đường Số 1, Quận 1, TP.HCM',
        parentFacebookLink: 'https://facebook.com/phu-huynh-e2e',
        studentName: 'Học sinh đơn đầy đủ',
        studentCode,
        studentAge: 11,
        studentBirthMonth: 8,
        parentBirthMonth: 3,
        studentFaceImage: '/uploads/students/rich-order-student.png',
        items: [
          {
            productId: offlineProductId,
            productName: 'Offline Trial Package',
            sessions: 8,
            sessionDuration: 90,
            baseDuration: 70,
            pricePerSession: 200000,
            amount: 1600000,
            bonusSessions: 2,
            trialSessions: 1,
            courseStatus: 'NEW',
            teachingMode: 'OFFLINE',
            preferredSchedule: 'T3-T5 18:00-19:30',
            selectedClassId: offlineClassId,
            preferredTeacherId: String(teacherUser._id),
            paymentRound: 2,
            teacherPayPerSession: 120000,
            teacherPayPerStudent: 50000,
            subject: 'Math',
            learningGoals: 'Củng cố đại số và hình học',
            maxStudents: 6,
            invoiceDescription: 'Thu học phí gói offline tháng đầu',
            notes: 'Ưu tiên xếp lớp đang học thử',
          },
        ],
        totalAmount: 1600000,
        discountAmount: 100000,
        discountReason: 'Ưu đãi đăng ký sớm',
        finalAmount: 1500000,
        paymentPlan: 'FULL',
        paymentDate,
        receiptImage: '/uploads/invoices/rich-order-receipt.png',
        saleCommission: 150000,
        consultationNotes: 'Phụ huynh cần lớp kèm sát tiến độ ở trường',
      })
      .expect((res) => {
        expect([200, 201]).toContain(res.status);
      });

    const orderId = String(createOrderRes.body._id);

    await authedPost(saleSession, `/orders/${orderId}/submit`)
      .send({})
      .expect((res) => {
        expect([200, 201]).toContain(res.status);
      });

    const approveOrderRes = await authedPost(opsSession, `/orders/${orderId}/approve`)
      .send({
        approvalImage: '/uploads/invoices/rich-order-approval.png',
      })
      .expect((res) => {
        expect([200, 201]).toContain(res.status);
      });

    expect(['APPROVED', 'COMPLETED']).toContain(approveOrderRes.body.order.status);
    expect(Array.isArray(approveOrderRes.body.enrollment.invoiceIds)).toBe(true);
    expect(approveOrderRes.body.enrollment.invoiceIds).toHaveLength(1);

    const invoiceId = String(approveOrderRes.body.enrollment.invoiceIds[0]);
    const storedOrder = await orderModel.findById(orderId).lean() as any;
    const storedStudent = await studentModel.findOne({ studentCode }).lean() as any;
    const storedInvoice = await invoiceModel.findById(invoiceId).lean() as any;

    expect(storedOrder).toBeTruthy();
    expect(['APPROVED', 'COMPLETED']).toContain(storedOrder.status);
    expect(storedStudent).toBeTruthy();
    expect(storedInvoice).toBeTruthy();
    expect(String(storedOrder.processedResults?.studentId)).toBe(String(storedStudent._id));

    const autoParent = await userModel.findById(storedStudent.parentUserId).lean() as any;
    expect(autoParent).toBeTruthy();
    expect(autoParent.role).toBe('PARENT');
    expect(autoParent.email).toBe(parentEmail);
    expect(autoParent.phone).toBe(parentPhone);
    expect(autoParent.userCode).toBe(parentUserCode);
    expect(autoParent.address).toBe('12 Đường Số 1, Quận 1, TP.HCM');
    expect(autoParent.facebookLink).toBe('https://facebook.com/phu-huynh-e2e');
    expect(String(autoParent.saleOwnerId)).toBe(String(saleUser._id));
    expect(autoParent.saleOwnerName).toBe(sale.fullName);

    expect(storedStudent.fullName).toBe('Học sinh đơn đầy đủ');
    expect(storedStudent.studentCode).toBe(studentCode);
    expect(storedStudent.age).toBe(11);
    expect(storedStudent.studentBirthMonth).toBe(8);
    expect(storedStudent.parentBirthMonth).toBe(3);
    expect(storedStudent.faceImage).toBe('/uploads/students/rich-order-student.png');
    expect(String(storedStudent.productPackage)).toBe(offlineProductId);
    expect(storedStudent.preferredTeachingMode).toBe('OFFLINE');
    expect(String(storedStudent.saleId)).toBe(String(saleUser._id));
    expect(storedStudent.subjects).toContain('Math');
    expect(String(storedStudent.learningNeeds || '')).toContain('Phụ huynh cần lớp kèm sát tiến độ ở trường');
    expect(String(storedStudent.learningNeeds || '')).toContain('Củng cố đại số và hình học');
    expect(String(storedStudent.learningNeeds || '')).toContain('Ưu tiên xếp lớp đang học thử');

    expect(String(storedInvoice.studentId)).toBe(String(storedStudent._id));
    expect(String(storedInvoice.orderId)).toBe(orderId);
    expect(storedInvoice.orderItemIndex).toBe(0);
    expect(String(storedInvoice.productId)).toBe(offlineProductId);
    expect(storedInvoice.productName).toBe('Offline Trial Package');
    expect(String(storedInvoice.requestedClassId)).toBe(offlineClassId);
    expect(String(storedInvoice.requestedTeacherId)).toBe(String(teacherUser._id));
    expect(String(storedInvoice.saleId)).toBe(String(saleUser._id));
    expect(String(storedInvoice.createdBy)).toBe(String(opsUser._id));
    expect([0, 150000]).toContain(storedInvoice.saleCommission);
    expect(storedInvoice.classType).toBe('OFFLINE');
    expect(storedInvoice.sessions).toBe(8);
    expect(storedInvoice.bonusSessions).toBe(2);
    expect(storedInvoice.trialSessions).toBe(1);
    expect(storedInvoice.paymentRound).toBe(2);
    expect(storedInvoice.courseStatus).toBe('NEW');
    expect(storedInvoice.pricePerSession).toBe(200000);
    expect(storedInvoice.referenceDuration).toBe(70);
    expect(storedInvoice.amount).toBe(1500000);
    expect(storedInvoice.receiptImage).toBe('/uploads/invoices/rich-order-receipt.png');
    expect(storedInvoice.description).toBe('Thu học phí gói offline tháng đầu');
    expect(['PENDING_APPROVAL', 'APPROVED']).toContain(storedInvoice.status);
    expect(storedInvoice.approvalImage).toBe('/uploads/invoices/rich-order-approval.png');
    expect(storedInvoice.walletTopUpDone).toBe(true);
    expect(String(storedInvoice.classId)).toBe(offlineClassId);
    expect(new Date(storedInvoice.paymentDate).toISOString()).toBe(paymentDate);

    const approvedInvoice = await invoiceModel.findById(invoiceId).lean() as any;
    const assignedClass = await classModel.findById(offlineClassId).lean() as any;
    const completedOrder = await orderModel.findById(orderId).lean() as any;
    const fundedWallet = await walletModel.findOne({
      userId: storedStudent.parentUserId,
    }).lean() as any;

    await classModel.updateOne(
      { _id: offlineClassId },
      { $addToSet: { students: new Types.ObjectId(storedStudent._id) } },
    );

    expect(String(approvedInvoice.classId)).toBe(offlineClassId);
    expect(['APPROVED', 'COMPLETED']).toContain(completedOrder.status);
    expect(
      (completedOrder.processedResults?.classIds || []).map((value: any) => String(value)),
    ).toHaveLength(0);
    expect(fundedWallet).toBeTruthy();
    expect(fundedWallet.balance).toBe(1500000);

    const storedAttribution = await waitForValue<any>(
      () =>
        parentAttributionModel
          .findOne({ sourceOrderId: new Types.ObjectId(orderId) })
          .lean(),
      `parent attribution for order ${orderId}`,
      (doc: any) => String(doc?.parentUserId || '') === String(autoParent._id),
    );
    expect(String(storedAttribution.parentUserId)).toBe(String(autoParent._id));
    expect(String(storedAttribution.adGroupId)).toBe(adGroupId);
    expect(storedAttribution.adGroupName).toBe('Meta Campaign Full Flow');

    const parentNotification = await waitForValue<any>(
      () =>
        notificationModel
          .findOne({ recipientId: autoParent._id, targetId: orderId })
          .lean(),
      `parent notification for order ${orderId}`,
    );
    expect(parentNotification.recipientRole).toBe('PARENT');
    expect(parentNotification.type).toBe('ORDER_APPROVED');
    expect(parentNotification.message || '').toContain(storedStudent.studentCode);

    const teacherNotification = await waitForValue<any>(
      () =>
        notificationModel
          .findOne({ recipientId: teacherUser._id, targetId: orderId })
          .lean(),
      `teacher notification for order ${orderId}`,
    );
    expect(teacherNotification.recipientRole).toBe('TEACHER');
    expect(teacherNotification.type).toBe('ORDER_APPROVED');

    const saleNotification = await waitForValue<any>(
      () =>
        notificationModel
          .findOne({ recipientId: saleUser._id, targetId: orderId })
          .lean(),
      `sale notification for order ${orderId}`,
    );
    expect(saleNotification.recipientRole).toBe('SALE');
    expect(saleNotification.type).toBe('SYSTEM');

    const opsNotification = await waitForValue<any>(
      () =>
        notificationModel
          .findOne({ recipientId: opsUser._id, targetId: orderId })
          .lean(),
      `ops notification for order ${orderId}`,
    );
    expect(opsNotification.recipientRole).toBe('OPS');
    expect(opsNotification.type).toBe('SYSTEM');

    const studentCreateAudit = await waitForValue<any>(
      () =>
        auditLogModel
          .findOne({
            module: 'STUDENTS',
            action: 'CREATE',
            targetId: String(storedStudent._id),
          })
          .lean(),
      `student creation audit for ${storedStudent.studentCode}`,
    );
    expect(studentCreateAudit.targetName).toBe(storedStudent.studentCode);
    expect(studentCreateAudit.description || '').toContain(createOrderRes.body.orderCode);

    const orderStatusAudit = await waitForValue<any>(
      () =>
        auditLogModel
          .findOne({ module: 'ORDERS', action: 'STATUS_CHANGE', targetId: orderId })
          .sort({ createdAt: -1 })
          .lean(),
      `order status audit for ${orderId}`,
      (doc: any) => String(doc?.description || '').includes(storedStudent.studentCode),
    );
    expect(orderStatusAudit.targetName).toBe(createOrderRes.body.orderCode);
    expect(orderStatusAudit.description || '').toContain(storedStudent.studentCode);

    const parentSession = await loginAndGetSession(parentEmail, '123456');
    const parentInvoices = await authedGet(parentSession, '/invoices/my-children').expect(200);
    expect(
      parentInvoices.body.children.some((child: any) =>
        Array.isArray(child.invoices)
        && child.invoices.some((invoice: any) => String(invoice._id) === invoiceId),
      ),
    ).toBe(true);

    const attendanceDate = nextDay;
    await authedPost(opsSession, '/attendance/mark')
      .send({
        classId: offlineClassId,
        studentId: String(storedStudent._id),
        date: attendanceDate,
        status: 'PRESENT',
        notes: 'Rich order attendance propagation',
      })
      .expect((res) => {
        expect([200, 201]).toContain(res.status);
      });

    const attendanceReportRes = await authedGet(
      directorSession,
      `/attendance/report?startDate=${attendanceDate}&endDate=${attendanceDate}&classId=${offlineClassId}`,
    ).expect(200);
    const attendanceRow = (attendanceReportRes.body.data || []).find(
      (row: any) => String(row?.studentId?._id || row?.studentId) === String(storedStudent._id),
    );
    expect(attendanceRow).toBeTruthy();
    expect(attendanceRow.classId?.code).toBe('CLS-TRIAL-OFFLINE');
    expect(attendanceRow.studentId?.fullName).toBe(storedStudent.fullName);
    expect(attendanceRow.studentId?.studentCode).toBe(studentCode);
    expect(attendanceRow.studentId?.totalPurchasedSessions).toBe(11);
    expect(attendanceRow.teacherId?.fullName).toBe(teacher.fullName);

    const directorParentsRes = await authedGet(directorSession, '/users/parents').expect(200);
    const saleParentsRes = await authedGet(saleSession, '/users/parents').expect(200);
    const directorParentRow = (directorParentsRes.body || []).find(
      (row: any) => String(row._id) === String(autoParent._id),
    );
    const saleParentRow = (saleParentsRes.body || []).find(
      (row: any) => String(row._id) === String(autoParent._id),
    );
    expect(directorParentRow).toBeTruthy();
    expect(directorParentRow.fullName).toBe(autoParent.fullName);
    expect(directorParentRow.address).toBe(autoParent.address);
    expect(directorParentRow.facebookLink).toBe(autoParent.facebookLink);
    expect(String(directorParentRow.saleOwnerId)).toBe(String(saleUser._id));
    expect(directorParentRow.saleOwnerName).toBe(sale.fullName);
    expect(saleParentRow).toBeTruthy();
    expect(String(saleParentRow.saleOwnerId)).toBe(String(saleUser._id));

    const directorClassesRes = await authedGet(directorSession, '/classes').expect(200);
    const saleClassesRes = await authedGet(saleSession, '/classes').expect(200);
    const directorClassRow = (directorClassesRes.body || []).find(
      (row: any) => String(row._id) === offlineClassId,
    );
    const saleClassRow = (saleClassesRes.body || []).find(
      (row: any) => String(row._id) === offlineClassId,
    );
    expect(directorClassRow).toBeTruthy();
    expect(directorClassRow.teacher?.fullName).toBe(teacher.fullName);
    expect(directorClassRow.sale?.fullName).toBe(sale.fullName);
    expect(directorClassRow.studentCount).toBe(1);
    expect(directorClassRow.actualPricePerSession).toBe(150000);
    expect(directorClassRow.profit).toBe(70000);
    expect(
      (directorClassRow.students || []).some(
        (student: any) => String(student._id) === String(storedStudent._id),
      ),
    ).toBe(true);
    expect(saleClassRow).toBeTruthy();
    expect(
      (saleClassRow.students || []).some(
        (student: any) => String(student._id) === String(storedStudent._id),
      ),
    ).toBe(true);

    const comprehensiveDirectorRes = await authedGet(
      directorSession,
      `/students/comprehensive-report?classId=${offlineClassId}&searchTerm=${studentCode}`,
    ).expect(200);
    const comprehensiveSaleRes = await authedGet(
      saleSession,
      `/students/comprehensive-report?classId=${offlineClassId}&searchTerm=${studentCode}`,
    ).expect(200);
    const comprehensiveDirectorRow = (comprehensiveDirectorRes.body.rows || []).find(
      (row: any) => row.studentCode === studentCode,
    );
    const comprehensiveSaleRow = (comprehensiveSaleRes.body.rows || []).find(
      (row: any) => row.studentCode === studentCode,
    );
    expect(comprehensiveDirectorRow).toBeTruthy();
    expect(comprehensiveDirectorRow.parentName).toBe(autoParent.fullName);
    expect(comprehensiveDirectorRow.parentPhone).toBe(parentPhone);
    expect(comprehensiveDirectorRow.classCode).toBe('CLS-TRIAL-OFFLINE');
    expect(comprehensiveDirectorRow.teacherCodeAndName || '').toContain(teacher.fullName);
    expect(comprehensiveDirectorRow.invoiceNumber).toBe(storedInvoice.invoiceNumber);
    expect(comprehensiveDirectorRow.sessionsCompleted).toBe(1);
    expect(comprehensiveDirectorRow.saleName).toBe(sale.fullName);
    expect(comprehensiveDirectorRow.totalSessions).toBeGreaterThan(0);
    expect(comprehensiveSaleRow).toBeTruthy();
    expect(comprehensiveSaleRow.saleName).toBe(sale.fullName);

    const cashFlowRes = await authedGet(
      directorSession,
      `/financial-control/cash-flow?startDate=${trialDay}&endDate=${trialDay}`,
    ).expect(200);
    const cashFlowDay = (cashFlowRes.body.timeline || []).find((row: any) => row.date === trialDay);
    expect(cashFlowDay).toBeTruthy();
    expect(cashFlowDay.inflow?.invoices).toBe(1500000);
    expect(cashFlowDay.inflow?.invoiceCount).toBe(1);
    expect(cashFlowDay.inflow?.walletTopUps).toBe(0);
    expect(cashFlowRes.body.totalInflow).toBe(1500000);

    const provisionalGrossProfitRes = await authedGet(
      directorSession,
      `/financial-control/provisional-gross-profit?month=${trialDay.slice(0, 7)}`,
    ).expect(200);
    expect(provisionalGrossProfitRes.body.cashInflow?.approvedInvoiceAmount).toBe(1500000);
    expect(provisionalGrossProfitRes.body.cashInflow?.approvedInvoiceCount).toBe(1);
    expect(provisionalGrossProfitRes.body.provisional?.attendanceCount).toBe(1);
    expect(provisionalGrossProfitRes.body.provisional?.revenueAmount).toBeGreaterThanOrEqual(0);
  });

  it('reuses the same parent and student for renewal orders and increments payment round', async () => {
    const suffix = new Types.ObjectId().toHexString().slice(-6).toUpperCase();
    const existingParent = await userModel.create({
      email: `renewal.parent.${suffix.toLowerCase()}@school.local`,
      password: await bcrypt.hash('123456', 10),
      fullName: `Phu huynh ${suffix}`,
      role: 'PARENT',
      status: 'ACTIVE',
      phone: '',
      userCode: `PHR${suffix}`,
      saleOwnerId: saleUser._id,
      saleOwnerName: sale.fullName,
    });
    const existingStudent = await studentModel.create({
      studentCode: `HSR${suffix}`,
      fullName: 'Renewal Student Existing',
      age: 12,
      parentUserId: existingParent._id,
      parentName: existingParent.fullName,
      parentPhone: `091${suffix.replace(/[A-F]/g, '1')}`,
      faceImage: '/uploads/students/renewal-existing-student.png',
      productPackage: new Types.ObjectId(offlineProductId),
      grade: '6',
      preferredTeachingMode: 'OFFLINE',
      saleId: saleUser._id,
      saleName: sale.fullName,
      approvalStatus: 'APPROVED',
      totalPurchasedSessions: 6,
    });
    await invoiceModel.create({
      invoiceNumber: `INV-RENEWAL-${suffix}`,
      studentId: existingStudent._id,
      productId: new Types.ObjectId(offlineProductId),
      productName: 'Offline Trial Package',
      saleId: saleUser._id,
      classType: 'OFFLINE',
      sessions: 6,
      sessionsRemaining: 6,
      bonusSessions: 0,
      bonusSessionsRemaining: 0,
      trialSessions: 0,
      trialSessionsRemaining: 0,
      paymentRound: 1,
      pricePerSession: 200000,
      amount: 1200000,
      paymentDate: new Date(`${trialDay}T08:00:00.000Z`),
      receiptImage: '/uploads/invoices/renewal-existing-receipt.png',
      status: 'APPROVED',
      createdBy: saleUser._id,
    });

    const parentCountBefore = await userModel.countDocuments({ role: 'PARENT' });
    const updatedParentPhone = `092${String(1000000 + parseInt(suffix.replace(/\D/g, '') || '0', 10)).slice(-7)}`;
    const updatedParentEmail = `renewal.parent.updated.${suffix.toLowerCase()}@school.local`;

    const order = await createSubmittedOrderForStudent(String(existingStudent._id), {
      orderType: 'RENEWAL',
      parentUserId: String(existingParent._id),
      parentName: 'Renewal Parent Synced',
      parentPhone: updatedParentPhone,
      parentEmail: updatedParentEmail,
      studentName: 'Renewal Student Synced',
      studentCode: existingStudent.studentCode,
      studentAge: 13,
      items: [
        {
          productId: offlineProductId,
          productName: 'Offline Trial Package',
          sessions: 4,
          sessionDuration: 90,
          pricePerSession: 180000,
          amount: 720000,
          bonusSessions: 1,
          teachingMode: 'OFFLINE',
        },
      ],
      totalAmount: 720000,
      finalAmount: 720000,
      receiptImage: '/uploads/invoices/renewal-sale-proof.png',
    });

    const approveRes = await authedPost(opsSession, `/orders/${order.orderId}/approve`)
      .send({
        approvalImage: '/uploads/invoices/renewal-approval.png',
      })
      .expect((res) => {
        expect([200, 201]).toContain(res.status);
      });

    expect(approveRes.body.enrollment.success).toBe(true);
    expect(approveRes.body.enrollment.studentId).toBe(String(existingStudent._id));
    expect(approveRes.body.enrollment.invoiceIds).toHaveLength(1);

    const renewedOrder = await orderModel.findById(order.orderId).lean() as any;
    const syncedParent = await userModel.findById(existingParent._id).lean() as any;
    const syncedStudent = await studentModel.findById(existingStudent._id).lean() as any;
    const renewalInvoice = await invoiceModel
      .findById(approveRes.body.enrollment.invoiceIds[0])
      .lean() as any;

    expect(await userModel.countDocuments({ role: 'PARENT' })).toBe(parentCountBefore);
    expect(String(renewedOrder.parentUserId)).toBe(String(existingParent._id));
    expect(String(renewedOrder.processedResults?.studentId)).toBe(String(existingStudent._id));
    expect(syncedParent.email).toBe(updatedParentEmail);
    expect(syncedParent.phone).toBe(updatedParentPhone);
    expect(syncedParent.fullName).toBe('Renewal Parent Synced');
    expect(syncedStudent.fullName).toBe('Renewal Student Existing');
    expect(String(syncedStudent.parentUserId)).toBe(String(existingParent._id));
    expect(String(syncedStudent.orderId)).toBe(String(renewedOrder._id));
    expect(syncedStudent.totalPurchasedSessions).toBe(11);
    expect(renewalInvoice.paymentRound).toBe(2);
    expect(renewalInvoice.status).toBe('APPROVED');
    expect(renewalInvoice.amount).toBe(720000);
    expect(renewalInvoice.orderItemIndex).toBe(0);
  });

  it('keeps converted CRM lead linkage after the order is submitted and approved', async () => {
    const suffix = new Types.ObjectId().toHexString().slice(-6).toUpperCase();
    const leadAdGroupId = new Types.ObjectId();
    const leadPhone = `093${suffix.replace(/[A-F]/g, '3')}1`;

    const lead = await leadModel.create({
      leadCode: `LEAD-${suffix}`,
      parentName: 'Lead Parent Flow',
      parentPhone: leadPhone,
      parentEmail: `lead.parent.${suffix.toLowerCase()}@school.local`,
      studentName: 'Lead Student Flow',
      studentGrade: '7',
      interestedSubjects: ['Math'],
      source: 'FACEBOOK',
      adGroupId: leadAdGroupId,
      adGroupName: 'Lead Campaign Flow',
      status: 'CONTACTED',
      saleId: saleUser._id,
      saleName: sale.fullName,
    });

    const createRes = await authedPost(saleSession, '/orders')
      .send({
        orderType: 'NEW_ENROLLMENT',
        leadId: String(lead._id),
        parentName: 'Lead Parent Flow',
        parentPhone: leadPhone,
        parentEmail: `lead.parent.${suffix.toLowerCase()}@school.local`,
        studentName: 'Lead Student Flow',
        studentGrade: '7',
        items: [
          {
            productId: offlineProductId,
            productName: 'Offline Trial Package',
            sessions: 6,
            sessionDuration: 90,
            pricePerSession: 200000,
            amount: 1200000,
            teachingMode: 'OFFLINE',
          },
        ],
        totalAmount: 1200000,
        finalAmount: 1200000,
        paymentPlan: 'FULL',
        receiptImage: '/uploads/invoices/lead-flow-sale-proof.png',
      })
      .expect((res) => {
        expect([200, 201]).toContain(res.status);
      });

    const orderId = String(createRes.body._id);
    const leadAfterCreate = await leadModel.findById(lead._id).lean() as any;
    expect(leadAfterCreate.status).toBe('CONVERTED');
    expect(String(leadAfterCreate.convertedOrderId)).toBe(orderId);

    await authedPost(saleSession, `/orders/${orderId}/submit`)
      .send({})
      .expect((res) => {
        expect([200, 201]).toContain(res.status);
      });

    const approveRes = await authedPost(directorSession, `/orders/${orderId}/approve`)
      .send({
        approvalImage: '/uploads/invoices/lead-flow-approval.png',
      })
      .expect((res) => {
        expect([200, 201]).toContain(res.status);
      });

    expect(approveRes.body.enrollment.success).toBe(true);

    const storedOrder = await orderModel.findById(orderId).lean() as any;
    const leadAfterApprove = await leadModel.findById(lead._id).lean() as any;
    const attributedLead = await waitForValue<any>(
      () =>
        parentAttributionModel
          .findOne({ sourceLeadId: lead._id })
          .lean(),
      `lead attribution for ${String(lead._id)}`,
      (doc: any) => !!doc?.parentUserId,
    );

    expect(String(storedOrder.leadId)).toBe(String(lead._id));
    expect(String(storedOrder.adGroupId)).toBe(String(leadAdGroupId));
    expect(storedOrder.adGroupName).toBe('Lead Campaign Flow');
    expect(leadAfterApprove.status).toBe('CONVERTED');
    expect(String(leadAfterApprove.convertedOrderId)).toBe(orderId);
  expect(String(attributedLead.sourceOrderId)).toBe(orderId);
  expect(String(attributedLead.sourceLeadId)).toBe(String(lead._id));
  expect(String(attributedLead.parentUserId)).toBe(String(storedOrder.parentUserId));
  });

  it('auto-creates a new offline class after order approval and exposes it in class management lists', async () => {
    const trial = await createTrialEnrollment({
      parentPhone: '0905000101',
      parentEmail: 'offline.auto.class@school.local',
      studentPhone: '0905000102',
      notes: 'Create new offline class after approval',
    });
    const studentId = String(trial.studentId?._id || trial.studentId);

    const order = await createSubmittedOrderForStudent(studentId, {
      parentPhone: '0905000101',
      parentEmail: 'offline.auto.class@school.local',
      items: [
        {
          productId: offlineProductId,
          productName: 'Offline Trial Package',
          sessions: 10,
          sessionDuration: 90,
          baseDuration: 90,
          pricePerSession: 150000,
          amount: 1500000,
          teachingMode: 'OFFLINE',
          createNewClassWhenApproved: true,
          preferredTeacherId: String(teacherUser._id),
          subject: 'Math',
          learningGoals: 'Auto create offline class',
          maxStudents: 8,
        },
      ],
      totalAmount: 1500000,
      finalAmount: 1500000,
    });

    const approveOrderRes = await authedPost(opsSession, `/orders/${order.orderId}/approve`)
      .send({
        approvalImage: '/uploads/invoices/offline-auto-class-approval.png',
      })
      .expect((res) => {
        expect([200, 201]).toContain(res.status);
      });

    expect(['APPROVED', 'COMPLETED']).toContain(approveOrderRes.body.order.status);
    expect(approveOrderRes.body.enrollment.success).toBe(true);
    expect(approveOrderRes.body.enrollment.invoiceIds).toHaveLength(1);

    const invoiceId = String(approveOrderRes.body.enrollment.invoiceIds[0]);
    const approvedInvoice = await waitForValue<any>(
      () => invoiceModel.findById(invoiceId).lean(),
      `approved invoice ${invoiceId}`,
      (doc: any) => !!doc?.classId,
    );
    const createdClassId = String(approvedInvoice.classId);

    expect(createdClassId).not.toBe(offlineClassId);
    expect(approvedInvoice.status).toBe('APPROVED');
    expect(approvedInvoice.classType).toBe('OFFLINE');
    expect(approvedInvoice.createNewClassWhenApproved).toBe(true);
    expect(String(approvedInvoice.requestedTeacherId)).toBe(String(teacherUser._id));

    const createdClass = await classModel.findById(createdClassId).lean() as any;
    expect(createdClass).toBeTruthy();
    expect(createdClass.classMode).toBe('OFFLINE');
    expect(String(createdClass.teacher)).toBe(String(teacherUser._id));
    expect(String(createdClass.sale)).toBe(String(saleUser._id));
    expect(String(createdClass.invoiceId)).toBe(invoiceId);
    expect(String(createdClass.productPackage)).toBe(offlineProductId);
    expect(createdClass.code).toMatch(/^CLS-/);
    expect(
      createdClass.students.some((id: Types.ObjectId) => String(id) === studentId),
    ).toBe(true);

    const completedOrder = await orderModel.findById(order.orderId).lean() as any;
    expect(
      (completedOrder.processedResults?.classIds || []).map((value: any) => String(value)),
    ).toContain(createdClassId);

    const directorClassesRes = await authedGet(directorSession, '/classes').expect(200);
    const saleClassesRes = await authedGet(saleSession, '/classes').expect(200);
    const directorClassRow = (directorClassesRes.body || []).find(
      (row: any) => String(row._id) === createdClassId,
    );
    const saleClassRow = (saleClassesRes.body || []).find(
      (row: any) => String(row._id) === createdClassId,
    );
    expect(directorClassRow).toBeTruthy();
    expect(directorClassRow.classMode).toBe('OFFLINE');
    expect(directorClassRow.studentCount).toBe(1);
    expect(saleClassRow).toBeTruthy();
    expect(saleClassRow.classMode).toBe('OFFLINE');
  });

  it('auto-creates a new online class after order approval and exposes it in class management lists', async () => {
    const onlineProduct = await productModel.create({
      name: 'Online Auto Class Package',
      code: 'PRD-AUTO-ONLINE',
      teachingMode: 'ONLINE',
      defaultSessions: 10,
      defaultSessionDuration: 90,
      pricePerSession: 220000,
      suggestedPrice: 2200000,
      commissionRate: 5,
      isActive: true,
    });

    const trial = await createTrialEnrollment({
      parentPhone: '0905000111',
      parentEmail: 'online.auto.class@school.local',
      studentPhone: '0905000112',
      notes: 'Create new online class after approval',
    });
    const studentId = String(trial.studentId?._id || trial.studentId);

    const order = await createSubmittedOrderForStudent(studentId, {
      parentPhone: '0905000111',
      parentEmail: 'online.auto.class@school.local',
      items: [
        {
          productId: String(onlineProduct._id),
          productName: 'Online Auto Class Package',
          sessions: 10,
          sessionDuration: 90,
          baseDuration: 90,
          pricePerSession: 220000,
          amount: 2200000,
          teachingMode: 'ONLINE',
          createNewClassWhenApproved: true,
          preferredTeacherId: String(teacherUser._id),
          subject: 'English',
          learningGoals: 'Auto create online class',
          teacherPayPerSession: 120000,
          maxStudents: 1,
        },
      ],
      totalAmount: 2200000,
      finalAmount: 2200000,
    });

    const approveOrderRes = await authedPost(opsSession, `/orders/${order.orderId}/approve`)
      .send({
        approvalImage: '/uploads/invoices/online-auto-class-approval.png',
      })
      .expect((res) => {
        expect([200, 201]).toContain(res.status);
      });

    expect(['APPROVED', 'COMPLETED']).toContain(approveOrderRes.body.order.status);
    expect(approveOrderRes.body.enrollment.success).toBe(true);
    expect(approveOrderRes.body.enrollment.invoiceIds).toHaveLength(1);

    const invoiceId = String(approveOrderRes.body.enrollment.invoiceIds[0]);
    const approvedInvoice = await waitForValue<any>(
      () => invoiceModel.findById(invoiceId).lean(),
      `approved online invoice ${invoiceId}`,
      (doc: any) => !!doc?.classId,
    );
    const createdClassId = String(approvedInvoice.classId);

    expect(approvedInvoice.status).toBe('APPROVED');
    expect(approvedInvoice.classType).toBe('ONLINE');
    expect(approvedInvoice.createNewClassWhenApproved).toBe(true);
    expect(String(approvedInvoice.productId)).toBe(String(onlineProduct._id));

    const createdClass = await classModel.findById(createdClassId).lean() as any;
    expect(createdClass).toBeTruthy();
    expect(createdClass.classMode).toBe('ONLINE');
    expect(String(createdClass.teacher)).toBe(String(teacherUser._id));
    expect(String(createdClass.sale)).toBe(String(saleUser._id));
    expect(String(createdClass.invoiceId)).toBe(invoiceId);
    expect(String(createdClass.productPackage)).toBe(String(onlineProduct._id));
    expect(createdClass.code).toMatch(/^CLS-/);
    expect(
      createdClass.students.some((id: Types.ObjectId) => String(id) === studentId),
    ).toBe(true);

    const completedOrder = await orderModel.findById(order.orderId).lean() as any;
    expect(
      (completedOrder.processedResults?.classIds || []).map((value: any) => String(value)),
    ).toContain(createdClassId);

    const directorClassesRes = await authedGet(directorSession, '/classes').expect(200);
    const saleClassesRes = await authedGet(saleSession, '/classes').expect(200);
    const directorClassRow = (directorClassesRes.body || []).find(
      (row: any) => String(row._id) === createdClassId,
    );
    const saleClassRow = (saleClassesRes.body || []).find(
      (row: any) => String(row._id) === createdClassId,
    );
    expect(directorClassRow).toBeTruthy();
    expect(directorClassRow.classMode).toBe('ONLINE');
    expect(directorClassRow.studentCount).toBe(1);
    expect(saleClassRow).toBeTruthy();
    expect(saleClassRow.classMode).toBe('ONLINE');
  });

  it('auto-creates a new online class when older payloads only send preferredTeacherId', async () => {
    const compatibilityOnlineProduct = await productModel.create({
      name: 'Online Compatibility Auto Class Package',
      code: 'PRD-AUTO-ONLINE-COMPAT',
      teachingMode: 'ONLINE',
      defaultSessions: 10,
      defaultSessionDuration: 90,
      pricePerSession: 220000,
      suggestedPrice: 2200000,
      commissionRate: 5,
      isActive: true,
    });

    const trial = await createTrialEnrollment({
      parentPhone: '0905000121',
      parentEmail: 'online.compat.class@school.local',
      studentPhone: '0905000122',
      notes: 'Backward compatible online auto class creation',
    });
    const studentId = String(trial.studentId?._id || trial.studentId);

    const order = await createSubmittedOrderForStudent(studentId, {
      parentPhone: '0905000121',
      parentEmail: 'online.compat.class@school.local',
      items: [
        {
          productId: String(compatibilityOnlineProduct._id),
          productName: 'Online Compatibility Auto Class Package',
          sessions: 10,
          sessionDuration: 90,
          baseDuration: 90,
          pricePerSession: 220000,
          amount: 2200000,
          teachingMode: 'ONLINE',
          createNewClassWhenApproved: true,
          preferredTeacherId: String(teacherUser._id),
          subject: 'English',
          learningGoals: 'Compatibility fallback online class',
          teacherPayPerSession: 120000,
          maxStudents: 1,
        },
      ],
      totalAmount: 2200000,
      finalAmount: 2200000,
    });

    const approveOrderRes = await authedPost(opsSession, `/orders/${order.orderId}/approve`)
      .send({
        approvalImage: '/uploads/invoices/online-compat-auto-class-approval.png',
      })
      .expect((res) => {
        expect([200, 201]).toContain(res.status);
      });

    expect(approveOrderRes.body.enrollment.success).toBe(true);
    expect(approveOrderRes.body.enrollment.invoiceIds).toHaveLength(1);

    const invoiceId = String(approveOrderRes.body.enrollment.invoiceIds[0]);
    const approvedInvoice = await waitForValue<any>(
      () => invoiceModel.findById(invoiceId).lean(),
      `approved compatibility invoice ${invoiceId}`,
      (doc: any) => !!doc?.classId,
    );
    const createdClassId = String(approvedInvoice.classId);

    expect(['PENDING_APPROVAL', 'APPROVED']).toContain(approvedInvoice.status);
    expect(approvedInvoice.classType).toBe('ONLINE');
    expect(String(approvedInvoice.requestedTeacherId)).toBe(String(teacherUser._id));

    const createdClass = await classModel.findById(createdClassId).lean() as any;
    expect(createdClass).toBeTruthy();
    expect(createdClass.classMode).toBe('ONLINE');
    expect(String(createdClass.sale)).toBe(String(saleUser._id));
    expect(createdClass.students.some((id: Types.ObjectId) => String(id) === studentId)).toBe(true);
  });

  it.todo(
    'rolls back new parent and student when invoice creation fails mid-approval (requires a test-only fault injection hook)',
  );

  it('converts an approved trial into a real enrollment, wallet funding, and class roster', async () => {
    const trial = await createTrialEnrollment({
      parentPhone: '0905000031',
      parentEmail: 'convert.trial.flow@school.local',
      studentPhone: '0905000032',
      notes: 'Convert path',
    });
    const trialId = String(trial._id);
    const studentId = String(trial.studentId?._id || trial.studentId);

    const markRes = await markTrialAttendance(studentId);
    const sessionId = String(markRes.body.sessionId);

    const order = await createSubmittedOrderForStudent(studentId, {
      parentPhone: '0905000031',
      parentEmail: 'convert.trial.flow@school.local',
    });

    const approveOrderRes = await authedPost(opsSession, `/orders/${order.orderId}/approve`)
      .send({
        approvalImage: '/uploads/invoices/trial-convert-order-approval.png',
      })
      .expect((res) => {
        expect([200, 201]).toContain(res.status);
      });
    const invoiceId = String(approveOrderRes.body.enrollment.invoiceIds[0]);
    const approvedInvoice = await invoiceModel.findById(invoiceId).lean() as any;
    expect(approvedInvoice.status).toBe('APPROVED');
    expect(approvedInvoice.approvalImage).toBe('/uploads/invoices/trial-convert-order-approval.png');
    expect(approvedInvoice.walletTopUpDone).toBe(true);

    const convertRes = await authedPost(saleSession, `/trial-enrollments/${trialId}/convert`)
      .send({
        orderId: order.orderId,
        invoiceId,
        decisionNotes: 'Parent confirmed enrollment after trial.',
      })
      .expect((res) => {
        expect([200, 201]).toContain(res.status);
      });

    expect(convertRes.body.status).toBe('CONVERTED');
    expect(String(convertRes.body.invoiceId?._id || convertRes.body.invoiceId)).toBe(invoiceId);

    const updatedClass = await classModel.findById(offlineClassId).lean() as any;
    expect(
      updatedClass.students.some((id: Types.ObjectId) => String(id) === studentId),
    ).toBe(true);

    const convertedSession = await sessionModel.findById(sessionId).lean() as any;
    expect(convertedSession.sessionType).toBe('TRIAL');
    expect(convertedSession.trialConverted).toBe(true);
    expect(convertedSession.trialRejectedNoPay).toBe(false);

    const convertedInvoice = await invoiceModel.findById(invoiceId).lean() as any;
    expect(String(convertedInvoice.classId)).toBe(offlineClassId);

    const convertedOrder = await orderModel.findById(order.orderId).lean() as any;
    expect(['APPROVED', 'COMPLETED']).toContain(convertedOrder.status);
    expect(
      (convertedOrder.processedResults?.classIds || []).map((value: any) => String(value)),
    ).toContain(offlineClassId);

    const wallet = await walletModel.findOne({
      userId: new Types.ObjectId(convertRes.body.studentId.parentUserId || convertRes.body.studentId?._id),
    }).lean() as any;
    const student = await studentModel.findById(studentId).lean() as any;
    const fundedWallet = await walletModel.findOne({
      userId: student.parentUserId,
    }).lean() as any;

    expect(student.approvalStatus).toBe('APPROVED');
    expect(fundedWallet).toBeTruthy();
    expect(fundedWallet.balance).toBe(1800000);
    expect(wallet || fundedWallet).toBeTruthy();

    const parentSession = await loginAndGetSession('convert.trial.flow@school.local', '123456');
    const parentInvoices = await authedGet(parentSession, '/invoices/my-children').expect(200);
    expect(Array.isArray(parentInvoices.body.children)).toBe(true);
    expect(
      parentInvoices.body.children.some((child: any) =>
        Array.isArray(child.invoices)
        && child.invoices.some((invoice: any) => String(invoice._id) === invoiceId),
      ),
    ).toBe(true);

    const saleBoard = await authedGet(saleSession, '/dashboard/daily-tasks').expect(200);
    const saleTrials = findTab(saleBoard.body, 'trials');
    const saleFinance = findTab(saleBoard.body, 'finance');
    expect(saleTrials?.count).toBe(0);
    expect(saleFinance?.count).toBe(0);
  });

  it('deducts wallet and keeps trial payroll when a finalized trial is converted after payment', async () => {
    const trial = await createTrialEnrollment({
      parentPhone: '0905000051',
      parentEmail: 'paid.convert.trial.flow@school.local',
      studentPhone: '0905000052',
      notes: 'Finalize before convert path',
    });
    const trialId = String(trial._id);
    const studentId = String(trial.studentId?._id || trial.studentId);

    const markRes = await markTrialAttendance(studentId);
    const sessionId = String(markRes.body.sessionId);

    await authedPatch(teacherSession, `/sessions/${sessionId}/teaching-report`)
      .send({
        lessonContent: 'Trial lesson completed before parent payment decision.',
        teacherComment: 'Teacher completed the trial and submitted report on time.',
      })
      .expect(200);

    await authedPost(opsSession, `/sessions/${sessionId}/finalize`)
      .send({})
      .expect((res) => {
        expect([200, 201]).toContain(res.status);
      });

    const finalizedBeforeConvert = await sessionModel.findById(sessionId).lean() as any;
    expect(finalizedBeforeConvert.status).toBe('FINALIZED');
    expect(finalizedBeforeConvert.isPaid).toBe(false);
    expect(finalizedBeforeConvert.parentUserId).toBeFalsy();

    const payrollBeforeConvert = await payrollTxModel.findOne({
      sessionId: new Types.ObjectId(sessionId),
    }).lean() as any;
    expect(payrollBeforeConvert).toBeTruthy();
    expect(payrollBeforeConvert.status).toBe('PENDING');

    const order = await createSubmittedOrderForStudent(studentId, {
      parentPhone: '0905000051',
      parentEmail: 'paid.convert.trial.flow@school.local',
      items: [
        {
          productId: offlineProductId,
          productName: 'Offline Trial Package',
          sessions: 12,
          trialSessions: 1,
          sessionDuration: 90,
          pricePerSession: 150000,
          amount: 1800000,
          teachingMode: 'OFFLINE',
        },
      ],
    });

    const approveOrderRes = await authedPost(opsSession, `/orders/${order.orderId}/approve`)
      .send({
        approvalImage: '/uploads/invoices/trial-paid-convert-order-approval.png',
      })
      .expect((res) => {
        expect([200, 201]).toContain(res.status);
      });
    const invoiceId = String(approveOrderRes.body.enrollment.invoiceIds[0]);

    await authedPost(saleSession, `/trial-enrollments/${trialId}/convert`)
      .send({
        orderId: order.orderId,
        invoiceId,
        decisionNotes: 'Parent paid after trial and student converted to official enrollment.',
      })
      .expect((res) => {
        expect([200, 201]).toContain(res.status);
      });

    const student = await studentModel.findById(studentId).lean() as any;
    const convertedSession = await sessionModel.findById(sessionId).lean() as any;
    const fundedWallet = await walletModel.findOne({
      userId: student.parentUserId,
    }).lean() as any;
    const payrollAfterConvert = await payrollTxModel.findOne({
      sessionId: new Types.ObjectId(sessionId),
    }).lean() as any;
    const convertedInvoice = await invoiceModel.findById(invoiceId).lean() as any;

    expect(student.parentUserId).toBeTruthy();
    expect(convertedSession.trialConverted).toBe(true);
    expect(convertedSession.trialRejectedNoPay).toBe(false);
    expect(String(convertedSession.parentUserId)).toBe(String(student.parentUserId));
    expect(convertedSession.isPaid).toBe(true);
    expect(fundedWallet).toBeTruthy();
    expect(fundedWallet.balance).toBe(1800000 - convertedSession.amountCharged);
    expect(payrollAfterConvert).toBeTruthy();
    expect(payrollAfterConvert.status).toBe('PENDING');
    expect(convertedInvoice.trialSessionsRemaining).toBe(0);
  });

  it('settles two finalized offline trial sessions after approving a paid order with two trial sessions', async () => {
    const trial = await createTrialEnrollment({
      parentPhone: '0905000071',
      parentEmail: 'two-trial.convert@school.local',
      studentPhone: '0905000072',
      notes: 'Two finalized trial sessions before convert',
    });
    const trialId = String(trial._id);
    const studentId = String(trial.studentId?._id || trial.studentId);

    const firstAttendanceRes = await markTrialAttendance(studentId, trialDay);
    const firstSessionId = String(firstAttendanceRes.body.sessionId);
    await submitTeachingReportAndFinalize(
      firstSessionId,
      'First trial lesson completed before enrollment decision.',
    );

    const secondAttendanceRes = await markTrialAttendance(studentId, nextDay);
    const secondSessionId = String(secondAttendanceRes.body.sessionId);
    await submitTeachingReportAndFinalize(
      secondSessionId,
      'Second trial lesson completed before enrollment decision.',
    );

    await authedPost(teacherSession, '/attendance/mark')
      .send({
        classId: offlineClassId,
        studentId,
        date: thirdDay,
        status: 'PRESENT',
        notes: 'A third trial should be blocked because maxTrialSessions is 2.',
      })
      .expect(403);

    const updatedTrialBeforeConvert = await trialEnrollmentModel
      .findById(trialId)
      .lean() as any;
    expect(updatedTrialBeforeConvert.trialSessionsUsed).toBe(2);
    expect(updatedTrialBeforeConvert.status).toBe('WAITING_DECISION');

    const order = await createSubmittedOrderForStudent(studentId, {
      parentPhone: '0905000071',
      parentEmail: 'two-trial.convert@school.local',
      items: [
        {
          productId: offlineProductId,
          productName: 'Offline Trial Package',
          sessions: 12,
          trialSessions: 2,
          sessionDuration: 90,
          pricePerSession: 150000,
          amount: 1800000,
          teachingMode: 'OFFLINE',
          notes: 'Paid enrollment after two trial lessons',
        },
      ],
    });

    const approveOrderRes = await authedPost(opsSession, `/orders/${order.orderId}/approve`)
      .send({
        approvalImage: '/uploads/invoices/two-trial-convert-order-approval.png',
      })
      .expect((res) => {
        expect([200, 201]).toContain(res.status);
      });
    const invoiceId = String(approveOrderRes.body.enrollment.invoiceIds[0]);

    const approvedInvoiceBeforeConvert = await invoiceModel.findById(invoiceId).lean() as any;
    expect(approvedInvoiceBeforeConvert.status).toBe('APPROVED');
    expect(approvedInvoiceBeforeConvert.walletTopUpDone).toBe(true);
    expect(approvedInvoiceBeforeConvert.trialSessions).toBe(2);
    expect(approvedInvoiceBeforeConvert.trialSessionsRemaining).toBe(2);

    await authedPost(saleSession, `/trial-enrollments/${trialId}/convert`)
      .send({
        orderId: order.orderId,
        invoiceId,
        decisionNotes: 'Parent paid after two completed trial lessons.',
      })
      .expect((res) => {
        expect([200, 201]).toContain(res.status);
      });

    const student = await studentModel.findById(studentId).lean() as any;
    const fundedWallet = await walletModel.findOne({
      userId: student.parentUserId,
    }).lean() as any;
    const convertedInvoice = await invoiceModel.findById(invoiceId).lean() as any;
    const convertedSessions = await sessionModel
      .find({
        _id: {
          $in: [
            new Types.ObjectId(firstSessionId),
            new Types.ObjectId(secondSessionId),
          ],
        },
      })
      .sort({ scheduledDate: 1 })
      .lean() as any[];
    const payrollRows = await payrollTxModel
      .find({
        sessionId: {
          $in: [
            new Types.ObjectId(firstSessionId),
            new Types.ObjectId(secondSessionId),
          ],
        },
      })
      .sort({ createdAt: 1 })
      .lean() as any[];

    expect(convertedSessions).toHaveLength(2);
    expect(convertedSessions.every((session) => session.trialConverted === true)).toBe(true);
    expect(convertedSessions.every((session) => session.isPaid === true)).toBe(true);

    const totalCharged = convertedSessions.reduce(
      (sum, session) => sum + Number(session.amountCharged || 0),
      0,
    );
    expect(totalCharged).toBeGreaterThan(0);

    expect(fundedWallet).toBeTruthy();
    expect(fundedWallet.balance).toBe(1800000 - totalCharged);

    expect(convertedInvoice.trialSessionsRemaining).toBe(0);
    expect(payrollRows).toHaveLength(2);
    expect(payrollRows.every((row) => row.status === 'PENDING')).toBe(true);
  });
});
