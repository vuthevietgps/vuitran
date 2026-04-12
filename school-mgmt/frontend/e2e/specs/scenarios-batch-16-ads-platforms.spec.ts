/**
 * BATCH 16 - Ads platform coverage for test.md group 4
 *
 * Covers:
 *   - 4.1 Facebook ad cost sync / CAC / P&L impact
 *   - 4.4 Multi-platform ads sync / platform-level spend rollup
 */
import { expect, test } from '@playwright/test';
import { apiCall, apiJson } from '../support/api';
import { loginAsRole } from '../support/auth';
import { dateOffset, uniquePhone } from '../support/scenario-helpers';

type AdPlatform = 'FACEBOOK' | 'GOOGLE' | 'TIKTOK';

type CreatedAdFixture = {
  accountId: string;
  groupId: string;
  leadId: string;
  costId: string;
  platform: AdPlatform;
  groupName: string;
  spend: number;
  date: string;
};

function uniqueDigits(label: string, length: number): string {
  const raw = `${Date.now()}${Math.floor(Math.random() * 1000)}${label}`.replace(/\D/g, '');
  return raw.slice(-length).padStart(length, '0');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function postWithRetry<T>(
  request: Parameters<typeof apiJson>[0],
  director: Awaited<ReturnType<typeof loginAsRole>>,
  path: string,
  buildBody: (attempt: number) => Record<string, unknown>,
  attempts = 5,
): Promise<T> {
  let last409 = '';
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const resp = await apiCall<T>(
      request,
      director,
      'POST',
      path,
      buildBody(attempt),
      [200, 201, 409],
    );
    if (resp.status !== 409) {
      return resp.data as T;
    }
    last409 = resp.text;
    await sleep(100 * (attempt + 1));
  }
  throw new Error(`Failed to create ${path} after ${attempts} attempts: ${last409}`);
}

async function createAdFixture(
  request: Parameters<typeof apiJson>[0],
  director: Awaited<ReturnType<typeof loginAsRole>>,
  platform: AdPlatform,
  spend: number,
  date: string,
  label: string,
): Promise<CreatedAdFixture> {
  const digits = uniqueDigits(label, 8);
  const account = await postWithRetry<any>(request, director, '/ads/accounts', (attempt) => {
    const suffix = `${digits}${attempt}`.slice(-10);
    return {
      name: `E2E ${platform} Account ${suffix}`,
      platform,
      platformAccountId: `${platform.toLowerCase()}_${suffix}`,
      monthlyBudget: Math.max(spend * 2, spend),
      notes: `E2E fixture for ${label}`,
    };
  });

  const groupName = `Tuyen sinh ${label} ${digits}`;
  const group = await postWithRetry<any>(request, director, '/ads/groups', (attempt) => {
    const suffix = `${digits}${attempt}`.slice(-10);
    return {
      name: `${groupName}-${attempt}`,
      adAccountId: account._id,
      platform,
      platformCampaignId: `${platform.toLowerCase()}_campaign_${suffix}`,
      dailyBudget: spend,
      startDate: date,
      targetAudience: `E2E ${platform} parents`,
      notes: `Campaign fixture for ${label}`,
    };
  });

  const lead = await apiJson<any>(request, director, 'POST', '/leads', {
    parentName: `E2E ${platform} Lead ${digits}`,
    parentPhone: uniquePhone(`${label}-${platform}`),
    source: platform,
    adGroupId: group._id,
    adGroupName: groupName,
    notes: `Lead tied to ${platform} ad group`,
  });

  const cost = await postWithRetry<any>(request, director, '/ads/costs', () => ({
    adGroupId: group._id,
    adAccountId: account._id,
    platform,
    date,
    spend,
    impressions: Math.round(spend / 50),
    clicks: Math.round(spend / 2_000),
    conversions: 1,
    source: 'SYNCED',
  }));

  return {
    accountId: account._id,
    groupId: group._id,
    leadId: lead._id,
    costId: cost._id,
    platform,
    groupName,
    spend,
    date,
  };
}

async function cleanupAdFixture(
  request: Parameters<typeof apiJson>[0],
  director: Awaited<ReturnType<typeof loginAsRole>>,
  fixture: CreatedAdFixture,
): Promise<void> {
  await apiCall(request, director, 'DELETE', `/ads/costs/${fixture.costId}`, undefined, [200, 204, 404]);
  await apiCall(request, director, 'DELETE', `/leads/${fixture.leadId}`, undefined, [200, 204, 404]);
  await apiCall(request, director, 'DELETE', `/ads/groups/${fixture.groupId}`, undefined, [200, 204, 404]);
  await apiCall(request, director, 'DELETE', `/ads/accounts/${fixture.accountId}`, undefined, [200, 204, 404]);
}

