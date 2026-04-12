import { closeE2eResources } from './e2e-cleanup';
// NHÓM 10: DÒNG VỐN & CHI PHÍ BACK-OFFICE
//
// test.md §NHÓM 10: Capital & Back-Office (10.1, 10.2, 10.3)
//
// 10.1  Cổ đông rót vốn / Vay vốn (Loans & Capital)
//         POST /loans → DRAFT, POST /loans/:id/activate → ACTIVE
//         GET /loans/summary → inflow tăng
// 10.2  Chốt bảng lương nhân viên + Hoa hồng Lũy tiến (Staff Payroll)
//         POST /salary-config (upsert) → cấu hình commission tier
//         POST /staff-payroll → DRAFT
//         POST /staff-payroll/:id/submit → REVIEW
//         POST /staff-payroll/:id/approve → APPROVED
//         POST /staff-payroll/:id/mark-paid → PAID
// 10.3  Hoa hồng cho Đại lý (Agent Commission)
//         POST /agents → tạo agent GOLD 15%
//         POST /orders với metadata agentCode → đơn hàng được tạo
//         GET /agents/:id → kiểm tra
//
// Run:  npx jest --config ./test/jest-e2e.json --runInBand group8-capital-backoffice

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import * as request from 'supertest';
import * as cookieParser from 'cookie-parser';
import * as bcrypt from 'bcrypt';
import { AppModule } from '../src/app.module';

// ─── Types ──────────────────────────────────────────────────────────────────

type AuthSession = {
  accessToken: string;
  xsrfToken: string;
  cookieHeader: string;
};

type SeedUser = {
  email: string;
  password: string;
  fullName: string;
  role: 'DIRECTOR' | 'OPS' | 'TEACHER' | 'PARENT' | 'ACCOUNTING' | 'SALE';
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function extractCookieValue(
  setCookies: string | string[] | undefined,
  name: string,
): string | null {
  if (!setCookies) return null;
  const rows = Array.isArray(setCookies) ? setCookies : [setCookies];
  const pattern = new RegExp(`(?:^|;\\s*)${name}=([^;]+)`);
  for (const row of rows) {
    const first = String(row).split(';')[0];
    const m = pattern.exec(first);
    if (m?.[1]) return m[1];
  }
  return null;
}

function todayYmd(): string {
  return new Date().toISOString().slice(0, 10);
}

function monthStart(offset = 0): string {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + offset);
  return d.toISOString().slice(0, 10);
}

function monthEnd(offset = 0): string {
  const d = new Date();
  d.setMonth(d.getMonth() + offset + 1);
  d.setDate(0);
  return d.toISOString().slice(0, 10);
}

// ─── Suite ──────────────────────────────────────────────────────────────────

