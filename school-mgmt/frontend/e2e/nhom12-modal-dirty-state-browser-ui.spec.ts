import { Buffer } from 'node:buffer';
import { expect, test, type APIRequestContext, type Browser, type Page } from '@playwright/test';
import { applySessionCookies, createBatchEvidenceContext, loginAsRole, type BatchEvidenceSession } from './support';

const APP_BASE_URL =
  process.env['PLAYWRIGHT_BASE_URL'] ||
  process.env['E2E_BASE_URL'] ||
  'http://localhost:4200';
const APP_ORIGIN = new URL(APP_BASE_URL).origin;
const RUN_DATE = process.env['UI_EVIDENCE_DATE'] || new Date().toISOString().slice(0, 10);

const TEACHING_MATERIALS_API = /\/teaching-materials(?:\?.*)?$/;
const TEACHING_MATERIALS_STATS_API = /\/teaching-materials\/stats(?:\?.*)?$/;
const CLASSES_API = /\/classes(?:\?.*)?$/;
const CHATBOT_FANPAGES_API = /\/chatbot\/fanpages(?:\?.*)?$/;
const CHATBOT_OPENAI_TOKENS_API = /\/chatbot\/openai-tokens(?:\?.*)?$/;
const ADS_ACCOUNTS_API = /\/ads\/accounts(?:\?.*)?$/;

type ClassItem = {
  _id: string;
  name: string;
  code: string;
};

type TeachingMaterial = {
  _id: string;
  title: string;
  originalName: string;
  fileUrl: string;
  fileType: string;
  fileSize: number;
  tags: string[];
  isShared: boolean;
  downloadCount: number;
  createdAt: string;
  updatedAt: string;
  subject?: string;
  grade?: string;
  description?: string;
  manualSummary?: string;
  extractionStatus?: string;
  classId?: { _id: string; name: string; code?: string } | string;
};

type MaterialsState = {
  materials: TeachingMaterial[];
  stats: {
    total: number;
    readyForAI: number;
    totalChunks: number;
    bySubject: Record<string, number>;
    byGrade: Record<string, number>;
    totalSizeBytes: number;
    totalSizeMB: number;
  };
  classes: ClassItem[];
};

type Fanpage = {
  _id: string;
  fanpageCode: string;
  name: string;
  platform: string;
  pageId: string;
  description?: string;
  syncSource?: string;
  businessName?: string;
  syncTokenLabel?: string;
  lastSyncedAt?: string;
  adAccountId?: string;
  openaiTokenId?: string;
  webhookVerifyToken?: string;
  status: string;
  aiAutoReplyEnabled: boolean;
  createdAt: string;
  updatedAt: string;
};

type OpenAIToken = {
  _id: string;
  label: string;
  apiKey: string;
  model: string;
  status: string;
  lastUsedAt?: string;
  createdAt: string;
};

