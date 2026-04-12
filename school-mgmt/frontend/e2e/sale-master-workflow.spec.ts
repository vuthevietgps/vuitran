import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { expect, test, type APIRequestContext, type Locator, type Page, type TestInfo } from '@playwright/test';
import { acceptDialog, approvalFile, apiJson, getProducts, loginAsRole, roleEmail, rolePassword, uniquePhone } from './support';

const APP_BASE_URL =
  process.env['PLAYWRIGHT_BASE_URL'] ||
  process.env['E2E_BASE_URL'] ||
  'http://localhost:4200';

const API_BASE_URL =
  process.env['PLAYWRIGHT_API_BASE_URL'] ||
  process.env['E2E_API_BASE_URL'] ||
  'http://127.0.0.1:3000';

const API_PATTERN = escapeRegExp(API_BASE_URL.replace(/\/$/, ''));

const DASHBOARD_SALES_API = new RegExp(`${API_PATTERN}/dashboard/sales(?:\\?.*)?$`);
const DASHBOARD_DAILY_TASKS_API = new RegExp(`${API_PATTERN}/dashboard/daily-tasks(?:\\?.*)?$`);
const COMMISSION_REPORT_API = new RegExp(`${API_PATTERN}/orders/commission-report(?:\\?.*)?$`);
const LEADS_LIST_API = new RegExp(`${API_PATTERN}/leads(?:\\?.*)?$`);
const LEADS_PIPELINE_API = new RegExp(`${API_PATTERN}/leads/pipeline(?:\\?.*)?$`);
const LEADS_FOLLOWUPS_API = new RegExp(`${API_PATTERN}/leads/follow-ups(?:\\?.*)?$`);
const LEAD_DETAIL_API = new RegExp(`${API_PATTERN}/leads/([^/?]+)(?:\\?.*)?$`);
const CHATBOT_FANPAGES_API = new RegExp(`${API_PATTERN}/chatbot/fanpages(?:\\?.*)?$`);
const CHATBOT_CONVERSATIONS_API = new RegExp(
  `${API_PATTERN}/chatbot/conversations(?:/[^/?]+(?:/(?:messages|takeover|create-lead))?)?(?:\\?.*)?$`,
);
const RECEIPT_UPLOAD_API = new RegExp(`${API_PATTERN}/invoices/receipt-upload(?:\\?.*)?$`);
const CLASSES_API = new RegExp(`${API_PATTERN}/classes(?:\\?.*)?$`);
const SESSIONS_STATS_API = new RegExp(`${API_PATTERN}/sessions/stats(?:\\?.*)?$`);
const SESSIONS_LIST_API = new RegExp(`${API_PATTERN}/sessions(?:\\?.*)?$`);
const SESSION_DETAIL_API = new RegExp(`${API_PATTERN}/sessions/session-sale-master-001(?:\\?.*)?$`);
const SESSION_CHANGE_REQUESTS_API = new RegExp(
  `${API_PATTERN}/sessions/session-sale-master-001/change-requests(?:\\?.*)?$`,
);
const TEACHERS_API = new RegExp(`${API_PATTERN}/teachers(?:\\?.*)?$`);

test.use({
  video: 'on',
  trace: 'off',
});

