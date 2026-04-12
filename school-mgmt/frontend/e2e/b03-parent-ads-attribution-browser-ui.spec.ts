import { expect, test, type APIRequestContext, type Browser, type Page } from '@playwright/test';
import { applySessionCookies, createBatchEvidenceContext, loginAsRole, type BatchEvidenceSession } from './support';

const APP_BASE_URL =
  process.env['PLAYWRIGHT_BASE_URL'] ||
  process.env['E2E_BASE_URL'] ||
  'http://localhost:4200';

const API_ORIGIN_PATTERN = 'https?://(?:localhost|127\\.0\\.0\\.1):3000';
const USERS_PARENTS_API = new RegExp(`${API_ORIGIN_PATTERN}/users/parents(?:\\?.*)?$`);
const USERS_SALES_API = new RegExp(`${API_ORIGIN_PATTERN}/users/sales(?:\\?.*)?$`);
const USERS_API = new RegExp(`${API_ORIGIN_PATTERN}/users(?:\\?.*)?$`);
const USER_PARENT_ADS_API = new RegExp(`${API_ORIGIN_PATTERN}/users/([^/]+)/ads-attribution(?:\\?.*)?$`);
const ADS_GROUPS_ALL_API = new RegExp(`${API_ORIGIN_PATTERN}/ads/groups/all(?:\\?.*)?$`);

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

type CreateUserPayload = {
  userCode: string;
  email: string;
  phone?: string;
  password: string;
  fullName: string;
  role: string;
  facebookLink?: string;
  address?: string;
  saleOwnerId?: string;
};

type ParentAdsState = {
  parents: UserItem[];
  sales: UserItem[];
  adGroups: AdGroupItem[];
  attributions: Record<string, ParentAdsAttributionItem>;
  createUserCalls: CreateUserPayload[];
  updateAdsCalls: Array<{ parentId: string; payload: { adGroupId: string } }>;
  clearAdsCalls: string[];
  confirmMessages: string[];
  nextParentId: number;
};

function appUrl(path: string): string {
  return new URL(path, APP_BASE_URL).toString();
}

function nowIso(offsetMinutes = 0): string {
  return new Date(Date.now() + (offsetMinutes * 60 * 1000)).toISOString();
}