type AdAccount = {
  _id: string;
  accountCode: string;
  name: string;
  platform: string;
  platformAccountId: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

type ChatbotSettingsState = {
  fanpages: Fanpage[];
  tokens: OpenAIToken[];
  adAccounts: AdAccount[];
};

function appUrl(path: string): string {
  return new URL(path, APP_BASE_URL).toString();
}

function nowIso(offsetMinutes = 0): string {
  return new Date(Date.now() + (offsetMinutes * 60 * 1000)).toISOString();
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function buildMaterialsState(): MaterialsState {
  return {
    materials: [
      {
        _id: 'material-existing-001',
        title: 'Starter Algebra Pack',
        description: 'Bo tai lieu dai so da co san.',
        manualSummary: 'Tai lieu khoi dong cho dai so co ban.',
        subject: 'Toan',
        grade: 'Lop 6',
        classId: {
          _id: 'class-b06-001',
          name: 'Lop Toan 6A',
          code: 'CLS-6A',
        },
        extractionStatus: 'READY',
        fileUrl: '/uploads/materials/algebra-pack.pdf',
        fileType: 'application/pdf',
        fileSize: 2048,
        originalName: 'starter-algebra-pack.pdf',
        tags: ['dai so'],
        isShared: true,
        downloadCount: 4,
        createdAt: '2026-04-09T01:00:00.000Z',
        updatedAt: '2026-04-09T01:00:00.000Z',
      },
    ],
    stats: {
      total: 1,
      readyForAI: 1,
      totalChunks: 8,
      bySubject: {
        Toan: 1,
      },
      byGrade: {
        'Lop 6': 1,
      },
      totalSizeBytes: 2048,
      totalSizeMB: 0,
    },
    classes: [
      {
        _id: 'class-b06-001',
        name: 'Lop Toan 6A',
        code: 'CLS-6A',
      },
      {
        _id: 'class-b06-002',
        name: 'Lop Anh 5B',
        code: 'CLS-5B',
      },
    ],
  };
}

function buildChatbotSettingsState(): ChatbotSettingsState {
  const createdAt = nowIso(-120);
  return {
    fanpages: [
      {
        _id: 'fp-manual-1',
        fanpageCode: 'FP-OPS-001',
        name: 'Ops Parent Care',
        platform: 'FACEBOOK',
        pageId: 'page-ops-parent',
        description: 'Ban dau dung cho parent care va hoc vien dang hoc.',
        syncSource: 'MANUAL',
        businessName: '',
        syncTokenLabel: '',
        lastSyncedAt: '',
        adAccountId: 'ad-facebook-1',
        openaiTokenId: 'token-parent-1',
        webhookVerifyToken: 'verify-ops-parent',
        status: 'ACTIVE',
        aiAutoReplyEnabled: true,
        createdAt,
        updatedAt: createdAt,
      },
    ],
    tokens: [
      {
        _id: 'token-parent-1',
        label: 'Parent Support Token',
        apiKey: 'sk-******',
        model: 'gpt-4o-mini',
        status: 'ACTIVE',
        lastUsedAt: nowIso(-60),
        createdAt,
      },
      {
        _id: 'token-sales-1',
        label: 'Lead Care Token',
        apiKey: 'sk-******',
        model: 'gpt-4o',
        status: 'ACTIVE',
        lastUsedAt: nowIso(-20),
        createdAt,
      },
    ],
    adAccounts: [
      {
        _id: 'ad-facebook-1',
        accountCode: 'ACC-001',
        name: 'Facebook Prospecting',
        platform: 'FACEBOOK',
        platformAccountId: 'act_001',
        status: 'ACTIVE',
        createdAt,
        updatedAt: createdAt,
      },
      {
        _id: 'ad-tiktok-1',
        accountCode: 'ACC-002',
        name: 'TikTok Retargeting',
        platform: 'TIKTOK',
        platformAccountId: 'tt_001',
        status: 'ACTIVE',
        createdAt,
        updatedAt: createdAt,
      },
    ],
  };
}

async function openDirectorEvidencePage(
  browser: Browser,
  request: APIRequestContext,
  scenario: string,
  path: string,
  setup: (page: Page) => Promise<void> | void,
): Promise<BatchEvidenceSession> {
  const session = await loginAsRole(request, 'director');
  const evidence = await createBatchEvidenceContext(browser, {
    batchId: 'NHOM12',
    scenario,
    runDate: RUN_DATE,
  });
  await applySessionCookies(evidence.context, session);
  await setup(evidence.page);
  await evidence.page.goto(appUrl(path));
  await evidence.page.waitForLoadState('domcontentloaded');
  return evidence;
}

async function routeMaterialsApis(page: Page, state: MaterialsState): Promise<void> {
  const context = page.context();

  await context.route(TEACHING_MATERIALS_STATS_API, async (route) => {
    const url = new URL(route.request().url());
    if (url.origin === APP_ORIGIN) {
      await route.continue();
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(clone(state.stats)),
    });
  });

  await context.route(TEACHING_MATERIALS_API, async (route) => {
    const url = new URL(route.request().url());
    if (url.origin === APP_ORIGIN) {
      await route.continue();
      return;
    }

    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: clone(state.materials),
        meta: {
          total: state.materials.length,
          page: 1,
          limit: 18,
          totalPages: 1,
          hasNextPage: false,
          hasPrevPage: false,
        },
      }),
    });
  });

  await context.route(CLASSES_API, async (route) => {
    const url = new URL(route.request().url());
    if (url.origin === APP_ORIGIN) {
      await route.continue();
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(clone(state.classes)),
    });
  });
}

