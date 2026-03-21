/**
 * Unit Tests: AdsAnalyticsService.getActionsRequired()
 *
 * Strategy: mock getNetProfitByAdGroup() and getSuggestions() via jest.spyOn
 * so tests are stable and do not require live DB or seed data.
 */
import { AdsAnalyticsService } from './ads-analytics.service';

// ─── Minimal mock model (constructor only, all methods mocked via spyOn) ──────
const mockModel = {} as any;

// ─── Helper factories ──────────────────────────────────────────────────────────

/** Build a summaryByGroup item for getNetProfitByAdGroup mock */
const makeGroup = (
  adGroupId: string,
  totalNetProfit: number,
  opts?: {
    platform?: string;
    totalAdSpend?: number;
    totalRevenue?: number;
    adGroupName?: string;
  },
) => ({
  adGroupId,
  adGroupName: opts?.adGroupName ?? `Nhóm ${adGroupId}`,
  platform: opts?.platform ?? 'FACEBOOK',
  totalNetProfit,
  totalAdSpend: opts?.totalAdSpend ?? 3_500_000, // default: 7d × 500k/day
  totalRevenue: opts?.totalRevenue ?? 5_000_000,
});

/** Build a suggestion item for getSuggestions mock */
const makeSuggestion = (
  adGroupId: string,
  currentDailySpend: number,
  suggestedDailySpend: number,
  opts?: {
    confidence?: string;
    platform?: string;
    expectedDailyNetProfit?: number;
    observedAverageNetProfit?: number;
    dataPoints?: number;
    averageProfitPerLead?: number | null;
    adGroupName?: string;
  },
) => ({
  adGroupId,
  adGroupName: opts?.adGroupName ?? `Nhóm ${adGroupId}`,
  platform: opts?.platform ?? 'FACEBOOK',
  currentDailySpend,
  suggestedDailySpend,
  confidence: opts?.confidence ?? 'HIGH',
  dataPoints: opts?.dataPoints ?? 10,
  expectedDailyNetProfit: opts?.expectedDailyNetProfit ?? 100_000,
  observedAverageNetProfit: opts?.observedAverageNetProfit ?? 50_000,
  averageProfitPerLead: opts?.averageProfitPerLead !== undefined ? opts.averageProfitPerLead : null,
});

/** Build a summaryTable row (carries effectiveNetProfit for cohort view) */
const makeSummaryRow = (adGroupId: string, effectiveNetProfit: number) => ({
  adGroupId,
  effectiveNetProfit,
});

// ─── Spy helpers ───────────────────────────────────────────────────────────────

const spyNetProfit = (service: AdsAnalyticsService, summaryByGroup: any[]) =>
  jest.spyOn(service, 'getNetProfitByAdGroup').mockResolvedValue({
    overall: {
      totalAdSpend: summaryByGroup.reduce((s, g) => s + g.totalAdSpend, 0),
      totalNetProfit: summaryByGroup.reduce((s, g) => s + g.totalNetProfit, 0),
      totalRevenue: summaryByGroup.reduce((s, g) => s + g.totalRevenue, 0),
    },
    summaryByGroup,
    daily: [],
  } as any);

const spySuggestions = (
  service: AdsAnalyticsService,
  suggestions: any[],
  summaryTable: any[],
  unallocated = 0,
) =>
  jest.spyOn(service, 'getSuggestions').mockResolvedValue({
    suggestions,
    summaryTable,
    unallocated,
    totalSuggestedDailySpend: suggestions.reduce((s, g) => s + g.suggestedDailySpend, 0),
  } as any);

// ═══════════════════════════════════════════════════════════════════════════════

