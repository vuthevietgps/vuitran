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

type AnalyticsSeedRow = {
  _filterDate: string;
  adGroupId: string;
  adGroupName: string;
  platform: string;
  totalSpend: number;
  totalImpressions: number;
  totalClicks: number;
  totalConversions: number;
  leadCount: number;
  orderCount: number;
  revenue: number;
  costPerLead: number | null;
  costPerOrder: number | null;
  netProfit: number;
  roi: number;
};

type AnalyticsState = {
  groups: any[];
  analyticsRows: AnalyticsSeedRow[];
  realizedRows: any[];
  parentProfitRows: any[];
  captured: {
    analytics: URL[];
    realized: URL[];
    parents: URL[];
    suggestions: URL[];
  };
};

function appUrl(path: string): string {
  return new URL(path, APP_BASE_URL).toString();
}

function nowIso(): string {
  return new Date().toISOString();
}

function toDateOnly(value?: string | null): string {
  if (!value) return '';
  return new Date(value).toISOString().slice(0, 10);
}

function inDateRange(value: string, startDate: string | null, endDate: string | null): boolean {
  if (startDate && value < startDate) return false;
  if (endDate && value > endDate) return false;
  return true;
}

function createAnalyticsState(): AnalyticsState {
  return {
    groups: [
      {
        _id: 'group-alpha',
        groupCode: 'AG-ALPHA',
        name: 'Alpha Social',
        adAccountId: 'acc-1',
        platform: 'FACEBOOK',
        platformCampaignId: 'cmp-alpha',
        status: 'ACTIVE',
        createdAt: nowIso(),
        updatedAt: nowIso(),
      },
      {
        _id: 'group-bravo',
        groupCode: 'AG-BRAVO',
        name: 'Bravo Search',
        adAccountId: 'acc-2',
        platform: 'GOOGLE',
        platformCampaignId: 'cmp-bravo',
        status: 'ACTIVE',
        createdAt: nowIso(),
        updatedAt: nowIso(),
      },
      {
        _id: 'group-charlie',
        groupCode: 'AG-CHARLIE',
        name: 'Charlie Retargeting',
        adAccountId: 'acc-3',
        platform: 'TIKTOK',
        platformCampaignId: 'cmp-charlie',
        status: 'ACTIVE',
        createdAt: nowIso(),
        updatedAt: nowIso(),
      },
    ],
    analyticsRows: [
      {
        _filterDate: '2026-04-02',
        adGroupId: 'group-alpha',
        adGroupName: 'Alpha Social',
        platform: 'FACEBOOK',
        totalSpend: 1_200_000,
        totalImpressions: 52_000,
        totalClicks: 1_300,
        totalConversions: 42,
        leadCount: 30,
        orderCount: 10,
        revenue: 7_200_000,
        costPerLead: 40_000,
        costPerOrder: 120_000,
        netProfit: 3_800_000,
        roi: 180,
      },
      {
        _filterDate: '2026-03-18',
        adGroupId: 'group-bravo',
        adGroupName: 'Bravo Search',
        platform: 'GOOGLE',
        totalSpend: 3_100_000,
        totalImpressions: 76_000,
        totalClicks: 2_400,
        totalConversions: 95,
        leadCount: 55,
        orderCount: 18,
        revenue: 8_900_000,
        costPerLead: 56_364,
        costPerOrder: 172_222,
        netProfit: 1_400_000,
        roi: 45,
      },
      {
        _filterDate: '2026-03-25',
        adGroupId: 'group-charlie',
        adGroupName: 'Charlie Retargeting',
        platform: 'TIKTOK',
        totalSpend: 2_400_000,
        totalImpressions: 48_000,
        totalClicks: 900,
        totalConversions: 27,
        leadCount: 20,
        orderCount: 4,
        revenue: 2_100_000,
        costPerLead: 120_000,
        costPerOrder: 600_000,
        netProfit: -300_000,
        roi: -12,
      },
    ],
    realizedRows: [
      {
        date: '2026-04-02',
        realizedThrough: '2026-04-10',
        maturityDays: 60,
        cohortAgeDays: 62,
        isMatured: true,
        adGroupId: 'group-alpha',
        adGroupName: 'Alpha Social',
        platform: 'FACEBOOK',
        impressions: 52_000,
        clicks: 1_300,
        conversions: 42,
        ctr: 2.5,
        cpc: 923,
        cpm: 23_077,
        costPerConversion: 28_571,
        leadCount: 30,
        orderCount: 10,
        newParentCount: 8,
        realizedParentCount: 7,
        realizedSessionCount: 30,
        adSpend: 1_200_000,
        collectedRevenue: 7_200_000,
        remainingSessionUnits: 28,
        scheduledRemainingSessionCount: 7,
        scheduledRemainingTeacherCost: 950_000,
        realizedRevenue: 6_000_000,
        refundAmount: 80_000,
        netRealizedRevenue: 5_920_000,
        estimatedRemainingRefund: 50_000,
        estimatedRemainingTeacherCost: 180_000,
        estimatedRemainingOtherCost: 90_000,
        projectedRevenue: 6_600_000,
        projectedNetProfit: 4_000_000,
        effectiveNetProfit: 3_800_000,
        projectionBasis: 'REALIZED_PLUS_PROJECTED',
        teacherCost: 950_000,
        directParentExpense: 120_000,
        allocatedGroupExpense: 200_000,
        allocatedGlobalOverhead: 100_000,
        netProfit: 3_800_000,
        roi: 180,
        costPerLead: 40_000,
        costPerNewParent: 150_000,
        profitPerLead: 126_667,
        profitPerNewParent: 475_000,
      },
      {
        date: '2026-03-18',
        realizedThrough: '2026-04-10',
        maturityDays: 45,
        cohortAgeDays: 23,
        isMatured: false,
        adGroupId: 'group-bravo',
        adGroupName: 'Bravo Search',
        platform: 'GOOGLE',
        impressions: 76_000,
        clicks: 2_400,
        conversions: 95,
        ctr: 3.1,
        cpc: 1_292,
        cpm: 40_789,
        costPerConversion: 32_632,
        leadCount: 55,
        orderCount: 18,
        newParentCount: 14,
        realizedParentCount: 11,
        realizedSessionCount: 44,
        adSpend: 3_100_000,
        collectedRevenue: 8_900_000,
        remainingSessionUnits: 36,
        scheduledRemainingSessionCount: 9,
        scheduledRemainingTeacherCost: 1_400_000,
        realizedRevenue: 7_200_000,
        refundAmount: 220_000,
        netRealizedRevenue: 6_980_000,
        estimatedRemainingRefund: 175_000,
        estimatedRemainingTeacherCost: 260_000,
        estimatedRemainingOtherCost: 150_000,
        projectedRevenue: 8_050_000,
        projectedNetProfit: 1_650_000,
        effectiveNetProfit: 1_400_000,
        projectionBasis: 'REALIZED_PLUS_PROJECTED',
        teacherCost: 1_400_000,
        directParentExpense: 180_000,
        allocatedGroupExpense: 260_000,
        allocatedGlobalOverhead: 120_000,
        netProfit: 1_400_000,
        roi: 45,
        costPerLead: 56_364,
        costPerNewParent: 221_429,
        profitPerLead: 25_455,
        profitPerNewParent: 100_000,
      },
      {
        date: '2026-03-25',
        realizedThrough: '2026-04-10',
        maturityDays: 60,
        cohortAgeDays: 16,
        isMatured: false,
        adGroupId: 'group-charlie',
        adGroupName: 'Charlie Retargeting',
        platform: 'TIKTOK',
        impressions: 48_000,
        clicks: 900,
        conversions: 27,
        ctr: 1.8,
        cpc: 2_667,
        cpm: 50_000,
        costPerConversion: 88_889,
        leadCount: 20,
        orderCount: 4,
        newParentCount: 3,
        realizedParentCount: 3,
        realizedSessionCount: 12,
        adSpend: 2_400_000,
        collectedRevenue: 2_100_000,
        remainingSessionUnits: 22,
        scheduledRemainingSessionCount: 5,
        scheduledRemainingTeacherCost: 800_000,
        realizedRevenue: 1_900_000,
        refundAmount: 120_000,
        netRealizedRevenue: 1_780_000,
        estimatedRemainingRefund: 90_000,
        estimatedRemainingTeacherCost: 150_000,
        estimatedRemainingOtherCost: 80_000,
        projectedRevenue: 2_050_000,
        projectedNetProfit: -200_000,
        effectiveNetProfit: -300_000,
        projectionBasis: 'REALIZED_PLUS_PROJECTED',
        teacherCost: 800_000,
        directParentExpense: 90_000,
        allocatedGroupExpense: 140_000,
        allocatedGlobalOverhead: 80_000,
        netProfit: -300_000,
        roi: -12,
        costPerLead: 120_000,
        costPerNewParent: 800_000,
        profitPerLead: -15_000,
        profitPerNewParent: -100_000,
      },
    ],
    parentProfitRows: [
      {
        parentKey: 'parent-alpha',
        parentUserId: 'parent-user-alpha',
        parentPhone: '0901000101',
        parentName: 'Parent Alpha',
        adGroupId: 'group-alpha',
        adGroupName: 'Alpha Social',
        platform: 'FACEBOOK',
        attributedAt: '2026-04-02T09:30:00.000Z',
        sessionCount: 8,
        studentCount: 1,
        revenue: 4_600_000,
        teacherCost: 1_500_000,
        directParentExpense: 120_000,
        allocatedGroupExpense: 200_000,
        allocatedGlobalOverhead: 100_000,
        allocatedAdSpend: 650_000,
        netProfit: 2_030_000,
        netMargin: 44.1,
      },
      {
        parentKey: 'parent-bravo',
        parentUserId: 'parent-user-bravo',
        parentPhone: '0901000102',
        parentName: 'Parent Bravo',
        adGroupId: 'group-bravo',
        adGroupName: 'Bravo Search',
        platform: 'GOOGLE',
        attributedAt: '2026-03-19T11:15:00.000Z',
        sessionCount: 11,
        studentCount: 2,
        revenue: 5_400_000,
        teacherCost: 1_800_000,
        directParentExpense: 150_000,
        allocatedGroupExpense: 260_000,
        allocatedGlobalOverhead: 120_000,
        allocatedAdSpend: 950_000,
        netProfit: 2_120_000,
        netMargin: 39.3,
      },
      {
        parentKey: 'parent-charlie',
        parentUserId: 'parent-user-charlie',
        parentPhone: '0901000103',
        parentName: 'Parent Charlie',
        adGroupId: 'group-charlie',
        adGroupName: 'Charlie Retargeting',
        platform: 'TIKTOK',
        attributedAt: '2026-03-25T14:00:00.000Z',
        sessionCount: 4,
        studentCount: 1,
        revenue: 1_900_000,
        teacherCost: 850_000,
        directParentExpense: 90_000,
        allocatedGroupExpense: 140_000,
        allocatedGlobalOverhead: 80_000,
        allocatedAdSpend: 700_000,
        netProfit: 40_000,
        netMargin: 2.1,
      },
    ],
    captured: {
      analytics: [],
      realized: [],
      parents: [],
      suggestions: [],
    },
  };
}

