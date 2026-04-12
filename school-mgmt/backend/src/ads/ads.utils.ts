import { BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';

import { normalizePhone } from '../marketing-attribution/parent-attribution.util';
import {
  ParentProfitabilityAccumulator,
  ProfitProjectionBasis,
  ProfitProjectionProfile,
  RealizedCohortParentAccumulator,
  RealizedCohortRow,
} from './ads.types';

export function isDuplicateKeyError(err: any): boolean {
  return !!(err && (err.code === 11000 || String(err?.message || '').includes('E11000')));
}

export function normalizeToUtcDay(input: string | Date): Date {
  if (input instanceof Date) {
    if (Number.isNaN(input.getTime())) throw new BadRequestException('NgÃƒÂ y khÃƒÂ´ng hÃ¡Â»Â£p lÃ¡Â»â€¡');
    return new Date(Date.UTC(input.getUTCFullYear(), input.getUTCMonth(), input.getUTCDate()));
  }

  const raw = String(input || '').trim();
  const dateOnlyMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnlyMatch) {
    const year = Number(dateOnlyMatch[1]);
    const month = Number(dateOnlyMatch[2]) - 1;
    const day = Number(dateOnlyMatch[3]);
    return new Date(Date.UTC(year, month, day));
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) throw new BadRequestException('NgÃƒÂ y khÃƒÂ´ng hÃ¡Â»Â£p lÃ¡Â»â€¡');
  return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate()));
}

export function toUtcDateOnlyString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function getUtcDateRange(
  startDate: string,
  endDate: string,
  maxRangeDays?: number,
): { start: Date; end: Date } {
  const start = normalizeToUtcDay(startDate);
  const endDay = normalizeToUtcDay(endDate);
  if (endDay < start) {
    throw new BadRequestException('Khoáº£ng ngÃ y khÃ´ng há»£p lá»‡: endDate pháº£i >= startDate');
  }

  if (maxRangeDays && maxRangeDays > 0) {
    const diffMs = endDay.getTime() - start.getTime();
    const diffDays = Math.floor(diffMs / 86400000) + 1;
    if (diffDays > maxRangeDays) {
      throw new BadRequestException(`Khoảng ngày vượt quá ${maxRangeDays} ngày.`);
    }
  }

  const end = new Date(endDay);
  end.setUTCHours(23, 59, 59, 999);
  return { start, end };
}

export function parseOptionalObjectId(id?: string): Types.ObjectId | undefined {
  if (!id) return undefined;
  if (!Types.ObjectId.isValid(id)) {
    throw new BadRequestException('adGroupId khÃ´ng há»£p lá»‡');
  }
  return new Types.ObjectId(id);
}

export function groupDayKey(adGroupId: string, date: string): string {
  return `${adGroupId}_${date}`;
}

export function splitGroupDayKey(key: string): { adGroupId: string; date: string } {
  const pivot = key.indexOf('_');
  if (pivot <= 0) return { adGroupId: key, date: '' };
  return {
    adGroupId: key.slice(0, pivot),
    date: key.slice(pivot + 1),
  };
}

export function daysInMonth(date: Date): number {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
}

export function roundCurrency(value: number): number {
  return Math.round((Number(value) || 0) * 100) / 100;
}

export function normalizeMaturityDays(maturityDays?: number): number {
  const normalized = Math.round(Number(maturityDays || 60));
  if (!Number.isFinite(normalized) || normalized < 1) return 60;
  return Math.min(180, normalized);
}

export function normalizeRefundRatePercentX(refundRatePercentX?: number | null): number | null {
  if (refundRatePercentX === undefined || refundRatePercentX === null) return null;
  const normalized = roundCurrency(Number(refundRatePercentX));
  if (!Number.isFinite(normalized)) return null;
  return Math.min(100, Math.max(0, normalized));
}

export function addUtcDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function isDateWithinInclusiveRange(date: Date | undefined, start: Date, end: Date): boolean {
  if (!date) return false;
  return date.getTime() >= start.getTime() && date.getTime() <= end.getTime();
}

export function ensureParentAccumulator(
  rows: Map<string, ParentProfitabilityAccumulator>,
  parentKey: string,
): ParentProfitabilityAccumulator {
  let row = rows.get(parentKey);
  if (!row) {
    row = {
      parentKey,
      adGroupId: '',
      adGroupName: 'UNATTRIBUTED',
      platform: '',
      sessionCount: 0,
      studentIds: new Set<string>(),
      revenue: 0,
      teacherCost: 0,
      directParentExpense: 0,
      allocatedGroupExpense: 0,
      allocatedGlobalOverhead: 0,
      allocatedAdSpend: 0,
    };
    rows.set(parentKey, row);
  }
  return row;
}

