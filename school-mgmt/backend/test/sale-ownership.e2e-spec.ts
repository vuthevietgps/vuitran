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
  role: 'DIRECTOR' | 'OPS' | 'ACCOUNTING' | 'SALE';
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

  let directorUser: any;
  let opsUser: any;
  let accountingUser: any;
  let saleAUser: any;
  let saleBUser: any;

  let directorSession: SessionCookies;
  let opsSession: SessionCookies;
  let accountingSession: SessionCookies;
  let saleASession: SessionCookies;
  let saleBSession: SessionCookies;

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

    directorUser = await upsertUser(director);
    opsUser = await upsertUser(ops);
    accountingUser = await upsertUser(accounting);
    saleAUser = await upsertUser(saleA);
    saleBUser = await upsertUser(saleB);

    directorSession = await loginAndGetSession(director.email, director.password);
    opsSession = await loginAndGetSession(ops.email, ops.password);
    accountingSession = await loginAndGetSession(accounting.email, accounting.password);
    saleASession = await loginAndGetSession(saleA.email, saleA.password);
    saleBSession = await loginAndGetSession(saleB.email, saleB.password);
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
});