function summarizeAnalytics(rows: AnalyticsSeedRow[]) {
  const totalSpend = rows.reduce((sum, row) => sum + row.totalSpend, 0);
  const totalLeads = rows.reduce((sum, row) => sum + row.leadCount, 0);
  const totalOrders = rows.reduce((sum, row) => sum + row.orderCount, 0);
  const totalRevenue = rows.reduce((sum, row) => sum + row.revenue, 0);
  const totalNetProfit = rows.reduce((sum, row) => sum + row.netProfit, 0);
  return {
    totalSpend,
    totalLeads,
    totalOrders,
    totalRevenue,
    totalNetProfit,
    avgCostPerLead: totalLeads ? Math.round(totalSpend / totalLeads) : 0,
    avgCostPerOrder: totalOrders ? Math.round(totalSpend / totalOrders) : 0,
    avgRoi: totalSpend ? Math.round((totalNetProfit / totalSpend) * 100) : 0,
  };
}

function buildAnalyticsResponse(url: URL, state: AnalyticsState) {
  const startDate = url.searchParams.get('startDate');
  const endDate = url.searchParams.get('endDate');
  const platform = url.searchParams.get('platform');
  const adGroupId = url.searchParams.get('adGroupId');

  const rows = state.analyticsRows
    .filter((row) => inDateRange(row._filterDate, startDate, endDate))
    .filter((row) => !platform || row.platform === platform)
    .filter((row) => !adGroupId || row.adGroupId === adGroupId)
    .map(({ _filterDate, ...row }) => row);

  return {
    rows,
    summary: summarizeAnalytics(rows as AnalyticsSeedRow[]),
  };
}

