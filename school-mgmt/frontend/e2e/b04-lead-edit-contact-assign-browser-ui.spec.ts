import { expect, test, type Browser, type Page } from '@playwright/test';
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

const RUN_DATE =
  process.env['UI_EVIDENCE_DATE'] ||
  process.env['E2E_RUN_DATE'] ||
  '2026-04-11';

const API_PREFIX_PATTERN = 'https?://(?:localhost|127\\.0\\.0\\.1):3000(?:/api)?';
const LEADS_API = new RegExp(`^${API_PREFIX_PATTERN}/leads(?:/.*)?(?:\\?.*)?$`);
const USERS_SALES_API = new RegExp(`^${API_PREFIX_PATTERN}/users/sales(?:\\?.*)?$`);

const UPDATED_PHONE = '0900999988';
const UPDATED_EMAIL = 'updated.parent@school.local';
const UPDATED_STUDENT = 'Hoc sinh Da sua';
const UPDATED_GRADE = 'Lop 6';
const UPDATED_VALUE = 2_100_000;
const UPDATED_NOTES = 'Da cap nhat thong tin lead sau cuoc goi dau tien';
const UPDATED_SUBJECTS = 'Toan, Anh';
const CONTACT_NOTES = 'Da gap phu huynh va hen hoc thu';
const CONTACT_FOLLOW_UP = '2026-04-18';
const CONTACT_METHOD = 'MEET';

type AssignmentHistoryItem = {
  saleId: string;
  saleName: string;
  assignedAt: string;
  returnedAt?: string;
  returnReason?: string;
};

type ContactHistoryItem = {
  date: string;
  method: string;
  notes?: string;
  nextFollowUp?: string;
  contactedBy?: string;
};

type LeadHarnessItem = {
  _id: string;
  leadCode: string;
  parentName: string;
  parentPhone: string;
  parentEmail?: string;
  studentName?: string;
  studentGrade?: string;
  interestedSubjects?: string[];
  source: string;
  status: string;
  saleId?: string | null;
  saleName?: string;
  estimatedValue?: number;
  notes?: string;
  createdAt: string;
  assignedAt?: string;
  lastContactAt?: string;
  nextFollowUp?: string;
  contactHistory?: ContactHistoryItem[];
  assignmentHistory?: AssignmentHistoryItem[];
};

type LeadHarnessState = {
  item: LeadHarnessItem;
  listUrls: string[];
  pipelineUrls: string[];
  updateBodies: Array<{ id: string; body: unknown }>;
  contactBodies: Array<{ id: string; body: unknown }>;
  assignBodies: Array<{ id: string; body: unknown }>;
};