function sanitizeFileSegment(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function hasFfmpeg(): boolean {
  const probe =
    process.platform === 'win32'
      ? spawnSync('where.exe', ['ffmpeg'], { stdio: 'ignore' })
      : spawnSync('which', ['ffmpeg'], { stdio: 'ignore' });
  return probe.status === 0;
}

async function attachMp4IfPossible(page: Page, testInfo: TestInfo): Promise<void> {
  const recordedVideo = page.video();
  if (!recordedVideo) {
    return;
  }

  const webmPath = await recordedVideo.path();
  await page.close().catch(() => undefined);

  if (!hasFfmpeg()) {
    testInfo.annotations.push({
      type: 'video-format',
      description: 'ffmpeg is unavailable, so Playwright keeps the native webm recording only.',
    });
    return;
  }

  mkdirSync(testInfo.outputDir, { recursive: true });
  const mp4Path = join(testInfo.outputDir, `${sanitizeFileSegment(testInfo.title) || 'sale-master-workflow'}.mp4`);
  const conversion = spawnSync(
    'ffmpeg',
    ['-y', '-i', webmPath, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', 'faststart', mp4Path],
    { encoding: 'utf8' },
  );

  if (conversion.status === 0) {
    await testInfo.attach('sale-master-workflow-mp4', {
      path: mp4Path,
      contentType: 'video/mp4',
    });
    return;
  }

  testInfo.annotations.push({
    type: 'video-format',
    description: `Unable to transcode video to mp4. ffmpeg exited with code ${conversion.status ?? 'unknown'}.`,
  });
}

type ProductFixture = {
  _id: string;
  name: string;
};

test.afterEach(async ({ page }, testInfo) => {
  await attachMp4IfPossible(page, testInfo);
});

type LeadFixture = {
  _id: string;
  leadCode: string;
  parentName: string;
  parentPhone: string;
  parentEmail: string;
  studentName: string;
  studentGrade: string;
  source: string;
  status: string;
  saleId: string;
  saleName: string;
  estimatedValue: number;
  notes: string;
  nextFollowUp: string;
  createdAt: string;
  assignedAt: string;
  lastContactAt: string;
  contactHistory: Array<{
    date: string;
    method: string;
    notes: string;
  }>;
};

type ConversationFixtureState = {
  conversation: {
    _id: string;
    conversationCode: string;
    fanpageId: string;
    fanpageName: string;
    platform: string;
    platformUserId: string;
    customerName: string;
    customerPhone: string;
    customerEmail: string;
    status: 'AI_HANDLING' | 'HUMAN_HANDLING';
    assignedAgentId?: string;
    assignedAgentName?: string;
    lastMessageAt: string;
    messageCount: number;
    notes: string;
    leadId?: string;
    createdAt: string;
    updatedAt: string;
  };
  messages: Array<{
    _id: string;
    conversationId: string;
    senderType: 'CUSTOMER' | 'AI' | 'HUMAN_AGENT';
    senderName: string;
    content: string;
    status: string;
    createdAt: string;
  }>;
  createdLeadPayloads: Array<Record<string, unknown>>;
};

type SessionHarnessState = {
  createdPayloads: Array<Record<string, unknown>>;
  history: Array<Record<string, unknown>>;
};

class SaleWorkflowPage {
  constructor(private readonly page: Page) {}

  appUrl(path: string): string {
    return new URL(path, APP_BASE_URL).toString();
  }

  async goto(path: string): Promise<void> {
    await this.page.goto(this.appUrl(path));
    await this.page.waitForLoadState('domcontentloaded');
  }

  async pause(ms = 2_000): Promise<void> {
    await this.page.waitForTimeout(ms);
  }

  async slowFill(locator: Locator, value: string, delay = 35): Promise<void> {
    await expect(locator).toBeVisible({ timeout: 20_000 });
    await locator.click();
    await locator.fill('');
    await locator.pressSequentially(value, { delay });
  }

  async fillFilterInput(value: string): Promise<void> {
    const input = this.page.locator('section.filters input').first();
    await this.slowFill(input, value, 24);
  }

  async selectOptionWithFallback(locator: Locator, preferredValue?: string): Promise<string> {
    await expect(locator).toBeVisible({ timeout: 20_000 });
    const options = await locator.locator('option').evaluateAll((items) =>
      items.map((item) => ({
        value: (item as HTMLOptionElement).value,
      })),
    );

    const selected =
      options.find((option) => option.value && option.value === preferredValue)?.value ||
      options.find((option) => option.value && !option.value.startsWith('__'))?.value;

    if (!selected) {
      throw new Error('Khong tim thay option hop le de chon.');
    }

    await locator.selectOption(selected);
    return selected;
  }

  async loginAsSale(): Promise<void> {
    await this.goto('/login');
    await expect(this.page.getByTestId('login-form')).toBeVisible();

    await this.slowFill(this.page.getByTestId('login-email'), roleEmail('sale'));
    await this.pause(1_000);
    await this.slowFill(this.page.getByTestId('login-password'), rolePassword());
    await this.pause();

    await this.page.getByTestId('login-submit').click();
    await this.page.waitForURL(/\/app\/dashboard/, { timeout: 30_000 });
  }

  async openOrderCreateModal(): Promise<void> {
    // UI hiện tại tạo order bằng modal trong /app/orders thay vì route riêng /app/orders/create.
    await this.goto('/app/orders');
    await expect(this.page.getByTestId('orders-create-button')).toBeVisible();
    await this.pause();
    await this.page.getByTestId('orders-create-button').click();
    await expect(this.page.getByTestId('order-form-modal')).toBeVisible();
  }

  async filterOrderByKeyword(keyword: string): Promise<void> {
    await this.fillFilterInput(keyword);
    await this.pause(1_500);
  }

  orderRowByStudent(studentName: string): Locator {
    return this.page
      .locator('[data-testid="order-row"], table.data tbody tr')
      .filter({ hasText: studentName })
      .first();
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function nowIso(offsetMinutes = 0): string {
  return new Date(Date.now() + (offsetMinutes * 60 * 1000)).toISOString();
}

function buildLeadFixture(): LeadFixture {
  return {
    _id: 'lead-sale-master-001',
    leadCode: 'LEAD-SALE-MASTER-001',
    parentName: 'Phu huynh Follow-up',
    parentPhone: '0900001111',
    parentEmail: 'followup.parent@school.local',
    studentName: 'Hoc vien Follow-up',
    studentGrade: 'Lop 6',
    source: 'FACEBOOK',
    status: 'CONTACTED',
    saleId: 'sale-demo-001',
    saleName: 'Sale Demo',
    estimatedValue: 2_400_000,
    notes: 'Lead duoc dung de demo bo loc follow-up.',
    nextFollowUp: nowIso(45),
    createdAt: nowIso(-180),
    assignedAt: nowIso(-120),
    lastContactAt: nowIso(-60),
    contactHistory: [
      {
        date: nowIso(-60),
        method: 'CALL',
        notes: 'Da goi lan 1 va hen goi lai buoi toi.',
      },
    ],
  };
}

function buildConversationState(): ConversationFixtureState {
  const createdAt = nowIso(-30);
  return {
    conversation: {
      _id: 'conversation-sale-master-001',
      conversationCode: 'CHAT-SALE-MASTER-001',
      fanpageId: 'fanpage-main-001',
      fanpageName: 'Main Enrollment Fanpage',
      platform: 'FACEBOOK',
      platformUserId: 'fb-user-sale-master-001',
      customerName: 'Tran Minh Anh',
      customerPhone: '0900002222',
      customerEmail: 'minhanh.parent@example.test',
      status: 'AI_HANDLING',
      lastMessageAt: nowIso(-10),
      messageCount: 3,
      notes: 'Hoi thoai chatbot can sale tiep quan de tao lead.',
      createdAt,
      updatedAt: createdAt,
    },
    messages: [
      {
        _id: 'msg-sale-master-001',
        conversationId: 'conversation-sale-master-001',
        senderType: 'CUSTOMER',
        senderName: 'Tran Minh Anh',
        content: 'Cho minh xin tu van khoa hoc cho be lop 4.',
        status: 'SENT',
        createdAt: nowIso(-18),
      },
      {
        _id: 'msg-sale-master-002',
        conversationId: 'conversation-sale-master-001',
        senderType: 'AI',
        senderName: 'Enrollment Bot',
        content: 'Bot da hoi thu thong tin ban dau va dang cho sale tiep nhan.',
        status: 'SENT',
        createdAt: nowIso(-15),
      },
      {
        _id: 'msg-sale-master-003',
        conversationId: 'conversation-sale-master-001',
        senderType: 'AI',
        senderName: 'Enrollment Bot',
        content: 'Phu huynh da de lai so dien thoai va nhu cau hoc online.',
        status: 'SENT',
        createdAt: nowIso(-12),
      },
    ],
    createdLeadPayloads: [],
  };
}

function buildDailyTaskBoard() {
  return {
    role: 'SALE',
    generatedAt: nowIso(),
    summary: {
      totalTasks: 3,
      overdueTasks: 0,
      dueTodayTasks: 3,
      highPriorityTasks: 2,
    },
    tabs: [
      {
        key: 'sales',
        label: 'Sale can xu ly',
        description: 'Danh sach viec can mo module de thao tac ngay trong video demo.',
        emptyMessage: 'Khong co viec nao.',
        count: 3,
        tasks: [
          {
            id: 'task-1',
            type: 'lead',
            title: 'Follow-up lead nong',
            detail: 'Lead tu chatbot dang can goi lai trong hom nay.',
            priority: 'HIGH',
            route: '/app/leads',
            actionLabel: 'Mo leads',
            overdue: false,
          },
          {
            id: 'task-2',
            type: 'order',
            title: 'Len order cho khach moi',
            detail: 'Khach da gui bien lai va can submit duyet.',
            priority: 'CRITICAL',
            route: '/app/orders',
            actionLabel: 'Mo orders',
            overdue: false,
          },
          {
            id: 'task-3',
            type: 'commission',
            title: 'Doi chieu hoa hong',
            detail: 'Kiem tra doanh so va hoa hong da ghi nhan.',
            priority: 'MEDIUM',
            route: '/app/commission-report',
            actionLabel: 'Mo bao cao',
            overdue: false,
          },
        ],
      },
    ],
  };
}

function buildDashboardSalesData() {
  return {
    leads: {
      total: 18,
      converted: 6,
      conversionRate: 33,
      active: 12,
      byStatus: {
        NEW: 4,
        CONTACTED: 5,
        CONSULTING: 4,
        INTERESTED: 3,
        CONVERTED: 2,
      },
      followUpsDueToday: [
        {
          leadCode: 'LEAD-SALE-MASTER-001',
          parentName: 'Phu huynh Follow-up',
          parentPhone: '0900001111',
          status: 'CONTACTED',
          nextFollowUp: nowIso(45),
        },
      ],
      followUpsOverdue: 0,
    },
    orders: {
      total: 9,
      byStatus: {
        DRAFT: 1,
        SUBMITTED: 2,
        APPROVED: 3,
        COMPLETED: 2,
        REJECTED: 1,
      },
      revenueGenerated: 18_500_000,
      commissionEarned: 1_850_000,
      commissionPending: 450_000,
      recentOrders: [
        {
          orderCode: 'OD-SALE-MASTER-001',
          parentName: 'Phu huynh Follow-up',
          studentName: 'Hoc vien Follow-up',
          finalAmount: 4_500_000,
          saleCommission: 450_000,
          status: 'SUBMITTED',
          createdAt: nowIso(-120),
        },
      ],
    },
  };
}

function buildCommissionReport() {
  return {
    summary: {
      totalRevenue: 18_500_000,
      totalCommission: 1_850_000,
      pendingCommission: 450_000,
      totalOrders: 9,
    },
    byMonth: [
      {
        month: '2026-04',
        revenue: 18_500_000,
        commission: 1_850_000,
        count: 9,
      },
    ],
    details: [
      {
        orderCode: 'OD-SALE-MASTER-001',
        parentName: 'Phu huynh Follow-up',
        studentName: 'Hoc vien Follow-up',
        finalAmount: 4_500_000,
        saleCommission: 450_000,
        status: 'SUBMITTED',
        saleName: 'Sale Demo',
        createdAt: nowIso(-120),
      },
      {
        orderCode: 'OD-SALE-MASTER-002',
        parentName: 'Phu huynh Chot Don',
        studentName: 'Hoc vien Chot Don',
        finalAmount: 6_000_000,
        saleCommission: 600_000,
        status: 'COMPLETED',
        saleName: 'Sale Demo',
        createdAt: nowIso(-240),
      },
    ],
  };
}

function buildSessionHarnessState(): SessionHarnessState {
  return {
    createdPayloads: [],
    history: [
      {
        _id: 'session-change-history-approved-001',
        requestedBy: { fullName: 'Sale Demo', role: 'SALE' },
        reviewedBy: { fullName: 'OPS Demo', role: 'OPS' },
        reviewedAt: nowIso(-2880),
        currentTeacherId: { _id: 'teacher-current-001', fullName: 'Teacher Hien Tai' },
        requestedTeacherId: { _id: 'teacher-backup-001', fullName: 'Teacher De Xuat' },
        currentScheduledDate: '2026-04-14',
        currentStartTime: '18:00',
        currentEndTime: '19:00',
        requestedScheduledDate: '2026-04-15',
        requestedStartTime: '19:00',
        requestedEndTime: '20:00',
        currentDurationMinutes: 60,
        requestedDurationMinutes: 60,
        reason: 'Da tung doi giao vien mot lan truoc do.',
        status: 'APPROVED',
        financialImpact: {
          oldDurationMinutes: 60,
          newDurationMinutes: 60,
          oldAmountCharged: 250_000,
          newAmountCharged: 250_000,
          deltaAmountCharged: 0,
          oldTeacherPayout: 150_000,
          newTeacherPayout: 150_000,
          deltaTeacherPayout: 0,
        },
      },
    ],
  };
}

async function ensureUsableProduct(request: APIRequestContext): Promise<ProductFixture> {
  const directorSession = await loginAsRole(request, 'director');
  const existingProducts = await getProducts(request, directorSession);
  const activeProduct = existingProducts.find((product) => product && product.isActive !== false);

  if (activeProduct?._id) {
    return {
      _id: activeProduct._id,
      name: activeProduct.name || 'Product dang hoat dong',
    };
  }

  const createdProduct = await apiJson<any>(
    request,
    directorSession,
    'POST',
    '/products',
    {
      name: `Sale Master Product ${Date.now()}`,
      code: `SMP${String(Date.now()).slice(-6)}`,
      description: 'Product tao rieng cho sale master workflow.',
      category: 'ENGLISH',
      teachingMode: 'ONLINE',
      defaultSessions: 12,
      defaultSessionDuration: 60,
      pricePerSession: 100_000,
      suggestedPrice: 1_200_000,
      commissionRate: 0,
      isActive: true,
    },
  );

  return {
    _id: createdProduct._id,
    name: createdProduct.name || 'Sale Master Product',
  };
}

async function installDashboardRoutes(page: Page): Promise<void> {
  const report = buildCommissionReport();

  await page.route(DASHBOARD_SALES_API, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(buildDashboardSalesData()),
    });
  });

  await page.route(DASHBOARD_DAILY_TASKS_API, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(buildDailyTaskBoard()),
    });
  });

  await page.route(COMMISSION_REPORT_API, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(report),
    });
  });
}

