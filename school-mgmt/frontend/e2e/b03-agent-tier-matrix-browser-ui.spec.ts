import { expect, test, type APIRequestContext, type Browser } from '@playwright/test';
import {
  applySessionCookies,
  createBatchEvidenceContext,
  loginAsRole,
  type BatchEvidenceSession,
} from './support';

const APP_BASE_URL =
  process.env['PLAYWRIGHT_BASE_URL']
  || process.env['E2E_BASE_URL']
  || 'http://localhost:4200';

const API_ORIGIN_PATTERN = 'https?://(?:localhost|127\\.0\\.0\\.1):3000';
const AGENTS_API = new RegExp(`${API_ORIGIN_PATTERN}/agents(?:\\?.*)?$`);

type AgentTier = 'SILVER' | 'GOLD' | 'PLATINUM';

type AgentPayload = {
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  taxCode: string;
  bankName: string;
  bankAccount: string;
  bankAccountHolder: string;
  tier: AgentTier;
  commissionRate: number;
  notes: string;
};

type AgentItem = AgentPayload & {
  _id: string;
  agentCode: string;
  status: 'ACTIVE';
  totalReferred: number;
  totalCommissionPaid: number;
  createdById: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
};

type State = {
  items: AgentItem[];
  createCalls: AgentPayload[];
  listQueries: Array<{
    keyword: string;
    status: string;
    tier: string;
    page: string;
    limit: string;
  }>;
};

type TierCase = {
  tier: AgentTier;
  commissionRate: number;
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  taxCode: string;
  bankName: string;
  bankAccount: string;
  bankAccountHolder: string;
  notes: string;
};

function appUrl(path: string): string {
  return new URL(path, APP_BASE_URL).toString();
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function buildTierCases(): TierCase[] {
  const stamp = Date.now().toString().slice(-6);
  return [
    {
      tier: 'SILVER',
      commissionRate: 5,
      name: `B03 Silver Matrix ${stamp}`,
      contactPerson: 'Lien he Silver',
      phone: `0901${stamp}`,
      email: `silver.${stamp}@agent.local`,
      address: 'Quan 1',
      taxCode: `SILV${stamp}`,
      bankName: 'ACB',
      bankAccount: `111${stamp}`,
      bankAccountHolder: 'CONG TY SILVER',
      notes: 'B03 agent tier SILVER browser proof',
    },
    {
      tier: 'GOLD',
      commissionRate: 15,
      name: `B03 Gold Matrix ${stamp}`,
      contactPerson: 'Lien he Gold',
      phone: `0902${stamp}`,
      email: `gold.${stamp}@agent.local`,
      address: 'Quan 3',
      taxCode: `GOLD${stamp}`,
      bankName: 'VCB',
      bankAccount: `222${stamp}`,
      bankAccountHolder: 'CONG TY GOLD',
      notes: 'B03 agent tier GOLD browser proof',
    },
    {
      tier: 'PLATINUM',
      commissionRate: 25,
      name: `B03 Platinum Matrix ${stamp}`,
      contactPerson: 'Lien he Platinum',
      phone: `0903${stamp}`,
      email: `platinum.${stamp}@agent.local`,
      address: 'Quan 7',
      taxCode: `PLAT${stamp}`,
      bankName: 'TCB',
      bankAccount: `333${stamp}`,
      bankAccountHolder: 'CONG TY PLATINUM',
      notes: 'B03 agent tier PLATINUM browser proof',
    },
  ];
}

function buildState(): State {
  return {
    items: [],
    createCalls: [],
    listQueries: [],
  };
}

function buildAgent(payload: AgentPayload, createdById: string, createdByName: string): AgentItem {
  const now = new Date().toISOString();
  return {
    _id: `agent-${payload.tier.toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    agentCode: `AG-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
    status: 'ACTIVE',
    totalReferred: 0,
    totalCommissionPaid: 0,
    createdById,
    createdByName,
    createdAt: now,
    updatedAt: now,
    ...payload,
  };
}

async function openBatch(
  browser: Browser,
  request: APIRequestContext,
): Promise<BatchEvidenceSession> {
  const batch = await createBatchEvidenceContext(browser, {
    batchId: 'B03',
    scenario: 'agent_tier_matrix_browser',
  });
  const session = await loginAsRole(request, 'director');
  await applySessionCookies(batch.page, session);
  return batch;
}

async function installAgentRoutes(batch: BatchEvidenceSession, state: State): Promise<void> {
  await batch.page.route(AGENTS_API, async (route) => {
    const request = route.request();
    if (request.method() === 'GET') {
      const url = new URL(request.url());
      const keyword = url.searchParams.get('keyword') || '';
      const status = url.searchParams.get('status') || '';
      const tier = url.searchParams.get('tier') || '';
      const page = url.searchParams.get('page') || '1';
      const limit = url.searchParams.get('limit') || '20';
      state.listQueries.push({ keyword, status, tier, page, limit });

      let filtered = [...state.items];
      if (keyword) {
        const lowered = keyword.toLowerCase();
        filtered = filtered.filter((item) =>
          item.agentCode.toLowerCase().includes(lowered)
          || item.name.toLowerCase().includes(lowered)
          || item.contactPerson.toLowerCase().includes(lowered)
          || item.phone.toLowerCase().includes(lowered),
        );
      }
      if (status) {
        filtered = filtered.filter((item) => item.status === status);
      }
      if (tier) {
        filtered = filtered.filter((item) => item.tier === tier);
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: clone(filtered),
          total: filtered.length,
          page: Number(page),
          limit: Number(limit),
        }),
      });
      return;
    }

    if (request.method() === 'POST') {
      const payload = request.postDataJSON() as AgentPayload;
      state.createCalls.push(clone(payload));
      const created = buildAgent(payload, 'director-b03-agent-001', 'Director Agent Matrix');
      state.items = [created, ...state.items];

      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(clone(created)),
      });
      return;
    }

    await route.fallback();
  });
}