export function mergeParentIdentity(
  row: ParentProfitabilityAccumulator,
  input: {
    parentUserId?: string | Types.ObjectId | null;
    parentPhone?: string | null;
    parentName?: string | null;
    adGroupId?: string | Types.ObjectId | null;
    adGroupName?: string | null;
    platform?: string | null;
    attributedAt?: Date | null;
  },
): void {
  if (input.parentUserId) row.parentUserId = input.parentUserId.toString();
  if (input.parentPhone && !row.parentPhone) row.parentPhone = input.parentPhone;
  const normalizedParentPhone = normalizePhone(input.parentPhone);
  if (normalizedParentPhone && !row.normalizedParentPhone) {
    row.normalizedParentPhone = normalizedParentPhone;
  }
  if (input.parentName && !row.parentName) row.parentName = input.parentName;
  if (input.adGroupId && !row.adGroupId) row.adGroupId = input.adGroupId.toString();
  if (input.adGroupName && (!row.adGroupName || row.adGroupName === 'UNATTRIBUTED')) {
    row.adGroupName = input.adGroupName;
  }
  if (input.platform && !row.platform) row.platform = input.platform;
  if (input.attributedAt && (!row.attributedAt || input.attributedAt < row.attributedAt)) {
    row.attributedAt = input.attributedAt;
  }
}

export function ensureRealizedCohortAccumulator(
  rows: Map<string, RealizedCohortParentAccumulator>,
  input: {
    parentKey: string;
    adGroupId?: string | Types.ObjectId | null;
    adGroupName?: string | null;
    platform?: string | null;
    attributedAt: Date;
    cohortDate: string;
    cohortStart: Date;
    observationEnd: Date;
    cohortAgeDays: number;
    isMatured: boolean;
    parentUserId?: string | Types.ObjectId | null;
    parentPhone?: string | null;
    parentName?: string | null;
  },
): RealizedCohortParentAccumulator {
  let row = rows.get(input.parentKey);
  if (!row) {
    row = {
      parentKey: input.parentKey,
      parentUserId: input.parentUserId ? input.parentUserId.toString() : undefined,
      parentPhone: input.parentPhone || undefined,
      normalizedParentPhone: normalizePhone(input.parentPhone),
      parentName: input.parentName || undefined,
      adGroupId: input.adGroupId ? input.adGroupId.toString() : '',
      adGroupName: input.adGroupName || 'UNATTRIBUTED',
      platform: input.platform || '',
      attributedAt: input.attributedAt,
      cohortDate: input.cohortDate,
      cohortStart: input.cohortStart,
      observationEnd: input.observationEnd,
      cohortAgeDays: input.cohortAgeDays,
      isMatured: input.isMatured,
      sessionCount: 0,
      studentIds: new Set<string>(),
      realizedSessionIds: new Set<string>(),
      revenue: 0,
      collectedRevenue: 0,
      remainingSessionUnits: 0,
      scheduledRemainingSessionCount: 0,
      scheduledRemainingTeacherCost: 0,
      refundAmount: 0,
      teacherCost: 0,
      directParentExpense: 0,
      allocatedGroupExpense: 0,
      allocatedGlobalOverhead: 0,
      allocatedAdSpend: 0,
    };
    rows.set(input.parentKey, row);
  }

  if (input.parentUserId) row.parentUserId = input.parentUserId.toString();
  if (input.parentPhone && !row.parentPhone) row.parentPhone = input.parentPhone;
  if (input.parentPhone && !row.normalizedParentPhone) {
    row.normalizedParentPhone = normalizePhone(input.parentPhone);
  }
  if (input.parentName && !row.parentName) row.parentName = input.parentName;
  if (input.adGroupId && !row.adGroupId) row.adGroupId = input.adGroupId.toString();
  if (input.adGroupName && (!row.adGroupName || row.adGroupName === 'UNATTRIBUTED')) {
    row.adGroupName = input.adGroupName;
  }
  if (input.platform && !row.platform) row.platform = input.platform;
  if (input.attributedAt && (!row.attributedAt || input.attributedAt < row.attributedAt)) {
    row.attributedAt = input.attributedAt;
  }

  return row;
}