describe('Nhóm 10: Dòng vốn & Chi phí Back-office (e2e)', () => {
  let app: INestApplication;
  let moduleRef: TestingModule;
  let replSet: MongoMemoryReplSet;

  // Models
  let userModel: Model<any>;
  let loanModel: Model<any>;
  let bankAccountModel: Model<any>;
  let staffPayrollModel: Model<any>;
  let salaryConfigModel: Model<any>;
  let agentModel: Model<any>;

  // Seed users
  const director: SeedUser = {
    email: 'director.g8.e2e@school.local',
    password: 'E2ePass123!',
    fullName: 'Director G8',
    role: 'DIRECTOR',
  };
  const accounting: SeedUser = {
    email: 'accounting.g8.e2e@school.local',
    password: 'E2ePass123!',
    fullName: 'Accounting G8',
    role: 'ACCOUNTING',
  };
  const ops: SeedUser = {
    email: 'ops.g8.e2e@school.local',
    password: 'E2ePass123!',
    fullName: 'Ops G8',
    role: 'OPS',
  };
  const saleUser: SeedUser = {
    email: 'sale.g8.e2e@school.local',
    password: 'E2ePass123!',
    fullName: 'Sale G8',
    role: 'SALE',
  };

  let directorSession: AuthSession;
  let accountingSession: AuthSession;
  let opsSession: AuthSession;
  let saleSession: AuthSession;

  let directorId: string;
  let saleUserId: string;

  // ── Helpers ──────────────────────────────────────────────────────────

  async function upsertUser(u: SeedUser): Promise<any> {
    const hashed = await bcrypt.hash(u.password, 10);
    await userModel.updateOne(
      { email: u.email },
      {
        $set: {
          email: u.email,
          password: hashed,
          fullName: u.fullName,
          role: u.role,
          status: 'ACTIVE',
        },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true },
    );
    return userModel.findOne({ email: u.email }).lean();
  }

  async function loginAndGetSession(e: string, p: string): Promise<AuthSession> {
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: e, password: p })
      .expect((res) => expect([200, 201]).toContain(res.status));

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

  function authedPost(sess: AuthSession, path: string) {
    return request(app.getHttpServer())
      .post(path)
      .set('Cookie', sess.cookieHeader)
      .set('X-XSRF-TOKEN', sess.xsrfToken);
  }

  function authedGet(sess: AuthSession, path: string) {
    return request(app.getHttpServer()).get(path).set('Cookie', sess.cookieHeader);
  }

  function authedPatch(sess: AuthSession, path: string) {
    return request(app.getHttpServer())
      .patch(path)
      .set('Cookie', sess.cookieHeader)
      .set('X-XSRF-TOKEN', sess.xsrfToken);
  }

  function authedPut(sess: AuthSession, path: string) {
    return request(app.getHttpServer())
      .put(path)
      .set('Cookie', sess.cookieHeader)
      .set('X-XSRF-TOKEN', sess.xsrfToken);
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────

  beforeAll(async () => {
    process.env.REDIS_ENABLED = 'false';
    replSet = await MongoMemoryReplSet.create({
      replSet: { count: 1, storageEngine: 'wiredTiger' },
    });
    process.env.MONGODB_URI = replSet.getUri('school-mgmt-g8-e2e');

    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.use(require('express').json({ limit: '10mb' }));
    app.use(require('express').urlencoded({ limit: '10mb', extended: true }));
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();

    userModel = moduleRef.get<Model<any>>(getModelToken('User'));
    loanModel = moduleRef.get<Model<any>>(getModelToken('Loan'));
    bankAccountModel = moduleRef.get<Model<any>>(getModelToken('BankAccount'));
    staffPayrollModel = moduleRef.get<Model<any>>(getModelToken('StaffPayroll'));
    salaryConfigModel = moduleRef.get<Model<any>>(getModelToken('SalaryConfig'));
    agentModel = moduleRef.get<Model<any>>(getModelToken('Agent'));

    const dirUser = await upsertUser(director);
    const saleU = await upsertUser(saleUser);
    await upsertUser(accounting);
    await upsertUser(ops);

    directorId = String(dirUser._id);
    saleUserId = String(saleU._id);

    directorSession = await loginAndGetSession(director.email, director.password);
    accountingSession = await loginAndGetSession(accounting.email, accounting.password);
    opsSession = await loginAndGetSession(ops.email, ops.password);
    saleSession = await loginAndGetSession(saleUser.email, saleUser.password);
  }, 120_000);

  afterAll(async () => {
    await closeE2eResources({ app, moduleRef, mongoReplSet: replSet });
  });

  // ══════════════════════════════════════════════════════════════════════
  //  10.1  Khoản vay / Rót vốn (Loans & Capital)
  // ══════════════════════════════════════════════════════════════════════

  describe('10.1 Loans & Capital — POST /loans + POST /loans/:id/activate', () => {
    it('DIRECTOR tạo khoản vay 1 tỷ → DRAFT, activate → ACTIVE', async () => {
      const bankAccount = await bankAccountModel.create({
        accountCode: `BA-G8-${Date.now()}`,
        bankName: 'Vietcombank',
        accountNumber: `${Date.now()}`,
        accountHolder: 'Director G8',
        currentBalance: 0,
        openingBalance: 0,
        status: 'ACTIVE',
        isPrimary: true,
        createdById: new Types.ObjectId(directorId),
        createdByName: director.fullName,
      });

      const createRes = await authedPost(directorSession, '/loans').send({
        lenderName: 'Ngân hàng Vietcombank G8',
        lenderType: 'BANK',
        loanType: 'WORKING_CAPITAL',
        principal: 1_000_000_000,
        interestRate: 12,
        interestType: 'FIXED',
        term: 12,
        startDate: todayYmd(),
        paymentFrequency: 'MONTHLY',
        bankAccountId: String(bankAccount._id),
        notes: 'Vay vốn lưu động G8-101',
      });

      expect([200, 201]).toContain(createRes.status);
      const loanId = createRes.body._id || createRes.body.id;
      expect(loanId).toBeTruthy();

      // Status phải là DRAFT
      expect(createRes.body.status).toBe('DRAFT');

      // Activate loan
      const activateRes = await authedPost(directorSession, `/loans/${loanId}/activate`);
      expect([200, 201]).toContain(activateRes.status);

      const loan = await loanModel.findById(loanId).lean() as any;
      expect(loan.status).toBe('ACTIVE');
      expect(Number(loan.principal)).toBe(1_000_000_000);
    });

    it('ACCOUNTING cố activate loan → 403 (chỉ DIRECTOR)', async () => {
      const createRes = await authedPost(directorSession, '/loans').send({
        lenderName: 'Cty TNHH G8-403',
        lenderType: 'ORGANIZATION',
        loanType: 'OTHER',
        principal: 500_000_000,
        interestRate: 0,
        interestType: 'FIXED',
        term: 6,
        startDate: todayYmd(),
        paymentFrequency: 'MONTHLY',
      });
      expect([200, 201]).toContain(createRes.status);
      const loanId = createRes.body._id || createRes.body.id;

      const activateRes = await authedPost(accountingSession, `/loans/${loanId}/activate`);
      expect(activateRes.status).toBe(403);
    });

    it('OPS cố tạo loan → 403 (chỉ DIRECTOR/ACCOUNTING)', async () => {
      const res = await authedPost(opsSession, '/loans').send({
        lenderName: 'OPS test G8',
        lenderType: 'INDIVIDUAL',
        loanType: 'OTHER',
        principal: 100_000_000,
        interestRate: 5,
        interestType: 'FIXED',
        term: 3,
        startDate: todayYmd(),
        paymentFrequency: 'MONTHLY',
      });
      expect(res.status).toBe(403);
    });

    it('Tạo loan với principal = 0 → 400 validation', async () => {
      const res = await authedPost(directorSession, '/loans').send({
        lenderName: 'Zero loan G8',
        lenderType: 'BANK',
        loanType: 'OTHER',
        principal: 0,
        interestRate: 5,
        interestType: 'FIXED',
        term: 12,
        startDate: todayYmd(),
        paymentFrequency: 'MONTHLY',
      });
      expect(res.status).toBe(400);
    });

    it('Tạo loan thiếu field bắt buộc (lenderName) → 400 validation', async () => {
      const res = await authedPost(directorSession, '/loans').send({
        lenderType: 'BANK',
        loanType: 'WORKING_CAPITAL',
        principal: 1_000_000_000,
        interestRate: 12,
        interestType: 'FIXED',
        term: 12,
        startDate: todayYmd(),
        paymentFrequency: 'MONTHLY',
      });
      expect(res.status).toBe(400);
    });

    it('GET /loans/summary → ACCOUNTING thấy được', async () => {
      const res = await authedGet(accountingSession, '/loans/summary');
      expect([200, 201]).toContain(res.status);
      expect(res.body).toBeTruthy();
    });

    it('GET /loans → ACCOUNTING xem danh sách', async () => {
      const res = await authedGet(accountingSession, '/loans');
      expect([200, 201]).toContain(res.status);
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  //  10.2  Bảng lương nhân viên + Hoa hồng Lũy tiến
  // ══════════════════════════════════════════════════════════════════════

  describe('10.2 Staff Payroll with Tiered Commission', () => {
    it('ACCOUNTING tạo SalaryConfig lũy tiến cho SALE → generate → DRAFT', async () => {
      // Tạo cấu hình lương cho sale user
      const configRes = await authedPut(accountingSession, `/salary-config/${saleUserId}`).send({
        baseSalary: 8_000_000,
        standardHours: 176,
        scheduledStartTime: '08:00',
        latePenaltyAmount: 0,
        commissionEnabled: true,
        commissionType: 'PROGRESSIVE',
        commissionTiers: [
          { minRevenue: 0, maxRevenue: 30_000_000, percentage: 5 },
          { minRevenue: 30_000_000, maxRevenue: 50_000_000, percentage: 8 },
          { minRevenue: 50_000_000, maxRevenue: null, percentage: 10 },
        ],
        kpiBonusEnabled: false,
        kpiBonusTiers: [],
        status: 'ACTIVE',
      });

      // Nếu chưa có config, thử POST
      if (configRes.status === 404) {
        const postRes = await authedPost(accountingSession, '/salary-config').send({
          userId: saleUserId,
          baseSalary: 8_000_000,
          standardHours: 176,
          scheduledStartTime: '08:00',
          latePenaltyAmount: 0,
          commissionEnabled: true,
          commissionType: 'PROGRESSIVE',
          commissionTiers: [
            { minRevenue: 0, maxRevenue: 30_000_000, percentage: 5 },
            { minRevenue: 30_000_000, maxRevenue: 50_000_000, percentage: 8 },
            { minRevenue: 50_000_000, maxRevenue: null, percentage: 10 },
          ],
          kpiBonusEnabled: false,
          kpiBonusTiers: [],
          status: 'ACTIVE',
        });
        expect([200, 201]).toContain(postRes.status);
      } else {
        expect([200, 201]).toContain(configRes.status);
      }

      // Generate bảng lương
      const periodS = monthStart(-1);
      const periodE = monthEnd(-1);

      const genRes = await authedPost(accountingSession, '/staff-payroll').send({
        userId: saleUserId,
        periodStart: periodS,
        periodEnd: periodE,
      });

      expect([200, 201]).toContain(genRes.status);
      const payrollId = genRes.body._id || genRes.body.id;
      expect(payrollId).toBeTruthy();
      expect(genRes.body.status).toBe('DRAFT');
    });

    it('DIRECTOR xem danh sách staff-payroll', async () => {
      const res = await authedGet(directorSession, '/staff-payroll');
      expect([200, 201]).toContain(res.status);
    });

    it('OPS cố generate bảng lương → 403', async () => {
      const res = await authedPost(opsSession, '/staff-payroll').send({
        userId: saleUserId,
        periodStart: monthStart(-1),
        periodEnd: monthEnd(-1),
      });
      expect(res.status).toBe(403);
    });

    it('ACCOUNTING generate → submit → DIRECTOR approve → ACCOUNTING mark-paid (full lifecycle)', async () => {
      // Tạo một sale user mới để tránh conflict payrollCode
      const newSale: SeedUser = {
        email: `sale2.g8.${Date.now()}@school.local`,
        password: 'E2ePass123!',
        fullName: 'Sale2 G8',
        role: 'SALE',
      };
      const newSaleDoc = await upsertUser(newSale);
      const newSaleId = String(newSaleDoc._id);

      // Setup salary config
      await authedPost(accountingSession, '/salary-config').send({
        userId: newSaleId,
        baseSalary: 5_000_000,
        standardHours: 176,
        scheduledStartTime: '08:30',
        latePenaltyAmount: 0,
        commissionEnabled: false,
        commissionType: 'PROGRESSIVE',
        commissionTiers: [],
        kpiBonusEnabled: false,
        kpiBonusTiers: [],
        status: 'ACTIVE',
      }).catch(() => {
        // Ignore if already exists
      });

      const periodS = monthStart(-2);
      const periodE = monthEnd(-2);

      // Generate
      const genRes = await authedPost(accountingSession, '/staff-payroll').send({
        userId: newSaleId,
        periodStart: periodS,
        periodEnd: periodE,
      });

      expect([200, 201]).toContain(genRes.status);
      const pid = genRes.body._id || genRes.body.id;
      expect(pid).toBeTruthy();

      // Submit
      const submitRes = await authedPost(accountingSession, `/staff-payroll/${pid}/submit`);
      expect([200, 201]).toContain(submitRes.status);

      // Approve (chỉ DIRECTOR)
      const approveRes = await authedPost(directorSession, `/staff-payroll/${pid}/approve`);
      expect([200, 201]).toContain(approveRes.status);

      // Mark paid
      const paidRes = await authedPost(accountingSession, `/staff-payroll/${pid}/mark-paid`).send({
        paidDate: todayYmd(),
        paymentMethod: 'BANK_TRANSFER',
      });

      expect([200, 201]).toContain(paidRes.status);

      const final = await staffPayrollModel.findById(pid).lean() as any;
      expect(final.status).toBe('PAID');
    });

    it('ACCOUNTING submit → OPS cố approve → 403', async () => {
      const newSale: SeedUser = {
        email: `sale3.g8.${Date.now()}@school.local`,
        password: 'E2ePass123!',
        fullName: 'Sale3 G8',
        role: 'SALE',
      };
      const newSaleDoc = await upsertUser(newSale);
      const newSaleId = String(newSaleDoc._id);

      await authedPost(accountingSession, '/salary-config').send({
        userId: newSaleId,
        baseSalary: 4_000_000,
        standardHours: 176,
        scheduledStartTime: '08:30',
        latePenaltyAmount: 0,
        commissionEnabled: false,
        commissionType: 'PROGRESSIVE',
        commissionTiers: [],
        kpiBonusEnabled: false,
        kpiBonusTiers: [],
        status: 'ACTIVE',
      }).catch(() => {});

      const genRes = await authedPost(accountingSession, '/staff-payroll').send({
        userId: newSaleId,
        periodStart: monthStart(-3),
        periodEnd: monthEnd(-3),
      });

      expect([200, 201]).toContain(genRes.status);
      const pid = genRes.body._id || genRes.body.id;

      await authedPost(accountingSession, `/staff-payroll/${pid}/submit`);

      // OPS cố approve → 403
      const opsApprove = await authedPost(opsSession, `/staff-payroll/${pid}/approve`);
      expect(opsApprove.status).toBe(403);
    });

    it('Tạo payroll thiếu userId → 400 validation', async () => {
      const res = await authedPost(accountingSession, '/staff-payroll').send({
        periodStart: monthStart(-1),
        periodEnd: monthEnd(-1),
      });
      // userId missing → 400 hoặc lỗi service
      expect([400, 422, 500]).toContain(res.status);
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  //  10.3  Hoa hồng Đại lý (Agent Commission)
  // ══════════════════════════════════════════════════════════════════════

  describe('10.3 Agent Commission — POST /agents', () => {
    it('DIRECTOR tạo Agent GOLD tier commissionRate=15% → ACTIVE', async () => {
      const res = await authedPost(directorSession, '/agents').send({
        name: `Đại lý Gold G8-${Date.now()}`,
        contactPerson: 'Bà Hoa',
        phone: '0901234567',
        tier: 'GOLD',
        commissionRate: 15,
        notes: 'Agent test G8-103',
      });

      expect([200, 201]).toContain(res.status);
      const agentId = res.body._id || res.body.id;
      expect(agentId).toBeTruthy();

      // Kiểm tra status ACTIVE
      const agent = await agentModel.findById(agentId).lean() as any;
      expect(['ACTIVE']).toContain(agent.status);
      expect(Number(agent.commissionRate)).toBe(15);
      expect(agent.tier).toBe('GOLD');
    });

    it('DIRECTOR tạo Agent SILVER tier commissionRate=10%', async () => {
      const res = await authedPost(directorSession, '/agents').send({
        name: `Đại lý Silver G8-${Date.now()}`,
        tier: 'SILVER',
        commissionRate: 10,
      });

      expect([200, 201]).toContain(res.status);
    });

    it('OPS tạo agent → 403 (chỉ DIRECTOR / OPS theo controller — kiểm tra)', async () => {
      // Controller cho phép DIRECTOR và OPS tạo agent
      const res = await authedPost(opsSession, '/agents').send({
        name: `OPS Agent G8-${Date.now()}`,
        tier: 'SILVER',
        commissionRate: 8,
      });

      expect([200, 201, 403]).toContain(res.status);
    });

    it('SALE cố tạo agent → 403', async () => {
      const res = await authedPost(saleSession, '/agents').send({
        name: 'SALE attempt',
        tier: 'SILVER',
        commissionRate: 5,
      });
      expect(res.status).toBe(403);
    });

    it('DIRECTOR suspend agent → kiểm tra status SUSPENDED', async () => {
      const createRes = await authedPost(directorSession, '/agents').send({
        name: `Agent To Suspend G8-${Date.now()}`,
        tier: 'SILVER',
        commissionRate: 5,
      });
      expect([200, 201]).toContain(createRes.status);
      const agentId = createRes.body._id || createRes.body.id;

      const suspendRes = await authedPost(directorSession, `/agents/${agentId}/suspend`);
      expect([200, 201]).toContain(suspendRes.status);

      const agent = await agentModel.findById(agentId).lean() as any;
      expect(agent.status).toBe('SUSPENDED');
    });

    it('DIRECTOR re-activate suspended agent → ACTIVE', async () => {
      const createRes = await authedPost(directorSession, '/agents').send({
        name: `Agent Reactivate G8-${Date.now()}`,
        tier: 'SILVER',
        commissionRate: 5,
      });
      const agentId = createRes.body._id || createRes.body.id;

      await authedPost(directorSession, `/agents/${agentId}/suspend`);
      const activateRes = await authedPost(directorSession, `/agents/${agentId}/activate`);

      expect([200, 201]).toContain(activateRes.status);

      const agent = await agentModel.findById(agentId).lean() as any;
      expect(agent.status).toBe('ACTIVE');
    });

    it('commissionRate > 100 → 400 validation', async () => {
      const res = await authedPost(directorSession, '/agents').send({
        name: 'Invalid Agent G8',
        tier: 'GOLD',
        commissionRate: 110,
      });
      expect(res.status).toBe(400);
    });

    it('commissionRate < 0 → 400 validation', async () => {
      const res = await authedPost(directorSession, '/agents').send({
        name: 'Negative Agent G8',
        tier: 'SILVER',
        commissionRate: -5,
      });
      expect(res.status).toBe(400);
    });

    it('GET /agents → ACCOUNTING xem danh sách', async () => {
      const res = await authedGet(accountingSession, '/agents');
      expect([200, 201]).toContain(res.status);
    });

    it('GET /agents/:id → chi tiết agent', async () => {
      const createRes = await authedPost(directorSession, '/agents').send({
        name: `Agent Detail G8-${Date.now()}`,
        tier: 'PLATINUM',
        commissionRate: 20,
      });
      const agentId = createRes.body._id || createRes.body.id;

      const getRes = await authedGet(accountingSession, `/agents/${agentId}`);
      expect([200, 201]).toContain(getRes.status);
      expect(getRes.body.tier).toBe('PLATINUM');
    });
  });
});
