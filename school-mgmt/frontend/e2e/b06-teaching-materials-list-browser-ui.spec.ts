import { expect, test, type APIRequestContext, type Browser, type Page } from '@playwright/test';
import {
  applySessionCookies,
  createBatchEvidenceContext,
  loginAsRole,
  type BatchEvidenceSession,
} from './support';

const APP_BASE_URL =
  process.env['PLAYWRIGHT_BASE_URL'] ||
  process.env['E2E_BASE_URL'] ||
  'http://localhost:4200';

const API_ORIGIN_PATTERN = 'https?://[^/]+';
const API_PREFIX_PATTERN = `${API_ORIGIN_PATTERN}(?:/api)?`;
const TEACHING_MATERIALS_API = new RegExp(`${API_PREFIX_PATTERN}/teaching-materials(?:\\?.*)?$`);
const TEACHING_MATERIALS_STATS_API = new RegExp(`${API_PREFIX_PATTERN}/teaching-materials/stats(?:\\?.*)?$`);
const CLASSES_API = new RegExp(`${API_PREFIX_PATTERN}/classes(?:\\?.*)?$`);

type TeachingMaterial = {
  _id: string;
  teacherId: string;
  title: string;
  description?: string;
  manualSummary?: string;
  aiSummary?: string;
  extractionStatus?: 'PENDING' | 'READY' | 'UNSUPPORTED' | 'FAILED';
  chunkCount?: number;
  subject?: string;
  grade?: string;
  classId?: { _id: string; name: string; code?: string } | string;
  fileUrl: string;
  fileType: string;
  fileCategory?: 'pdf' | 'doc' | 'ppt' | 'excel' | 'image' | 'video' | 'other';
  fileSize: number;
  originalName: string;
  tags: string[];
  isShared: boolean;
  downloadCount: number;
  createdAt: string;
  updatedAt: string;
};

type MaterialStats = {
  total: number;
  readyForAI: number;
  totalChunks: number;
  bySubject: Record<string, number>;
  byGrade: Record<string, number>;
  totalSizeBytes: number;
  totalSizeMB: number;
};

type ClassItem = {
  _id: string;
  name: string;
  code: string;
};

type MaterialsState = {
  page1: TeachingMaterial[];
  page2: TeachingMaterial[];
  stats: MaterialStats;
  classes: ClassItem[];
  requestUrls: string[];
};