async function installLeadRoutes(page: Page, lead: LeadFixture): Promise<void> {
  const allLeads = [lead];
  const pipeline = {
    pipeline: {
      NEW: { count: 2, estimatedValue: 4_000_000 },
      CONTACTED: { count: 1, estimatedValue: 2_400_000 },
      CONSULTING: { count: 1, estimatedValue: 2_800_000 },
      INTERESTED: { count: 1, estimatedValue: 3_200_000 },
      CONVERTED: { count: 1, estimatedValue: 4_500_000 },
    },
    total: 6,
    conversionRate: 17,
    assignedCount: 5,
    unassignedCount: 1,
  };

  await page.route(LEADS_PIPELINE_API, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(pipeline),
    });
  });

  await page.route(LEADS_FOLLOWUPS_API, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([lead]),
    });
  });

  await page.route(LEADS_LIST_API, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/leads/pipeline') || url.pathname.endsWith('/leads/follow-ups')) {
      await route.fallback();
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(allLeads),
    });
  });

  await page.route(LEAD_DETAIL_API, async (route) => {
    const url = new URL(route.request().url());
    const match = url.pathname.match(/\/leads\/([^/]+)$/);
    if (!match || match[1] !== lead._id) {
      await route.fallback();
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(lead),
    });
  });
}

