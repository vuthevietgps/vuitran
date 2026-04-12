import { closeE2eResources } from './e2e-cleanup';
import * as request from 'supertest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { AppModule } from '../src/app.module';
import * as cookieParser from 'cookie-parser';
import * as bcrypt from 'bcrypt';

function extractCookieValue(
  setCookies: string | string[] | undefined,
  name: string,
): string | null {
  if (!setCookies) return null;
  const rows = Array.isArray(setCookies) ? setCookies : [setCookies];
  const pattern = new RegExp(`(?:^|;\\s*)${name}=([^;]+)`);
  for (const row of rows) {
    const first = String(row).split(';')[0];
    const match = pattern.exec(first);
    if (match?.[1]) return match[1];
  }
  return null;
}

async function loginAs(
  app: INestApplication,
  email: string,
  password: string,
): Promise<{ cookies: string[] }> {
  const loginRes = await request(app.getHttpServer())
    .post('/auth/login')
    .send({ email, password })
    .expect((res) => {
      if (![200, 201].includes(res.status)) {
        throw new Error(`Login failed for ${email}: ${res.status}`);
      }
    });

  const accessToken = extractCookieValue(loginRes.headers['set-cookie'], 'access_token');
  if (!accessToken) {
    throw new Error(`Missing access_token cookie for ${email}`);
  }

  const meRes = await request(app.getHttpServer())
    .get('/users/me')
    .set('Cookie', `access_token=${accessToken}`)
    .expect(200);

  const xsrfToken = extractCookieValue(meRes.headers['set-cookie'], 'XSRF-TOKEN');
  if (!xsrfToken) {
    throw new Error(`Missing XSRF-TOKEN cookie for ${email}`);
  }

  return { cookies: [`access_token=${accessToken}`, `XSRF-TOKEN=${xsrfToken}`] };
}

async function upsertUser(
  userModel: Model<any>,
  user: {
    email: string;
    password: string;
    fullName: string;
    role: string;
  },
): Promise<any> {
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
      $setOnInsert: {
        createdAt: new Date(),
      },
    },
    { upsert: true },
  );
  return userModel.findOne({ email: user.email }).lean();
}

function cookieHeader(cookies: string[]): string {
  return cookies.join('; ');
}

function csrfToken(cookies: string[]): string {
  const raw = cookies.find((c) => c.startsWith('XSRF-TOKEN='));
  if (!raw) return '';
  return raw.split('=')[1].split(';')[0];
}

function authHeaders(cookies: string[]): Record<string, string> {
  return {
    Cookie: cookieHeader(cookies),
    'X-XSRF-TOKEN': csrfToken(cookies),
  };
}

let sequence = 0;
function uniquePhone(prefix = '91'): string {
  sequence += 1;
  return `0${prefix}${String(sequence).padStart(7, '0')}`.slice(0, 10);
}