function appUrl(path: string): string {
  return new URL(path, APP_BASE_URL).toString();
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function material(overrides: Partial<TeachingMaterial> & Pick<TeachingMaterial, '_id' | 'title' | 'originalName'>): TeachingMaterial {
  return {
    _id: overrides._id,
    teacherId: 'teacher-b06-001',
    title: overrides.title,
    description: overrides.description || '',
    manualSummary: overrides.manualSummary || '',
    aiSummary: overrides.aiSummary || '',
    extractionStatus: overrides.extractionStatus || 'READY',
    chunkCount: overrides.chunkCount ?? 4,
    subject: overrides.subject || 'Toan',
    grade: overrides.grade || 'Lop 6',
    classId: overrides.classId || {
      _id: 'class-b06-001',
      name: 'Lop Toan 6A',
      code: 'CLS-6A',
    },
    fileUrl: overrides.fileUrl || `/uploads/materials/${overrides.originalName}`,
    fileType: overrides.fileType || 'application/pdf',
    fileCategory: overrides.fileCategory || 'pdf',
    fileSize: overrides.fileSize ?? 2048,
    originalName: overrides.originalName,
    tags: overrides.tags || ['b06'],
    isShared: overrides.isShared ?? true,
    downloadCount: overrides.downloadCount ?? 0,
    createdAt: overrides.createdAt || '2026-04-10T01:00:00.000Z',
    updatedAt: overrides.updatedAt || '2026-04-10T01:00:00.000Z',
  };
}

function buildBaseState(): MaterialsState {
  return {
    page1: [
      material({
        _id: 'material-alpha-001',
        title: 'Alpha Algebra Pack',
        originalName: 'alpha-algebra-pack.pdf',
        subject: 'Toan',
        grade: 'Lop 6',
        tags: ['dai so'],
      }),
      material({
        _id: 'material-bravo-002',
        title: 'Bravo Geometry Pack',
        originalName: 'bravo-geometry-pack.pdf',
        subject: 'Toan',
        grade: 'Lop 7',
        tags: ['hinh hoc'],
        downloadCount: 2,
      }),
    ],
    page2: [
      material({
        _id: 'material-bravo-002',
        title: 'Bravo Geometry Pack (updated)',
        originalName: 'bravo-geometry-pack.pdf',
        subject: 'Toan',
        grade: 'Lop 7',
        tags: ['hinh hoc', 'cap nhat'],
        downloadCount: 9,
        updatedAt: '2026-04-10T03:00:00.000Z',
      }),
      material({
        _id: 'material-charlie-003',
        title: 'Charlie Vocabulary Deck',
        originalName: 'charlie-vocabulary-deck.pptx',
        subject: 'Tieng Anh',
        grade: 'Lop 5',
        fileType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        fileCategory: 'ppt',
        tags: ['tu vung'],
      }),
      material({
        _id: 'material-delta-004',
        title: 'Delta Attendance Guide',
        originalName: 'delta-attendance-guide.docx',
        subject: 'Van phong',
        grade: 'Noi bo',
        fileType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        fileCategory: 'doc',
        tags: ['noi bo'],
      }),
    ],
    stats: {
      total: 4,
      readyForAI: 4,
      totalChunks: 18,
      bySubject: {
        Toan: 2,
        'Tieng Anh': 1,
        'Van phong': 1,
      },
      byGrade: {
        'Lop 5': 1,
        'Lop 6': 1,
        'Lop 7': 1,
        'Noi bo': 1,
      },
      totalSizeBytes: 8192,
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
    requestUrls: [],
  };
}

function buildEmptyState(): MaterialsState {
  return {
    page1: [],
    page2: [],
    stats: {
      total: 0,
      readyForAI: 0,
      totalChunks: 0,
      bySubject: {},
      byGrade: {},
      totalSizeBytes: 0,
      totalSizeMB: 0,
    },
    classes: [
      {
        _id: 'class-b06-001',
        name: 'Lop Toan 6A',
        code: 'CLS-6A',
      },
    ],
    requestUrls: [],
  };
}

function listBody(data: TeachingMaterial[], meta: {
  total: number;
  page: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}) {
  return {
    data: clone(data),
    meta: {
      total: meta.total,
      page: meta.page,
      limit: 18,
      totalPages: meta.total === 0 ? 1 : Math.ceil(meta.total / 18),
      hasNextPage: meta.hasNextPage,
      hasPrevPage: meta.hasPrevPage,
    },
  };
}

async function openTeachingMaterials(
  browser: Browser,
  request: APIRequestContext,
  scenario: string,
): Promise<BatchEvidenceSession> {
  const batch = await createBatchEvidenceContext(browser, {
    batchId: 'B06',
    scenario,
  });
  const directorSession = await loginAsRole(request, 'director');
  await applySessionCookies(batch.page, directorSession);
  return batch;
}

async function installMaterialsRoutes(
  page: Page,
  state: MaterialsState,
  options?: {
    emptyAll?: boolean;
    failFirstMessage?: string;
    page2Gate?: Promise<void>;
  },
): Promise<void> {
  const context = page.context();

  await context.route(TEACHING_MATERIALS_STATS_API, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(clone(state.stats)),
    });
  });

  await context.route(CLASSES_API, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(clone(state.classes)),
    });
  });

  await context.route(TEACHING_MATERIALS_API, async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }

    const requestUrl = route.request().url();
    state.requestUrls.push(requestUrl);

    if (options?.failFirstMessage && state.requestUrls.length === 1) {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          message: options.failFirstMessage,
        }),
      });
      return;
    }

    const url = new URL(requestUrl);
    const requestedPage = Number(url.searchParams.get('page') || '1');
    const extractionStatus = url.searchParams.get('extractionStatus') || '';

    if (options?.emptyAll) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          listBody([], {
            total: 0,
            page: 1,
            hasNextPage: false,
            hasPrevPage: false,
          }),
        ),
      });
      return;
    }

    if (extractionStatus === 'FAILED') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          listBody([], {
            total: 0,
            page: 1,
            hasNextPage: false,
            hasPrevPage: false,
          }),
        ),
      });
      return;
    }

    if (requestedPage === 2) {
      if (options?.page2Gate) {
        await options.page2Gate;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          listBody(state.page2, {
            total: 4,
            page: 2,
            hasNextPage: false,
            hasPrevPage: true,
          }),
        ),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        listBody(state.page1, {
          total: 4,
          page: 1,
          hasNextPage: true,
          hasPrevPage: false,
        }),
      ),
    });
  });
}

async function gotoMaterialsPage(page: Page): Promise<void> {
  await page.goto(appUrl('/app/teaching-materials'));
  await page.waitForLoadState('domcontentloaded');
}

function urlSearchParams(requestUrl: string): URLSearchParams {
  return new URL(requestUrl).searchParams;
}

test.use({
  trace: 'off',
  video: 'on',
});

test.describe.configure({ mode: 'serial', timeout: 120_000 });
test.setTimeout(120_000);

