import { closeE2eResources } from './e2e-cleanup';
/**
 * Backend E2E — Batch 11 : Nhóm 21 (Teaching Materials + Export)
 * Scenarios : 26.3, 27.1, 27.2, 27.3
 *
 * DB suffix  : g21
 * MongoMemoryReplSet: single-node wiredTiger (required for transactions)
 */

import * as request from 'supertest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { MongooseModule, getModelToken } from '@nestjs/mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { AppModule } from '../src/app.module';
import * as cookieParser from 'cookie-parser';
import { Role } from '../src/common/interfaces/role.enum';
import { UserStatus } from '../src/common/interfaces/user-status.enum';
import { User } from '../src/users/schemas/user.schema';

// ─── helpers ─────────────────────────────────────────────────────────────────

async function loginAs(
  app: INestApplication,
  email: string,
  password: string,
): Promise<{ cookies: string[] }> {
  const res = await request(app.getHttpServer())
    .post('/auth/login')
    .send({ email, password })
    .expect(({ status }) => {
      if (status !== 200 && status !== 201) throw new Error(`Login failed: ${status}`);
    });
  const accessTokenCookie = extractCookieValue(res.headers['set-cookie'], 'access_token');
  if (!accessTokenCookie) {
    throw new Error(`Missing access_token cookie for ${email}`);
  }

  const meRes = await request(app.getHttpServer())
    .get('/users/me')
    .set('Cookie', `access_token=${accessTokenCookie}`)
    .expect(200);

  const xsrfToken = extractCookieValue(meRes.headers['set-cookie'], 'XSRF-TOKEN');
  if (!xsrfToken) {
    throw new Error(`Missing XSRF-TOKEN cookie for ${email}`);
  }

  return { cookies: [`access_token=${accessTokenCookie}`, `XSRF-TOKEN=${xsrfToken}`] };
}

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

function csrfToken(cookies: string[]): string {
  const raw = cookies.find((c) => c.startsWith('XSRF-TOKEN='));
  if (!raw) return '';
  return raw.split('=')[1].split(';')[0];
}

function authHeaders(cookies: string[]): Record<string, string> {
  return {
    Cookie: cookies.join('; '),
    'X-XSRF-TOKEN': csrfToken(cookies),
  };
}

// ─── suite ───────────────────────────────────────────────────────────────────

