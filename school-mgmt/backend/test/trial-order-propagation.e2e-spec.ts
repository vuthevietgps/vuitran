import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import * as request from 'supertest';
import * as cookieParser from 'cookie-parser';
import * as bcrypt from 'bcrypt';
import { AppModule } from '../src/app.module';

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

    return response.body;
  }

  async function markTrialAttendance(studentId: string, date = trialDay) {
    return authedPost(teacherSession, '/attendance/mark')
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
  }

  async function createSubmittedOrderForStudent(studentId: string, overrides: Record<string, unknown> = {}) {
    const createRes = await authedPost(saleSession, '/orders')
      .send({
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
        ...overrides,
      })
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
    await app.close();
    await replSet.stop();
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
    expect(rosterEntry.student.isTrial).toBe(true);
    expect(String(rosterEntry.student.trialEnrollmentId)).toBe(trialId);

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

    await authedPost(teacherSession, '/attendance/mark')
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
      .send({})
      .expect((res) => {
        expect([200, 201]).toContain(res.status);
      });

    expect(approveRes.body.order.status).toBe('COMPLETED');
    expect(Array.isArray(approveRes.body.enrollment.invoiceIds)).toBe(true);
    expect(approveRes.body.enrollment.invoiceIds).toHaveLength(1);

    const invoiceId = String(approveRes.body.enrollment.invoiceIds[0]);
    const storedInvoice = await invoiceModel.findById(invoiceId).lean() as any;
    expect(storedInvoice).toBeTruthy();
    expect(storedInvoice.status).toBe('PENDING_APPROVAL');
    expect(String(storedInvoice.saleId)).toBe(String(saleUser._id));
    expect(String(storedInvoice.createdBy)).toBe(String(opsUser._id));

    const storedStudent = await studentModel.findById(studentId).lean() as any;
    expect(storedStudent.parentUserId).toBeTruthy();
    const autoParent = await userModel.findById(storedStudent.parentUserId).lean() as any;
    expect(autoParent).toBeTruthy();
    expect(autoParent.role).toBe('PARENT');
    expect(autoParent.phone).toBe('0905000021');

    await authedPost(saleSession, `/trial-enrollments/${trial._id}/convert`)
      .send({
        orderId: order.orderId,
        invoiceId,
      })
      .expect(400);

    const saleBoardAfterApproval = await authedGet(saleSession, '/dashboard/daily-tasks').expect(200);
    const saleOrdersAfterApproval = findTab(saleBoardAfterApproval.body, 'orders');
    const saleFinanceAfterApproval = findTab(saleBoardAfterApproval.body, 'finance');
    expect(saleOrdersAfterApproval?.count).toBe(0);
    expect(saleFinanceAfterApproval?.count).toBe(1);
    expect(
      saleFinanceAfterApproval?.tasks?.some((task: any) => String(task.route) === '/app/invoices'),
    ).toBe(true);
  });

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
      .send({})
      .expect((res) => {
        expect([200, 201]).toContain(res.status);
      });
    const invoiceId = String(approveOrderRes.body.enrollment.invoiceIds[0]);

    await authedPatch(saleSession, `/invoices/${invoiceId}`)
      .send({
        receiptImage: '/uploads/invoices/trial-receipt.png',
      })
      .expect(200);

    const approvedInvoiceRes = await authedPost(accountingSession, `/invoices/${invoiceId}/approve`)
      .send({
        action: 'APPROVE',
        approvalImage: '/uploads/invoices/trial-counterpart.png',
      })
      .expect((res) => {
        expect([200, 201]).toContain(res.status);
      });
    expect(approvedInvoiceRes.body.status).toBe('APPROVED');
    expect(approvedInvoiceRes.body.walletTopUpDone).toBe(true);

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

    const saleBoard = await authedGet(saleSession, '/dashboard/daily-tasks').expect(200);
    const saleTrials = findTab(saleBoard.body, 'trials');
    const saleFinance = findTab(saleBoard.body, 'finance');
    expect(saleTrials?.count).toBe(0);
    expect(saleFinance?.count).toBe(0);
  });
});