async function createAgentViaUi(
  batch: BatchEvidenceSession,
  state: State,
  tierCase: TierCase,
  expectedCreateCount: number,
): Promise<AgentItem> {
  const page = batch.page;

  await page.getByTestId('agents-create-button').click();
  const modal = page.getByTestId('agents-form-modal');
  await expect(modal).toBeVisible();

  await modal.locator('input[name="name"]').fill(tierCase.name);
  await modal.locator('input[name="contactPerson"]').fill(tierCase.contactPerson);
  await modal.locator('input[name="phone"]').fill(tierCase.phone);
  await modal.locator('input[name="email"]').fill(tierCase.email);
  await modal.locator('input[name="address"]').fill(tierCase.address);
  await modal.locator('input[name="taxCode"]').fill(tierCase.taxCode);
  await modal.locator('input[name="bankName"]').fill(tierCase.bankName);
  await modal.locator('input[name="bankAccount"]').fill(tierCase.bankAccount);
  await modal.locator('input[name="bankAccountHolder"]').fill(tierCase.bankAccountHolder);
  await modal.getByTestId('agents-tier-select').selectOption(tierCase.tier);
  await modal.getByTestId('agents-commission-input').fill(String(tierCase.commissionRate));
  await modal.locator('textarea[name="notes"]').fill(tierCase.notes);
  await modal.getByTestId('agents-save').click();

  await expect(modal).toHaveCount(0);
  await expect.poll(() => state.createCalls.length).toBe(expectedCreateCount);

  const lastCreate = state.createCalls[state.createCalls.length - 1];
  expect(lastCreate).toEqual({
    name: tierCase.name,
    contactPerson: tierCase.contactPerson,
    phone: tierCase.phone,
    email: tierCase.email,
    address: tierCase.address,
    taxCode: tierCase.taxCode,
    bankName: tierCase.bankName,
    bankAccount: tierCase.bankAccount,
    bankAccountHolder: tierCase.bankAccountHolder,
    tier: tierCase.tier,
    commissionRate: tierCase.commissionRate,
    notes: tierCase.notes,
  });

  const created = state.items.find((item) => item.name === tierCase.name);
  expect(created).toBeTruthy();
  return created!;
}

