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
const APP_ORIGIN = new URL(APP_BASE_URL).origin;
const RUN_DATE = process.env['UI_EVIDENCE_DATE'] || new Date().toISOString().slice(0, 10);

const API_ORIGIN_PATTERN = 'https?://[^/]+';
const API_PREFIX_PATTERN = `${API_ORIGIN_PATTERN}(?:/api)?`;
const TEACHING_MATERIALS_API = new RegExp(`${API_PREFIX_PATTERN}/teaching-materials(?:\\?.*)?$`);
const TEACHING_MATERIALS_STATS_API = new RegExp(`${API_PREFIX_PATTERN}/teaching-materials/stats(?:\\?.*)?$`);
const CLASSES_API = new RegExp(`${API_PREFIX_PATTERN}/classes(?:\\?.*)?$`);
const ADS_GROUPS_API = /\/ads\/groups\/all(?:\?.*)?$/;
const ADS_ANALYTICS_API = /\/ads\/analytics(?:\?.*)?$/;
const ADS_REALIZED_API = /\/ads\/analytics\/realized-cohort(?:\?.*)?$/;
const ADS_PARENT_PROFIT_API = /\/ads\/analytics\/parents-profit(?:\?.*)?$/;

test.use({
  trace: 'off',
  video: 'on',
});

function appUrl(path: string): string {
  return new URL(path, APP_BASE_URL).toString();
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

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

function buildMaterialsState(): MaterialsState {
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
      bySubject: { Toan: 2, 'Tieng Anh': 1, 'Van phong': 1 },
      byGrade: { 'Lop 5': 1, 'Lop 6': 1, 'Lop 7': 1, 'Noi bo': 1 },
      totalSizeBytes: 8192,
      totalSizeMB: 0,
    },
    classes: [
      { _id: 'class-b06-001', name: 'Lop Toan 6A', code: 'CLS-6A' },
      { _id: 'class-b06-002', name: 'Lop Anh 5B', code: 'CLS-5B' },
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
};

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
    ],
    parentProfitRows: [
      {
        parentId: 'parent-alpha-1',
        parentName: 'Parent Alpha',
        studentCount: 1,
        sessionCount: 14,
        revenue: 8_200_000,
        teacherCost: 2_100_000,
        directParentExpense: 240_000,
        allocatedGroupExpense: 400_000,
        allocatedGlobalOverhead: 180_000,
        allocatedAdSpend: 1_100_000,
        netProfit: 4_180_000,
        netMargin: 51,
        adGroupId: 'group-alpha',
        adGroupName: 'Alpha Social',
        platform: 'FACEBOOK',
        attributedAt: '2026-04-02T03:00:00.000Z',
      },
      {
        parentId: 'parent-bravo-1',
        parentName: 'Parent Bravo',
        studentCount: 2,
        sessionCount: 11,
        revenue: 6_500_000,
        teacherCost: 1_900_000,
        directParentExpense: 180_000,
        allocatedGroupExpense: 320_000,
        allocatedGlobalOverhead: 140_000,
        allocatedAdSpend: 1_200_000,
        netProfit: 2_760_000,
        netMargin: 42.5,
        adGroupId: 'group-bravo',
        adGroupName: 'Bravo Search',
        platform: 'GOOGLE',
        attributedAt: '2026-03-18T04:00:00.000Z',
      },
      {
        parentId: 'parent-charlie-1',
        parentName: 'Parent Charlie',
        studentCount: 1,
        sessionCount: 4,
        revenue: 1_900_000,
        teacherCost: 900_000,
        directParentExpense: 120_000,
        allocatedGroupExpense: 140_000,
        allocatedGlobalOverhead: 100_000,
        allocatedAdSpend: 700_000,
        netProfit: 40_000,
        netMargin: 2.1,
        adGroupId: 'group-charlie',
        adGroupName: 'Charlie Retargeting',
        platform: 'TIKTOK',
        attributedAt: '2026-03-25T05:00:00.000Z',
      },
    ],
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

async function openDirectorEvidencePage(
  browser: Browser,
  request: APIRequestContext,
  scenario: string,
  viewport: { width: number; height: number },
): Promise<BatchEvidenceSession> {
  const evidence = await createBatchEvidenceContext(browser, {
    batchId: 'NHOM12',
    scenario,
    runDate: RUN_DATE,
  });
  const directorSession = await loginAsRole(request, 'director');
  await evidence.page.setViewportSize(viewport);
  await applySessionCookies(evidence.context, directorSession);
  return evidence;
}