function appUrl(path: string): string {
  return new URL(path, APP_BASE_URL).toString();
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function leadRow(page: Page, leadCode: string) {
  return page.locator('table.data tbody tr').filter({ hasText: leadCode }).first();
}

function buildLeadState(): LeadHarnessState {
  return {
    item: {
      _id: 'lead-edit-001',
      leadCode: 'LEAD-EDIT-001',
      parentName: 'Phu huynh Chua giao',
      parentPhone: '0900000011',
      parentEmail: 'before.parent@school.local',
      studentName: 'Hoc sinh Ban dau',
      studentGrade: 'Lop 3',
      interestedSubjects: ['Toan'],
      source: 'OTHER',
      status: 'NEW',
      estimatedValue: 1_200_000,
      notes: 'Lead can goi lai vao dau tuan',
      createdAt: '2026-04-08T02:00:00.000Z',
      contactHistory: [],
      assignmentHistory: [],
    },
    listUrls: [],
    pipelineUrls: [],
    updateBodies: [],
    contactBodies: [],
    assignBodies: [],
  };
}

function buildPipeline(state: LeadHarnessState) {
  const item = state.item;
  const isConverted = item.status === 'CONVERTED';
  return {
    pipeline: {
      NEW: { count: item.status === 'NEW' ? 1 : 0, estimatedValue: item.status === 'NEW' ? item.estimatedValue || 0 : 0 },
      CONTACTED: { count: item.status === 'CONTACTED' ? 1 : 0, estimatedValue: item.status === 'CONTACTED' ? item.estimatedValue || 0 : 0 },
      CONSULTING: { count: item.status === 'CONSULTING' ? 1 : 0, estimatedValue: item.status === 'CONSULTING' ? item.estimatedValue || 0 : 0 },
      INTERESTED: { count: item.status === 'INTERESTED' ? 1 : 0, estimatedValue: item.status === 'INTERESTED' ? item.estimatedValue || 0 : 0 },
      CONVERTED: { count: isConverted ? 1 : 0, estimatedValue: 0 },
    },
    total: 1,
    conversionRate: 0,
    assignedCount: item.saleId ? 1 : 0,
    unassignedCount: item.saleId ? 0 : 1,
  };
}

async function installLeadRoutes(page: Page, state: LeadHarnessState): Promise<void> {
  await page.route(USERS_SALES_API, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          _id: 'sale-001',
          fullName: 'Sale Alpha',
          email: 'sale.alpha@school.local',
          role: 'SALE',
        },
        {
          _id: 'sale-002',
          fullName: 'Sale Beta',
          email: 'sale.beta@school.local',
          role: 'SALE',
        },
      ]),
    });
  });

  await page.route(LEADS_API, async (route) => {
    const request = route.request();
    const method = request.method();
    const url = new URL(request.url());
    const pathname = url.pathname.replace(/^\/api/, '');

    if (method === 'GET' && pathname === '/leads/pipeline') {
      state.pipelineUrls.push(request.url());
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(buildPipeline(state)),
      });
      return;
    }

    if (method === 'GET' && pathname === '/leads/follow-ups') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
      return;
    }

    if (method === 'GET' && pathname === '/leads/pool/list') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(state.item.saleId ? [] : [clone(state.item)]),
      });
      return;
    }

    if (method === 'GET' && pathname === '/leads') {
      state.listUrls.push(request.url());
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([clone(state.item)]),
      });
      return;
    }

    if (method === 'GET' && pathname === '/leads/lead-edit-001') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(clone(state.item)),
      });
      return;
    }

    if (method === 'PATCH' && pathname === '/leads/lead-edit-001') {
      const body = request.postDataJSON();
      state.updateBodies.push({ id: 'lead-edit-001', body });
      state.item = {
        ...state.item,
        ...(body as Partial<LeadHarnessItem>),
      };
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
      return;
    }

    if (method === 'POST' && pathname === '/leads/lead-edit-001/contact') {
      const body = request.postDataJSON() as { method: string; notes?: string; nextFollowUp?: string };
      state.contactBodies.push({ id: 'lead-edit-001', body });
      state.item = {
        ...state.item,
        lastContactAt: '2026-04-11T09:30:00.000Z',
        nextFollowUp: body.nextFollowUp,
        contactHistory: [
          ...(state.item.contactHistory || []),
          {
            date: '2026-04-11T09:30:00.000Z',
            method: body.method,
            notes: body.notes,
            nextFollowUp: body.nextFollowUp,
            contactedBy: 'Director Demo',
          },
        ],
      };
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
      return;
    }

    if (method === 'POST' && pathname === '/leads/lead-edit-001/assign') {
      const body = request.postDataJSON() as { saleId: string; saleName: string };
      state.assignBodies.push({ id: 'lead-edit-001', body });
      state.item = {
        ...state.item,
        saleId: body.saleId,
        saleName: body.saleName,
        assignedAt: '2026-04-11T10:00:00.000Z',
        assignmentHistory: [
          ...(state.item.assignmentHistory || []),
          {
            saleId: body.saleId,
            saleName: body.saleName,
            assignedAt: '2026-04-11T10:00:00.000Z',
          },
        ],
      };
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
      return;
    }

    await route.fallback();
  });
}

async function openLeadsPage(
  browser: Browser,
  scenario: string,
): Promise<{ evidence: BatchEvidenceSession; state: LeadHarnessState }> {
  const evidence = await createBatchEvidenceContext(browser, {
    batchId: 'B04',
    scenario,
    runDate: RUN_DATE,
  });

  const state = buildLeadState();
  await installLeadRoutes(evidence.page, state);
  return { evidence, state };
}

