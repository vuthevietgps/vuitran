import { Buffer } from 'node:buffer';
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
const TEACHING_MATERIALS_UPLOAD_API = new RegExp(`${API_PREFIX_PATTERN}/teaching-materials/upload(?:\\?.*)?$`);
const CLASSES_API = new RegExp(`${API_PREFIX_PATTERN}/classes(?:\\?.*)?$`);

const FILE_NAME = 'b06-dragdrop-material.txt';
const FILE_TITLE = 'b06-dragdrop-material';
const FILE_CONTENT = 'Lesson drill pack for unit 5';
const FILE_MIME = 'text/plain';
const FILE_SIZE_TEXT = `${Buffer.byteLength(FILE_CONTENT, 'utf8')} B`;

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
  materials: TeachingMaterial[];
  stats: MaterialStats;
  classes: ClassItem[];
  uploadBodies: string[];
};

function appUrl(path: string): string {
  return new URL(path, APP_BASE_URL).toString();
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function listBody(state: MaterialsState) {
  return {
    data: clone(state.materials),
    meta: {
      total: state.materials.length,
      page: 1,
      limit: 18,
      totalPages: 1,
      hasNextPage: false,
      hasPrevPage: false,
    },
  };
}

function buildInitialState(): MaterialsState {
  return {
    materials: [
      {
        _id: 'material-existing-001',
        teacherId: 'teacher-demo-001',
        title: 'Starter Algebra Pack',
        description: 'Bo tai lieu dai so da co san.',
        manualSummary: 'Tai lieu khoi dong cho dai so co ban.',
        aiSummary: 'AI summary for algebra starter pack.',
        extractionStatus: 'READY',
        chunkCount: 8,
        subject: 'Toan',
        grade: 'Lop 6',
        classId: {
          _id: 'class-b06-001',
          name: 'Lop Toan 6A',
          code: 'CLS-6A',
        },
        fileUrl: '/uploads/materials/algebra-pack.pdf',
        fileType: 'application/pdf',
        fileCategory: 'pdf',
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
    uploadBodies: [],
  };
}

function addUploadedMaterial(state: MaterialsState): void {
  state.materials = [
    {
      _id: 'material-dragdrop-002',
      teacherId: 'teacher-demo-001',
      title: FILE_TITLE,
      description: 'Tai lieu keo tha cho browser test.',
      manualSummary: 'Tom tat AI tu keo tha file de chung minh flow upload browser.',
      extractionStatus: 'PENDING',
      chunkCount: 0,
      subject: 'Tieng Anh',
      grade: 'Lop 5',
      classId: {
        _id: 'class-b06-002',
        name: 'Lop Anh 5B',
        code: 'CLS-5B',
      },
      fileUrl: '/uploads/materials/b06-dragdrop-material.txt',
      fileType: FILE_MIME,
      fileCategory: 'other',
      fileSize: Buffer.byteLength(FILE_CONTENT, 'utf8'),
      originalName: FILE_NAME,
      tags: ['tu vung', 'unit 5'],
      isShared: true,
      downloadCount: 0,
      createdAt: '2026-04-10T05:00:00.000Z',
      updatedAt: '2026-04-10T05:00:00.000Z',
    },
    ...state.materials,
  ];

  state.stats = {
    total: 2,
    readyForAI: 1,
    totalChunks: 8,
    bySubject: {
      Toan: 1,
      'Tieng Anh': 1,
    },
    byGrade: {
      'Lop 5': 1,
      'Lop 6': 1,
    },
    totalSizeBytes: 2048 + Buffer.byteLength(FILE_CONTENT, 'utf8'),
    totalSizeMB: 0,
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

async function installMaterialsRoutes(page: Page, state: MaterialsState, uploadGate?: Promise<void>): Promise<void> {
  const context = page.context();

  await context.route(TEACHING_MATERIALS_STATS_API, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(clone(state.stats)),
    });
  });

  await context.route(TEACHING_MATERIALS_UPLOAD_API, async (route) => {
    const requestMethod = route.request().method();
    if (requestMethod !== 'POST') {
      await route.fallback();
      return;
    }

    if (uploadGate) {
      await uploadGate;
    }

    const bodyText = route.request().postDataBuffer()?.toString('utf8') || '';
    state.uploadBodies.push(bodyText);
    addUploadedMaterial(state);

    await page.waitForTimeout(350);
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify(clone(state.materials[0])),
    });
  });

  await context.route(TEACHING_MATERIALS_API, async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(listBody(state)),
    });
  });

  await context.route(CLASSES_API, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(clone(state.classes)),
    });
  });
}

