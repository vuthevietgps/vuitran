import { expect, test, type APIRequestContext, type Browser, type Page } from '@playwright/test';
import { pngFilePayload, ONE_BY_ONE_PNG_BUFFER } from './support/files';
import { applySessionCookies, loginAsRole } from './support/auth';
import { createBatchEvidenceContext } from './support/orchestrator';

const APP_BASE_URL =
  process.env['PLAYWRIGHT_BASE_URL']
  || process.env['E2E_BASE_URL']
  || 'http://localhost:4200';
const UPLOADED_FACE_URL = '/uploads/faces/e2e-student-face.png';
const API_ORIGIN_PATTERN = 'http:\\/\\/(?:localhost|127\\.0\\.0\\.1):3000';
const USERS_PARENTS_API = new RegExp(`${API_ORIGIN_PATTERN}/users/parents(?:\\?.*)?$`);
const STUDENTS_API = new RegExp(`${API_ORIGIN_PATTERN}/students(?:\\?.*)?$`);
const STUDENT_FACE_UPLOAD_API = new RegExp(`${API_ORIGIN_PATTERN}/students/face-upload(?:\\?.*)?$`);

function appUrl(path: string): string {
  return new URL(path, APP_BASE_URL).toString();
}

async function gotoApp(page: Page, path: string): Promise<void> {
  await page.goto(appUrl(path));
  await page.waitForLoadState('domcontentloaded');
}

async function openStudents(
  browser: Browser,
  request: APIRequestContext,
  scenario: string,
) {
  const batch = await createBatchEvidenceContext(browser, {
    batchId: 'B03',
    scenario,
  });
  await batch.page.addInitScript(() => {
    window.localStorage.setItem('school_mgmt_sidebar_collapsed', 'false');
  });

  const directorSession = await loginAsRole(request, 'director');
  await applySessionCookies(batch.page, directorSession);
  return batch;
}

async function expectImageLoaded(page: Page, selector: string): Promise<void> {
  const loaded = await page.locator(selector).evaluate((node) => {
    const image = node as HTMLImageElement;
    return image.complete && image.naturalWidth > 0 && image.naturalHeight > 0;
  });
  expect(loaded).toBe(true);
}

test.describe.configure({ mode: 'serial', timeout: 120_000 });
test.setTimeout(120_000);

test('B03 student face upload success shows preview and persists uploaded faceImage in create payload', async ({ browser, request }) => {
  const students: Array<Record<string, unknown>> = [];
  const parents = [
    {
      _id: 'parent-b03-001',
      userCode: 'PHB03',
      email: 'parent-b03@example.com',
      fullName: 'Phu huynh B03',
      role: 'PARENT',
      phone: '0901234567',
    },
  ];
  let createdPayload: Record<string, unknown> | null = null;
  let releaseUpload: (() => void) | null = null;
  const uploadGate = new Promise<void>((resolve) => {
    releaseUpload = resolve;
  });

  const batch = await openStudents(browser, request, 'student_face_upload_success');

  try {
    await batch.page.route(USERS_PARENTS_API, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(parents),
      });
    });

    await batch.page.route('**/uploads/faces/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'image/png',
        body: ONE_BY_ONE_PNG_BUFFER,
      });
    });

    await batch.page.route(STUDENT_FACE_UPLOAD_API, async (route) => {
      await uploadGate;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ url: UPLOADED_FACE_URL }),
      });
    });

    await batch.page.route(STUDENTS_API, async (route) => {
      const requestMethod = route.request().method();
      if (requestMethod === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(students),
        });
        return;
      }

      if (requestMethod === 'POST') {
        createdPayload = route.request().postDataJSON() as Record<string, unknown>;
        students.push({
          _id: 'student-b03-001',
          studentCode: createdPayload?.['studentCode'],
          fullName: createdPayload?.['fullName'],
          age: createdPayload?.['age'],
          parentUserId: createdPayload?.['parentUserId'],
          parentName: createdPayload?.['parentName'],
          parentPhone: createdPayload?.['parentPhone'],
          faceImage: createdPayload?.['faceImage'],
        });
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify(students[0]),
        });
        return;
      }

      await route.fallback();
    });

    await gotoApp(batch.page, '/app/students');
    await expect(batch.page.getByText(/Quan ly hoc sinh/i).first()).toBeVisible();
    await expect(batch.page.getByText('Chua co hoc sinh.')).toBeVisible();
    await batch.page.getByRole('button', { name: /\+ Them hoc sinh/i }).click();

    const modal = batch.page.locator('.modal-backdrop .modal').first();
    await expect(modal).toBeVisible();
    await modal.locator('input[name="studentCode"]').fill('HS-B03-UP1');
    await modal.locator('input[name="fullName"]').fill('Hoc sinh Upload B03');
    await modal.locator('input[name="age"]').fill('8');
    await expect(modal.locator(`select[name="parentUserId"] option[value="${parents[0]._id}"]`)).toHaveCount(1);
    await modal.locator('select[name="parentUserId"]').selectOption(parents[0]._id);
    await expect(modal.locator('input[name="parentName"]')).toHaveValue('Phu huynh B03');
    await expect(modal.locator('input[name="parentPhone"]')).toHaveValue('0901234567');

    const submitButton = modal.locator('button[type="submit"]');
    await modal.locator('input[type="file"]').setInputFiles(pngFilePayload('b03-face-success.png'));
    await expect(modal.getByText('Dang tai anh...')).toBeVisible();
    await expect(submitButton).toBeDisabled();

    releaseUpload?.();

    await expect(modal.getByText('Dang tai anh...')).toHaveCount(0, { timeout: 10_000 });
    await expect(modal.locator('.upload-status .error')).toHaveCount(0);
    await expect(modal.locator('img.preview')).toHaveAttribute('src', UPLOADED_FACE_URL);
    await expectImageLoaded(batch.page, '.upload-status img.preview');
    await expect(submitButton).toBeEnabled();
    await batch.step('student-face-upload-preview');

    await submitButton.click();
    await expect(batch.page.locator('.modal-backdrop')).toHaveCount(0);

    expect(createdPayload).not.toBeNull();
    expect(createdPayload?.['faceImage']).toBe(UPLOADED_FACE_URL);
    expect(createdPayload?.['parentUserId']).toBe(parents[0]._id);
    expect(createdPayload?.['parentName']).toBe('Phu huynh B03');
    expect(createdPayload?.['parentPhone']).toBe('0901234567');

    const createdRow = batch.page.locator('table.data tbody tr').filter({ hasText: 'HS-B03-UP1' }).first();
    await expect(createdRow).toBeVisible();
    await expect(createdRow.locator('img')).toHaveAttribute('src', UPLOADED_FACE_URL);
    await expectImageLoaded(batch.page, 'table.data tbody tr img');
    await batch.step('student-face-upload-created-row');

    await batch.finalize('PASS', {
      extraLines: [
        'Verified student face upload keeps loading state visible and submit disabled while upload is pending.',
        'Verified successful upload renders a real preview image and persists the uploaded faceImage URL in the create payload.',
        'Verified the created student row renders the uploaded face image after reload.',
      ],
    });
  } catch (error) {
    await batch.finalize('FAIL', { error });
    throw error;
  }
});

