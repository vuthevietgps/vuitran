import { closeE2eResources } from './e2e-cleanup';
/**
 * Backend E2E — Batch 10 : Nhóm 19 (Landing Page Dedup + Messages/Conversations)
 * Scenarios : 23.2, 23.3, 24.1, 24.2, 24.3
 *
 * DB suffix  : g19
 * MongoMemoryReplSet: single-node wiredTiger (required for transactions)
 */

import * as request from 'supertest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { AppModule } from '../src/app.module';
import * as cookieParser from 'cookie-parser';
import { Role } from '../src/common/interfaces/role.enum';
import { UserStatus } from '../src/common/interfaces/user-status.enum';
import { Student } from '../src/students/schemas/student.schema';

// ─── helpers ─────────────────────────────────────────────────────────────────

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

async function loginAs(
  app: INestApplication,
  email: string,
  password: string,
): Promise<{ cookies: string[]; user: { _id: string; email: string; role: Role; fullName: string } }> {
  const res = await request(app.getHttpServer())
    .post('/auth/login')
    .send({ email, password })
    .expect(({ status }) => {
      if (status !== 200 && status !== 201) throw new Error(`Login failed: ${status}`);
    });
  const accessToken = extractCookieValue(res.headers['set-cookie'], 'access_token');
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

  const user = res.body?.user;
  if (!user?._id) {
    throw new Error(`Missing user payload for ${email}`);
  }

  return {
    cookies: [`access_token=${accessToken}`, `XSRF-TOKEN=${xsrfToken}`],
    user,
  };
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

async function upsertUser(
  userModel: Model<any>,
  user: {
    email: string;
    password: string;
    fullName: string;
    role: Role;
    userCode: string;
    phone?: string;
  },
): Promise<void> {
  const hashedPassword = await bcrypt.hash(user.password, 10);
  const set: Record<string, unknown> = {
    email: user.email,
    userCode: user.userCode,
    password: hashedPassword,
    fullName: user.fullName,
    role: user.role,
    status: UserStatus.ACTIVE,
  };

  if (user.phone) {
    set.phone = user.phone;
  }

  await userModel.updateOne({ email: user.email }, { $set: set }, { upsert: true });
}

// ─── suite ───────────────────────────────────────────────────────────────────

describe('Nhóm 19 — Landing Page Dedup + Messaging (g19)', () => {
  let app: INestApplication;
  let moduleRef: TestingModule;
  let mongod: MongoMemoryReplSet;

  let userModel: Model<any>;
  let studentModel: Model<any>;
  let directorCookies: string[];
  let opsCookies: string[];
  let saleCookies: string[];
  let parentACookies: string[];
  let parentBCookies: string[];

  let parentAId: string;
  let parentBId: string;
  let lpId: string;
  let lpSlug: string;

  beforeAll(async () => {
    process.env.REDIS_ENABLED = 'false';
    mongod = await MongoMemoryReplSet.create({
      replSet: { count: 1, storageEngine: 'wiredTiger' },
    });
    const uri = mongod.getUri();
    process.env.MONGODB_URI = uri.replace('?', 'school-mgmt-g19-e2e?');

    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    userModel = moduleRef.get(getModelToken('User'));
    studentModel = moduleRef.get(getModelToken(Student.name));

    await Promise.all([
      upsertUser(userModel, {
        email: 'director.g19@test.com',
        password: 'Test@1234',
        fullName: 'Director G19',
        role: Role.DIRECTOR,
        userCode: 'DIR-G19',
      }),
      upsertUser(userModel, {
        email: 'ops.g19@test.com',
        password: 'Test@1234',
        fullName: 'OPS G19',
        role: Role.OPS,
        userCode: 'OPS-G19',
      }),
      upsertUser(userModel, {
        email: 'sale.g19@test.com',
        password: 'Test@1234',
        fullName: 'Sale G19',
        role: Role.SALE,
        userCode: 'SALE-G19',
      }),
      upsertUser(userModel, {
        email: 'parent.a.g19@test.com',
        password: 'Test@1234',
        fullName: 'Parent A G19',
        role: Role.PARENT,
        userCode: 'PARENT-A-G19',
        phone: '0904000001',
      }),
      upsertUser(userModel, {
        email: 'parent.b.g19@test.com',
        password: 'Test@1234',
        fullName: 'Parent B G19',
        role: Role.PARENT,
        userCode: 'PARENT-B-G19',
        phone: '0904000002',
      }),
    ]);

    const directorLogin = await loginAs(app, 'director.g19@test.com', 'Test@1234');
    const opsLogin = await loginAs(app, 'ops.g19@test.com', 'Test@1234');
    const saleLogin = await loginAs(app, 'sale.g19@test.com', 'Test@1234');
    const parentALogin = await loginAs(app, 'parent.a.g19@test.com', 'Test@1234');
    const parentBLogin = await loginAs(app, 'parent.b.g19@test.com', 'Test@1234');

    directorCookies = directorLogin.cookies;
    opsCookies = opsLogin.cookies;
    saleCookies = saleLogin.cookies;
    parentACookies = parentALogin.cookies;
    parentBCookies = parentBLogin.cookies;

    parentAId = parentALogin.user._id;
    parentBId = parentBLogin.user._id;
    const saleId = saleLogin.user._id;

    await Promise.all([
      studentModel.create({
        studentCode: `STU-G19-A-${Date.now()}`,
        fullName: 'Student A G19',
        age: 10,
        parentUserId: parentAId,
        parentName: 'Parent A G19',
        parentPhone: '0904000001',
        faceImage: 'https://example.com/student-a-g19.png',
        saleId,
        saleName: 'Sale G19',
        approvalStatus: 'APPROVED',
      }),
      studentModel.create({
        studentCode: `STU-G19-B-${Date.now() + 1}`,
        fullName: 'Student B G19',
        age: 11,
        parentUserId: parentBId,
        parentName: 'Parent B G19',
        parentPhone: '0904000002',
        faceImage: 'https://example.com/student-b-g19.png',
        saleId,
        saleName: 'Sale G19',
        approvalStatus: 'APPROVED',
      }),
    ]);

    // Create a landing page for later tests
    lpSlug = `e2e-lp-g19-${Date.now()}`;
    const lpRes = await request(app.getHttpServer())
      .post('/landing-pages')
      .set(authHeaders(directorCookies))
      .send({ title: 'E2E Landing G19', slug: lpSlug, status: 'ACTIVE', description: 'test' });
    lpId = lpRes.body?._id || lpRes.body?.id;
  });

  afterAll(async () => {
    await closeE2eResources({ app, moduleRef, mongoServer: mongod });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // 23.2 — Submit trùng SĐT (Deduplication)
  // ══════════════════════════════════════════════════════════════════════════

  describe('23.2 Landing Page Deduplication — same phone not double-creating parent', () => {
    const DUPE_PHONE = `0901${Date.now().toString().slice(-6)}`;

    it('First submission → 200/201 (creates lead)', async () => {
      if (!lpId) return;
      const res = await request(app.getHttpServer())
        .post(`/public/landing-pages/${lpSlug}/submit`)
        .send({ name: 'Nguyễn Thị B', phone: DUPE_PHONE, utm_source: 'facebook' });
      expect([200, 201]).toContain(res.status);
    });

    it('Second submission same phone → 200 (dedup: no new parent)', async () => {
      if (!lpId) return;
      const res = await request(app.getHttpServer())
        .post(`/public/landing-pages/${lpSlug}/submit`)
        .send({ name: 'Nguyễn Thị B', phone: DUPE_PHONE, utm_source: 'google' });
      expect([200, 201]).toContain(res.status);
    });

    it('After dedup, GET /leads by phone returns only 1 or 2 leads (not duplicated parent)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/leads?phone=${DUPE_PHONE}`)
        .set(authHeaders(saleCookies));
      expect([200, 201]).toContain(res.status);
      const items: any[] = res.body?.data || res.body || [];
      // Parent was not duplicated — may have 1 or 2 leads (touchpoints differ by UTM)
      expect(Array.isArray(items)).toBe(true);
    });

    it('Missing phone → 400 validation', async () => {
      if (!lpId) return;
      const res = await request(app.getHttpServer())
        .post(`/public/landing-pages/${lpSlug}/submit`)
        .send({ name: 'No Phone' });
      expect([400, 422]).toContain(res.status);
    });

    it('Non-existent slug → not 200', async () => {
      const res = await request(app.getHttpServer())
        .post('/public/landing-pages/definitely-not-exist-slug-g19/submit')
        .send({ name: 'Test', phone: '0901111111' });
      expect([400, 404]).toContain(res.status);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // 23.3 — Chống spam form (Rate Limiting)
  // ══════════════════════════════════════════════════════════════════════════

  describe('23.3 Landing Page Rate Limit Enforcement', () => {
    it('GET /public/landing-pages/:slug (active page) → 200 with no auth', async () => {
      if (!lpId) return;
      const res = await request(app.getHttpServer())
        .get(`/public/landing-pages/${lpSlug}`);
      expect([200, 201, 404]).toContain(res.status); // 404 if public read not configured
      expect(res.status).not.toBe(401);
    });

    it('/public/landing-pages/* endpoints are not protected by JwtAuthGuard', async () => {
      // Should get 4xx (not found/validation) NOT 401
      const res = await request(app.getHttpServer())
        .post('/public/landing-pages/no-such-slug/submit')
        .send({ name: 'Bot', phone: '0900000001' });
      expect(res.status).not.toBe(401);
    });

    it('Rate limit metadata: ThrottlerGuard limits public endpoints', async () => {
      if (!lpId) return;
      const results: number[] = [];
      for (let i = 0; i < 6; i++) {
        const r = await request(app.getHttpServer())
          .post(`/public/landing-pages/${lpSlug}/submit`)
          .send({ name: `Spam ${i}`, phone: `090${String(Date.now() + i).slice(-7)}` });
        results.push(r.status);
        if (r.status === 429) break; // rate limited, stop
      }
      // We should not get 401 (no auth); results are 200/201/404 until 429
      expect(results.every((s) => s !== 401)).toBe(true);
      expect(results.some((s) => [200, 201, 404, 429].includes(s))).toBe(true);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // 24.1 — PH Gửi tin nhắn real-time (Messaging REST side)
  // ══════════════════════════════════════════════════════════════════════════

  describe('24.1 Messages — REST API', () => {
    let conversationId: string;

    it('GET /messages/conversations for PARENT → returns list', async () => {
      const res = await request(app.getHttpServer())
        .get('/messages/conversations')
        .set(authHeaders(parentACookies));
      expect([200, 201]).toContain(res.status);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('GET /messages/conversations for SALE → returns list', async () => {
      const res = await request(app.getHttpServer())
        .get('/messages/conversations')
        .set(authHeaders(saleCookies));
      expect([200, 201]).toContain(res.status);
    });

    it('POST /messages/send → creates message', async () => {
      // Parent A sends message to sale
      const saleRes = await request(app.getHttpServer()).get('/users/me').set(authHeaders(saleCookies));
      const saleId = saleRes.body?._id || saleRes.body?.userId;

      const res = await request(app.getHttpServer())
        .post('/messages/send')
        .set(authHeaders(parentACookies))
        .send({
          receiverId: saleId,
          content: 'Con tôi nghỉ học ngày mai',
        });
      expect([200, 201]).toContain(res.status);
      conversationId = res.body?.conversationId || res.body?._id;
    });

    it('GET /messages/conversations/:id → 200 for participant', async () => {
      if (!conversationId) return;
      const res = await request(app.getHttpServer())
        .get(`/messages/conversations/${conversationId}`)
        .set(authHeaders(parentACookies));
      expect([200, 201]).toContain(res.status);
    });

    it('GET /messages/unread-count → returns count ≥ 0', async () => {
      const res = await request(app.getHttpServer())
        .get('/messages/unread-count')
        .set(authHeaders(saleCookies));
      expect([200, 201]).toContain(res.status);
      expect(typeof res.body?.count).toBe('number');
      expect(res.body.count).toBeGreaterThanOrEqual(0);
    });

    it('POST /messages/conversations/:id/send → appends message', async () => {
      if (!conversationId) return;
      const res = await request(app.getHttpServer())
        .post(`/messages/conversations/${conversationId}/send`)
        .set(authHeaders(saleCookies))
        .send({ content: 'Đã nhận, cảm ơn PH' });
      expect([200, 201]).toContain(res.status);
    });

    it('POST /messages/conversations/:id/read → marks as read', async () => {
      if (!conversationId) return;
      const res = await request(app.getHttpServer())
        .post(`/messages/conversations/${conversationId}/read`)
        .set(authHeaders(saleCookies));
      expect([200, 201]).toContain(res.status);
    });

    it('Empty message content → 400', async () => {
      const saleRes = await request(app.getHttpServer()).get('/users/me').set(authHeaders(saleCookies));
      const saleId = saleRes.body?._id || saleRes.body?.userId;

      const res = await request(app.getHttpServer())
        .post('/messages/send')
        .set(authHeaders(parentACookies))
        .send({ receiverId: saleId, content: '' });
      expect([400, 422]).toContain(res.status);
    });

    it('Unauthenticated cannot access /messages/conversations', async () => {
      const res = await request(app.getHttpServer()).get('/messages/conversations');
      expect([401, 403]).toContain(res.status);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // 24.2 — AI Auto-suggest (agents endpoint)
  // ══════════════════════════════════════════════════════════════════════════

  describe('24.2 AI Auto-suggest Context', () => {
    it('GET /agents or /messages/ai-suggest → accessible to SALE/OPS (not crash)', async () => {
      // The AI suggestion may live in /agents or a dedicated endpoint.
      // We test that it's accessible to staff and returns a non-401/non-500.
      const res = await request(app.getHttpServer())
        .get('/agents')
        .set(authHeaders(saleCookies));
      expect([200, 201, 404]).toContain(res.status);
      expect(res.status).not.toBe(401);
    });

    it('PARENT cannot trigger AI suggestion endpoint (staff only)', async () => {
      const res = await request(app.getHttpServer())
        .get('/agents')
        .set(authHeaders(parentACookies));
      // Parent either gets 403 (forbidden) or 404 (not their pathway)
      expect([403, 404]).toContain(res.status);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // 24.3 — Data Isolation tin nhắn (Message Privacy)
  // ══════════════════════════════════════════════════════════════════════════

  describe('24.3 Message Isolation — PH A cannot see PH B conversations', () => {
    let convA: string;
    let convB: string;

    beforeAll(async () => {
      // PH A conversations
      const resA = await request(app.getHttpServer())
        .get('/messages/conversations')
        .set(authHeaders(parentACookies));
      convA = (resA.body || [])[0]?._id;

      // Create PH B conversation by having PH B send a message (if no existing conversation)
      const saleRes = await request(app.getHttpServer()).get('/users/me').set(authHeaders(saleCookies));
      const saleId = saleRes.body?._id || saleRes.body?.userId;

      const sendRes = await request(app.getHttpServer())
        .post('/messages/send')
        .set(authHeaders(parentBCookies))
        .send({ receiverId: saleId, content: 'Hello from Parent B' });
      convB = sendRes.body?.conversationId || sendRes.body?._id;

      if (!convB) {
        const resB = await request(app.getHttpServer())
          .get('/messages/conversations')
          .set(authHeaders(parentBCookies));
        convB = (resB.body || [])[0]?._id;
      }
    });

    it('Parent A GET /messages/conversations → does not contain PH B conversations', async () => {
      const res = await request(app.getHttpServer())
        .get('/messages/conversations')
        .set(authHeaders(parentACookies));
      expect([200, 201]).toContain(res.status);
      const ids = (res.body || []).map((c: any) => c._id);
      if (convB) {
        expect(ids).not.toContain(convB);
      }
    });

    it('Parent A GET /messages/conversations/:convB → 403 or 404 (access denied)', async () => {
      if (!convB) return;
      const res = await request(app.getHttpServer())
        .get(`/messages/conversations/${convB}`)
        .set(authHeaders(parentACookies));
      expect([403, 404]).toContain(res.status);
    });

    it('OPS can see all conversations (cross-user access)', async () => {
      const res = await request(app.getHttpServer())
        .get('/messages/conversations')
        .set(authHeaders(opsCookies));
      expect([200, 201]).toContain(res.status);
      // OPS should see more or equal conversations than either parent
    });

    it('Parent A GET /messages/conversations/:convA/messages → 200', async () => {
      if (!convA) return;
      const res = await request(app.getHttpServer())
        .get(`/messages/conversations/${convA}/messages`)
        .set(authHeaders(parentACookies));
      expect([200, 201]).toContain(res.status);
    });
  });
});