describe('Group 13 - Bulk Payroll, Rate Limiting, Agents, Supplier Flow (g13)', () => {
  let app: INestApplication;
  let moduleRef: TestingModule;
  let mongod: MongoMemoryReplSet;
  let userModel: Model<any>;
  let productModel: Model<any>;
  let previousMongoUri: string | undefined;
  let mongoUri: string;

  function restoreMongoUri(): void {
    if (previousMongoUri === undefined) {
      delete process.env.MONGODB_URI;
      return;
    }

    process.env.MONGODB_URI = previousMongoUri;
  }

  let directorCookies: string[];
  let accountingCookies: string[];
  let opsCookies: string[];
  let saleCookies: string[];
  let productId: string;

  beforeAll(async () => {
    mongod = await MongoMemoryReplSet.create({
      replSet: { count: 1, storageEngine: 'wiredTiger' },
    });
    previousMongoUri = process.env.MONGODB_URI;
    mongoUri = mongod.getUri().replace('?', 'school-mgmt-g13-e2e?');
    process.env.MONGODB_URI = mongoUri;

    try {
      moduleRef = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();

      app = moduleRef.createNestApplication();
      app.use(cookieParser());
      app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
      await app.init();
    } catch (error) {
      restoreMongoUri();
      throw error;
    }

    userModel = moduleRef.get<Model<any>>(getModelToken('User'));
    productModel = moduleRef.get<Model<any>>(getModelToken('Product'));

    for (const [role, email, name] of [
      ['DIRECTOR', 'director.g13@test.com', 'Director G13'],
      ['ACCOUNTING', 'accounting.g13@test.com', 'Accounting G13'],
      ['OPS', 'ops.g13@test.com', 'OPS G13'],
      ['SALE', 'sale.g13@test.com', 'Sale G13'],
    ] as const) {
      await upsertUser(userModel, {
        email,
        password: 'Pass1234!',
        fullName: name,
        role,
      });
    }

    directorCookies = (await loginAs(app, 'director.g13@test.com', 'Pass1234!')).cookies;
    accountingCookies = (await loginAs(app, 'accounting.g13@test.com', 'Pass1234!')).cookies;
    opsCookies = (await loginAs(app, 'ops.g13@test.com', 'Pass1234!')).cookies;
    saleCookies = (await loginAs(app, 'sale.g13@test.com', 'Pass1234!')).cookies;

    const product = await productModel.create({
      name: 'Group13 Online English',
      code: 'G13-ONLINE-01',
      description: 'Canonical product seed for group13',
      teachingMode: 'ONLINE',
      defaultSessions: 10,
      defaultSessionDuration: 60,
      pricePerSession: 200000,
      isActive: true,
    });
    productId = String(product._id);
  });

  afterAll(async () => {
    restoreMongoUri();
    await closeE2eResources({ app, moduleRef, mongoServer: mongod });
  });

  function buildOrderPayload(overrides: Record<string, unknown> = {}) {
    const phone = uniquePhone();
    const invoiceNumber = `INV-G13-${Date.now()}-${sequence}`;
    return {
      orderType: 'NEW_ENROLLMENT',
      parentName: `Parent G13 ${phone}`,
      parentPhone: phone,
      parentEmail: `parent.${phone}@g13.test`,
      studentName: `Student G13 ${phone}`,
      studentAge: 10,
      studentFaceImage: '/uploads/students/default-avatar.png',
      items: [
        {
          productId,
          productName: 'Group13 Online English',
          sessions: 10,
          invoiceSessions: 10,
          sessionDuration: 60,
          baseDuration: 60,
          pricePerSession: 200000,
          amount: 2000000,
          teachingMode: 'ONLINE',
          teacherPayPerSession: 100000,
          subject: 'English',
          learningGoals: 'Group13 order flow',
          invoiceNumber,
          invoiceDescription: 'Group13 order invoice',
        },
      ],
      totalAmount: 2000000,
      finalAmount: 2000000,
      leadSource: 'WALK_IN',
      paymentPlan: 'FULL',
      paymentDate: new Date().toISOString(),
      receiptImage: '/uploads/invoices/receipt-g13.png',
      consultationNotes: 'Group13 test order',
      ...overrides,
    };
  }

  describe('15.3 Bulk Payroll', () => {
    let teacherWithConfigId: string;

    beforeAll(async () => {
      const withConfig = await upsertUser(userModel, {
        email: 'teacher.withconfig.g13@test.com',
        password: 'Pass1234!',
        fullName: 'Teacher WithConfig G13',
        role: 'TEACHER',
      });
      const noConfig = await upsertUser(userModel, {
        email: 'teacher.noconfig.g13@test.com',
        password: 'Pass1234!',
        fullName: 'Teacher NoConfig G13',
        role: 'TEACHER',
      });

      teacherWithConfigId = String(withConfig._id);
      expect(noConfig?._id).toBeDefined();

      const configRes = await request(app.getHttpServer())
        .post('/salary-config')
        .set(authHeaders(directorCookies))
        .send({
          userId: teacherWithConfigId,
          baseSalary: 500000,
          standardHours: 176,
          scheduledStartTime: '08:00',
          latePenaltyAmount: 0,
        });

      expect([200, 201]).toContain(configRes.status);
    });

    it('bulk-generate only processes staff who have ACTIVE salary config', async () => {
      const res = await request(app.getHttpServer())
        .post('/staff-payroll/bulk-generate')
        .set(authHeaders(directorCookies))
        .send({ periodStart: '2025-01-01', periodEnd: '2025-01-31' });

      expect([200, 201]).toContain(res.status);
      expect(res.body.created).toBe(1);
      expect(res.body.skipped).toBe(0);
      expect(res.body.errors ?? []).toEqual([]);
    });

    it('bulk-generate is idempotent for the same overlapping period', async () => {
      const res = await request(app.getHttpServer())
        .post('/staff-payroll/bulk-generate')
        .set(authHeaders(accountingCookies))
        .send({ periodStart: '2025-01-01', periodEnd: '2025-01-31' });

      expect([200, 201]).toContain(res.status);
      expect(res.body.created).toBe(0);
      expect(res.body.skipped).toBe(1);
      expect(res.body.errors ?? []).toEqual([]);
    });

    it('bulk-generate is forbidden for OPS role', async () => {
      const res = await request(app.getHttpServer())
        .post('/staff-payroll/bulk-generate')
        .set(authHeaders(opsCookies))
        .send({ periodStart: '2025-02-01', periodEnd: '2025-02-28' });

      expect(res.status).toBe(403);
    });
  });

  describe('15.4 Rate Limiting on Public API', () => {
    it('public attendance submit starts throttling within the first 6 requests', async () => {
      const responses: number[] = [];

      for (let i = 0; i < 6; i++) {
        const res = await request(app.getHttpServer())
          .post('/public/attendance/submit')
          .send({ token: `invalid-token-${i}`, classId: 'fake', sessionId: 'fake' });
        responses.push(res.status);
      }

      expect(responses[0]).not.toBe(429);
      expect(responses).toContain(429);
    });

    it('internal authenticated endpoints are not affected by public throttling', async () => {
      const res = await request(app.getHttpServer())
        .get('/sessions?limit=5')
        .set(authHeaders(directorCookies));

      expect(res.status).not.toBe(429);
      expect([200, 201]).toContain(res.status);
    });
  });

  describe('16.1 Agent Tiers', () => {
    let goldAgentId: string;
    let silverAgentId: string;

    beforeAll(async () => {
      const goldRes = await request(app.getHttpServer())
        .post('/agents')
        .set(authHeaders(directorCookies))
        .send({
          name: 'Gold Agent G13',
          contactPerson: 'Gold Contact',
          phone: '0900000013',
          email: 'gold.agent.g13@test.com',
          tier: 'GOLD',
          commissionRate: 15,
        });
      expect([200, 201]).toContain(goldRes.status);
      goldAgentId = goldRes.body._id;

      const silverRes = await request(app.getHttpServer())
        .post('/agents')
        .set(authHeaders(directorCookies))
        .send({
          name: 'Silver Agent G13',
          contactPerson: 'Silver Contact',
          phone: '0900000014',
          email: 'silver.agent.g13@test.com',
          tier: 'SILVER',
          commissionRate: 10,
        });
      expect([200, 201]).toContain(silverRes.status);
      silverAgentId = silverRes.body._id;
    });

    it('GOLD agent stores its configured commissionRate', async () => {
      const res = await request(app.getHttpServer())
        .get(`/agents/${goldAgentId}`)
        .set(authHeaders(directorCookies));

      expect([200, 201]).toContain(res.status);
      expect(res.body.tier).toBe('GOLD');
      expect(res.body.commissionRate).toBe(15);
    });

    it('SILVER agent stores its configured commissionRate', async () => {
      const res = await request(app.getHttpServer())
        .get(`/agents/${silverAgentId}`)
        .set(authHeaders(directorCookies));

      expect([200, 201]).toContain(res.status);
      expect(res.body.tier).toBe('SILVER');
      expect(res.body.commissionRate).toBe(10);
    });

    it('order without explicit saleCommission keeps zero commission after approval', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/orders')
        .set(authHeaders(saleCookies))
        .send(buildOrderPayload());
      expect([200, 201]).toContain(createRes.status);
      const orderId = String(createRes.body._id);

      const submitRes = await request(app.getHttpServer())
        .post(`/orders/${orderId}/submit`)
        .set(authHeaders(saleCookies))
        .send({});
      expect([200, 201]).toContain(submitRes.status);

      const approveRes = await request(app.getHttpServer())
        .post(`/orders/${orderId}/approve`)
        .set(authHeaders(directorCookies))
        .send({ approvalImage: '/uploads/approval/g13-order.png' });
      expect([200, 201]).toContain(approveRes.status);

      const detailRes = await request(app.getHttpServer())
        .get(`/orders/${orderId}`)
        .set(authHeaders(directorCookies));
      expect([200, 201]).toContain(detailRes.status);
      expect(detailRes.body.saleCommission ?? 0).toBe(0);
    });
  });

  describe('16.2 Suspended Agent', () => {
    let suspendedAgentId: string;

    beforeAll(async () => {
      const createRes = await request(app.getHttpServer())
        .post('/agents')
        .set(authHeaders(directorCookies))
        .send({
          name: 'Suspended Agent G13',
          contactPerson: 'Suspended Contact',
          phone: '0900000015',
          email: 'suspended.agent.g13@test.com',
          tier: 'SILVER',
          commissionRate: 10,
        });
      expect([200, 201]).toContain(createRes.status);
      suspendedAgentId = createRes.body._id;

      const suspendRes = await request(app.getHttpServer())
        .post(`/agents/${suspendedAgentId}/suspend`)
        .set(authHeaders(directorCookies));
      expect([200, 201]).toContain(suspendRes.status);
    });

    it('GET /agents/:id shows status SUSPENDED after suspension', async () => {
      const res = await request(app.getHttpServer())
        .get(`/agents/${suspendedAgentId}`)
        .set(authHeaders(directorCookies));

      expect([200, 201]).toContain(res.status);
      expect(res.body.status).toBe('SUSPENDED');
    });

    it('suspending an already suspended agent is blocked', async () => {
      const res = await request(app.getHttpServer())
        .post(`/agents/${suspendedAgentId}/suspend`)
        .set(authHeaders(directorCookies));

      expect(res.status).toBe(400);
    });
  });

  describe('16.3 Supplier Procurement Flow', () => {
    let quoteId: string;
    let quote2Id: string;
    let paymentId: string;

    it('POST /supplier-quotes creates quote in DRAFT status', async () => {
      const res = await request(app.getHttpServer())
        .post('/supplier-quotes')
        .set(authHeaders(directorCookies))
        .send({
          title: 'Office supplies Q1',
          supplierName: 'Test Supplier G13',
          supplierPhone: '0901234567',
          quoteDate: '2026-04-10',
          validUntil: '2026-05-10',
          description: 'Office supplies Q1',
          items: [{ itemName: 'Paper', quantity: 100, unit: 'ream', unitPrice: 500000 }],
        });

      expect([200, 201]).toContain(res.status);
      expect(res.body.status).toBe('DRAFT');
      quoteId = res.body._id;
    });

    it('DRAFT -> SENT via POST /supplier-quotes/:id/send', async () => {
      const res = await request(app.getHttpServer())
        .post(`/supplier-quotes/${quoteId}/send`)
        .set(authHeaders(opsCookies));

      expect([200, 201]).toContain(res.status);
      expect(res.body.status).toBe('SENT');
    });

    it('SENT -> ACCEPTED via POST /supplier-quotes/:id/accept', async () => {
      const res = await request(app.getHttpServer())
        .post(`/supplier-quotes/${quoteId}/accept`)
        .set(authHeaders(directorCookies));

      expect([200, 201]).toContain(res.status);
      expect(res.body.status).toBe('ACCEPTED');
    });

    it('DRAFT -> ACCEPTED directly is allowed by the current state machine', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/supplier-quotes')
        .set(authHeaders(directorCookies))
        .send({
          title: 'IT equipment',
          supplierName: 'Second Supplier G13',
          quoteDate: '2026-04-10',
          description: 'IT equipment',
          items: [{ itemName: 'Laptop', quantity: 1, unit: 'unit', unitPrice: 30000000 }],
        });
      expect([200, 201]).toContain(createRes.status);
      quote2Id = createRes.body._id;

      const acceptRes = await request(app.getHttpServer())
        .post(`/supplier-quotes/${quote2Id}/accept`)
        .set(authHeaders(directorCookies));

      expect([200, 201]).toContain(acceptRes.status);
      expect(acceptRes.body.status).toBe('ACCEPTED');
    });

    it('POST /supplier-payments creates payment in PENDING_APPROVAL status', async () => {
      const res = await request(app.getHttpServer())
        .post('/supplier-payments')
        .set(authHeaders(directorCookies))
        .send({
          supplierQuoteId: quoteId,
          supplierName: 'Test Supplier G13',
          title: 'Payment for office supplies Q1',
          amount: 50000000,
          paymentDate: new Date().toISOString(),
          description: 'Payment for office supplies Q1',
          paymentMethod: 'BANK_TRANSFER',
        });

      expect([200, 201]).toContain(res.status);
      expect(res.body.status).toBe('PENDING_APPROVAL');
      paymentId = res.body._id;
    });

    it('payment PENDING_APPROVAL -> APPROVED -> PAID follows the current workflow', async () => {
      const approveRes = await request(app.getHttpServer())
        .post(`/supplier-payments/${paymentId}/approve`)
        .set(authHeaders(directorCookies));
      expect([200, 201]).toContain(approveRes.status);
      expect(approveRes.body.status).toBe('APPROVED');

      const paidRes = await request(app.getHttpServer())
        .post(`/supplier-payments/${paymentId}/mark-paid`)
        .set(authHeaders(directorCookies))
        .send({ paidAt: new Date().toISOString(), paymentMethod: 'BANK_TRANSFER', notes: 'TXN-G13-001' });
      expect([200, 201]).toContain(paidRes.status);
      expect(paidRes.body.status).toBe('PAID');
    });
  });

  describe('16.4 Cancellation and Commission Report', () => {
    let orderId: string;

    it('cancelling an approved zero-commission order keeps commission at zero', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/orders')
        .set(authHeaders(saleCookies))
        .send(buildOrderPayload());
      expect([200, 201]).toContain(createRes.status);
      orderId = String(createRes.body._id);

      const submitRes = await request(app.getHttpServer())
        .post(`/orders/${orderId}/submit`)
        .set(authHeaders(saleCookies))
        .send({});
      expect([200, 201]).toContain(submitRes.status);

      const approveRes = await request(app.getHttpServer())
        .post(`/orders/${orderId}/approve`)
        .set(authHeaders(directorCookies))
        .send({ approvalImage: '/uploads/approval/g13-clawback.png' });
      expect([200, 201]).toContain(approveRes.status);

      const beforeRes = await request(app.getHttpServer())
        .get(`/orders/${orderId}`)
        .set(authHeaders(directorCookies));
      expect(beforeRes.body.saleCommission ?? 0).toBe(0);

      const cancelRes = await request(app.getHttpServer())
        .post(`/orders/${orderId}/cancel`)
        .set(authHeaders(directorCookies))
        .send({});
      expect([200, 201]).toContain(cancelRes.status);

      const afterRes = await request(app.getHttpServer())
        .get(`/orders/${orderId}`)
        .set(authHeaders(directorCookies));
      expect(afterRes.body.status).toBe('CANCELLED');
      expect(afterRes.body.saleCommission ?? 0).toBe(0);
    });

    it('commission report remains readable after cancellation', async () => {
      const res = await request(app.getHttpServer())
        .get('/orders/commission-report')
        .set(authHeaders(directorCookies));

      expect([200, 201]).toContain(res.status);
      expect(res.body).toBeDefined();
    });
  });
});
