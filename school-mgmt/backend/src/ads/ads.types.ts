export type NetProfitDailyRow = {
  date: string;
  adGroupId: string;
  adGroupName: string;
  adAccountId?: string;
  platform: string;
  sessionCount: number;
  revenue: number;
  teacherCost: number;
  grossProfit: number;
  totalExpenseOfDay: number;
  totalSessionsOfDay: number;
  overheadPerSession: number;
  allocatedOverhead: number;
  adSpend: number;
  netProfit: number;
  netMargin: number;
};

export type SaleFunnelDiagnosticRow = {
  adGroupId: string;
  adGroupName: string;
  platform: string;
  saleId: string | null;
  saleName: string;
  leadCount: number;
  assignedLeadCount: number;
  contactedLeadCount: number;
  staleLeadCount: number;
  convertedOrderCount: number;
  approvedOrderCount: number;
  revenue: number;
  saleCommission: number;
  profit: number;
  netProfit: number | null;
  profitBasis: 'ORDER_REVENUE_MINUS_SALE_COMMISSION';
  netProfitBasis: null;
};

export type SaleFunnelDiagnosticsResponse = {
  query: {
    startDate: string;
    endDate: string;
    adGroupId: string | null;
    saleId: string | null;
    staleAfterDays: number;
  };
  rows: SaleFunnelDiagnosticRow[];
  summary: {
    leadCount: number;
    assignedLeadCount: number;
    contactedLeadCount: number;
    staleLeadCount: number;
    convertedOrderCount: number;
    approvedOrderCount: number;
    revenue: number;
    saleCommission: number;
    profit: number;
    netProfit: number | null;
  };
};

export type ParentProfitabilityRow = {
  parentKey: string;
  parentUserId?: string;
  parentPhone?: string;
  normalizedParentPhone?: string;
  parentName?: string;
  adGroupId: string;
  adGroupName: string;
  platform: string;
  attributedAt?: string;
  sessionCount: number;
  studentCount: number;
  revenue: number;
  teacherCost: number;
  directParentExpense: number;
  allocatedGroupExpense: number;
  allocatedGlobalOverhead: number;
  allocatedAdSpend: number;
  netProfit: number;
  netMargin: number;
};

export type ParentProfitabilityAccumulator = {
  parentKey: string;
  parentUserId?: string;
  parentPhone?: string;
  normalizedParentPhone?: string;
  parentName?: string;
  adGroupId: string;
  adGroupName: string;
  platform: string;
  attributedAt?: Date;
  sessionCount: number;
  studentIds: Set<string>;
  revenue: number;
  teacherCost: number;
  directParentExpense: number;
  allocatedGroupExpense: number;
  allocatedGlobalOverhead: number;
  allocatedAdSpend: number;
};

export type SuggestionModel = {
  adGroupId: string;
  adGroupName: string;
  platform: string;
  currentDailySpend: number;
  suggestedDailySpend: number;
  expectedDailyNetProfit: number | null;
  expectedDailyMarginalProfit: number | null;
  changePercent: number | null;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  dataPoints: number;
  maturityDays: number;
  averageCtr: number;
  averageLeadRate: number;
  averageProfitPerLead: number | null;
  observedAverageNetProfit: number;
  recommendation: string;
  recommendationReasons: string[];
  coeffA: number | null;
  coeffB: number | null;
};

export type RealizedCohortParentAccumulator = {
  parentKey: string;
  parentUserId?: string;
  parentPhone?: string;
  normalizedParentPhone?: string;
  parentName?: string;
  adGroupId: string;
  adGroupName: string;
  platform: string;
  attributedAt?: Date;
  cohortDate: string;
  cohortStart: Date;
  observationEnd: Date;
  cohortAgeDays: number;
  isMatured: boolean;
  sessionCount: number;
  studentIds: Set<string>;
  realizedSessionIds: Set<string>;
  revenue: number;
  collectedRevenue: number;
  remainingSessionUnits: number;
  scheduledRemainingSessionCount: number;
  scheduledRemainingTeacherCost: number;
  refundAmount: number;
  teacherCost: number;
  directParentExpense: number;
  allocatedGroupExpense: number;
  allocatedGlobalOverhead: number;
  allocatedAdSpend: number;
};

export type RealizedCohortRow = {
  date: string;
  realizedThrough: string;
  maturityDays: number;
  cohortAgeDays: number;
  isMatured: boolean;
  adGroupId: string;
  adGroupName: string;
  platform: string;
  impressions: number;
  clicks: number;
  conversions: number;
  ctr: number;
  cpc: number | null;
  cpm: number | null;
  costPerConversion: number | null;
  leadCount: number;
  orderCount: number;
  newParentCount: number;
  realizedParentCount: number;
  realizedSessionCount: number;
  adSpend: number;
  collectedRevenue: number;
  remainingSessionUnits: number;
  scheduledRemainingSessionCount: number;
  scheduledRemainingTeacherCost: number;
  realizedRevenue: number;
  refundAmount: number;
  netRealizedRevenue: number;
  estimatedRemainingRefund: number;
  estimatedRemainingTeacherCost: number;
  estimatedRemainingOtherCost: number;
  projectedRevenue: number;
  projectedNetProfit: number;
  effectiveNetProfit: number;
  projectionBasis: ProfitProjectionBasis;
  teacherCost: number;
  directParentExpense: number;
  allocatedGroupExpense: number;
  allocatedGlobalOverhead: number;
  netProfit: number;
  roi: number;
  costPerLead: number | null;
  costPerNewParent: number | null;
  profitPerLead: number | null;
  profitPerNewParent: number | null;
};