async function gotoMaterialsPage(page: Page): Promise<void> {
  await page.goto(appUrl('/app/teaching-materials'));
  await page.waitForLoadState('domcontentloaded');
}

async function openUploadModal(page: Page): Promise<Page> {
  await expect(page.getByText(/Tai lieu giang day va tri thuc cho AI/i)).toBeVisible();
  await page.locator('.hero-card .btn.primary').click();
  const modal = page.locator('.modal-backdrop .modal').first();
  await expect(modal).toBeVisible();
  return page;
}

async function dispatchDragOverWithFile(page: Page, fileName: string, fileContent: string, fileType: string): Promise<void> {
  await page.locator('.drop-zone').evaluate((element, file) => {
    const zone = element as HTMLElement;
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(new File([file.content], file.name, { type: file.type }));
    zone.dispatchEvent(new DragEvent('dragover', {
      bubbles: true,
      cancelable: true,
      dataTransfer,
    }));
  }, {
    name: fileName,
    content: fileContent,
    type: fileType,
  });
}

async function dispatchDropWithFile(page: Page, fileName: string, fileContent: string, fileType: string): Promise<void> {
  await page.locator('.drop-zone').evaluate((element, file) => {
    const zone = element as HTMLElement;
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(new File([file.content], file.name, { type: file.type }));
    zone.dispatchEvent(new DragEvent('drop', {
      bubbles: true,
      cancelable: true,
      dataTransfer,
    }));
  }, {
    name: fileName,
    content: fileContent,
    type: fileType,
  });
}

async function dispatchEmptyDrop(page: Page): Promise<void> {
  await page.locator('.drop-zone').evaluate((element) => {
    const zone = element as HTMLElement;
    const dataTransfer = new DataTransfer();
    zone.dispatchEvent(new DragEvent('drop', {
      bubbles: true,
      cancelable: true,
      dataTransfer,
    }));
  });
}

test.use({
  trace: 'off',
  video: 'on',
});

test.describe.configure({ mode: 'serial', timeout: 120_000 });
test.setTimeout(120_000);