function buildState(): ParentAdsState {
  const createdAt = nowIso(-180);
  const updatedAt = nowIso(-30);

  const sales: UserItem[] = [
    {
      _id: 'sale-b03-001',
      userCode: 'SALE001',
      email: 'sale.alpha@example.com',
      fullName: 'Sale Alpha',
      role: 'SALE',
      status: 'ACTIVE',
    },
    {
      _id: 'sale-b03-002',
      userCode: 'SALE002',
      email: 'sale.bravo@example.com',
      fullName: 'Sale Bravo',
      role: 'SALE',
      status: 'ACTIVE',
    },
  ];

  const adGroups: AdGroupItem[] = [
    {
      _id: 'adgroup-facebook-1',
      groupCode: 'FB-G01',
      name: 'Facebook Prospecting',
      platform: 'FACEBOOK',
      adAccountId: 'acc-facebook-001',
      platformCampaignId: 'cmp-fb-001',
      status: 'ACTIVE',
      createdAt,
      updatedAt,
    },
    {
      _id: 'adgroup-tiktok-1',
      groupCode: 'TT-G02',
      name: 'TikTok Scale Group',
      platform: 'TIKTOK',
      adAccountId: 'acc-tiktok-001',
      platformCampaignId: 'cmp-tt-002',
      status: 'ACTIVE',
      createdAt,
      updatedAt,
    },
    {
      _id: 'adgroup-google-1',
      groupCode: 'GG-G03',
      name: 'Google Search Group',
      platform: 'GOOGLE',
      adAccountId: 'acc-google-001',
      platformCampaignId: 'cmp-gg-003',
      status: 'ACTIVE',
      createdAt,
      updatedAt,
    },
  ];

  const parents: UserItem[] = [
    {
      _id: 'parent-b03-ads-001',
      userCode: 'PH001',
      email: 'parent.ads.alpha@example.com',
      fullName: 'Phu huynh Ads Alpha',
      role: 'PARENT',
      status: 'ACTIVE',
      phone: '0901111111',
      address: '123 Nguyen Hue',
      facebookLink: 'https://facebook.com/parent.alpha',
      saleOwnerId: sales[0]._id,
      saleOwnerName: sales[0].fullName,
      adGroupId: adGroups[0]._id,
      adGroupName: adGroups[0].name,
      adPlatform: adGroups[0].platform,
      adAttributionSource: 'LEAD',
    },
    {
      _id: 'parent-b03-ads-002',
      userCode: 'PH002',
      email: 'parent.ads.beta@example.com',
      fullName: 'Phu huynh Ads Beta',
      role: 'PARENT',
      status: 'ACTIVE',
      phone: '0902222222',
      address: '456 Le Loi',
      facebookLink: 'https://facebook.com/parent.beta',
      saleOwnerId: sales[1]._id,
      saleOwnerName: sales[1].fullName,
      adGroupId: null,
      adGroupName: '',
      adPlatform: '',
      adAttributionSource: null,
    },
  ];

  return {
    parents,
    sales,
    adGroups,
    attributions: {
      [parents[0]._id]: {
        parentUserId: parents[0]._id,
        parentName: parents[0].fullName,
        parentPhone: parents[0].phone,
        parentKey: 'ads-alpha-key',
        adGroupId: adGroups[0]._id,
        adGroupName: adGroups[0].name,
        platform: adGroups[0].platform,
        sourceType: 'LEAD',
        matchedBy: 'PHONE_FALLBACK',
        attributionModel: 'LAST_TOUCH',
        firstAttributedAt: nowIso(-120),
        lastConfirmedAt: nowIso(-20),
        notes: 'Seed attribution for browser coverage',
      },
      [parents[1]._id]: {
        parentUserId: parents[1]._id,
        parentName: parents[1].fullName,
        parentPhone: parents[1].phone,
        parentKey: 'ads-beta-key',
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
    createUserCalls: [],
    updateAdsCalls: [],
    clearAdsCalls: [],
    confirmMessages: [],
    nextParentId: 3,
  };
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function buildUnassignedAttribution(parent: UserItem): ParentAdsAttributionItem {
  return {
    parentUserId: parent._id,
    parentName: parent.fullName,
    parentPhone: parent.phone,
    parentKey: `${parent._id}-key`,
    adGroupId: null,
    adGroupName: '',
    platform: '',
    sourceType: null,
    matchedBy: 'UNASSIGNED',
    attributionModel: null,
    firstAttributedAt: null,
    lastConfirmedAt: null,
    notes: '',
  };
}

function syncParentAdsRow(state: ParentAdsState, parentId: string, attribution: ParentAdsAttributionItem): void {
  state.parents = state.parents.map((parent) =>
    parent._id !== parentId
      ? parent
      : {
          ...parent,
          adGroupId: attribution.adGroupId || null,
          adGroupName: attribution.adGroupName || '',
          adPlatform: attribution.platform || '',
          adAttributionSource: attribution.sourceType || null,
        },
  );
}

async function openParentUsers(
  browser: Browser,
  request: APIRequestContext,
  scenario: string,
): Promise<BatchEvidenceSession> {
  const batch = await createBatchEvidenceContext(browser, {
    batchId: 'B03',
    scenario,
  });
  const directorSession = await loginAsRole(request, 'director');
  await applySessionCookies(batch.page, directorSession);
  await batch.page.addInitScript(() => {
    const browserWindow = window as any;
    browserWindow.__usersManagementConfirms = [];
    window.confirm = (message?: string) => {
      browserWindow.__usersManagementConfirms.push(String(message || ''));
      return true;
    };
  });
  return batch;
}

async function installParentAdsRoutes(page: Page, state: ParentAdsState): Promise<void> {
  await page.route(USERS_PARENTS_API, async (route) => {
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

  await page.route(USERS_API, async (route) => {
    if (route.request().method() !== 'POST') {
      await route.continue();
      return;
    }

    const payload = route.request().postDataJSON() as CreateUserPayload;
    state.createUserCalls.push(clone(payload));
    const sale = state.sales.find((item) => item._id === payload.saleOwnerId) || null;
    const createdUser: UserItem = {
      _id: `parent-created-${state.nextParentId}`,
      userCode: payload.userCode,
      email: payload.email,
      fullName: payload.fullName,
      role: payload.role,
      status: 'ACTIVE',
      phone: payload.phone,
      address: payload.address,
      facebookLink: payload.facebookLink,
      saleOwnerId: payload.saleOwnerId || null,
      saleOwnerName: sale?.fullName || '',
      adGroupId: null,
      adGroupName: '',
      adPlatform: '',
      adAttributionSource: null,
    };
    state.nextParentId += 1;
    state.parents = [createdUser, ...state.parents];
    state.attributions[createdUser._id] = buildUnassignedAttribution(createdUser);

    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify(clone(createdUser)),
    });
  });

  await page.route(USER_PARENT_ADS_API, async (route) => {
    const match = route.request().url().match(USER_PARENT_ADS_API);
    const parentId = match?.[1] || '';
    const parent = state.parents.find((item) => item._id === parentId);
    const method = route.request().method();

    if (!parent) {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Parent not found' }),
      });
      return;
    }

    if (method === 'GET') {
      await page.waitForTimeout(250);
      const attribution = state.attributions[parentId] || buildUnassignedAttribution(parent);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(clone(attribution)),
      });
      return;
    }

    if (method === 'PATCH') {
      const payload = route.request().postDataJSON() as { adGroupId: string };
      state.updateAdsCalls.push({ parentId, payload: clone(payload) });
      const adGroup = state.adGroups.find((item) => item._id === payload.adGroupId);
      if (!adGroup) {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Ad group not found' }),
        });
        return;
      }

      await page.waitForTimeout(350);
      const updatedAttribution: ParentAdsAttributionItem = {
        parentUserId: parentId,
        parentName: parent.fullName,
        parentPhone: parent.phone,
        parentKey: `${parentId}-key`,
        adGroupId: adGroup._id,
        adGroupName: adGroup.name,
        platform: adGroup.platform,
        sourceType: 'MANUAL',
        matchedBy: 'PARENT_USER',
        attributionModel: 'MANUAL_LOCK',
        firstAttributedAt: state.attributions[parentId]?.firstAttributedAt || nowIso(-90),
        lastConfirmedAt: nowIso(),
        notes: 'Manual override from parent detail pane',
      };
      state.attributions[parentId] = updatedAttribution;
      syncParentAdsRow(state, parentId, updatedAttribution);

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(clone(updatedAttribution)),
      });
      return;
    }

    if (method === 'DELETE') {
      state.clearAdsCalls.push(parentId);
      await page.waitForTimeout(350);
      const clearedAttribution = buildUnassignedAttribution(parent);
      state.attributions[parentId] = clearedAttribution;
      syncParentAdsRow(state, parentId, clearedAttribution);

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(clone(clearedAttribution)),
      });
      return;
    }

    await route.continue();
  });
}