function summarizeRealized(rows: any[]) {
  return {
    totalSpend: rows.reduce((sum, row) => sum + row.adSpend, 0),
    totalImpressions: rows.reduce((sum, row) => sum + row.impressions, 0),
    totalClicks: rows.reduce((sum, row) => sum + row.clicks, 0),
    totalConversions: rows.reduce((sum, row) => sum + row.conversions, 0),
    totalLeads: rows.reduce((sum, row) => sum + row.leadCount, 0),
    totalOrders: rows.reduce((sum, row) => sum + row.orderCount, 0),
    totalNewParents: rows.reduce((sum, row) => sum + row.newParentCount, 0),
    totalCollectedRevenue: rows.reduce((sum, row) => sum + row.collectedRevenue, 0),
    totalRemainingSessionUnits: rows.reduce((sum, row) => sum + row.remainingSessionUnits, 0),
    totalRealizedParents: rows.reduce((sum, row) => sum + row.realizedParentCount, 0),
    totalRealizedSessions: rows.reduce((sum, row) => sum + row.realizedSessionCount, 0),
    totalRealizedRevenue: rows.reduce((sum, row) => sum + row.realizedRevenue, 0),
    totalRefundAmount: rows.reduce((sum, row) => sum + row.refundAmount, 0),
    totalNetRealizedRevenue: rows.reduce((sum, row) => sum + row.netRealizedRevenue, 0),
    totalProjectedRevenue: rows.reduce((sum, row) => sum + row.projectedRevenue, 0),
    totalTeacherCost: rows.reduce((sum, row) => sum + row.teacherCost, 0),
    totalDirectParentExpense: rows.reduce((sum, row) => sum + row.directParentExpense, 0),
    totalAllocatedGroupExpense: rows.reduce((sum, row) => sum + row.allocatedGroupExpense, 0),
    totalAllocatedGlobalOverhead: rows.reduce((sum, row) => sum + row.allocatedGlobalOverhead, 0),
    totalNetProfit: rows.reduce((sum, row) => sum + row.netProfit, 0),
    totalProjectedNetProfit: rows.reduce((sum, row) => sum + row.projectedNetProfit, 0),
    totalRoi: rows.length ? Number((rows.reduce((sum, row) => sum + row.roi, 0) / rows.length).toFixed(1)) : 0,
    matureRowCount: rows.filter((row) => row.isMatured).length,
    immatureRowCount: rows.filter((row) => !row.isMatured).length,
  };
}

