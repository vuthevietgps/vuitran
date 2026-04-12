import { expect, test, type APIRequestContext, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { applySessionCookies, createBatchEvidenceContext, loginAsRole, type BatchEvidenceSession } from './support';

const APP_BASE_URL =
  process.env['PLAYWRIGHT_BASE_URL']
  || process.env['E2E_BASE_URL']
  || 'http://localhost:4200';

const API_ORIGIN_PATTERN = 'https?://(?:localhost|127\\.0\\.0\\.1):3000';
const USERS_ME_API = new RegExp(`${API_ORIGIN_PATTERN}/users/me(?:\\?.*)?$`);
const USERS_API = new RegExp(`${API_ORIGIN_PATTERN}/users(?:\\?.*)?$`);
const USERS_PARENTS_API = new RegExp(`${API_ORIGIN_PATTERN}/users/parents(?:\\?.*)?$`);
const USERS_SALES_API = new RegExp(`${API_ORIGIN_PATTERN}/users/sales(?:\\?.*)?$`);
const USER_UPDATE_API = new RegExp(`${API_ORIGIN_PATTERN}/users/([^/]+)(?:\\?.*)?$`);
const USER_PARENT_ADS_API = new RegExp(`${API_ORIGIN_PATTERN}/users/([^/]+)/ads-attribution(?:\\?.*)?$`);
const ADS_GROUPS_ALL_API = new RegExp(`${API_ORIGIN_PATTERN}/ads/groups/all(?:\\?.*)?$`);
const STUDENTS_API = new RegExp(`${API_ORIGIN_PATTERN}/students(?:\\?.*)?$`);

type AuthPayload = {
  _id: string;
  email: string;
  role: string;
  fullName: string;
  userCode?: string;
};

type UserItem = {
  _id: string;
  userCode?: string;
  email: string;
  fullName: string;
  role: string;
  status?: string;
  phone?: string;
  saleOwnerId?: string | null;
  saleOwnerName?: string;
  facebookLink?: string;
  address?: string;
  adGroupId?: string | null;
  adGroupName?: string;
  adPlatform?: string;
  adAttributionSource?: string | null;
};

type StudentItem = {
  _id: string;
  studentCode: string;
  fullName: string;
  age: number;
  parentUserId?: string;
  parentName: string;
  parentPhone: string;
  faceImage: string;
  saleId?: string;
  saleName?: string;
};

type ParentAdsAttributionItem = {
  parentUserId: string;
  parentName?: string;
  parentPhone?: string;
  parentKey?: string | null;
  adGroupId?: string | null;
  adGroupName?: string;
  platform?: string;
  attributionModel?: string | null;
  sourceType?: string | null;
  firstAttributedAt?: string | null;
  lastConfirmedAt?: string | null;
  notes?: string;
  matchedBy?: 'PARENT_USER' | 'PHONE_FALLBACK' | 'UNASSIGNED';
};

type AdGroupItem = {
  _id: string;
  groupCode: string;
  name: string;
  platform: string;
  adAccountId: string;
  platformCampaignId: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

type State = {
  parents: UserItem[];
  sales: UserItem[];
  students: StudentItem[];
  adGroups: AdGroupItem[];
  attributions: Record<string, ParentAdsAttributionItem>;
  updateCalls: Array<{ parentId: string; payload: { saleOwnerId: string } }>;
  confirmMessages: string[];
};

function appUrl(path: string): string {
  return new URL(path, APP_BASE_URL).toString();
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function nowIso(offsetMinutes = 0): string {
  return new Date(Date.now() + (offsetMinutes * 60 * 1000)).toISOString();
}

function buildState(): State {
  const sales: UserItem[] = [
    {
      _id: 'sale-b03-owner-001',
      userCode: 'SALE001',
      email: 'sale.alpha@example.com',
      fullName: 'Sale Alpha',
      role: 'SALE',
      status: 'ACTIVE',
    },
    {
      _id: 'sale-b03-owner-002',
      userCode: 'SALE002',
      email: 'sale.bravo@example.com',
      fullName: 'Sale Bravo',
      role: 'SALE',
      status: 'ACTIVE',
    },
  ];

  const parents: UserItem[] = [
    {
      _id: 'parent-b03-owner-001',
      userCode: 'PH001',
      email: 'parent.owner.alpha@example.com',
      fullName: 'Phu huynh Owner Alpha',
      role: 'PARENT',
      status: 'ACTIVE',
      phone: '0901111111',
      address: '123 Nguyen Hue',
      facebookLink: 'https://facebook.com/parent.owner.alpha',
      saleOwnerId: sales[0]._id,
      saleOwnerName: sales[0].fullName,
      adGroupId: null,
      adGroupName: '',
      adPlatform: '',
      adAttributionSource: null,
    },
  ];

  const students: StudentItem[] = [
    {
      _id: 'student-b03-owner-001',
      studentCode: 'HS-B03-OWNER-001',
      fullName: 'Hoc sinh Owner Link',
      age: 9,
      parentUserId: parents[0]._id,
      parentName: parents[0].fullName,
      parentPhone: parents[0].phone || '',
      faceImage: '/uploads/faces/b03-owner.png',
      saleId: sales[0]._id,
      saleName: sales[0].fullName,
    },
  ];

  const adGroups: AdGroupItem[] = [
    {
      _id: 'adgroup-owner-001',
      groupCode: 'FB-G01',
      name: 'Facebook Prospecting',
      platform: 'FACEBOOK',
      adAccountId: 'acc-facebook-001',
      platformCampaignId: 'cmp-fb-001',
      status: 'ACTIVE',
      createdAt: nowIso(-180),
      updatedAt: nowIso(-15),
    },
  ];

  return {
    parents,
    sales,
    students,
    adGroups,
    attributions: {
      [parents[0]._id]: {
        parentUserId: parents[0]._id,
        parentName: parents[0].fullName,
        parentPhone: parents[0].phone,
        parentKey: 'b03-owner-alpha',
        adGroupId: null,
        adGroupName: '',
        platform: '',
        sourceType: null,
        matchedBy: 'UNASSIGNED',
        attributionModel: null,
        firstAttributedAt: null,
        lastConfirmedAt: null,
        notes: '',
      },
    },
    updateCalls: [],
    confirmMessages: [],
  };
}

async function openDirectorUsers(
  browser: Browser,
  request: APIRequestContext,
): Promise<{ batch: BatchEvidenceSession; baseSession: Awaited<ReturnType<typeof loginAsRole>> }> {
  const batch = await createBatchEvidenceContext(browser, {
    batchId: 'B03',
    scenario: 'parent_owner_transfer',
  });
  const baseSession = await loginAsRole(request, 'director');
  await applySessionCookies(batch.page, baseSession);
  return { batch, baseSession };
}

async function installRoutes(page: Page, state: State, actor: AuthPayload): Promise<void> {
  await page.addInitScript(() => {
    const browserWindow = window as any;
    browserWindow.__parentOwnerTransferConfirms = [];
    window.confirm = (message?: string) => {
      browserWindow.__parentOwnerTransferConfirms.push(String(message || ''));
      return true;
    };
  });

  await page.route(USERS_ME_API, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(clone(actor)),
    });
  });

  await page.route(USERS_PARENTS_API, async (route) => {
    const scopedParents = actor.role === 'SALE'
      ? state.parents.filter((parent) => parent.saleOwnerId === actor._id)
      : state.parents;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(clone(scopedParents)),
    });
  });

  await page.route(USERS_API, async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(clone(state.parents)),
    });
  });

  await page.route(USERS_SALES_API, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(clone(state.sales)),
    });
  });

  await page.route(ADS_GROUPS_ALL_API, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(clone(state.adGroups)),
    });
  });

  await page.route(USER_PARENT_ADS_API, async (route) => {
    const match = route.request().url().match(USER_PARENT_ADS_API);
    const parentId = match?.[1] || '';
    const attribution = state.attributions[parentId];
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(clone(attribution || {
        parentUserId: parentId,
        adGroupId: null,
        adGroupName: '',
        platform: '',
        sourceType: null,
        matchedBy: 'UNASSIGNED',
      })),
    });
  });

  await page.route(STUDENTS_API, async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }

    const scopedStudents = actor.role === 'SALE'
      ? state.students.filter((student) => student.saleId === actor._id)
      : state.students;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(clone(scopedStudents)),
    });
  });

  await page.route(USER_UPDATE_API, async (route) => {
    const requestUrl = route.request().url();
    if (requestUrl.match(USER_PARENT_ADS_API) || requestUrl.match(USERS_ME_API)) {
      await route.fallback();
      return;
    }

    if (route.request().method() !== 'PATCH') {
      await route.fallback();
      return;
    }

    if (actor.role !== 'DIRECTOR') {
      await route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Khong du quyen' }),
      });
      return;
    }

    const match = requestUrl.match(USER_UPDATE_API);
    const parentId = match?.[1] || '';
    const payload = route.request().postDataJSON() as { saleOwnerId?: string };
    state.updateCalls.push({
      parentId,
      payload: {
        saleOwnerId: payload.saleOwnerId || '',
      },
    });

    const targetParent = state.parents.find((parent) => parent._id === parentId);
    const nextSale = state.sales.find((sale) => sale._id === payload.saleOwnerId) || null;
    if (!targetParent || !nextSale) {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Sale phu trach khong hop le' }),
      });
      return;
    }

    await page.waitForTimeout(250);
    targetParent.saleOwnerId = nextSale._id;
    targetParent.saleOwnerName = nextSale.fullName;
    state.students = state.students.map((student) =>
      student.parentUserId !== parentId
        ? student
        : {
            ...student,
            saleId: nextSale._id,
            saleName: nextSale.fullName,
          });

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(clone(targetParent)),
    });
  });
}