async function gotoParentUsers(page: Page): Promise<void> {
  await page.goto(appUrl('/app/users?role=PARENT'));
  await page.waitForLoadState('domcontentloaded');
}

async function readConfirmMessages(page: Page): Promise<string[]> {
  return page.evaluate(() => ((window as any).__usersManagementConfirms || []) as string[]);
}

test.use({
  trace: 'off',
  video: 'on',
});

test('B03 parent create persists initial ads attribution through modal submit and reload', async ({ browser, request }) => {
  const state = buildState();
  const batch = await openParentUsers(browser, request, 'parent_ads_attribution_create');

  try {
    await installParentAdsRoutes(batch.page, state);

    await gotoParentUsers(batch.page);
    await expect(batch.page.locator('table.data')).toBeVisible();
    await expect(batch.page.getByRole('heading', { name: 'Bang chi tiet phu huynh' })).toBeVisible();
    await batch.step('parent-ads-create-initial');

    await batch.page.getByRole('button', { name: '+ Them phu huynh' }).click();
    const modal = batch.page.locator('.modal');
    await expect(modal).toBeVisible();

    await modal.locator('input[name="userCode"]').fill('ph-b03-ads-003');
    await modal.locator('input[name="email"]').fill('parent.ads.created@example.com');
    await modal.locator('input[name="phone"]').fill('0903333333');
    await modal.locator('input[name="password"]').fill('Demo123456!');
    await modal.locator('input[name="fullName"]').fill('Phu huynh Ads Gamma');
    await modal.locator('input[name="facebookLink"]').fill('https://facebook.com/parent.gamma');
    await modal.locator('input[name="address"]').fill('789 Tran Hung Dao');
    await modal.locator('select[name="saleOwnerId"]').selectOption('sale-b03-002');
    await modal.locator('select[name="adGroupId"]').selectOption('adgroup-tiktok-1');
    await modal.getByRole('button', { name: 'Luu' }).click();

    await expect(batch.page.locator('.modal-backdrop')).toHaveCount(0);
    expect(state.createUserCalls).toHaveLength(1);
    expect(state.createUserCalls[0]).toEqual({
      userCode: 'PH-B03-ADS-003',
      email: 'parent.ads.created@example.com',
      phone: '0903333333',
      password: 'Demo123456!',
      fullName: 'Phu huynh Ads Gamma',
      role: 'PARENT',
      facebookLink: 'https://facebook.com/parent.gamma',
      address: '789 Tran Hung Dao',
      saleOwnerId: 'sale-b03-002',
    });
    expect(state.createUserCalls[0]).not.toHaveProperty('adGroupId');

    expect(state.updateAdsCalls).toHaveLength(1);
    expect(state.updateAdsCalls[0]).toEqual({
      parentId: 'parent-created-3',
      payload: {
        adGroupId: 'adgroup-tiktok-1',
      },
    });
    await batch.step('parent-ads-create-submitted');

    const createdRow = batch.page.locator('tbody tr').filter({ hasText: 'parent.ads.created@example.com' }).first();
    await expect(createdRow).toBeVisible();
    await expect(createdRow).toContainText('TikTok Scale Group');
    await expect(createdRow).toContainText('TIKTOK');
    await createdRow.click();

    const detailTable = batch.page.locator('.detail-table');
    await expect(detailTable).toContainText('Phu huynh Ads Gamma');
    await expect(detailTable).toContainText('Sale Bravo');
    await expect(detailTable).toContainText('TikTok Scale Group - TIKTOK');
    await batch.step('parent-ads-create-detail');

    await batch.finalize('PASS', {
      extraLines: [
        'Verified parent create payload keeps parent fields strict and does not leak adGroupId into /users POST.',
        'Verified initial ad attribution is created by exact PATCH payload after parent creation.',
        'Verified created row and detail pane both render TikTok Scale Group and Sale Bravo after reload.',
      ],
    });
  } catch (error) {
    await batch.finalize('FAIL', { error });
    throw error;
  }
});