function buildRealizedResponse(url: URL, state: AnalyticsState) {
  const startDate = url.searchParams.get('startDate');
  const endDate = url.searchParams.get('endDate');
  const platform = url.searchParams.get('platform');
  const adGroupId = url.searchParams.get('adGroupId');
  const maturityDays = Number(url.searchParams.get('maturityDays') || '60');
  const refundRatePercentXValue = url.searchParams.get('refundRatePercentX');
  const refundRatePercentX = refundRatePercentXValue === null ? null : Number(refundRatePercentXValue);

  const rows = state.realizedRows
    .filter((row) => inDateRange(row.date, startDate, endDate))
    .filter((row) => !platform || row.platform === platform)
    .filter((row) => !adGroupId || row.adGroupId === adGroupId)
    .map((row) => ({
      ...row,
      maturityDays,
    }));

  return {
    basis: 'REALIZED_PLUS_PROJECTED',
    maturityDays,
    realizedThrough: endDate || RUN_DATE,
    refundRatePercentX,
    rows,
    matureRows: rows.filter((row) => row.isMatured),
    summary: summarizeRealized(rows),
  };
}

function buildParentProfitResponse(url: URL, state: AnalyticsState) {
  const startDate = url.searchParams.get('startDate');
  const endDate = url.searchParams.get('endDate');
  const platform = url.searchParams.get('platform');
  const adGroupId = url.searchParams.get('adGroupId');

  const rows = state.parentProfitRows
    .filter((row) => inDateRange(toDateOnly(row.attributedAt), startDate, endDate))
    .filter((row) => !platform || row.platform === platform)
    .filter((row) => !adGroupId || row.adGroupId === adGroupId);

  const grouped = new Map<string, any>();
  for (const row of rows) {
    const existing = grouped.get(row.adGroupId);
    if (!existing) {
      grouped.set(row.adGroupId, {
        adGroupId: row.adGroupId,
        adGroupName: row.adGroupName,
        platform: row.platform,
        parentCount: 1,
        totalSessions: row.sessionCount,
        totalStudents: row.studentCount,
        totalRevenue: row.revenue,
        totalTeacherCost: row.teacherCost,
        totalDirectParentExpense: row.directParentExpense,
        totalAllocatedGroupExpense: row.allocatedGroupExpense,
        totalAllocatedGlobalOverhead: row.allocatedGlobalOverhead,
        totalAdSpend: row.allocatedAdSpend,
        totalNetProfit: row.netProfit,
        netMargin: row.netMargin,
      });
      continue;
    }

    existing.parentCount += 1;
    existing.totalSessions += row.sessionCount;
    existing.totalStudents += row.studentCount;
    existing.totalRevenue += row.revenue;
    existing.totalTeacherCost += row.teacherCost;
    existing.totalDirectParentExpense += row.directParentExpense;
    existing.totalAllocatedGroupExpense += row.allocatedGroupExpense;
    existing.totalAllocatedGlobalOverhead += row.allocatedGlobalOverhead;
    existing.totalAdSpend += row.allocatedAdSpend;
    existing.totalNetProfit += row.netProfit;
    existing.netMargin = Number(((existing.totalNetProfit / Math.max(existing.totalRevenue, 1)) * 100).toFixed(1));
  }

  const summaryByGroup = Array.from(grouped.values());
  const overall = {
    parentCount: rows.length,
    totalSessions: rows.reduce((sum, row) => sum + row.sessionCount, 0),
    totalStudents: rows.reduce((sum, row) => sum + row.studentCount, 0),
    totalRevenue: rows.reduce((sum, row) => sum + row.revenue, 0),
    totalTeacherCost: rows.reduce((sum, row) => sum + row.teacherCost, 0),
    totalDirectParentExpense: rows.reduce((sum, row) => sum + row.directParentExpense, 0),
    totalAllocatedGroupExpense: rows.reduce((sum, row) => sum + row.allocatedGroupExpense, 0),
    totalAllocatedGlobalOverhead: rows.reduce((sum, row) => sum + row.allocatedGlobalOverhead, 0),
    totalAdSpend: rows.reduce((sum, row) => sum + row.allocatedAdSpend, 0),
    totalNetProfit: rows.reduce((sum, row) => sum + row.netProfit, 0),
    netMargin: rows.length
      ? Number(((rows.reduce((sum, row) => sum + row.netProfit, 0) / Math.max(rows.reduce((sum, row) => sum + row.revenue, 0), 1)) * 100).toFixed(1))
      : 0,
  };

  return { rows, summaryByGroup, overall };
}