test.describe('4 Ads Platforms', () => {
  test('4.1 Facebook ad cost sync updates analytics, CAC, and P&L', async ({ request }) => {
    const director = await loginAsRole(request, 'director');
    const date = dateOffset(30);
    const spend = 5_000_000;

    const fixture = await createAdFixture(request, director, 'FACEBOOK', spend, date, '4.1');

    try {
      const costs = await apiJson<any>(request, director, 'GET',
        `/ads/costs?startDate=${date}&endDate=${date}&platform=FACEBOOK`);
      const costRows = Array.isArray(costs.data) ? costs.data : (costs.data || []);
      expect(costs.total).toBeGreaterThanOrEqual(1);
      expect(costRows.some((row: any) => String(row._id) === fixture.costId && row.spend === spend)).toBe(true);

      const analytics = await apiJson<any>(request, director, 'GET',
        `/ads/analytics?startDate=${date}&endDate=${date}&platform=FACEBOOK`);
      expect(analytics.summary.totalSpend).toBe(spend);
      expect(analytics.summary.totalRevenue).toBe(0);
      expect(typeof analytics.summary.totalLeads).toBe('number');
      expect(typeof analytics.summary.avgCostPerLead).toBe('number');
      if (analytics.summary.totalLeads > 0) {
        expect(analytics.summary.avgCostPerLead).toBe(
          Math.round(analytics.summary.totalSpend / analytics.summary.totalLeads),
        );
      }

      const fbRow = analytics.rows.find((row: any) => String(row.adGroupId) === fixture.groupId);
      expect(fbRow).toBeTruthy();
      expect(fbRow.platform).toBe('FACEBOOK');
      expect(fbRow.totalSpend).toBe(spend);
      expect(typeof fbRow.leadCount).toBe('number');
      if (fbRow.leadCount > 0) {
        expect(fbRow.costPerLead).toBe(Math.round(fbRow.totalSpend / fbRow.leadCount));
      }

      const pnl = await apiJson<any>(request, director, 'GET',
        `/financial-control/profit-and-loss?startDate=${date}&endDate=${date}&basis=accrual`);
      expect(pnl.costs.adCost).toBe(spend);
      expect(pnl.costs.adCostByPlatform['FACEBOOK'].amount).toBe(spend);
      expect(pnl.summary.netProfit).toBe(-spend);

      const overview = await apiJson<any>(request, director, 'GET',
        `/financial-control/overview?startDate=${date}&endDate=${date}`);
      expect(overview.profitAndLoss.costs.adCost).toBe(spend);
    } finally {
      await cleanupAdFixture(request, director, fixture);
    }
  });

  test('4.4 multi-platform sync rolls up Facebook, Google, and TikTok spend', async ({ request }) => {
    const director = await loginAsRole(request, 'director');
    const date = dateOffset(31);
    const fixtures = [
      await createAdFixture(request, director, 'FACEBOOK', 2_000_000, date, '4.4-fb'),
      await createAdFixture(request, director, 'GOOGLE', 1_500_000, date, '4.4-gg'),
      await createAdFixture(request, director, 'TIKTOK', 1_500_000, date, '4.4-tt'),
    ];

    try {
      const analytics = await apiJson<any>(request, director, 'GET',
        `/ads/analytics?startDate=${date}&endDate=${date}`);
      expect(analytics.summary.totalSpend).toBe(5_000_000);
      expect(typeof analytics.summary.totalLeads).toBe('number');
      expect(typeof analytics.summary.avgCostPerLead).toBe('number');
      if (analytics.summary.totalLeads > 0) {
        expect(analytics.summary.avgCostPerLead).toBe(
          Math.round(analytics.summary.totalSpend / analytics.summary.totalLeads),
        );
      }

      const spendByPlatform = analytics.rows.reduce((acc: Record<string, number>, row: any) => {
        const key = String(row.platform || 'UNKNOWN');
        acc[key] = (acc[key] || 0) + Number(row.totalSpend || 0);
        return acc;
      }, {});
      expect(spendByPlatform.FACEBOOK).toBe(2_000_000);
      expect(spendByPlatform.GOOGLE).toBe(1_500_000);
      expect(spendByPlatform.TIKTOK).toBe(1_500_000);

      const pnl = await apiJson<any>(request, director, 'GET',
        `/financial-control/profit-and-loss?startDate=${date}&endDate=${date}&basis=accrual`);
      expect(pnl.costs.adCost).toBe(5_000_000);
      expect(pnl.costs.adCostByPlatform['FACEBOOK'].amount).toBe(2_000_000);
      expect(pnl.costs.adCostByPlatform['GOOGLE'].amount).toBe(1_500_000);
      expect(pnl.costs.adCostByPlatform['TIKTOK'].amount).toBe(1_500_000);
      expect(pnl.summary.netProfit).toBe(-5_000_000);

      const costList = await apiJson<any>(request, director, 'GET',
        `/ads/costs?startDate=${date}&endDate=${date}`);
      expect(costList.total).toBe(3);
      expect(Array.isArray(costList.data) ? costList.data.length : 0).toBe(3);
    } finally {
      for (const fixture of fixtures.reverse()) {
        await cleanupAdFixture(request, director, fixture);
      }
    }
  });
});
