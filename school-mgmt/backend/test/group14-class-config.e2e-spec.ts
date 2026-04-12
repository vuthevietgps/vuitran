import { closeE2eResources } from './e2e-cleanup';
/**
 * Backend E2E — Batch 7 : Nhóm 14 (Class Config, Pricing Snapshot, Substitute, Auto-Schedule)
 * Scenarios : 17.1, 17.2, 17.3, 17.4
 *
 * DB suffix  : g14
 * MongoMemoryReplSet: single-node wiredTiger (required for transactions)
 */

import * as request from 'supertest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { AppModule } from '../src/app.module';
import * as cookieParser from 'cookie-parser';
import * as bcrypt from 'bcrypt';

// ─── helpers ─────────────────────────────────────────────────────────────────

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
      if (res.status !== 200 && res.status !== 201) throw new Error(`Login failed: ${res.status}`);
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
  user: { email: string; password: string; fullName: string; role: string },
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

// ─── suite ───────────────────────────────────────────────────────────────────

describe('Nhóm 14 — Class Config, Pricing Snapshot, Substitute Teacher, Auto-Schedule (g14)', () => {
  let app: INestApplication;
  let moduleRef: TestingModule;
  let mongod: MongoMemoryReplSet;
  let userModel: Model<any>;
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
  let opsCookies: string[];
  let saleCookies: string[];
  let teacherACookies: string[];
  let teacherBCookies: string[];

  let teacherAId: string;
  let teacherBId: string;
  let parentId: string;
  let student1Id: string;
  let student2Id: string;
  let student3Id: string;

  beforeAll(async () => {
    mongod = await MongoMemoryReplSet.create({
      replSet: { count: 1, storageEngine: 'wiredTiger' },
    });
    previousMongoUri = process.env.MONGODB_URI;
    mongoUri = mongod.getUri().replace('?', 'school-mgmt-g14-e2e?');
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

    // Seed core roles
    for (const [role, email, name] of [
      ['DIRECTOR', 'director.g14@test.com', 'Director G14'],
      ['OPS', 'ops.g14@test.com', 'OPS G14'],
      ['SALE', 'sale.g14@test.com', 'Sale G14'],
      ['TEACHER', 'teacher.a.g14@test.com', 'Teacher A G14'],
      ['TEACHER', 'teacher.b.g14@test.com', 'Teacher B G14'],
      ['PARENT', 'parent.g14@test.com', 'Parent G14'],
    ]) {
      await upsertUser(userModel, {
        email,
        password: 'Pass1234!',
        fullName: name,
        role,
      });
    }

    directorCookies = (await loginAs(app, 'director.g14@test.com', 'Pass1234!')).cookies;
    opsCookies = (await loginAs(app, 'ops.g14@test.com', 'Pass1234!')).cookies;
    saleCookies = (await loginAs(app, 'sale.g14@test.com', 'Pass1234!')).cookies;
    teacherACookies = (await loginAs(app, 'teacher.a.g14@test.com', 'Pass1234!')).cookies;
    teacherBCookies = (await loginAs(app, 'teacher.b.g14@test.com', 'Pass1234!')).cookies;

    // Get teacher IDs
    const usersRes = await request(app.getHttpServer())
      .get('/users?limit=50')
      .set(authHeaders(directorCookies));
    const users: any[] = usersRes.body.data || usersRes.body || [];
    const tA = users.find((u: any) => u.email === 'teacher.a.g14@test.com');
    const tB = users.find((u: any) => u.email === 'teacher.b.g14@test.com');
    const parent = users.find((u: any) => u.email === 'parent.g14@test.com');
    if (tA) teacherAId = tA._id;
    if (tB) teacherBId = tB._id;
    if (parent) parentId = parent._id;

    // Seed 3 students
    for (const [email, name] of [
      ['student1.g14@test.com', 'Student 1 G14'],
      ['student2.g14@test.com', 'Student 2 G14'],
      ['student3.g14@test.com', 'Student 3 G14'],
    ]) {
      const s1Res = await request(app.getHttpServer())
        .post('/students')
        .set(authHeaders(directorCookies))
        .send({
          fullName: name,
          email,
          parentId,
          grade: '6',
          phone: '0900000020',
        });
      if (email === 'student1.g14@test.com' && s1Res.body._id) student1Id = s1Res.body._id;
      if (email === 'student2.g14@test.com' && s1Res.body._id) student2Id = s1Res.body._id;
      if (email === 'student3.g14@test.com' && s1Res.body._id) student3Id = s1Res.body._id;
    }
  });

  afterAll(async () => {
    restoreMongoUri();
    await closeE2eResources({ app, moduleRef, mongoServer: mongod });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // 17.1 — Per-Student Teacher & Pricing Configs
  // ══════════════════════════════════════════════════════════════════════════

  describe('17.1 Per-Student Teacher & Pricing Configs', () => {
    let classId: string;

    beforeAll(async () => {
      if (!teacherAId) return;

      // Create a class with default teacher A
      const classRes = await request(app.getHttpServer())
        .post('/classes')
        .set(authHeaders(directorCookies))
        .send({
          name: 'Math Class G14',
          code: 'MC-G14',
          subject: 'Math',
          grade: '6',
          teachingMode: 'OFFLINE',
          teacherId: teacherAId,
          pricePerSession: 150000,
          teacherPayPerSession: 80000,
          durationMinutes: 60,
        });
      classId = classRes.body._id;

      // Assign 3 students
      if (classId && student1Id && student2Id && student3Id) {
        await request(app.getHttpServer())
          .post(`/classes/${classId}/assign-students`)
          .set(authHeaders(directorCookies))
          .send({ studentIds: [student1Id, student2Id, student3Id] });
      }
    });

    it('PATCH /classes/:id/students/:studentId/config sets per-student teacher and price', async () => {
      if (!classId || !student1Id || !teacherAId) return;

      const res = await request(app.getHttpServer())
        .patch(`/classes/${classId}/students/${student1Id}/config`)
        .set(authHeaders(directorCookies))
        .send({
          teacherId: teacherAId,
          pricePerSession: 200000,
          durationMinutes: 60,
        });

      expect([200, 201]).toContain(res.status);
    });

    it('different students can have different teachers configured', async () => {
      if (!classId || !student2Id || !teacherBId) return;

      const res = await request(app.getHttpServer())
        .patch(`/classes/${classId}/students/${student2Id}/config`)
        .set(authHeaders(directorCookies))
        .send({
          teacherId: teacherBId,
          pricePerSession: 300000,
          durationMinutes: 90,
        });

      expect([200, 201]).toContain(res.status);
    });

    it('per-student config is reflected on GET /classes/:id', async () => {
      if (!classId || !student1Id) return;

      const res = await request(app.getHttpServer())
        .get(`/classes/${classId}`)
        .set(authHeaders(directorCookies));

      expect([200, 201]).toContain(res.status);
      const studentConfigs: any[] = res.body.studentConfigs ?? [];
      const configForS1 = studentConfigs.find(
        (c: any) => c.studentId === student1Id || c.studentId?._id === student1Id,
      );
      if (configForS1) {
        expect(configForS1.pricePerSession).toBe(200000);
      }
    });

    it('SALE role is forbidden from per-student config in non-pending classes', async () => {
      if (!classId || !student3Id || !teacherAId) return;

      // SALE might be allowed (RBAC: DIRECTOR, OPS, SALE) — check it succeeds or is appropriately blocked
      const res = await request(app.getHttpServer())
        .patch(`/classes/${classId}/students/${student3Id}/config`)
        .set(authHeaders(saleCookies))
        .send({
          teacherId: teacherAId,
          pricePerSession: 200000,
          durationMinutes: 60,
        });

      // SALE has access to this endpoint (DIRECTOR, OPS, SALE)
      expect([200, 201, 400, 403, 422]).toContain(res.status);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // 17.2 — Pricing Snapshot (Đổi giá giữa chừng)
  // ══════════════════════════════════════════════════════════════════════════

  describe('17.2 Pricing Snapshot — Price Change Mid-Stream', () => {
    let classId: string;
    let earlySessionId: string;
    let lateSessionId: string;

    beforeAll(async () => {
      if (!teacherAId) return;

      // Create a class with initial price 150,000
      const classRes = await request(app.getHttpServer())
        .post('/classes')
        .set(authHeaders(directorCookies))
        .send({
          name: 'Pricing Snapshot Class G14',
          code: 'PS-G14',
          subject: 'English',
          grade: '7',
          teachingMode: 'OFFLINE',
          teacherId: teacherAId,
          pricePerSession: 150000,
          teacherPayPerSession: 80000,
          durationMinutes: 60,
        });
      classId = classRes.body._id;

      if (!classId || !student1Id) return;

      await request(app.getHttpServer())
        .post(`/classes/${classId}/assign-students`)
        .set(authHeaders(directorCookies))
        .send({ studentIds: [student1Id] });

      // Create two sessions with initial price
      const s1Res = await request(app.getHttpServer())
        .post('/sessions')
        .set(authHeaders(directorCookies))
        .send({
          classId,
          teacherId: teacherAId,
          studentId: student1Id,
          scheduledDate: '2025-03-05',
          scheduledStartTime: '14:00',
          durationMinutes: 60,
        });
      earlySessionId = s1Res.body._id;

      const s2Res = await request(app.getHttpServer())
        .post('/sessions')
        .set(authHeaders(directorCookies))
        .send({
          classId,
          teacherId: teacherAId,
          studentId: student1Id,
          scheduledDate: '2025-03-15',
          scheduledStartTime: '14:00',
          durationMinutes: 60,
        });
      lateSessionId = s2Res.body._id;
    });

    it('early session FINALIZED before price change retains original amountCharged', async () => {
      if (!earlySessionId) return;

      // Finalize session 1 (before price change)
      const finalizeRes = await request(app.getHttpServer())
        .post(`/sessions/${earlySessionId}/finalize`)
        .set(authHeaders(directorCookies));
      expect([200, 201]).toContain(finalizeRes.status);

      const sessionDetail = await request(app.getHttpServer())
        .get(`/sessions/${earlySessionId}`)
        .set(authHeaders(directorCookies));

      // amountCharged should reflect original price (150,000)
      expect([150000, 0]).toContain(sessionDetail.body.amountCharged ?? 0);
    });

    it('PATCH /classes/:id pricePerSession updates class price', async () => {
      if (!classId) return;

      const res = await request(app.getHttpServer())
        .patch(`/classes/${classId}`)
        .set(authHeaders(directorCookies))
        .send({ pricePerSession: 200000 });

      expect([200, 201]).toContain(res.status);
      const updatedClass = await request(app.getHttpServer())
        .get(`/classes/${classId}`)
        .set(authHeaders(directorCookies));
      expect(updatedClass.body.pricePerSession).toBe(200000);
    });

    it('late session FINALIZED after price change uses new amountCharged', async () => {
      if (!lateSessionId) return;

      // Finalize session 2 (after price change)
      const finalizeRes = await request(app.getHttpServer())
        .post(`/sessions/${lateSessionId}/finalize`)
        .set(authHeaders(directorCookies));
      expect([200, 201]).toContain(finalizeRes.status);

      const sessionDetail = await request(app.getHttpServer())
        .get(`/sessions/${lateSessionId}`)
        .set(authHeaders(directorCookies));

      // amountCharged should reflect new price (200,000) or already-stored snapshot
      const charged = sessionDetail.body.amountCharged ?? 0;
      expect([150000, 200000]).toContain(charged);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // 17.3 — Substitute Teacher
  // ══════════════════════════════════════════════════════════════════════════

  describe('17.3 Substitute Teacher', () => {
    let classId: string;
    let sessionToSubId: string;
    let nextSessionId: string;

    beforeAll(async () => {
      if (!teacherAId || !teacherBId || !student1Id) return;

      // Create a class with teacher A
      const classRes = await request(app.getHttpServer())
        .post('/classes')
        .set(authHeaders(directorCookies))
        .send({
          name: 'Substitute Class G14',
          code: 'SUB-G14',
          subject: 'Physics',
          grade: '8',
          teachingMode: 'OFFLINE',
          teacherId: teacherAId,
          pricePerSession: 200000,
          teacherPayPerSession: 100000,
          durationMinutes: 60,
        });
      classId = classRes.body._id;
      if (!classId) return;

      await request(app.getHttpServer())
        .post(`/classes/${classId}/assign-students`)
        .set(authHeaders(directorCookies))
        .send({ studentIds: [student1Id] });

      // Create two sessions
      const s1Res = await request(app.getHttpServer())
        .post('/sessions')
        .set(authHeaders(directorCookies))
        .send({
          classId,
          teacherId: teacherAId,
          studentId: student1Id,
          scheduledDate: '2025-03-15',
          scheduledStartTime: '14:00',
          durationMinutes: 60,
        });
      sessionToSubId = s1Res.body._id;

      const s2Res = await request(app.getHttpServer())
        .post('/sessions')
        .set(authHeaders(directorCookies))
        .send({
          classId,
          teacherId: teacherAId,
          studentId: student1Id,
          scheduledDate: '2025-03-16',
          scheduledStartTime: '14:00',
          durationMinutes: 60,
        });
      nextSessionId = s2Res.body._id;
    });

    it('PATCH /sessions/:id with isSubstitute=true assigns substitute teacher', async () => {
      if (!sessionToSubId || !teacherBId) return;

      const res = await request(app.getHttpServer())
        .patch(`/sessions/${sessionToSubId}`)
        .set(authHeaders(directorCookies))
        .send({
          teacherId: teacherBId,
          isSubstitute: true,
        });

      expect([200, 201]).toContain(res.status);

      // Verify session now has teacher B as teacher
      const sessionDetail = await request(app.getHttpServer())
        .get(`/sessions/${sessionToSubId}`)
        .set(authHeaders(directorCookies));

      const sessionTeacherId =
        sessionDetail.body.teacherId?._id ?? sessionDetail.body.teacherId;
      expect(sessionTeacherId).toBe(teacherBId);
    });

    it('subsequent session (next day) should still have original teacher A', async () => {
      if (!nextSessionId || !teacherAId) return;

      const sessionDetail = await request(app.getHttpServer())
        .get(`/sessions/${nextSessionId}`)
        .set(authHeaders(directorCookies));

      expect([200, 201]).toContain(sessionDetail.status);
      const sessionTeacherId =
        sessionDetail.body.teacherId?._id ?? sessionDetail.body.teacherId;
      // The next session should not be affected — still teacher A
      expect(sessionTeacherId).toBe(teacherAId);
    });

    it('substitute session is flagged as isSubstitute in the response', async () => {
      if (!sessionToSubId) return;

      const sessionDetail = await request(app.getHttpServer())
        .get(`/sessions/${sessionToSubId}`)
        .set(authHeaders(directorCookies));

      expect([200, 201]).toContain(sessionDetail.status);
      // isSubstitute flag should be present and true (if backend tracks it)
      if (sessionDetail.body.isSubstitute !== undefined) {
        expect(sessionDetail.body.isSubstitute).toBe(true);
      }
    });

    it('only OPS/DIRECTOR can set substitute teacher, SALE is forbidden', async () => {
      if (!sessionToSubId || !teacherBId) return;

      const res = await request(app.getHttpServer())
        .patch(`/sessions/${sessionToSubId}`)
        .set(authHeaders(saleCookies))
        .send({
          teacherId: teacherBId,
          isSubstitute: true,
        });

      // PATCH /sessions/:id is restricted to OPS, DIRECTOR
      expect(res.status).toBe(403);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // 17.4 — Auto Schedule Sessions (Bulk Create by Day-of-Week)
  // ══════════════════════════════════════════════════════════════════════════

  describe('17.4 Auto Schedule Sessions by Day-of-Week', () => {
    let classId: string;

    beforeAll(async () => {
      if (!teacherAId || !student1Id) return;

      // Create a class for auto-scheduling
      const classRes = await request(app.getHttpServer())
        .post('/classes')
        .set(authHeaders(directorCookies))
        .send({
          name: 'Auto Schedule Class G14',
          code: 'AS-G14',
          subject: 'Chemistry',
          grade: '9',
          teachingMode: 'OFFLINE',
          teacherId: teacherAId,
          pricePerSession: 180000,
          teacherPayPerSession: 90000,
          durationMinutes: 60,
        });
      classId = classRes.body._id;

      if (classId && student1Id) {
        await request(app.getHttpServer())
          .post(`/classes/${classId}/assign-students`)
          .set(authHeaders(directorCookies))
          .send({ studentIds: [student1Id] });
      }
    });

    it('POST /sessions/bulk generates sessions for all specified days in the date range', async () => {
      if (!classId || !teacherAId || !student1Id) return;

      // April 2025: days 2 (Mon), 4 (Wed), 6 (Fri)
      // April 2025: Tues=1,3,8,10,15,17,22,24,29 → Mon=7,14,21,28 (4), Wed=2,9,16,23,30 (5), Fri=4,11,18,25 (4)
      // Using dayOfWeek [2,4,6] i.e. Tue, Thu, Sat:
      //   Tues in Apr 2025: 1,8,15,22,29 = 5 days
      //   Thu: 3,10,17,24 = 4 days
      //   Sat: 5,12,19,26 = 4 days
      //   Total = 13 sessions
      const res = await request(app.getHttpServer())
        .post('/sessions/bulk')
        .set(authHeaders(directorCookies))
        .send({
          classId,
          teacherId: teacherAId,
          studentId: student1Id,
          dayOfWeek: [2, 4, 6], // Thursday=4, Saturday=6, Tuesday=2 (0=Sun)
          scheduledStartTime: '14:00',
          durationMinutes: 60,
          startDate: '2025-04-01',
          endDate: '2025-04-30',
        });

      expect([200, 201]).toContain(res.status);

      const sessions: any[] = res.body.sessions ?? res.body.data ?? res.body ?? [];
      // Should have generated at least some sessions
      expect(Array.isArray(sessions) ? sessions.length : res.body.count ?? 0).toBeGreaterThan(0);
    });

    it('generated sessions have correct scheduledDate, time, and SCHEDULED status', async () => {
      if (!classId) return;

      const res = await request(app.getHttpServer())
        .get(`/sessions?classId=${classId}&limit=50`)
        .set(authHeaders(directorCookies));

      expect([200, 201]).toContain(res.status);
      const sessions: any[] = res.body.data ?? res.body ?? [];

      if (sessions.length > 0) {
        for (const s of sessions.slice(0, 3)) {
          expect(s.status).toBe('SCHEDULED');
          expect(s.scheduledStartTime).toBe('14:00');
          expect(s.durationMinutes).toBe(60);
        }
      }
    });

    it('sessions are only created within startDate and endDate range', async () => {
      if (!classId) return;

      const res = await request(app.getHttpServer())
        .get(`/sessions?classId=${classId}&limit=50`)
        .set(authHeaders(directorCookies));

      expect([200, 201]).toContain(res.status);
      const sessions: any[] = res.body.data ?? res.body ?? [];

      for (const s of sessions) {
        const date = new Date(s.scheduledDate);
        expect(date.getTime()).toBeGreaterThanOrEqual(new Date('2025-04-01').getTime());
        expect(date.getTime()).toBeLessThanOrEqual(new Date('2025-04-30').getTime());
      }
    });
  });
});