export function allocateSharedAmount<T extends {
  revenue: number;
  sessionCount: number;
  allocatedGroupExpense: number;
  allocatedGlobalOverhead: number;
  allocatedAdSpend: number;
}>(
  rows: T[],
  amount: number,
  targetField: 'allocatedGroupExpense' | 'allocatedGlobalOverhead' | 'allocatedAdSpend',
): void {
  const normalizedAmount = Number(amount || 0);
  if (!rows.length || normalizedAmount <= 0) return;

  const revenueWeight = rows.reduce((sum, row) => sum + Math.max(0, row.revenue), 0);
  const sessionWeight = rows.reduce((sum, row) => sum + Math.max(0, row.sessionCount), 0);
  const equalWeight = rows.length;
  const denominator = revenueWeight || sessionWeight || equalWeight;

  if (!denominator) return;

  let remaining = normalizedAmount;
  rows.forEach((row, index) => {
    const weight = revenueWeight
      ? Math.max(0, row.revenue)
      : sessionWeight
        ? Math.max(0, row.sessionCount)
        : 1;
    const allocated = index === rows.length - 1
      ? remaining
      : roundCurrency((normalizedAmount * weight) / denominator);
    row[targetField] += allocated;
    remaining = roundCurrency(remaining - allocated);
  });
}

export function buildProfitProjectionProfile(
  rows: Array<Pick<
    RealizedCohortRow,
    'realizedRevenue'
    | 'realizedSessionCount'
    | 'refundAmount'
    | 'teacherCost'
    | 'directParentExpense'
    | 'allocatedGroupExpense'
    | 'allocatedGlobalOverhead'
  >>,
): ProfitProjectionProfile | null {
  const realizedRevenue = rows.reduce((sum, row) => sum + Math.max(0, row.realizedRevenue), 0);
  if (realizedRevenue <= 0) return null;
  const realizedSessionCount = rows.reduce((sum, row) => sum + Math.max(0, row.realizedSessionCount), 0);
  const teacherCost = rows.reduce((sum, row) => sum + row.teacherCost, 0);
  const otherCost = rows.reduce(
    (sum, row) => sum + row.directParentExpense + row.allocatedGroupExpense + row.allocatedGlobalOverhead,
    0,
  );
  const refundAmount = rows.reduce((sum, row) => sum + row.refundAmount, 0);
  return {
    teacherCostRate: teacherCost / realizedRevenue,
    otherCostRate: otherCost / realizedRevenue,
    refundRate: refundAmount / realizedRevenue,
    teacherCostPerSession: realizedSessionCount > 0 ? teacherCost / realizedSessionCount : null,
    otherCostPerSession: realizedSessionCount > 0 ? otherCost / realizedSessionCount : null,
  };
}

export function buildProfitProjectionProfileMap(
  rows: RealizedCohortRow[],
  keyResolver: (row: RealizedCohortRow) => string,
): Map<string, ProfitProjectionProfile> {
  const buckets = new Map<string, RealizedCohortRow[]>();
  for (const row of rows) {
    if (row.realizedRevenue <= 0) continue;
    const key = keyResolver(row);
    if (!key) continue;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(row);
  }

  const profiles = new Map<string, ProfitProjectionProfile>();
  for (const [key, bucketRows] of buckets) {
    const profile = buildProfitProjectionProfile(bucketRows);
    if (profile) profiles.set(key, profile);
  }
  return profiles;
}

export function resolveProfitProjection(
  row: RealizedCohortRow,
  profiles: {
    groupMature: Map<string, ProfitProjectionProfile>;
    platformMature: Map<string, ProfitProjectionProfile>;
    overallMature: ProfitProjectionProfile | null;
    groupLive: Map<string, ProfitProjectionProfile>;
    platformLive: Map<string, ProfitProjectionProfile>;
    overallLive: ProfitProjectionProfile | null;
  },
): { profile: ProfitProjectionProfile; basis: ProfitProjectionBasis } | null {
  const candidates: Array<{ profile: ProfitProjectionProfile | null | undefined; basis: ProfitProjectionBasis }> = [
    { profile: profiles.groupMature.get(row.adGroupId), basis: 'GROUP_MATURE_MARGIN' },
    { profile: profiles.platformMature.get(row.platform), basis: 'PLATFORM_MATURE_MARGIN' },
    { profile: profiles.overallMature, basis: 'GLOBAL_MATURE_MARGIN' },
    { profile: profiles.groupLive.get(row.adGroupId), basis: 'GROUP_LIVE_MARGIN' },
    { profile: profiles.platformLive.get(row.platform), basis: 'PLATFORM_LIVE_MARGIN' },
    { profile: profiles.overallLive, basis: 'GLOBAL_LIVE_MARGIN' },
  ];

  for (const candidate of candidates) {
    if (candidate.profile) {
      return {
        profile: candidate.profile,
        basis: candidate.basis,
      };
    }
  }

  return null;
}