async function installConversationRoutes(page: Page, state: ConversationFixtureState): Promise<void> {
  await page.route(CHATBOT_FANPAGES_API, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [
          {
            _id: 'fanpage-main-001',
            fanpageCode: 'FP-MAIN-001',
            name: 'Main Enrollment Fanpage',
            platform: 'FACEBOOK',
            pageId: 'page-001',
            status: 'ACTIVE',
            aiAutoReplyEnabled: true,
            createdAt: nowIso(-1440),
            updatedAt: nowIso(-5),
          },
        ],
        total: 1,
        page: 1,
        limit: 20,
      }),
    });
  });

  await page.route(CHATBOT_CONVERSATIONS_API, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    const path = url.pathname;

    if (method === 'GET' && path.endsWith('/chatbot/conversations')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [state.conversation],
          total: 1,
          page: 1,
          limit: 20,
        }),
      });
      return;
    }

    if (method === 'GET' && path.endsWith(`/chatbot/conversations/${state.conversation._id}`)) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(state.conversation),
      });
      return;
    }

    if (method === 'GET' && path.endsWith(`/chatbot/conversations/${state.conversation._id}/messages`)) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: state.messages,
          total: state.messages.length,
          page: 1,
          limit: 50,
        }),
      });
      return;
    }

    if (method === 'POST' && path.endsWith(`/chatbot/conversations/${state.conversation._id}/takeover`)) {
      state.conversation = {
        ...state.conversation,
        status: 'HUMAN_HANDLING',
        assignedAgentId: 'sale-demo-001',
        assignedAgentName: 'Sale Demo',
        updatedAt: nowIso(),
      };

      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      });
      return;
    }

    if (method === 'POST' && path.endsWith(`/chatbot/conversations/${state.conversation._id}/create-lead`)) {
      const payload = request.postDataJSON() as Record<string, unknown>;
      state.createdLeadPayloads.push(payload);
      state.conversation = {
        ...state.conversation,
        leadId: 'lead-created-from-conversation-001',
        updatedAt: nowIso(),
      };

      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          _id: 'lead-created-from-conversation-001',
          parentName: payload.parentName,
          parentPhone: payload.parentPhone,
          studentName: payload.studentName,
        }),
      });
      return;
    }

    await route.fallback();
  });
}