async function installMaterialsRoutes(
  page: Page,
  state: MaterialsState,
  options?: {
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
    const url = new URL(requestUrl);
    const requestedPage = Number(url.searchParams.get('page') || '1');

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

async function routeAnalyticsApis(page: Page, state: AnalyticsState): Promise<void> {
  await page.route(ADS_GROUPS_API, async (route) => {
    if (new URL(route.request().url()).origin === APP_ORIGIN) {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(state.groups),
    });
  });

  await page.route(ADS_REALIZED_API, async (route) => {
    if (new URL(route.request().url()).origin === APP_ORIGIN) {
      await route.continue();
      return;
    }
    const url = new URL(route.request().url());
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(buildRealizedResponse(url, state)),
    });
  });

  await page.route(ADS_PARENT_PROFIT_API, async (route) => {
    if (new URL(route.request().url()).origin === APP_ORIGIN) {
      await route.continue();
      return;
    }
    const url = new URL(route.request().url());
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(buildParentProfitResponse(url, state)),
    });
  });

  await page.route(ADS_ANALYTICS_API, async (route) => {
    if (new URL(route.request().url()).origin === APP_ORIGIN) {
      await route.continue();
      return;
    }
    const url = new URL(route.request().url());
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(buildAnalyticsResponse(url, state)),
    });
  });
}

