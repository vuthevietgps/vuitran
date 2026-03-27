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
  let notificationModel: Model<any>;

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
      notificationModel.deleteMany({}),
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

  async function createParentAccount(params: {
    userCode: string;
    email: string;
    fullName: string;
    phone: string;
    saleUser?: any;
  }) {
    const res = await authedPost(directorSession, '/users')
      .send({
        userCode: params.userCode,
        email: params.email,
        password: 'ParentPass123!',
        fullName: params.fullName,
        role: 'PARENT',
        phone: params.phone,
        ...(params.saleUser ? { saleOwnerId: String(params.saleUser._id) } : {}),
      })
      .expect(201);

    return res.body;
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
    notificationModel = moduleRef.get<Model<any>>(getModelToken('Notification'));

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
    await app.close();
    await mongod.stop();
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

  it('inherits sale owner from linked parent when DIRECTOR creates an order without saleId', async () => {
    const parent = await createParentAccount({
      userCode: 'PH-ORDER-PARENT-001',
      email: 'parent-order-parent-001@school.local',
      fullName: 'Parent Linked Order',
      phone: '0901333001',
      saleUser: saleBUser,
    });

    const res = await authedPost(directorSession, '/orders')
      .send(buildOrderPayload({
        parentName: parent.fullName,
        parentPhone: parent.phone,
        parentEmail: parent.email,
        parentUserId: String(parent._id),
        studentName: 'Student Linked Parent',
      }))
      .expect(201);

    expect(String(res.body.parentUserId)).toBe(String(parent._id));
    expect(String(res.body.saleId)).toBe(String(saleBUser._id));
    expect(res.body.saleName).toBe(saleB.fullName);
  });

  it('inherits linked parent and sale owner from existing student when DIRECTOR creates an order', async () => {
    const parent = await createParentAccount({
      userCode: 'PH-ORDER-STUDENT-001',
      email: 'parent-order-student-001@school.local',
      fullName: 'Parent Existing Student',
      phone: '0901333002',
      saleUser: saleAUser,
    });
    const student = await studentModel.create({
      studentCode: 'STU-ORDER-LINK-001',
      fullName: 'Student Existing Order',
      age: 11,
      grade: 'Lop 6',
      parentUserId: new Types.ObjectId(parent._id),
      parentName: parent.fullName,
      parentPhone: parent.phone,
      faceImage: 'default-avatar.png',
      saleId: saleAUser._id,
      saleName: saleA.fullName,
    });

    const res = await authedPost(directorSession, '/orders')
      .send(buildOrderPayload({
        parentName: parent.fullName,
        parentPhone: parent.phone,
        studentName: student.fullName,
        studentGrade: 'Lop 6',
        existingStudentId: String(student._id),
      }))
      .expect(201);

    expect(String(res.body.parentUserId)).toBe(String(parent._id));
    expect(String(res.body.existingStudentId)).toBe(String(student._id));
    expect(String(res.body.saleId)).toBe(String(saleAUser._id));
    expect(res.body.saleName).toBe(saleA.fullName);
  });

  it('rejects linking an existing student to a different parent account in the same order', async () => {
    const parentA = await createParentAccount({
      userCode: 'PH-ORDER-MISMATCH-001',
      email: 'parent-order-mismatch-001@school.local',
      fullName: 'Parent Student Match A',
      phone: '0901333003',
      saleUser: saleAUser,
    });
    const parentB = await createParentAccount({
      userCode: 'PH-ORDER-MISMATCH-002',
      email: 'parent-order-mismatch-002@school.local',
      fullName: 'Parent Student Match B',
      phone: '0901333004',
      saleUser: saleAUser,
    });
    const student = await studentModel.create({
      studentCode: 'STU-ORDER-MISMATCH-001',
      fullName: 'Student Parent Mismatch',
      age: 10,
      parentUserId: new Types.ObjectId(parentA._id),
      parentName: parentA.fullName,
      parentPhone: parentA.phone,
      faceImage: 'default-avatar.png',
      saleId: saleAUser._id,
      saleName: saleA.fullName,
    });

    const res = await authedPost(directorSession, '/orders')
      .send(buildOrderPayload({
        parentName: parentB.fullName,
        parentPhone: parentB.phone,
        parentUserId: String(parentB._id),
        studentName: student.fullName,
        existingStudentId: String(student._id),
      }))
      .expect(400);

    expect(String(res.body.message)).toContain('phu huynh khac');
  });

  it('allows DIRECTOR to unlink parent and student references while keeping the current sale owner', async () => {
    const parent = await createParentAccount({
      userCode: 'PH-ORDER-UNLINK-001',
      email: 'parent-order-unlink-001@school.local',
      fullName: 'Parent Order Unlink',
      phone: '0901333005',
      saleUser: saleAUser,
    });
    const student = await studentModel.create({
      studentCode: 'STU-ORDER-UNLINK-001',
      fullName: 'Student Order Unlink',
      age: 12,
      grade: 'Lop 7',
      parentUserId: new Types.ObjectId(parent._id),
      parentName: parent.fullName,
      parentPhone: parent.phone,
      faceImage: 'default-avatar.png',
      saleId: saleAUser._id,
      saleName: saleA.fullName,
    });

    const orderRes = await authedPost(directorSession, '/orders')
      .send(buildOrderPayload({
        parentName: parent.fullName,
        parentPhone: parent.phone,
        parentUserId: String(parent._id),
        studentName: student.fullName,
        studentGrade: 'Lop 7',
        existingStudentId: String(student._id),
      }))
      .expect(201);

    const updateRes = await authedPatch(directorSession, `/orders/${orderRes.body._id}`)
      .send({
        parentName: 'Parent Manual Order',
        parentPhone: '0901333999',
        studentName: 'Student Manual Order',
        studentGrade: 'Lop 8',
        parentUserId: '',
        existingStudentId: '',
        saleId: String(saleAUser._id),
      })
      .expect(200);

    expect(updateRes.body.parentUserId ?? null).toBeNull();
    expect(updateRes.body.existingStudentId ?? null).toBeNull();
    expect(String(updateRes.body.saleId)).toBe(String(saleAUser._id));

    const stored = await orderModel.findById(orderRes.body._id).lean() as any;
    expect(stored).toBeTruthy();
    expect(stored.parentUserId ?? null).toBeNull();
    expect(stored.existingStudentId ?? null).toBeNull();
    expect(String(stored.saleId)).toBe(String(saleAUser._id));
  });

  it('stores handoff summary on completed order and notifies sale, parent, and preferred teacher', async () => {
    const parent = await createParentAccount({
      userCode: 'PH-ORDER-HANDOFF-001',
      email: 'parent-order-handoff-001@school.local',
      fullName: 'Parent Handoff Order',
      phone: '0901333006',
      saleUser: saleAUser,
    });
    const parentSession = await loginAndGetSession(parent.email, 'ParentPass123!');

    const orderRes = await authedPost(saleASession, '/orders')
      .send(buildOrderPayload({
        parentName: parent.fullName,
        parentPhone: parent.phone,
        parentEmail: parent.email,
        parentUserId: String(parent._id),
        studentName: 'Student Handoff Order',
        items: [
          {
            productId: new Types.ObjectId().toString(),
            productName: 'Combo Handoff',
            sessions: 12,
            sessionDuration: 90,
            pricePerSession: 100000,
            amount: 1200000,
            preferredTeacherId: String(teacherAUser._id),
            preferredSchedule: 'Thu 2 18:00',
          },
        ],
      }))
      .expect(201);

    await authedPost(saleASession, `/orders/${orderRes.body._id}/submit`)
      .send({})
      .expect((res) => {
        expect([200, 201]).toContain(res.status);
      });

    const approveRes = await authedPost(directorSession, `/orders/${orderRes.body._id}/approve`)
      .send({})
      .expect((res) => {
        expect([200, 201]).toContain(res.status);
      });

    const summary = approveRes.body.order?.processedResults?.communicationSummary;
    expect(summary).toBeTruthy();
    expect(String(summary.saleMessage)).toContain(orderRes.body.orderCode);
    expect(String(summary.saleMessage)).toContain(parent.email);
    expect(String(summary.parentMessage)).toContain('Student Handoff Order');
    expect(String(summary.teacherMessage)).toContain('Thu 2 18:00');
    expect(String(summary.parentRecipientId)).toBe(String(parent._id));
    expect((summary.teacherRecipientIds || []).map((id: any) => String(id))).toContain(String(teacherAUser._id));

    const storedOrder = await orderModel.findById(orderRes.body._id).lean() as any;
    expect(storedOrder.processedResults?.communicationSummary?.saleMessage).toContain(orderRes.body.orderCode);

    const saleNotifications = await authedGet(saleASession, '/notifications?limit=20').expect(200);
    expect(
      saleNotifications.body.data.some(
        (notification: any) =>
          notification.targetId === orderRes.body._id
          && String(notification.link || '').includes(orderRes.body._id),
      ),
    ).toBe(true);

    const parentNotifications = await authedGet(parentSession, '/notifications?limit=20').expect(200);
    expect(
      parentNotifications.body.data.some(
        (notification: any) =>
          notification.targetId === orderRes.body._id
          && String(notification.title || '').includes('Ho so hoc tap'),
      ),
    ).toBe(true);

    const teacherNotifications = await authedGet(teacherASession, '/notifications?limit=20').expect(200);
    expect(
      teacherNotifications.body.data.some(
        (notification: any) =>
          notification.targetId === orderRes.body._id
          && String(notification.message || '').includes('Thu 2 18:00'),
      ),
    ).toBe(true);
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

  it('applies non-sensitive SALE class edits immediately while storing duration changes as pending updates', async () => {
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
        name: 'Class Pending Approval Updated',
        pricePerSession: 550000,
        sessionDuration: 90,
      })
      .expect(200);

    expect(requestRes.body.pendingApproval).toBe(true);

    const stored = await classModel.findById(cls._id).lean() as any;
    expect(stored.name).toBe('Class Pending Approval Updated');
    expect(stored.pricePerSession).toBe(550000);
    expect(stored.sessionDuration).toBe(70);
    expect(stored.pendingSaleUpdate?.status).toBe('PENDING');
    expect(stored.pendingSaleUpdate?.requestType).toBe('DURATION_CHANGE');
    expect(stored.pendingSaleUpdate?.requestedChanges?.name).toBeUndefined();
    expect(stored.pendingSaleUpdate?.requestedChanges?.pricePerSession).toBeUndefined();
    expect(stored.pendingSaleUpdate?.requestedChanges?.sessionDuration).toBe(90);

    const pendingListRes = await authedGet(opsSession, '/pending-approvals/classes').expect(200);
    expect(Array.isArray(pendingListRes.body)).toBe(true);
    expect(
      pendingListRes.body.some((item: any) => String(item._id) === String(cls._id)),
    ).toBe(true);
  });

  it('keeps class code stable for sale teacher changes and only lets the new teacher take later attendance after approval', async () => {
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

    const beforeChangeAttendance = await authedPost(teacherASession, '/attendance/mark')
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
    expect(String(pendingStored.teacher)).toBe(String(teacherAUser._id));
    expect(pendingStored.teacherPayPerSession).toBe(180000);
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
      .expect(201);

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
    expect(String(newAttendance.teacherId)).toBe(String(teacherBUser._id));

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

  it('lets OPS approve sale duration changes and only applies the new snapshot to future sessions', async () => {
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

    await authedPost(directorSession, '/attendance/mark')
      .send({
        classId: String(cls._id),
        studentId: String(studentA._id),
        date: '2026-03-24',
        status: 'PRESENT',
      })
      .expect(201);

    const requestRes = await authedPatch(saleASession, `/classes/${cls._id}`)
      .send({
        requestType: 'DURATION_CHANGE',
        sessionDuration: 90,
      })
      .expect(200);

    expect(requestRes.body.pendingApproval).toBe(true);

    const approveRes = await authedPost(opsSession, `/classes/${cls._id}/pending-sale-update/approve`)
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

    const oldAttendance = await attendanceModel.findOne({
      classId: cls._id,
      studentId: studentA._id,
      date: new Date('2026-03-24T00:00:00.000Z'),
    }).lean() as any;
    expect(oldAttendance?.sessionId).toBeTruthy();

    const oldSession = await sessionModel.findById(oldAttendance.sessionId).lean() as any;
    expect(oldSession).toBeTruthy();
    expect(oldSession.durationMinutes).toBe(70);
    expect(oldSession.amountCharged).toBe(350000);

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

    await invoiceModel.create({
      invoiceNumber: 'INV-STUDENT-CONFIG-A1',
      studentId: studentA._id,
      classId: cls._id,
      saleId: saleAUser._id,
      invoiceType: 'TUITION',
      classType: 'ONLINE',
      sessions: 6,
      bonusSessions: 0,
      pricePerSession: 350000,
      referenceDuration: 70,
      perMinuteRate: 5000,
      sessionsRemaining: 6,
      bonusSessionsRemaining: 0,
      amount: 2100000,
      paymentDate: new Date('2026-03-24T09:00:00.000Z'),
      createdBy: directorUser._id,
      status: 'APPROVED',
      walletTopUpDone: true,
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
    expect(updatedConfig.durationSlots[1].totalSessions).toBeCloseTo(4.67, 2);

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

    await authedPost(directorSession, '/attendance/mark')
      .send({
        classId: String(cls._id),
        studentId: String(studentA._id),
        date: '2026-03-26',
        status: 'PRESENT',
      })
      .expect(201);

    await authedPost(directorSession, '/attendance/mark')
      .send({
        classId: String(cls._id),
        studentId: String(studentB._id),
        date: '2026-03-27',
        status: 'PRESENT',
      })
      .expect(201);

    const attendanceA = await attendanceModel.findOne({
      classId: cls._id,
      studentId: studentA._id,
      date: new Date('2026-03-26T00:00:00.000Z'),
    }).lean() as any;
    const attendanceB = await attendanceModel.findOne({
      classId: cls._id,
      studentId: studentB._id,
      date: new Date('2026-03-27T00:00:00.000Z'),
    }).lean() as any;

    const sessionA = await sessionModel.findById(attendanceA.sessionId).lean() as any;
    const sessionB = await sessionModel.findById(attendanceB.sessionId).lean() as any;

    expect(String(sessionA.teacherId)).toBe(String(teacherBUser._id));
    expect(sessionA.durationMinutes).toBe(90);
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
    expect(teacherBClass).toBeTruthy();
    expect(teacherAClass.students).toHaveLength(1);
    expect(teacherBClass.students).toHaveLength(1);
    expect(String(teacherAClass.students[0].studentId)).toBe(String(studentB._id));
    expect(String(teacherBClass.students[0].studentId)).toBe(String(studentA._id));
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
});