test('B03 parent ads attribution update and clear keep row and detail state synchronized', async ({ browser, request }) => {
  const state = buildState();
  const batch = await openParentUsers(browser, request, 'parent_ads_attribution_update_clear');

  try {
    await installParentAdsRoutes(batch.page, state);

    await gotoParentUsers(batch.page);
    await expect(batch.page.locator('table.data')).toBeVisible();
    await expect(batch.page.getByText('Dang tai attribution ads cho Phu huynh Ads Alpha...')).toBeVisible();
    await expect(batch.page.locator('.detail-table')).toContainText('Facebook Prospecting - FACEBOOK');
    await expect(batch.page.locator('.ads-attribution-summary')).toContainText('Tu lead');
    await expect(batch.page.locator('.ads-attribution-summary')).toContainText('Fallback theo so dien thoai');
    await batch.step('parent-ads-update-initial');

    const adGroupSearch = batch.page.locator('input[name="adGroupSearch"]');
    await adGroupSearch.fill('TikTok');
    const adGroupSelect = batch.page.locator('select[name="selectedParentAdGroupId"]');
    await expect(adGroupSelect.locator('option', { hasText: 'TikTok Scale Group (TIKTOK)' })).toHaveCount(1);
    await expect(adGroupSelect.locator('option', { hasText: 'Facebook Prospecting (FACEBOOK)' })).toHaveCount(0);
    await adGroupSelect.selectOption('adgroup-tiktok-1');

    const saveButton = batch.page.getByRole('button', { name: 'Luu nhom ads' });
    const savePromise = saveButton.click();
    await expect(batch.page.getByRole('button', { name: 'Dang luu...' })).toBeVisible();
    await savePromise;

    expect(state.updateAdsCalls).toHaveLength(1);
    expect(state.updateAdsCalls[0]).toEqual({
      parentId: 'parent-b03-ads-001',
      payload: {
        adGroupId: 'adgroup-tiktok-1',
      },
    });
    await expect(batch.page.locator('.success')).toHaveText('Da cap nhat nhom quang cao cho phu huynh');
    await expect(batch.page.locator('.detail-table')).toContainText('TikTok Scale Group - TIKTOK');
    await expect(batch.page.locator('.ads-attribution-summary')).toContainText('Thu cong');
    await expect(batch.page.locator('.ads-attribution-summary')).toContainText('Theo tai khoan PH');
    const parentRow = batch.page.locator('tbody tr').filter({ hasText: 'parent.ads.alpha@example.com' }).first();
    await expect(parentRow).toContainText('TikTok Scale Group');
    await expect(parentRow).toContainText('TIKTOK');
    await batch.step('parent-ads-update-applied');

    const clearButton = batch.page.getByRole('button', { name: 'Bo gan hien tai' });
    const clearPromise = clearButton.click();
    await expect(batch.page.getByRole('button', { name: 'Dang luu...' })).toBeVisible();
    await clearPromise;

    expect(state.clearAdsCalls).toEqual(['parent-b03-ads-001']);
    const confirmMessages = await readConfirmMessages(batch.page);
    expect(confirmMessages).toEqual(['Bo gan nhom quang cao hien tai cho phu huynh nay?']);
    await expect(batch.page.locator('.success')).toHaveText('Da bo gan nhom quang cao hien tai');
    await expect(batch.page.locator('.detail-table')).toContainText('Chua gan nhom ads');
    await expect(batch.page.locator('.ads-attribution-summary')).toContainText('Chua co');
    await expect(batch.page.locator('.ads-attribution-summary')).toContainText('Chua co attribution');
    await expect(parentRow.locator('td').nth(6)).toHaveText('-');
    await expect(clearButton).toBeDisabled();
    await batch.step('parent-ads-clear-applied');

    await batch.finalize('PASS', {
      extraLines: [
        'Verified ad-group search filters the dropdown before save.',
        'Verified exact PATCH payload updates attribution to TikTok Scale Group and synchronizes row/detail/source labels.',
        'Verified clear flow keeps the confirm message strict and resets row/detail attribution state to unassigned.',
      ],
    });
  } catch (error) {
    await batch.finalize('FAIL', { error });
    throw error;
  }
});
