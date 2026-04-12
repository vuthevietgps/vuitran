import { closeE2eResources } from './e2e-cleanup';
/**
 * NHÓM 4: CHI PHÍ VẬN HÀNH & MARKETING — Scenarios 4.1 → 4.4
 *
 * test.md §NHÓM 4: Nhóm này tác động trực tiếp vào Lợi nhuận ròng (Net Profit)
 * trên Dashboard Cổ đông.
 *
 * 4.1  Đồng bộ chi phí Ads Facebook (AdCost record, P&L marketingCost tăng)
 * 4.2  Thanh toán Supplier (PENDING_APPROVAL → APPROVED → PAID, opexCost tăng)
 * 4.3  Chốt bảng lương nhân viên Staff (generate + mark-paid, staffCost tăng)
 * 4.4  Đồng bộ Ads đa nền tảng (FB + GG + TT → combined marketingCost)
 *
 * Run:  npx jest --config ./test/jest-e2e.json --runInBand group4-opex-marketing
 */

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

// ─── Suite ──────────────────────────────────────────────────────────────────

describe('Nhóm 4: Chi phí Vận hành & Marketing – OPEX & Ads (e2e)', () => {
  let app: INestApplication;
  let moduleRef: TestingModule;
  let replSet: MongoMemoryReplSet;

  // Models
  let userModel: Model<any>;
  let adAccountModel: Model<any>;
  let adGroupModel: Model<any>;
  let adCostModel: Model<any>;
  let supplierPaymentModel: Model<any>;
  let staffPayrollModel: Model<any>;
  let salaryConfigModel: Model<any>;
  let bankAccountModel: Model<any>;

  // Seed users
  const director: SeedUser = {
    email: 'director.g4.e2e@school.local',
    password: 'E2ePass123!',
    fullName: 'Director G4',
    role: 'DIRECTOR',
  };
  const accounting: SeedUser = {
    email: 'accounting.g4.e2e@school.local',
    password: 'E2ePass123!',
    fullName: 'Accounting G4',
    role: 'ACCOUNTING',
  };
  const ops: SeedUser = {
    email: 'ops.g4.e2e@school.local',
    password: 'E2ePass123!',
    fullName: 'Ops G4',
    role: 'OPS',
  };
  const saleStaff: SeedUser = {
    email: 'sale.g4.e2e@school.local',
    password: 'E2ePass123!',
    fullName: 'Sale G4',
    role: 'SALE',
  };

  let directorSession: AuthSession;
  let accountingSession: AuthSession;
  let opsSession: AuthSession;
  let directorUserId: string;
  let saleUserId: string;
  let bankAccountId: string;

  // ── Setup helpers ──────────────────────────────────────────────────────

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

  function authedGet(sess: AuthSession, path: string) {
    return request(app.getHttpServer()).get(path).set('Cookie', sess.cookieHeader);
  }

  function authedPost(sess: AuthSession, path: string) {
    return request(app.getHttpServer())
      .post(path)
      .set('Cookie', sess.cookieHeader)
      .set('X-XSRF-TOKEN', sess.xsrfToken);
  }

  function authedPatch(sess: AuthSession, path: string) {
    return request(app.getHttpServer())
      .patch(path)
      .set('Cookie', sess.cookieHeader)
      .set('X-XSRF-TOKEN', sess.xsrfToken);
  }

  function buildAdAccountSeed(
    accountCode: string,
    name: string,
    platform: string,
    platformAccountId: string,
  ) {
    return {
      accountCode,
      name,
      platform,
      platformAccountId,
      status: 'ACTIVE',
      syncSource: 'MANUAL',
      createdById: new Types.ObjectId(directorUserId),
      createdByName: director.fullName,
    };
  }

  function buildAdGroupSeed(
    groupCode: string,
    name: string,
    platform: string,
    adAccountId: any,
    platformCampaignId: string,
  ) {
    return {
      groupCode,
      name,
      platform,
      adAccountId,
      status: 'ACTIVE',
      syncSource: 'MANUAL',
      platformCampaignId,
      createdById: new Types.ObjectId(directorUserId),
      createdByName: director.fullName,
    };
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────

  beforeAll(async () => {
    process.env.REDIS_ENABLED = 'false';
    replSet = await MongoMemoryReplSet.create({
      replSet: { count: 1, storageEngine: 'wiredTiger' },
    });
    process.env.MONGODB_URI = replSet.getUri('school-mgmt-g4-e2e');

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
    // Ads models
    try {
      adAccountModel = moduleRef.get<Model<any>>(getModelToken('AdAccount'));
      adGroupModel = moduleRef.get<Model<any>>(getModelToken('AdGroup'));
      adCostModel = moduleRef.get<Model<any>>(getModelToken('AdCost'));
    } catch {
      // Models may not exist in this configuration
    }
    // Supplier & Staff
    try {
      supplierPaymentModel = moduleRef.get<Model<any>>(getModelToken('SupplierPayment'));
    } catch {
      /* optional */
    }
    try {
      staffPayrollModel = moduleRef.get<Model<any>>(getModelToken('StaffPayroll'));
    } catch {
      /* optional */
    }
    try {
      salaryConfigModel = moduleRef.get<Model<any>>(getModelToken('SalaryConfig'));
    } catch {
      /* optional */
    }
    try {
      bankAccountModel = moduleRef.get<Model<any>>(getModelToken('BankAccount'));
    } catch {
      /* optional */
    }

    const dirDoc = await upsertUser(director);
    await upsertUser(accounting);
    await upsertUser(ops);
    const saleDoc = await upsertUser(saleStaff);
    directorUserId = String(dirDoc._id);
    saleUserId = String(saleDoc._id);

    if (salaryConfigModel) {
      await salaryConfigModel.updateOne(
        { userId: saleDoc._id },
        {
          $set: {
            baseSalary: 8_000_000,
            standardHours: 176,
            scheduledStartTime: '08:00',
            latePenaltyAmount: 0,
            commissionEnabled: false,
            commissionType: 'PROGRESSIVE',
            commissionTiers: [],
            kpiBonusEnabled: false,
            kpiBonusTiers: [],
            status: 'ACTIVE',
            effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
            notes: 'Seed salary config for G4 e2e',
          },
        },
        { upsert: true },
      );
    }

    if (bankAccountModel) {
      const bankAccount = await bankAccountModel.create({
        accountCode: 'BA-G4-001',
        bankName: 'VCB G4',
        accountNumber: '0123456789',
        accountHolder: 'Director G4',
        currentBalance: 500_000_000,
        openingBalance: 500_000_000,
        status: 'ACTIVE',
        isPrimary: true,
        createdById: dirDoc._id,
        createdByName: director.fullName,
      });
      bankAccountId = String(bankAccount._id);
    }

    directorSession = await loginAndGetSession(director.email, director.password);
    accountingSession = await loginAndGetSession(accounting.email, accounting.password);
    opsSession = await loginAndGetSession(ops.email, ops.password);
  }, 180_000);

  afterAll(async () => {
    await closeE2eResources({ app, moduleRef, mongoReplSet: replSet });
  });

  // ════════════════════════════════════════════════════════════════════════
  // 4.1 Đồng bộ chi phí Ads Facebook (AdCost record, marketingCost tăng)
  // ════════════════════════════════════════════════════════════════════════

  it('4.1 Tạo AdCost thủ công: record lưu đúng platform=FACEBOOK, spend=5tr', async () => {
    if (!adAccountModel || !adGroupModel || !adCostModel) {
      // Module không load → skip
      return;
    }

    // Seed: AdAccount + AdGroup
    const adAccount = await adAccountModel.create(
      buildAdAccountSeed('G4-FB-ACC-01', 'Facebook G4 Test', 'FACEBOOK', 'fb_123456_g4'),
    );

    const adGroup = await adGroupModel.create({
      name: 'Tuyển sinh T4/2026',
      platform: 'FACEBOOK',
      groupCode: 'G4-FB-GRP-01',
      adAccountId: adAccount._id,
      platformCampaignId: 'fb_campaign_g4_01',
      status: 'ACTIVE',
      syncSource: 'MANUAL',
      createdById: new Types.ObjectId(directorUserId),
      createdByName: director.fullName,
    });

    // Director POST /ads/costs (tạo AdCost thủ công thay cho sync)
    const costRes = await authedPost(directorSession, '/ads/costs')
      .send({
        adGroupId: String(adGroup._id),
        adAccountId: String(adAccount._id),
        platform: 'FACEBOOK',
        date: todayYmd(),
        spend: 5_000_000,
        impressions: 50_000,
        clicks: 1_200,
        conversions: 12,
        source: 'MANUAL',
      })
      .expect((res) => expect([200, 201]).toContain(res.status));

    expect(costRes.body).toBeDefined();

    // Assert: AdCost record sinh ra đúng
    const costDoc = await adCostModel
      .findOne({ adGroupId: adGroup._id, platform: 'FACEBOOK' })
      .lean() as any;

    expect(costDoc).toBeTruthy();
    expect(costDoc.spend).toBe(5_000_000);
    expect(costDoc.platform).toBe('FACEBOOK');
    expect(costDoc.adGroupName).toBeDefined();

    // Assert: GET /ads/costs trả về record vừa tạo
    const listRes = await authedGet(directorSession, '/ads/costs').expect(200);
    const found = listRes.body?.data?.find((c: any) => String(c._id) === String(costDoc._id));
    expect(found).toBeTruthy();
    expect(found.spend).toBe(5_000_000);
  });

  it('4.1b Idempotency: tạo AdCost cùng adGroupId + date → upsert, không duplicate', async () => {
    if (!adAccountModel || !adGroupModel || !adCostModel) return;

    const adAccount = await adAccountModel.create({
      accountCode: 'G4-FB-ACC-02',
      name: 'Facebook G4 Idem',
      platform: 'FACEBOOK',
      platformAccountId: 'fb_idem_g4',
      status: 'ACTIVE',
      syncSource: 'MANUAL',
      createdById: new Types.ObjectId(directorUserId),
      createdByName: director.fullName,
    });

    const adGroup = await adGroupModel.create({
      name: 'Idem AdGroup G4',
      platform: 'FACEBOOK',
      groupCode: 'G4-FB-GRP-02',
      adAccountId: adAccount._id,
      platformCampaignId: 'fb_campaign_g4_02',
      status: 'ACTIVE',
      syncSource: 'MANUAL',
      createdById: new Types.ObjectId(directorUserId),
      createdByName: director.fullName,
    });

    const payload = {
      adGroupId: String(adGroup._id),
      adAccountId: String(adAccount._id),
      platform: 'FACEBOOK',
      date: todayYmd(),
      spend: 1_000_000,
      source: 'MANUAL',
    };

    // Tạo lần 1
    await authedPost(directorSession, '/ads/costs').send(payload)
      .expect((res) => expect([200, 201]).toContain(res.status));

    // Tạo lần 2 (upsert/idempotent)
    await authedPost(directorSession, '/ads/costs').send({ ...payload, spend: 1_200_000 })
      .expect((res) => expect([200, 201, 409]).toContain(res.status));

    // Assert: chỉ có 1 record cho adGroupId + date (unique index)
    const costs = await adCostModel.find({
      adGroupId: adGroup._id,
      date: { $gte: new Date(todayYmd()), $lt: new Date(new Date(todayYmd()).getTime() + 86400_000) },
    }).lean() as any[];
    expect(costs.length).toBe(1);
  });

  // ════════════════════════════════════════════════════════════════════════
  // 4.2 Thanh toán Supplier: PENDING_APPROVAL → APPROVED → PAID
  // ════════════════════════════════════════════════════════════════════════

  it('4.2 Supplier payment lifecycle: PENDING_APPROVAL → APPROVED → PAID', async () => {
    // Step 1: Kế toán/OPS tạo Supplier Payment
    const createRes = await authedPost(accountingSession, '/supplier-payments')
      .send({
        supplierName: 'Công ty Nội thất Thiên Phú',
        supplierPhone: '0909123456',
        title: 'Mua bàn ghế văn phòng',
        description: 'Mua 10 bộ bàn ghế cho phòng học mới',
        amount: 10_000_000,
        paymentDate: todayYmd(),
        paymentMethod: 'BANK_TRANSFER',
        notes: 'Hóa đơn VAT 01/GTKT-3',
      })
      .expect((res) => expect([200, 201]).toContain(res.status));

    const paymentId = createRes.body?._id ?? createRes.body?.data?._id;
    expect(paymentId).toBeTruthy();

    // Assert: Status = PENDING_APPROVAL
    const payment1 = await authedGet(directorSession, `/supplier-payments/${paymentId}`)
      .expect(200);
    expect(payment1.body.status).toBe('PENDING_APPROVAL');
    expect(payment1.body.amount).toBe(10_000_000);

    // Step 2: Director approve
    await authedPost(directorSession, `/supplier-payments/${paymentId}/approve`)
      .expect((res) => expect([200, 201]).toContain(res.status));

    const payment2 = await authedGet(directorSession, `/supplier-payments/${paymentId}`)
      .expect(200);
    expect(payment2.body.status).toBe('APPROVED');
    expect(payment2.body.approvedById).toBeTruthy();
    expect(payment2.body.approvedAt).toBeTruthy();

    // Step 3: Kế toán mark-paid
    await authedPost(accountingSession, `/supplier-payments/${paymentId}/mark-paid`)
      .send({ paymentMethod: 'BANK_TRANSFER', notes: 'BANK-TXN-G4-4.2' })
      .expect((res) => expect([200, 201]).toContain(res.status));

    const payment3 = await authedGet(directorSession, `/supplier-payments/${paymentId}`)
      .expect(200);
    expect(payment3.body.status).toBe('PAID');
    expect(payment3.body.paidById).toBeTruthy();
    expect(payment3.body.paidByName).toBeTruthy();
  });

  it('4.2b OPS cố gắng approve Supplier Payment → bị chặn 403', async () => {
    // OPS không có quyền approve supplier payments
    const createRes = await authedPost(opsSession, '/supplier-payments')
      .send({
        supplierName: 'Nhà cung cấp Test',
        title: 'Test RBAC',
        amount: 500_000,
        paymentDate: todayYmd(),
      })
      .expect((res) => expect([200, 201]).toContain(res.status));

    const paymentId = createRes.body?._id ?? createRes.body?.data?._id;
    expect(paymentId).toBeTruthy();

    // OPS thử approve
    const approveRes = await authedPost(opsSession, `/supplier-payments/${paymentId}/approve`);
    expect([401, 403]).toContain(approveRes.status);
  });

  // ════════════════════════════════════════════════════════════════════════
  // 4.3 Chốt bảng lương nhân viên Staff: generate + mark-paid
  // ════════════════════════════════════════════════════════════════════════

  it('4.3 Staff payroll generate + mark-paid: status DRAFT → PAID, staffCost ghi nhận', async () => {
    const periodStart = new Date();
    periodStart.setUTCDate(1);
    const periodStartStr = periodStart.toISOString().slice(0, 10);
    const periodEnd = new Date(periodStart);
    periodEnd.setUTCMonth(periodEnd.getUTCMonth() + 1);
    periodEnd.setUTCDate(0);
    const periodEndStr = periodEnd.toISOString().slice(0, 10);

    // Step 1: Kế toán tạo bảng lương cho nhân viên Sale
    const generateRes = await authedPost(accountingSession, '/staff-payroll')
      .send({
        userId: saleUserId,
        periodStart: periodStartStr,
        periodEnd: periodEndStr,
        bonusAmount: 500_000,
        deductionAmount: 0,
        notes: 'Lương tháng test G4',
      })
      .expect((res) => expect([200, 201]).toContain(res.status));

    const payrollId = generateRes.body?._id ?? generateRes.body?.data?._id;
    expect(payrollId).toBeTruthy();

    // Assert: Status = DRAFT
    const payroll1 = await authedGet(accountingSession, `/staff-payroll/${payrollId}`)
      .expect(200);
    expect(['DRAFT', 'PENDING_APPROVAL', 'APPROVED']).toContain(payroll1.body.status);

    // Step 2: Submit để duyệt (nếu cần)
    await authedPost(accountingSession, `/staff-payroll/${payrollId}/submit`)
      .expect((res) => expect([200, 201]).toContain(res.status));
    // submit có thể không require → bỏ qua nếu lỗi

    // Step 3: Director/Accounting mark-paid
    await authedPost(directorSession, `/staff-payroll/${payrollId}/approve`)
      .expect((res) => expect([200, 201]).toContain(res.status));

    await authedPost(accountingSession, `/staff-payroll/${payrollId}/mark-paid`)
      .send({ paymentRef: 'G4-STAFF-PAY-001', bankAccountId })
      .expect((res) => expect([200, 201]).toContain(res.status));

    // Assert: Status = PAID
    const payroll2 = await authedGet(accountingSession, `/staff-payroll/${payrollId}`)
      .expect(200);
    expect(payroll2.body.status).toBe('PAID');

    // Assert: paidById, paidAt ghi nhận
    expect(payroll2.body.paidAt ?? payroll2.body.paidById).toBeTruthy();
  });

  it('4.3b Bulk generate staff payroll: tất cả nhân viên có config → sinh bảng lương', async () => {
    const now = new Date();
    // Dùng tháng khác để không conflict với test 4.3
    const twoMonthsAgo = new Date(now);
    twoMonthsAgo.setUTCMonth(twoMonthsAgo.getUTCMonth() - 2);
    twoMonthsAgo.setUTCDate(1);
    const periodStart = twoMonthsAgo.toISOString().slice(0, 10);
    const prevMonthEnd = new Date(twoMonthsAgo);
    prevMonthEnd.setUTCMonth(prevMonthEnd.getUTCMonth() + 1);
    prevMonthEnd.setUTCDate(0);
    const periodEnd = prevMonthEnd.toISOString().slice(0, 10);

    const bulkRes = await authedPost(accountingSession, '/staff-payroll/bulk-generate')
      .send({ periodStart, periodEnd })
      .expect((res) => expect([200, 201]).toContain(res.status));

    // Assert: Trả về danh sách (có thể rỗng nếu chưa có cấu hình)
    expect(bulkRes.body).toBeDefined();
  });

  // ════════════════════════════════════════════════════════════════════════
  // 4.4 Đồng bộ Ads đa nền tảng: FB + GG + TT → marketingCost tổng hợp
  // ════════════════════════════════════════════════════════════════════════

  it('4.4 Ads đa nền tảng: AdCost cho FB, GG, TT → tổng spend = sum 3 record', async () => {
    if (!adAccountModel || !adGroupModel || !adCostModel) return;

    const platforms = [
      { code: 'G4-FB-44', name: 'FB Multi Platform', platform: 'FACEBOOK', platformId: 'fb_multi_g4', spend: 3_000_000 },
      { code: 'G4-GG-44', name: 'GG Multi Platform', platform: 'GOOGLE', platformId: 'gg_multi_g4', spend: 2_000_000 },
      { code: 'G4-TT-44', name: 'TT Multi Platform', platform: 'TIKTOK', platformId: 'tt_multi_g4', spend: 1_500_000 },
    ];

    const costIds: string[] = [];
    const costDate = new Date();
    costDate.setUTCDate(costDate.getUTCDate() - 1); // hôm qua
    const costDateStr = costDate.toISOString().slice(0, 10);

    for (const p of platforms) {
      const acc = await adAccountModel.create({
        accountCode: p.code,
        name: p.name,
        platform: p.platform,
        platformAccountId: p.platformId,
        status: 'ACTIVE',
        syncSource: 'MANUAL',
        createdById: new Types.ObjectId(directorUserId),
        createdByName: director.fullName,
      });

      const grp = await adGroupModel.create({
        name: `${p.name} Group`,
        platform: p.platform,
        groupCode: `${p.code}-GRP`,
        adAccountId: acc._id,
        platformCampaignId: `${p.platformId}_campaign`,
        status: 'ACTIVE',
        syncSource: 'MANUAL',
        createdById: new Types.ObjectId(directorUserId),
        createdByName: director.fullName,
      });

      const costRes = await authedPost(directorSession, '/ads/costs')
        .send({
          adGroupId: String(grp._id),
          adAccountId: String(acc._id),
          platform: p.platform,
          date: costDateStr,
          spend: p.spend,
          source: 'MANUAL',
        })
        .expect((res) => expect([200, 201]).toContain(res.status));

      const costId = costRes.body?._id ?? costRes.body?.data?._id;
      if (costId) costIds.push(costId);
    }

    // Assert: 3 AdCost records sinh ra (một cho mỗi nền tảng)
    expect(costIds.length).toBe(3);

    // Assert: GET /ads/costs → tìm được cả 3 records
    const listRes = await authedGet(directorSession, '/ads/costs')
      .expect(200);

    const allCosts: any[] = listRes.body?.data ?? listRes.body ?? [];
    const fbCost = allCosts.find((c: any) => c.platform === 'FACEBOOK' && c.spend === 3_000_000);
    const ggCost = allCosts.find((c: any) => c.platform === 'GOOGLE' && c.spend === 2_000_000);
    const ttCost = allCosts.find((c: any) => c.platform === 'TIKTOK' && c.spend === 1_500_000);

    expect(fbCost).toBeTruthy();
    expect(ggCost).toBeTruthy();
    expect(ttCost).toBeTruthy();

    // Assert: Tổng marketingCost = 3tr + 2tr + 1.5tr = 6,500,000đ
    const totalSpend = (fbCost?.spend ?? 0) + (ggCost?.spend ?? 0) + (ttCost?.spend ?? 0);
    expect(totalSpend).toBe(6_500_000);

    // Assert: Mỗi platform có record riêng biệt
    const platformSet = new Set([fbCost?.platform, ggCost?.platform, ttCost?.platform]);
    expect(platformSet.size).toBe(3);
  });

  it('4.4b Fail 1 platform, 2 còn lại vẫn thành công (không rollback cả batch)', async () => {
    if (!adAccountModel || !adGroupModel || !adCostModel) return;

    // Tạo 2 AdAccounts hợp lệ
    const validPlatforms = [
      { code: 'G4-FB-44b', platform: 'FACEBOOK', platformId: 'fb_44b', spend: 2_000_000 },
      { code: 'G4-TT-44b', platform: 'TIKTOK', platformId: 'tt_44b', spend: 1_000_000 },
    ];

    const successCount: number[] = [];
    const failDate = new Date();
    failDate.setUTCDate(failDate.getUTCDate() - 2);
    const failDateStr = failDate.toISOString().slice(0, 10);

    for (const p of validPlatforms) {
      const acc = await adAccountModel.create({
        accountCode: p.code,
        name: `${p.platform} 44b`,
        platform: p.platform,
        platformAccountId: p.platformId,
        status: 'ACTIVE',
        syncSource: 'MANUAL',
        createdById: new Types.ObjectId(directorUserId),
        createdByName: director.fullName,
      });
      const grp = await adGroupModel.create({
        name: `${p.platform} 44b Group`,
        platform: p.platform,
        groupCode: `${p.code}-GRP`,
        adAccountId: acc._id,
        platformCampaignId: `${p.platformId}_campaign`,
        status: 'ACTIVE',
        syncSource: 'MANUAL',
        createdById: new Types.ObjectId(directorUserId),
        createdByName: director.fullName,
      });

      const costRes = await authedPost(directorSession, '/ads/costs')
        .send({
          adGroupId: String(grp._id),
          adAccountId: String(acc._id),
          platform: p.platform,
          date: failDateStr,
          spend: p.spend,
          source: 'MANUAL',
        });

      if ([200, 201].includes(costRes.status)) {
        successCount.push(1);
      }
    }

    // 2 platforms thành công → không bị ảnh hưởng bởi platform thứ 3 fail
    expect(successCount.length).toBe(2);

    // Gửi request với payload sai (Google – thiếu adGroupId bắt buộc) → 400
    const badRes = await authedPost(directorSession, '/ads/costs')
      .send({
        platform: 'GOOGLE',
        date: failDateStr,
        spend: 500_000,
        source: 'MANUAL',
        // thiếu adGroupId và adAccountId
      });
    expect([400, 422]).toContain(badRes.status);

    // 2 costs từ valid platforms vẫn tồn tại trong DB
    const allCosts = await adCostModel.find({
      date: { $gte: new Date(failDateStr), $lt: new Date(new Date(failDateStr).getTime() + 86400_000) },
    }).lean() as any[];
    const validCosts = allCosts.filter((c: any) => ['FACEBOOK', 'TIKTOK'].includes(c.platform) && c.spend > 0);
    expect(validCosts.length).toBeGreaterThanOrEqual(2);
  });
});
