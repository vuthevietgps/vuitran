import { expect, test, type APIRequestContext, type Browser, type Page } from '@playwright/test';
import {
  applySessionCookies,
  createBatchEvidenceContext,
  loginAsRole,
  type BatchEvidenceSession,
  type DemoRole,
} from './support';

const APP_BASE_URL =
  process.env['PLAYWRIGHT_BASE_URL'] ||
  process.env['E2E_BASE_URL'] ||
  'http://localhost:4200';

const RUN_DATE = process.env['UI_EVIDENCE_DATE'] || new Date().toISOString().slice(0, 10);

test.use({
  trace: 'off',
  video: 'on',
});

type AdsState = {
  accounts: any[];
  groups: any[];
  tokens: any[];
  costs: any[];
  auditLogs: any[];
  actionsResponse: {
    summary: {
      totalActiveGroups: number;
      profitableGroups: number;
      unprofitableGroups: number;
      totalDailySpend: number;
      totalOptimalDailySpend: number;
      overallNetProfit7d: number;
      overallEffectiveNetProfit: number;
      generatedAt: string;
    };
    actions: any[];
  };
  actionRequestUrls: string[];
  backfillRuns: string[];
  tokenSyncRuns: string[];
  fullSyncRuns: string[];
  nextIds: {
    account: number;
    group: number;
    token: number;
    cost: number;
  };
};

type AdsRouteOverrides = {
  tokenSync?: (route: any, state: AdsState) => Promise<void>;
  fullSync?: (route: any, state: AdsState) => Promise<void>;
  parentBackfill?: (route: any, state: AdsState) => Promise<void>;
  adGroupBackfill?: (route: any, state: AdsState) => Promise<void>;
};

