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
  if (rows.length === 0) return null;
  const pattern = new RegExp(`(?:^|;\\s*)${name}=([^;]+)`);
  for (const row of rows) {
    const firstPart = String(row).split(';')[0];
    const match = pattern.exec(firstPart);
    if (match?.[1]) return match[1];
  }
  return null;
}

describe('Sale ownership integrity (e2e)', () => {
  let app: INestApplication;
  let moduleRef: TestingModule;
  let mongod: MongoMemoryReplSet;
  let userModel: Model<any>;
  let studentModel: Model<any>;
  let leadModel: Model<any>;
  let orderModel: Model<any>;
  let invoiceModel: Model<any>;
  let conversationModel: Model<any>;
  let walletModel: Model<any>;
  let classModel: Model<any>;
  let attendanceModel: Model<any>;
  let sessionModel: Model<any>;
  let teacherProfileModel: Model<any>;

  const director: SeedUser = {
    email: 'director-owner.e2e@school.local',
    password: 'E2ePass123!',
    fullName: 'Director Owner E2E',
    role: 'DIRECTOR',
  };

  const ops: SeedUser = {
    email: 'ops-owner.e2e@school.local',
    password: 'E2ePass123!',
    fullName: 'Ops Owner E2E',
    role: 'OPS',
  };

  const accounting: SeedUser = {
    email: 'accounting-owner.e2e@school.local',
    password: 'E2ePass123!',
    fullName: 'Accounting Owner E2E',
    role: 'ACCOUNTING',
  };

  const saleA: SeedUser = {
    email: 'sale-a-owner.e2e@school.local',
    password: 'E2ePass123!',
    fullName: 'Sale Alpha E2E',
    role: 'SALE',
  };

  const saleB: SeedUser = {
    email: 'sale-b-owner.e2e@school.local',
    password: 'E2ePass123!',
    fullName: 'Sale Beta E2E',
    role: 'SALE',
  };

  const teacherA: SeedUser = {
    email: 'teacher-a-owner.e2e@school.local',
    password: 'E2ePass123!',
    fullName: 'Teacher Alpha E2E',
    role: 'TEACHER',
  };

  const teacherB: SeedUser = {
    email: 'teacher-b-owner.e2e@school.local',
    password: 'E2ePass123!',
    fullName: 'Teacher Beta E2E',
    role: 'TEACHER',
  };

  let directorUser: any;
  let opsUser: any;
  let accountingUser: any;
  let saleAUser: any;
  let saleBUser: any;
  let teacherAUser: any;
  let teacherBUser: any;

  let directorSession: SessionCookies;
  let opsSession: SessionCookies;
  let accountingSession: SessionCookies;
  let saleASession: SessionCookies;
  let saleBSession: SessionCookies;
  let teacherASession: SessionCookies;
  let teacherBSession: SessionCookies;

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

  function authedPost(session: SessionCookies, path: string) {
    return request(app.getHttpServer())
      .post(path)
      .set('Cookie', session.cookieHeader)
      .set('X-XSRF-TOKEN', session.xsrfToken);
  }

  function authedGet(session: SessionCookies, path: string) {
    return request(app.getHttpServer())
      .get(path)
      .set('Cookie', session.cookieHeader)
      .set('X-XSRF-TOKEN', session.xsrfToken);
  }

  function authedPatch(session: SessionCookies, path: string) {
    return request(app.getHttpServer())
      .patch(path)
      .set('Cookie', session.cookieHeader)
      .set('X-XSRF-TOKEN', session.xsrfToken);
  }

  function authedDelete(session: SessionCookies, path: string) {
    return request(app.getHttpServer())
      .delete(path)
      .set('Cookie', session.cookieHeader)
      .set('X-XSRF-TOKEN', session.xsrfToken);
  }

  async function resetBusinessCollections() {
    await Promise.all([
      studentModel.deleteMany({}),
      leadModel.deleteMany({}),
      orderModel.deleteMany({}),
      invoiceModel.deleteMany({}),
      classModel.deleteMany({}),
      attendanceModel.deleteMany({}),
      sessionModel.deleteMany({}),
      conversationModel.deleteMany({}),
      walletModel.deleteMany({}),
      userModel.deleteMany({ role: 'PARENT' }),
    ]);
  }

  function buildOrderPayload(overrides: Record<string, unknown> = {}) {
    return {
      orderType: 'NEW_ENROLLMENT',
      parentName: 'Parent Order',
      parentPhone: '0901000100',
      studentName: 'Student Order',
      items: [
        {
          productId: new Types.ObjectId().toString(),
          productName: 'Combo Toan',
          sessions: 12,
          sessionDuration: 90,
          pricePerSession: 100000,
          amount: 1200000,
        },
      ],
      totalAmount: 1200000,
      finalAmount: 1200000,
      ...overrides,
    };
  }

  function buildConversationOrderPayload(overrides: Record<string, unknown> = {}) {
    return {
      parentName: 'Parent Conv',
      parentPhone: '0902000200',
      studentName: 'Student Conv',
      items: [
        {
          productId: new Types.ObjectId().toString(),
          productName: 'Combo Van',
          quantity: 5,
          unitPrice: 200000,
        },
      ],
      ...overrides,
    };
  }

  async function createStudent(params: {
    studentCode: string;
    fullName: string;
    parentName: string;
    parentPhone: string;
    saleUser?: any;
  }) {
    return studentModel.create({
      studentCode: params.studentCode,
      fullName: params.fullName,
      age: 10,
      parentName: params.parentName,
      parentPhone: params.parentPhone,
      faceImage: 'default-avatar.png',
      saleId: params.saleUser?._id,
      saleName: params.saleUser?.fullName,
    });
  }

  async function ensureParentForStudent(params: {
    student: any;
    saleUser?: any;
    email?: string;
    password?: string;
    fullName?: string;
    phone?: string;
  }) {
    const student = await studentModel.findById(params.student._id).lean() as any;
    const password = params.password || 'ParentPass123!';
    const phone = params.phone || student.parentPhone;
    const fullName = params.fullName || student.parentName || `Parent ${student.fullName}`;
    const email =
      params.email || `parent-${String(student._id).toLowerCase()}@school.local`;
    const userCodeSuffix = String(student.studentCode || student._id)
      .replace(/[^A-Za-z0-9-]/g, '')
      .slice(0, 30);

    const parentCreateRes = await authedPost(directorSession, '/users')
      .send({
        userCode: `PH-LINK-${userCodeSuffix}`,
        email,
        password,
        fullName,
        role: 'PARENT',
        phone,
        saleOwnerId: params.saleUser?._id ? String(params.saleUser._id) : undefined,
      })
      .expect(201);

    await studentModel.findByIdAndUpdate(student._id, {
      $set: {
        parentUserId: new Types.ObjectId(parentCreateRes.body._id),
        parentName: parentCreateRes.body.fullName,
        parentPhone: parentCreateRes.body.phone,
      },
    });

    return {
      parent: parentCreateRes.body,
      password,
    };
  }

  async function markAndFinalizeAttendance(params: {
    classId: string;
    studentId: string;
    markerSession: SessionCookies;
    reporterSession?: SessionCookies;
    date: string;
    notes?: string;
    lessonContent?: string;
  }) {
    const markRes = await authedPost(params.markerSession, '/attendance/mark')
      .send({
        classId: params.classId,
        studentId: params.studentId,
        date: params.date,
        status: 'PRESENT',
        notes: params.notes || 'Attendance propagation test',
      })
      .expect((res) => {
        expect([200, 201]).toContain(res.status);
      });

    const sessionId = String(markRes.body.sessionId);
    expect(sessionId).toBeTruthy();

    await authedPatch(params.reporterSession || params.markerSession, `/sessions/${sessionId}/teaching-report`)
      .send({
        lessonContent:
          params.lessonContent || 'Teaching report submitted for invoice propagation test.',
        teacherComment: 'Teacher report submitted on time.',
      })
      .expect(200);

    await authedPost(opsSession, `/sessions/${sessionId}/finalize`)
      .send({})
      .expect((res) => {
        expect([200, 201]).toContain(res.status);
      });

    return sessionId;
  }

  async function ensureAttendanceEligibility(params: {
    student: any;
    classroom: any;
    saleUser?: any;
    sessions?: number;
    amount?: number;
    paymentDate?: string;
    invoiceNumber?: string;
    walletBalance?: number;
    referenceDuration?: number;
  }) {
    const student = await studentModel.findById(params.student._id).lean() as any;
    const classroom = params.classroom;
    const saleUser = params.saleUser;
    const paymentDate = params.paymentDate || '2026-03-20T09:00:00.000Z';
    const userCodeSuffix = String(student.studentCode || student._id).replace(/[^A-Za-z0-9-]/g, '').slice(0, 30);

    const parentCreateRes = await authedPost(directorSession, '/users')
      .send({
        userCode: `PH-${userCodeSuffix}`,
        email: `parent-${String(student._id).toLowerCase()}@school.local`,
        password: 'ParentPass123!',
        fullName: student.parentName || `Parent ${student.fullName}`,
        role: 'PARENT',
        phone: student.parentPhone,
        saleOwnerId: saleUser?._id ? String(saleUser._id) : undefined,
      })
      .expect(201);

    await studentModel.findByIdAndUpdate(student._id, {
      $set: {
        parentUserId: new Types.ObjectId(parentCreateRes.body._id),
        parentName: parentCreateRes.body.fullName,
        parentPhone: parentCreateRes.body.phone,
      },
    });

    await walletModel.updateOne(
      { userId: new Types.ObjectId(parentCreateRes.body._id) },
      {
        $set: {
          userId: new Types.ObjectId(parentCreateRes.body._id),
          balance: params.walletBalance ?? 5_000_000,
          status: 'ACTIVE',
          debtLimit: 0,
          trialDebtSessions: 2,
          lastTransactionAt: new Date(paymentDate),
        },
      },
      { upsert: true },
    );

    const sessions = params.sessions ?? 6;
    const referenceDuration =
      params.referenceDuration
      ?? classroom.baseDuration
      ?? classroom.sessionDuration
      ?? 60;
    const pricePerSession = classroom.pricePerSession || 0;
    const amount = params.amount ?? pricePerSession * sessions;

    const invoice = await invoiceModel.create({
      invoiceNumber: params.invoiceNumber || `INV-${student.studentCode}`,
      studentId: student._id,
      classId: classroom._id,
      saleId: saleUser?._id,
      invoiceType: 'TUITION',
      classType: classroom.classMode || 'ONLINE',
      sessions,
      bonusSessions: 0,
      trialSessions: 0,
      sessionsRemaining: sessions,
      bonusSessionsRemaining: 0,
      trialSessionsRemaining: 0,
      pricePerSession,
      referenceDuration,
      perMinuteRate: referenceDuration > 0 ? pricePerSession / referenceDuration : 0,
      amount,
      paymentDate: new Date(paymentDate),
      createdBy: directorUser._id,
      status: 'APPROVED',
      walletTopUpDone: true,
    });

    return {
      parent: parentCreateRes.body,
      invoice,
    };
  }

  async function upsertTeacherProfile(user: any, managedSales: any[] = []) {
    await teacherProfileModel.updateOne(
      { userId: user._id },
      {
        $set: {
          userId: user._id,
          managedSales: managedSales.map((saleUser) => saleUser._id),
          subjects: ['Toan'],
          grades: ['Lop 6'],
          teachingMode: 'ONLINE',
          locations: [],
          qualifications: [],
          yearsOfExperience: 2,
          availability: [],
          pricePerSession: 200000,
          status: 'APPROVED',
          approvedBy: directorUser?._id,
          approvedAt: new Date(),
        },
      },
      { upsert: true },
    );

    return teacherProfileModel.findOne({ userId: user._id }).lean();
  }

  async function createLead(params: {
    leadCode: string;
    parentName: string;
    parentPhone: string;
    saleUser?: any;
  }) {
    return leadModel.create({
      leadCode: params.leadCode,
      parentName: params.parentName,
      parentPhone: params.parentPhone,
      source: 'FACEBOOK',
      status: 'NEW',
      saleId: params.saleUser?._id,
      saleName: params.saleUser?.fullName,
      assignedAt: new Date(),
      assignmentHistory: params.saleUser
        ? [{
            saleId: params.saleUser._id,
            saleName: params.saleUser.fullName,
            assignedAt: new Date(),
          }]
        : [],
    });
  }

  async function createConversation(params: {
    conversationCode: string;
    platformUserId: string;
    assignedSale?: any;
    leadId?: string;
  }) {
    return conversationModel.create({
      conversationCode: params.conversationCode,
      fanpageId: new Types.ObjectId(),
      fanpageName: 'Fanpage E2E',
      platform: 'FACEBOOK',
      platformUserId: params.platformUserId,
      customerName: 'Conversation Customer',
      customerPhone: '0903000300',
      status: 'HUMAN_HANDLING',
      assignedAgentId: params.assignedSale?._id,
      assignedAgentName: params.assignedSale?.fullName,
      leadId: params.leadId ? new Types.ObjectId(params.leadId) : undefined,
      lastMessageAt: new Date(),
      messageCount: 1,
    });
  }

  beforeAll(async () => {
    process.env.REDIS_ENABLED = 'false';
    mongod = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    process.env.MONGODB_URI = mongod.getUri('school-mgmt-sale-ownership-e2e');

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
    leadModel = moduleRef.get<Model<any>>(getModelToken('Lead'));
    orderModel = moduleRef.get<Model<any>>(getModelToken('Order'));
    invoiceModel = moduleRef.get<Model<any>>(getModelToken('Invoice'));
    conversationModel = moduleRef.get<Model<any>>(getModelToken('Conversation'));
    walletModel = moduleRef.get<Model<any>>(getModelToken('Wallet'));
    classModel = moduleRef.get<Model<any>>(getModelToken('Classroom'));
    attendanceModel = moduleRef.get<Model<any>>(getModelToken('Attendance'));
    sessionModel = moduleRef.get<Model<any>>(getModelToken('Session'));
    teacherProfileModel = moduleRef.get<Model<any>>(getModelToken('TeacherProfile'));

    directorUser = await upsertUser(director);
    opsUser = await upsertUser(ops);
    accountingUser = await upsertUser(accounting);
    saleAUser = await upsertUser(saleA);
    saleBUser = await upsertUser(saleB);
    teacherAUser = await upsertUser(teacherA);
    teacherBUser = await upsertUser(teacherB);

    await upsertTeacherProfile(teacherAUser, [saleAUser]);
    await upsertTeacherProfile(teacherBUser, [saleAUser]);

    directorSession = await loginAndGetSession(director.email, director.password);
    opsSession = await loginAndGetSession(ops.email, ops.password);
    accountingSession = await loginAndGetSession(accounting.email, accounting.password);
    saleASession = await loginAndGetSession(saleA.email, saleA.password);
    saleBSession = await loginAndGetSession(saleB.email, saleB.password);
    teacherASession = await loginAndGetSession(teacherA.email, teacherA.password);
    teacherBSession = await loginAndGetSession(teacherB.email, teacherB.password);
  });

  beforeEach(async () => {
    await resetBusinessCollections();
  });

  afterAll(async () => {
    await closeE2eResources({ app, moduleRef, mongoServer: mongod });
  });

  it('lets OPS and ACCOUNTING list sale users for owner selection', async () => {
    const opsRes = await request(app.getHttpServer())
      .get('/users/sales')
      .set('Cookie', opsSession.cookieHeader)
      .expect(200);

    expect(Array.isArray(opsRes.body)).toBe(true);
    expect(opsRes.body.some((user: any) => user.email === saleA.email)).toBe(true);

    const accountingRes = await request(app.getHttpServer())
      .get('/users/sales')
      .set('Cookie', accountingSession.cookieHeader)
      .expect(200);

    expect(Array.isArray(accountingRes.body)).toBe(true);
    expect(accountingRes.body.some((user: any) => user.email === saleB.email)).toBe(true);
  });

  it('allows SALE to create and edit owned parent accounts but not delete them', async () => {
    const createRes = await authedPost(saleASession, '/users')
      .send({
        userCode: 'PH-SALE-A-001',
        email: 'parent-sale-a-001@school.local',
        password: 'ParentPass123!',
        fullName: 'Parent Sale A',
        role: 'PARENT',
        phone: '0902555001',
        address: 'District 1',
        facebookLink: 'https://facebook.com/parent-sale-a-001',
      })
      .expect(201);

    expect(createRes.body.role).toBe('PARENT');
    expect(String(createRes.body.saleOwnerId)).toBe(String(saleAUser._id));
    expect(createRes.body.saleOwnerName).toBe(saleA.fullName);

    const updateRes = await authedPatch(saleASession, `/users/${createRes.body._id}`)
      .send({
        fullName: 'Parent Sale A Updated',
        address: 'District 3',
      })
      .expect(200);

    expect(updateRes.body.fullName).toBe('Parent Sale A Updated');
    expect(updateRes.body.address).toBe('District 3');
    expect(String(updateRes.body.saleOwnerId)).toBe(String(saleAUser._id));

    await authedDelete(saleASession, `/users/${createRes.body._id}`).expect(403);
  });

  it('blocks SALE from creating non-parent users and from editing another sale parent', async () => {
    await authedPost(saleASession, '/users')
      .send({
        userCode: 'SALE-FORBIDDEN-001',
        email: 'sale-forbidden-001@school.local',
        password: 'ParentPass123!',
        fullName: 'Forbidden Sale User',
        role: 'SALE',
      })
      .expect(403);

    const parentB = await authedPost(directorSession, '/users')
      .send({
        userCode: 'PH-SALE-B-001',
        email: 'parent-sale-b-001@school.local',
        password: 'ParentPass123!',
        fullName: 'Parent Sale B',
        role: 'PARENT',
        phone: '0902555002',
        saleOwnerId: String(saleBUser._id),
      })
      .expect(201);

    const saleAParents = await authedGet(saleASession, '/users/parents').expect(200);
    expect(Array.isArray(saleAParents.body)).toBe(true);
    expect(saleAParents.body.some((user: any) => user.email === parentB.body.email)).toBe(false);

    await authedPatch(saleASession, `/users/${parentB.body._id}`)
      .send({
        fullName: 'Intrusion Attempt',
      })
      .expect(403);
  });

  it('lets DIRECTOR transfer parent ownership to another sale and sync linked students', async () => {
    const parent = await authedPost(directorSession, '/users')
      .send({
        userCode: 'PH-TRANSFER-001',
        email: 'parent-transfer-001@school.local',
        password: 'ParentPass123!',
        fullName: 'Parent Transfer',
        role: 'PARENT',
        phone: '0902555003',
        saleOwnerId: String(saleAUser._id),
      })
      .expect(201);

    const student = await studentModel.create({
      studentCode: 'STU-PARENT-TRANSFER-001',
      fullName: 'Student Transfer',
      age: 11,
      parentUserId: new Types.ObjectId(parent.body._id),
      parentName: parent.body.fullName,
      parentPhone: parent.body.phone,
      faceImage: 'default-avatar.png',
      saleId: saleAUser._id,
      saleName: saleA.fullName,
    });

    const transferRes = await authedPatch(directorSession, `/users/${parent.body._id}`)
      .send({
        saleOwnerId: String(saleBUser._id),
      })
      .expect(200);

    expect(String(transferRes.body.saleOwnerId)).toBe(String(saleBUser._id));
    expect(transferRes.body.saleOwnerName).toBe(saleB.fullName);

    const storedStudent = await studentModel.findById(student._id).lean() as any;
    expect(storedStudent).toBeTruthy();
    expect(String(storedStudent.saleId)).toBe(String(saleBUser._id));
    expect(storedStudent.saleName).toBe(saleB.fullName);

    const saleAParents = await authedGet(saleASession, '/users/parents').expect(200);
    const saleBParents = await authedGet(saleBSession, '/users/parents').expect(200);
    expect(saleAParents.body.some((user: any) => user._id === parent.body._id)).toBe(false);
    expect(saleBParents.body.some((user: any) => user._id === parent.body._id)).toBe(true);
  });

  it('propagates parent ownership transfer to parent support directory and future orders', async () => {
    const parentPassword = 'ParentPass123!';
    const parent = await authedPost(directorSession, '/users')
      .send({
        userCode: 'PH-TRANSFER-ORDER-001',
        email: 'parent-transfer-order-001@school.local',
        password: parentPassword,
        fullName: 'Parent Transfer Order',
        role: 'PARENT',
        phone: '0902555004',
        saleOwnerId: String(saleAUser._id),
      })
      .expect(201);

    const student = await studentModel.create({
      studentCode: 'STU-PARENT-TRANSFER-ORDER-001',
      fullName: 'Student Transfer Order',
      age: 10,
      parentUserId: new Types.ObjectId(parent.body._id),
      parentName: parent.body.fullName,
      parentPhone: parent.body.phone,
      faceImage: 'default-avatar.png',
      saleId: saleAUser._id,
      saleName: saleA.fullName,
    });

    const parentSession = await loginAndGetSession(parent.body.email, parentPassword);
    const parentDirectoryBeforeTransfer = await authedGet(parentSession, '/users/directory').expect(200);
    expect(
      parentDirectoryBeforeTransfer.body.some((user: any) => user.email === saleA.email),
    ).toBe(true);
    expect(
      parentDirectoryBeforeTransfer.body.some((user: any) => user.email === saleB.email),
    ).toBe(false);

    const transferRes = await authedPatch(directorSession, `/users/${parent.body._id}`)
      .send({
        saleOwnerId: String(saleBUser._id),
      })
      .expect(200);

    expect(String(transferRes.body.saleOwnerId)).toBe(String(saleBUser._id));
    expect(transferRes.body.saleOwnerName).toBe(saleB.fullName);

    const syncedStudent = await studentModel.findById(student._id).lean() as any;
    expect(String(syncedStudent.saleId)).toBe(String(saleBUser._id));
    expect(syncedStudent.saleName).toBe(saleB.fullName);

    const parentDirectoryAfterTransfer = await authedGet(parentSession, '/users/directory').expect(200);
    expect(
      parentDirectoryAfterTransfer.body.some((user: any) => user.email === saleA.email),
    ).toBe(false);
    expect(
      parentDirectoryAfterTransfer.body.some((user: any) => user.email === saleB.email),
    ).toBe(true);

    await authedPost(saleASession, '/orders')
      .send(buildOrderPayload({
        parentUserId: String(parent.body._id),
        parentName: parent.body.fullName,
        parentPhone: parent.body.phone,
        existingStudentId: String(student._id),
      }))
      .expect(404);

    const directorOrderRes = await authedPost(directorSession, '/orders')
      .send(buildOrderPayload({
        parentUserId: String(parent.body._id),
        parentName: parent.body.fullName,
        parentPhone: parent.body.phone,
        existingStudentId: String(student._id),
      }))
      .expect(201);

    expect(String(directorOrderRes.body.saleId)).toBe(String(saleBUser._id));
    expect(directorOrderRes.body.saleName).toBe(saleB.fullName);

    const saleBOrderRes = await authedPost(saleBSession, '/orders')
      .send(buildOrderPayload({
        parentUserId: String(parent.body._id),
        parentName: parent.body.fullName,
        parentPhone: parent.body.phone,
        existingStudentId: String(student._id),
      }))
      .expect(201);

    expect(String(saleBOrderRes.body.saleId)).toBe(String(saleBUser._id));
    expect(saleBOrderRes.body.saleName).toBe(saleB.fullName);
  });

  it('blocks approving an invoice when the sale invoice image is missing', async () => {
    const parent = await authedPost(directorSession, '/users')
      .send({
        userCode: 'PH-APPROVAL-001',
        email: 'parent-approval-001@school.local',
        password: 'ParentPass123!',
        fullName: 'Parent Approval Missing Sale Proof',
        role: 'PARENT',
        phone: '0902666001',
        saleOwnerId: String(saleAUser._id),
      })
      .expect(201);

    const student = await studentModel.create({
      studentCode: 'STU-APPROVAL-001',
      fullName: 'Student Approval Missing Sale Proof',
      age: 12,
      parentUserId: new Types.ObjectId(parent.body._id),
      parentName: parent.body.fullName,
      parentPhone: parent.body.phone,
      faceImage: 'default-avatar.png',
      saleId: saleAUser._id,
      saleName: saleA.fullName,
    });

    const invoiceCreateRes = await authedPost(saleASession, '/invoices')
      .send({
        invoiceNumber: 'INV-2026-COUNTER-001',
        studentId: String(student._id),
        amount: 1500000,
        paymentDate: '2026-03-20',
      })
      .expect(201);

    const approveRes = await authedPost(directorSession, `/invoices/${invoiceCreateRes.body._id}/approve`)
      .send({
        action: 'APPROVE',
        approvalImage: '/uploads/invoices/counter-001.png',
      })
      .expect(400);

    expect(String(approveRes.body.message)).toContain('hoa don sale upload');

    const wallet = await walletModel.findOne({ userId: new Types.ObjectId(parent.body._id) }).lean() as any;
    expect(wallet).toBeNull();
  });

  it('only credits wallet after counterpart invoice is uploaded during approval', async () => {
    const parent = await authedPost(directorSession, '/users')
      .send({
        userCode: 'PH-APPROVAL-002',
        email: 'parent-approval-002@school.local',
        password: 'ParentPass123!',
        fullName: 'Parent Approval With Counterpart',
        role: 'PARENT',
        phone: '0902666002',
        saleOwnerId: String(saleAUser._id),
      })
      .expect(201);

    const student = await studentModel.create({
      studentCode: 'STU-APPROVAL-002',
      fullName: 'Student Approval With Counterpart',
      age: 12,
      parentUserId: new Types.ObjectId(parent.body._id),
      parentName: parent.body.fullName,
      parentPhone: parent.body.phone,
      faceImage: 'default-avatar.png',
      saleId: saleAUser._id,
      saleName: saleA.fullName,
    });

    const invoiceAmount = 2200000;
    const invoiceCreateRes = await authedPost(saleASession, '/invoices')
      .send({
        invoiceNumber: 'INV-2026-COUNTER-002',
        studentId: String(student._id),
        amount: invoiceAmount,
        paymentDate: '2026-03-20',
        receiptImage: '/uploads/invoices/sale-proof-002.png',
      })
      .expect(201);

    const missingCounterpartRes = await authedPost(directorSession, `/invoices/${invoiceCreateRes.body._id}/approve`)
      .send({
        action: 'APPROVE',
      })
      .expect(400);

    expect(String(missingCounterpartRes.body.message)).toContain('hoa don doi ung');

    let wallet = await walletModel.findOne({ userId: new Types.ObjectId(parent.body._id) }).lean() as any;
    expect(wallet).toBeNull();

    const approveRes = await authedPost(directorSession, `/invoices/${invoiceCreateRes.body._id}/approve`)
      .send({
        action: 'APPROVE',
        approvalImage: '/uploads/invoices/counter-002.png',
      })
      .expect((res) => {
        expect([200, 201]).toContain(res.status);
      });

    expect(approveRes.body.status).toBe('APPROVED');
    expect(approveRes.body.walletTopUpDone).toBe(true);
    expect(approveRes.body.approvalImage).toBe('/uploads/invoices/counter-002.png');

    wallet = await walletModel.findOne({ userId: new Types.ObjectId(parent.body._id) }).lean() as any;
    expect(wallet).toBeTruthy();
    expect(wallet.balance).toBe(invoiceAmount);
  });

  it('blocks approving an order when the sale receipt image is missing', async () => {
    const orderCreateRes = await authedPost(saleASession, '/orders')
      .send(buildOrderPayload({
        parentName: 'Order Missing Sale Proof',
        parentPhone: '0902666010',
        studentName: 'Student Missing Sale Proof',
      }))
      .expect((res) => {
        expect([200, 201]).toContain(res.status);
      });

    const orderId = String(orderCreateRes.body._id);

    await authedPost(saleASession, `/orders/${orderId}/submit`)
      .send({})
      .expect((res) => {
        expect([200, 201]).toContain(res.status);
      });

    const approveOrderRes = await authedPost(opsSession, `/orders/${orderId}/approve`)
      .send({
        approvalImage: '/uploads/invoices/order-counterpart-missing-sale-proof.png',
      })
      .expect(400);

    expect(String(approveOrderRes.body.message)).toContain('hoa don sale upload');
  });

  it('blocks approving an order when the counterpart invoice is missing', async () => {
    const orderCreateRes = await authedPost(saleASession, '/orders')
      .send(buildOrderPayload({
        parentName: 'Order Missing Counterpart',
        parentPhone: '0902666011',
        studentName: 'Student Missing Counterpart',
        receiptImage: '/uploads/invoices/order-sale-proof-001.png',
      }))
      .expect((res) => {
        expect([200, 201]).toContain(res.status);
      });

    const orderId = String(orderCreateRes.body._id);

    await authedPost(saleASession, `/orders/${orderId}/submit`)
      .send({})
      .expect((res) => {
        expect([200, 201]).toContain(res.status);
      });

    const approveOrderRes = await authedPost(opsSession, `/orders/${orderId}/approve`)
      .send({})
      .expect(400);

    expect(String(approveOrderRes.body.message)).toContain('hoa don doi ung');
  });

  it('keeps the approved wallet top-up aligned with the real invoice amount even when product pricing differs', async () => {
    const parent = await authedPost(directorSession, '/users')
      .send({
        userCode: 'PH-APPROVAL-003',
        email: 'parent-approval-003@school.local',
        password: 'ParentPass123!',
        fullName: 'Parent Approval Amount Mismatch',
        role: 'PARENT',
        phone: '0902666003',
        saleOwnerId: String(saleAUser._id),
      })
      .expect(201);

    const student = await studentModel.create({
      studentCode: 'STU-APPROVAL-003',
      fullName: 'Student Approval Amount Mismatch',
      age: 12,
      parentUserId: new Types.ObjectId(parent.body._id),
      parentName: parent.body.fullName,
      parentPhone: parent.body.phone,
      faceImage: 'default-avatar.png',
      saleId: saleAUser._id,
      saleName: saleA.fullName,
    });

    const realInvoiceAmount = 1_875_000;
    const orderCreateRes = await authedPost(saleASession, '/orders')
      .send(buildOrderPayload({
        parentName: parent.body.fullName,
        parentPhone: parent.body.phone,
        studentName: student.fullName,
        studentCode: student.studentCode,
        existingStudentId: String(student._id),
        parentUserId: String(parent.body._id),
        items: [
          {
            productId: new Types.ObjectId().toString(),
            productName: 'Combo Mismatch',
            sessions: 12,
            sessionDuration: 90,
            baseDuration: 90,
            pricePerSession: 250000,
            amount: realInvoiceAmount,
            teachingMode: 'ONLINE',
            preferredTeacherId: String(teacherAUser._id),
            invoiceDescription: 'Invoice amount must be preserved exactly',
            notes: 'Price per session intentionally does not match final invoice amount',
          },
        ],
        totalAmount: realInvoiceAmount,
        finalAmount: realInvoiceAmount,
        receiptImage: '/uploads/invoices/mismatch-sale-proof.png',
      }))
      .expect((res) => {
        expect([200, 201]).toContain(res.status);
      });

    const orderId = String(orderCreateRes.body._id);

    await authedPost(saleASession, `/orders/${orderId}/submit`)
      .send({})
      .expect((res) => {
        expect([200, 201]).toContain(res.status);
      });

    const approveOrderRes = await authedPost(opsSession, `/orders/${orderId}/approve`)
      .send({
        approvalImage: '/uploads/invoices/mismatch-order-approval.png',
      })
      .expect((res) => {
        expect([200, 201]).toContain(res.status);
      });

    const invoiceId = String(approveOrderRes.body.enrollment.invoiceIds[0]);
    const generatedInvoice = await invoiceModel.findById(invoiceId).lean() as any;
    expect(generatedInvoice.amount).toBe(realInvoiceAmount);
    expect(generatedInvoice.pricePerSession).toBe(250000);
    expect(generatedInvoice.status).toBe('APPROVED');
    expect(generatedInvoice.approvalImage).toBe('/uploads/invoices/mismatch-order-approval.png');
    expect(generatedInvoice.walletTopUpDone).toBe(true);

    const wallet = await walletModel.findOne({ userId: new Types.ObjectId(parent.body._id) }).lean() as any;
    expect(wallet).toBeTruthy();
    expect(wallet.balance).toBe(realInvoiceAmount);
  });

  it('inherits sale owner from lead when DIRECTOR creates an order without saleId', async () => {
    const lead = await createLead({
      leadCode: 'LEAD-2026-0001',
      parentName: 'Parent Lead',
      parentPhone: '0901111111',
      saleUser: saleAUser,
    });

    const res = await authedPost(directorSession, '/orders')
      .send(buildOrderPayload({
        parentName: 'Parent Lead',
        parentPhone: '0901111111',
        studentName: 'Student Lead',
        leadId: String(lead._id),
      }))
      .expect(201);

    expect(String(res.body.saleId)).toBe(String(saleAUser._id));
    expect(res.body.saleName).toBe(saleA.fullName);
  });

  it('rejects mismatched explicit saleId when a lead is already owned by another sale', async () => {
    const lead = await createLead({
      leadCode: 'LEAD-2026-0002',
      parentName: 'Parent Lead 2',
      parentPhone: '0901222222',
      saleUser: saleAUser,
    });

    const res = await authedPost(directorSession, '/orders')
      .send(buildOrderPayload({
        parentName: 'Parent Lead 2',
        parentPhone: '0901222222',
        studentName: 'Student Lead 2',
        leadId: String(lead._id),
        saleId: String(saleBUser._id),
      }))
      .expect(400);

    expect(String(res.body.message)).toContain('Lead');
  });

  it('uses explicitly selected sale for brand new orders created by OPS', async () => {
    const res = await authedPost(opsSession, '/orders')
      .send(buildOrderPayload({
        parentName: 'Parent Fresh',
        parentPhone: '0901333333',
        studentName: 'Student Fresh',
        saleId: String(saleBUser._id),
      }))
      .expect(201);

    expect(String(res.body.saleId)).toBe(String(saleBUser._id));
    expect(res.body.saleName).toBe(saleB.fullName);
  });

  it('blocks SALE from creating invoices for a student outside their portfolio', async () => {
    const student = await createStudent({
      studentCode: 'STU-2026-B1',
      fullName: 'Student B1',
      parentName: 'Parent B1',
      parentPhone: '0901444444',
      saleUser: saleBUser,
    });

    await authedPost(saleASession, '/invoices')
      .send({
        invoiceNumber: 'INV-2026-0001',
        studentId: String(student._id),
        amount: 1500000,
        paymentDate: '2026-03-20',
      })
      .expect(404);
  });

  it('forces SALE-created invoices to stay credited to the actor even if saleId is forged', async () => {
    const student = await createStudent({
      studentCode: 'STU-2026-A1',
      fullName: 'Student A1',
      parentName: 'Parent A1',
      parentPhone: '0901555555',
      saleUser: saleAUser,
    });

    const res = await authedPost(saleASession, '/invoices')
      .send({
        invoiceNumber: 'INV-2026-0002',
        studentId: String(student._id),
        saleId: String(saleBUser._id),
        amount: 1800000,
        paymentDate: '2026-03-20',
      })
      .expect(201);

    expect(String(res.body.saleId)).toBe(String(saleAUser._id));
    expect(String(res.body.createdBy)).toBe(String(saleAUser._id));
  });

  it('derives price per session and initializes remaining sessions on create', async () => {
    const student = await createStudent({
      studentCode: 'STU-INVOICE-CREATE-001',
      fullName: 'Student Invoice Create',
      parentName: 'Parent Invoice Create',
      parentPhone: '0901888001',
      saleUser: saleAUser,
    });

    const res = await authedPost(saleASession, '/invoices')
      .send({
        invoiceNumber: 'INV-CREATE-LOGIC-0001',
        studentId: String(student._id),
        sessions: 12,
        bonusSessions: 2,
        amount: 1800000,
        paymentDate: '2026-03-20',
      })
      .expect(201);

    expect(res.body.amount).toBe(1800000);
    expect(res.body.pricePerSession).toBe(150000);
    expect(res.body.sessionsRemaining).toBe(12);
    expect(res.body.bonusSessionsRemaining).toBe(2);
    expect(res.body.status).toBe('PENDING_APPROVAL');
    expect(res.body.invoiceType).toBe('TUITION');

    const stored = await invoiceModel.findById(res.body._id).lean() as any;
    expect(stored).toBeTruthy();
    expect(stored.amount).toBe(1800000);
    expect(stored.sessions).toBe(12);
    expect(stored.bonusSessions).toBe(2);
    expect(stored.sessionsRemaining).toBe(12);
    expect(stored.bonusSessionsRemaining).toBe(2);
    expect(String(stored.saleId)).toBe(String(saleAUser._id));
  });

  it('prevents SALE from mutating invoice ownership fields while editing pending invoices', async () => {
    const studentA = await createStudent({
      studentCode: 'STU-2026-A2',
      fullName: 'Student A2',
      parentName: 'Parent A2',
      parentPhone: '0901666666',
      saleUser: saleAUser,
    });
    const studentB = await createStudent({
      studentCode: 'STU-2026-B2',
      fullName: 'Student B2',
      parentName: 'Parent B2',
      parentPhone: '0901777777',
      saleUser: saleBUser,
    });

    const invoice = await invoiceModel.create({
      invoiceNumber: 'INV-2026-0003',
      studentId: studentA._id,
      saleId: saleAUser._id,
      amount: 2000000,
      paymentDate: new Date('2026-03-20'),
      status: 'PENDING_APPROVAL',
      createdBy: saleAUser._id,
    });

    const res = await authedPatch(saleASession, `/invoices/${invoice._id}`)
      .send({
        studentId: String(studentB._id),
        saleId: String(saleBUser._id),
        classId: new Types.ObjectId().toString(),
        amount: 2100000,
      })
      .expect(200);

    expect(res.body.amount).toBe(2100000);
    expect(String(res.body.studentId?._id || res.body.studentId)).toBe(String(studentA._id));

    const stored = await invoiceModel.findById(invoice._id).lean() as any;
    expect(stored).toBeTruthy();
    expect(String(stored.saleId)).toBe(String(saleAUser._id));
    expect(String(stored.studentId)).toBe(String(studentA._id));
    expect(stored.classId).toBeUndefined();
    expect(stored.status).toBe('PENDING_APPROVAL');
  });

  it('recomputes pending invoice remaining sessions and pricing fields during edit', async () => {
    const student = await createStudent({
      studentCode: 'STU-INVOICE-UPDATE-001',
      fullName: 'Student Invoice Update',
      parentName: 'Parent Invoice Update',
      parentPhone: '0901888002',
      saleUser: saleAUser,
    });

    const invoice = await invoiceModel.create({
      invoiceNumber: 'INV-UPDATE-LOGIC-0001',
      studentId: student._id,
      saleId: saleAUser._id,
      createdBy: saleAUser._id,
      status: 'PENDING_APPROVAL',
      invoiceType: 'TUITION',
      sessions: 10,
      sessionsRemaining: 8,
      bonusSessions: 3,
      bonusSessionsRemaining: 2,
      pricePerSession: 100000,
      referenceDuration: 60,
      perMinuteRate: 100000 / 60,
      amount: 1000000,
      paymentDate: new Date('2026-03-20'),
    });

    const res = await authedPatch(saleASession, `/invoices/${invoice._id}`)
      .send({
        sessions: 14,
        bonusSessions: 5,
        pricePerSession: 120000,
        referenceDuration: 90,
        amount: 1680000,
      })
      .expect(200);

    expect(res.body.amount).toBe(1680000);
    expect(res.body.sessionsRemaining).toBe(12);
    expect(res.body.bonusSessionsRemaining).toBe(4);

    const stored = await invoiceModel.findById(invoice._id).lean() as any;
    expect(stored).toBeTruthy();
    expect(stored.amount).toBe(1680000);
    expect(stored.sessions).toBe(14);
    expect(stored.sessionsRemaining).toBe(12);
    expect(stored.bonusSessions).toBe(5);
    expect(stored.bonusSessionsRemaining).toBe(4);
    expect(stored.pricePerSession).toBe(120000);
    expect(stored.referenceDuration).toBe(90);
    expect(stored.perMinuteRate).toBeCloseTo(120000 / 90, 8);
  });

  it('blocks financial edits on approved invoices', async () => {
    const student = await createStudent({
      studentCode: 'STU-INVOICE-UPDATE-002',
      fullName: 'Student Invoice Approved',
      parentName: 'Parent Invoice Approved',
      parentPhone: '0901888003',
      saleUser: saleAUser,
    });

    const invoice = await invoiceModel.create({
      invoiceNumber: 'INV-UPDATE-LOGIC-0002',
      studentId: student._id,
      saleId: saleAUser._id,
      createdBy: saleAUser._id,
      approvedBy: directorUser._id,
      approvedAt: new Date('2026-03-21'),
      status: 'APPROVED',
      invoiceType: 'TUITION',
      sessions: 8,
      sessionsRemaining: 8,
      bonusSessions: 1,
      bonusSessionsRemaining: 1,
      pricePerSession: 125000,
      referenceDuration: 60,
      perMinuteRate: 125000 / 60,
      amount: 1000000,
      paymentDate: new Date('2026-03-20'),
    });

    const res = await authedPatch(directorSession, `/invoices/${invoice._id}`)
      .send({
        amount: 1100000,
        sessions: 9,
      })
      .expect(400);

    expect(String(res.body.message)).toContain('Không thể sửa thông tin tài chính hay học sinh của hóa đơn đã duyệt');

    const stored = await invoiceModel.findById(invoice._id).lean() as any;
    expect(stored).toBeTruthy();
    expect(stored.amount).toBe(1000000);
    expect(stored.sessions).toBe(8);
    expect(stored.status).toBe('APPROVED');
  });

  it('stores and returns invoice course status for create, update, and list flows', async () => {
    const student = await createStudent({
      studentCode: 'STU-INVOICE-COURSE-STATUS',
      fullName: 'Student Invoice Course Status',
      parentName: 'Parent Invoice Course Status',
      parentPhone: '0901999999',
      saleUser: saleAUser,
    });

    const createRes = await authedPost(saleASession, '/invoices')
      .send({
        invoiceNumber: 'INV-COURSE-STATUS-0001',
        studentId: String(student._id),
        amount: 1600000,
        paymentDate: '2026-03-20',
        courseStatus: 'CONTINUE_2',
      })
      .expect(201);

    expect(createRes.body.courseStatus).toBe('CONTINUE_2');

    const updateRes = await authedPatch(saleASession, `/invoices/${createRes.body._id}`)
      .send({
        courseStatus: 'CONTINUE_3',
      })
      .expect(200);

    expect(updateRes.body.courseStatus).toBe('CONTINUE_3');

    const stored = await invoiceModel.findById(createRes.body._id).lean() as any;
    expect(stored.courseStatus).toBe('CONTINUE_3');

    const listRes = await authedGet(saleASession, '/invoices').expect(200);
    const listedInvoice = listRes.body.find((invoice: any) => String(invoice._id) === String(createRes.body._id));
    expect(listedInvoice).toBeTruthy();
    expect(listedInvoice.courseStatus).toBe('CONTINUE_3');
  });

  it('propagates two approved invoice rounds in the same class into parent summary, attendance report, comprehensive report, and financial control totals', async () => {
    const paymentDate = '2026-03-20';
    const attendanceDate = '2026-03-24';
    const student = await createStudent({
      studentCode: 'STU-INVOICE-PROP-001',
      fullName: 'Student Invoice Propagation',
      parentName: 'Parent Invoice Propagation',
      parentPhone: '0901777001',
      saleUser: saleAUser,
    });
    const { parent, password } = await ensureParentForStudent({
      student,
      saleUser: saleAUser,
      email: 'parent-invoice-prop-001@school.local',
    });

    const cls = await classModel.create({
      name: 'Class Invoice Propagation',
      code: 'CLS-INVOICE-PROP-001',
      teacher: teacherAUser._id,
      sale: saleAUser._id,
      students: [student._id],
      classMode: 'ONLINE',
      pricePerSession: 200000,
      teacherPayPerSession: 90000,
      teacherPayPerStudent: 0,
      baseDuration: 60,
      sessionDuration: 60,
    });

    const invoice1CreateRes = await authedPost(saleASession, '/invoices')
      .send({
        invoiceNumber: 'INV-PROP-ROUND-001',
        studentId: String(student._id),
        classId: String(cls._id),
        classType: 'ONLINE',
        sessions: 8,
        bonusSessions: 2,
        trialSessions: 0,
        paymentRound: 1,
        courseStatus: 'NEW',
        pricePerSession: 200000,
        referenceDuration: 60,
        amount: 1600000,
        paymentDate,
        receiptImage: '/uploads/invoices/invoice-prop-round-001-sale.png',
      })
      .expect(201);

    await authedPost(directorSession, `/invoices/${invoice1CreateRes.body._id}/approve`)
      .send({
        action: 'APPROVE',
        approvalImage: '/uploads/invoices/invoice-prop-round-001-counter.png',
      })
      .expect(201);

    const invoice2CreateRes = await authedPost(saleASession, '/invoices')
      .send({
        invoiceNumber: 'INV-PROP-ROUND-002',
        studentId: String(student._id),
        classId: String(cls._id),
        classType: 'ONLINE',
        sessions: 4,
        bonusSessions: 1,
        trialSessions: 0,
        paymentRound: 2,
        courseStatus: 'CONTINUE_1',
        pricePerSession: 200000,
        referenceDuration: 60,
        amount: 800000,
        paymentDate,
        receiptImage: '/uploads/invoices/invoice-prop-round-002-sale.png',
      })
      .expect(201);

    await authedPost(directorSession, `/invoices/${invoice2CreateRes.body._id}/approve`)
      .send({
        action: 'APPROVE',
        approvalImage: '/uploads/invoices/invoice-prop-round-002-counter.png',
      })
      .expect(201);

    const storedStudent = await studentModel.findById(student._id).lean() as any;
    expect(storedStudent.totalPurchasedSessions).toBe(15);

    const parentSession = await loginAndGetSession(parent.email, password);
    const parentInvoicesBeforeAttendance = await authedGet(parentSession, '/invoices/my-children')
      .expect(200);
    expect(parentInvoicesBeforeAttendance.body.summary.totalSessionsRemaining).toBe(15);

    const invoiceListRes = await authedGet(saleASession, '/invoices').expect(200);
    const studentInvoices = invoiceListRes.body.filter(
      (invoice: any) => String(invoice.studentId?._id || invoice.studentId) === String(student._id),
    );
    expect(studentInvoices).toHaveLength(2);
    expect(studentInvoices.every((invoice: any) => invoice.status === 'APPROVED')).toBe(true);

    const comprehensiveBeforeAttendance = await authedGet(
      directorSession,
      `/students/comprehensive-report?classId=${cls._id}&searchTerm=${student.studentCode}`,
    ).expect(200);
    const comprehensiveBeforeRow = (comprehensiveBeforeAttendance.body.rows || []).find(
      (row: any) => row.studentCode === student.studentCode,
    );
    expect(comprehensiveBeforeRow).toBeTruthy();
    expect(comprehensiveBeforeRow.totalSessions).toBe(15);
    expect(comprehensiveBeforeRow.sessionsCompleted).toBe(0);
    expect(comprehensiveBeforeRow.invoiceNumber).toBe('INV-PROP-ROUND-002');

    await markAndFinalizeAttendance({
      classId: String(cls._id),
      studentId: String(student._id),
      markerSession: directorSession,
      reporterSession: teacherASession,
      date: attendanceDate,
      lessonContent: 'Attendance finalized after two approved invoice rounds in the same class.',
    });

    const attendanceReportRes = await authedGet(
      directorSession,
      `/attendance/report?startDate=${attendanceDate}&endDate=${attendanceDate}&classId=${cls._id}`,
    ).expect(200);
    const attendanceRow = (attendanceReportRes.body.data || []).find(
      (row: any) => String(row.studentId?._id || row.studentId) === String(student._id),
    );
    expect(attendanceRow).toBeTruthy();
    expect(attendanceRow.studentId.totalPurchasedSessions).toBe(15);

    const comprehensiveAfterAttendance = await authedGet(
      directorSession,
      `/students/comprehensive-report?classId=${cls._id}&searchTerm=${student.studentCode}`,
    ).expect(200);
    const comprehensiveAfterRow = (comprehensiveAfterAttendance.body.rows || []).find(
      (row: any) => row.studentCode === student.studentCode,
    );
    expect(comprehensiveAfterRow).toBeTruthy();
    expect(comprehensiveAfterRow.totalSessions).toBe(15);
    expect(comprehensiveAfterRow.sessionsCompleted).toBe(1);
    expect(comprehensiveAfterRow.invoiceNumber).toBe('INV-PROP-ROUND-002');

    const parentInvoicesAfterAttendance = await authedGet(parentSession, '/invoices/my-children')
      .expect(200);
    expect(parentInvoicesAfterAttendance.body.summary.totalSessionsRemaining).toBe(14);

    const cashFlowRes = await authedGet(
      directorSession,
      `/financial-control/cash-flow?startDate=${paymentDate}&endDate=${paymentDate}`,
    ).expect(200);
    const cashFlowDay = (cashFlowRes.body.timeline || []).find((row: any) =>
      String(row.date).startsWith(paymentDate),
    );
    expect(cashFlowDay).toBeTruthy();
    expect(cashFlowDay.inflow?.invoices).toBe(2400000);
    expect(cashFlowDay.inflow?.invoiceCount).toBe(2);

    const provisionalGrossProfitRes = await authedGet(
      directorSession,
      '/financial-control/provisional-gross-profit?month=2026-03',
    ).expect(200);
    expect(provisionalGrossProfitRes.body.cashInflow?.approvedInvoiceAmount).toBe(2400000);
    expect(provisionalGrossProfitRes.body.cashInflow?.approvedInvoiceCount).toBe(2);
  });

  it('keeps attendance report total purchased sessions scoped to the selected class when the student has another approved invoice in a different class', async () => {
    const paymentDate = '2026-03-20';
    const attendanceDate = '2026-03-24';
    const student = await createStudent({
      studentCode: 'STU-INVOICE-SCOPE-001',
      fullName: 'Student Invoice Scope',
      parentName: 'Parent Invoice Scope',
      parentPhone: '0901777002',
      saleUser: saleAUser,
    });
    const { parent, password } = await ensureParentForStudent({
      student,
      saleUser: saleAUser,
      email: 'parent-invoice-scope-001@school.local',
    });

    const classA = await classModel.create({
      name: 'Class Invoice Scope A',
      code: 'CLS-INVOICE-SCOPE-A',
      teacher: teacherAUser._id,
      sale: saleAUser._id,
      students: [student._id],
      classMode: 'ONLINE',
      pricePerSession: 100000,
      teacherPayPerSession: 50000,
      teacherPayPerStudent: 0,
      baseDuration: 60,
      sessionDuration: 60,
    });
    const classB = await classModel.create({
      name: 'Class Invoice Scope B',
      code: 'CLS-INVOICE-SCOPE-B',
      teacher: teacherBUser._id,
      sale: saleAUser._id,
      students: [student._id],
      classMode: 'ONLINE',
      pricePerSession: 100000,
      teacherPayPerSession: 50000,
      teacherPayPerStudent: 0,
      baseDuration: 60,
      sessionDuration: 60,
    });

    const classAInvoiceCreateRes = await authedPost(saleASession, '/invoices')
      .send({
        invoiceNumber: 'INV-SCOPE-CLASS-A-001',
        studentId: String(student._id),
        classId: String(classA._id),
        classType: 'ONLINE',
        sessions: 10,
        bonusSessions: 0,
        trialSessions: 0,
        paymentRound: 1,
        courseStatus: 'NEW',
        pricePerSession: 100000,
        referenceDuration: 60,
        amount: 1000000,
        paymentDate,
        receiptImage: '/uploads/invoices/invoice-scope-class-a-sale.png',
      })
      .expect(201);
    await authedPost(directorSession, `/invoices/${classAInvoiceCreateRes.body._id}/approve`)
      .send({
        action: 'APPROVE',
        approvalImage: '/uploads/invoices/invoice-scope-class-a-counter.png',
      })
      .expect(201);

    const classBInvoiceCreateRes = await authedPost(saleASession, '/invoices')
      .send({
        invoiceNumber: 'INV-SCOPE-CLASS-B-001',
        studentId: String(student._id),
        classId: String(classB._id),
        classType: 'ONLINE',
        sessions: 7,
        bonusSessions: 0,
        trialSessions: 0,
        paymentRound: 1,
        courseStatus: 'NEW',
        pricePerSession: 100000,
        referenceDuration: 60,
        amount: 700000,
        paymentDate,
        receiptImage: '/uploads/invoices/invoice-scope-class-b-sale.png',
      })
      .expect(201);
    await authedPost(directorSession, `/invoices/${classBInvoiceCreateRes.body._id}/approve`)
      .send({
        action: 'APPROVE',
        approvalImage: '/uploads/invoices/invoice-scope-class-b-counter.png',
      })
      .expect(201);

    const storedStudent = await studentModel.findById(student._id).lean() as any;
    expect(storedStudent.totalPurchasedSessions).toBe(17);

    await markAndFinalizeAttendance({
      classId: String(classA._id),
      studentId: String(student._id),
      markerSession: directorSession,
      reporterSession: teacherASession,
      date: attendanceDate,
      lessonContent: 'Attendance finalized for class A while the student also has an invoice in class B.',
    });

    const attendanceReportRes = await authedGet(
      directorSession,
      `/attendance/report?startDate=${attendanceDate}&endDate=${attendanceDate}&classId=${classA._id}`,
    ).expect(200);
    const attendanceRow = (attendanceReportRes.body.data || []).find(
      (row: any) => String(row.studentId?._id || row.studentId) === String(student._id),
    );
    expect(attendanceRow).toBeTruthy();
    expect(attendanceRow.studentId.totalPurchasedSessions).toBe(17);

    const comprehensiveClassARes = await authedGet(
      directorSession,
      `/students/comprehensive-report?classId=${classA._id}&searchTerm=${student.studentCode}`,
    ).expect(200);
    const comprehensiveClassARow = (comprehensiveClassARes.body.rows || []).find(
      (row: any) => row.studentCode === student.studentCode,
    );
    expect(comprehensiveClassARow).toBeTruthy();
    expect(comprehensiveClassARow.totalSessions).toBe(10);
    expect(comprehensiveClassARow.sessionsCompleted).toBe(1);
    expect(comprehensiveClassARow.invoiceNumber).toBe('INV-SCOPE-CLASS-A-001');

    const comprehensiveClassBRes = await authedGet(
      directorSession,
      `/students/comprehensive-report?classId=${classB._id}&searchTerm=${student.studentCode}`,
    ).expect(200);
    const comprehensiveClassBRow = (comprehensiveClassBRes.body.rows || []).find(
      (row: any) => row.studentCode === student.studentCode,
    );
    expect(comprehensiveClassBRow).toBeTruthy();
    expect(comprehensiveClassBRow.totalSessions).toBe(7);
    expect(comprehensiveClassBRow.sessionsCompleted).toBe(0);
    expect(comprehensiveClassBRow.invoiceNumber).toBe('INV-SCOPE-CLASS-B-001');

    const parentSession = await loginAndGetSession(parent.email, password);
    const parentInvoicesRes = await authedGet(parentSession, '/invoices/my-children').expect(200);
    expect(parentInvoicesRes.body.summary.totalSessionsRemaining).toBe(16);
  });

  it('requires an explicit sale when OPS creates a lead from conversation without an assigned sale', async () => {
    const conv = await createConversation({
      conversationCode: 'CONV-2026-0001',
      platformUserId: 'fb-user-0001',
    });

    const res = await authedPost(opsSession, `/chatbot/conversations/${conv._id}/create-lead`)
      .send({
        parentName: 'Parent Chat',
        parentPhone: '0901888888',
      })
      .expect(400);

    expect(String(res.body.message)).toContain('sale');
  });

  it('creates conversation leads under the selected sale instead of the acting OPS account', async () => {
    const conv = await createConversation({
      conversationCode: 'CONV-2026-0002',
      platformUserId: 'fb-user-0002',
    });

    const res = await authedPost(opsSession, `/chatbot/conversations/${conv._id}/create-lead`)
      .send({
        parentName: 'Parent Chat 2',
        parentPhone: '0901999999',
        saleId: String(saleAUser._id),
      })
      .expect(201);

    expect(String(res.body.saleId)).toBe(String(saleAUser._id));
    expect(res.body.saleName).toBe(saleA.fullName);
  });

  it('inherits sale owner from linked lead when DIRECTOR creates orders from conversation', async () => {
    const lead = await createLead({
      leadCode: 'LEAD-2026-0003',
      parentName: 'Parent Conv Lead',
      parentPhone: '0902111111',
      saleUser: saleAUser,
    });
    const conv = await createConversation({
      conversationCode: 'CONV-2026-0003',
      platformUserId: 'fb-user-0003',
      assignedSale: saleBUser,
      leadId: String(lead._id),
    });

    const res = await authedPost(directorSession, `/chatbot/conversations/${conv._id}/create-order`)
      .send(buildConversationOrderPayload({
        parentName: 'Parent Conv Lead',
        parentPhone: '0902111111',
      }))
      .expect(201);

    expect(String(res.body.saleId)).toBe(String(saleAUser._id));
    expect(res.body.saleName).toBe(saleA.fullName);

    const stored = await orderModel.findById(res.body._id).lean() as any;
    expect(stored).toBeTruthy();
    expect(String(stored.saleId)).toBe(String(saleAUser._id));
  });

  it('stores SALE class edits as pending updates until OPS approves them', async () => {
    const cls = await classModel.create({
      name: 'Class Pending Approval',
      code: 'CLS-PENDING-APPROVAL',
      teacher: directorUser._id,
      sale: saleAUser._id,
      students: [],
      classMode: 'ONLINE',
      pricePerSession: 500000,
      teacherPayPerSession: 250000,
      teacherPayPerStudent: 0,
      baseDuration: 70,
      sessionDuration: 70,
    });

    const requestRes = await authedPatch(saleASession, `/classes/${cls._id}`)
      .send({
        sessionDuration: 90,
        pricePerSession: 550000,
      })
      .expect(200);

    expect(requestRes.body.pendingApproval).toBe(true);

    const pendingStored = await classModel.findById(cls._id).lean() as any;
    expect(pendingStored.sessionDuration).toBe(70);
    expect(pendingStored.pricePerSession).toBe(500000);
    expect(pendingStored.pendingSaleUpdate?.status).toBe('PENDING');
    expect(pendingStored.pendingSaleUpdate?.requestedChanges?.sessionDuration).toBe(90);
    expect(pendingStored.pendingSaleUpdate?.requestedChanges?.pricePerSession).toBe(550000);

    const pendingListRes = await authedGet(opsSession, '/pending-approvals/classes').expect(200);
    expect(Array.isArray(pendingListRes.body)).toBe(true);
    expect(
      pendingListRes.body.some((item: any) => String(item._id) === String(cls._id)),
    ).toBe(true);

    const approveRes = await authedPost(opsSession, `/classes/${cls._id}/pending-sale-update/approve`)
      .send({})
      .expect((res) => {
        expect([200, 201]).toContain(res.status);
      });

    expect(approveRes.body.sessionDuration).toBe(90);
    expect(approveRes.body.pricePerSession).toBe(550000);

    const approvedStored = await classModel.findById(cls._id).lean() as any;
    expect(approvedStored.sessionDuration).toBe(90);
    expect(approvedStored.pricePerSession).toBe(550000);
    expect(approvedStored.pendingSaleUpdate).toBeFalsy();
  });

  it('keeps class code stable for sale teacher changes and only lets the new teacher take later attendance', async () => {
    const studentA = await createStudent({
      studentCode: 'STU-TEACHER-CHANGE-A1',
      fullName: 'Student Teacher Change A1',
      parentName: 'Parent Teacher Change A1',
      parentPhone: '0903999991',
      saleUser: saleAUser,
    });

    const cls = await classModel.create({
      name: 'Class Teacher Change Lock',
      code: 'CLS-TEACHER-CHANGE-LOCK',
      teacher: teacherAUser._id,
      sale: saleAUser._id,
      students: [studentA._id],
      classMode: 'ONLINE',
      pricePerSession: 400000,
      teacherPayPerSession: 180000,
      teacherPayPerStudent: 0,
      baseDuration: 70,
      sessionDuration: 70,
    });

    await ensureAttendanceEligibility({
      student: studentA,
      classroom: cls,
      saleUser: saleAUser,
      sessions: 6,
      amount: 2_400_000,
      referenceDuration: 70,
    });

    const beforeChangeAttendance = await authedPost(directorSession, '/attendance/mark')
      .send({
        classId: String(cls._id),
        studentId: String(studentA._id),
        date: '2026-03-24',
        status: 'PRESENT',
      })
      .expect(201);

    expect(beforeChangeAttendance.body.teacherId || beforeChangeAttendance.body.teacher?._id).toBeTruthy();

    const requestRes = await authedPatch(saleASession, `/classes/${cls._id}`)
      .send({
        code: 'CLS-HACKED-BY-SALE',
        teacherId: String(teacherBUser._id),
        teacherPayPerSession: 210000,
      })
      .expect(200);

    expect(requestRes.body.pendingApproval).toBe(true);

    const pendingStored = await classModel.findById(cls._id).lean() as any;
    expect(pendingStored.code).toBe('CLS-TEACHER-CHANGE-LOCK');
    expect(pendingStored.pendingSaleUpdate?.requestedChanges?.code).toBeUndefined();
    expect(String(pendingStored.pendingSaleUpdate?.requestedChanges?.teacherId)).toBe(String(teacherBUser._id));
    expect(pendingStored.pendingSaleUpdate?.requestedChanges?.teacherPayPerSession).toBe(210000);

    const approveRes = await authedPost(opsSession, `/classes/${cls._id}/pending-sale-update/approve`)
      .send({})
      .expect((res) => {
        expect([200, 201]).toContain(res.status);
      });

    expect(approveRes.body.code).toBe('CLS-TEACHER-CHANGE-LOCK');
    expect(String(approveRes.body.teacher?._id || approveRes.body.teacher)).toBe(String(teacherBUser._id));
    expect(approveRes.body.teacherPayPerSession).toBe(210000);

    await authedPost(teacherASession, '/attendance/mark')
      .send({
        classId: String(cls._id),
        studentId: String(studentA._id),
        date: '2026-03-25',
        status: 'PRESENT',
      })
      .expect(403);

    await authedPost(teacherBSession, '/attendance/mark')
      .send({
        classId: String(cls._id),
        studentId: String(studentA._id),
        date: '2026-03-25',
        status: 'PRESENT',
      })
      .expect(403);

    const oldAttendance = await attendanceModel.findOne({
      classId: cls._id,
      studentId: studentA._id,
      date: new Date('2026-03-24T00:00:00.000Z'),
    }).lean() as any;
    const newAttendance = await attendanceModel.findOne({
      classId: cls._id,
      studentId: studentA._id,
      date: new Date('2026-03-25T00:00:00.000Z'),
    }).lean() as any;

    expect(String(oldAttendance.teacherId)).toBe(String(teacherAUser._id));
    expect(newAttendance).toBeNull();

    const storedClass = await classModel.findById(cls._id).lean() as any;
    const storedConfig = storedClass.studentConfigs.find(
      (config: any) => String(config.studentId) === String(studentA._id),
    );

    expect(storedConfig).toBeTruthy();
    expect(String(storedConfig.teacherSlots[storedConfig.teacherSlots.length - 1].teacherId))
      .toBe(String(teacherBUser._id));
  });

  it('applies DIRECTOR edits immediately and clears any pending SALE request', async () => {
    const cls = await classModel.create({
      name: 'Class Direct Manager Edit',
      code: 'CLS-DIRECT-EDIT',
      teacher: directorUser._id,
      sale: saleAUser._id,
      students: [],
      classMode: 'ONLINE',
      pricePerSession: 420000,
      teacherPayPerSession: 220000,
      teacherPayPerStudent: 0,
      baseDuration: 70,
      sessionDuration: 70,
    });

    await authedPatch(saleASession, `/classes/${cls._id}`)
      .send({
        sessionDuration: 80,
      })
      .expect(200);

    const beforeDirectEdit = await classModel.findById(cls._id).lean() as any;
    expect(beforeDirectEdit.pendingSaleUpdate?.status).toBe('PENDING');
    expect(beforeDirectEdit.sessionDuration).toBe(70);

    const directRes = await authedPatch(directorSession, `/classes/${cls._id}`)
      .send({
        sessionDuration: 120,
        baseDuration: 90,
      })
      .expect(200);

    expect(directRes.body.sessionDuration).toBe(120);
    expect(directRes.body.baseDuration).toBe(90);

    const afterDirectEdit = await classModel.findById(cls._id).lean() as any;
    expect(afterDirectEdit.sessionDuration).toBe(120);
    expect(afterDirectEdit.baseDuration).toBe(90);
    expect(afterDirectEdit.pendingSaleUpdate).toBeFalsy();
  });

  it('lets only DIRECTOR approve sale duration changes and applies the new snapshot to future sessions', async () => {
    const studentA = await createStudent({
      studentCode: 'STU-DURATION-A1',
      fullName: 'Student Duration A1',
      parentName: 'Parent Duration A1',
      parentPhone: '0903444444',
      saleUser: saleAUser,
    });

    const cls = await classModel.create({
      name: 'Class Duration Snapshot',
      code: 'CLS-DURATION-SNAPSHOT',
      teacher: directorUser._id,
      sale: saleAUser._id,
      students: [studentA._id],
      classMode: 'ONLINE',
      pricePerSession: 350000,
      teacherPayPerSession: 140000,
      teacherPayPerStudent: 0,
      baseDuration: 70,
      sessionDuration: 70,
      pricingSnapshot: {
        source: 'MANUAL',
        capturedAt: new Date('2026-03-24T08:00:00.000Z'),
        referenceDuration: 70,
        sessionDuration: 70,
        pricePerSession: 350000,
        perMinuteRate: 5000,
        teacherPayPerSession: 140000,
        teacherPayPerStudent: 0,
      },
      durationSnapshots: [
        {
          source: 'INITIAL',
          requestType: 'GENERAL',
          effectiveAt: new Date('2026-03-24T08:00:00.000Z'),
          baseDuration: 70,
          sessionDuration: 70,
          pricePerSession: 350000,
          teacherPayPerSession: 140000,
          teacherPayPerStudent: 0,
        },
      ],
    });

    await ensureAttendanceEligibility({
      student: studentA,
      classroom: cls,
      saleUser: saleAUser,
      sessions: 6,
      amount: 2_100_000,
      referenceDuration: 70,
    });

    const requestRes = await authedPatch(saleASession, `/classes/${cls._id}`)
      .send({
        requestType: 'DURATION_CHANGE',
        sessionDuration: 90,
      })
      .expect(200);

    expect(requestRes.body.pendingApproval).toBe(true);

    await authedPost(opsSession, `/classes/${cls._id}/pending-sale-update/approve`)
      .send({})
      .expect(403);

    const approveRes = await authedPost(directorSession, `/classes/${cls._id}/pending-sale-update/approve`)
      .send({})
      .expect((res) => {
        expect([200, 201]).toContain(res.status);
      });

    expect(approveRes.body.sessionDuration).toBe(90);

    const storedClass = await classModel.findById(cls._id).lean() as any;
    expect(storedClass.pendingSaleUpdate).toBeFalsy();
    expect(storedClass.sessionDuration).toBe(90);
    expect(storedClass.pricingSnapshot?.sessionDuration).toBe(90);
    expect(storedClass.durationSnapshots).toHaveLength(2);
    expect(storedClass.durationSnapshots[1].source).toBe('APPROVED_DURATION_CHANGE');
    expect(storedClass.durationSnapshots[1].requestType).toBe('DURATION_CHANGE');
    expect(storedClass.durationSnapshots[1].sessionDuration).toBe(90);

    await authedPost(directorSession, '/attendance/mark')
      .send({
        classId: String(cls._id),
        studentId: String(studentA._id),
        date: '2026-03-25',
        status: 'PRESENT',
      })
      .expect(201);

    const attendance = await attendanceModel.findOne({
      classId: cls._id,
      studentId: studentA._id,
      date: new Date('2026-03-25T00:00:00.000Z'),
    }).lean() as any;

    expect(attendance?.sessionId).toBeTruthy();

    const createdSession = await sessionModel.findById(attendance.sessionId).lean() as any;
    expect(createdSession).toBeTruthy();
    expect(createdSession.durationMinutes).toBe(90);
    expect(createdSession.amountCharged).toBe(450000);
  });

  it('lets SALE append GV2 and Lan 2 for one student while keeping the same class id', async () => {
    const studentA = await createStudent({
      studentCode: 'STU-STUDENT-CONFIG-A1',
      fullName: 'Student Config A1',
      parentName: 'Parent Config A1',
      parentPhone: '0903555555',
      saleUser: saleAUser,
    });
    const studentB = await createStudent({
      studentCode: 'STU-STUDENT-CONFIG-A2',
      fullName: 'Student Config A2',
      parentName: 'Parent Config A2',
      parentPhone: '0903666666',
      saleUser: saleAUser,
    });

    const cls = await classModel.create({
      name: 'Class Student Config Append',
      code: 'CLS-STUDENT-CONFIG-APPEND',
      teacher: teacherAUser._id,
      sale: saleAUser._id,
      students: [studentA._id, studentB._id],
      classMode: 'ONLINE',
      pricePerSession: 350000,
      teacherPayPerSession: 175000,
      teacherPayPerStudent: 0,
      baseDuration: 70,
      sessionDuration: 70,
      totalSessions: 6,
      pricingSnapshot: {
        source: 'MANUAL',
        capturedAt: new Date('2026-03-24T08:00:00.000Z'),
        referenceDuration: 70,
        sessionDuration: 70,
        pricePerSession: 350000,
        perMinuteRate: 5000,
        teacherPayPerSession: 175000,
        teacherPayPerStudent: 0,
      },
    });

    await ensureAttendanceEligibility({
      student: studentA,
      classroom: cls,
      saleUser: saleAUser,
      sessions: 6,
      amount: 2_100_000,
      paymentDate: '2026-03-24T09:00:00.000Z',
      invoiceNumber: 'INV-STUDENT-CONFIG-A1',
      referenceDuration: 70,
    });
    await ensureAttendanceEligibility({
      student: studentB,
      classroom: cls,
      saleUser: saleAUser,
      sessions: 6,
      amount: 2_100_000,
      paymentDate: '2026-03-24T09:05:00.000Z',
      invoiceNumber: 'INV-STUDENT-CONFIG-A2',
      referenceDuration: 70,
    });

    const updateRes = await authedPatch(
      saleASession,
      `/classes/${cls._id}/students/${studentA._id}/config`,
    )
      .send({
        teacherId: String(teacherBUser._id),
        sessionDuration: 90,
      })
      .expect(200);

    const updatedConfig = (updateRes.body.studentConfigs || []).find(
      (config: any) => String(config.studentId?._id || config.studentId) === String(studentA._id),
    );

    expect(String(updateRes.body._id)).toBe(String(cls._id));
    expect(updatedConfig).toBeTruthy();
    expect(updatedConfig.teacherSlots).toHaveLength(2);
    expect(updatedConfig.durationSlots).toHaveLength(2);
    expect(String(updatedConfig.teacherSlots[1].teacherId?._id || updatedConfig.teacherSlots[1].teacherId))
      .toBe(String(teacherBUser._id));
    expect(updatedConfig.durationSlots[1].slotIndex).toBe(2);
    expect(updatedConfig.durationSlots[1].sessionDuration).toBe(90);
    expect(updatedConfig.durationSlots[1].totalSessions).toBe(4);

    const storedClass = await classModel.findById(cls._id).lean() as any;
    const storedStudentAConfig = storedClass.studentConfigs.find(
      (config: any) => String(config.studentId) === String(studentA._id),
    );
    const storedStudentBConfig = storedClass.studentConfigs.find(
      (config: any) => String(config.studentId) === String(studentB._id),
    );

    expect(storedStudentAConfig.teacherSlots).toHaveLength(2);
    expect(storedStudentAConfig.durationSlots).toHaveLength(2);
    expect(storedStudentBConfig.teacherSlots).toHaveLength(1);
    expect(storedStudentBConfig.durationSlots).toHaveLength(1);

    const studentADate = new Date();
    studentADate.setUTCDate(studentADate.getUTCDate() + 1);
    const studentADateYmd = studentADate.toISOString().slice(0, 10);
    const studentBDate = new Date();
    studentBDate.setUTCDate(studentBDate.getUTCDate() + 2);
    const studentBDateYmd = studentBDate.toISOString().slice(0, 10);

    await authedPost(directorSession, '/attendance/mark')
      .send({
        classId: String(cls._id),
        studentId: String(studentA._id),
        date: studentADateYmd,
        status: 'PRESENT',
      })
      .expect(201);

    await authedPost(directorSession, '/attendance/mark')
      .send({
        classId: String(cls._id),
        studentId: String(studentB._id),
        date: studentBDateYmd,
        status: 'PRESENT',
      })
      .expect(201);

    const attendanceA = await attendanceModel.findOne({
      classId: cls._id,
      studentId: studentA._id,
      date: new Date(`${studentADateYmd}T00:00:00.000Z`),
    }).lean() as any;
    const attendanceB = await attendanceModel.findOne({
      classId: cls._id,
      studentId: studentB._id,
      date: new Date(`${studentBDateYmd}T00:00:00.000Z`),
    }).lean() as any;

    const sessionA = await sessionModel.findById(attendanceA.sessionId).lean() as any;
    const sessionB = await sessionModel.findById(attendanceB.sessionId).lean() as any;

    expect(String(sessionA.teacherId)).toBe(String(teacherAUser._id));
    expect(sessionA.durationMinutes).toBe(70);
    expect(String(sessionB.teacherId)).toBe(String(teacherAUser._id));
    expect(sessionB.durationMinutes).toBe(70);
  });

  it('shows each teacher only the students currently assigned to them after per-student reassignment', async () => {
    const studentA = await createStudent({
      studentCode: 'STU-TEACHER-VIEW-A1',
      fullName: 'Student Teacher View A1',
      parentName: 'Parent Teacher View A1',
      parentPhone: '0903777777',
      saleUser: saleAUser,
    });
    const studentB = await createStudent({
      studentCode: 'STU-TEACHER-VIEW-A2',
      fullName: 'Student Teacher View A2',
      parentName: 'Parent Teacher View A2',
      parentPhone: '0903888888',
      saleUser: saleAUser,
    });

    const cls = await classModel.create({
      name: 'Class Teacher View Split',
      code: 'CLS-TEACHER-VIEW-SPLIT',
      teacher: teacherAUser._id,
      sale: saleAUser._id,
      students: [studentA._id, studentB._id],
      classMode: 'ONLINE',
      pricePerSession: 300000,
      teacherPayPerSession: 150000,
      teacherPayPerStudent: 0,
      baseDuration: 70,
      sessionDuration: 70,
      totalSessions: 10,
    });

    await authedPatch(
      saleASession,
      `/classes/${cls._id}/students/${studentA._id}/config`,
    )
      .send({
        teacherId: String(teacherBUser._id),
      })
      .expect(200);

    const teacherARes = await authedGet(teacherASession, '/attendance/classes-with-students').expect(200);
    const teacherBRes = await authedGet(teacherBSession, '/attendance/classes-with-students').expect(200);

    const teacherAClass = teacherARes.body.find((item: any) => String(item.classId) === String(cls._id));
    const teacherBClass = teacherBRes.body.find((item: any) => String(item.classId) === String(cls._id));

    expect(teacherAClass).toBeTruthy();
    expect(teacherBClass).toBeUndefined();
    expect(teacherAClass.students).toHaveLength(2);
    expect(
      teacherAClass.students.map((item: any) => String(item.studentId)),
    ).toEqual(expect.arrayContaining([String(studentA._id), String(studentB._id)]));
  });

  it('returns only the logged-in sale students in comprehensive report even when a class mixes sales', async () => {
    const studentA = await createStudent({
      studentCode: 'STU-REPORT-A1',
      fullName: 'Student Report A1',
      parentName: 'Parent Report A1',
      parentPhone: '0903111111',
      saleUser: saleAUser,
    });
    const studentB = await createStudent({
      studentCode: 'STU-REPORT-B1',
      fullName: 'Student Report B1',
      parentName: 'Parent Report B1',
      parentPhone: '0903222222',
      saleUser: saleBUser,
    });

    const cls = await classModel.create({
      name: 'Class Mixed Sales Report',
      code: 'CLS-REPORT-MIXED',
      teacher: directorUser._id,
      sale: saleAUser._id,
      students: [studentA._id, studentB._id],
      classMode: 'ONLINE',
      pricePerSession: 500000,
      teacherPayPerSession: 250000,
      teacherPayPerStudent: 0,
      totalSessions: 10,
      sessionsCompleted: 1,
    });

    await attendanceModel.create([
      {
        classId: cls._id,
        studentId: studentA._id,
        teacherId: directorUser._id,
        date: new Date('2026-03-24T00:00:00.000Z'),
        status: 'PRESENT',
        sessionDuration: 70,
        sessionIndex: 1,
        attendedAt: new Date('2026-03-24T01:00:00.000Z'),
      },
      {
        classId: cls._id,
        studentId: studentB._id,
        teacherId: directorUser._id,
        date: new Date('2026-03-24T00:00:00.000Z'),
        status: 'PRESENT',
        sessionDuration: 70,
        sessionIndex: 1,
        attendedAt: new Date('2026-03-24T01:05:00.000Z'),
      },
    ]);

    const saleReport = await authedGet(saleASession, '/students/comprehensive-report').expect(200);
    expect(saleReport.body.rows).toHaveLength(1);
    expect(saleReport.body.rows[0].studentCode).toBe('STU-REPORT-A1');
    expect(String(saleReport.body.rows[0].saleId)).toBe(String(saleAUser._id));

    const directorReport = await authedGet(directorSession, '/students/comprehensive-report').expect(200);
    expect(directorReport.body.rows).toHaveLength(2);
  });

  it('falls back to class sale in comprehensive report when legacy students do not have saleId', async () => {
    const legacyStudent = await studentModel.create({
      studentCode: 'STU-REPORT-LEGACY',
      fullName: 'Student Legacy Report',
      age: 10,
      parentName: 'Parent Legacy Report',
      parentPhone: '0903333333',
      faceImage: 'default-avatar.png',
    });

    const cls = await classModel.create({
      name: 'Class Legacy Sale Report',
      code: 'CLS-REPORT-LEGACY',
      teacher: directorUser._id,
      sale: saleAUser._id,
      students: [legacyStudent._id],
      classMode: 'ONLINE',
      pricePerSession: 450000,
      teacherPayPerSession: 220000,
      teacherPayPerStudent: 0,
      totalSessions: 8,
      sessionsCompleted: 1,
    });

    await attendanceModel.create({
      classId: cls._id,
      studentId: legacyStudent._id,
      teacherId: directorUser._id,
      date: new Date('2026-03-24T00:00:00.000Z'),
      status: 'PRESENT',
      sessionDuration: 70,
      sessionIndex: 1,
      attendedAt: new Date('2026-03-24T01:10:00.000Z'),
    });

    const saleReport = await authedGet(saleASession, '/students/comprehensive-report').expect(200);
    expect(saleReport.body.rows).toHaveLength(1);
    expect(saleReport.body.rows[0].studentCode).toBe('STU-REPORT-LEGACY');
    expect(String(saleReport.body.rows[0].saleId)).toBe(String(saleAUser._id));
  });

  it('shows a sale only the teachers explicitly managed by that sale', async () => {
    await upsertTeacherProfile(teacherAUser, [saleAUser]);
    await upsertTeacherProfile(teacherBUser, [saleBUser]);

    await classModel.create({
      name: 'Class Teacher Scope Leak',
      code: 'CLS-TEACHER-SCOPE',
      teacher: teacherBUser._id,
      sale: saleAUser._id,
      students: [],
      classMode: 'ONLINE',
      status: 'ACTIVE',
      pricePerSession: 250000,
      teacherPayPerSession: 120000,
      teacherPayPerStudent: 0,
    });

    const teachersRes = await authedGet(saleASession, '/teachers').expect(200);
    const teacherIds = teachersRes.body.map((profile: any) =>
      String(profile?.userId?._id || profile?.userId || ''),
    );

    expect(teacherIds).toContain(String(teacherAUser._id));
    expect(teacherIds).not.toContain(String(teacherBUser._id));
  });

  it('only exposes owned offline classes to a sale and blocks assigning into unowned ones', async () => {
    const student = await studentModel.create({
      studentCode: 'STU-OFFLINE-OWN-A1',
      fullName: 'Student Offline Ownership A1',
      age: 10,
      parentName: 'Parent Offline Ownership A1',
      parentPhone: '0903444444',
      faceImage: 'default-avatar.png',
      saleId: saleAUser._id,
      saleName: saleAUser.fullName,
      approvalStatus: 'APPROVED',
    });

    const ownedClass = await classModel.create({
      name: 'Owned Offline Class',
      code: 'CLS-OFFLINE-OWNED',
      teacher: teacherAUser._id,
      sale: saleAUser._id,
      students: [],
      classMode: 'OFFLINE',
      status: 'ACTIVE',
      pricePerSession: 300000,
      teacherPayPerSession: 0,
      teacherPayPerStudent: 150000,
    });

    const unownedClass = await classModel.create({
      name: 'Shared Offline Class',
      code: 'CLS-OFFLINE-UNOWNED',
      teacher: teacherAUser._id,
      students: [],
      classMode: 'OFFLINE',
      status: 'ACTIVE',
      pricePerSession: 300000,
      teacherPayPerSession: 0,
      teacherPayPerStudent: 150000,
    });

    const offlineOptionsRes = await authedGet(saleASession, '/classes/sale-offline-options').expect(200);
    const offlineClassIds = offlineOptionsRes.body.map((item: any) => String(item._id));

    expect(offlineClassIds).toEqual(
      expect.arrayContaining([String(ownedClass._id), String(unownedClass._id)]),
    );

    await authedPost(saleASession, `/classes/${unownedClass._id}/assign-students`)
      .send({
        studentIds: [String(student._id)],
      })
      .expect(403);
  });
});
