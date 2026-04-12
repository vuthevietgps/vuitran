import { closeE2eResources } from './e2e-cleanup';
/**
 * Backend E2E — Batch 12 : Nhóm 23 (Cron Jobs: Notifications, Sessions, Leads, Tickets)
 * Scenarios : 30.1, 30.2, 30.3, 30.5, 30.6, 30.11
 *
 * DB suffix  : g23
 * MongoMemoryReplSet: single-node wiredTiger (required for transactions)
 *
 * Cron methods tested (via direct service injection):
 *  - ExternalNotificationService.processExternalNotifications()
 *  - SessionCronService.autoConfirmSessions()
 *  - LeadsService.autoReturnStaleLeads()
 *  - TicketsService.markOverdueTickets()
 * HTTP endpoints (via supertest):
 *  - POST /wallets/verify-balances   (30.5)
 *  - POST /admin/reconciliation/run  (30.11)
 */

import * as request from 'supertest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { AppModule } from '../src/app.module';
import * as cookieParser from 'cookie-parser';
import { getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { SessionCronService } from '../src/sessions/session-cron.service';
import { ExternalNotificationService } from '../src/notifications/external-notification.service';
import { LeadsService } from '../src/leads/leads.service';
import { TicketsService } from '../src/tickets/tickets.service';

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Synthetic XSRF token injected after login — satisfies the CSRF double-submit cookie
// middleware: as long as the 'XSRF-TOKEN' cookie == 'x-xsrf-token' header, any value passes.
const TEST_XSRF = 'test-xsrf-g23';

async function loginAs(
  app: INestApplication,
  email: string,
  password: string,
): Promise<{ cookies: string[] }> {
  const res = await request(app.getHttpServer())
    .post('/auth/login')
    .send({ email, password })
    .expect(({ status }) => {
      if (status !== 200 && status !== 201) throw new Error(`Login failed ${email}: ${status}`);
    });
  const loginCookies = (res.headers['set-cookie'] as unknown as string[]) || [];
  return { cookies: [...loginCookies, `XSRF-TOKEN=${TEST_XSRF}; Path=/`] };
}

function csrfToken(cookies: string[]): string {
  const raw = cookies.find((c) => c.startsWith('XSRF-TOKEN='));
  if (!raw) return '';
  return raw.split('=')[1].split(';')[0];
}

function authHeaders(cookies: string[]): Record<string, string> {
  return {
    cookie: cookies.join('; '),
    'x-xsrf-token': csrfToken(cookies),
  };
}

// ─── Suite ───────────────────────────────────────────────────────────────────

describe('Nhóm 23 — Cron: Notifications, Sessions, Leads, Tickets (g23)', () => {
  let app: INestApplication;
  let mongod: MongoMemoryReplSet;
  let moduleRef: TestingModule;

  let directorCookies: string[];
  let accountingCookies: string[];
  let opsCookies: string[];
  let saleCookies: string[];
  let parentCookies: string[];
  let teacherCookies: string[];

  let directorId: string;
  let saleId: string;
  let parentId: string;
  let teacherId: string;

  // Mongoose models
  let userModel: Model<any>;
  let sessionModel: Model<any>;
  let leadModel: Model<any>;
  let ticketModel: Model<any>;
  let notificationModel: Model<any>;

  // Services
  let sessionCronService: SessionCronService;
  let externalNotificationService: ExternalNotificationService;
  let leadsService: LeadsService;
  let ticketsService: TicketsService;

  // ─── User seed helper ────────────────────────────────────────────────────
  async function upsertUser(email: string, role: string, fullName: string): Promise<void> {
    const hashed = await bcrypt.hash('Pass1234!', 10);
    await userModel.updateOne(
      { email },
      {
        $set: { email, password: hashed, fullName, role, status: 'ACTIVE' },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true },
    );
  }

  beforeAll(async () => {
    mongod = await MongoMemoryReplSet.create({
      replSet: { count: 1, storageEngine: 'wiredTiger' },
    });
    const uri = mongod.getUri();
    process.env.MONGODB_URI = uri.replace('?', 'school-mgmt-g23-e2e?');

    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    // Inject user model first, then seed
    userModel = moduleRef.get(getModelToken('User'));
    await upsertUser('director.g23@test.com',   'DIRECTOR',   'Director G23');
    await upsertUser('accounting.g23@test.com', 'ACCOUNTING', 'Accounting G23');
    await upsertUser('ops.g23@test.com',        'OPS',        'OPS G23');
    await upsertUser('sale.g23@test.com',       'SALE',       'Sale G23');
    await upsertUser('parent.g23@test.com',     'PARENT',     'Parent G23');
    await upsertUser('teacher.g23@test.com',    'TEACHER',    'Teacher G23');

    // Login all roles
    [
      directorCookies,
      accountingCookies,
      opsCookies,
      saleCookies,
      parentCookies,
      teacherCookies,
    ] = await Promise.all([
      loginAs(app, 'director.g23@test.com',   'Pass1234!').then((r) => r.cookies),
      loginAs(app, 'accounting.g23@test.com', 'Pass1234!').then((r) => r.cookies),
      loginAs(app, 'ops.g23@test.com',        'Pass1234!').then((r) => r.cookies),
      loginAs(app, 'sale.g23@test.com',       'Pass1234!').then((r) => r.cookies),
      loginAs(app, 'parent.g23@test.com',     'Pass1234!').then((r) => r.cookies),
      loginAs(app, 'teacher.g23@test.com',    'Pass1234!').then((r) => r.cookies),
    ]);

    // Resolve user IDs
    const usersRes = await request(app.getHttpServer())
      .get('/users?limit=50')
      .set(authHeaders(directorCookies));
    const userList: any[] = usersRes.body?.data || usersRes.body || [];
    const toId = (email: string) =>
      userList.find((u: any) => u.email === email)?._id ?? '';
    directorId   = toId('director.g23@test.com');
    saleId       = toId('sale.g23@test.com');
    parentId     = toId('parent.g23@test.com');
    teacherId    = toId('teacher.g23@test.com');

    // Inject models
    sessionModel      = moduleRef.get(getModelToken('Session'));
    leadModel         = moduleRef.get(getModelToken('Lead'));
    ticketModel       = moduleRef.get(getModelToken('Ticket'));
    notificationModel = moduleRef.get(getModelToken('Notification'));

    // Inject services (strict:false to reach non-exported providers)
    sessionCronService           = moduleRef.get(SessionCronService, { strict: false });
    externalNotificationService  = moduleRef.get(ExternalNotificationService, { strict: false });
    leadsService                 = moduleRef.get(LeadsService, { strict: false });
    ticketsService               = moduleRef.get(TicketsService, { strict: false });
  }, 120_000);

  afterAll(async () => {
    await closeE2eResources({ app, moduleRef, mongoServer: mongod });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // 30.1 — External Notification Cron (every 2 minutes)
  //   processExternalNotifications() marks HIGH/URGENT notifs as emailSent=true
  // ══════════════════════════════════════════════════════════════════════════

  describe('30.1 External Notification Cron', () => {
    let notifId: string;

    beforeAll(async () => {
      // Insert a HIGH notification directly via model (bypass HTTP for cron state)
      if (!teacherId) return;
      const doc = await notificationModel.create({
        recipientId: new Types.ObjectId(teacherId),
        type: 'SYSTEM',
        priority: 'HIGH',
        title: 'Test cron notification',
        message: 'Cron sẽ xử lý thông báo này',
        emailSent: false,
        isRead: false,
      });
      notifId = doc._id.toString();
    });

    it('processExternalNotifications() runs without error', async () => {
      await expect(externalNotificationService.processExternalNotifications()).resolves.not.toThrow();
    });

    it('HIGH notification is marked emailSent=true after cron runs', async () => {
      if (!notifId) return;
      const updated = await notificationModel.findById(notifId).lean();
      expect((updated as any)?.emailSent).toBe(true);
    });

    it('MEDIUM priority notification is NOT processed by external cron', async () => {
      if (!teacherId) return;
      const doc = await notificationModel.create({
        recipientId: new Types.ObjectId(teacherId),
        type: 'SYSTEM',
        priority: 'MEDIUM',
        title: 'Medium notif — should not be processed',
        message: 'Không được gửi email',
        emailSent: false,
        isRead: false,
      });
      await externalNotificationService.processExternalNotifications();
      const after = await notificationModel.findById(doc._id).lean();
      // MEDIUM is excluded from external notification processing
      expect((after as any)?.emailSent).toBe(false);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // 30.2 — Auto-confirm Sessions (every hour)
  //   autoConfirmSessions(): TEACHER_COMPLETED + teacherCompletedAt > autoConfirmAfterHours → FINALIZED
  // ══════════════════════════════════════════════════════════════════════════

  describe('30.2 Auto-confirm Sessions Cron', () => {
    let sessionId: string;

    beforeAll(async () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      const fakeId = () => new Types.ObjectId();

      const doc = new sessionModel({
        classId: fakeId(),
        studentId: fakeId(),
        teacherId: fakeId(),
        scheduledDate: twoHoursAgo,
        durationMinutes: 60,
        status: 'TEACHER_COMPLETED',
        autoConfirmAfterHours: 1,
        hasTeachingReport: true,
        teachingReport: {
          lessonContent: 'Auto-confirm cron fixture',
        },
        amountCharged: 0,
        isPaid: false,
      });
      const saved = await doc.save({ validateBeforeSave: false });
      // Use $set with dot-notation — the same mechanism used by the production service
      // when it writes confirmation.teacherCompletedAt. Direct subdoc init via save()
      // may not store the nested Date reliably in MongoMemoryReplSet.
      await sessionModel.updateOne(
        { _id: saved._id },
        {
          $set: {
            'confirmation.teacherCompletedAt': twoHoursAgo,
            hasTeachingReport: true,
            'teachingReport.lessonContent': 'Auto-confirm cron fixture',
          },
        },
      );
      sessionId = saved._id.toString();
    });

    it('autoConfirmSessions() runs without error', async () => {
      await expect(sessionCronService.autoConfirmSessions()).resolves.not.toThrow();
    });

    it('Session transitions from TEACHER_COMPLETED to FINALIZED', async () => {
      if (!sessionId) return;
      const updated = await sessionModel.findById(sessionId).lean();
      expect((updated as any)?.status).toBe('FINALIZED');
    });

    it('Session with future teacherCompletedAt is NOT auto-confirmed', async () => {
      const fakeId = () => new Types.ObjectId();
      const futureTime = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours from now
      const doc = new sessionModel({
        classId: fakeId(),
        studentId: fakeId(),
        teacherId: fakeId(),
        scheduledDate: futureTime,
        durationMinutes: 60,
        status: 'TEACHER_COMPLETED',
        autoConfirmAfterHours: 24,
        hasTeachingReport: true,
        teachingReport: {
          lessonContent: 'Future session should remain pending',
        },
        confirmation: {
          teacherCompletedAt: new Date(), // just completed
        },
        amountCharged: 0,
        isPaid: false,
      });
      const saved = await doc.save({ validateBeforeSave: false });
      await sessionModel.updateOne(
        { _id: saved._id },
        {
          $set: {
            hasTeachingReport: true,
            'teachingReport.lessonContent': 'Future session should remain pending',
          },
        },
      );
      await sessionCronService.autoConfirmSessions();
      const after = await sessionModel.findById(saved._id).lean();
      expect((after as any)?.status).toBe('TEACHER_COMPLETED');
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // 30.3 — Stale Leads Auto-Return (01:00 AM daily)
  //   autoReturnStaleLeads(): lead assigned > 7 days ago without contact → pool
  // ══════════════════════════════════════════════════════════════════════════

  describe('30.3 Stale Leads Auto-Return Cron', () => {
    let leadId: string;

    beforeAll(async () => {
      const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
      const lead = await leadModel.create({
        leadCode: `LEAD-G23-STALE-${Date.now()}`,
        parentName: 'Parent Stale G23',
        parentPhone: '0900000001',
        status: 'NEW',
        saleId: saleId ? new Types.ObjectId(saleId) : new Types.ObjectId(),
        saleName: 'Sale G23',
        assignedAt: eightDaysAgo,
        lastContactAt: null,
      });
      leadId = lead._id.toString();
    });

    it('autoReturnStaleLeads() runs without error', async () => {
      await expect(leadsService.autoReturnStaleLeads()).resolves.not.toThrow();
    });

    it('Stale lead is returned to pool (saleId = null)', async () => {
      if (!leadId) return;
      const updated = await leadModel.findById(leadId).lean();
      expect((updated as any)?.saleId).toBeNull();
    });

    it('returnCount is incremented', async () => {
      if (!leadId) return;
      const updated = await leadModel.findById(leadId).lean();
      expect((updated as any)?.returnCount).toBeGreaterThan(0);
    });

    it('Recently assigned lead (2 days ago) is NOT returned', async () => {
      const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
      const doc = await leadModel.create({
        leadCode: `LEAD-G23-FRESH-${Date.now()}`,
        parentName: 'Parent Fresh G23',
        parentPhone: '0900000002',
        status: 'NEW',
        saleId: saleId ? new Types.ObjectId(saleId) : new Types.ObjectId(),
        saleName: 'Sale G23',
        assignedAt: twoDaysAgo,
        lastContactAt: new Date(), // just contacted
      });
      await leadsService.autoReturnStaleLeads();
      const after = await leadModel.findById(doc._id).lean();
      expect((after as any)?.saleId).not.toBeNull();
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // 30.5 — Wallet Balance Verification (02:00 AM daily)
  //   POST /wallets/verify-balances → DIRECTOR and ACCOUNTING only
  // ══════════════════════════════════════════════════════════════════════════

  describe('30.5 Wallet Ledger Verification — RBAC', () => {
    it('DIRECTOR có thể gọi verify-balances → 200', async () => {
      const res = await request(app.getHttpServer())
        .post('/wallets/verify-balances')
        .set(authHeaders(directorCookies));
      expect([200, 201]).toContain(res.status);
    });

    it('Response có trường checked và discrepancies', async () => {
      const res = await request(app.getHttpServer())
        .post('/wallets/verify-balances')
        .set(authHeaders(directorCookies));
      expect([200, 201]).toContain(res.status);
      const body = res.body || {};
      expect(body).toHaveProperty('checked');
      expect(body).toHaveProperty('discrepancies');
    });

    it('ACCOUNTING có thể gọi verify-balances → 200', async () => {
      const res = await request(app.getHttpServer())
        .post('/wallets/verify-balances')
        .set(authHeaders(accountingCookies));
      expect([200, 201]).toContain(res.status);
    });

    it('SALE không được gọi verify-balances → 403', async () => {
      const res = await request(app.getHttpServer())
        .post('/wallets/verify-balances')
        .set(authHeaders(saleCookies));
      expect(res.status).toBe(403);
    });

    it('OPS không được gọi verify-balances → 403', async () => {
      const res = await request(app.getHttpServer())
        .post('/wallets/verify-balances')
        .set(authHeaders(opsCookies));
      expect(res.status).toBe(403);
    });

    it('Unauthenticated → 401', async () => {
      const res = await request(app.getHttpServer())
        .post('/wallets/verify-balances');
      expect([401, 403]).toContain(res.status);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // 30.6 — Tickets Overdue Check (every hour)
  //   markOverdueTickets(): dueDate < now → isOverdue=true; CLOSED not affected
  // ══════════════════════════════════════════════════════════════════════════

  describe('30.6 Tickets Overdue Cron', () => {
    let openTicketId: string;
    let closedTicketId: string;

    beforeAll(async () => {
      // Create an OPEN ticket and set its dueDate to yesterday
      const openRes = await request(app.getHttpServer())
        .post('/tickets')
        .set(authHeaders(parentCookies))
        .send({
          type: 'OTHER',
          subject: 'Test overdue ticket G23',
          description: 'Testing the overdue cron for group 23',
          priority: 'HIGH',
        });

      if (openRes.status === 201 || openRes.status === 200) {
        openTicketId = openRes.body._id || openRes.body.id;
        // Back-date the dueDate to yesterday
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
        await ticketModel.findByIdAndUpdate(openTicketId, {
          $set: { dueDate: yesterday, isOverdue: false },
        });
      } else {
        // Fallback: create via model
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const doc = await ticketModel.create({
          ticketCode: `TKT-G23-${Date.now()}`,
          type: 'OTHER',
          subject: 'Test overdue ticket G23',
          description: 'Testing the overdue cron',
          priority: 'HIGH',
          status: 'OPEN',
          isOverdue: false,
          dueDate: yesterday,
          createdBy: parentId ? new Types.ObjectId(parentId) : new Types.ObjectId(),
        });
        openTicketId = doc._id.toString();
      }

      // Create a CLOSED ticket with past dueDate (should NOT be set overdue)
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const closedDoc = await ticketModel.create({
        ticketCode: `TKT-G23-CLOSED-${Date.now()}`,
        type: 'OTHER',
        subject: 'Closed ticket — must not be overdue',
        description: 'CLOSED ticket testing',
        priority: 'LOW',
        status: 'CLOSED',
        isOverdue: false,
        dueDate: yesterday,
        createdBy: parentId ? new Types.ObjectId(parentId) : new Types.ObjectId(),
      });
      closedTicketId = closedDoc._id.toString();
    });

    it('markOverdueTickets() runs without error', async () => {
      await expect(ticketsService.markOverdueTickets()).resolves.not.toThrow();
    });

    it('OPEN ticket with past dueDate → isOverdue=true', async () => {
      if (!openTicketId) return;
      const updated = await ticketModel.findById(openTicketId).lean();
      expect((updated as any)?.isOverdue).toBe(true);
    });

    it('CLOSED ticket with past dueDate → isOverdue stays false', async () => {
      if (!closedTicketId) return;
      const updated = await ticketModel.findById(closedTicketId).lean();
      expect((updated as any)?.isOverdue).toBe(false);
    });

    it('Ticket with future dueDate stays not-overdue', async () => {
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const doc = await ticketModel.create({
        ticketCode: `TKT-G23-FUTURE-${Date.now()}`,
        type: 'OTHER',
        subject: 'Future ticket G23',
        description: 'Has future due date',
        priority: 'MEDIUM',
        status: 'OPEN',
        isOverdue: false,
        dueDate: tomorrow,
        createdBy: parentId ? new Types.ObjectId(parentId) : new Types.ObjectId(),
      });
      await ticketsService.markOverdueTickets();
      const after = await ticketModel.findById(doc._id).lean();
      expect((after as any)?.isOverdue).toBe(false);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // 30.11 — Manual Reconciliation Run (nightly + manual HTTP trigger)
  //   POST /admin/reconciliation/run → DIRECTOR, ACCOUNTING only
  // ══════════════════════════════════════════════════════════════════════════

  describe('30.11 Reconciliation Manual Run — RBAC', () => {
    const body = {
      fromDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      toDate:   new Date().toISOString().split('T')[0],
    };

    it('DIRECTOR có thể chạy reconciliation → 200/201', async () => {
      const res = await request(app.getHttpServer())
        .post('/admin/reconciliation/run')
        .set(authHeaders(directorCookies))
        .send(body);
      expect([200, 201]).toContain(res.status);
    });

    it('Response chứa sessionsScanned', async () => {
      const res = await request(app.getHttpServer())
        .post('/admin/reconciliation/run')
        .set(authHeaders(directorCookies))
        .send(body);
      expect([200, 201]).toContain(res.status);
      const b = res.body || {};
      expect(b).toHaveProperty('sessionsScanned');
    });

    it('ACCOUNTING có thể chạy reconciliation → 200/201', async () => {
      const res = await request(app.getHttpServer())
        .post('/admin/reconciliation/run')
        .set(authHeaders(accountingCookies))
        .send(body);
      expect([200, 201]).toContain(res.status);
    });

    it('SALE không được chạy reconciliation → 403', async () => {
      const res = await request(app.getHttpServer())
        .post('/admin/reconciliation/run')
        .set(authHeaders(saleCookies))
        .send(body);
      expect(res.status).toBe(403);
    });

    it('OPS không được chạy reconciliation → 403', async () => {
      const res = await request(app.getHttpServer())
        .post('/admin/reconciliation/run')
        .set(authHeaders(opsCookies))
        .send(body);
      expect(res.status).toBe(403);
    });

    it('Unauthenticated → 401', async () => {
      const res = await request(app.getHttpServer())
        .post('/admin/reconciliation/run')
        .send(body);
      expect([401, 403]).toContain(res.status);
    });
  });
});
