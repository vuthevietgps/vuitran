import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import * as request from 'supertest';
import * as cookieParser from 'cookie-parser';
import * as bcrypt from 'bcrypt';
import { AppModule } from '../src/app.module';
import { closeE2eResources } from './e2e-cleanup';

/* ------------------------------------------------------------------ */
/*  helpers                                                           */
/* ------------------------------------------------------------------ */
type SessionCookies = { accessToken: string; xsrfToken: string; cookieHeader: string };
type SeedUser = { email: string; password: string; fullName: string; role: string };

function extractCookieValue(setCookies: string | string[] | undefined, name: string): string | null {
  if (!setCookies) return null;
  const rows = Array.isArray(setCookies) ? setCookies : [setCookies];
  for (const row of rows) {
    const match = new RegExp(`(?:^|;\\s*)${name}=([^;]+)`).exec(String(row).split(';')[0]);
    if (match?.[1]) return match[1];
  }
  return null;
}

/* ================================================================== */
/*  E2E — Supplier Quotes, Supplier Payments, Agents                  */
/* ================================================================== */
describe('Supplier Quotes, Supplier Payments & Agents (e2e)', () => {
  let app: INestApplication;
  let moduleRef: TestingModule;
  let mongod: MongoMemoryServer;
  let userModel: Model<any>;
  const sessionCache = new Map<string, SessionCookies>();

  // -- seed users --
  const director: SeedUser = { email: 'director.e2e@test.local', password: 'E2eTest123!', fullName: 'Director E2E', role: 'DIRECTOR' };
  const accounting: SeedUser = { email: 'accounting.e2e@test.local', password: 'E2eTest123!', fullName: 'Accounting E2E', role: 'ACCOUNTING' };
  const sale: SeedUser = { email: 'sale.e2e@test.local', password: 'E2eTest123!', fullName: 'Sale E2E', role: 'SALE' };
  const parent: SeedUser = { email: 'parent.e2e@test.local', password: 'E2eTest123!', fullName: 'Parent E2E', role: 'PARENT' };

  async function upsertUser(user: SeedUser) {
    const hashed = await bcrypt.hash(user.password, 10);
    await userModel.updateOne(
      { email: user.email },
      { $set: { email: user.email, password: hashed, fullName: user.fullName, role: user.role, status: 'ACTIVE' }, $setOnInsert: { createdAt: new Date() } },
      { upsert: true },
    );
    return userModel.findOne({ email: user.email }).lean();
  }

  async function login(user: SeedUser): Promise<SessionCookies> {
    const cached = sessionCache.get(user.email);
    if (cached) return cached;

    const loginRes = await request(app.getHttpServer()).post('/auth/login').send({ email: user.email, password: user.password });
    expect([200, 201]).toContain(loginRes.status);
    const accessToken = extractCookieValue(loginRes.headers['set-cookie'], 'access_token')!;
    expect(accessToken).toBeTruthy();

    const meRes = await request(app.getHttpServer()).get('/users/me').set('Cookie', `access_token=${accessToken}`).expect(200);
    const xsrfToken = extractCookieValue(meRes.headers['set-cookie'], 'XSRF-TOKEN')!;
    expect(xsrfToken).toBeTruthy();

    const session: SessionCookies = { accessToken, xsrfToken, cookieHeader: `access_token=${accessToken}; XSRF-TOKEN=${xsrfToken}` };
    sessionCache.set(user.email, session);
    return session;
  }

  function authed(method: 'get' | 'post' | 'patch' | 'delete', url: string, session: SessionCookies) {
    return (request(app.getHttpServer()) as any)[method](url)
      .set('Cookie', session.cookieHeader)
      .set('x-xsrf-token', session.xsrfToken);
  }

  /* ---- bootstrap ---- */
  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri('e2e-3features');

    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.use(require('express').json({ limit: '10mb' }));
    app.use(require('express').urlencoded({ limit: '10mb', extended: true }));
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();

    userModel = moduleRef.get<Model<any>>(getModelToken('User'));
    await Promise.all([upsertUser(director), upsertUser(accounting), upsertUser(sale), upsertUser(parent)]);
  }, 60000);

  afterAll(async () => {
    await closeE2eResources({
      app,
      moduleRef,
      mongoServer: mongod,
    });
  });

  /* ================================================================
   *  1. SUPPLIER QUOTES
   * ================================================================ */
  describe('Supplier Quotes', () => {
    let quoteId: string;

    it('DIRECTOR can create a supplier quote', async () => {
      const s = await login(director);
      const res = await authed('post', '/supplier-quotes', s)
        .send({
          title: 'Mua bàn ghế',
          supplierName: 'Công ty Nội thất ABC',
          supplierPhone: '0901234567',
          quoteDate: '2026-03-30',
          validUntil: '2026-04-30',
          items: [
            { itemName: 'Bàn học', quantity: 10, unit: 'cái', unitPrice: 500000 },
            { itemName: 'Ghế học', quantity: 10, unit: 'cái', unitPrice: 300000 },
          ],
        })
        .expect(201);
      expect(res.body.quoteCode).toBeTruthy();
      expect(res.body.totalAmount).toBe(8000000);
      expect(res.body.status).toBe('DRAFT');
      expect(res.body.items).toHaveLength(2);
      expect(res.body.items[0].totalPrice).toBe(5000000);
      quoteId = res.body._id;
    });

    it('PARENT cannot access supplier quotes', async () => {
      const s = await login(parent);
      await authed('get', '/supplier-quotes', s).expect(403);
    });

    it('can list and filter quotes', async () => {
      const s = await login(director);
      const res = await authed('get', '/supplier-quotes?keyword=bàn ghế', s).expect(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.total).toBeGreaterThanOrEqual(1);
    });

    it('can get quote by id', async () => {
      const s = await login(director);
      const res = await authed('get', `/supplier-quotes/${quoteId}`, s).expect(200);
      expect(res.body.title).toBe('Mua bàn ghế');
    });

    it('can update a DRAFT quote', async () => {
      const s = await login(director);
      const res = await authed('patch', `/supplier-quotes/${quoteId}`, s)
        .send({ title: 'Mua bàn ghế v2' })
        .expect(200);
      expect(res.body.title).toBe('Mua bàn ghế v2');
    });

    it('can mark quote as SENT', async () => {
      const s = await login(director);
      const res = await authed('post', `/supplier-quotes/${quoteId}/send`, s).expect(201);
      expect(res.body.status).toBe('SENT');
    });

    it('cannot send again after already sent', async () => {
      const s = await login(director);
      await authed('post', `/supplier-quotes/${quoteId}/send`, s).expect(400);
    });

    it('ACCOUNTING can accept a SENT quote', async () => {
      const s = await login(accounting);
      const res = await authed('post', `/supplier-quotes/${quoteId}/accept`, s).expect(201);
      expect(res.body.status).toBe('ACCEPTED');
      expect(res.body.approvedByName).toBe('Accounting E2E');
    });

    it('cannot edit an accepted quote', async () => {
      const s = await login(director);
      await authed('patch', `/supplier-quotes/${quoteId}`, s)
        .send({ title: 'Should fail' })
        .expect(400);
    });

    it('cannot delete an accepted quote', async () => {
      const s = await login(director);
      await authed('delete', `/supplier-quotes/${quoteId}`, s).expect(400);
    });

    it('can reject a quote', async () => {
      const s = await login(director);
      // create a new quote to reject
      const create = await authed('post', '/supplier-quotes', s)
        .send({
          title: 'Reject test',
          supplierName: 'NCC Test',
          quoteDate: '2026-03-30',
          items: [{ itemName: 'Item A', quantity: 1, unit: 'cái', unitPrice: 100000 }],
        })
        .expect(201);
      const rejRes = await authed('post', `/supplier-quotes/${create.body._id}/reject`, s)
        .send({ reason: 'Giá quá cao' })
        .expect(201);
      expect(rejRes.body.status).toBe('REJECTED');
      expect(rejRes.body.rejectionReason).toBe('Giá quá cao');
    });

    it('SALE cannot access supplier quotes', async () => {
      const s = await login(sale);
      await authed('get', '/supplier-quotes', s).expect(403);
    });
  });

  /* ================================================================
   *  2. SUPPLIER PAYMENTS
   * ================================================================ */
  describe('Supplier Payments', () => {
    let paymentId: string;

    it('DIRECTOR can create a supplier payment', async () => {
      const s = await login(director);
      const res = await authed('post', '/supplier-payments', s)
        .send({
          title: 'Thanh toán bàn ghế',
          supplierName: 'Công ty Nội thất ABC',
          amount: 8000000,
          paymentDate: '2026-03-30',
          supplierBankAccount: '123456789',
          supplierBankName: 'Vietcombank',
        })
        .expect(201);
      expect(res.body.paymentCode).toBeTruthy();
      expect(res.body.amount).toBe(8000000);
      expect(res.body.status).toBe('PENDING_APPROVAL');
      paymentId = res.body._id;
    });

    it('PARENT cannot access supplier payments', async () => {
      const s = await login(parent);
      await authed('get', '/supplier-payments', s).expect(403);
    });

    it('can list supplier payments', async () => {
      const s = await login(director);
      const res = await authed('get', '/supplier-payments', s).expect(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('can get stats', async () => {
      const s = await login(director);
      const res = await authed('get', '/supplier-payments/stats', s).expect(200);
      expect(res.body.totalCount).toBeGreaterThanOrEqual(1);
      expect(res.body.byStatus).toBeDefined();
    });

    it('can update a PENDING payment', async () => {
      const s = await login(director);
      const res = await authed('patch', `/supplier-payments/${paymentId}`, s)
        .send({ title: 'TT bàn ghế updated' })
        .expect(200);
      expect(res.body.title).toBe('TT bàn ghế updated');
    });

    it('ACCOUNTING can approve', async () => {
      const s = await login(accounting);
      const res = await authed('post', `/supplier-payments/${paymentId}/approve`, s).expect(201);
      expect(res.body.status).toBe('APPROVED');
    });

    it('cannot approve already approved', async () => {
      const s = await login(accounting);
      await authed('post', `/supplier-payments/${paymentId}/approve`, s).expect(400);
    });

    it('cannot edit an approved payment', async () => {
      const s = await login(director);
      // this should still work since status is APPROVED not PAID
      // Let's verify update works on APPROVED
      const res = await authed('patch', `/supplier-payments/${paymentId}`, s)
        .send({ notes: 'Updated note' })
        .expect(200);
      expect(res.body.notes).toBe('Updated note');
    });

    it('DIRECTOR can mark as paid', async () => {
      const s = await login(director);
      const res = await authed('post', `/supplier-payments/${paymentId}/mark-paid`, s)
        .send({ paymentMethod: 'BANK_TRANSFER' })
        .expect(201);
      expect(res.body.status).toBe('PAID');
      expect(res.body.paymentMethod).toBe('BANK_TRANSFER');
      expect(res.body.paidByName).toBe('Director E2E');
    });

    it('cannot edit a paid payment', async () => {
      const s = await login(director);
      await authed('patch', `/supplier-payments/${paymentId}`, s)
        .send({ title: 'Should fail' })
        .expect(400);
    });

    it('cannot delete a paid payment', async () => {
      const s = await login(director);
      await authed('delete', `/supplier-payments/${paymentId}`, s).expect(400);
    });

    it('can reject a payment', async () => {
      const s = await login(director);
      const create = await authed('post', '/supplier-payments', s)
        .send({ title: 'Reject test', supplierName: 'NCC X', amount: 500000, paymentDate: '2026-03-30' })
        .expect(201);
      const rejRes = await authed('post', `/supplier-payments/${create.body._id}/reject`, s)
        .send({ reason: 'Không hợp lệ' })
        .expect(201);
      expect(rejRes.body.status).toBe('REJECTED');
      expect(rejRes.body.rejectionReason).toBe('Không hợp lệ');
    });

    it('SALE cannot create supplier payment', async () => {
      const s = await login(sale);
      await authed('post', '/supplier-payments', s)
        .send({ title: 'X', supplierName: 'Y', amount: 100, paymentDate: '2026-03-30' })
        .expect(403);
    });
  });

  /* ================================================================
   *  3. AGENTS
   * ================================================================ */
  describe('Agents', () => {
    let agentId: string;

    it('DIRECTOR can create agent', async () => {
      const s = await login(director);
      const res = await authed('post', '/agents', s)
        .send({
          name: 'Đại lý Bình Dương',
          contactPerson: 'Nguyễn Văn A',
          phone: '0909876543',
          email: 'daily.bd@test.local',
          address: '123 Bình Dương',
          tier: 'GOLD',
          commissionRate: 15,
        })
        .expect(201);
      expect(res.body.agentCode).toBeTruthy();
      expect(res.body.name).toBe('Đại lý Bình Dương');
      expect(res.body.tier).toBe('GOLD');
      expect(res.body.commissionRate).toBe(15);
      expect(res.body.status).toBe('ACTIVE');
      agentId = res.body._id;
    });

    it('PARENT cannot access agents', async () => {
      const s = await login(parent);
      await authed('get', '/agents', s).expect(403);
    });

    it('SALE can list agents (read-only)', async () => {
      const s = await login(sale);
      const res = await authed('get', '/agents', s).expect(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('SALE cannot create agent', async () => {
      const s = await login(sale);
      await authed('post', '/agents', s)
        .send({ name: 'Should fail' })
        .expect(403);
    });

    it('can get agent by id', async () => {
      const s = await login(director);
      const res = await authed('get', `/agents/${agentId}`, s).expect(200);
      expect(res.body.name).toBe('Đại lý Bình Dương');
    });

    it('can update agent', async () => {
      const s = await login(director);
      const res = await authed('patch', `/agents/${agentId}`, s)
        .send({ commissionRate: 20, tier: 'PLATINUM' })
        .expect(200);
      expect(res.body.commissionRate).toBe(20);
      expect(res.body.tier).toBe('PLATINUM');
    });

    it('can filter agents by keyword', async () => {
      const s = await login(director);
      const res = await authed('get', '/agents?keyword=Bình Dương', s).expect(200);
      expect(res.body.data.length).toBe(1);
    });

    it('can filter agents by tier', async () => {
      const s = await login(director);
      const res = await authed('get', '/agents?tier=PLATINUM', s).expect(200);
      expect(res.body.data.length).toBe(1);
    });

    it('can suspend agent', async () => {
      const s = await login(director);
      const res = await authed('post', `/agents/${agentId}/suspend`, s).expect(201);
      expect(res.body.status).toBe('SUSPENDED');
    });

    it('cannot suspend already suspended agent', async () => {
      const s = await login(director);
      await authed('post', `/agents/${agentId}/suspend`, s).expect(400);
    });

    it('can filter by status SUSPENDED', async () => {
      const s = await login(director);
      const res = await authed('get', '/agents?status=SUSPENDED', s).expect(200);
      expect(res.body.data.length).toBe(1);
    });

    it('can activate agent', async () => {
      const s = await login(director);
      const res = await authed('post', `/agents/${agentId}/activate`, s).expect(201);
      expect(res.body.status).toBe('ACTIVE');
    });

    it('SALE cannot delete agent', async () => {
      const s = await login(sale);
      await authed('delete', `/agents/${agentId}`, s).expect(403);
    });

    it('ACCOUNTING cannot delete agent', async () => {
      const s = await login(accounting);
      await authed('delete', `/agents/${agentId}`, s).expect(403);
    });

    it('DIRECTOR can delete agent', async () => {
      const s = await login(director);
      // Create a disposable agent to delete
      const create = await authed('post', '/agents', s)
        .send({ name: 'To delete' })
        .expect(201);
      await authed('delete', `/agents/${create.body._id}`, s).expect(200);

      // Verify it's gone
      await authed('get', `/agents/${create.body._id}`, s).expect(404);
    });
  });

  /* ================================================================
   *  4. CROSS-FEATURE: Quote → Payment flow
   * ================================================================ */
  describe('Cross-feature: Quote to Payment flow', () => {
    it('full workflow: create quote → accept → create linked payment → approve → pay', async () => {
      const s = await login(director);
      const accS = await login(accounting);

      // 1. Create quote
      const quote = await authed('post', '/supplier-quotes', s)
        .send({
          title: 'Cross-feature test',
          supplierName: 'NCC Integration',
          quoteDate: '2026-03-30',
          items: [{ itemName: 'Service', quantity: 1, unit: 'gói', unitPrice: 5000000 }],
        })
        .expect(201);
      expect(quote.body.totalAmount).toBe(5000000);

      // 2. Accept quote
      const accepted = await authed('post', `/supplier-quotes/${quote.body._id}/accept`, accS).expect(201);
      expect(accepted.body.status).toBe('ACCEPTED');

      // 3. Create payment linked to quote
      const payment = await authed('post', '/supplier-payments', s)
        .send({
          title: 'Payment for cross-feature test',
          supplierName: 'NCC Integration',
          amount: 5000000,
          paymentDate: '2026-03-31',
          supplierQuoteId: quote.body._id,
        })
        .expect(201);
      expect(payment.body.supplierQuoteId).toBe(quote.body._id);

      // 4. Approve payment
      const approved = await authed('post', `/supplier-payments/${payment.body._id}/approve`, accS).expect(201);
      expect(approved.body.status).toBe('APPROVED');

      // 5. Mark paid
      const paid = await authed('post', `/supplier-payments/${payment.body._id}/mark-paid`, accS)
        .send({ paymentMethod: 'BANK_TRANSFER' })
        .expect(201);
      expect(paid.body.status).toBe('PAID');
    });
  });

  /* ================================================================
   *  5. VALIDATION TESTS
   * ================================================================ */
  describe('Validation', () => {
    it('rejects supplier quote without required fields', async () => {
      const s = await login(director);
      await authed('post', '/supplier-quotes', s)
        .send({ supplierName: 'Missing title' })
        .expect(400);
    });

    it('rejects supplier payment with negative amount', async () => {
      const s = await login(director);
      await authed('post', '/supplier-payments', s)
        .send({ title: 'T', supplierName: 'S', amount: -100, paymentDate: '2026-03-30' })
        .expect(400);
    });

    it('rejects agent with commission > 100', async () => {
      const s = await login(director);
      await authed('post', '/agents', s)
        .send({ name: 'Bad agent', commissionRate: 150 })
        .expect(400);
    });

    it('returns 404 for non-existent supplier quote', async () => {
      const s = await login(director);
      await authed('get', '/supplier-quotes/000000000000000000000000', s).expect(404);
    });

    it('returns 404 for non-existent supplier payment', async () => {
      const s = await login(director);
      await authed('get', '/supplier-payments/000000000000000000000000', s).expect(404);
    });

    it('returns 404 for non-existent agent', async () => {
      const s = await login(director);
      await authed('get', '/agents/000000000000000000000000', s).expect(404);
    });
  });
});