test.describe('NHOM12 scroll and layout stability browser coverage', () => {
  test('NHOM12 teaching materials load-more keeps scroll anchor stable while appending page 2', async ({
    browser,
    request,
  }) => {
    const state = buildMaterialsState();
    let releasePage2: (() => void) | null = null;
    const page2Gate = new Promise<void>((resolve) => {
      releasePage2 = resolve;
    });
    const evidence = await openDirectorEvidencePage(
      browser,
      request,
      'scroll_layout_load_more_materials_browser',
      { width: 1280, height: 560 },
    );

    try {
      await installMaterialsRoutes(evidence.page, state, { page2Gate });
      await evidence.page.goto(appUrl('/app/teaching-materials'));
      await evidence.page.waitForLoadState('domcontentloaded');

      await expect(evidence.page.getByText(/Tai lieu giang day va tri thuc cho AI/i)).toBeVisible();
      await expect(evidence.page.locator('.material-card')).toHaveCount(2);
      await expect(evidence.page.getByText('Dang hien 2/4 tai lieu')).toBeVisible();

      const loadMoreButton = evidence.page.locator('.load-more .btn.secondary');
      await loadMoreButton.scrollIntoViewIfNeeded();

      const metricsBefore = await evidence.page.evaluate(() => {
        const main = document.querySelector('main.content') as HTMLElement | null;
        const anchor = Array.from(document.querySelectorAll('.material-card'))
          .find((card) => card.textContent?.includes('Alpha Algebra Pack')) as HTMLElement | undefined;
        return {
          mainScrollTop: main?.scrollTop ?? 0,
          anchorTop: anchor?.getBoundingClientRect().top ?? 0,
        };
      });

      await loadMoreButton.click();
      await expect(loadMoreButton).toBeDisabled();
      await expect(loadMoreButton).toHaveText('Dang tai...');
      await expect(evidence.page.locator('.status-row .status-copy.subtle')).toHaveText('Dang tai them...');

      releasePage2?.();

      await expect.poll(() => state.requestUrls.length).toBe(2);
      await expect(evidence.page.locator('.material-card')).toHaveCount(4);
      await expect(evidence.page.getByText('Dang hien 4/4 tai lieu')).toBeVisible();

      const metricsAfter = await evidence.page.evaluate(() => {
        const main = document.querySelector('main.content') as HTMLElement | null;
        const anchor = Array.from(document.querySelectorAll('.material-card'))
          .find((card) => card.textContent?.includes('Alpha Algebra Pack')) as HTMLElement | undefined;
        return {
          mainScrollTop: main?.scrollTop ?? 0,
          anchorTop: anchor?.getBoundingClientRect().top ?? 0,
        };
      });

      const scrollDelta = metricsAfter.mainScrollTop - metricsBefore.mainScrollTop;
      const anchorDelta = metricsAfter.anchorTop - metricsBefore.anchorTop;
      const layoutShiftDelta = anchorDelta + scrollDelta;

      expect(Math.abs(scrollDelta)).toBeLessThanOrEqual(24);
      expect(Math.abs(layoutShiftDelta)).toBeLessThanOrEqual(8);
      await expect(evidence.page.locator('.load-more')).toHaveCount(0);
      await expect(evidence.page.locator('.material-card').filter({
        has: evidence.page.getByRole('heading', { name: /^Bravo Geometry Pack \(updated\)$/ }),
      })).toHaveCount(1);

      await evidence.step('01-materials-load-more-anchor-stable');

      await evidence.finalize('PASS', {
        extraLines: [
          'Scope: load-more append semantics without scroll reset or anchor jump on teaching materials.',
          `Request count: ${state.requestUrls.length}`,
          `Main scroll delta: ${Math.abs(scrollDelta)}`,
          `Layout shift delta: ${Math.abs(layoutShiftDelta)}`,
        ],
      });
    } catch (error) {
      await evidence.finalize('FAIL', { error });
      throw error;
    }
  });

  test('NHOM12 ads analytics wide table keeps overflow contained inside the table wrapper', async ({
    browser,
    request,
  }) => {
    const state = createAnalyticsState();
    const evidence = await openDirectorEvidencePage(
      browser,
      request,
      'scroll_layout_wide_table_ads_analytics_browser',
      { width: 1280, height: 900 },
    );

    try {
      await routeAnalyticsApis(evidence.page, state);
      await evidence.page.goto(appUrl('/app/ads-analytics'));
      await evidence.page.waitForLoadState('domcontentloaded');

      await expect(evidence.page.getByRole('button', { name: /Profit theo PH/i })).toBeVisible();
      await evidence.page.getByRole('button', { name: /Profit theo PH/i }).click();

      const parentTable = evidence.page.locator('table.parent-profit-table');
      const wrapper = evidence.page.locator('.table-wrap').filter({ has: parentTable }).first();
      await expect(parentTable).toBeVisible();
      await expect(parentTable.locator('tbody tr')).toHaveCount(3);

      const metricsBefore = await wrapper.evaluate((element) => {
        const wrapperEl = element as HTMLElement;
        const tableEl = wrapperEl.querySelector('table.parent-profit-table') as HTMLElement | null;
        return {
          viewportWidth: window.innerWidth,
          documentScrollWidth: document.documentElement.scrollWidth,
          wrapperClientWidth: wrapperEl.clientWidth,
          wrapperScrollWidth: wrapperEl.scrollWidth,
          wrapperScrollLeft: wrapperEl.scrollLeft,
          tableTop: tableEl?.getBoundingClientRect().top ?? 0,
        };
      });

      expect(metricsBefore.documentScrollWidth).toBeLessThanOrEqual(metricsBefore.viewportWidth + 1);
      expect(metricsBefore.wrapperScrollWidth).toBeGreaterThan(metricsBefore.wrapperClientWidth);

      await wrapper.evaluate((element) => {
        const wrapperEl = element as HTMLElement;
        wrapperEl.scrollLeft = wrapperEl.scrollWidth - wrapperEl.clientWidth;
      });

      const metricsAfter = await wrapper.evaluate((element) => {
        const wrapperEl = element as HTMLElement;
        const tableEl = wrapperEl.querySelector('table.parent-profit-table') as HTMLElement | null;
        return {
          viewportWidth: window.innerWidth,
          documentScrollWidth: document.documentElement.scrollWidth,
          wrapperClientWidth: wrapperEl.clientWidth,
          wrapperScrollWidth: wrapperEl.scrollWidth,
          wrapperScrollLeft: wrapperEl.scrollLeft,
          tableTop: tableEl?.getBoundingClientRect().top ?? 0,
        };
      });

      expect(metricsAfter.documentScrollWidth).toBeLessThanOrEqual(metricsAfter.viewportWidth + 1);
      expect(metricsAfter.wrapperScrollLeft).toBeGreaterThan(0);
      expect(Math.abs(metricsAfter.tableTop - metricsBefore.tableTop)).toBeLessThanOrEqual(2);
      await expect(parentTable).toContainText('Parent Alpha');
      await expect(parentTable).toContainText('Parent Bravo');
      await expect(parentTable).toContainText('Parent Charlie');

      await evidence.step('01-ads-wide-table-overflow-contained');

      await evidence.finalize('PASS', {
        extraLines: [
          'Scope: wide-table overflow containment on ads analytics parent-profit view.',
          `Wrapper client width: ${metricsAfter.wrapperClientWidth}`,
          `Wrapper scroll width: ${metricsAfter.wrapperScrollWidth}`,
          `Final wrapper scrollLeft: ${metricsAfter.wrapperScrollLeft}`,
        ],
      });
    } catch (error) {
      await evidence.finalize('FAIL', { error });
      throw error;
    }
  });
});