test('B06 teaching materials load-more appends page 2 without duplicate rows', async ({ browser, request }) => {
  const state = buildBaseState();
  let releasePage2: (() => void) | null = null;
  const page2Gate = new Promise<void>((resolve) => {
    releasePage2 = resolve;
  });

  const batch = await openTeachingMaterials(browser, request, 'teaching_materials_load_more_browser');

  try {
    await installMaterialsRoutes(batch.page, state, { page2Gate });
    await gotoMaterialsPage(batch.page);
    await expect(batch.page.getByText(/Tai lieu giang day va tri thuc cho AI/i)).toBeVisible();
    await expect(batch.page.getByText('Dang hien 2/4 tai lieu')).toBeVisible();
    await expect(batch.page.getByText('Con 2 tai lieu o cac trang sau')).toBeVisible();
    await expect(batch.page.locator('.material-card')).toHaveCount(2);

    expect(state.requestUrls).toHaveLength(1);
    const initialParams = urlSearchParams(state.requestUrls[0]);
    expect(initialParams.get('page')).toBe('1');
    expect(initialParams.get('limit')).toBe('18');
    expect(initialParams.get('extractionStatus')).toBeNull();

    const loadMoreButton = batch.page.locator('.load-more .btn.secondary');
    await loadMoreButton.click();
    await expect(loadMoreButton).toBeDisabled();
    await expect(loadMoreButton).toHaveText('Dang tai...');
    await expect(batch.page.locator('.status-row .status-copy.subtle')).toHaveText('Dang tai them...');

    releasePage2?.();

    await expect.poll(() => state.requestUrls.length).toBe(2);
    const loadMoreParams = urlSearchParams(state.requestUrls[1]);
    expect(loadMoreParams.get('page')).toBe('2');
    expect(loadMoreParams.get('limit')).toBe('18');
    expect(loadMoreParams.get('extractionStatus')).toBeNull();

    await expect(batch.page.locator('.material-card')).toHaveCount(4);
    await expect(batch.page.getByText('Dang hien 4/4 tai lieu')).toBeVisible();
    await expect(batch.page.locator('.load-more')).toHaveCount(0);
    await expect(batch.page.getByRole('heading', { name: /^Bravo Geometry Pack$/ })).toHaveCount(0);
    await expect(batch.page.locator('.material-card').filter({
      has: batch.page.getByRole('heading', { name: /^Bravo Geometry Pack \(updated\)$/ }),
    })).toHaveCount(1);
    await expect(batch.page.locator('.material-card').filter({
      has: batch.page.getByRole('heading', { name: /^Bravo Geometry Pack \(updated\)$/ }),
    })).toContainText('Tai xuong 9');
    await batch.step('materials-load-more-deduped-page-two');

    await batch.finalize('PASS', {
      extraLines: [
        'Verified the first list request keeps exact `page=1` and `limit=18` query params.',
        'Verified clicking load more issues exact `page=2` semantics, shows the current loading state, and appends the second page only once.',
        'Verified duplicate material `_id` from page 2 replaces the stale row data instead of rendering a second copy.',
      ],
    });
  } catch (error) {
    await batch.finalize('FAIL', { error });
    throw error;
  }
});

test('B06 teaching materials empty state shows the upload CTA for an empty warehouse', async ({ browser, request }) => {
  const state = buildEmptyState();
  const batch = await openTeachingMaterials(browser, request, 'teaching_materials_empty_state_browser');

  try {
    await installMaterialsRoutes(batch.page, state, { emptyAll: true });
    await gotoMaterialsPage(batch.page);

    await expect(batch.page.locator('.alert.error')).toHaveCount(0);
    await expect(batch.page.locator('.empty-card h3')).toHaveText('Chua co tai lieu nao');
    await expect(batch.page.locator('.empty-card p')).toContainText('Tai len bo tai lieu dau tien');
    await expect(batch.page.locator('.empty-card .btn.primary')).toHaveText('Tai len tai lieu');
    await expect(batch.page.getByText('Dang hien 0/0 tai lieu')).toHaveCount(0);
    await batch.page.locator('.empty-card .btn.primary').click();
    await expect(batch.page.locator('.modal-backdrop .modal')).toBeVisible();
    await batch.step('materials-empty-state-upload-cta');

    await batch.finalize('PASS', {
      extraLines: [
        'Verified the empty warehouse state renders the exact empty heading/body copy and the primary upload CTA.',
        'Verified the empty-state CTA opens the upload modal directly instead of leaving the user in a dead-end view.',
      ],
    });
  } catch (error) {
    await batch.finalize('FAIL', { error });
    throw error;
  }
});

test('B06 teaching materials error state shows the API message and empty fallback shell', async ({ browser, request }) => {
  const state = buildBaseState();
  const batch = await openTeachingMaterials(browser, request, 'teaching_materials_error_state_browser');

  try {
    await installMaterialsRoutes(batch.page, state, {
      failFirstMessage: 'Khong the tai kho hoc lieu tu server test',
    });
    await gotoMaterialsPage(batch.page);

    await expect(batch.page.locator('.alert.error')).toHaveText('Khong the tai kho hoc lieu tu server test');
    await expect(batch.page.locator('.empty-card h3')).toHaveText('Chua co tai lieu nao');
    await expect(batch.page.locator('.empty-card .btn.primary')).toHaveText('Tai len tai lieu');
    await expect(batch.page.locator('.material-card')).toHaveCount(0);
    expect(state.requestUrls).toHaveLength(1);
    const failedParams = urlSearchParams(state.requestUrls[0]);
    expect(failedParams.get('page')).toBe('1');
    expect(failedParams.get('limit')).toBe('18');
    await batch.step('materials-error-state-api-message');

    await batch.finalize('PASS', {
      extraLines: [
        'Verified the first list failure keeps the backend error message exact in the error alert.',
        'Verified the page falls back to the empty-shell CTA instead of rendering stale material rows after a reset-load failure.',
      ],
    });
  } catch (error) {
    await batch.finalize('FAIL', { error });
    throw error;
  }
});