async function routeChatbotSettingsApis(page: Page, state: ChatbotSettingsState): Promise<void> {
  const context = page.context();

  await context.route(CHATBOT_FANPAGES_API, async (route) => {
    const url = new URL(route.request().url());
    if (url.origin === APP_ORIGIN) {
      await route.continue();
      return;
    }

    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: clone(state.fanpages),
        total: state.fanpages.length,
        page: 1,
        limit: 200,
      }),
    });
  });

  await context.route(CHATBOT_OPENAI_TOKENS_API, async (route) => {
    const url = new URL(route.request().url());
    if (url.origin === APP_ORIGIN) {
      await route.continue();
      return;
    }

    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(clone(state.tokens)),
    });
  });

  await context.route(ADS_ACCOUNTS_API, async (route) => {
    const url = new URL(route.request().url());
    if (url.origin === APP_ORIGIN) {
      await route.continue();
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: clone(state.adAccounts),
        total: state.adAccounts.length,
        page: 1,
        limit: 200,
      }),
    });
  });
}

test.use({
  trace: 'off',
  video: 'on',
});

test.describe.configure({ mode: 'serial', timeout: 180_000 });
test.setTimeout(180_000);

test('NHOM12 teaching materials upload modal clears dirty draft after close and reopen', async ({ browser, request }) => {
  const state = buildMaterialsState();
  const evidence = await openDirectorEvidencePage(
    browser,
    request,
    'modal_dirty_state_teaching_materials_browser',
    '/app/teaching-materials',
    async (page) => {
      await routeMaterialsApis(page, state);
    },
  );

  try {
    await expect(evidence.page.getByText(/Tai lieu giang day va tri thuc cho AI/i)).toBeVisible();
    await expect(evidence.page.getByText('Dang hien 1/1 tai lieu')).toBeVisible();

    await evidence.page.locator('.hero-card .btn.primary').click();
    let modal = evidence.page.locator('.modal-backdrop .modal').first();
    await expect(modal).toBeVisible();

    await modal.locator('input[type="file"]').setInputFiles({
      name: 'modal-dirty-state.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('dirty modal state evidence', 'utf8'),
    });
    await expect(modal.locator('.selected-file strong')).toHaveText('modal-dirty-state.txt');
    await expect(modal.locator('input[name="title"]')).toHaveValue('modal-dirty-state');
    await modal.locator('textarea[name="description"]').fill('Dirty description should not leak to the next open.');
    await modal.locator('textarea[name="manualSummary"]').fill('Dirty summary should be cleared on reopen.');
    await modal.locator('input[name="subject"]').fill('Vat ly');
    await modal.locator('input[name="grade"]').fill('Lop 9');
    await modal.locator('select[name="classId"]').selectOption('class-b06-002');
    await modal.locator('input[name="tags"]').fill('dirty, modal');
    await modal.locator('input[name="isShared"]').check();
    await evidence.step('dirty-material-modal-before-close');

    await modal.getByRole('button', { name: 'Dong' }).click();
    await expect(evidence.page.locator('.modal-backdrop')).toHaveCount(0);

    await evidence.page.locator('.hero-card .btn.primary').click();
    modal = evidence.page.locator('.modal-backdrop .modal').first();
    await expect(modal).toBeVisible();
    await expect(modal.locator('.selected-file')).toHaveCount(0);
    await expect(modal.locator('input[name="title"]')).toHaveValue('');
    await expect(modal.locator('textarea[name="description"]')).toHaveValue('');
    await expect(modal.locator('textarea[name="manualSummary"]')).toHaveValue('');
    await expect(modal.locator('input[name="subject"]')).toHaveValue('');
    await expect(modal.locator('input[name="grade"]')).toHaveValue('');
    await expect(modal.locator('select[name="classId"]')).toHaveValue('');
    await expect(modal.locator('input[name="tags"]')).toHaveValue('');
    await expect(modal.locator('input[name="isShared"]')).not.toBeChecked();
    await expect(modal.locator('button[type="submit"].btn.primary')).toBeDisabled();
    await expect(modal).not.toContainText('Dirty description should not leak to the next open.');
    await evidence.step('clean-material-modal-after-reopen');

    await evidence.finalize('PASS', {
      extraLines: [
        'Teaching materials upload modal reopened with blank file, blank form fields, unchecked share flag, and disabled save after a dirty draft was closed without saving.',
        'Browser evidence proves stale create-modal state does not leak across close and reopen on the teaching-materials surface.',
      ],
    });
  } catch (error) {
    await evidence.finalize('FAIL', { error });
    throw error;
  }
});