export type ProfitProjectionBasis =
  | 'GROUP_MATURE_MARGIN'
  | 'PLATFORM_MATURE_MARGIN'
  | 'GLOBAL_MATURE_MARGIN'
  | 'GROUP_LIVE_MARGIN'
  | 'PLATFORM_LIVE_MARGIN'
  | 'GLOBAL_LIVE_MARGIN'
  | 'ACTUAL_ONLY';

export type ProfitProjectionProfile = {
  teacherCostRate: number;
  otherCostRate: number;
  refundRate: number;
  teacherCostPerSession: number | null;
  otherCostPerSession: number | null;
};

export type FacebookBusinessRef = {
  id: string;
  name?: string;
};

export type FacebookAdAccountRow = {
  id?: string;
  account_id?: string;
  name?: string;
  account_status?: number | string;
  currency?: string;
  business?: { id?: string; name?: string };
};

export type FacebookPageRow = {
  id?: string;
  name?: string;
  access_token?: string;
  link?: string;
};

export type FacebookAdsetRow = {
  id?: string;
  name?: string;
  effective_status?: string;
  daily_budget?: string;
  start_time?: string;
  end_time?: string;
};

export type FacebookInsightRow = {
  adset_id?: string;
  adset_name?: string;
  spend?: string;
  impressions?: string;
  clicks?: string;
  actions?: Array<{ action_type?: string; value?: string | number }>;
};

export type BusinessTokenSyncResult = {
  synced: number;
  adAccountsSynced: number;
  adGroupsSynced: number;
  fanpagesSynced: number;
  errors: string[];
};

export type GoogleCustomerClientRow = {
  customerClient?: {
    clientCustomer?: string;
    id?: string | number;
    descriptiveName?: string;
    currencyCode?: string;
    manager?: boolean;
    status?: string;
  };
  customer_client?: {
    client_customer?: string;
    id?: string | number;
    descriptive_name?: string;
    currency_code?: string;
    manager?: boolean;
    status?: string;
  };
};

export type GoogleCampaignRow = {
  campaign?: {
    id?: string | number;
    name?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
    start_date?: string;
    end_date?: string;
  };
};

export type TikTokBusinessCenterRef = {
  id: string;
  name?: string;
};

export type TikTokAdvertiserRow = {
  advertiser_id?: string | number;
  advertiser_name?: string;
  name?: string;
  currency?: string;
  status?: string;
};

export type TikTokCampaignRow = {
  campaign_id?: string | number;
  campaign_name?: string;
  secondary_status?: string;
  operation_status?: string;
  budget_mode?: string;
  create_time?: string;
  modify_time?: string;
  schedule_start_time?: string;
  schedule_end_time?: string;
};

export interface ActionableSuggestion {
  type: 'PAUSE_GROUP' | 'ADJUST_BUDGET' | 'CREATE_GROUP' | 'OPTIMIZE_FUNNEL_FIRST';
  subType?: 'INCREASE' | 'DECREASE';
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;
  description: string;
  reasons: string[];
  details: Record<string, any>;
  relatedEntity?: {
    type: 'AdGroup';
    id: string;
    name: string;
  };
  estimatedImpact?: {
    dailyProfitChange: number;
    monthlyProfitChange: number;
  };
  draftRecommendations?: CampaignDraftRecommendation[];
}

export interface CampaignDraftRecommendation {
  draftName: string;
  platform: string;
  adAccountId?: string;
  sourceAdGroupId?: string;
  sourceAdGroupName?: string;
  dailyBudget: number;
  targetAudience: string;
  trackingKey: string;
  objective: string;
  offerAngle: string;
  kpi: {
    targetCpl: number | null;
    targetCpo: number | null;
    targetDailyNetProfit: number;
  };
  payload: {
    name: string;
    adAccountId?: string;
    platform: string;
    dailyBudget: number;
    targetAudience: string;
    trackingKeys: string[];
    notes: string;
  };
  missingFields: string[];
  launchChecklist: string[];
}

export interface ActionsRequiredSummary {
  totalActiveGroups: number;
  profitableGroups: number;
  unprofitableGroups: number;
  totalDailySpend: number;
  totalOptimalDailySpend: number;
  overallNetProfit7d: number;
  overallEffectiveNetProfit: number;
  dataReadiness?: {
    score: number;
    level: 'PRODUCTION_READY' | 'GOOD' | 'NEEDS_REVIEW' | 'WEAK';
    groupsAnalyzed: number;
    groupsWithModel: number;
    groupsWithCohortSignal: number;
    matureCohortRows: number;
    attributionCoveragePercent: number;
    warnings: string[];
  };
  generatedAt: string;
}

export interface ActionsRequiredResponse {
  actions: ActionableSuggestion[];
  summary: ActionsRequiredSummary;
}
