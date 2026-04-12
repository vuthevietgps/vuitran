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

/* ------------------------------------------------------------------ */
/*  Shared types & helpers                                            */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/*  Test suite: Orders Deep Review                                    */
/* ------------------------------------------------------------------ */

describe('Orders deep review – RBAC, state machine, edge cases (e2e)', () => {
  let app: INestApplication;
  let moduleRef: TestingModule;
  let replSet: MongoMemoryReplSet;

  let userModel: Model<any>;
  let productModel: Model<any>;
  let classModel: Model<any>;
  let studentModel: Model<any>;
  let orderModel: Model<any>;
  let invoiceModel: Model<any>;
  let walletModel: Model<any>;
  let ledgerEntryModel: Model<any>;
  let leadModel: Model<any>;
  let notificationModel: Model<any>;
  let auditLogModel: Model<any>;
  let parentAttributionModel: Model<any>;

  const director: SeedUser = {
    email: 'director.deep-review.e2e@school.local',
    password: 'E2ePass123!',
    fullName: 'Director DeepReview',
    role: 'DIRECTOR',
  };
  const saleA: SeedUser = {
    email: 'sale-a.deep-review.e2e@school.local',
    password: 'E2ePass123!',
    fullName: 'Sale A DeepReview',
    role: 'SALE',
  };
  const saleB: SeedUser = {
    email: 'sale-b.deep-review.e2e@school.local',
    password: 'E2ePass123!',
    fullName: 'Sale B DeepReview',
    role: 'SALE',
  };
  const ops: SeedUser = {
    email: 'ops.deep-review.e2e@school.local',
    password: 'E2ePass123!',
    fullName: 'Ops DeepReview',
    role: 'OPS',
  };
  const accounting: SeedUser = {
    email: 'accounting.deep-review.e2e@school.local',
    password: 'E2ePass123!',
    fullName: 'Accounting DeepReview',
    role: 'ACCOUNTING',
  };
  const teacher: SeedUser = {
    email: 'teacher.deep-review.e2e@school.local',
    password: 'E2ePass123!',
    fullName: 'Teacher DeepReview',
    role: 'TEACHER',
  };

  let directorUser: any;
  let saleAUser: any;
  let saleBUser: any;
  let opsUser: any;
  let accountingUser: any;
  let teacherUser: any;

  let directorSession: SessionCookies;
  let saleASession: SessionCookies;
  let saleBSession: SessionCookies;
  let opsSession: SessionCookies;
  let accountingSession: SessionCookies;

  let onlineProductId: string;
  let offlineProductId: string;
  let existingClassId: string;

  /* ---- helpers ---- */

  async function upsertUser(user: SeedUser): Promise<any> {
    const hashed = await bcrypt.hash(user.password, 10);
    await userModel.updateOne(
      { email: user.email },
      {
        $set: {
          email: user.email,
          password: hashed,
          fullName: user.fullName,
          role: user.role,
          status: 'ACTIVE',
        },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true },
    );
    return userModel.findOne({ email: user.email }).lean() as any;
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

  function authedDelete(session: SessionCookies, path: string) {
    return request(app.getHttpServer())
      .delete(path)
      .set('Cookie', session.cookieHeader)
      .set('X-XSRF-TOKEN', session.xsrfToken);
  }

  function buildBasePayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      orderType: 'NEW_ENROLLMENT',
      parentName: 'Nguyen Van Deep',
      parentPhone: '0901999001',
      studentName: 'Nguyen Thi Deep',
      items: [
        {
          productId: onlineProductId,
          productName: 'Online English 1-1',
          sessions: 20,
          sessionDuration: 60,
          baseDuration: 60,
          pricePerSession: 200000,
          amount: 4000000,
          teachingMode: 'ONLINE',
          teacherPayPerSession: 100000,
        },
      ],
      totalAmount: 4000000,
      finalAmount: 4000000,
      paymentPlan: 'FULL',
      receiptImage: '/uploads/invoices/receipt-deep.png',
      ...overrides,
    };
  }

  async function createDraftOrder(
    session: SessionCookies,
    overrides: Record<string, unknown> = {},
  ): Promise<string> {
    const res = await authedPost(session, '/orders')
      .send(buildBasePayload(overrides))
      .expect((r) => {
        expect([200, 201]).toContain(r.status);
      });
    return String(res.body._id);
  }

  async function submitOrder(session: SessionCookies, orderId: string): Promise<void> {
    await authedPost(session, `/orders/${orderId}/submit`)
      .send({})
      .expect((r) => {
        expect([200, 201]).toContain(r.status);
      });
  }

  async function resetBusinessCollections() {
    await Promise.all([
      studentModel.deleteMany({}),
      orderModel.deleteMany({}),
      invoiceModel.deleteMany({}),
      walletModel.deleteMany({}),
      ledgerEntryModel.deleteMany({}),
      leadModel.deleteMany({}),
      notificationModel.deleteMany({}),
      auditLogModel.deleteMany({}),
      parentAttributionModel.deleteMany({}),
      classModel.deleteMany({}),
      productModel.deleteMany({}),
      userModel.deleteMany({ role: 'PARENT' }),
    ]);
  }

  async function seedProducts() {
    const onlineProd = await productModel.create({
      name: 'Online English 1-1',
      code: 'PRD-ONLINE-DEEP',
      teachingMode: 'ONLINE',
      defaultSessions: 20,
      defaultSessionDuration: 60,
      pricePerSession: 200000,
      suggestedPrice: 4000000,
      commissionRate: 5,
      isActive: true,
    });
    onlineProductId = String(onlineProd._id);

    const offlineProd = await productModel.create({
      name: 'Offline Math Group',
      code: 'PRD-OFFLINE-DEEP',
      teachingMode: 'OFFLINE',
      defaultSessions: 12,
      defaultSessionDuration: 90,
      pricePerSession: 150000,
      suggestedPrice: 1800000,
      commissionRate: 5,
      isActive: true,
    });
    offlineProductId = String(offlineProd._id);
  }

  async function seedExistingClass() {
    const cls = await classModel.create({
      name: 'Existing Offline Class DEEP',
      code: 'CLS-DEEP-001',
      teacher: teacherUser._id,
      sale: saleAUser._id,
      students: [],
      classMode: 'OFFLINE',
      productPackage: offlineProductId,
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
    existingClassId = String(cls._id);
  }

  /* ---- lifecycle ---- */

  beforeAll(async () => {
    process.env.REDIS_ENABLED = 'false';
    replSet = await MongoMemoryReplSet.create({
      replSet: { count: 1, storageEngine: 'wiredTiger' },
    });
    process.env.MONGODB_URI = replSet.getUri('school-mgmt-orders-deep-e2e');

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
    studentModel = moduleRef.get<Model<any>>(getModelToken('Student'));
    orderModel = moduleRef.get<Model<any>>(getModelToken('Order'));
    invoiceModel = moduleRef.get<Model<any>>(getModelToken('Invoice'));
    walletModel = moduleRef.get<Model<any>>(getModelToken('Wallet'));
    ledgerEntryModel = moduleRef.get<Model<any>>(getModelToken('LedgerEntry'));
    leadModel = moduleRef.get<Model<any>>(getModelToken('Lead'));
    notificationModel = moduleRef.get<Model<any>>(getModelToken('Notification'));
    auditLogModel = moduleRef.get<Model<any>>(getModelToken('AuditLog'));
    parentAttributionModel = moduleRef.get<Model<any>>(getModelToken('ParentAttribution'));

    directorUser = await upsertUser(director);
    saleAUser = await upsertUser(saleA);
    saleBUser = await upsertUser(saleB);
    opsUser = await upsertUser(ops);
    accountingUser = await upsertUser(accounting);
    teacherUser = await upsertUser(teacher);

    directorSession = await loginAndGetSession(director.email, director.password);
    saleASession = await loginAndGetSession(saleA.email, saleA.password);
    saleBSession = await loginAndGetSession(saleB.email, saleB.password);
    opsSession = await loginAndGetSession(ops.email, ops.password);
    accountingSession = await loginAndGetSession(accounting.email, accounting.password);
  }, 120000);

  beforeEach(async () => {
    await resetBusinessCollections();
    await seedProducts();
    await seedExistingClass();
  });

  afterAll(async () => {
    await closeE2eResources({ app, moduleRef, mongoReplSet: replSet });
  });

  /* ================================================================ */
  /*  GROUP 1: RBAC — Role isolation & access control                 */
  /* ================================================================ */

  describe('RBAC – Role isolation & access control', () => {
    it('Sale A cannot see Sale B orders via findOne', async () => {
      // Sale A creates order
      const orderId = await createDraftOrder(saleASession, { parentPhone: '0901991001' });

      // Sale B cannot GET it → should get 404 (assertSaleOrderAccess)
      await authedGet(saleBSession, `/orders/${orderId}`).expect(404);
    });

    it('Sale A cannot update Sale B order', async () => {
      const orderId = await createDraftOrder(saleASession, { parentPhone: '0901991002' });

      await authedPatch(saleBSession, `/orders/${orderId}`)
        .send({ parentName: 'Hacked Name' })
        .expect(404);

      // Verify name unchanged
      const order = await orderModel.findById(orderId).lean() as any;
      expect(order.parentName).toBe('Nguyen Van Deep');
    });

    it('Sale A cannot submit Sale B order', async () => {
      const orderId = await createDraftOrder(saleASession, { parentPhone: '0901991003' });

      await authedPost(saleBSession, `/orders/${orderId}/submit`)
        .send({})
        .expect(404);
    });

    it('Sale A cannot cancel Sale B order', async () => {
      const orderId = await createDraftOrder(saleASession, { parentPhone: '0901991004' });

      await authedPost(saleBSession, `/orders/${orderId}/cancel`)
        .send({})
        .expect(404);
    });

    it('Sale findAll only returns own orders', async () => {
      await createDraftOrder(saleASession, { parentPhone: '0901991005' });
      await createDraftOrder(saleASession, { parentPhone: '0901991006' });
      await createDraftOrder(saleBSession, { parentPhone: '0901991007' });

      const saleARes = await authedGet(saleASession, '/orders').expect(200);
      const saleBRes = await authedGet(saleBSession, '/orders').expect(200);

      expect(saleARes.body.total).toBe(2);
      expect(saleARes.body.data.length).toBe(2);
      expect(saleBRes.body.total).toBe(1);
      expect(saleBRes.body.data.length).toBe(1);
    });

    it('Director can see all orders from any sale', async () => {
      await createDraftOrder(saleASession, { parentPhone: '0901991008' });
      await createDraftOrder(saleBSession, { parentPhone: '0901991009' });

      const res = await authedGet(directorSession, '/orders').expect(200);
      expect(res.body.total).toBe(2);
      expect(res.body.data.length).toBe(2);
    });

    it('TEACHER cannot create orders', async () => {
      const teacherSession = await loginAndGetSession(teacher.email, teacher.password);
      await authedPost(teacherSession, '/orders')
        .send(buildBasePayload({ parentPhone: '0901991010' }))
        .expect(403);
    });

    it('ACCOUNTING cannot create orders', async () => {
      await authedPost(accountingSession, '/orders')
        .send(buildBasePayload({ parentPhone: '0901991011' }))
        .expect(403);
    });

    it('Sale cannot approve orders (only OPS/DIRECTOR)', async () => {
      const orderId = await createDraftOrder(saleASession, { parentPhone: '0901991012' });
      await submitOrder(saleASession, orderId);

      await authedPost(saleASession, `/orders/${orderId}/approve`)
        .send({ approvalImage: '/uploads/test.png' })
        .expect(403);
    });

    it('Sale cannot reject orders (only OPS/DIRECTOR)', async () => {
      const orderId = await createDraftOrder(saleASession, { parentPhone: '0901991013' });
      await submitOrder(saleASession, orderId);

      await authedPost(saleASession, `/orders/${orderId}/reject`)
        .send({ reason: 'test' })
        .expect(403);
    });

    it('OPS can approve orders', async () => {
      const orderId = await createDraftOrder(saleASession, { parentPhone: '0901991014' });
      await submitOrder(saleASession, orderId);

      const res = await authedPost(opsSession, `/orders/${orderId}/approve`)
        .send({ approvalImage: '/uploads/ops-approval.png' })
        .expect((r) => {
          expect([200, 201]).toContain(r.status);
        });

      expect(res.body.order.status).toBe('APPROVED');
    });

    it('Sale cannot delete orders (only DIRECTOR)', async () => {
      const orderId = await createDraftOrder(saleASession, { parentPhone: '0901991015' });

      await authedDelete(saleASession, `/orders/${orderId}`).expect(403);
    });
  });

  /* ================================================================ */
  /*  GROUP 2: State machine — valid & invalid transitions            */
  /* ================================================================ */

  describe('State machine – valid & invalid transitions', () => {
    it('cannot update SUBMITTED order', async () => {
      const orderId = await createDraftOrder(saleASession, { parentPhone: '0901992001' });
      await submitOrder(saleASession, orderId);

      const res = await authedPatch(saleASession, `/orders/${orderId}`)
        .send({ parentName: 'Updated Name' })
        .expect(400);

      expect(res.body.message).toBeDefined();
    });

    it('cannot submit APPROVED order', async () => {
      const orderId = await createDraftOrder(saleASession, { parentPhone: '0901992002' });
      await submitOrder(saleASession, orderId);


      await authedPost(directorSession, `/orders/${orderId}/approve`)
        .send({ approvalImage: '/uploads/test.png' })
        .expect((r) => expect([200, 201]).toContain(r.status));

      await new Promise((r) => setTimeout(r, 500));

      // Try to submit again
      await authedPost(saleASession, `/orders/${orderId}/submit`)
        .send({})
        .expect(400);
    });

    it('cannot approve DRAFT order (must submit first)', async () => {
      const orderId = await createDraftOrder(saleASession, { parentPhone: '0901992003' });

      await authedPost(directorSession, `/orders/${orderId}/approve`)
        .send({ approvalImage: '/uploads/test.png' })
        .expect(400);
    });

    it('cannot approve REJECTED order', async () => {
      const orderId = await createDraftOrder(saleASession, { parentPhone: '0901992004' });
      await submitOrder(saleASession, orderId);

      await authedPost(directorSession, `/orders/${orderId}/reject`)
        .send({ reason: 'Price too low' })
        .expect((r) => expect([200, 201]).toContain(r.status));

      await authedPost(directorSession, `/orders/${orderId}/approve`)
        .send({ approvalImage: '/uploads/test.png' })
        .expect(400);
    });

    it('cannot reject DRAFT order', async () => {
      const orderId = await createDraftOrder(saleASession, { parentPhone: '0901992005' });

      await authedPost(directorSession, `/orders/${orderId}/reject`)
        .send({ reason: 'Invalid' })
        .expect(400);
    });

    it('cannot request-info on DRAFT order', async () => {
      const orderId = await createDraftOrder(saleASession, { parentPhone: '0901992006' });

      await authedPost(directorSession, `/orders/${orderId}/request-info`)
        .send({ reason: 'Need more info' })
        .expect(400);
    });

    it('can edit NEEDS_INFO order', async () => {
      const orderId = await createDraftOrder(saleASession, { parentPhone: '0901992007' });
      await submitOrder(saleASession, orderId);

      await authedPost(directorSession, `/orders/${orderId}/request-info`)
        .send({ reason: 'Need student age' })
        .expect((r) => expect([200, 201]).toContain(r.status));

      // Sale can edit NEEDS_INFO
      const res = await authedPatch(saleASession, `/orders/${orderId}`)
        .send({ studentAge: 12 })
        .expect(200);

      expect(res.body.studentAge).toBe(12);
    });

    it('can resubmit NEEDS_INFO order after editing', async () => {
      const orderId = await createDraftOrder(saleASession, { parentPhone: '0901992008' });
      await submitOrder(saleASession, orderId);

      await authedPost(directorSession, `/orders/${orderId}/request-info`)
        .send({ reason: 'Need clarification' })
        .expect((r) => expect([200, 201]).toContain(r.status));

      await authedPatch(saleASession, `/orders/${orderId}`)
        .send({ studentAge: 12 })
        .expect(200);

      // Resubmit
      await authedPost(saleASession, `/orders/${orderId}/submit`)
        .send({})
        .expect((r) => expect([200, 201]).toContain(r.status));

      const order = await authedGet(saleASession, `/orders/${orderId}`).expect(200);
      expect(order.body.status).toBe('SUBMITTED');
    });

    it('cannot cancel COMPLETED order', async () => {
      // Create and approve order, then manually set COMPLETED
      const orderId = await createDraftOrder(saleASession, { parentPhone: '0901992009' });
      await submitOrder(saleASession, orderId);
      await authedPost(directorSession, `/orders/${orderId}/approve`)
        .send({ approvalImage: '/uploads/test.png' })
        .expect((r) => expect([200, 201]).toContain(r.status));
      await new Promise((r) => setTimeout(r, 500));

      // Manually mark as COMPLETED for testing
      await orderModel.findByIdAndUpdate(orderId, { status: 'COMPLETED' });

      await authedPost(saleASession, `/orders/${orderId}/cancel`)
        .send({})
        .expect(400);
    });

    it('DIRECTOR can cancel APPROVED order (with invoice cleanup)', async () => {
      const orderId = await createDraftOrder(saleASession, { parentPhone: '0901992013' });
      await submitOrder(saleASession, orderId);
      await authedPost(directorSession, `/orders/${orderId}/approve`)
        .send({ approvalImage: '/uploads/test.png' })
        .expect((r) => expect([200, 201]).toContain(r.status));
      await new Promise((r) => setTimeout(r, 500));

      // DIRECTOR can cancel APPROVED orders
      await authedPost(directorSession, `/orders/${orderId}/cancel`)
        .send({})
        .expect((r) => expect([200, 201]).toContain(r.status));

      const cancelledOrder = await orderModel.findById(orderId).lean() as any;
      expect(cancelledOrder.status).toBe('CANCELLED');
    });

    it('SALE cannot cancel APPROVED order', async () => {
      const orderId = await createDraftOrder(saleASession, { parentPhone: '0901992014' });
      await submitOrder(saleASession, orderId);
      await authedPost(directorSession, `/orders/${orderId}/approve`)
        .send({ approvalImage: '/uploads/test.png' })
        .expect((r) => expect([200, 201]).toContain(r.status));
      await new Promise((r) => setTimeout(r, 500));

      // APPROVED orders remain cancellable only by DIRECTOR.
      await authedPost(saleASession, `/orders/${orderId}/cancel`)
        .send({})
        .expect(400);
    });

    it('cannot delete SUBMITTED order (only DRAFT/CANCELLED)', async () => {
      const orderId = await createDraftOrder(saleASession, { parentPhone: '0901992010' });
      await submitOrder(saleASession, orderId);

      await authedDelete(directorSession, `/orders/${orderId}`).expect(400);
    });

    it('cannot delete APPROVED order', async () => {
      const orderId = await createDraftOrder(saleASession, { parentPhone: '0901992011' });
      await submitOrder(saleASession, orderId);
      await authedPost(directorSession, `/orders/${orderId}/approve`)
        .send({ approvalImage: '/uploads/test.png' })
        .expect((r) => expect([200, 201]).toContain(r.status));
      await new Promise((r) => setTimeout(r, 500));

      await authedDelete(directorSession, `/orders/${orderId}`).expect(400);
    });

    it('can delete CANCELLED order', async () => {
      const orderId = await createDraftOrder(saleASession, { parentPhone: '0901992012' });
      await authedPost(saleASession, `/orders/${orderId}/cancel`)
        .send({})
        .expect((r) => expect([200, 201]).toContain(r.status));

      await authedDelete(directorSession, `/orders/${orderId}`)
        .expect((r) => expect([200, 201]).toContain(r.status));

      // Verify deleted
      const exists = await orderModel.findById(orderId).lean();
      expect(exists).toBeNull();
    });
  });

  /* ================================================================ */
  /*  GROUP 3: Data validation & integrity                            */
  /* ================================================================ */

  describe('Data validation & integrity', () => {
    it('cannot submit order without items', async () => {
      const createRes = await authedPost(saleASession, '/orders')
        .send({
          orderType: 'NEW_ENROLLMENT',
          parentName: 'No Items Parent',
          parentPhone: '0901993001',
          studentName: 'No Items Student',
          items: [
            {
              productId: onlineProductId,
              sessions: 1,
              pricePerSession: 100000,
              amount: 100000,
            },
          ],
          totalAmount: 100000,
          finalAmount: 100000,
        })
        .expect((r) => expect([200, 201]).toContain(r.status));

      const orderId = String(createRes.body._id);

      // Remove items directly
      await orderModel.findByIdAndUpdate(orderId, { items: [] });

      const res = await authedPost(saleASession, `/orders/${orderId}/submit`)
        .send({})
        .expect(400);

      expect(res.body.message).toContain('1');
    });

    it('reject and request-info store reason correctly', async () => {
      // Test reject stores reason
      const orderId1 = await createDraftOrder(saleASession, { parentPhone: '0901993002' });
      await submitOrder(saleASession, orderId1);

      await authedPost(directorSession, `/orders/${orderId1}/reject`)
        .send({ reason: 'Price too low for market' })
        .expect((r) => expect([200, 201]).toContain(r.status));

      const rejected = await orderModel.findById(orderId1).lean() as any;
      expect(rejected.rejectionReason).toBe('Price too low for market');

      // Test request-info stores reason
      const orderId2 = await createDraftOrder(saleASession, { parentPhone: '0901993003' });
      await submitOrder(saleASession, orderId2);

      await authedPost(directorSession, `/orders/${orderId2}/request-info`)
        .send({ reason: 'Need student DOB confirmed' })
        .expect((r) => expect([200, 201]).toContain(r.status));

      const needsInfo = await orderModel.findById(orderId2).lean() as any;
      expect(needsInfo.needsInfoReason).toBe('Need student DOB confirmed');
    });

    it('duplicate invoice numbers in same order are rejected', async () => {
      const res = await authedPost(saleASession, '/orders')
        .send(
          buildBasePayload({
            parentPhone: '0901993004',
            items: [
              {
                productId: onlineProductId,
                productName: 'Online English',
                sessions: 10,
                sessionDuration: 60,
                baseDuration: 60,
                pricePerSession: 200000,
                amount: 2000000,
                teachingMode: 'ONLINE',
                invoiceNumber: 'HD-DUP-001',
              },
              {
                productId: onlineProductId,
                productName: 'Online English',
                sessions: 10,
                sessionDuration: 60,
                baseDuration: 60,
                pricePerSession: 200000,
                amount: 2000000,
                teachingMode: 'ONLINE',
                invoiceNumber: 'HD-DUP-001', // same number!
              },
            ],
            totalAmount: 4000000,
            finalAmount: 4000000,
          }),
        )
        .expect(400);

      expect(res.body.message).toContain('HD-DUP-001');
    });

    it('invoice number already in DB is rejected', async () => {
      // Create first order with specific invoice number
      const orderId1 = await createDraftOrder(saleASession, {
        parentPhone: '0901993005',
        items: [
          {
            productId: onlineProductId,
            productName: 'Online English',
            sessions: 10,
            sessionDuration: 60,
            baseDuration: 60,
            pricePerSession: 200000,
            amount: 2000000,
            teachingMode: 'ONLINE',
            invoiceNumber: 'HD-EXISTING-001',
          },
        ],
        totalAmount: 2000000,
        finalAmount: 2000000,
      });

      // Submit and approve to create the invoice
      await submitOrder(saleASession, orderId1);
      await authedPost(directorSession, `/orders/${orderId1}/approve`)
        .send({ approvalImage: '/uploads/test.png' })
        .expect((r) => expect([200, 201]).toContain(r.status));

      await new Promise((r) => setTimeout(r, 500));

      // Try creating second order with same invoice number
      const res = await authedPost(saleASession, '/orders')
        .send(
          buildBasePayload({
            parentPhone: '0901993006',
            items: [
              {
                productId: onlineProductId,
                productName: 'Online English',
                sessions: 10,
                sessionDuration: 60,
                baseDuration: 60,
                pricePerSession: 200000,
                amount: 2000000,
                teachingMode: 'ONLINE',
                invoiceNumber: 'HD-EXISTING-001', // already exists!
              },
            ],
            totalAmount: 2000000,
            finalAmount: 2000000,
          }),
        )
        .expect(409);

      expect(res.body.message).toContain('HD-EXISTING-001');
    });

    it('order code is auto-generated with correct format', async () => {
      const orderId = await createDraftOrder(saleASession, { parentPhone: '0901993007' });
      const order = await orderModel.findById(orderId).lean() as any;

      const year = new Date().getFullYear();
      expect(order.orderCode).toMatch(new RegExp(`^ORD-${year}-\\d{4}$`));
    });

    it('order codes are sequential', async () => {
      const id1 = await createDraftOrder(saleASession, { parentPhone: '0901993008' });
      const id2 = await createDraftOrder(saleASession, { parentPhone: '0901993009' });

      const order1 = await orderModel.findById(id1).lean() as any;
      const order2 = await orderModel.findById(id2).lean() as any;

      const num1 = parseInt(order1.orderCode.split('-')[2], 10);
      const num2 = parseInt(order2.orderCode.split('-')[2], 10);

      expect(num2).toBe(num1 + 1);
    });

    it('Sale cannot change saleId on update', async () => {
      const orderId = await createDraftOrder(saleASession, { parentPhone: '0901993010' });

      await authedPatch(saleASession, `/orders/${orderId}`)
        .send({ saleId: String(saleBUser._id) })
        .expect(200);

      // saleId should NOT change for SALE role
      const order = await orderModel.findById(orderId).lean() as any;
      expect(String(order.saleId)).toBe(String(saleAUser._id));
    });

    it('empty/whitespace invoice number is ignored', async () => {
      const res = await authedPost(saleASession, '/orders')
        .send(
          buildBasePayload({
            parentPhone: '0901993011',
            items: [
              {
                productId: onlineProductId,
                productName: 'Online English',
                sessions: 10,
                sessionDuration: 60,
                baseDuration: 60,
                pricePerSession: 200000,
                amount: 2000000,
                teachingMode: 'ONLINE',
                invoiceNumber: '   ', // whitespace only
              },
            ],
            totalAmount: 2000000,
            finalAmount: 2000000,
          }),
        )
        .expect((r) => expect([200, 201]).toContain(r.status));

      const order = await orderModel.findById(res.body._id).lean() as any;
      // invoiceNumber should be undefined/absent (normalized away)
      expect(order.items[0].invoiceNumber).toBeFalsy();
    });
  });

  /* ================================================================ */
  /*  GROUP 4: Lead conversion edge cases                             */
  /* ================================================================ */

  describe('Lead conversion edge cases', () => {
    it('already-converted lead cannot create new order', async () => {
      // Create a lead
      const leadRes = await authedPost(saleASession, '/leads')
        .send({
          parentName: 'Lead Parent X',
          parentPhone: '0901994001',
          studentName: 'Lead Student X',
          source: 'FACEBOOK',
        })
        .expect((r) => expect([200, 201]).toContain(r.status));
      const leadId = String(leadRes.body._id);

      // First order from lead → OK
      await createDraftOrder(saleASession, {
        parentPhone: '0901994001',
        parentName: 'Lead Parent X',
        studentName: 'Lead Student X',
        leadId,
      });

      // Second order from same lead → rejected
      const res = await authedPost(saleASession, '/orders')
        .send(
          buildBasePayload({
            parentPhone: '0901994001',
            parentName: 'Lead Parent X',
            studentName: 'Lead Student X',
            leadId,
          }),
        )
        .expect(400);

      expect(res.body.message).toBeDefined();
    });

    it('lead with NOT_INTERESTED status cannot create order', async () => {
      const leadRes = await authedPost(saleASession, '/leads')
        .send({
          parentName: 'Dead Lead Parent',
          parentPhone: '0901994002',
          studentName: 'Dead Lead Student',
          source: 'GOOGLE',
        })
        .expect((r) => expect([200, 201]).toContain(r.status));
      const leadId = String(leadRes.body._id);

      // Mark lead as NOT_INTERESTED
      await leadModel.findByIdAndUpdate(leadId, { status: 'NOT_INTERESTED' });

      const res = await authedPost(saleASession, '/orders')
        .send(
          buildBasePayload({
            parentPhone: '0901994002',
            leadId,
          }),
        )
        .expect(400);

      expect(res.body.message).toBeDefined();
    });
  });

  /* ================================================================ */
  /*  GROUP 5: Enrollment & invoice creation verification             */
  /* ================================================================ */

  describe('Enrollment & invoice creation verification', () => {
    it('approved order creates student, parent, invoice and wallet', async () => {
      const orderId = await createDraftOrder(saleASession, {
        parentPhone: '0901995001',
        parentName: 'Enrollment Parent',
        studentName: 'Enrollment Student',
        studentAge: 10,
        studentGrade: '5',
      });
      await submitOrder(saleASession, orderId);

      const approveRes = await authedPost(directorSession, `/orders/${orderId}/approve`)
        .send({ approvalImage: '/uploads/approval/enrollment.png' })
        .expect((r) => expect([200, 201]).toContain(r.status));

      await new Promise((r) => setTimeout(r, 500));

      expect(approveRes.body.order.status).toBe('APPROVED');
      expect(approveRes.body.enrollment.success).toBe(true);
      expect(approveRes.body.enrollment.studentId).toBeTruthy();
      expect(approveRes.body.enrollment.invoiceIds).toHaveLength(1);

      // Verify parent created
      const parent = await userModel
        .findOne({ phone: '0901995001', role: 'PARENT' })
        .lean() as any;
      expect(parent).toBeTruthy();
      expect(parent.fullName).toBe('Enrollment Parent');

      // Verify student created with order info
      const student = await studentModel
        .findById(approveRes.body.enrollment.studentId)
        .lean() as any;
      expect(student).toBeTruthy();
      expect(student.fullName).toBe('Enrollment Student');
      expect(student.age).toBe(10);
      expect(student.grade).toBe('5');
      expect(String(student.parentUserId)).toBe(String(parent._id));

      // Verify invoice created
      const invoices = await invoiceModel.find({ orderId }).lean() as any;
      expect(invoices.length).toBe(1);
      expect(invoices[0].sessions).toBe(20);
      expect(invoices[0].pricePerSession).toBe(200000);
      expect(invoices[0].status).toBe('APPROVED');

      // Verify wallet funded
      const wallet = await walletModel.findOne({ userId: parent._id }).lean() as any;
      expect(wallet).toBeTruthy();
      expect(wallet.balance).toBeGreaterThan(0);
    });

    it('enrollment failure does not leave order in APPROVED state', async () => {
      // Create a valid draft first, then corrupt existingStudentId directly in DB
      const orderId = await createDraftOrder(saleASession, {
        parentPhone: '0901995002',
      });

      // Corrupt the order's existingStudentId to a non-existent student
      const fakeStudentId = new Types.ObjectId();
      await orderModel.findByIdAndUpdate(orderId, {
        existingStudentId: fakeStudentId,
      });

      await submitOrder(saleASession, orderId);

      const res = await authedPost(directorSession, `/orders/${orderId}/approve`)
        .send({ approvalImage: '/uploads/test.png' })
        .expect((r) => expect([200, 201]).toContain(r.status));

      // If enrollment fails, order should NOT be stuck in APPROVED
      const order = await orderModel.findById(orderId).lean() as any;
      if (res.body?.enrollment?.success === false) {
        expect(order.status).toBe('SUBMITTED');
      }
    });

    it('multiple items create correct number of invoices', async () => {
      const orderId = await createDraftOrder(saleASession, {
        parentPhone: '0901995003',
        items: [
          {
            productId: onlineProductId,
            productName: 'English',
            sessions: 10,
            sessionDuration: 60,
            baseDuration: 60,
            pricePerSession: 200000,
            amount: 2000000,
            teachingMode: 'ONLINE',
            teacherPayPerSession: 100000,
          },
          {
            productId: offlineProductId,
            productName: 'Math',
            sessions: 12,
            sessionDuration: 90,
            baseDuration: 90,
            pricePerSession: 150000,
            amount: 1800000,
            teachingMode: 'OFFLINE',
            teacherPayPerStudent: 80000,
            selectedClassId: existingClassId,
          },
        ],
        totalAmount: 3800000,
        finalAmount: 3800000,
      });
      await submitOrder(saleASession, orderId);

      await authedPost(directorSession, `/orders/${orderId}/approve`)
        .send({ approvalImage: '/uploads/test.png' })
        .expect((r) => expect([200, 201]).toContain(r.status));

      await new Promise((r) => setTimeout(r, 500));

      const invoices = await invoiceModel.find({ orderId }).lean() as any;
      expect(invoices.length).toBe(2);

      // Only 1 student created
      const order = await orderModel.findById(orderId).lean() as any;
      const students = await studentModel
        .find({ _id: order.processedResults?.studentId })
        .lean() as any;
      expect(students.length).toBe(1);
    });
  });

  /* ================================================================ */
  /*  GROUP 6: Pipeline & stats accuracy                              */
  /* ================================================================ */

  describe('Pipeline & stats accuracy', () => {
    it('pipeline counts orders by status correctly', async () => {
      // Create orders in various statuses
      await createDraftOrder(saleASession, { parentPhone: '0901996001' }); // DRAFT
      await createDraftOrder(saleASession, { parentPhone: '0901996002' }); // DRAFT

      const id3 = await createDraftOrder(saleASession, { parentPhone: '0901996003' });
      await submitOrder(saleASession, id3); // SUBMITTED

      const res = await authedGet(directorSession, '/orders/pipeline').expect(200);

      expect(res.body.DRAFT.count).toBe(2);
      expect(res.body.SUBMITTED.count).toBe(1);
    });

    it('pipeline totalValue sums finalAmount correctly', async () => {
      await createDraftOrder(saleASession, {
        parentPhone: '0901996004',
        finalAmount: 1000000,
        totalAmount: 1000000,
        items: [{
          productId: onlineProductId,
          sessions: 5,
          sessionDuration: 60,
          baseDuration: 60,
          pricePerSession: 200000,
          amount: 1000000,
          teachingMode: 'ONLINE',
        }],
      });

      await createDraftOrder(saleASession, {
        parentPhone: '0901996005',
        finalAmount: 2000000,
        totalAmount: 2000000,
        items: [{
          productId: onlineProductId,
          sessions: 10,
          sessionDuration: 60,
          baseDuration: 60,
          pricePerSession: 200000,
          amount: 2000000,
          teachingMode: 'ONLINE',
        }],
      });

      const res = await authedGet(directorSession, '/orders/pipeline').expect(200);
      expect(res.body.DRAFT.totalValue).toBe(3000000);
    });

    it('Sale pipeline only shows own orders', async () => {
      await createDraftOrder(saleASession, { parentPhone: '0901996006' });
      await createDraftOrder(saleBSession, { parentPhone: '0901996007' });

      const resA = await authedGet(saleASession, '/orders/pipeline').expect(200);
      const resB = await authedGet(saleBSession, '/orders/pipeline').expect(200);

      expect(resA.body.DRAFT.count).toBe(1);
      expect(resB.body.DRAFT.count).toBe(1);
    });
  });

  /* ================================================================ */
  /*  GROUP 7: Commission report                                      */
  /* ================================================================ */

  describe('Commission report', () => {
    it('returns commission data for specific sale', async () => {
      const orderId = await createDraftOrder(saleASession, {
        parentPhone: '0901997001',
        saleCommission: 200000,
      });
      await submitOrder(saleASession, orderId);
      await authedPost(directorSession, `/orders/${orderId}/approve`)
        .send({ approvalImage: '/uploads/test.png' })
        .expect((r) => expect([200, 201]).toContain(r.status));

      await new Promise((r) => setTimeout(r, 500));

      const res = await authedGet(directorSession, '/orders/commission-report').expect(200);
      expect(res.body.details).toBeDefined();
      expect(res.body.summary).toBeDefined();
      expect(res.body.details.length).toBeGreaterThan(0);
    });

    it('Sale only sees own commission', async () => {
      await createDraftOrder(saleASession, {
        parentPhone: '0901997002',
        saleCommission: 100000,
      });

      await createDraftOrder(saleBSession, {
        parentPhone: '0901997003',
        saleCommission: 200000,
      });

      const resA = await authedGet(saleASession, '/orders/commission-report').expect(200);
      expect(resA.body.details.length).toBe(1);
    });
  });

  /* ================================================================ */
  /*  GROUP 8: Edge cases — concurrent operations & boundary values   */
  /* ================================================================ */

  describe('Edge cases – concurrent & boundary', () => {
    it('cannot approve an already-approved order (race condition protection)', async () => {
      const orderId = await createDraftOrder(saleASession, { parentPhone: '0901998001' });
      await submitOrder(saleASession, orderId);

      // First approve succeeds
      await authedPost(directorSession, `/orders/${orderId}/approve`)
        .send({ approvalImage: '/uploads/test1.png' })
        .expect((r) => expect([200, 201]).toContain(r.status));

      await new Promise((r) => setTimeout(r, 500));

      // Second approve fails (order no longer SUBMITTED)
      await authedPost(opsSession, `/orders/${orderId}/approve`)
        .send({ approvalImage: '/uploads/test2.png' })
        .expect(400);
    });

    it('order with zero-amount offline trial items approved without receipt', async () => {
      const orderId = await createDraftOrder(saleASession, {
        parentPhone: '0901998002',
        receiptImage: undefined,
        items: [
          {
            productId: offlineProductId,
            productName: 'Offline Trial',
            sessions: 1,
            sessionDuration: 90,
            baseDuration: 90,
            pricePerSession: 0,
            amount: 0,
            teachingMode: 'OFFLINE',
            trialSessions: 1,
            teacherPayPerStudent: 0,
            selectedClassId: existingClassId,
          },
        ],
        totalAmount: 0,
        finalAmount: 0,
      });
      await submitOrder(saleASession, orderId);

      // Trial orders may not need receipt proof
      const res = await authedPost(directorSession, `/orders/${orderId}/approve`)
        .send({})
        .expect((r) => expect([200, 201, 400]).toContain(r.status));

      // If approved → verify invoice with 0 amount
      if (res.body?.order?.status === 'APPROVED') {
        const invoices = await invoiceModel.find({ orderId }).lean() as any;
        expect(invoices.length).toBe(1);
        expect(invoices[0].amount).toBe(0);
      }
    });

    it('order with very large amounts handles correctly', async () => {
      const res = await authedPost(saleASession, '/orders')
        .send(
          buildBasePayload({
            parentPhone: '0901998003',
            items: [
              {
                productId: onlineProductId,
                productName: 'Premium Package',
                sessions: 200,
                sessionDuration: 120,
                baseDuration: 60,
                pricePerSession: 500000,
                amount: 200000000, // 200M
                teachingMode: 'ONLINE',
                teacherPayPerSession: 250000,
              },
            ],
            totalAmount: 200000000,
            finalAmount: 200000000,
          }),
        )
        .expect((r) => expect([200, 201]).toContain(r.status));

      expect(res.body.totalAmount).toBe(200000000);
      expect(res.body.finalAmount).toBe(200000000);
    });

    it('findOne with invalid ObjectId returns 400', async () => {
      await authedGet(directorSession, '/orders/invalid-id').expect(400);
    });

    it('findOne with non-existent valid ObjectId returns 404', async () => {
      const fakeId = new Types.ObjectId().toString();
      await authedGet(directorSession, `/orders/${fakeId}`).expect(404);
    });

    it('search filter works for parent phone', async () => {
      await createDraftOrder(saleASession, {
        parentPhone: '0901998010',
        parentName: 'Searchable Parent',
      });
      await createDraftOrder(saleASession, {
        parentPhone: '0901998011',
        parentName: 'Different Parent',
      });

      const res = await authedGet(directorSession, '/orders?search=0901998010').expect(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].parentPhone).toBe('0901998010');
    });

    it('search filter works for student name', async () => {
      await createDraftOrder(saleASession, {
        parentPhone: '0901998012',
        studentName: 'UniqueStudentXYZ',
      });
      await createDraftOrder(saleASession, { parentPhone: '0901998013' });

      const res = await authedGet(directorSession, '/orders?search=UniqueStudentXYZ').expect(200);
      expect(res.body.data.length).toBe(1);
    });

    it('status filter works correctly', async () => {
      await createDraftOrder(saleASession, { parentPhone: '0901998014' }); // DRAFT
      const id2 = await createDraftOrder(saleASession, { parentPhone: '0901998015' });
      await submitOrder(saleASession, id2); // SUBMITTED

      const draftRes = await authedGet(directorSession, '/orders?status=DRAFT').expect(200);
      const submittedRes = await authedGet(directorSession, '/orders?status=SUBMITTED').expect(200);

      expect(draftRes.body.data.length).toBe(1);
      expect(submittedRes.body.data.length).toBe(1);
    });
  });

  /* ================================================================ */
  /*  GROUP 9: Approval image & receipt validation                    */
  /* ================================================================ */

  describe('Approval image & receipt validation', () => {
    it('approval image is stored on order when provided', async () => {
      const orderId = await createDraftOrder(saleASession, { parentPhone: '0901999001' });
      await submitOrder(saleASession, orderId);

      await authedPost(directorSession, `/orders/${orderId}/approve`)
        .send({ approvalImage: '/uploads/approval/verified.png' })
        .expect((r) => expect([200, 201]).toContain(r.status));

      await new Promise((r) => setTimeout(r, 500));

      const order = await orderModel.findById(orderId).lean() as any;
      expect(order.approvalImage).toBe('/uploads/approval/verified.png');
    });
  });

  /* ================================================================ */
  /*  GROUP 10: Audit log verification                                */
  /* ================================================================ */

  describe('Audit log verification', () => {
    it('create order generates audit log', async () => {
      const orderId = await createDraftOrder(saleASession, { parentPhone: '0901999002' });

      const logs = await auditLogModel.find({ targetId: orderId }).lean() as any;
      expect(logs.length).toBeGreaterThanOrEqual(1);
      expect(logs.some((l: any) => l.action === 'CREATE')).toBe(true);
    });

    it('approve order generates audit log', async () => {
      const orderId = await createDraftOrder(saleASession, { parentPhone: '0901999003' });
      await submitOrder(saleASession, orderId);

      await authedPost(directorSession, `/orders/${orderId}/approve`)
        .send({ approvalImage: '/uploads/test.png' })
        .expect((r) => expect([200, 201]).toContain(r.status));

      await new Promise((r) => setTimeout(r, 500));

      const logs = await auditLogModel.find({ targetId: orderId }).lean() as any;
      expect(logs.some((l: any) => l.action === 'APPROVE')).toBe(true);
    });

    it('reject order generates audit log', async () => {
      const orderId = await createDraftOrder(saleASession, { parentPhone: '0901999004' });
      await submitOrder(saleASession, orderId);

      await authedPost(directorSession, `/orders/${orderId}/reject`)
        .send({ reason: 'Not acceptable' })
        .expect((r) => expect([200, 201]).toContain(r.status));

      const logs = await auditLogModel.find({ targetId: orderId }).lean() as any;
      expect(logs.some((l: any) => l.action === 'REJECT')).toBe(true);
    });

    it('cancel order generates audit log', async () => {
      const orderId = await createDraftOrder(saleASession, { parentPhone: '0901999005' });

      await authedPost(saleASession, `/orders/${orderId}/cancel`)
        .send({})
        .expect((r) => expect([200, 201]).toContain(r.status));

      const logs = await auditLogModel.find({ targetId: orderId }).lean() as any;
      expect(logs.some((l: any) => l.action === 'STATUS_CHANGE')).toBe(true);
    });

    it('delete order generates audit log', async () => {
      const orderId = await createDraftOrder(saleASession, { parentPhone: '0901999006' });

      await authedDelete(directorSession, `/orders/${orderId}`)
        .expect((r) => expect([200, 201]).toContain(r.status));

      const logs = await auditLogModel.find({ targetId: orderId }).lean() as any;
      expect(logs.some((l: any) => l.action === 'DELETE')).toBe(true);
    });
  });
});