test('NHOM12 chatbot fanpage create modal clears dirty draft and validation after close and reopen', async ({ browser, request }) => {
  const state = buildChatbotSettingsState();
  const evidence = await openDirectorEvidencePage(
    browser,
    request,
    'modal_dirty_state_chatbot_fanpage_browser',
    '/app/chatbot-settings',
    async (page) => {
      await routeChatbotSettingsApis(page, state);
    },
  );

  try {
    await expect(evidence.page.getByRole('button', { name: /Them fanpage/i })).toBeVisible();
    await expect(evidence.page.locator('tbody tr')).toHaveCount(1);

    await evidence.page.getByRole('button', { name: /Them fanpage/i }).click();
    let modal = evidence.page.locator('.modal').last();
    await expect(modal).toBeVisible();

    await modal.getByRole('button', { name: /^Luu$/i }).click();
    await expect(modal.locator('.error')).toHaveText(/Vui long dien du cac truong bat buoc/i);

    await modal.getByLabel('Ten fanpage').fill('Dirty Retention Draft');
    await modal.getByLabel('Nen tang').selectOption('TIKTOK');
    await modal.getByLabel('Page ID').fill('page-dirty-001');
    await modal.getByLabel('Page access token').fill('token-dirty-001');
    await modal.getByLabel('Mo ta fanpage').fill('Dirty draft should disappear after the modal is reopened.');
    await modal.getByLabel('Tai khoan quang cao lien ket').selectOption('ad-tiktok-1');
    await modal.getByLabel('OpenAI token').selectOption('token-sales-1');
    await modal.getByLabel('Webhook verify token').fill('verify-dirty-001');
    await modal.getByLabel('App secret').fill('app-secret-dirty-001');
    await modal.getByLabel('Bat AI tu dong tra loi').uncheck();
    await evidence.step('dirty-chatbot-modal-before-close');

    await modal.getByRole('button', { name: 'Huy' }).click();
    await expect(evidence.page.locator('.modal-backdrop')).toHaveCount(0);

    await evidence.page.getByRole('button', { name: /Them fanpage/i }).click();
    modal = evidence.page.locator('.modal').last();
    await expect(modal).toBeVisible();
    await expect(modal.locator('.error')).toHaveCount(0);
    await expect(modal.getByLabel('Ten fanpage')).toHaveValue('');
    await expect(modal.getByLabel('Nen tang')).toHaveValue('');
    await expect(modal.getByLabel('Page ID')).toHaveValue('');
    await expect(modal.getByLabel('Page access token')).toHaveValue('');
    await expect(modal.getByLabel('Mo ta fanpage')).toHaveValue('');
    await expect(modal.getByLabel('Tai khoan quang cao lien ket')).toHaveValue('');
    await expect(modal.getByLabel('OpenAI token')).toHaveValue('');
    await expect(modal.getByLabel('Webhook verify token')).toHaveValue('');
    await expect(modal.getByLabel('App secret')).toHaveValue('');
    await expect(modal.getByLabel('Bat AI tu dong tra loi')).toBeChecked();
    await expect(modal).not.toContainText('Dirty draft should disappear after the modal is reopened.');
    await evidence.step('clean-chatbot-modal-after-reopen');

    await evidence.finalize('PASS', {
      extraLines: [
        'Chatbot fanpage create modal dropped both validation error state and unsaved draft values after close and reopen.',
        'Browser evidence proves stale create-modal state does not leak across close and reopen on the chatbot-settings surface.',
      ],
    });
  } catch (error) {
    await evidence.finalize('FAIL', { error });
    throw error;
  }
});