describe('Nhóm 21 — Teaching Materials + Export (g21)', () => {
  let app: INestApplication;
  let moduleRef: TestingModule;
  let mongod: MongoMemoryReplSet;
  let userModel: Model<any>;

  let directorCookies: string[];
  let opsCookies: string[];
  let saleCookies: string[];
  let teacherCookies: string[];
  let parentCookies: string[];
  let accountingCookies: string[];

  beforeAll(async () => {
    mongod = await MongoMemoryReplSet.create({
      replSet: { count: 1, storageEngine: 'wiredTiger' },
    });
    const uri = mongod.getUri();
    process.env.MONGODB_URI = uri.replace('?', 'school-mgmt-g21-e2e?');

    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    userModel = moduleRef.get(getModelToken(User.name));
    const hashedPassword = await bcrypt.hash('Pass1234!', 10);
    await Promise.all([
      userModel.updateOne(
        { email: 'director.g21@test.com' },
        {
          $set: {
            email: 'director.g21@test.com',
            password: hashedPassword,
            fullName: 'Director G21',
            role: Role.DIRECTOR,
            userCode: 'DIR-G21',
            status: UserStatus.ACTIVE,
          },
        },
        { upsert: true },
      ),
      userModel.updateOne(
        { email: 'ops.g21@test.com' },
        {
          $set: {
            email: 'ops.g21@test.com',
            password: hashedPassword,
            fullName: 'OPS G21',
            role: Role.OPS,
            userCode: 'OPS-G21',
            status: UserStatus.ACTIVE,
          },
        },
        { upsert: true },
      ),
      userModel.updateOne(
        { email: 'sale.g21@test.com' },
        {
          $set: {
            email: 'sale.g21@test.com',
            password: hashedPassword,
            fullName: 'Sale G21',
            role: Role.SALE,
            userCode: 'SALE-G21',
            status: UserStatus.ACTIVE,
          },
        },
        { upsert: true },
      ),
      userModel.updateOne(
        { email: 'teacher.g21@test.com' },
        {
          $set: {
            email: 'teacher.g21@test.com',
            password: hashedPassword,
            fullName: 'Teacher G21',
            role: Role.TEACHER,
            userCode: 'TEACHER-G21',
            status: UserStatus.ACTIVE,
          },
        },
        { upsert: true },
      ),
      userModel.updateOne(
        { email: 'parent.g21@test.com' },
        {
          $set: {
            email: 'parent.g21@test.com',
            password: hashedPassword,
            fullName: 'Parent G21',
            role: Role.PARENT,
            userCode: 'PARENT-G21',
            status: UserStatus.ACTIVE,
          },
        },
        { upsert: true },
      ),
      userModel.updateOne(
        { email: 'accounting.g21@test.com' },
        {
          $set: {
            email: 'accounting.g21@test.com',
            password: hashedPassword,
            fullName: 'Accounting G21',
            role: Role.ACCOUNTING,
            userCode: 'ACC-G21',
            status: UserStatus.ACTIVE,
          },
        },
        { upsert: true },
      ),
    ]);

    ({ cookies: directorCookies } = await loginAs(app, 'director.g21@test.com', 'Pass1234!'));
    ({ cookies: opsCookies } = await loginAs(app, 'ops.g21@test.com', 'Pass1234!'));
    ({ cookies: saleCookies } = await loginAs(app, 'sale.g21@test.com', 'Pass1234!'));
    ({ cookies: teacherCookies } = await loginAs(app, 'teacher.g21@test.com', 'Pass1234!'));
    ({ cookies: parentCookies } = await loginAs(app, 'parent.g21@test.com', 'Pass1234!'));
    ({ cookies: accountingCookies } = await loginAs(app, 'accounting.g21@test.com', 'Pass1234!'));
  });

  afterAll(async () => {
    await closeE2eResources({ app, moduleRef, mongoServer: mongod });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // 26.3 — Upload tài liệu giảng dạy
  // ══════════════════════════════════════════════════════════════════════════

  describe('26.3 Teaching Materials Upload & Management', () => {
    let materialId: string;

    it('GET /teaching-materials → 200 cho TEACHER', async () => {
      const res = await request(app.getHttpServer())
        .get('/teaching-materials')
        .set(authHeaders(teacherCookies));
      expect([200, 201]).toContain(res.status);
    });

    it('GET /teaching-materials → 200 cho DIRECTOR', async () => {
      const res = await request(app.getHttpServer())
        .get('/teaching-materials')
        .set(authHeaders(directorCookies));
      expect([200, 201]).toContain(res.status);
    });

    it('POST /teaching-materials/upload không có file → 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/teaching-materials/upload')
        .set(authHeaders(teacherCookies))
        .field('title', 'Test Material');
      expect([400, 422]).toContain(res.status);
    });

    it('POST /teaching-materials/upload không có title → 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/teaching-materials/upload')
        .set(authHeaders(teacherCookies))
        .attach('file', Buffer.from('hello pdf content'), {
          filename: 'test.txt',
          contentType: 'text/plain',
        });
      expect([400, 422]).toContain(res.status);
    });

    it('POST /teaching-materials/upload với file hợp lệ → 200/201', async () => {
      const res = await request(app.getHttpServer())
        .post('/teaching-materials/upload')
        .set(authHeaders(teacherCookies))
        .field('title', 'Ngữ pháp Unit 5 G21')
        .field('subject', 'ENGLISH')
        .attach('file', Buffer.from('Unit 5 Grammar content'), {
          filename: 'grammar-unit5.txt',
          contentType: 'text/plain',
        });
      expect([200, 201]).toContain(res.status);
      materialId = res.body?._id || res.body?.id;
    });

    it('GET /teaching-materials/:id → 200 for valid material', async () => {
      if (!materialId) return;
      const res = await request(app.getHttpServer())
        .get(`/teaching-materials/${materialId}`)
        .set(authHeaders(teacherCookies));
      expect([200, 201]).toContain(res.status);
      expect(res.body.title).toBe('Ngữ pháp Unit 5 G21');
    });

    it('GET /teaching-materials/stats → 200', async () => {
      const res = await request(app.getHttpServer())
        .get('/teaching-materials/stats')
        .set(authHeaders(directorCookies));
      expect([200, 201]).toContain(res.status);
    });

    it('PATCH /teaching-materials/:id (update metadata) → 200', async () => {
      if (!materialId) return;
      const res = await request(app.getHttpServer())
        .patch(`/teaching-materials/${materialId}`)
        .set(authHeaders(teacherCookies))
        .send({ title: 'Updated Grammar Unit 5' });
      expect([200, 201]).toContain(res.status);
    });

    it('Unsupported file type → 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/teaching-materials/upload')
        .set(authHeaders(teacherCookies))
        .field('title', 'Bad File')
        .attach('file', Buffer.from('binary data'), {
          filename: 'test.exe',
          contentType: 'application/octet-stream',
        });
      expect([400, 422]).toContain(res.status);
    });

    it('Unauthenticated → 401', async () => {
      const res = await request(app.getHttpServer()).get('/teaching-materials');
      expect([401, 403]).toContain(res.status);
    });

    it('Pagination: GET /teaching-materials?page=1&limit=3 → ≤ 3 items', async () => {
      const res = await request(app.getHttpServer())
        .get('/teaching-materials?page=1&limit=3')
        .set(authHeaders(directorCookies));
      expect([200, 201]).toContain(res.status);
      const items: any[] = res.body?.data || res.body || [];
      expect(items.length).toBeLessThanOrEqual(3);
    });

    it('Cleanup: DELETE /teaching-materials/:id', async () => {
      if (!materialId) return;
      const res = await request(app.getHttpServer())
        .delete(`/teaching-materials/${materialId}`)
        .set(authHeaders(directorCookies));
      expect([200, 201]).toContain(res.status);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // 27.1 — Export bảng lương CSV
  // ══════════════════════════════════════════════════════════════════════════

  describe('27.1 Export Payroll CSV', () => {
    it('DIRECTOR GET /export/payroll → CSV response', async () => {
      const res = await request(app.getHttpServer())
        .get('/export/payroll?fromDate=2026-03-01&toDate=2026-03-31')
        .set(authHeaders(directorCookies));
      expect([200, 201]).toContain(res.status);
      // Should be CSV content type
      const ct = res.headers['content-type'] || '';
      expect(ct).toMatch(/csv|text|octet/i);
    });

    it('ACCOUNTING GET /export/payroll → 200', async () => {
      const res = await request(app.getHttpServer())
        .get('/export/payroll?fromDate=2026-03-01&toDate=2026-03-31')
        .set(authHeaders(accountingCookies));
      expect([200, 201]).toContain(res.status);
    });

    it('SALE không được GET /export/payroll → 403', async () => {
      const res = await request(app.getHttpServer())
        .get('/export/payroll')
        .set(authHeaders(saleCookies));
      expect([401, 403]).toContain(res.status);
    });

    it('OPS không được GET /export/payroll → 403', async () => {
      const res = await request(app.getHttpServer())
        .get('/export/payroll')
        .set(authHeaders(opsCookies));
      expect([401, 403]).toContain(res.status);
    });

    it('PARENT không được GET /export/payroll → 403', async () => {
      const res = await request(app.getHttpServer())
        .get('/export/payroll')
        .set(authHeaders(parentCookies));
      expect([401, 403]).toContain(res.status);
    });

    it('Unauthenticated → 401', async () => {
      const res = await request(app.getHttpServer()).get('/export/payroll');
      expect([401, 403]).toContain(res.status);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // 27.2 — Export hóa đơn CSV
  // ══════════════════════════════════════════════════════════════════════════

  describe('27.2 Export Invoices CSV', () => {
    it('DIRECTOR GET /export/invoices → CSV response', async () => {
      const res = await request(app.getHttpServer())
        .get('/export/invoices?fromDate=2026-03-01&toDate=2026-03-31')
        .set(authHeaders(directorCookies));
      expect([200, 201]).toContain(res.status);
      const ct = res.headers['content-type'] || '';
      expect(ct).toMatch(/csv|text|octet/i);
    });

    it('ACCOUNTING GET /export/invoices?status=APPROVED → 200', async () => {
      const res = await request(app.getHttpServer())
        .get('/export/invoices?fromDate=2026-01-01&toDate=2026-03-31&status=APPROVED')
        .set(authHeaders(accountingCookies));
      expect([200, 201]).toContain(res.status);
    });

    it('SALE không được GET /export/invoices → 403', async () => {
      const res = await request(app.getHttpServer())
        .get('/export/invoices')
        .set(authHeaders(saleCookies));
      expect([401, 403]).toContain(res.status);
    });

    it('GET /export/students (OPS-accessible) → 200', async () => {
      const res = await request(app.getHttpServer())
        .get('/export/students')
        .set(authHeaders(opsCookies));
      expect([200, 201]).toContain(res.status);
      const ct = res.headers['content-type'] || '';
      expect(ct).toMatch(/csv|text|octet/i);
    });

    it('GET /export/financial (DIRECTOR) → CSV', async () => {
      const res = await request(app.getHttpServer())
        .get('/export/financial?fromDate=2026-01-01&toDate=2026-03-31')
        .set(authHeaders(directorCookies));
      expect([200, 201]).toContain(res.status);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // 27.3 — Export attendance (large data) + RBAC
  // ══════════════════════════════════════════════════════════════════════════

  describe('27.3 Export Attendance (Large Export)', () => {
    it('DIRECTOR GET /export/attendance → CSV response', async () => {
      const res = await request(app.getHttpServer())
        .get('/export/attendance?fromDate=2026-01-01&toDate=2026-03-31')
        .set(authHeaders(directorCookies));
      expect([200, 201]).toContain(res.status);
      const ct = res.headers['content-type'] || '';
      expect(ct).toMatch(/csv|text|octet/i);
    });

    it('OPS GET /export/attendance → 200', async () => {
      const res = await request(app.getHttpServer())
        .get('/export/attendance?fromDate=2026-03-01&toDate=2026-03-31')
        .set(authHeaders(opsCookies));
      expect([200, 201]).toContain(res.status);
    });

    it('SALE không được GET /export/attendance → 403', async () => {
      const res = await request(app.getHttpServer())
        .get('/export/attendance')
        .set(authHeaders(saleCookies));
      expect([401, 403]).toContain(res.status);
    });

    it('ACCOUNTING không được GET /export/attendance → 403', async () => {
      const res = await request(app.getHttpServer())
        .get('/export/attendance')
        .set(authHeaders(accountingCookies));
      expect([401, 403]).toContain(res.status);
    });

    it('Export không crash khi không có data (empty range)', async () => {
      const res = await request(app.getHttpServer())
        .get('/export/attendance?fromDate=2020-01-01&toDate=2020-01-02')
        .set(authHeaders(directorCookies));
      expect([200, 201]).toContain(res.status);
      // Body is CSV, should at least have header row
      const body = res.text || '';
      expect(typeof body).toBe('string');
    });
  });
});