function buildSuggestionResponse(url: URL, state: AnalyticsState) {
  const maturityDays = Number(url.searchParams.get('maturityDays') || '60');
  const refundRatePercentX = Number(url.searchParams.get('refundRatePercentX') || '0');
  const totalBudget = Number(url.searchParams.get('totalBudget') || '0');
  const bravo = state.realizedRows.find((row) => row.adGroupId === 'group-bravo');
  return {
    basis: 'REALIZED_PLUS_PROJECTED',
    maturityDays,
    realizedThrough: url.searchParams.get('endDate') || RUN_DATE,
    refundRatePercentX,
    totalBudget,
    allocated: 1_800_000,
    unallocated: Math.max(totalBudget - 1_800_000, 0),
    totalSuggestedDailySpend: 1_800_000,
    expectedDailyNetProfit: 540_000,
    projectedMonthlySpend: 54_000_000,
    projectedMonthlyNetProfit: 16_200_000,
    dailySuggestedTotals: [
      {
        date: url.searchParams.get('startDate') || '2026-03-01',
        totalNetProfit: 540_000,
        totalSuggestedAdSpend: 1_800_000,
      },
    ],
    monthlyProjection: [
      {
        month: '2026-03',
        daysInMonth: 31,
        projectedSpend: 54_000_000,
        projectedNetProfit: 16_200_000,
      },
    ],
    summaryTable: [
      {
        ...bravo,
        date: bravo.date,
        actualAdSpend: bravo.adSpend,
        suggestedAdSpend: 1_800_000,
      },
    ],
    suggestions: [
      {
        adGroupId: 'group-bravo',
        adGroupName: 'Bravo Search',
        platform: 'GOOGLE',
        currentDailySpend: 1_200_000,
        suggestedDailySpend: 1_800_000,
        changePercent: 50,
        averageCtr: 3.1,
        averageLeadRate: 6.4,
        averageProfitPerLead: 25_455,
        observedAverageNetProfit: 1_400_000,
        confidence: 'HIGH',
        action: 'ADJUST_BUDGET',
        reason: 'Bravo Search dang co cohort co loi nhuan duong va co the tang ngan sach.',
      },
    ],
  };
}