async function assertRowAndDetail(
  batch: BatchEvidenceSession,
  tierCase: TierCase,
  created: AgentItem,
): Promise<void> {
  const page = batch.page;
  const row = page.getByTestId(`agents-row-${created._id}`);
  await expect(row).toBeVisible();
  await expect(row.getByTestId('agents-row-name')).toHaveText(tierCase.name);
  await expect(row.getByTestId('agents-row-tier')).toHaveText(tierCase.tier);
  await expect(row.getByTestId('agents-row-commission')).toHaveText(`${tierCase.commissionRate}%`);

  await row.click();
  const detail = page.getByTestId('agents-detail-modal');
  await expect(detail).toBeVisible();
  await expect(detail).toContainText(tierCase.name);
  await expect(detail).toContainText(tierCase.tier);
  await expect(detail).toContainText(`${tierCase.commissionRate}%`);
  await detail.getByTestId('agents-detail-close').click();
  await expect(detail).toHaveCount(0);
}

async function assertTierFilter(
  batch: BatchEvidenceSession,
  state: State,
  tierCase: TierCase,
  allCases: TierCase[],
): Promise<void> {
  const page = batch.page;

  await page.getByTestId('agents-tier-filter').selectOption(tierCase.tier);
  await expect.poll(() => state.listQueries[state.listQueries.length - 1]?.tier || '').toBe(tierCase.tier);

  const visibleRow = page.locator('tbody tr').filter({ hasText: tierCase.name }).first();
  await expect(visibleRow).toBeVisible();
  await expect(visibleRow).toContainText(tierCase.tier);
  await expect(visibleRow).toContainText(`${tierCase.commissionRate}%`);

  for (const other of allCases.filter((item) => item.tier !== tierCase.tier)) {
    await expect(page.locator('tbody tr').filter({ hasText: other.name })).toHaveCount(0);
  }
}

test.use({
  trace: 'off',
  video: 'on',
});

test.describe.configure({ mode: 'serial', timeout: 120_000 });

test('B03 agents support SILVER GOLD PLATINUM creation with exact commission pairing and tier filtering', async ({
  browser,
  request,
}) => {
  const tierCases = buildTierCases();
  const state = buildState();
  const batch = await openBatch(browser, request);

  try {
    await installAgentRoutes(batch, state);

    const page = batch.page;
    await page.goto(appUrl('/app/agents'));
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByTestId('agents-create-button')).toBeVisible();

    const createdAgents: AgentItem[] = [];
    for (const [index, tierCase] of tierCases.entries()) {
      const created = await createAgentViaUi(batch, state, tierCase, index + 1);
      createdAgents.push(created);
      await assertRowAndDetail(batch, tierCase, created);
      await batch.step(`create-${tierCase.tier.toLowerCase()}-agent`);
    }

    for (const tierCase of tierCases) {
      await assertTierFilter(batch, state, tierCase, tierCases);
      await batch.step(`filter-${tierCase.tier.toLowerCase()}-agent`);
    }

    await page.getByTestId('agents-tier-filter').selectOption('');
    await expect.poll(() => state.listQueries[state.listQueries.length - 1]?.tier || '').toBe('');
    for (const created of createdAgents) {
      await expect(page.locator('tbody tr').filter({ hasText: created.name })).toHaveCount(1);
    }
    await batch.step('reset-tier-filter-shows-all-created-agents');

    await batch.finalize('PASS', {
      extraLines: [
        'Verified DIRECTOR can create three agents with exact payload pairs SILVER 5%, GOLD 15%, and PLATINUM 25% without dropping tier or commissionRate in the POST body.',
        'Verified each created agent row and detail modal persist the exact tier badge and commission value after reload from the mocked /agents contract.',
        'Verified the tier filter sends the exact tier query and never mixes the three created agents across SILVER, GOLD, and PLATINUM views.',
      ],
    });
  } catch (error) {
    await batch.finalize('FAIL', { error });
    throw error;
  }
});