test('B06 teaching materials drag-drop upload keeps exact multipart payload and refreshes list', async ({ browser, request }) => {
  const state = buildInitialState();
  let releaseUpload: (() => void) | null = null;
  const uploadGate = new Promise<void>((resolve) => {
    releaseUpload = resolve;
  });

  const batch = await openTeachingMaterials(browser, request, 'teaching_materials_dragdrop_upload_browser');

  try {
    await installMaterialsRoutes(batch.page, state, uploadGate);
    await gotoMaterialsPage(batch.page);
    await expect(batch.page.locator('.stat-card strong').first()).toHaveText('1');
    await expect(batch.page.getByText('Dang hien 1/1 tai lieu')).toBeVisible();

    await openUploadModal(batch.page);
    const modal = batch.page.locator('.modal-backdrop .modal').first();
    const dropZone = modal.locator('.drop-zone');

    await dispatchDragOverWithFile(batch.page, FILE_NAME, FILE_CONTENT, FILE_MIME);
    await expect(dropZone).toHaveClass(/dragover/);

    await dispatchDropWithFile(batch.page, FILE_NAME, FILE_CONTENT, FILE_MIME);
    await expect(dropZone).not.toHaveClass(/dragover/);
    await expect(dropZone).toHaveClass(/has-file/);
    await expect(dropZone.locator('.selected-file strong')).toHaveText(FILE_NAME);
    await expect(dropZone.locator('.selected-file p')).toHaveText(FILE_SIZE_TEXT);
    await expect(modal.locator('input[name="title"]')).toHaveValue(FILE_TITLE);

    await modal.locator('textarea[name="description"]').fill('Tai lieu keo tha cho browser test.');
    await modal.locator('textarea[name="manualSummary"]').fill('Tom tat AI tu keo tha file de chung minh flow upload browser.');
    await modal.locator('input[name="subject"]').fill('Tieng Anh');
    await modal.locator('input[name="grade"]').fill('Lop 5');
    await modal.locator('select[name="classId"]').selectOption('class-b06-002');
    await modal.locator('input[name="tags"]').fill('tu vung, unit 5');
    await modal.locator('input[name="isShared"]').check();
    await batch.step('materials-dragdrop-selected-file');

    const submitButton = modal.locator('button[type="submit"].btn.primary');
    await submitButton.click();
    await expect(modal.getByText('Dang tai len...')).toBeVisible();
    await expect(submitButton).toBeDisabled();

    releaseUpload?.();

    await expect.poll(() => state.uploadBodies.length).toBe(1);
    const multipartBody = state.uploadBodies[0];
    expect(multipartBody).toContain(`filename="${FILE_NAME}"`);
    expect(multipartBody).toContain('name="file"');
    expect(multipartBody).toContain(FILE_CONTENT);
    expect(multipartBody).toContain('name="title"');
    expect(multipartBody).toContain(FILE_TITLE);
    expect(multipartBody).toContain('name="description"');
    expect(multipartBody).toContain('Tai lieu keo tha cho browser test.');
    expect(multipartBody).toContain('name="manualSummary"');
    expect(multipartBody).toContain('Tom tat AI tu keo tha file de chung minh flow upload browser.');
    expect(multipartBody).toContain('name="subject"');
    expect(multipartBody).toContain('Tieng Anh');
    expect(multipartBody).toContain('name="grade"');
    expect(multipartBody).toContain('Lop 5');
    expect(multipartBody).toContain('name="classId"');
    expect(multipartBody).toContain('class-b06-002');
    expect(multipartBody).toContain('name="tags"');
    expect(multipartBody).toContain('["tu vung","unit 5"]');
    expect(multipartBody).toContain('name="isShared"');
    expect(multipartBody).toContain('true');

    await expect(batch.page.locator('.modal-backdrop')).toHaveCount(0);
    await expect(batch.page.locator('.alert.success')).toHaveText('Da tai len tai lieu moi');
    await expect(batch.page.locator('.stat-card strong').first()).toHaveText('2');
    await expect(batch.page.getByText('Dang hien 2/2 tai lieu')).toBeVisible();

    const createdCard = batch.page.locator('.material-card').filter({ hasText: FILE_TITLE }).first();
    await expect(createdCard).toBeVisible();
    await expect(createdCard).toContainText(FILE_NAME);
    await expect(createdCard).toContainText('Tieng Anh');
    await batch.step('materials-dragdrop-uploaded-row');

    await batch.finalize('PASS', {
      extraLines: [
        'Verified real dragover/drop browser events toggle the drop-zone state and auto-fill the title from the dropped filename.',
        'Verified drag-drop upload sends the exact multipart fields for file, title, description, manualSummary, subject, grade, classId, tags, and isShared.',
        'Verified successful upload shows loading/success state, closes the modal, and refreshes the list and total-material stat with the new row.',
      ],
    });
  } catch (error) {
    await batch.finalize('FAIL', { error });
    throw error;
  }
});

test('B06 teaching materials empty drop keeps upload blocked and does not auto-fill title', async ({ browser, request }) => {
  const state = buildInitialState();
  const batch = await openTeachingMaterials(browser, request, 'teaching_materials_dragdrop_empty_browser');

  try {
    await installMaterialsRoutes(batch.page, state);
    await gotoMaterialsPage(batch.page);
    await openUploadModal(batch.page);

    const modal = batch.page.locator('.modal-backdrop .modal').first();
    const dropZone = modal.locator('.drop-zone');
    const submitButton = modal.locator('button[type="submit"].btn.primary');

    await expect(submitButton).toBeDisabled();
    await expect(modal.locator('input[name="title"]')).toHaveValue('');
    await dispatchEmptyDrop(batch.page);
    await expect(dropZone).not.toHaveClass(/has-file/);
    await expect(modal.locator('.selected-file')).toHaveCount(0);
    await expect(modal.locator('input[name="title"]')).toHaveValue('');
    await expect(submitButton).toBeDisabled();
    expect(state.uploadBodies).toHaveLength(0);
    await batch.step('materials-dragdrop-empty-ignored');

    await batch.finalize('PASS', {
      extraLines: [
        'Verified an empty drop event does not create a selected file state for the upload modal.',
        'Verified title auto-fill does not run when no file exists in the drop payload.',
        'Verified create upload remains blocked and sends zero upload requests after an empty drop.',
      ],
    });
  } catch (error) {
    await batch.finalize('FAIL', { error });
    throw error;
  }
});
