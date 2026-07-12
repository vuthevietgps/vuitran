import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../environments/environment';

// â”€â”€â”€ Interfaces â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface AdAccountItem {
  _id: string;
  accountCode: string;
  name: string;
  platform: string;
  platformAccountId: string;
  status: string;
  monthlyBudget?: number;
  currency?: string;
  businessId?: string;
  businessName?: string;
  syncSource?: string;
  lastSyncedAt?: string;
  notes?: string;
  createdByName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdGroupItem {
  _id: string;
  groupCode: string;
  name: string;
  adAccountId: string;
  adAccountName?: string;
  platform: string;
  platformCampaignId: string;
  trackingKeys?: string[];
  status: string;
  dailyBudget?: number;
  startDate?: string;
  endDate?: string;
  targetAudience?: string;
  notes?: string;
  createdByName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApiTokenItem {
  _id: string;
  adAccountId?: string;
  adAccountName?: string;
  platform: string;
  tokenType?: string;
  businessId?: string;
  businessName?: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string;
  status: string;
  lastUsedAt?: string;
  lastSyncedAt?: string;
  label?: string;
  createdAt: string;
}

export interface AdCostItem {
  _id: string;
  adGroupId: string;
  adGroupName?: string;
  adAccountId: string;
  platform: string;
  date: string;
  spend: number;
  impressions?: number;
  clicks?: number;
  conversions?: number;
  source: string;
  syncedAt?: string;
  createdAt: string;
}

export interface ParentAttributionBackfillResult {
  conversations: number;
  leads: number;
  orders: number;
  students: number;
  upserted: number;
}

export interface AdGroupBackfillResult {
  studentsUpdated: number;
  sessionsUpdated: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface AdAnalyticsRow {
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
  bookedRevenue: number;
  recognizedRevenue: number;
  saleCommission: number;
  estimatedTeacherCost: number;
  directParentExpense: number;
  allocatedGroupExpense: number;
  allocatedGlobalExpense: number;
  allocatedStaffLaborCost: number;
  otherCost: number;
  operatingCost: number;
  totalCost: number;
  orderProfit: number;
  sessionNetProfit: number;
  projectedOrderNetProfit: number;
  realizedNetProfit: number;
  collectedRevenue: number;
  cohortRealizedRevenue: number;
  netRealizedRevenue: number;
  projectedCohortRevenue: number;
  remainingSessionUnits: number;
  estimatedRemainingRefund: number;
  estimatedRemainingTeacherCost: number;
  estimatedRemainingOtherCost: number;
  actualCohortNetProfit: number;
  projectedCohortNetProfit: number;
  effectiveCohortNetProfit: number;
  cohortMatureRowCount: number;
  cohortImmatureRowCount: number;
  costPerLead: number | null;
  costPerOrder: number | null;
  netProfit: number;
  roi: number;
  profitBasis?: string;
}

export interface AdAnalyticsSummary {
  totalSpend: number;
  totalLeads: number;
  totalOrders: number;
  totalRevenue: number;
  totalBookedRevenue: number;
  totalRecognizedRevenue: number;
  totalSaleCommission: number;
  totalEstimatedTeacherCost: number;
  totalDirectParentExpense: number;
  totalAllocatedGroupExpense: number;
  totalAllocatedGlobalExpense: number;
  totalAllocatedStaffLaborCost: number;
  totalOtherCost: number;
  totalOperatingCost: number;
  totalCost: number;
  totalOrderProfit: number;
  totalSessionNetProfit: number;
  totalProjectedOrderNetProfit: number;
  totalRealizedNetProfit: number;
  totalCollectedRevenue: number;
  totalCohortRealizedRevenue: number;
  totalNetRealizedRevenue: number;
  totalProjectedCohortRevenue: number;
  totalRemainingSessionUnits: number;
  totalEstimatedRemainingRefund: number;
  totalEstimatedRemainingTeacherCost: number;
  totalEstimatedRemainingOtherCost: number;
  totalActualCohortNetProfit: number;
  totalProjectedCohortNetProfit: number;
  totalEffectiveCohortNetProfit: number;
  totalNetProfit: number;
  avgCostPerLead: number;
  avgCostPerOrder: number;
  avgRoi: number;
  profitBasis?: string;
  cohortBasis?: string;
  maturityDays?: number;
  refundRatePercentX?: number | null;
  realizedThrough?: string;
}

export interface AdAnalyticsResponse {
  rows: AdAnalyticsRow[];
  summary: AdAnalyticsSummary;
}

export interface ParentProfitabilityRow {
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
}

export interface ParentProfitabilityGroupSummary {
  adGroupId: string;
  adGroupName: string;
  platform: string;
  parentCount: number;
  totalSessions: number;
  totalStudents: number;
  totalRevenue: number;
  totalTeacherCost: number;
  totalDirectParentExpense: number;
  totalAllocatedGroupExpense: number;
  totalAllocatedGlobalOverhead: number;
  totalAdSpend: number;
  totalNetProfit: number;
  netMargin: number;
}

export interface ParentProfitabilityOverall {
  parentCount: number;
  totalSessions: number;
  totalStudents: number;
  totalRevenue: number;
  totalTeacherCost: number;
  totalDirectParentExpense: number;
  totalAllocatedGroupExpense: number;
  totalAllocatedGlobalOverhead: number;
  totalAdSpend: number;
  totalNetProfit: number;
  netMargin: number;
}

export interface ParentProfitabilityResponse {
  rows: ParentProfitabilityRow[];
  summaryByGroup: ParentProfitabilityGroupSummary[];
  overall: ParentProfitabilityOverall;
}

export interface RealizedCohortRow {
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
  projectionBasis: string;
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
}

export interface RealizedCohortSummary {
  totalSpend: number;
  totalImpressions: number;
  totalClicks: number;
  totalConversions: number;
  totalLeads: number;
  totalOrders: number;
  totalNewParents: number;
  totalCollectedRevenue: number;
  totalRemainingSessionUnits: number;
  totalRealizedParents: number;
  totalRealizedSessions: number;
  totalRealizedRevenue: number;
  totalRefundAmount: number;
  totalNetRealizedRevenue: number;
  totalProjectedRevenue: number;
  totalTeacherCost: number;
  totalDirectParentExpense: number;
  totalAllocatedGroupExpense: number;
  totalAllocatedGlobalOverhead: number;
  totalNetProfit: number;
  totalProjectedNetProfit: number;
  totalRoi: number;
  matureRowCount: number;
  immatureRowCount: number;
}

export interface RealizedCohortResponse {
  basis: string;
  maturityDays: number;
  realizedThrough: string;
  refundRatePercentX: number | null;
  rows: RealizedCohortRow[];
  matureRows: RealizedCohortRow[];
  summary: RealizedCohortSummary;
}

export interface AdSuggestionRow {
  adGroupId: string;
  adGroupName: string;
  platform: string;
  currentDailySpend: number;
  suggestedDailySpend: number;
  expectedDailyNetProfit: number | null;
  expectedDailyMarginalProfit: number | null;
  changePercent: number | null;
  confidence: string;
  dataPoints: number;
  maturityDays: number;
  averageCtr: number;
  averageLeadRate: number;
  averageProfitPerLead: number | null;
  observedAverageNetProfit: number;
  recommendation: string;
  recommendationReasons: string[];
}

export interface AdSuggestionSummaryRow {
  date: string;
  adGroupId: string;
  adGroupName: string;
  platform: string;
  maturityDays: number;
  cohortAgeDays: number;
  isMatured: boolean;
  impressions: number;
  clicks: number;
  conversions: number;
  leadCount: number;
  orderCount: number;
  newParentCount: number;
  collectedRevenue: number;
  remainingSessionUnits: number;
  scheduledRemainingSessionCount: number;
  realizedRevenue: number;
  netRealizedRevenue: number;
  projectedRevenue: number;
  estimatedRemainingRefund: number;
  estimatedRemainingTeacherCost: number;
  estimatedRemainingOtherCost: number;
  teacherCost: number;
  directParentExpense: number;
  allocatedGroupExpense: number;
  allocatedGlobalOverhead: number;
  netProfit: number;
  projectedNetProfit: number;
  effectiveNetProfit: number;
  projectionBasis: string;
  actualAdSpend: number;
  rawSuggestedAdSpend: number;
  suggestedAdSpend: number;
  previousDayAdSpend: number | null;
  capByPreviousDay: number | null;
  cappedByDailyGuard: boolean;
}

export interface AdSuggestionDailyTotalRow {
  date: string;
  totalNetProfit: number;
  totalSuggestedAdSpend: number;
}

export interface AdSuggestionMonthlyProjectionRow {
  month: string;
  daysInMonth: number;
  projectedSpend: number;
  projectedNetProfit: number;
}

export interface AdSuggestionResponse {
  basis: string;
  maturityDays: number;
  realizedThrough: string;
  refundRatePercentX: number | null;
  totalBudget: number;
  allocated: number;
  unallocated: number;
  totalSuggestedDailySpend: number;
  expectedDailyNetProfit: number;
  projectedMonthlySpend: number;
  projectedMonthlyNetProfit: number;
  dailySuggestedTotals: AdSuggestionDailyTotalRow[];
  monthlyProjection: AdSuggestionMonthlyProjectionRow[];
  summaryTable: AdSuggestionSummaryRow[];
  suggestions: AdSuggestionRow[];
}

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

export interface ActionsRequiredResponse {
  actions: ActionableSuggestion[];
  summary: {
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
  };
}

@Injectable({
  providedIn: 'root',
})
export class AdsService {
  private apiUrl = `${environment.apiBase}/ads`;

  constructor(private http: HttpClient) {}

  private buildParams(params?: Record<string, string>): HttpParams {
    let httpParams = new HttpParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value) httpParams = httpParams.set(key, value);
      });
    }
    return httpParams;
  }

  // â”€â”€â”€ Ad Accounts â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async listAccounts(params?: Record<string, string>): Promise<PaginatedResponse<AdAccountItem>> {
    return this.http.get<PaginatedResponse<AdAccountItem>>(
      `${this.apiUrl}/accounts`, { params: this.buildParams(params) },
    ).toPromise() as Promise<PaginatedResponse<AdAccountItem>>;
  }

  async createAccount(data: any): Promise<{ ok: boolean; message?: string }> {
    try {
      await this.http.post(`${this.apiUrl}/accounts`, data).toPromise();
      return { ok: true };
    } catch (err: any) {
      return { ok: false, message: err.error?.message || 'Táº¡o tÃ i khoáº£n tháº¥t báº¡i' };
    }
  }

  async updateAccount(id: string, data: any): Promise<{ ok: boolean; message?: string }> {
    try {
      await this.http.patch(`${this.apiUrl}/accounts/${id}`, data).toPromise();
      return { ok: true };
    } catch (err: any) {
      return { ok: false, message: err.error?.message || 'Cáº­p nháº­t tháº¥t báº¡i' };
    }
  }

  async deleteAccount(id: string): Promise<{ ok: boolean; message?: string }> {
    try {
      await this.http.delete(`${this.apiUrl}/accounts/${id}`).toPromise();
      return { ok: true };
    } catch (err: any) {
      return { ok: false, message: err.error?.message || 'XÃ³a tháº¥t báº¡i' };
    }
  }

  // â”€â”€â”€ Ad Groups â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async listGroups(params?: Record<string, string>): Promise<PaginatedResponse<AdGroupItem>> {
    return this.http.get<PaginatedResponse<AdGroupItem>>(
      `${this.apiUrl}/groups`, { params: this.buildParams(params) },
    ).toPromise() as Promise<PaginatedResponse<AdGroupItem>>;
  }

  async listAllGroups(): Promise<AdGroupItem[]> {
    return this.http.get<AdGroupItem[]>(`${this.apiUrl}/groups/all`).toPromise() as Promise<AdGroupItem[]>;
  }

  async getAllGroups(): Promise<AdGroupItem[]> {
    return this.http.get<AdGroupItem[]>(`${this.apiUrl}/groups/all`).toPromise() as Promise<AdGroupItem[]>;
  }

  async getGroupsByPlatform(platform: string): Promise<AdGroupItem[]> {
    return this.http.get<AdGroupItem[]>(
      `${this.apiUrl}/groups/by-platform/${platform}`,
    ).toPromise() as Promise<AdGroupItem[]>;
  }

  async createGroup(data: any): Promise<{ ok: boolean; message?: string }> {
    try {
      await this.http.post(`${this.apiUrl}/groups`, data).toPromise();
      return { ok: true };
    } catch (err: any) {
      return { ok: false, message: err.error?.message || 'Táº¡o nhÃ³m QC tháº¥t báº¡i' };
    }
  }

  async updateGroup(id: string, data: any): Promise<{ ok: boolean; message?: string }> {
    try {
      await this.http.patch(`${this.apiUrl}/groups/${id}`, data).toPromise();
      return { ok: true };
    } catch (err: any) {
      return { ok: false, message: err.error?.message || 'Cáº­p nháº­t tháº¥t báº¡i' };
    }
  }

  async deleteGroup(id: string): Promise<{ ok: boolean; message?: string }> {
    try {
      await this.http.delete(`${this.apiUrl}/groups/${id}`).toPromise();
      return { ok: true };
    } catch (err: any) {
      return { ok: false, message: err.error?.message || 'XÃ³a tháº¥t báº¡i' };
    }
  }

  // â”€â”€â”€ API Tokens â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async listTokens(accountId?: string): Promise<ApiTokenItem[]> {
    const params = accountId ? new HttpParams().set('accountId', accountId) : undefined;
    return this.http.get<ApiTokenItem[]>(
      `${this.apiUrl}/tokens`,
      { params },
    ).toPromise() as Promise<ApiTokenItem[]>;
  }

  async createToken(data: any): Promise<{ ok: boolean; message?: string }> {
    try {
      await this.http.post(`${this.apiUrl}/tokens`, data).toPromise();
      return { ok: true };
    } catch (err: any) {
      return { ok: false, message: err.error?.message || 'Táº¡o token tháº¥t báº¡i' };
    }
  }

  async updateToken(id: string, data: any): Promise<{ ok: boolean; message?: string }> {
    try {
      await this.http.patch(`${this.apiUrl}/tokens/${id}`, data).toPromise();
      return { ok: true };
    } catch (err: any) {
      return { ok: false, message: err.error?.message || 'Cáº­p nháº­t tháº¥t báº¡i' };
    }
  }

  async deleteToken(id: string): Promise<{ ok: boolean; message?: string }> {
    try {
      await this.http.delete(`${this.apiUrl}/tokens/${id}`).toPromise();
      return { ok: true };
    } catch (err: any) {
      return { ok: false, message: err.error?.message || 'XÃ³a tháº¥t báº¡i' };
    }
  }

  async syncFacebookBusinessToken(tokenId: string, date?: string): Promise<{ ok: boolean; message?: string; data?: any }> {
    try {
      let params = new HttpParams();
      if (date) params = params.set('date', date);
      const result = await this.http.post<any>(
        `${this.apiUrl}/tokens/${tokenId}/sync-facebook-business`,
        {},
        { params },
      ).toPromise();
      return { ok: true, data: result };
    } catch (err: any) {
      return { ok: false, message: err.error?.message || 'Đồng bộ BM Facebook thất bại' };
    }
  }

  async syncGoogleMccToken(tokenId: string, date?: string): Promise<{ ok: boolean; message?: string; data?: any }> {
    try {
      let params = new HttpParams();
      if (date) params = params.set('date', date);
      const result = await this.http.post<any>(
        `${this.apiUrl}/tokens/${tokenId}/sync-google-mcc`,
        {},
        { params },
      ).toPromise();
      return { ok: true, data: result };
    } catch (err: any) {
      return { ok: false, message: err.error?.message || 'Đồng bộ Google MCC thất bại' };
    }
  }

  async syncTikTokBusinessCenterToken(tokenId: string, date?: string): Promise<{ ok: boolean; message?: string; data?: any }> {
    try {
      let params = new HttpParams();
      if (date) params = params.set('date', date);
      const result = await this.http.post<any>(
        `${this.apiUrl}/tokens/${tokenId}/sync-tiktok-business-center`,
        {},
        { params },
      ).toPromise();
      return { ok: true, data: result };
    } catch (err: any) {
      return { ok: false, message: err.error?.message || 'Đồng bộ TikTok Business Center thất bại' };
    }
  }

  // â”€â”€â”€ Ad Costs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async listCosts(params?: Record<string, string>): Promise<PaginatedResponse<AdCostItem>> {
    return this.http.get<PaginatedResponse<AdCostItem>>(
      `${this.apiUrl}/costs`, { params: this.buildParams(params) },
    ).toPromise() as Promise<PaginatedResponse<AdCostItem>>;
  }

  async createCost(data: any): Promise<{ ok: boolean; message?: string }> {
    try {
      await this.http.post(`${this.apiUrl}/costs`, data).toPromise();
      return { ok: true };
    } catch (err: any) {
      return { ok: false, message: err.error?.message || 'Táº¡o chi phÃ­ tháº¥t báº¡i' };
    }
  }

  async deleteCost(id: string): Promise<{ ok: boolean; message?: string }> {
    try {
      await this.http.delete(`${this.apiUrl}/costs/${id}`).toPromise();
      return { ok: true };
    } catch (err: any) {
      return { ok: false, message: err.error?.message || 'XÃ³a tháº¥t báº¡i' };
    }
  }

  async triggerSync(accountId?: string): Promise<{ ok: boolean; message?: string; data?: any }> {
    try {
      const url = accountId ? `${this.apiUrl}/sync/${accountId}` : `${this.apiUrl}/sync`;
      const result = await this.http.post<any>(url, {}).toPromise();
      return { ok: true, data: result };
    } catch (err: any) {
      return { ok: false, message: err.error?.message || 'Äá»“ng bá»™ tháº¥t báº¡i' };
    }
  }

  async backfillParentAttribution(): Promise<{
    ok: boolean;
    message?: string;
    data?: ParentAttributionBackfillResult;
  }> {
    try {
      const result = await this.http.post<ParentAttributionBackfillResult>(
        `${this.apiUrl}/backfill-parent-attribution`,
        {},
      ).toPromise();
      return { ok: true, data: result || undefined };
    } catch (err: any) {
      return { ok: false, message: err.error?.message || 'Backfill parent attribution that bai' };
    }
  }

  async backfillAdGroupIds(): Promise<{
    ok: boolean;
    message?: string;
    data?: AdGroupBackfillResult;
  }> {
    try {
      const result = await this.http.post<AdGroupBackfillResult>(
        `${this.apiUrl}/backfill-adgroup`,
        {},
      ).toPromise();
      return { ok: true, data: result || undefined };
    } catch (err: any) {
      return { ok: false, message: err.error?.message || 'Backfill adGroup that bai' };
    }
  }

  // â”€â”€â”€ Analytics â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async getAnalytics(
    startDate: string,
    endDate: string,
    adGroupId?: string,
    platform?: string,
    maturityDays?: number,
    refundRatePercentX?: number,
  ): Promise<AdAnalyticsResponse> {
    let params = new HttpParams().set('startDate', startDate).set('endDate', endDate);
    if (adGroupId) params = params.set('adGroupId', adGroupId);
    if (platform) params = params.set('platform', platform);
    if (maturityDays !== undefined) params = params.set('maturityDays', String(maturityDays));
    if (refundRatePercentX !== undefined) params = params.set('refundRatePercentX', String(refundRatePercentX));
    return this.http.get<AdAnalyticsResponse>(
      `${this.apiUrl}/analytics`, { params },
    ).toPromise() as Promise<AdAnalyticsResponse>;
  }

  async getParentProfitability(
    startDate: string,
    endDate: string,
    adGroupId?: string,
    platform?: string,
  ): Promise<ParentProfitabilityResponse> {
    let params = new HttpParams().set('startDate', startDate).set('endDate', endDate);
    if (adGroupId) params = params.set('adGroupId', adGroupId);
    if (platform) params = params.set('platform', platform);
    return this.http.get<ParentProfitabilityResponse>(
      `${this.apiUrl}/analytics/parents-profit`,
      { params },
    ).toPromise() as Promise<ParentProfitabilityResponse>;
  }

  async getRealizedCohortAnalytics(
    startDate: string,
    endDate: string,
    maturityDays: number,
    adGroupId?: string,
    platform?: string,
    refundRatePercentX?: number,
  ): Promise<RealizedCohortResponse> {
    let params = new HttpParams()
      .set('startDate', startDate)
      .set('endDate', endDate)
      .set('maturityDays', String(maturityDays));
    if (adGroupId) params = params.set('adGroupId', adGroupId);
    if (platform) params = params.set('platform', platform);
    if (refundRatePercentX !== undefined) params = params.set('refundRatePercentX', String(refundRatePercentX));
    return this.http.get<RealizedCohortResponse>(
      `${this.apiUrl}/analytics/realized-cohort`, { params },
    ).toPromise() as Promise<RealizedCohortResponse>;
  }

  async getSuggestions(
    startDate: string,
    endDate: string,
    totalBudget: number,
    maturityDays: number,
    refundRatePercentX?: number,
  ): Promise<AdSuggestionResponse> {
    let params = new HttpParams()
      .set('startDate', startDate)
      .set('endDate', endDate)
      .set('totalBudget', String(totalBudget))
      .set('maturityDays', String(maturityDays));
    if (refundRatePercentX !== undefined) params = params.set('refundRatePercentX', String(refundRatePercentX));
    return this.http.get<AdSuggestionResponse>(
      `${this.apiUrl}/suggestions`, { params },
    ).toPromise() as Promise<AdSuggestionResponse>;
  }

  async getActionsRequired(params?: {
    refundRatePercentX?: number;
    lookbackDays?: number;
    targetProfitableRatio?: number;
    totalBudget?: number;
  }): Promise<ActionsRequiredResponse> {
    let httpParams = new HttpParams();
    if (params?.refundRatePercentX !== undefined)
      httpParams = httpParams.set('refundRatePercentX', String(params.refundRatePercentX));
    if (params?.lookbackDays !== undefined)
      httpParams = httpParams.set('lookbackDays', String(params.lookbackDays));
    if (params?.targetProfitableRatio !== undefined)
      httpParams = httpParams.set('targetProfitableRatio', String(params.targetProfitableRatio));
    if (params?.totalBudget !== undefined)
      httpParams = httpParams.set('totalBudget', String(params.totalBudget));
    return this.http.get<ActionsRequiredResponse>(
      `${this.apiUrl}/actions-required`, { params: httpParams },
    ).toPromise() as Promise<ActionsRequiredResponse>;
  }

  async createAdGroupDraftAction(payload: CampaignDraftRecommendation['payload']): Promise<any> {
    return this.http.post(`${environment.apiBase}/ai/actions/preview`, {
      actionKey: 'CREATE_AD_GROUP_DRAFT',
      entityType: 'ad_group',
      payload,
      sourceMessage: 'Created from ads actions draft recommendation',
    }).toPromise();
  }
}