async function routeAnalyticsApis(page: Page, state: AnalyticsState): Promise<void> {
  await page.route(/\/ads\/groups\/all(?:\?.*)?$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(state.groups),
    });
  });

  await page.route(/\/ads\/analytics\/realized-cohort(?:\?.*)?$/, async (route) => {
    const url = new URL(route.request().url());
    state.captured.realized.push(url);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(buildRealizedResponse(url, state)),
    });
  });

  await page.route(/\/ads\/analytics\/parents-profit(?:\?.*)?$/, async (route) => {
    const url = new URL(route.request().url());
    state.captured.parents.push(url);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(buildParentProfitResponse(url, state)),
    });
  });

  await page.route(/\/ads\/analytics(?:\?.*)?$/, async (route) => {
    const url = new URL(route.request().url());
    state.captured.analytics.push(url);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(buildAnalyticsResponse(url, state)),
    });
  });

  await page.route(/\/ads\/suggestions(?:\?.*)?$/, async (route) => {
    const url = new URL(route.request().url());
    state.captured.suggestions.push(url);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(buildSuggestionResponse(url, state)),
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
  await evidence.page.goto(appUrl('/app/ads-analytics'));
  await evidence.page.waitForLoadState('domcontentloaded');
  return evidence;
}

async function waitForCapturedRequestGrowth(counter: () => number, action: () => Promise<void>): Promise<void> {
  const before = counter();
  await action();
  await expect.poll(counter).toBe(before + 1);
}

function funnelTable(page: Page) {
  return page.locator('table.data').filter({ hasText: 'CP/Lead' }).first();
}

function platformSelect(page: Page) {
  return page.locator('section.filters select').filter({ has: page.locator('option[value="FACEBOOK"]') }).first();
}

function adGroupSelect(page: Page) {
  return page.locator('section.filters select').filter({ hasText: /Alpha Social|Bravo Search|Charlie Retargeting/ }).first();
}

test.describe.serial('B10 ads analytics browser breadth', () => {
  test('B10 ads analytics filter fan-out, sortable funnel rows, and director optimize-x keep params aligned', async ({ browser, request }) => {
    test.slow();
    test.setTimeout(300_000);

    const state = createAnalyticsState();
    const evidence = await openEvidencePage(
      browser,
      request,
      'director',
      'ads-analytics-browser-breadth',
      async (page) => {
        await routeAnalyticsApis(page, state);
      },
    );

    try {
      const overviewTable = funnelTable(evidence.page);
      await expect(overviewTable).toBeVisible();
      await expect(overviewTable.locator('tbody tr')).toHaveCount(3);

      const firstGroup = overviewTable.locator('tbody tr').nth(0).locator('td').nth(0);
      const secondGroup = overviewTable.locator('tbody tr').nth(1).locator('td').nth(0);
      const thirdGroup = overviewTable.locator('tbody tr').nth(2).locator('td').nth(0);
      await expect(firstGroup).toContainText('Bravo Search');
      await expect(secondGroup).toContainText('Charlie Retargeting');
      await expect(thirdGroup).toContainText('Alpha Social');

      await evidence.page.getByRole('columnheader', { name: /ROI %/i }).click();
      await expect(firstGroup).toContainText('Alpha Social');
      await expect(secondGroup).toContainText('Bravo Search');
      await expect(thirdGroup).toContainText('Charlie Retargeting');
      await evidence.step('01-overview-sort-desc');

      await evidence.page.getByRole('columnheader', { name: /ROI %/i }).click();
      await expect(firstGroup).toContainText('Charlie Retargeting');
      await expect(secondGroup).toContainText('Bravo Search');
      await expect(thirdGroup).toContainText('Alpha Social');
      await evidence.step('02-overview-sort-asc');

      await evidence.page.getByLabel(/Từ ngày|Tu ngay/i).fill('2026-03-01');
      await evidence.page.getByLabel(/Đến ngày|Den ngay/i).fill('2026-03-31');
      await evidence.page.getByLabel(/Số ngày chín cohort|So ngay chin cohort/i).fill('45');
      await evidence.page.getByLabel(/X refund còn lại|X refund con lai/i).fill('7.5');
      await platformSelect(evidence.page).selectOption('GOOGLE');
      await adGroupSelect(evidence.page).selectOption('group-bravo');

      await waitForCapturedRequestGrowth(
        () => state.captured.analytics.length,
        async () => {
          await evidence.page.getByRole('button', { name: /Phân tích|Phan tich/i }).click();
        },
      );
      await expect.poll(() => state.captured.realized.length).toBeGreaterThan(1);
      await expect.poll(() => state.captured.parents.length).toBeGreaterThan(1);

      const latestAnalytics = state.captured.analytics.at(-1);
      const latestRealized = state.captured.realized.at(-1);
      const latestParents = state.captured.parents.at(-1);
      expect(latestAnalytics?.searchParams.get('startDate')).toBe('2026-03-01');
      expect(latestAnalytics?.searchParams.get('endDate')).toBe('2026-03-31');
      expect(latestAnalytics?.searchParams.get('platform')).toBe('GOOGLE');
      expect(latestAnalytics?.searchParams.get('adGroupId')).toBe('group-bravo');
      expect(latestAnalytics?.searchParams.get('maturityDays')).toBeNull();
      expect(latestAnalytics?.searchParams.get('refundRatePercentX')).toBeNull();
      expect(latestParents?.searchParams.get('platform')).toBe('GOOGLE');
      expect(latestParents?.searchParams.get('adGroupId')).toBe('group-bravo');
      expect(latestRealized?.searchParams.get('platform')).toBe('GOOGLE');
      expect(latestRealized?.searchParams.get('adGroupId')).toBe('group-bravo');
      expect(latestRealized?.searchParams.get('maturityDays')).toBe('45');
      expect(latestRealized?.searchParams.get('refundRatePercentX')).toBe('7.5');

      await expect(overviewTable.locator('tbody tr')).toHaveCount(1);
      await expect(overviewTable.locator('tbody tr').first()).toContainText('Bravo Search');
      await expect(overviewTable).not.toContainText('Alpha Social');
      await expect(overviewTable).not.toContainText('Charlie Retargeting');
      await expect(evidence.page.getByText(/cohort chín sau|cohort chin sau/i)).toContainText('45');
      await expect(evidence.page.getByText(/refund phần còn lại|refund phan con lai/i).first()).toContainText('7.5');
      await evidence.step('03-filtered-overview');

      await evidence.page.getByRole('button', { name: /Profit theo PH/i }).click();
      const parentTable = evidence.page.locator('table.parent-profit-table');
      await expect(parentTable).toBeVisible();
      await expect(parentTable.locator('tbody tr')).toHaveCount(1);
      await expect(parentTable).toContainText('Parent Bravo');
      await expect(parentTable).toContainText('Bravo Search');
      await expect(parentTable).not.toContainText('Parent Alpha');
      await evidence.step('04-parent-tab-filtered');

      await evidence.page.getByRole('button', { name: /Chi phí quảng cáo tối ưu theo X|Chi phi quang cao toi uu theo X/i }).click();
      await evidence.page.getByLabel(/Tổng ngân sách hằng ngày|Tong ngan sach hang ngay/i).fill('2500000');
      await waitForCapturedRequestGrowth(
        () => state.captured.suggestions.length,
        async () => {
          await evidence.page.getByRole('button', { name: /Đề xuất phân bổ|De xuat phan bo/i }).click();
        },
      );
      const latestSuggestion = state.captured.suggestions.at(-1);
      expect(latestSuggestion?.searchParams.get('startDate')).toBe('2026-03-01');
      expect(latestSuggestion?.searchParams.get('endDate')).toBe('2026-03-31');
      expect(latestSuggestion?.searchParams.get('totalBudget')).toBe('2500000');
      expect(latestSuggestion?.searchParams.get('maturityDays')).toBe('45');
      expect(latestSuggestion?.searchParams.get('refundRatePercentX')).toBe('7.5');
      await expect(evidence.page.locator('.sug-summary')).toContainText('2,500,000');
      await expect(evidence.page.locator('.sug-summary')).toContainText('45 ngày');
      await expect(evidence.page.locator('.sug-summary')).toContainText('7.5');
      await expect(evidence.page.locator('.suggestion-section table.data').first()).toContainText('Bravo Search');
      await evidence.step('05-optimize-x-params');

      evidence.note('Ads analytics browser breadth verified for overview sort toggles, shared filter fan-out, tab carry-over, and director optimize-x parameters.');
      await evidence.finalize('PASS', {
        extraLines: [
          'Overview sort toggle: PASS',
          'Shared filter fan-out to analytics/parents/realized endpoints: PASS',
          'Filtered parent-profit carry-over: PASS',
          'Director optimize-x parameter semantics: PASS',
        ],
      });
    } catch (error) {
      await evidence.finalize('FAIL', { error });
      throw error;
    }
  });

  test('B10 ads analytics keeps overview visible for OPS while optimize-x stays director-only', async ({ browser, request }) => {
    test.slow();
    test.setTimeout(300_000);

    const state = createAnalyticsState();
    const evidence = await openEvidencePage(
      browser,
      request,
      'ops',
      'ads-analytics-browser-ops',
      async (page) => {
        await routeAnalyticsApis(page, state);
      },
    );

    try {
      const overviewTable = funnelTable(evidence.page);
      await expect(overviewTable).toBeVisible();
      await expect(overviewTable.locator('tbody tr')).toHaveCount(3);

      await evidence.page.getByRole('button', { name: /Chi phí quảng cáo tối ưu theo X|Chi phi quang cao toi uu theo X/i }).click();
      await expect(evidence.page.getByText(/Chỉ Director có quyền xem và tính đề xuất ngân sách|Chi Director co quyen xem va tinh de xuat ngan sach/i)).toBeVisible();
      await expect(evidence.page.getByRole('button', { name: /Đề xuất phân bổ|De xuat phan bo/i })).toHaveCount(0);
      await evidence.step('01-ops-optimize-guard');

      evidence.note('OPS can still access analytics overview data while optimize-x suggestions stay director-only.');
      await evidence.finalize('PASS', {
        extraLines: [
          'OPS overview analytics visibility: PASS',
          'Optimize-x director-only guard: PASS',
        ],
      });
    } catch (error) {
      await evidence.finalize('FAIL', { error });
      throw error;
    }
  });
});