test.use({
  trace: 'off',
  video: 'on',
});

test.describe.serial('B04 lead edit/contact/assign browser', () => {
  test('B04 edit lead, update contact, and assign sale keep list, detail, and pipeline state consistent', async ({
    browser,
    request,
  }) => {
    test.slow();
    test.setTimeout(300_000);

    const { evidence, state } = await openLeadsPage(browser, 'lead_edit_contact_assign_browser');
    const directorSession = await loginAsRole(request, 'director');
    await applySessionCookies(evidence.page, directorSession);
    await evidence.page.goto(appUrl('/app/leads'));
    await evidence.page.waitForLoadState('domcontentloaded');

    try {
      await expect(evidence.page.locator('h2')).toContainText(/Lead/i);
      await expect(evidence.page.locator('table.data tbody tr')).toHaveCount(1);
      await expect(evidence.page.locator('.pipe-card.assigned .pipe-count')).toHaveText('0');
      await expect(evidence.page.locator('.pipe-card.pool .pipe-count')).toHaveText('1');
      expect(state.listUrls.length).toBeGreaterThanOrEqual(1);
      expect(state.pipelineUrls.length).toBeGreaterThanOrEqual(1);
      await evidence.step('01-leads-list-loaded');

      const row = leadRow(evidence.page, 'LEAD-EDIT-001');
      await expect(row).toBeVisible();
      await row.click();
      await expect(evidence.page.getByRole('heading', { name: /LEAD-EDIT-001/ })).toBeVisible();
      await expect(evidence.page.locator('.detail-grid')).toContainText('before.parent@school.local');
      await expect(evidence.page.locator('.detail-grid')).toContainText(/Chua phan bo|Chưa phân bổ/i);
      await expect(evidence.page.getByText(/Lead can goi lai vao dau tuan/i)).toBeVisible();

      await evidence.page.getByRole('button', { name: /Sua|Sửa/i }).click();
      await expect(evidence.page.getByRole('heading', { name: /Sua Lead|Sửa Lead/i })).toBeVisible();
      await evidence.page.locator('input[name="parentPhone"]').fill(UPDATED_PHONE);
      await evidence.page.locator('input[name="parentEmail"]').fill(UPDATED_EMAIL);
      await evidence.page.locator('input[name="studentName"]').fill(UPDATED_STUDENT);
      await evidence.page.locator('input[name="studentGrade"]').fill(UPDATED_GRADE);
      await evidence.page.locator('input[name="estimatedValue"]').fill(String(UPDATED_VALUE));
      await evidence.page.locator('input[name="subjects"]').fill(UPDATED_SUBJECTS);
      await evidence.page.locator('textarea[name="notes"]').fill(UPDATED_NOTES);

      const updateRequest = evidence.page.waitForRequest((req) =>
        req.method() === 'PATCH' && req.url().includes('/leads/lead-edit-001'));
      await evidence.page.getByRole('button', { name: /Cap nhat|Cập nhật/i }).click();
      await updateRequest;

      expect(state.updateBodies).toHaveLength(1);
      expect(state.updateBodies[0]).toEqual({
        id: 'lead-edit-001',
        body: {
          _id: 'lead-edit-001',
          leadCode: 'LEAD-EDIT-001',
          parentName: 'Phu huynh Chua giao',
          parentPhone: UPDATED_PHONE,
          parentEmail: UPDATED_EMAIL,
          studentName: UPDATED_STUDENT,
          studentGrade: UPDATED_GRADE,
          interestedSubjects: ['Toan', 'Anh'],
          source: 'OTHER',
          status: 'NEW',
          estimatedValue: UPDATED_VALUE,
          notes: UPDATED_NOTES,
          createdAt: '2026-04-08T02:00:00.000Z',
          contactHistory: [],
          assignmentHistory: [],
        },
      });

      await expect(row.locator('td').nth(2)).toContainText(UPDATED_PHONE);
      await expect(row.locator('td').nth(3)).toContainText(UPDATED_STUDENT);
      await expect(row.locator('td').nth(8)).toContainText('2,100,000');
      await row.click();
      await expect(evidence.page.locator('.detail-grid')).toContainText(UPDATED_EMAIL);
      await expect(evidence.page.locator('.detail-grid')).toContainText(UPDATED_GRADE);
      await expect(evidence.page.getByText(UPDATED_NOTES)).toBeVisible();
      await evidence.step('02-edit-reflected');

      await evidence.page.getByRole('button', { name: /Dong|Đóng/i }).click();
      await row.locator('td.actions-cell button').nth(1).click();
      await expect(evidence.page.getByRole('heading', { name: /Ghi nhan lien he|Ghi nhận liên hệ/i })).toBeVisible();
      await evidence.page.locator('select[name="contactMethod"]').selectOption(CONTACT_METHOD);
      await evidence.page.locator('textarea[name="contactNotes"]').fill(CONTACT_NOTES);
      await evidence.page.locator('input[name="nextFollowUp"]').fill(CONTACT_FOLLOW_UP);

      const contactRequest = evidence.page.waitForRequest((req) =>
        req.method() === 'POST' && req.url().includes('/leads/lead-edit-001/contact'));
      await evidence.page.getByRole('button', { name: /Luu|Lưu/i }).click();
      await contactRequest;

      expect(state.contactBodies).toHaveLength(1);
      expect(state.contactBodies[0]).toEqual({
        id: 'lead-edit-001',
        body: {
          method: CONTACT_METHOD,
          notes: CONTACT_NOTES,
          nextFollowUp: CONTACT_FOLLOW_UP,
        },
      });

      await expect(row.locator('td').nth(7)).toContainText('18/04');
      await row.click();
      await expect(evidence.page.locator('.timeline')).toContainText(/Gap mat|Gặp mặt/i);
      await expect(evidence.page.locator('.timeline')).toContainText(CONTACT_NOTES);
      await expect(evidence.page.locator('.timeline')).toContainText('Director Demo');
      await evidence.step('03-contact-reflected');

      await evidence.page.getByRole('button', { name: /Dong|Đóng/i }).click();
      await row.locator('td.actions-cell button').first().click();
      const assignModal = evidence.page
        .locator('.modal')
        .filter({ has: evidence.page.getByRole('heading', { name: /Phan bo Lead cho Sale|Phân bổ Lead cho Sale/i }) });
      await expect(assignModal).toBeVisible();
      await assignModal.locator('select').selectOption('sale-002');

      const assignRequest = evidence.page.waitForRequest((req) =>
        req.method() === 'POST' && req.url().includes('/leads/lead-edit-001/assign'));
      await assignModal.locator('button.primary').click();
      await assignRequest;

      expect(state.assignBodies).toHaveLength(1);
      expect(state.assignBodies[0]).toEqual({
        id: 'lead-edit-001',
        body: {
          saleId: 'sale-002',
          saleName: 'Sale Beta',
        },
      });

      await expect(row.locator('td').nth(6)).toContainText('Sale Beta');
      await expect(evidence.page.locator('.pipe-card.assigned .pipe-count')).toHaveText('1');
      await expect(evidence.page.locator('.pipe-card.pool .pipe-count')).toHaveText('0');
      await row.click();
      await expect(evidence.page.locator('.detail-grid')).toContainText('Sale Beta');
      await expect(evidence.page.getByText(/Lich su phan bo|Lịch sử phân bổ/i)).toBeVisible();
      await expect(evidence.page.locator('.assignment-history')).toContainText('Sale Beta');
      await expect(evidence.page.locator('.assignment-history')).toContainText(/Dang phu trach|Đang phụ trách/i);
      await evidence.step('04-assign-reflected');

      await evidence.finalize('PASS', {
        extraLines: [
          `Update request body: ${JSON.stringify(state.updateBodies[0]?.body || null)}`,
          `Contact request body: ${JSON.stringify(state.contactBodies[0]?.body || null)}`,
          `Assign request body: ${JSON.stringify(state.assignBodies[0]?.body || null)}`,
          'Browser evidence proves edit, contact update, and sale assignment stay consistent across list, detail, follow-up, and pipeline surfaces without weakening any oracle.',
        ],
      });
    } catch (error) {
      await evidence.finalize('FAIL', { error });
      throw error;
    }
  });
});