test('B03 student face upload failure shows upload error and blocks save without a face image', async ({ browser, request }) => {
  const students: Array<Record<string, unknown>> = [];
  const parents = [
    {
      _id: 'parent-b03-002',
      userCode: 'PHB03B',
      email: 'parent-b03b@example.com',
      fullName: 'Phu huynh Upload Loi',
      role: 'PARENT',
      phone: '0907654321',
    },
  ];
  let createCalls = 0;

  const batch = await openStudents(browser, request, 'student_face_upload_failure');

  try {
    await batch.page.route(USERS_PARENTS_API, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(parents),
      });
    });

    await batch.page.route(STUDENT_FACE_UPLOAD_API, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ url: '' }),
      });
    });

    await batch.page.route(STUDENTS_API, async (route) => {
      const requestMethod = route.request().method();
      if (requestMethod === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(students),
        });
        return;
      }

      if (requestMethod === 'POST') {
        createCalls += 1;
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({}),
        });
        return;
      }

      await route.fallback();
    });

    await gotoApp(batch.page, '/app/students');
    await expect(batch.page.getByText(/Quan ly hoc sinh/i).first()).toBeVisible();
    await expect(batch.page.getByText('Chua co hoc sinh.')).toBeVisible();
    await batch.page.getByRole('button', { name: /\+ Them hoc sinh/i }).click();

    const modal = batch.page.locator('.modal-backdrop .modal').first();
    await expect(modal).toBeVisible();
    await modal.locator('input[name="studentCode"]').fill('HS-B03-UP2');
    await modal.locator('input[name="fullName"]').fill('Hoc sinh Upload Loi');
    await modal.locator('input[name="age"]').fill('9');
    await expect(modal.locator(`select[name="parentUserId"] option[value="${parents[0]._id}"]`)).toHaveCount(1);
    await modal.locator('select[name="parentUserId"]').selectOption(parents[0]._id);

    await modal.locator('input[type="file"]').setInputFiles(pngFilePayload('b03-face-fail.png'));
    await expect(modal.locator('.upload-status .error')).toHaveText('Tai anh that bai');
    await expect(modal.locator('img.preview')).toHaveCount(0);
    await batch.step('student-face-upload-error');

    await modal.locator('button[type="submit"]').click();
    await expect(modal.locator('p.error')).toHaveText('Vui long tai anh nhan dien');
    expect(createCalls).toBe(0);
    await batch.step('student-face-upload-submit-blocked');

    await batch.finalize('PASS', {
      extraLines: [
        'Verified failed face upload surfaces the upload error instead of showing a stale preview.',
        'Verified submit stays blocked at form-validation level because no faceImage is available after the failed upload.',
        'Verified no create-student request is sent when the face upload has failed.',
      ],
    });
  } catch (error) {
    await batch.finalize('FAIL', { error });
    throw error;
  }
});