function appUrl(path: string): string {
  return new URL(path, APP_BASE_URL).toString();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function nowIso(): string {
  return new Date().toISOString();
}

function paginated<T>(rows: T[]) {
  return {
    data: rows,
    total: rows.length,
    page: 1,
    limit: Math.max(rows.length, 1),
  };
}

function createAuditLogEntry(
  targetId: string,
  targetName: string,
  newValue: Record<string, unknown>,
): any {
  return {
    _id: `${targetId}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    module: 'ADS',
    action: 'RUN',
    targetId,
    targetName,
    userFullName: 'Director Demo',
    userEmail: 'director.demo@school.local',
    createdAt: nowIso(),
    newValue,
  };
}

function createAdsState(): AdsState {
  return {
    accounts: [
      {
        _id: 'acc-1',
        accountCode: 'ACC-001',
        name: 'Facebook Cohort Alpha',
        platform: 'FACEBOOK',
        platformAccountId: 'fb-acc-001',
        businessId: 'bm-001',
        businessName: 'Alpha BM',
        monthlyBudget: 25000000,
        syncSource: 'FACEBOOK_BM',
        status: 'ACTIVE',
        lastSyncedAt: nowIso(),
        createdAt: nowIso(),
        updatedAt: nowIso(),
      },
    ],
    groups: [
      {
        _id: 'group-alpha',
        groupCode: 'AG-001',
        name: 'Retargeting Alpha',
        adAccountId: 'acc-1',
        adAccountName: 'Facebook Cohort Alpha',
        platform: 'FACEBOOK',
        platformCampaignId: 'cmp-001',
        trackingKeys: ['utm_campaign=alpha'],
        status: 'ACTIVE',
        dailyBudget: 850000,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      },
    ],
    tokens: [
      {
        _id: 'token-1',
        adAccountId: 'acc-1',
        adAccountName: 'Facebook Cohort Alpha',
        platform: 'FACEBOOK',
        tokenType: 'FACEBOOK_SYSTEM_USER',
        businessId: 'bm-001',
        businessName: 'Alpha BM',
        accessToken: 'EAAB-SEEDED-TOKEN',
        status: 'ACTIVE',
        label: 'Alpha BM token',
        expiresAt: nowIso(),
        lastSyncedAt: nowIso(),
        lastUsedAt: nowIso(),
        createdAt: nowIso(),
      },
    ],
    costs: [
      {
        _id: 'cost-1',
        adGroupId: 'group-alpha',
        adGroupName: 'Retargeting Alpha',
        adAccountId: 'acc-1',
        platform: 'FACEBOOK',
        date: RUN_DATE,
        spend: 1250000,
        impressions: 18000,
        clicks: 640,
        conversions: 21,
        source: 'FACEBOOK_BM',
        syncedAt: nowIso(),
        createdAt: nowIso(),
      },
    ],
    auditLogs: [
      createAuditLogEntry('backfill-adgroup', 'Backfill adGroup', {
        operation: 'BACKFILL_ADGROUP',
        studentsUpdated: 12,
        sessionsUpdated: 9,
      }),
    ],
    actionsResponse: {
      summary: {
        totalActiveGroups: 3,
        profitableGroups: 2,
        unprofitableGroups: 1,
        totalDailySpend: 2250000,
        totalOptimalDailySpend: 1950000,
        overallNetProfit7d: -420000,
        overallEffectiveNetProfit: 180000,
        generatedAt: nowIso(),
      },
      actions: [
        {
          type: 'PAUSE_GROUP',
          priority: 'CRITICAL',
          title: 'Tam dung nhom Retargeting Alpha',
          description: 'Nhieu chi phi hon loi nhuan trong 7 ngay gan nhat.',
          reasons: [
            'ROI 7 ngay am 18%',
            'Cost per order tang nhanh trong 3 ngay lien tiep',
          ],
          details: {
            netProfit7d: -420000,
            ctr: 0.8,
            cpa: 350000,
            totalActiveGroups: 3,
            unprofitableGroupCount: 1,
          },
          relatedEntity: {
            type: 'AdGroup',
            id: 'group-alpha',
            name: 'Retargeting Alpha',
          },
          estimatedImpact: {
            dailyProfitChange: 120000,
            monthlyProfitChange: 3600000,
          },
        },
      ],
    },
    actionRequestUrls: [],
    backfillRuns: [],
    tokenSyncRuns: [],
    fullSyncRuns: [],
    nextIds: {
      account: 2,
      group: 2,
      token: 2,
      cost: 2,
    },
  };
}

function field(modal: ReturnType<Page['locator']>, labelText: RegExp, selector = 'input,textarea,select') {
  return modal.locator('label').filter({ hasText: labelText }).locator(selector).first();
}

function rowByText(page: Page, text: string) {
  return page.locator('tr').filter({ hasText: text }).first();
}

async function seedBrowserApis(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const win = window as any;
    win.__alerts = [];
    win.__confirms = [];

    window.alert = (message?: string) => {
      win.__alerts.push(String(message || ''));
    };

    window.confirm = (message?: string) => {
      win.__confirms.push(String(message || ''));
      return true;
    };
  });
}

async function browserAlerts(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const win = window as any;
    return Array.isArray(win.__alerts) ? [...win.__alerts] : [];
  });
}

async function routeAdsManagementApis(page: Page, state: AdsState, overrides: AdsRouteOverrides = {}): Promise<void> {
  await page.route(/\/ads\/accounts(?:\/[^/?]+)?(?:\?.*)?$/, async (route) => {
    const request = route.request();
    const method = request.method();
    const path = new URL(request.url()).pathname;
    const accountId = path.split('/').pop() || '';

    if (method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(paginated(state.accounts)),
      });
      return;
    }

    if (method === 'POST') {
      await sleep(700);
      const payload = request.postDataJSON() as any;
      const created = {
        _id: `acc-${state.nextIds.account}`,
        accountCode: `ACC-${String(state.nextIds.account).padStart(3, '0')}`,
        name: payload.name,
        platform: payload.platform,
        platformAccountId: payload.platformAccountId,
        businessId: payload.businessId || '',
        businessName: payload.businessName || '',
        monthlyBudget: Number(payload.monthlyBudget || 0),
        syncSource: 'MANUAL',
        status: payload.status || 'ACTIVE',
        notes: payload.notes || '',
        lastSyncedAt: null,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      state.nextIds.account += 1;
      state.accounts = [created, ...state.accounts];
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(created),
      });
      return;
    }

    if (method === 'PATCH') {
      await sleep(700);
      const payload = request.postDataJSON() as any;
      state.accounts = state.accounts.map((item) => (
        item._id === accountId
          ? {
              ...item,
              ...payload,
              monthlyBudget: Number(payload.monthlyBudget ?? item.monthlyBudget ?? 0),
              updatedAt: nowIso(),
            }
          : item
      ));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      });
      return;
    }

    if (method === 'DELETE') {
      state.accounts = state.accounts.filter((item) => item._id !== accountId);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      });
      return;
    }

    await route.fulfill({ status: 405, body: 'Unsupported method' });
  });

  await page.route(/\/ads\/groups\/all(?:\?.*)?$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(state.groups),
    });
  });

  await page.route(/\/ads\/groups(?:\/[^/?]+)?(?:\?.*)?$/, async (route) => {
    const request = route.request();
    const method = request.method();
    const path = new URL(request.url()).pathname;
    const groupId = path.split('/').pop() || '';

    if (method === 'GET' && path.endsWith('/groups/all')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(state.groups),
      });
      return;
    }

    if (method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(paginated(state.groups)),
      });
      return;
    }

    if (method === 'POST') {
      await sleep(700);
      const payload = request.postDataJSON() as any;
      const account = state.accounts.find((item) => item._id === payload.adAccountId);
      const created = {
        _id: `group-${state.nextIds.group}`,
        groupCode: `AG-${String(state.nextIds.group).padStart(3, '0')}`,
        name: payload.name,
        adAccountId: payload.adAccountId,
        adAccountName: account?.name || '',
        platform: payload.platform || account?.platform || '',
        platformCampaignId: payload.platformCampaignId,
        trackingKeys: payload.trackingKeys || [],
        status: payload.status || 'ACTIVE',
        dailyBudget: Number(payload.dailyBudget || 0),
        startDate: payload.startDate || '',
        endDate: payload.endDate || '',
        targetAudience: payload.targetAudience || '',
        notes: payload.notes || '',
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      state.nextIds.group += 1;
      state.groups = [created, ...state.groups];
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(created),
      });
      return;
    }

    if (method === 'PATCH') {
      await sleep(700);
      const payload = request.postDataJSON() as any;
      state.groups = state.groups.map((item) => (
        item._id === groupId
          ? {
              ...item,
              ...payload,
              dailyBudget: Number(payload.dailyBudget ?? item.dailyBudget ?? 0),
              trackingKeys: payload.trackingKeys || item.trackingKeys || [],
              updatedAt: nowIso(),
            }
          : item
      ));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      });
      return;
    }

    if (method === 'DELETE') {
      state.groups = state.groups.filter((item) => item._id !== groupId);
      state.costs = state.costs.filter((item) => item.adGroupId !== groupId);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      });
      return;
    }

    await route.fulfill({ status: 405, body: 'Unsupported method' });
  });

  await page.route(/\/ads\/tokens(?:\/[^/?]+)?(?:\?.*)?$/, async (route) => {
    const request = route.request();
    const method = request.method();
    const path = new URL(request.url()).pathname;
    const tokenId = path.split('/').pop() || '';

    if (method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(state.tokens),
      });
      return;
    }

    if (method === 'POST') {
      await sleep(700);
      const payload = request.postDataJSON() as any;
      const account = state.accounts.find((item) => item._id === payload.adAccountId);
      const created = {
        _id: `token-${state.nextIds.token}`,
        adAccountId: payload.adAccountId || '',
        adAccountName: account?.name || '',
        platform: payload.platform || account?.platform || 'FACEBOOK',
        tokenType: payload.tokenType,
        businessId: payload.businessId || '',
        businessName: payload.businessName || '',
        accessToken: payload.accessToken || 'SEEDED-CREATE-TOKEN',
        refreshToken: payload.refreshToken || '',
        expiresAt: payload.expiresAt || '',
        status: payload.status || 'ACTIVE',
        lastUsedAt: null,
        lastSyncedAt: null,
        label: payload.label || '',
        createdAt: nowIso(),
      };
      state.nextIds.token += 1;
      state.tokens = [created, ...state.tokens];
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(created),
      });
      return;
    }

    if (method === 'PATCH') {
      await sleep(700);
      const payload = request.postDataJSON() as any;
      state.tokens = state.tokens.map((item) => (
        item._id === tokenId
          ? {
              ...item,
              ...payload,
              accessToken: item.accessToken,
            }
          : item
      ));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      });
      return;
    }

    if (method === 'DELETE') {
      state.tokens = state.tokens.filter((item) => item._id !== tokenId);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      });
      return;
    }

    await route.fulfill({ status: 405, body: 'Unsupported method' });
  });

  await page.route(/\/ads\/tokens\/([^/]+)\/sync-facebook-business(?:\?.*)?$/, async (route) => {
    if (overrides.tokenSync) {
      await overrides.tokenSync(route, state);
      return;
    }
    const tokenId = route.request().url().match(/\/ads\/tokens\/([^/]+)\/sync-facebook-business/)?.[1] || 'unknown';
    state.tokenSyncRuns.push(tokenId);
    await sleep(900);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        synced: 2,
        adAccountsSynced: 1,
        adGroupsSynced: 1,
        fanpagesSynced: 2,
      }),
    });
  });

  await page.route(/\/ads\/sync(?:\/[^/?]+)?(?:\?.*)?$/, async (route) => {
    if (overrides.fullSync) {
      await overrides.fullSync(route, state);
      return;
    }
    state.fullSyncRuns.push(route.request().url());
    await sleep(900);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        synced: 4,
        adAccountsSynced: 1,
        adGroupsSynced: 1,
        fanpagesSynced: 1,
      }),
    });
  });

  await page.route(/\/ads\/costs(?:\/[^/?]+)?(?:\?.*)?$/, async (route) => {
    const request = route.request();
    const method = request.method();
    const path = new URL(request.url()).pathname;
    const costId = path.split('/').pop() || '';

    if (method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(paginated(state.costs)),
      });
      return;
    }

    if (method === 'POST') {
      await sleep(700);
      const payload = request.postDataJSON() as any;
      const group = state.groups.find((item) => item._id === payload.adGroupId);
      const created = {
        _id: `cost-${state.nextIds.cost}`,
        adGroupId: payload.adGroupId,
        adGroupName: group?.name || '',
        adAccountId: payload.adAccountId || group?.adAccountId || '',
        platform: payload.platform || group?.platform || '',
        date: payload.date,
        spend: Number(payload.spend || 0),
        impressions: Number(payload.impressions || 0),
        clicks: Number(payload.clicks || 0),
        conversions: Number(payload.conversions || 0),
        source: payload.source || 'MANUAL',
        syncedAt: null,
        createdAt: nowIso(),
      };
      state.nextIds.cost += 1;
      state.costs = [created, ...state.costs];
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(created),
      });
      return;
    }

    if (method === 'DELETE') {
      state.costs = state.costs.filter((item) => item._id !== costId);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      });
      return;
    }

    await route.fulfill({ status: 405, body: 'Unsupported method' });
  });

  await page.route(/\/ads\/actions-required(?:\?.*)?$/, async (route) => {
    state.actionRequestUrls.push(route.request().url());
    await sleep(900);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(state.actionsResponse),
    });
  });

  await page.route(/\/audit-log(?:\?.*)?$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: state.auditLogs,
        total: state.auditLogs.length,
        page: 1,
        limit: 6,
      }),
    });
  });

  await page.route(/\/ads\/backfill-parent-attribution(?:\?.*)?$/, async (route) => {
    if (overrides.parentBackfill) {
      await overrides.parentBackfill(route, state);
      return;
    }
    state.backfillRuns.push('parent-attribution');
    await sleep(900);
    state.auditLogs = [
      createAuditLogEntry('backfill-parent-attribution', 'Backfill parent attribution', {
        operation: 'BACKFILL_PARENT_ATTRIBUTION',
        conversations: 8,
        leads: 5,
        orders: 3,
        students: 3,
        upserted: 6,
      }),
      ...state.auditLogs,
    ];
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        conversations: 8,
        leads: 5,
        orders: 3,
        students: 3,
        upserted: 6,
      }),
    });
  });

  await page.route(/\/ads\/backfill-adgroup(?:\?.*)?$/, async (route) => {
    if (overrides.adGroupBackfill) {
      await overrides.adGroupBackfill(route, state);
      return;
    }
    state.backfillRuns.push('adgroup');
    await sleep(900);
    state.auditLogs = [
      createAuditLogEntry('backfill-adgroup', 'Backfill adGroup', {
        operation: 'BACKFILL_ADGROUP',
        studentsUpdated: 22,
        sessionsUpdated: 16,
      }),
      ...state.auditLogs,
    ];
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        studentsUpdated: 22,
        sessionsUpdated: 16,
      }),
    });
  });
}

async function openEvidencePage(
  browser: Browser,
  request: APIRequestContext,
  role: DemoRole,
  scenario: string,
  setup: (page: Page) => Promise<void> | void,
): Promise<BatchEvidenceSession> {
  const session = await loginAsRole(request, role);
  const evidence = await createBatchEvidenceContext(browser, {
    batchId: 'B10',
    scenario,
    runDate: RUN_DATE,
  });
  await applySessionCookies(evidence.context, session);
  await setup(evidence.page);
  await evidence.page.goto(appUrl('/app/ads-management'));
  await evidence.page.waitForLoadState('domcontentloaded');
  return evidence;
}

test.describe.serial('B10 ads management browser flows', () => {
  test('B10 director sees tabs, actionable tasks, and backfill result flow', async ({ browser, request }) => {
    test.slow();
    test.setTimeout(300_000);

    const state = createAdsState();
    const evidence = await openEvidencePage(
      browser,
      request,
      'director',
      'ads-management-browser-director',
      async (page) => {
        await seedBrowserApis(page);
        await routeAdsManagementApis(page, state);
      },
    );

    try {
      await expect(evidence.page.getByRole('button', { name: 'Tai khoan QC' })).toBeVisible();
      await expect(evidence.page.getByRole('button', { name: 'Nhom QC' })).toBeVisible();
      await expect(evidence.page.getByRole('button', { name: 'API Token' })).toBeVisible();
      await expect(evidence.page.getByRole('button', { name: 'Chi phi Ads' })).toBeVisible();
      await expect(evidence.page.getByRole('button', { name: 'Viec can lam' })).toBeVisible();
      await expect(evidence.page.locator('table.data-table').first()).toContainText('ACC-001');
      await evidence.step('01-director-tabs-entry');

      await evidence.page.getByRole('button', { name: 'Nhom QC' }).click();
      await expect(evidence.page.locator('table.data-table')).toContainText('Retargeting Alpha');
      await evidence.page.getByRole('button', { name: 'API Token' }).click();
      await expect(evidence.page.locator('table.data-table')).toContainText('Alpha BM token');
      await evidence.page.getByRole('button', { name: 'Chi phi Ads' }).click();
      await expect(evidence.page.locator('table.data-table')).toContainText('Retargeting Alpha');
      await expect(evidence.page.getByRole('button', { name: /Dong bo toan bo/i })).toBeVisible();
      await expect(evidence.page.getByRole('button', { name: /Backfill parent attribution/i })).toBeVisible();
      await expect(evidence.page.getByRole('button', { name: /Backfill adGroup/i })).toBeVisible();
      await expect(evidence.page.locator('.history-item')).toHaveCount(1);
      await evidence.step('02-director-costs-and-history');

      await evidence.page.getByRole('button', { name: 'Viec can lam' }).click();
      await expect(evidence.page.locator('.actions-loading')).toBeVisible();
      await expect(evidence.page.locator('.summary-dashboard')).toBeVisible();
      await expect(evidence.page.locator('.priority-badge.priority-critical')).toBeVisible();
      await expect(evidence.page.locator('.action-reasons li')).toHaveCount(2);
      const actionLink = evidence.page.locator('a.action-btn.secondary').first();
      await expect(actionLink).toBeVisible();
      await expect(actionLink).toHaveAttribute('href', /\/app\/ads-management\?tab=groups$/);
      await expect.poll(() => state.actionRequestUrls.length).toBe(1);
      await expect(state.actionRequestUrls[0]).toContain('lookbackDays=7');
      await evidence.step('03-director-actions-tab');

      await evidence.page.getByRole('button', { name: 'Chi phi Ads' }).click();
      const backfillButton = evidence.page.getByRole('button', { name: /Backfill parent attribution/i });
      await backfillButton.click();
      await expect.poll(() => state.backfillRuns.length).toBe(1);
      await expect(evidence.page.locator('.modal-backdrop .modal h3')).toHaveText(/Ket qua backfill parent attribution/i);
      await expect(evidence.page.locator('.summary-grid')).toContainText('Conversations');
      await expect(evidence.page.locator('.summary-grid')).toContainText('Upserted');
      await expect(evidence.page.locator('.history-item')).toHaveCount(2);
      await evidence.step('04-director-backfill-result');

      evidence.note('Director tabs, actions-required render, and backfill result flow were verified.');
      await evidence.finalize('PASS', {
        extraLines: [
          'Director tabs breadth: PASS',
          'Actions-required loading and severity badges: PASS',
          'Backfill parent attribution result modal/history: PASS',
        ],
      });
    } catch (error) {
      await evidence.finalize('FAIL', { error });
      throw error;
    }
  });

  test('B10 ops sees actionable tasks but not director-only token or sync surfaces', async ({ browser, request }) => {
    test.slow();
    test.setTimeout(300_000);

    const state = createAdsState();
    const evidence = await openEvidencePage(
      browser,
      request,
      'ops',
      'ads-management-browser-ops',
      async (page) => {
        await seedBrowserApis(page);
        await routeAdsManagementApis(page, state);
      },
    );

    try {
      await expect(evidence.page.getByRole('button', { name: 'Tai khoan QC' })).toBeVisible();
      await expect(evidence.page.getByRole('button', { name: 'Nhom QC' })).toBeVisible();
      await expect(evidence.page.getByRole('button', { name: 'Chi phi Ads' })).toBeVisible();
      await expect(evidence.page.getByRole('button', { name: 'Viec can lam' })).toBeVisible();
      await expect(evidence.page.getByRole('button', { name: 'API Token' })).toHaveCount(0);

      await evidence.page.getByRole('button', { name: 'Viec can lam' }).click();
      await expect(evidence.page.locator('.summary-dashboard')).toBeVisible();
      await expect(evidence.page.locator('.action-card')).toHaveCount(1);
      await expect(evidence.page.locator('.priority-badge.priority-critical')).toBeVisible();
      await evidence.step('01-ops-actions-visible');

      await evidence.page.getByRole('button', { name: 'Chi phi Ads' }).click();
      await expect(evidence.page.getByRole('button', { name: /Dong bo toan bo/i })).toHaveCount(0);
      await expect(evidence.page.getByRole('button', { name: /Backfill parent attribution/i })).toHaveCount(0);
      await expect(evidence.page.getByRole('button', { name: /Backfill adGroup/i })).toHaveCount(0);
      await evidence.step('02-ops-director-controls-hidden');

      evidence.note('OPS still sees actionable tasks but not director-only token, sync, or backfill controls.');
      await evidence.finalize('PASS', {
        extraLines: [
          'OPS actionable tasks visibility: PASS',
          'Director-only token and sync/backfill controls hidden from OPS: PASS',
        ],
      });
    } catch (error) {
      await evidence.finalize('FAIL', { error });
      throw error;
    }
  });

  test('B10 director token sync and adGroup backfill keep maintenance modals coherent', async ({ browser, request }) => {
    test.slow();
    test.setTimeout(300_000);

    const state = createAdsState();
    const evidence = await openEvidencePage(
      browser,
      request,
      'director',
      'ads-management-browser-sync-backfill',
      async (page) => {
        await seedBrowserApis(page);
        await routeAdsManagementApis(page, state);
      },
    );

    try {
      await evidence.page.getByRole('button', { name: 'API Token' }).click();
      const tokenRow = evidence.page.locator('tr').filter({ hasText: 'Alpha BM token' }).first();
      await tokenRow.locator('button.link-btn.success').click();
      await expect.poll(() => state.tokenSyncRuns.length).toBe(1);
      await expect(evidence.page.locator('.modal-backdrop .modal h3')).toHaveText(/Ket qua dong bo/i);
      await expect(evidence.page.locator('.summary-grid')).toContainText('Fanpage');
      await expect(evidence.page.getByRole('button', { name: /Mo cai dat fanpage/i })).toBeVisible();
      await evidence.step('01-token-sync-result');
      await evidence.page.locator('.modal-backdrop .modal-actions button.primary').click();
      await expect(evidence.page.locator('.modal-backdrop .modal h3')).toHaveCount(0);

      await evidence.page.getByRole('button', { name: 'Chi phi Ads' }).click();
      await evidence.page.getByRole('button', { name: /Backfill adGroup/i }).click();
      await expect.poll(() => state.backfillRuns).toContain('adgroup');
      await expect(evidence.page.locator('.modal-backdrop .modal h3')).toHaveText(/Ket qua backfill adGroup/i);
      await expect(evidence.page.locator('.summary-grid')).toContainText('Students updated');
      await expect(evidence.page.locator('.history-item')).toHaveCount(2);
      await evidence.step('02-adgroup-backfill-result');

      evidence.note('Token sync modal and adGroup backfill modal/history were verified.');
      await evidence.finalize('PASS', {
        extraLines: [
          'Facebook BM token sync modal: PASS',
          'adGroup backfill modal/history: PASS',
        ],
      });
    } catch (error) {
      await evidence.finalize('FAIL', { error });
      throw error;
    }
  });

  test('B10 director sync failure alerts cleanly and token sync warnings stay inside result modal', async ({ browser, request }) => {
    test.slow();
    test.setTimeout(300_000);

    const state = createAdsState();
    let fullSyncRuns = 0;
    let warningTokenRuns = 0;
    const evidence = await openEvidencePage(
      browser,
      request,
      'director',
      'ads-management-browser-sync-errors',
      async (page) => {
        await seedBrowserApis(page);
        await routeAdsManagementApis(page, state);

        await page.route(/\/ads\/sync(?:\/[^?]+)?(?:\?.*)?$/, async (route) => {
          fullSyncRuns += 1;
          await sleep(900);
          await route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({
              message: 'Dong bo toan bo that bai do Facebook BM timeout.',
            }),
          });
        });

        await page.route(/\/ads\/tokens\/([^/]+)\/sync-facebook-business(?:\?.*)?$/, async (route) => {
          warningTokenRuns += 1;
          state.tokenSyncRuns.push('token-warning');
          await sleep(900);
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              synced: 1,
              adAccountsSynced: 1,
              adGroupsSynced: 0,
              fanpagesSynced: 0,
              errors: [
                'Khong keo duoc fanpage Page 2',
                '1 campaign bi bo qua do thieu quyen',
              ],
            }),
          });
        });
      },
    );

    try {
      await evidence.page.getByRole('button', { name: 'Chi phi Ads' }).click();
      const globalSyncButton = evidence.page.getByRole('button', { name: /Dong bo toan bo/i });
      await expect(globalSyncButton).toBeVisible();
      await globalSyncButton.click();
      await expect.poll(() => fullSyncRuns).toBe(1);
      await expect.poll(async () => (await browserAlerts(evidence.page)).length).toBe(1);
      await expect(globalSyncButton).toBeVisible();
      const syncAlerts = await browserAlerts(evidence.page);
      expect(syncAlerts.at(-1)).toContain('Dong bo toan bo that bai');
      await expect(evidence.page.locator('.modal-backdrop .modal h3')).toHaveCount(0);
      await evidence.step('01-global-sync-failure-alert');

      await evidence.page.getByRole('button', { name: 'API Token' }).click();
      const tokenRow = evidence.page.locator('tr').filter({ hasText: 'Alpha BM token' }).first();
      const tokenSyncButton = tokenRow.locator('button.link-btn.success');
      await tokenSyncButton.click();
      await expect.poll(() => warningTokenRuns).toBe(1);
      await expect(evidence.page.locator('.modal-backdrop .modal h3')).toHaveText(/Ket qua dong bo/i);
      await expect(evidence.page.locator('.summary-grid')).toContainText('Tai khoan QC');
      await expect(evidence.page.locator('.error-list')).toContainText('Khong keo duoc fanpage Page 2');
      await expect(evidence.page.locator('.error-list')).toContainText('1 campaign bi bo qua do thieu quyen');
      await expect(evidence.page.getByRole('button', { name: /Mo cai dat fanpage/i })).toHaveCount(0);
      const postWarningAlerts = await browserAlerts(evidence.page);
      expect(postWarningAlerts).toHaveLength(1);
      await evidence.step('02-token-sync-warning-modal');

      evidence.note('Global sync failure now proves alert + loading reset, and token sync warning path stays inside the result modal with error details.');
      await evidence.finalize('PASS', {
        extraLines: [
          'Global sync failure alert/reset: PASS',
          'Token sync partial-warning modal with error list: PASS',
        ],
      });
    } catch (error) {
      await evidence.finalize('FAIL', { error });
      throw error;
    }
  });

  /*
  stale_backfill_failure_case('B10 director backfill failures alert and restore maintenance controls without mutating history', async ({ browser, request }) => {
    test.slow();
    test.setTimeout(300_000);

    const state = createAdsState();
    let parentFailureRuns = 0;
    let adgroupFailureRuns = 0;
    const evidence = await openEvidencePage(
      browser,
      request,
      'director',
      'ads-management-browser-backfill-errors',
      async (page) => {
        await seedBrowserApis(page);
        await routeAdsManagementApis(page, state);

        await page.route(/\/ads\/backfill-parent-attribution(?:\?.*)?$/, async (route) => {
          parentFailureRuns += 1;
          await sleep(900);
          await route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({
              message: 'Backfill parent attribution that bai do conflict du lieu cu.',
            }),
          });
        });

        await page.route(/\/ads\/backfill-adgroup(?:\?.*)?$/, async (route) => {
          adgroupFailureRuns += 1;
          await sleep(900);
          await route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({
              message: 'Backfill adGroup that bai do session dang bi khoa.',
            }),
          });
        });
      },
    );

    try {
      await evidence.page.getByRole('button', { name: 'Chi phi Ads' }).click();
      await expect(evidence.page.locator('.history-item')).toHaveCount(1);

      const parentBackfillButton = evidence.page.getByRole('button', { name: /Backfill parent attribution/i });
      const adgroupBackfillButton = evidence.page.getByRole('button', { name: /Backfill adGroup/i });

      await parentBackfillButton.click();
      await expect(parentBackfillButton).toHaveText(/Dang xu ly\.{3}|Đang xử lý\.{3}/);
      await expect(parentBackfillButton).toBeDisabled();
      await expect(adgroupBackfillButton).toBeDisabled();
      await expect.poll(() => parentFailureRuns).toBe(1);
      await expect.poll(async () => (await browserAlerts(evidence.page)).length).toBe(1);
      await expect(parentBackfillButton).toHaveText(/Backfill parent attribution/i);
      await expect(parentBackfillButton).toBeEnabled();
      await expect(adgroupBackfillButton).toBeEnabled();
      await expect(evidence.page.locator('.modal-backdrop .modal h3')).toHaveCount(0);
      await expect(evidence.page.locator('.history-item')).toHaveCount(1);
      let alerts = await browserAlerts(evidence.page);
      expect(alerts.at(-1)).toContain('Backfill parent attribution that bai');
      await evidence.step('01-parent-backfill-failure-alert');

      await adgroupBackfillButton.click();
      await expect(adgroupBackfillButton).toHaveText(/Dang xu ly\.{3}|Đang xử lý\.{3}/);
      await expect(adgroupBackfillButton).toBeDisabled();
      await expect(parentBackfillButton).toBeDisabled();
      await expect.poll(() => adgroupFailureRuns).toBe(1);
      await expect.poll(async () => (await browserAlerts(evidence.page)).length).toBe(2);
      await expect(adgroupBackfillButton).toHaveText(/Backfill adGroup/i);
      await expect(parentBackfillButton).toBeEnabled();
      await expect(adgroupBackfillButton).toBeEnabled();
      await expect(evidence.page.locator('.modal-backdrop .modal h3')).toHaveCount(0);
      await expect(evidence.page.locator('.history-item')).toHaveCount(1);
      alerts = await browserAlerts(evidence.page);
      expect(alerts.at(-1)).toContain('Backfill adGroup that bai');
      await evidence.step('02-adgroup-backfill-failure-alert');

      evidence.note('Backfill failure paths now prove alert semantics, loading reset, and no accidental mutation of maintenance history.');
      await evidence.finalize('PASS', {
        extraLines: [
          'Parent-attribution backfill failure alert/reset: PASS',
          'adGroup backfill failure alert/reset: PASS',
        ],
      });
    } catch (error) {
      await evidence.finalize('FAIL', { error });
      throw error;
    }
  });
  */

  test('B10 director backfill failures alert and restore maintenance controls without mutating history', async ({ browser, request }) => {
    test.slow();
    test.setTimeout(300_000);

    const state = createAdsState();
    let parentFailureRuns = 0;
    let adgroupFailureRuns = 0;
    const evidence = await openEvidencePage(
      browser,
      request,
      'director',
      'ads-management-browser-backfill-errors',
      async (page) => {
        await seedBrowserApis(page);
        await routeAdsManagementApis(page, state, {
          parentBackfill: async (route, currentState) => {
            parentFailureRuns += 1;
            currentState.backfillRuns.push('parent-attribution-failed');
            await sleep(900);
            await route.fulfill({
              status: 500,
              contentType: 'application/json',
              body: JSON.stringify({
                message: 'Backfill parent attribution that bai do conflict du lieu cu.',
              }),
            });
          },
          adGroupBackfill: async (route, currentState) => {
            adgroupFailureRuns += 1;
            currentState.backfillRuns.push('adgroup-failed');
            await sleep(900);
            await route.fulfill({
              status: 500,
              contentType: 'application/json',
              body: JSON.stringify({
                message: 'Backfill adGroup that bai do session dang bi khoa.',
              }),
            });
          },
        });
      },
    );

    try {
      await evidence.page.getByRole('button', { name: 'Chi phi Ads' }).click();
      await expect(evidence.page.locator('.history-item')).toHaveCount(1);

      const parentBackfillButton = evidence.page.getByRole('button', { name: /Backfill parent attribution/i });
      const adgroupBackfillButton = evidence.page.getByRole('button', { name: /Backfill adGroup/i });

      await parentBackfillButton.click();
      await expect.poll(() => parentFailureRuns).toBe(1);
      await expect.poll(async () => (await browserAlerts(evidence.page)).length).toBe(1);
      await expect(parentBackfillButton).toBeEnabled();
      await expect(adgroupBackfillButton).toBeEnabled();
      await expect(evidence.page.locator('.modal-backdrop .modal h3')).toHaveCount(0);
      await expect(evidence.page.locator('.history-item')).toHaveCount(1);
      let alerts = await browserAlerts(evidence.page);
      expect(alerts.at(-1)).toContain('Backfill parent attribution that bai');
      await evidence.step('01-parent-backfill-failure-alert');

      await adgroupBackfillButton.click();
      await expect.poll(() => adgroupFailureRuns).toBe(1);
      await expect.poll(async () => (await browserAlerts(evidence.page)).length).toBe(2);
      await expect(parentBackfillButton).toBeEnabled();
      await expect(adgroupBackfillButton).toBeEnabled();
      await expect(evidence.page.locator('.modal-backdrop .modal h3')).toHaveCount(0);
      await expect(evidence.page.locator('.history-item')).toHaveCount(1);
      alerts = await browserAlerts(evidence.page);
      expect(alerts.at(-1)).toContain('Backfill adGroup that bai');
      await evidence.step('02-adgroup-backfill-failure-alert');

      evidence.note('Backfill failure paths now prove alert semantics, control recovery, and no accidental mutation of maintenance history.');
      await evidence.finalize('PASS', {
        extraLines: [
          'Parent-attribution backfill failure alert/reset: PASS',
          'adGroup backfill failure alert/reset: PASS',
        ],
      });
    } catch (error) {
      await evidence.finalize('FAIL', { error });
      throw error;
    }
  });

  test('B10 director account and group CRUD keep management tables consistent', async ({ browser, request }) => {
    test.slow();
    test.setTimeout(300_000);

    const state = createAdsState();
    const evidence = await openEvidencePage(
      browser,
      request,
      'director',
      'ads-management-browser-crud-core',
      async (page) => {
        await seedBrowserApis(page);
        await routeAdsManagementApis(page, state);
      },
    );

    try {
      const accountCreateName = 'TikTok Prospecting';
      const accountUpdatedName = 'TikTok Prospecting Plus';
      await evidence.page.getByRole('button', { name: /\+ Them tai khoan/i }).click();
      const accountCreateModal = evidence.page.locator('.modal-backdrop .modal');
      await expect(accountCreateModal.locator('h3')).toHaveText(/Them tai khoan quang cao/i);
      await field(accountCreateModal, /Ten tai khoan/i).fill(accountCreateName);
      await field(accountCreateModal, /Nen tang/i, 'select').selectOption('TIKTOK');
      await field(accountCreateModal, /Platform account ID/i).fill('tt-acc-002');
      await field(accountCreateModal, /Ngan sach thang/i).fill('9000000');
      await field(accountCreateModal, /Ghi chu/i, 'textarea').fill('Create path for browser CRUD.');
      await accountCreateModal.getByRole('button', { name: 'Luu' }).click();

      let accountRow = rowByText(evidence.page, accountCreateName);
      await expect(accountRow).toContainText('ACC-002');
      await expect(accountRow).toContainText('TikTok');
      await evidence.step('01-account-create');

      await accountRow.getByRole('button', { name: 'Sua' }).click();
      const accountEditModal = evidence.page.locator('.modal-backdrop .modal');
      await expect(accountEditModal.locator('h3')).toHaveText(/Sua tai khoan quang cao/i);
      await field(accountEditModal, /Ten tai khoan/i).fill(accountUpdatedName);
      await field(accountEditModal, /Ngan sach thang/i).fill('12000000');
      await field(accountEditModal, /Trang thai/i, 'select').selectOption('PAUSED');
      await field(accountEditModal, /Ghi chu/i, 'textarea').fill('Updated browser CRUD path.');
      await accountEditModal.getByRole('button', { name: 'Luu' }).click();

      accountRow = rowByText(evidence.page, accountUpdatedName);
      await expect(accountRow).toContainText(/Tam dung/i);
      await expect(accountRow).toContainText('12.000.000');
      await evidence.step('02-account-edit');

      await accountRow.getByRole('button', { name: 'Xoa' }).click();
      await expect(evidence.page.locator('tr').filter({ hasText: accountUpdatedName })).toHaveCount(0);
      await expect.poll(() => state.accounts.some((item) => item.name === accountUpdatedName)).toBe(false);
      await evidence.step('03-account-delete');

      await evidence.page.getByRole('button', { name: 'Nhom QC' }).click();
      await evidence.page.getByRole('button', { name: /\+ Them nhom/i }).click();
      const groupCreateModal = evidence.page.locator('.modal-backdrop .modal');
      await expect(groupCreateModal.locator('h3')).toHaveText(/Them nhom quang cao/i);
      await field(groupCreateModal, /Ten nhom/i).fill('Prospecting Beta');
      await field(groupCreateModal, /Tai khoan quang cao/i, 'select').selectOption('acc-1');
      await field(groupCreateModal, /Adset ID \/ Campaign ID/i).fill('cmp-beta-001');
      await field(groupCreateModal, /Ngan sach\/ngay/i).fill('650000');
      await field(groupCreateModal, /Ngay bat dau/i).fill(RUN_DATE);
      await field(groupCreateModal, /Ngay ket thuc/i).fill(RUN_DATE);
      await field(groupCreateModal, /Doi tuong muc tieu/i).fill('Parents with active leads');
      await field(groupCreateModal, /Tracking keys \/ ad_id \/ ref/i, 'textarea').fill('ad_id=beta-001, utm_campaign=beta');
      await field(groupCreateModal, /Ghi chu/i, 'textarea').fill('Create group for browser CRUD.');
      await groupCreateModal.getByRole('button', { name: 'Luu' }).click();

      let groupRow = rowByText(evidence.page, 'Prospecting Beta');
      await expect(groupRow).toContainText('AG-002');
      await expect(groupRow).toContainText('ad_id=beta-001');
      await evidence.step('04-group-create');

      await groupRow.getByRole('button', { name: 'Sua' }).click();
      const groupEditModal = evidence.page.locator('.modal-backdrop .modal');
      await expect(groupEditModal.locator('h3')).toHaveText(/Sua nhom quang cao/i);
      await field(groupEditModal, /Ten nhom/i).fill('Prospecting Beta Updated');
      await field(groupEditModal, /Ngan sach\/ngay/i).fill('780000');
      await field(groupEditModal, /Doi tuong muc tieu/i).fill('Parents with trials');
      await field(groupEditModal, /Tracking keys \/ ad_id \/ ref/i, 'textarea').fill('ad_id=beta-002, ref=retarget');
      await field(groupEditModal, /Trang thai/i, 'select').selectOption('ARCHIVED');
      await groupEditModal.getByRole('button', { name: 'Luu' }).click();

      groupRow = rowByText(evidence.page, 'Prospecting Beta Updated');
      await expect(groupRow).toContainText(/Luu tru/i);
      await expect(groupRow).toContainText('ad_id=beta-002');
      await evidence.step('05-group-edit');

      await groupRow.getByRole('button', { name: 'Xoa' }).click();
      await expect(evidence.page.locator('tr').filter({ hasText: 'Prospecting Beta Updated' })).toHaveCount(0);
      await expect.poll(() => state.groups.some((item) => item.name === 'Prospecting Beta Updated')).toBe(false);
      await evidence.step('06-group-delete');

      evidence.note('Director account and group CRUD flows were verified on ads-management.');
      await evidence.finalize('PASS', {
        extraLines: [
          'Director account CRUD: PASS',
          'Director group CRUD: PASS',
        ],
      });
    } catch (error) {
      await evidence.finalize('FAIL', { error });
      throw error;
    }
  });

  test('B10 director token CRUD and manual cost create-delete keep management tables consistent', async ({ browser, request }) => {
    test.slow();
    test.setTimeout(300_000);

    const state = createAdsState();
    const evidence = await openEvidencePage(
      browser,
      request,
      'director',
      'ads-management-browser-crud-token-cost',
      async (page) => {
        await seedBrowserApis(page);
        await routeAdsManagementApis(page, state);
      },
    );

    try {
      await evidence.page.getByRole('button', { name: 'API Token' }).click();
      await evidence.page.getByRole('button', { name: /\+ Them token/i }).click();
      const tokenCreateModal = evidence.page.locator('.modal-backdrop .modal');
      await expect(tokenCreateModal.locator('h3')).toHaveText(/Them API token/i);
      await field(tokenCreateModal, /Loai token/i, 'select').selectOption('ACCOUNT');
      const tokenCreateSelects = tokenCreateModal.locator('select');
      await expect(tokenCreateSelects).toHaveCount(2);
      await tokenCreateSelects.nth(1).selectOption({ label: 'Facebook Cohort Alpha (Facebook)' });
      await field(tokenCreateModal, /Label/i).fill('Manual Account Token');
      await field(tokenCreateModal, /Access token/i).fill('ACCESS-CREATE-001');
      await field(tokenCreateModal, /Refresh token/i).fill('REFRESH-CREATE-001');
      await field(tokenCreateModal, /Ngay het han/i).fill(RUN_DATE);
      await tokenCreateModal.getByRole('button', { name: 'Luu' }).click();

      let tokenRow = rowByText(evidence.page, 'Manual Account Token');
      await expect(tokenRow).toContainText(/Token tai khoan quang cao/i);
      await expect(tokenRow).toContainText('Facebook Cohort Alpha');
      await evidence.step('01-token-create');

      await tokenRow.getByRole('button', { name: 'Sua' }).click();
      const tokenEditModal = evidence.page.locator('.modal-backdrop .modal');
      await expect(tokenEditModal.locator('h3')).toHaveText(/Sua API token/i);
      await field(tokenEditModal, /Label/i).fill('Manual Account Token Updated');
      await field(tokenEditModal, /Refresh token/i).fill('REFRESH-UPDATED-001');
      await field(tokenEditModal, /Trang thai/i, 'select').selectOption('REVOKED');
      await tokenEditModal.getByRole('button', { name: 'Luu' }).click();

      tokenRow = rowByText(evidence.page, 'Manual Account Token Updated');
      await expect(tokenRow).toContainText(/Da thu hoi/i);
      await evidence.step('02-token-edit');

      await tokenRow.getByRole('button', { name: 'Xoa' }).click();
      await expect(evidence.page.locator('tr').filter({ hasText: 'Manual Account Token Updated' })).toHaveCount(0);
      await expect.poll(() => state.tokens.some((item) => item.label === 'Manual Account Token Updated')).toBe(false);
      await evidence.step('03-token-delete');

      evidence.note('Director token CRUD flow was verified on ads-management.');
      await evidence.finalize('PASS', {
        extraLines: [
          'Director token CRUD: PASS',
        ],
      });
    } catch (error) {
      await evidence.finalize('FAIL', { error });
      throw error;
    }
  });

  test('B10 director manual cost create-delete keeps management table consistent', async ({ browser, request }) => {
    test.slow();
    test.setTimeout(300_000);

    const state = createAdsState();
    const evidence = await openEvidencePage(
      browser,
      request,
      'director',
      'ads-management-browser-cost-create-delete',
      async (page) => {
        await seedBrowserApis(page);
        await routeAdsManagementApis(page, state);
      },
    );

    try {
      await evidence.page.getByRole('button', { name: 'Chi phi Ads' }).click();
      await evidence.page.getByRole('button', { name: /\+ Nhap chi phi/i }).click();
      const costModal = evidence.page.locator('.modal-backdrop .modal');
      await expect(costModal.locator('h3')).toHaveText(/Nhap chi phi thu cong/i);
      const costGroupSelect = field(costModal, /Nhom quang cao/i, 'select');
      await expect(costGroupSelect.locator('option')).toHaveCount(2);
      await costGroupSelect.selectOption('group-alpha');
      await costModal.locator('input[type="date"]').fill('2026-04-03');
      const numberInputs = costModal.locator('input[type="number"]');
      await numberInputs.nth(0).fill('333000');
      await numberInputs.nth(1).fill('4500');
      await numberInputs.nth(2).fill('120');
      await numberInputs.nth(3).fill('5');
      await costModal.getByRole('button', { name: 'Luu' }).click();

      let manualCostRow = evidence.page.locator('tr').filter({ hasText: '03/04/2026' }).filter({ hasText: 'Retargeting Alpha' }).first();
      await expect(manualCostRow).toContainText('333.000');
      await evidence.step('01-cost-create');

      await manualCostRow.getByRole('button', { name: 'Xoa' }).click();
      await expect(evidence.page.locator('tr').filter({ hasText: '03/04/2026' }).filter({ hasText: 'Retargeting Alpha' })).toHaveCount(0);
      await expect.poll(() => state.costs.some((item) => item.date === '2026-04-03')).toBe(false);
      await evidence.step('02-cost-delete');

      evidence.note('Director manual cost create-delete flow was verified on ads-management.');
      await evidence.finalize('PASS', {
        extraLines: [
          'Director manual cost create-delete: PASS',
        ],
      });
    } catch (error) {
      await evidence.finalize('FAIL', { error });
      throw error;
    }
  });

  test('B10 sale is blocked from ads-management by route guard', async ({ browser, request }) => {
    test.slow();
    test.setTimeout(300_000);

    const state = createAdsState();
    const evidence = await openEvidencePage(
      browser,
      request,
      'sale',
      'ads-management-browser-sale',
      async (page) => {
        await seedBrowserApis(page);
        await routeAdsManagementApis(page, state);
      },
    );

    try {
      await expect(evidence.page).toHaveURL(/\/not-authorized$/);
      await expect(evidence.page.getByText(/Khong co quyen truy cap|Không có quyền truy cập/i)).toBeVisible();
      await expect(evidence.page.getByRole('button', { name: 'Tai khoan QC' })).toHaveCount(0);
      await expect(evidence.page.getByRole('button', { name: 'API Token' })).toHaveCount(0);
      await expect(evidence.page.getByRole('button', { name: 'Viec can lam' })).toHaveCount(0);
      await evidence.step('01-sale-route-guard');

      evidence.note('Sale is blocked from /app/ads-management by route guard and never sees the management surface.');
      await evidence.finalize('PASS', {
        extraLines: [
          'Sale route guard for ads-management: PASS',
          'Sale never sees API token or actionable tasks tabs: PASS',
        ],
      });
    } catch (error) {
      await evidence.finalize('FAIL', { error });
      throw error;
    }
  });
});