async function gotoParentUsers(page: Page): Promise<void> {
  await page.goto(appUrl('/app/users?role=PARENT'));
  await page.waitForLoadState('domcontentloaded');
}

async function gotoStudents(page: Page): Promise<void> {
  await page.goto(appUrl('/app/students'));
  await page.waitForLoadState('domcontentloaded');
}

async function openActorPage(
  browser: Browser,
  baseSession: Awaited<ReturnType<typeof loginAsRole>>,
  actor: AuthPayload,
): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({ locale: 'vi-VN', viewport: { width: 1600, height: 900 } });
  const page = await context.newPage();
  await applySessionCookies(page, baseSession);
  return { context, page };
}

async function readConfirmMessages(page: Page): Promise<string[]> {
  return page.evaluate(() => ((window as any).__parentOwnerTransferConfirms || []) as string[]);
}

test.use({
  trace: 'off',
  video: 'on',
});

test('B03 parent owner transfer confirms clearly and updates director plus sale-scoped parent/student views', async ({ browser, request }) => {
  const state = buildState();
  const { batch, baseSession } = await openDirectorUsers(browser, request);
  const seenRequests: string[] = [];

  const directorActor: AuthPayload = {
    _id: 'director-b03-owner-001',
    sub: 'director-b03-owner-001',
    email: 'director.owner@example.com',
    role: 'DIRECTOR',
    fullName: 'Director Owner Transfer',
    userCode: 'GD-B03',
  };
  const saleAlphaActor: AuthPayload = {
    _id: 'sale-b03-owner-001',
    sub: 'sale-b03-owner-001',
    email: 'sale.alpha@example.com',
    role: 'SALE',
    fullName: 'Sale Alpha',
    userCode: 'SALE001',
  };
  const saleBravoActor: AuthPayload = {
    _id: 'sale-b03-owner-002',
    sub: 'sale-b03-owner-002',
    email: 'sale.bravo@example.com',
    role: 'SALE',
    fullName: 'Sale Bravo',
    userCode: 'SALE002',
  };

  const saleAlpha = await openActorPage(browser, baseSession, saleAlphaActor);
  const saleBravo = await openActorPage(browser, baseSession, saleBravoActor);

  try {
    batch.page.on('request', (req) => {
      if (req.url().includes('/users') || req.url().includes('/students') || req.url().includes('/ads/groups')) {
        seenRequests.push(`${req.method()} ${req.url()}`);
      }
    });
    await installRoutes(batch.page, state, directorActor);
    await installRoutes(saleAlpha.page, state, saleAlphaActor);
    await installRoutes(saleBravo.page, state, saleBravoActor);

    await gotoParentUsers(batch.page);
    await expect(batch.page.locator('table.data')).toBeVisible();
    const parentRow = batch.page.locator('tbody tr').filter({ hasText: 'parent.owner.alpha@example.com' }).first();
    await expect(parentRow).toBeVisible();
    await expect(parentRow).toContainText('Sale Alpha');
    await parentRow.click();
    await expect(batch.page.locator('.detail-table')).toContainText('Sale Alpha');
    const ownerCard = batch.page.locator('.ads-attribution-card').filter({
      has: batch.page.locator('h5', { hasText: 'Chuyen sale phu trach' }),
    }).first();
    await expect(ownerCard).toContainText('Chuyen sale phu trach');
    await batch.step('parent-owner-transfer-initial');

    const ownerSelect = batch.page.locator('select[name="selectedParentSaleOwnerId"]');
    await expect(ownerSelect.locator('option', { hasText: 'Sale Alpha (SALE001)' })).toHaveCount(1);
    await expect(ownerSelect.locator('option', { hasText: 'Sale Bravo (SALE002)' })).toHaveCount(1);
    await ownerSelect.selectOption('sale-b03-owner-002');
    const saveButton = batch.page.getByRole('button', { name: 'Luu sale phu trach' });
    const savePromise = saveButton.click();
    await expect(batch.page.getByRole('button', { name: 'Dang luu...' })).toBeVisible();
    await savePromise;

    expect(state.updateCalls).toEqual([
      {
        parentId: 'parent-b03-owner-001',
        payload: {
          saleOwnerId: 'sale-b03-owner-002',
        },
      },
    ]);
    expect(await readConfirmMessages(batch.page)).toEqual([
      'Chuyen sale phu trach tu Sale Alpha sang Sale Bravo cho Phu huynh Owner Alpha?',
    ]);
    await expect(batch.page.locator('.success')).toHaveText('Da cap nhat sale phu trach cho phu huynh');
    await expect(parentRow).toContainText('Sale Bravo');
    await expect(batch.page.locator('.detail-table')).toContainText('Sale Bravo');
    await batch.step('parent-owner-transfer-director-updated');

    await gotoParentUsers(saleAlpha.page);
    await expect(saleAlpha.page.locator('table.data')).toHaveCount(0);
    await expect(saleAlpha.page.getByText('Khong co du lieu hoac khong trung bo loc.')).toBeVisible();
    await gotoStudents(saleAlpha.page);
    await expect(saleAlpha.page.getByText('Chua co hoc sinh.')).toBeVisible();
    await batch.step('parent-owner-transfer-sale-alpha-cleared', saleAlpha.page);

    await gotoParentUsers(saleBravo.page);
    const saleBravoParentRow = saleBravo.page.locator('tbody tr').filter({ hasText: 'parent.owner.alpha@example.com' }).first();
    await expect(saleBravoParentRow).toBeVisible();
    await expect(saleBravoParentRow).toContainText('Sale Bravo');
    await gotoStudents(saleBravo.page);
    const saleBravoStudentRow = saleBravo.page.locator('tbody tr').filter({ hasText: 'HS-B03-OWNER-001' }).first();
    await expect(saleBravoStudentRow).toBeVisible();
    await expect(saleBravoStudentRow).toContainText('Hoc sinh Owner Link');
    await batch.step('parent-owner-transfer-sale-bravo-receives-linked-student', saleBravo.page);

    await batch.finalize('PASS', {
      extraLines: [
        'Verified director sees a strict confirm prompt before changing parent sale owner from Sale Alpha to Sale Bravo.',
        'Verified the exact PATCH payload updates parent owner and the parent list plus detail pane both reload to Sale Bravo.',
        'Verified sale-scoped parent and student screens remove the parent/student from Sale Alpha and surface them under Sale Bravo after reload.',
      ],
    });
  } catch (error) {
    await batch.finalize('FAIL', {
      error,
      extraLines: seenRequests.length
        ? ['Observed startup requests:', ...seenRequests]
        : ['Observed startup requests: none captured'],
    });
    throw error;
  } finally {
    await saleAlpha.context.close();
    await saleBravo.context.close();
  }
});