async function installReceiptUploadRoute(page: Page): Promise<void> {
  await page.route(RECEIPT_UPLOAD_API, async (route) => {
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        url: `/uploads/e2e/sale-master-receipt-${Date.now()}.png`,
      }),
    });
  });
}

async function installSessionRoutes(page: Page, state: SessionHarnessState): Promise<void> {
  await page.route(CLASSES_API, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          _id: 'class-sale-master-001',
          name: 'Lop Sale Master',
          code: 'CLS-SALE-001',
        },
      ]),
    });
  });

  await page.route(SESSIONS_STATS_API, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        totalSessions: 1,
        totalRevenue: 250_000,
        totalTeacherCost: 150_000,
        byStatus: {
          SCHEDULED: {
            count: 1,
            totalCharged: 250_000,
            totalPayout: 150_000,
          },
        },
      }),
    });
  });

  await page.route(SESSIONS_LIST_API, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/sessions/stats') || url.pathname.endsWith('/sessions/session-sale-master-001')) {
      await route.fallback();
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [
          {
            _id: 'session-sale-master-001',
            classId: {
              _id: 'class-sale-master-001',
              name: 'Lop Sale Master',
              code: 'CLS-SALE-001',
            },
            studentId: {
              _id: 'student-sale-master-001',
              fullName: 'Hoc vien Session Demo',
              studentCode: 'HS-SESSION-001',
            },
            teacherId: {
              _id: 'teacher-current-001',
              fullName: 'Teacher Hien Tai',
            },
            scheduledDate: '2026-04-14',
            scheduledStartTime: '18:00',
            scheduledEndTime: '19:00',
            durationMinutes: 60,
            amountCharged: 250_000,
            teacherPayout: 150_000,
            status: 'SCHEDULED',
            isPaid: false,
            isTeacherPaid: false,
          },
        ],
        meta: {
          totalPages: 1,
          total: 1,
          page: 1,
          limit: 20,
        },
      }),
    });
  });

  await page.route(SESSION_DETAIL_API, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        _id: 'session-sale-master-001',
        classId: {
          _id: 'class-sale-master-001',
          name: 'Lop Sale Master',
          code: 'CLS-SALE-001',
        },
        studentId: {
          _id: 'student-sale-master-001',
          fullName: 'Hoc vien Session Demo',
          studentCode: 'HS-SESSION-001',
        },
        teacherId: {
          _id: 'teacher-current-001',
          fullName: 'Teacher Hien Tai',
        },
        scheduledDate: '2026-04-14',
        scheduledStartTime: '18:00',
        scheduledEndTime: '19:00',
        durationMinutes: 60,
        amountCharged: 250_000,
        teacherPayout: 150_000,
        status: 'SCHEDULED',
        isPaid: false,
        isTeacherPaid: false,
        editHistory: [],
      }),
    });
  });

  await page.route(SESSION_CHANGE_REQUESTS_API, async (route) => {
    if (route.request().method() === 'POST') {
      const payload = route.request().postDataJSON() as Record<string, unknown>;
      state.createdPayloads.push(payload);
      state.history = [
        {
          _id: 'session-change-history-pending-001',
          requestedBy: {
            fullName: 'Sale Demo',
            role: 'SALE',
          },
          currentTeacherId: {
            _id: 'teacher-current-001',
            fullName: 'Teacher Hien Tai',
          },
          requestedTeacherId: payload.requestedTeacherId
            ? {
                _id: String(payload.requestedTeacherId),
                fullName: 'Teacher De Xuat',
              }
            : undefined,
          currentScheduledDate: '2026-04-14',
          currentStartTime: '18:00',
          currentEndTime: '19:00',
          requestedScheduledDate: payload.requestedScheduledDate,
          requestedStartTime: payload.requestedStartTime,
          requestedEndTime: payload.requestedEndTime,
          currentDurationMinutes: 60,
          requestedDurationMinutes: 60,
          reason: payload.reason,
          status: 'PENDING',
          requestedAt: nowIso(),
          financialImpact: {
            oldDurationMinutes: 60,
            newDurationMinutes: 60,
            oldAmountCharged: 250_000,
            newAmountCharged: 250_000,
            deltaAmountCharged: 0,
            oldTeacherPayout: 150_000,
            newTeacherPayout: 150_000,
            deltaTeacherPayout: 0,
          },
        },
        ...state.history,
      ];

      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(state.history[0]),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(state.history),
    });
  });

  await page.route(TEACHERS_API, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          _id: 'teacher-profile-current-001',
          userId: {
            _id: 'teacher-current-001',
            fullName: 'Teacher Hien Tai',
            email: 'teacher.current@example.test',
          },
          fullName: 'Teacher Hien Tai',
          status: 'ACTIVE',
        },
        {
          _id: 'teacher-profile-backup-001',
          userId: {
            _id: 'teacher-backup-001',
            fullName: 'Teacher De Xuat',
            email: 'teacher.backup@example.test',
          },
          fullName: 'Teacher De Xuat',
          status: 'ACTIVE',
        },
      ]),
    });
  });
}