export function buildSuggestionRecommendation(input: {
  dataPoints: number;
  groupRoi: number;
  averageCtr: number;
  averageLeadRate: number;
  averageProfitPerLead: number | null;
  overallCtr: number;
  overallLeadRate: number;
  overallRoi: number;
  fitR2: number;
}): { recommendation: string; reasons: string[] } {
  const reasons: string[] = [];

  if (input.dataPoints < 5) {
    reasons.push('Chưa đủ điểm dữ liệu profit thực/dự kiến để scale. Giữ ngân sách nhỏ và tiếp tục gom thêm dữ liệu thu tiền.');
  }

  if (input.groupRoi < 0 && input.averageCtr > 0 && input.overallCtr > 0 && input.averageCtr < input.overallCtr * 0.85) {
    reasons.push('CTR thấp hơn mặt bằng. Ưu tiên thay creative/hook trước khi tăng ngân sách.');
  }

  if (
    input.groupRoi < 0
    && input.averageLeadRate > 0
    && input.overallLeadRate > 0
    && input.averageLeadRate < input.overallLeadRate * 0.85
  ) {
    reasons.push('Click có nhưng lead rate yếu. Cần sửa funnel, CTA hoặc chat script.');
  }

  if (input.averageProfitPerLead !== null && input.averageProfitPerLead < 0) {
    reasons.push('Mỗi lead đang tạo lỗ thực. Không nên scale cho tới khi sửa chuyển đổi hoặc biên dịch vụ.');
  }

  if (input.groupRoi >= input.overallRoi && input.groupRoi > 0 && input.fitR2 >= 0.2) {
    reasons.push('ROI cohort thực/dự kiến tốt hơn mặt bằng và đường lợi nhuận đủ rõ để tăng ngân sách từng bước nhỏ.');
  }

  if (!reasons.length) {
    reasons.push('Giữ mức chi hiện tại và theo dõi thêm dữ liệu thu tiền cùng lợi nhuận dự kiến trước khi điều chỉnh mạnh.');
  }

  return {
    recommendation: reasons[0],
    reasons,
  };
}

export function fitLogCurve(xValues: number[], yValues: number[]): { a: number; b: number; rSquared: number } {
  const n = xValues.length;
  if (n < 2) return { a: 0, b: 0, rSquared: 0 };

  const xTransformed = xValues.map((x) => Math.log(x + 1));
  const yTransformed = yValues;

  const sumX = xTransformed.reduce((sum, value) => sum + value, 0);
  const sumY = yTransformed.reduce((sum, value) => sum + value, 0);
  const sumXY = xTransformed.reduce((sum, value, index) => sum + value * yTransformed[index], 0);
  const sumXX = xTransformed.reduce((sum, value) => sum + value * value, 0);

  const denominator = n * sumXX - sumX * sumX;
  if (Math.abs(denominator) < 1e-10) return { a: 0, b: sumY / n, rSquared: 0 };

  const a = (n * sumXY - sumX * sumY) / denominator;
  const b = (sumY - a * sumX) / n;

  const meanY = sumY / n;
  const ssTotal = yTransformed.reduce((sum, y) => sum + (y - meanY) ** 2, 0);
  const ssResidual = yTransformed.reduce((sum, y, index) => sum + (y - (a * xTransformed[index] + b)) ** 2, 0);
  const rSquared = ssTotal > 0 ? 1 - ssResidual / ssTotal : 0;

  return { a, b, rSquared: Math.max(0, rSquared) };
}

export async function fetchWithRetry(url: string, options: any = {}, retries = 3): Promise<any> {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options);
      if (!response.ok) {
        const body = await response.text();
        throw new Error(`HTTP ${response.status}: ${body}`);
      }
      return response.json();
    } catch (err: any) {
      if (i === retries - 1) throw err;
      await new Promise(r => setTimeout(r, 1000 * Math.pow(2, i)));
    }
  }
}