describe('AdsAnalyticsService – getActionsRequired()', () => {
  let service: AdsAnalyticsService;

  beforeEach(() => {
    // Instantiate with empty model mocks — real methods are spied out per test
    service = new AdsAnalyticsService(
      mockModel, mockModel, mockModel, mockModel, mockModel,
      mockModel, mockModel, mockModel, mockModel, mockModel,
    );
  });

  afterEach(() => jest.restoreAllMocks());

  // ─────────────────────────────────────────────────────────────────────────
  // SUITE 1: PAUSE_GROUP logic
  // ─────────────────────────────────────────────────────────────────────────
  describe('Suite 1 – PAUSE_GROUP logic', () => {
    it('1.1 CRITICAL priority when group loses > 2M in both short-term and 90d cohort', async () => {
      spyNetProfit(service, [
        makeGroup('g1', -3_000_000, { totalAdSpend: 3_500_000 }),
      ]);
      spySuggestions(
        service,
        [makeSuggestion('g1', 500_000, 500_000)],
        [makeSummaryRow('g1', -5_000_000)],
      );

      const { actions } = await service.getActionsRequired();
      const action = actions.find(a => a.type === 'PAUSE_GROUP' && a.relatedEntity?.id === 'g1');

      expect(action).toBeDefined();
      expect(action!.type).toBe('PAUSE_GROUP');
      expect(action!.priority).toBe('CRITICAL');                       // loss > 2M
      expect(action!.reasons[0]).toMatch(/Lỗ liên tục/);
      expect(action!.relatedEntity?.id).toBe('g1');
      expect(action!.estimatedImpact?.dailyProfitChange).toBeGreaterThan(0); // stopping loss saves money
    });

    it('1.2 PAUSE when actual spend > 150% of optimal while in short-term loss', async () => {
      // actual = 7_000_000 / 7 = 1_000_000/day | optimal = 500_000
      // effectiveNetProfit > 0 → condition 1 does NOT fire; only condition 2
      spyNetProfit(service, [
        makeGroup('g2', -100_000, { totalAdSpend: 7_000_000, totalRevenue: 6_000_000 }),
      ]);
      spySuggestions(
        service,
        [makeSuggestion('g2', 1_000_000, 500_000)],
        [makeSummaryRow('g2', 200_000)],  // positive cohort
      );

      const { actions } = await service.getActionsRequired();
      const action = actions.find(a => a.type === 'PAUSE_GROUP' && a.relatedEntity?.id === 'g2');

      expect(action).toBeDefined();
      expect(action!.type).toBe('PAUSE_GROUP');
      expect(action!.details.overspendPercent).toBe(100);             // (1M-500k)/500k = 100%
      expect(action!.reasons).toEqual(
        expect.arrayContaining([expect.stringMatching(/Chi vượt tối ưu/)]),
      );
    });

    it('1.3 PAUSE with funnel warning when profit-per-lead is negative (≥5 data points)', async () => {
      // netProfit7d > 0 and effectiveNetProfit > 0 → only condition 3 fires
      spyNetProfit(service, [
        makeGroup('g3', 200_000, { totalAdSpend: 1_500_000 }),
      ]);
      spySuggestions(
        service,
        [makeSuggestion('g3', 500_000, 500_000, {
          averageProfitPerLead: -50_000,
          dataPoints: 6,
        })],
        [makeSummaryRow('g3', 500_000)],  // positive cohort
      );

      const { actions } = await service.getActionsRequired();
      const action = actions.find(a => a.type === 'PAUSE_GROUP' && a.relatedEntity?.id === 'g3');

      expect(action).toBeDefined();
      expect(action!.reasons).toEqual(
        expect.arrayContaining([expect.stringMatching(/Mỗi lead đang tạo lỗ/)]),
      );
    });

    it('1.4 should NOT pause when profitPerLead is negative but has fewer than 5 data points', async () => {
      spyNetProfit(service, [
        makeGroup('g3b', 200_000, { totalAdSpend: 1_500_000 }),
      ]);
      spySuggestions(
        service,
        [makeSuggestion('g3b', 500_000, 500_000, {
          averageProfitPerLead: -50_000,
          dataPoints: 3,  // not enough data
        })],
        [makeSummaryRow('g3b', 500_000)],
      );

      const { actions } = await service.getActionsRequired();
      const pauseForG3b = actions.filter(a => a.type === 'PAUSE_GROUP' && a.relatedEntity?.id === 'g3b');
      expect(pauseForG3b).toHaveLength(0);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // SUITE 2: ADJUST_BUDGET & Learning Phase Protection
  // ─────────────────────────────────────────────────────────────────────────
  describe('Suite 2 – ADJUST_BUDGET & Learning Phase Protection', () => {
    it('2.1 DECREASE: cap to 20% and flag learningPhaseProtected when deviation is 50%', async () => {
      // actual = 7_000_000 / 7 = 1_000_000/day | optimal = 500_000 (50% deviation)
      // safeDecreaseLimit = 1_000_000 * 0.8 = 800_000
      // safeDailyTarget = max(500_000, 800_000) = 800_000
      spyNetProfit(service, [
        makeGroup('g4', 100_000, { totalAdSpend: 7_000_000 }), // netProfit7d > 0 → no PAUSE
      ]);
      spySuggestions(
        service,
        [makeSuggestion('g4', 1_000_000, 500_000, {
          expectedDailyNetProfit: 200_000,
          observedAverageNetProfit: 30_000,
        })],
        [makeSummaryRow('g4', 1_000_000)],
      );

      const { actions } = await service.getActionsRequired();
      const action = actions.find(a => a.type === 'ADJUST_BUDGET' && a.relatedEntity?.id === 'g4');

      expect(action).toBeDefined();
      expect(action!.subType).toBe('DECREASE');
      expect(action!.details.safeDailyTarget).toBe(800_000);          // 1_000_000 × 0.8
      expect(action!.details.learningPhaseProtected).toBe(true);
      expect(action!.description).toMatch(/GIẢM TỪ TỪ/);
      expect(action!.reasons).toEqual(
        expect.arrayContaining([expect.stringMatching(/Điều chỉnh >20%/)]),
      );
    });

    it('2.2 INCREASE: safeDailyTarget = optimalReal when change is within 20% limit', async () => {
      // actual = 500_000, optimal = 590_000 (~18.5% increase → triggers but ≤20% cap)
      // safeIncreaseLimit = 500_000 * 1.2 = 600_000
      // safeDailyTarget = min(590_000, 600_000) = 590_000 = optimalReal
      spyNetProfit(service, [
        makeGroup('g5', 50_000, { totalAdSpend: 3_500_000 }),
      ]);
      spySuggestions(
        service,
        [makeSuggestion('g5', 500_000, 590_000, {
          expectedDailyNetProfit: 150_000,
          observedAverageNetProfit: 80_000,
        })],
        [makeSummaryRow('g5', 2_000_000)],  // positive cohort → INCREASE allowed
      );

      const { actions } = await service.getActionsRequired();
      const action = actions.find(a => a.type === 'ADJUST_BUDGET' && a.relatedEntity?.id === 'g5');

      expect(action).toBeDefined();
      expect(action!.subType).toBe('INCREASE');
      expect(action!.details.safeDailyTarget).toBe(590_000);          // = optimalReal, no cap needed
      expect(action!.details.learningPhaseProtected).toBe(false);
    });

    it('2.3 should NOT suggest INCREASE when cohort effectiveNetProfit is negative', async () => {
      // actual = 500_000, model suggests optimal = 800_000 (INCREASE)
      // effectiveNetProfit = -100_000 → system blocks INCREASE
      spyNetProfit(service, [
        makeGroup('g6', 50_000, { totalAdSpend: 3_500_000 }),
      ]);
      spySuggestions(
        service,
        [makeSuggestion('g6', 500_000, 800_000, {
          expectedDailyNetProfit: 200_000,
          observedAverageNetProfit: 80_000,
        })],
        [makeSummaryRow('g6', -100_000)],   // negative cohort → block INCREASE
      );

      const { actions } = await service.getActionsRequired();
      const adjustForG6 = actions.filter(
        a => a.type === 'ADJUST_BUDGET' && a.relatedEntity?.id === 'g6',
      );

      expect(adjustForG6).toHaveLength(0);
    });

    it('2.4 should NOT suggest ADJUST_BUDGET for a paused group', async () => {
      // Group is both losing AND overspending → gets PAUSE_GROUP
      // Should not also appear as ADJUST_BUDGET
      spyNetProfit(service, [
        makeGroup('g7', -3_000_000, { totalAdSpend: 7_000_000 }),
      ]);
      spySuggestions(
        service,
        [makeSuggestion('g7', 1_000_000, 500_000, {
          expectedDailyNetProfit: 200_000,
          observedAverageNetProfit: 30_000,
        })],
        [makeSummaryRow('g7', -4_000_000)],
      );

      const { actions } = await service.getActionsRequired();
      expect(actions).toEqual(
        expect.arrayContaining([expect.objectContaining({ type: 'PAUSE_GROUP', relatedEntity: expect.objectContaining({ id: 'g7' }) })]),
      );
      expect(actions).not.toEqual(
        expect.arrayContaining([expect.objectContaining({ type: 'ADJUST_BUDGET', relatedEntity: expect.objectContaining({ id: 'g7' }) })]),
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // SUITE 3: CREATE_GROUP vs OPTIMIZE_FUNNEL_FIRST
  // ─────────────────────────────────────────────────────────────────────────
  describe('Suite 3 – CREATE_GROUP vs OPTIMIZE_FUNNEL_FIRST', () => {
    it('3.1 should emit OPTIMIZE_FUNNEL_FIRST (not CREATE_GROUP) when overall account is in loss', async () => {
      // Total effectiveNetProfit = -10_000_000 despite unallocated = 2_000_000
      spyNetProfit(service, [
        makeGroup('ga', -3_000_000, { totalAdSpend: 2_000_000 }),
        makeGroup('gb', -4_000_000, { totalAdSpend: 2_000_000 }),
        makeGroup('gc', -3_000_000, { totalAdSpend: 2_000_000 }),
      ]);
      spySuggestions(
        service,
        [
          makeSuggestion('ga', 500_000, 400_000),
          makeSuggestion('gb', 500_000, 400_000),
          makeSuggestion('gc', 500_000, 400_000),
        ],
        [
          makeSummaryRow('ga', -4_000_000),
          makeSummaryRow('gb', -3_000_000),
          makeSummaryRow('gc', -3_000_000),     // total = -10M
        ],
        2_000_000,  // unallocated budget present but account is losing
      );

      const { actions } = await service.getActionsRequired();

      expect(actions).toEqual(
        expect.arrayContaining([expect.objectContaining({ type: 'OPTIMIZE_FUNNEL_FIRST' })]),
      );
      expect(actions).not.toEqual(
        expect.arrayContaining([expect.objectContaining({ type: 'CREATE_GROUP' })]),
      );
      const optimizeAction = actions.find(a => a.type === 'OPTIMIZE_FUNNEL_FIRST');
      expect(optimizeAction!.priority).toBe('HIGH');
    });

    it('3.2 should emit CREATE_GROUP with correct count and platform when ratio is below target', async () => {
      // 7 groups total: 2 profitable (FACEBOOK, high ROI), 5 losing
      // targetProfitableRatio = 0.6 → target = ceil(7 × 0.6) = 5 → deficit = 3
      // totalEffective = 2M+1.5M-0.5M×3-0.8M-0.7M = 1_000_000 > 0 → account profitable
      spyNetProfit(service, [
        makeGroup('p1', 500_000, { platform: 'FACEBOOK', totalAdSpend: 3_500_000, totalRevenue: 8_000_000 }),
        makeGroup('p2', 300_000, { platform: 'FACEBOOK', totalAdSpend: 3_500_000, totalRevenue: 7_000_000 }),
        makeGroup('p3', -500_000, { platform: 'FACEBOOK', totalAdSpend: 3_500_000, totalRevenue: 2_000_000 }),
        makeGroup('p4', -500_000, { platform: 'FACEBOOK', totalAdSpend: 3_500_000, totalRevenue: 2_000_000 }),
        makeGroup('p5', -500_000, { platform: 'FACEBOOK', totalAdSpend: 3_500_000, totalRevenue: 2_000_000 }),
        makeGroup('p6', -500_000, { platform: 'GOOGLE', totalAdSpend: 3_500_000, totalRevenue: 1_000_000 }),
        makeGroup('p7', -500_000, { platform: 'GOOGLE', totalAdSpend: 3_500_000, totalRevenue: 1_000_000 }),
      ]);
      spySuggestions(
        service,
        [
          makeSuggestion('p1', 500_000, 500_000, { platform: 'FACEBOOK', confidence: 'HIGH' }),
          makeSuggestion('p2', 500_000, 500_000, { platform: 'FACEBOOK', confidence: 'HIGH' }),
          makeSuggestion('p3', 500_000, 400_000, { platform: 'FACEBOOK', confidence: 'MEDIUM' }),
          makeSuggestion('p4', 500_000, 400_000, { platform: 'FACEBOOK', confidence: 'MEDIUM' }),
          makeSuggestion('p5', 500_000, 400_000, { platform: 'FACEBOOK', confidence: 'MEDIUM' }),
          makeSuggestion('p6', 500_000, 400_000, { platform: 'GOOGLE', confidence: 'LOW' }),
          makeSuggestion('p7', 500_000, 400_000, { platform: 'GOOGLE', confidence: 'LOW' }),
        ],
        [
          makeSummaryRow('p1', 2_000_000),
          makeSummaryRow('p2', 1_500_000),
          makeSummaryRow('p3', -500_000),
          makeSummaryRow('p4', -500_000),
          makeSummaryRow('p5', -500_000),
          makeSummaryRow('p6', -800_000),
          makeSummaryRow('p7', -700_000),
        ],
        1_500_000,  // unallocated
      );

      const { actions } = await service.getActionsRequired({ targetProfitableRatio: 0.6 });
      const createAction = actions.find(a => a.type === 'CREATE_GROUP');

      expect(createAction).toBeDefined();
      expect(createAction!.details.suggestedNewGroupCount).toBeGreaterThanOrEqual(2);
      expect(createAction!.details.suggestedPlatform).toBe('FACEBOOK');    // highest ROI
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // SUITE 4: Edge Cases / Negative Tests
  // ─────────────────────────────────────────────────────────────────────────
  describe('Suite 4 – Edge Cases & Negative Tests', () => {
    it('EC1 empty state: returns empty actions array when no groups exist', async () => {
      spyNetProfit(service, []);
      spySuggestions(service, [], []);

      const { actions, summary } = await service.getActionsRequired();

      expect(actions).toHaveLength(0);
      expect(summary.totalActiveGroups).toBe(0);
    });

    it('EC2 graceful degradation: does not throw when getSuggestions() rejects', async () => {
      spyNetProfit(service, [makeGroup('gx', -3_000_000, { totalAdSpend: 3_500_000 })]);
      jest.spyOn(service, 'getSuggestions').mockRejectedValue(new Error('DB timeout'));

      // Should resolve without throwing — .catch(() => null) applied inside service
      const result = await service.getActionsRequired();

      expect(result).toBeDefined();
      expect(result.actions).toBeInstanceOf(Array);
      expect(result.summary).toBeDefined();
    });

    it('EC3 actions are sorted CRITICAL → HIGH → MEDIUM → LOW', async () => {
      spyNetProfit(service, [
        makeGroup('gCrit', -3_000_000, { totalAdSpend: 3_500_000 }),
        makeGroup('gHigh', -800_000, { totalAdSpend: 3_500_000 }),
        makeGroup('gMed', -200_000, { totalAdSpend: 3_500_000 }),
      ]);
      spySuggestions(
        service,
        [
          makeSuggestion('gCrit', 500_000, 200_000),
          makeSuggestion('gHigh', 500_000, 200_000),
          makeSuggestion('gMed', 500_000, 200_000),
        ],
        [
          makeSummaryRow('gCrit', -4_000_000),
          makeSummaryRow('gHigh', -1_000_000),
          makeSummaryRow('gMed', -300_000),
        ],
      );

      const { actions } = await service.getActionsRequired();
      const priorityOrder: Record<string, number> = { CRITICAL: 1, HIGH: 2, MEDIUM: 3, LOW: 4 };
      const isSorted = actions.every(
        (a, i) => i === 0 || priorityOrder[a.priority] >= priorityOrder[actions[i - 1].priority],
      );
      expect(isSorted).toBe(true);
    });

    it('EC4 API contract: response matches ActionsRequiredResponse schema', async () => {
      spyNetProfit(service, [makeGroup('gSchema', -2_500_000, { totalAdSpend: 3_500_000 })]);
      spySuggestions(service, [], [makeSummaryRow('gSchema', -3_000_000)]);

      const response = await service.getActionsRequired();

      expect(response).toEqual(
        expect.objectContaining({
          summary: expect.objectContaining({
            totalActiveGroups: expect.any(Number),
            profitableGroups: expect.any(Number),
            totalDailySpend: expect.any(Number),
            overallEffectiveNetProfit: expect.any(Number),
            generatedAt: expect.any(String),
          }),
          actions: expect.arrayContaining([
            expect.objectContaining({
              type: expect.stringMatching(/^(PAUSE_GROUP|ADJUST_BUDGET|CREATE_GROUP|OPTIMIZE_FUNNEL_FIRST)$/),
              priority: expect.stringMatching(/^(CRITICAL|HIGH|MEDIUM|LOW)$/),
              title: expect.any(String),
              description: expect.any(String),
              reasons: expect.any(Array),
              estimatedImpact: expect.objectContaining({
                dailyProfitChange: expect.any(Number),
                monthlyProfitChange: expect.any(Number),
              }),
            }),
          ]),
        }),
      );
    });

    it('EC5 overallNetProfit summary reflects 7-day lookback data', async () => {
      const groups = [
        makeGroup('s1', -1_000_000, { totalAdSpend: 3_500_000 }),
        makeGroup('s2', 2_000_000, { totalAdSpend: 3_500_000 }),
      ];
      spyNetProfit(service, groups);
      spySuggestions(service, [], [
        makeSummaryRow('s1', -1_000_000),
        makeSummaryRow('s2', 2_000_000),
      ]);

      const { summary } = await service.getActionsRequired();

      expect(summary.overallNetProfit7d).toBe(1_000_000);            // -1M + 2M
    });
  });
});