test.describe.serial('Sale master workflow', () => {
  test('records the full sale master workflow with step-by-step video-friendly pacing', async ({
    page,
    request,
  }) => {
    test.slow();
    test.setTimeout(600_000);

    const ui = new SaleWorkflowPage(page);

    const usableProduct = await ensureUsableProduct(request);
    const leadFixture = buildLeadFixture();
    const conversationState = buildConversationState();
    const sessionState = buildSessionHarnessState();

    const runSuffix = `${Date.now()}`.slice(-6);
    const draftStudentName = `Hoc vien sale master ${runSuffix}`;
    const parentName = `Phu huynh sale master ${runSuffix}`;
    const parentPhone = uniquePhone(`sale-master-${runSuffix}`);
    const invoiceNumber = `INV-SALE-${runSuffix}`;

    await installDashboardRoutes(page);
    await installReceiptUploadRoute(page);

    // Step 1: Đăng nhập UI thật, xác nhận redirect dashboard và kiểm tra các widget thống kê.
    await test.step('Step 1 - Login bằng tài khoản Sale và verify dashboard widgets', async () => {
      await ui.loginAsSale();
      await expect(page).toHaveURL(/\/app\/dashboard/);

      await expect(page.getByTestId('dashboard-handbook-banner')).toBeVisible();
      await expect(page.getByTestId('sale-dashboard-kpi-grid')).toBeVisible();
      await expect(page.getByText(/Follow-up hôm nay|Follow-up hom nay/i)).toBeVisible();
      await expect(page.getByText(/Pipeline đơn hàng|Pipeline don hang/i)).toBeVisible();
      await expect(page.getByText(/Danh sach can xu ly theo tai khoan/i)).toBeVisible();
      await ui.pause();

      // Mở cẩm nang để video có đủ ngữ cảnh "khởi động ngày mới", sau đó quay lại dashboard.
      await page.getByTestId('dashboard-handbook-link').click();
      await expect(page).toHaveURL(/\/app\/internal-handbook/);
      await ui.pause();
      await page.goBack();
      await expect(page).toHaveURL(/\/app\/dashboard/);
      await ui.pause();
    });

    // Step 2: Mock module Leads để luôn có 1 lead cần follow-up, mở detail và thử Mark Lost rồi hủy.
    await test.step('Step 2 - Vào Leads, lọc Follow-up, mở detail và mở thử Mark Lost rồi Cancel', async () => {
      await installLeadRoutes(page, leadFixture);
      await ui.goto('/app/leads');

      const followUpTab = page.getByRole('button', { name: /Follow-up/i });
      await expect(followUpTab).toBeVisible();
      await followUpTab.click();
      await ui.pause();

      const leadRow = page.locator('table.data tbody tr').filter({ hasText: leadFixture.leadCode }).first();
      await expect(leadRow).toBeVisible();
      await leadRow.click();

      const leadDetailModal = page.locator('.modal-backdrop .modal.wide').first();
      await expect(leadDetailModal).toBeVisible();
      await expect(leadDetailModal).toContainText(leadFixture.parentPhone);
      await expect(leadDetailModal).toContainText(leadFixture.studentName);
      await ui.pause();

      await leadDetailModal.getByRole('button', { name: /Đóng|Dong/i }).click();
      await expect(leadDetailModal).toBeHidden();
      await ui.pause(1_500);

      await leadRow.locator('button.btn-sm.danger').click();
      const markLostModal = page.locator('.modal-backdrop .modal').filter({ hasText: /Đánh dấu lead mất|Danh dau lead mat/i }).first();
      await expect(markLostModal).toBeVisible();
      await markLostModal.locator('select[name="lostReason"]').selectOption('NO_LONGER_NEEDED');
      await ui.pause();

      // Chỉ mở modal và chọn lý do để demo, sau đó bấm Hủy để không làm bẩn dữ liệu demo.
      await markLostModal.getByRole('button', { name: /Hủy|Huy/i }).click();
      await expect(markLostModal).toBeHidden();
      await ui.pause();
    });

    // Step 3: Mock Conversations để luôn có 1 cuộc hội thoại chatbot; takeover rồi tạo lead từ sidebar.
    await test.step('Step 3 - Vào Conversations, takeover hội thoại và Convert to Lead', async () => {
      await installConversationRoutes(page, conversationState);
      await ui.goto('/app/conversations');

      const conversationCard = page.locator('.conv-card').first();
      await expect(conversationCard).toBeVisible();
      await conversationCard.click();
      await expect(page.locator('.conv-card.selected')).toContainText('Tran Minh Anh');
      await ui.pause();

      const takeoverButton = page.getByRole('button', { name: /Tiếp quản|Tiep quan/i });
      await expect(takeoverButton).toBeVisible();
      await takeoverButton.click();
      await ui.pause();

      const leadSection = page.locator('.sidebar-section').filter({ hasText: /Tạo Lead|Tao Lead/i }).first();
      await expect(leadSection).toBeVisible();
      await leadSection.getByRole('button', { name: /Tạo Lead từ hội thoại|Tao Lead tu hoi thoai/i }).click();
      await ui.pause(1_500);

      const leadInputs = leadSection.locator('.inline-form input');
      await ui.slowFill(leadInputs.nth(3), 'Be Nguyen Bao Chau');
      await ui.slowFill(leadSection.locator('.inline-form textarea').first(), 'Lead tao truc tiep tu hoi thoai chatbot.');
      await ui.pause(1_000);
      await leadSection.getByRole('button', { name: /^Tạo Lead$|^Tao Lead$/i }).click();

      await expect.poll(() => conversationState.createdLeadPayloads.length).toBe(1);
      await expect(page.locator('.linked-entity').filter({ hasText: /Lead/i }).first()).toBeVisible();
      await ui.pause();
    });

    // Step 4: Tạo order mới cho khách hoàn toàn mới bằng UI thật trong module Orders.
    await test.step('Step 4 - Tạo order mới cho khách hàng hoàn toàn mới', async () => {
      await ui.openOrderCreateModal();

      const orderModal = page.getByTestId('order-form-modal');
      await expect(orderModal).toBeVisible();

      await ui.slowFill(orderModal.getByTestId('order-parent-phone'), parentPhone);
      await ui.slowFill(orderModal.getByTestId('order-parent-name'), parentName);
      await ui.slowFill(orderModal.getByTestId('order-student-name'), draftStudentName);
      await ui.slowFill(orderModal.getByTestId('order-student-age'), '10');

      const productSelect = orderModal.getByTestId('order-item-product-0');
      await expect.poll(async () => productSelect.locator('option').count(), { timeout: 20_000 }).toBeGreaterThan(1);
      await ui.selectOptionWithFallback(productSelect, usableProduct._id);
      await ui.pause();

      await ui.slowFill(orderModal.getByTestId('order-item-sessions-0'), '12');
      await ui.slowFill(orderModal.getByTestId('order-invoice-sessions-0'), '12');
      await ui.slowFill(orderModal.getByTestId('order-invoice-amount-0'), '1200000');
      await ui.slowFill(orderModal.getByTestId('order-invoice-number-0'), invoiceNumber);
      await ui.slowFill(orderModal.getByTestId('order-consultation-notes'), 'Order demo cho role sale - khach moi hoan toan.');
      await ui.pause();
    });

    // Step 5: Nhập discount > total để assert validation, sau đó sửa về 0.
    await test.step('Step 5 - Nhập Discount lớn hơn Total và verify validation', async () => {
      const orderModal = page.getByTestId('order-form-modal');
      const totalAmount = Number(await orderModal.getByTestId('order-total-amount').inputValue());
      const invalidDiscount = totalAmount + 100_000;

      await ui.slowFill(orderModal.getByTestId('order-discount-amount'), `${invalidDiscount}`);
      await ui.pause(1_500);

      await expect(orderModal.getByTestId('order-discount-error')).toBeVisible();
      await expect(orderModal.getByTestId('order-submit')).toBeDisabled();
      await ui.pause();

      await ui.slowFill(orderModal.getByTestId('order-discount-amount'), '0');
      await expect(orderModal.getByTestId('order-discount-error')).toBeHidden();
      await expect(orderModal.getByTestId('order-submit')).toBeEnabled();
      await ui.pause();
    });

    // Step 6: Chuyển sang trả góp, nhập partial payment nhỏ hơn total, upload receipt dummy, lưu nháp.
    await test.step('Step 6 - Chuyển Payment Method sang Installment, nhập partial payment, upload receipt và submit form', async () => {
      const orderModal = page.getByTestId('order-form-modal');

      await orderModal.getByTestId('order-payment-plan').selectOption('INSTALLMENT_2');
      await ui.pause(1_000);

      // Trong UI hiện tại, partial payment được thể hiện bằng "Tiền hóa đơn" nhỏ hơn tổng giá trị order.
      await ui.slowFill(orderModal.getByTestId('order-invoice-amount-0'), '400000');
      await orderModal.getByTestId('order-receipt-file').setInputFiles(approvalFile(`sale-master-receipt-${runSuffix}.png`));
      await expect(orderModal.locator('text=Đã có chứng từ')).toBeVisible({ timeout: 15_000 });
      await ui.pause();

      // Nút submit trong modal tạo order ở trạng thái DRAFT; bước gửi duyệt sang SUBMITTED sẽ ở Step 7.
      await orderModal.getByTestId('order-submit').click();
      await expect(orderModal).toBeHidden({ timeout: 20_000 });
      await ui.pause();
    });

    // Step 7: Tìm order vừa tạo, bấm Gửi và assert trạng thái chuyển SUBMITTED.
    await test.step('Step 7 - Assert order chuyển sang trạng thái SUBMITTED', async () => {
      await ui.filterOrderByKeyword(draftStudentName);
      const orderRow = ui.orderRowByStudent(draftStudentName);
      await expect(orderRow).toBeVisible({ timeout: 20_000 });
      await ui.pause(1_500);

      const dialogMessage = await acceptDialog(page, () => orderRow.getByTestId('order-row-submit').click());
      expect(dialogMessage).toMatch(/Gửi duyệt đơn|Gui duyet don/i);
      await ui.pause();

      await expect(orderRow).toContainText(/SUBMITTED|Chờ duyệt|Cho duyet/i, { timeout: 20_000 });
      await ui.pause();
    });

    // Step 8: Mock Sessions để luôn có 1 buổi SCHEDULED và gửi yêu cầu đổi giáo viên.
    await test.step('Step 8 - Vào Sessions, mở buổi SCHEDULED và gửi yêu cầu thay đổi giáo viên', async () => {
      await installSessionRoutes(page, sessionState);
      await ui.goto('/app/sessions');

      const sessionRow = page.getByTestId('session-row-session-sale-master-001');
      await expect(sessionRow).toBeVisible();
      await sessionRow.getByTestId('sessions-view-detail').click();

      const changeRequestCard = page.getByTestId('sessions-change-request-card');
      await expect(changeRequestCard).toBeVisible();
      await expect(changeRequestCard.getByTestId('sessions-change-request-open')).toBeVisible();
      await ui.pause();

      await changeRequestCard.getByTestId('sessions-change-request-open').click();
      const requestForm = page.getByTestId('sessions-change-request-form');
      await expect(requestForm).toBeVisible();

      await requestForm.getByTestId('sessions-change-request-teacher').selectOption('teacher-backup-001');
      await ui.pause(1_000);
      await ui.slowFill(
        requestForm.getByTestId('sessions-change-request-reason'),
        'Phu huynh muon doi giao vien de phu hop phong cach hoc.',
      );
      await ui.pause(1_000);
      await requestForm.getByTestId('sessions-change-request-submit').click();

      await expect.poll(() => sessionState.createdPayloads.length).toBe(1);
      await expect(page.getByTestId('sessions-success-alert')).toContainText(/Đã gửi yêu cầu thay đổi buổi học|Da gui yeu cau thay doi buoi hoc/i);
      await expect(page.getByTestId('sessions-change-request-history')).toContainText(/Chờ duyệt|Cho duyet|PENDING/i);
      await ui.pause();
    });

    // Step 9: Vào báo cáo hoa hồng và verify summary + tables được render thành công.
    await test.step('Step 9 - Vào Commission Report và verify bảng dữ liệu load thành công', async () => {
      await ui.goto('/app/commission-report');

      await expect(page).toHaveURL(/\/app\/commission-report/);
      await expect(page.getByRole('heading', { name: /Báo cáo Hoa hồng|Bao cao Hoa hong/i })).toBeVisible();

      const stats = page.locator('.stats');
      await expect(stats).toContainText('18,500,000');
      await expect(stats).toContainText('1,850,000');
      await expect(stats).toContainText('450,000');
      await ui.pause();

      const detailTable = page.locator('table.data').nth(1);
      await expect(detailTable).toContainText('OD-SALE-MASTER-001');
      await expect(detailTable).toContainText('OD-SALE-MASTER-002');
      await expect(detailTable).toContainText('Sale Demo');
      await ui.pause();
    });

    // Step 10: Đăng xuất để đóng vòng đời thao tác của role Sale.
    await test.step('Step 10 - Logout khỏi hệ thống', async () => {
      await page.getByRole('button', { name: /Đăng xuất|Dang xuat/i }).click();
      await page.waitForURL(/\/login/, { timeout: 20_000 });
      await expect(page.getByTestId('login-form')).toBeVisible();
      await ui.pause();
    });
  });
});
