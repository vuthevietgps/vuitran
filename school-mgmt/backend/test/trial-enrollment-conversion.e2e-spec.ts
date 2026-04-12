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
import { TrialEnrollmentStatus } from '../src/trial-enrollments/schemas/trial-enrollment.schema';

type SessionCookies = {
  accessToken: string;
  xsrfToken: string;
  cookieHeader: string;
};

type SeedUser = {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
  role: 'DIRECTOR' | 'OPS' | 'ACCOUNTING' | 'SALE' | 'TEACHER' | 'PARENT';
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

function todayYmd(): string {
  return new Date().toISOString().slice(0, 10);
}

describe('Trial enrollment conversion (e2e)', () => {
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

  const director: SeedUser = {
    email: 'director.trial-conversion.e2e@school.local',
    password: 'E2ePass123!',
    fullName: 'Director Trial Conversion',
    role: 'DIRECTOR',
  };

  const ops: SeedUser = {
    email: 'ops.trial-conversion.e2e@school.local',
    password: 'E2ePass123!',
    fullName: 'Ops Trial Conversion',
    role: 'OPS',
  };

  const accounting: SeedUser = {
    email: 'accounting.trial-conversion.e2e@school.local',
    password: 'E2ePass123!',
    fullName: 'Accounting Trial Conversion',
    role: 'ACCOUNTING',
  };

  const sale: SeedUser = {
    email: 'sale.trial-conversion.e2e@school.local',
    password: 'E2ePass123!',
    fullName: 'Sale Trial Conversion',
    role: 'SALE',
  };

  const teacher: SeedUser = {
    email: 'teacher.trial-conversion.e2e@school.local',
    password: 'E2ePass123!',
    fullName: 'Teacher Trial Conversion',
    role: 'TEACHER',
  };

  const parent: SeedUser = {
    email: 'parent.trial-conversion.e2e@school.local',
    password: 'E2ePass123!',
    fullName: 'Parent Trial Conversion',
    phone: '0905000001',
    role: 'PARENT',
  };

  let directorSession: SessionCookies;
  let opsSession: SessionCookies;
  let accountingSession: SessionCookies;
  let saleSession: SessionCookies;
  let teacherSession: SessionCookies;
  let parentSession: SessionCookies;

  let directorUser: any;
  let opsUser: any;
  let accountingUser: any;
  let saleUser: any;
  let teacherUser: any;
  let parentUser: any;

  let offlineProductId: string;
  let offlineClassId: string;

  async function upsertUser(user: SeedUser): Promise<any> {
    const hashedPassword = await bcrypt.hash(user.password, 10);
    await userModel.updateOne(
      { email: user.email },
      {
        $set: {
          email: user.email,
          password: hashedPassword,
          fullName: user.fullName,
          phone: user.phone,
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

  async function resetBusinessCollections() {
    await Promise.all([
      trialEnrollmentModel.deleteMany({}),
      studentModel.deleteMany({}),
      attendanceModel.deleteMany({}),
      sessionModel.deleteMany({}),
      orderModel.deleteMany({}),
      invoiceModel.deleteMany({}),
      walletModel.deleteMany({}),
      ledgerEntryModel.deleteMany({}),
      classModel.deleteMany({}),
      productModel.deleteMany({}),
      userModel.deleteMany({ role: 'PARENT' }),
    ]);
  }

  async function seedOfflineBase() {
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

    await walletModel.updateOne(
      { userId: parentUser._id },
      {
        $set: {
          userId: parentUser._id,
          balance: 5_000_000,
          status: 'ACTIVE',
        },
      },
      { upsert: true },
    );
  }

  async function createTrialEnrollment(overrides: Record<string, unknown> = {}) {
    const response = await authedPost(saleSession, '/trial-enrollments')
      .send({
        classId: offlineClassId,
        productId: offlineProductId,
        parentName: parent.fullName,
        parentPhone: parent.phone,
        parentEmail: parent.email,
        studentName: 'Student Trial',
        studentPhone: '0905000002',
        studentGrade: '6',
        maxTrialSessions: 2,
        notes: 'Trial conversion path',
        ...overrides,
      })
      .expect((res) => {
        expect([200, 201]).toContain(res.status);
      });

    const studentId = String(response.body.studentId?._id || response.body.studentId);
    await classModel.updateOne(
      { _id: new Types.ObjectId(offlineClassId) },
      { $addToSet: { students: new Types.ObjectId(studentId) } },
    );

    return response.body;
  }

  async function markTrialAttendance(studentId: string, date = todayYmd()) {
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

    return response.body;
  }

  async function recordTrialSession(trialId: string) {
    return authedPost(saleSession, `/trial-enrollments/${trialId}/trial-sessions`)
      .send({
        count: 1,
        notes: 'Recorded one trial session after attendance',
      })
      .expect((res) => {
        expect([200, 201]).toContain(res.status);
      });
  }

  async function createApprovedOrderForStudent(studentId: string) {
    const createRes = await authedPost(saleSession, '/orders')
      .send({
        orderType: 'NEW_ENROLLMENT',
        parentName: parent.fullName,
        parentPhone: parent.phone,
        parentEmail: parent.email,
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
        receiptImage: '/uploads/invoices/trial-conversion-sale-proof.png',
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

    const approveRes = await authedPost(opsSession, `/orders/${orderId}/approve`)
      .send({
        approvalImage: '/uploads/invoices/trial-conversion-approval.png',
      })
      .expect((res) => {
        expect([200, 201]).toContain(res.status);
      });

    expect(Array.isArray(approveRes.body.enrollment.invoiceIds)).toBe(true);
    expect(approveRes.body.enrollment.invoiceIds).toHaveLength(1);

    const invoiceId = String(approveRes.body.enrollment.invoiceIds[0]);
    return { orderId, invoiceId };
  }

  beforeAll(async () => {
    process.env.REDIS_ENABLED = 'false';
    replSet = await MongoMemoryReplSet.create({
      replSet: { count: 1, storageEngine: 'wiredTiger' },
    });
    process.env.MONGODB_URI = replSet.getUri('school-mgmt-trial-conversion-e2e');

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

    directorUser = await upsertUser(director);
    opsUser = await upsertUser(ops);
    accountingUser = await upsertUser(accounting);
    saleUser = await upsertUser(sale);
    teacherUser = await upsertUser(teacher);
    parentUser = await upsertUser(parent);

    directorSession = await loginAndGetSession(director.email, director.password);
    opsSession = await loginAndGetSession(ops.email, ops.password);
    accountingSession = await loginAndGetSession(accounting.email, accounting.password);
    saleSession = await loginAndGetSession(sale.email, sale.password);
    teacherSession = await loginAndGetSession(teacher.email, teacher.password);
    parentSession = await loginAndGetSession(parent.email, parent.password);
  });

  beforeEach(async () => {
    await resetBusinessCollections();
    await seedOfflineBase();
  });

  afterAll(async () => {
    await closeE2eResources({
      app,
      moduleRef,
      mongoReplSet: replSet,
    });
  });

  it('creates a pending trial, records attendance, and leaves the parent wallet unchanged', async () => {
    const trial = await createTrialEnrollment();
    const trialId = String(trial._id);
    const studentId = String(trial.studentId?._id || trial.studentId);

    expect(trial.status).toBe(TrialEnrollmentStatus.PENDING_TRIAL);
    expect(String(trial.studentId?._id || trial.studentId)).toBeTruthy();

    const walletBefore = await walletModel.findOne({
      userId: new Types.ObjectId(parentUser._id),
    }).lean() as any;
    expect(walletBefore).toBeTruthy();
    expect(walletBefore.balance).toBe(5_000_000);

    const attendanceRes = await markTrialAttendance(studentId);
    const sessionId = String(attendanceRes.sessionId);

    expect(attendanceRes.sessionCreated).toBe(true);
    expect(attendanceRes.status).toBe('PRESENT');
    expect(attendanceRes.sessionId).toBeTruthy();
    expect(String(attendanceRes.studentId?._id || attendanceRes.studentId)).toBe(studentId);

    const session = await sessionModel.findById(sessionId).lean() as any;
    expect(session).toBeTruthy();
    expect(session.sessionType).toBe('REGULAR');
    expect(String(session.classId)).toBe(offlineClassId);
    expect(String(session.studentId)).toBe(studentId);

    await recordTrialSession(trialId);

    const updatedTrial = await trialEnrollmentModel.findById(trialId).lean() as any;
    expect(updatedTrial.status).toBe(TrialEnrollmentStatus.PENDING_TRIAL);
    expect(updatedTrial.trialSessionsUsed).toBe(1);

    const walletAfter = await walletModel.findOne({
      userId: new Types.ObjectId(parentUser._id),
    }).lean() as any;
    expect(walletAfter.balance).toBe(walletBefore.balance);
    expect(await ledgerEntryModel.countDocuments({ userId: parentUser._id })).toBe(0);
  });

  it('converts an approved trial into an official enrollment after order approval', async () => {
    const trial = await createTrialEnrollment({
      parentPhone: parent.phone,
      parentEmail: parent.email,
      studentPhone: '0905000032',
      notes: 'Convert path',
    });
    const trialId = String(trial._id);
    const studentId = String(trial.studentId?._id || trial.studentId);

    await markTrialAttendance(studentId);
    await recordTrialSession(trialId);

    const { orderId, invoiceId } = await createApprovedOrderForStudent(studentId);

    const convertRes = await authedPost(saleSession, `/trial-enrollments/${trialId}/convert`)
      .send({
        orderId,
        invoiceId,
        decisionNotes: 'Parent confirmed enrollment after trial.',
      })
      .expect((res) => {
        expect([200, 201]).toContain(res.status);
      });

    expect(convertRes.body.status).toBe(TrialEnrollmentStatus.CONVERTED);
    expect(String(convertRes.body.invoiceId?._id || convertRes.body.invoiceId)).toBe(invoiceId);

    const updatedTrial = await trialEnrollmentModel.findById(trialId).lean() as any;
    expect(updatedTrial.status).toBe(TrialEnrollmentStatus.CONVERTED);
    expect(String(updatedTrial.orderId)).toBe(orderId);
    expect(String(updatedTrial.invoiceId)).toBe(invoiceId);

    const updatedStudent = await studentModel.findById(studentId).lean() as any;
    expect(updatedStudent.approvalStatus).toBe('APPROVED');
    expect(updatedStudent.parentUserId).toBeTruthy();
    const linkedWallet = await walletModel.findOne({
      userId: new Types.ObjectId(updatedStudent.parentUserId),
    }).lean() as any;
    expect(linkedWallet).toBeTruthy();
    expect(linkedWallet.balance).toBeGreaterThan(0);

    const updatedClass = await classModel.findById(offlineClassId).lean() as any;
    expect(
      updatedClass.students.some((id: Types.ObjectId) => String(id) === studentId),
    ).toBe(true);

    const convertedOrder = await orderModel.findById(orderId).lean() as any;
    expect(convertedOrder.status).toBe('COMPLETED');
    expect(
      (convertedOrder.processedResults?.classIds || []).map((value: any) => String(value)),
    ).toContain(offlineClassId);

    const convertedInvoice = await invoiceModel.findById(invoiceId).lean() as any;
    expect(String(convertedInvoice.classId)).toBe(offlineClassId);
    expect(convertedInvoice.walletTopUpDone).toBe(true);

    const parentWallet = await walletModel.findOne({
      userId: new Types.ObjectId(parentUser._id),
    }).lean() as any;
    expect(parentWallet.balance).toBeGreaterThan(0);
  });
});
