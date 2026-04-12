import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AdCost, AdCostDocument } from './schemas/ad-cost.schema';
import { AdGroup, AdGroupDocument } from './schemas/ad-group.schema';
import { Expense, ExpenseDocument } from '../expenses/schemas/expense.schema';
import { Session, SessionDocument } from '../sessions/schemas/session.schema';
import { Student, StudentDocument } from '../students/schemas/student.schema';
import { ParentAttribution, ParentAttributionDocument } from '../marketing-attribution/schemas/parent-attribution.schema';
import { SessionStatus } from '../sessions/schemas/session.schema';
import { PaymentStatus, ExpenseAllocationScope } from '../expenses/schemas/expense.schema';
import { normalizePhone, buildParentKey } from '../marketing-attribution/parent-attribution.util';
import { ParentProfitabilityAccumulator, ParentProfitabilityRow } from './ads.types';

import {
  allocateSharedAmount,
  ensureParentAccumulator,
  getUtcDateRange,
  mergeParentIdentity,
  parseOptionalObjectId,
  roundCurrency,
} from './ads.utils';

@Injectable()
export class AdsAnalyticsParentService {
  private readonly logger = new Logger(AdsAnalyticsParentService.name);
  private readonly maxAnalyticsRangeDays = 366;

  constructor(
    @InjectModel(AdCost.name) private readonly adCostModel: Model<AdCostDocument>,
    @InjectModel(AdGroup.name) private readonly adGroupModel: Model<AdGroupDocument>,
    @InjectModel(Expense.name) private readonly expenseModel: Model<ExpenseDocument>,
    @InjectModel(Session.name) private readonly sessionModel: Model<SessionDocument>,
    @InjectModel(Student.name) private readonly studentModel: Model<StudentDocument>,
    @InjectModel(ParentAttribution.name) private readonly parentAttributionModel: Model<ParentAttributionDocument>,
  ) {}

  async getParentProfitability(
    startDate: string,
    endDate: string,
    adGroupId?: string,
    platform?: string,
  ): Promise<any> {
    const { start, end } = getUtcDateRange(startDate, endDate, this.maxAnalyticsRangeDays);
    const adGroupObjectId = parseOptionalObjectId(adGroupId);

    const [attributions, sessions, expenses, adCosts] = await Promise.all([
      this.parentAttributionModel.find(adGroupObjectId ? { adGroupId: adGroupObjectId } : {})
        .select('parentKey parentUserId parentPhone normalizedParentPhone adGroupId adGroupName platform firstAttributedAt')
        .lean(),
      this.sessionModel.find({
        status: SessionStatus.FINALIZED,
        scheduledDate: { $gte: start, $lte: end },
      })
        .select('parentUserId studentId adGroupId adGroupName amountCharged teacherPayout')
        .lean(),
      this.expenseModel.find({
        paymentStatus: { $in: [PaymentStatus.PAID, PaymentStatus.APPROVED_UNPAID] },
        expenseDate: { $gte: start, $lte: end },
      })
        .select('allocationScope adGroupId adGroupName parentUserId parentPhone normalizedParentPhone amount')
        .lean(),
      this.adCostModel.aggregate([
        { $match: { date: { $gte: start, $lte: end } } },
        {
          $group: {
            _id: '$adGroupId',
            totalSpend: { $sum: { $ifNull: ['$spend', 0] } },
            adGroupName: { $first: '$adGroupName' },
            platform: { $first: '$platform' },
          },
        },
      ]),
    ]);

    const studentIds = Array.from(new Set(
      sessions
        .map((session: any) => session.studentId?.toString?.())
        .filter((id: string | undefined): id is string => !!id && Types.ObjectId.isValid(id)),
    )).map((id) => new Types.ObjectId(id));
    const students = studentIds.length
      ? await this.studentModel.find({ _id: { $in: studentIds } })
        .select('_id parentUserId parentPhone parentName adGroupId adGroupName')
        .lean()
      : [];
    const studentMap = new Map<string, any>(
      students.map((student: any) => [student._id.toString(), student]),
    );

    const parentRows = new Map<string, ParentProfitabilityAccumulator>();
    const aliasMap = new Map<string, string>();
    const groupIds = new Set<string>();
    const groupMetaSeed = new Map<string, { name?: string; platform?: string }>();

    const registerAliases = (
      targetParentKey: string,
      parentUserId?: string | Types.ObjectId | null,
      parentPhone?: string | null,
    ) => {
      if (parentUserId) aliasMap.set(`user:${parentUserId.toString()}`, targetParentKey);
      const normalizedParentPhone = normalizePhone(parentPhone);
      if (normalizedParentPhone) aliasMap.set(`phone:${normalizedParentPhone}`, targetParentKey);
    };

    const resolveMappedParentKey = (
      parentUserId?: string | Types.ObjectId | null,
      parentPhone?: string | null,
    ): string | null => {
      if (parentUserId) {
        const mapped = aliasMap.get(`user:${parentUserId.toString()}`);
        if (mapped) return mapped;
      }
      const normalizedParentPhone = normalizePhone(parentPhone);
      if (normalizedParentPhone) {
        const mapped = aliasMap.get(`phone:${normalizedParentPhone}`);
        if (mapped) return mapped;
      }
      return buildParentKey(parentUserId, parentPhone);
    };

    for (const attribution of attributions as any[]) {
      const parentKey = attribution.parentKey
        || buildParentKey(attribution.parentUserId, attribution.parentPhone || attribution.normalizedParentPhone);
      if (!parentKey) continue;

      const row = ensureParentAccumulator(parentRows, parentKey);
      mergeParentIdentity(row, {
        parentUserId: attribution.parentUserId,
        parentPhone: attribution.parentPhone || attribution.normalizedParentPhone,
        adGroupId: attribution.adGroupId,
        adGroupName: attribution.adGroupName,
        platform: attribution.platform,
        attributedAt: attribution.firstAttributedAt,
      });
      registerAliases(parentKey, attribution.parentUserId, attribution.parentPhone || attribution.normalizedParentPhone);
      if (attribution.adGroupId) {
        const groupId = attribution.adGroupId.toString();
        groupIds.add(groupId);
        groupMetaSeed.set(groupId, {
          name: attribution.adGroupName,
          platform: attribution.platform,
        });
      }
    }

    for (const session of sessions as any[]) {
      const student = studentMap.get(session.studentId?.toString?.());
      const parentKey = resolveMappedParentKey(session.parentUserId || student?.parentUserId, student?.parentPhone);
      if (!parentKey) continue;

      const row = ensureParentAccumulator(parentRows, parentKey);
      mergeParentIdentity(row, {
        parentUserId: session.parentUserId || student?.parentUserId,
        parentPhone: student?.parentPhone,
        parentName: student?.parentName,
        adGroupId: student?.adGroupId || session.adGroupId,
        adGroupName: student?.adGroupName || session.adGroupName,
      });
      registerAliases(parentKey, session.parentUserId || student?.parentUserId, student?.parentPhone);

      if (student?._id) row.studentIds.add(student._id.toString());
      row.sessionCount += 1;
      row.revenue += Number(session.amountCharged || 0);
      row.teacherCost += Number(session.teacherPayout || 0);
      if (row.adGroupId) groupIds.add(row.adGroupId);
    }

    let totalGlobalExpense = 0;
    const groupExpenseMap = new Map<string, { amount: number; adGroupName?: string }>();
    for (const expense of expenses as any[]) {
      const amount = Number(expense.amount || 0);
      if (amount <= 0) continue;

      const allocationScope = expense.allocationScope || ExpenseAllocationScope.GLOBAL;
      if (allocationScope === ExpenseAllocationScope.PARENT) {
        const parentKey = resolveMappedParentKey(
          expense.parentUserId,
          expense.parentPhone || expense.normalizedParentPhone,
        );
        if (!parentKey) continue;

        const row = ensureParentAccumulator(parentRows, parentKey);
        mergeParentIdentity(row, {
          parentUserId: expense.parentUserId,
          parentPhone: expense.parentPhone || expense.normalizedParentPhone,
        });
        registerAliases(parentKey, expense.parentUserId, expense.parentPhone || expense.normalizedParentPhone);
        row.directParentExpense += amount;
        continue;
      }

      if (allocationScope === ExpenseAllocationScope.AD_GROUP && expense.adGroupId) {
        const groupId = expense.adGroupId.toString();
        const existing = groupExpenseMap.get(groupId) || { amount: 0, adGroupName: expense.adGroupName };
        existing.amount += amount;
        if (!existing.adGroupName && expense.adGroupName) existing.adGroupName = expense.adGroupName;
        groupExpenseMap.set(groupId, existing);
        groupIds.add(groupId);
        if (expense.adGroupName) groupMetaSeed.set(groupId, { name: expense.adGroupName });
        continue;
      }

      totalGlobalExpense += amount;
    }

    for (const cost of adCosts as any[]) {
      const groupId = cost._id?.toString?.();
      if (!groupId) continue;
      groupIds.add(groupId);
      groupMetaSeed.set(groupId, {
        name: cost.adGroupName || groupMetaSeed.get(groupId)?.name,
        platform: cost.platform || groupMetaSeed.get(groupId)?.platform,
      });
    }

    const groupObjectIds = Array.from(groupIds)
      .filter((id) => Types.ObjectId.isValid(id))
      .map((id) => new Types.ObjectId(id));
    const adGroups = groupObjectIds.length
      ? await this.adGroupModel.find({ _id: { $in: groupObjectIds } }).select('_id name platform').lean()
      : [];
    const adGroupMetaMap = new Map<string, { name?: string; platform?: string }>(
      adGroups.map((group: any) => [
        group._id.toString(),
        {
          name: group.name || groupMetaSeed.get(group._id.toString())?.name,
          platform: group.platform || groupMetaSeed.get(group._id.toString())?.platform,
        },
      ]),
    );

    for (const [groupId, seed] of groupMetaSeed.entries()) {
      if (!adGroupMetaMap.has(groupId)) {
        adGroupMetaMap.set(groupId, seed);
      }
    }

    const rawRows = Array.from(parentRows.values());
    for (const row of rawRows) {
      if (row.adGroupId) {
        const meta = adGroupMetaMap.get(row.adGroupId);
        if (meta?.name && (!row.adGroupName || row.adGroupName === 'UNATTRIBUTED')) row.adGroupName = meta.name;
        if (meta?.platform && !row.platform) row.platform = meta.platform;
      }
    }

    allocateSharedAmount(rawRows, totalGlobalExpense, 'allocatedGlobalOverhead');

    const rowsByGroup = new Map<string, ParentProfitabilityAccumulator[]>();
    for (const row of rawRows) {
      const groupKey = row.adGroupId || '__UNATTRIBUTED__';
      if (!rowsByGroup.has(groupKey)) rowsByGroup.set(groupKey, []);
      rowsByGroup.get(groupKey)!.push(row);
    }

    for (const [groupId, expenseData] of groupExpenseMap.entries()) {
      allocateSharedAmount(rowsByGroup.get(groupId) || [], expenseData.amount, 'allocatedGroupExpense');
    }
    for (const cost of adCosts as any[]) {
      const groupId = cost._id?.toString?.();
      if (!groupId) continue;
      allocateSharedAmount(
        rowsByGroup.get(groupId) || [],
        Number(cost.totalSpend || 0),
        'allocatedAdSpend',
      );
    }

    const rows: ParentProfitabilityRow[] = rawRows
      .map((row) => {
        const revenue = roundCurrency(row.revenue);
        const teacherCost = roundCurrency(row.teacherCost);
        const directParentExpense = roundCurrency(row.directParentExpense);
        const allocatedGroupExpense = roundCurrency(row.allocatedGroupExpense);
        const allocatedGlobalOverhead = roundCurrency(row.allocatedGlobalOverhead);
        const allocatedAdSpend = roundCurrency(row.allocatedAdSpend);
        const netProfit = roundCurrency(
          revenue
          - teacherCost
          - directParentExpense
          - allocatedGroupExpense
          - allocatedGlobalOverhead
          - allocatedAdSpend,
        );

        return {
          parentKey: row.parentKey,
          parentUserId: row.parentUserId,
          parentPhone: row.parentPhone,
          normalizedParentPhone: row.normalizedParentPhone,
          parentName: row.parentName,
          adGroupId: row.adGroupId || '',
          adGroupName: row.adGroupName || 'UNATTRIBUTED',
          platform: row.platform || adGroupMetaMap.get(row.adGroupId)?.platform || '',
          attributedAt: row.attributedAt?.toISOString(),
          sessionCount: row.sessionCount,
          studentCount: row.studentIds.size,
          revenue,
          teacherCost,
          directParentExpense,
          allocatedGroupExpense,
          allocatedGlobalOverhead,
          allocatedAdSpend,
          netProfit,
          netMargin: revenue > 0 ? roundCurrency((netProfit / revenue) * 100) : 0,
        };
      })
      .filter((row) => {
        if (adGroupObjectId && row.adGroupId !== adGroupObjectId.toString()) return false;
        if (platform && row.platform !== platform) return false;
        return (
          row.sessionCount > 0
          || row.revenue > 0
          || row.teacherCost > 0
          || row.directParentExpense > 0
          || row.allocatedGroupExpense > 0
          || row.allocatedGlobalOverhead > 0
          || row.allocatedAdSpend > 0
          || !!row.attributedAt
        );
      })
      .sort((a, b) => b.netProfit - a.netProfit || b.revenue - a.revenue || a.parentKey.localeCompare(b.parentKey));

    const summaryByGroupMap = new Map<string, any>();
    for (const row of rows) {
      const groupKey = row.adGroupId || '__UNATTRIBUTED__';
      if (!summaryByGroupMap.has(groupKey)) {
        summaryByGroupMap.set(groupKey, {
          adGroupId: row.adGroupId,
          adGroupName: row.adGroupName || 'UNATTRIBUTED',
          platform: row.platform,
          parentCount: 0,
          totalSessions: 0,
          totalStudents: 0,
          totalRevenue: 0,
          totalTeacherCost: 0,
          totalDirectParentExpense: 0,
          totalAllocatedGroupExpense: 0,
          totalAllocatedGlobalOverhead: 0,
          totalAdSpend: 0,
          totalNetProfit: 0,
        });
      }
      const summary = summaryByGroupMap.get(groupKey);
      summary.parentCount += 1;
      summary.totalSessions += row.sessionCount;
      summary.totalStudents += row.studentCount;
      summary.totalRevenue += row.revenue;
      summary.totalTeacherCost += row.teacherCost;
      summary.totalDirectParentExpense += row.directParentExpense;
      summary.totalAllocatedGroupExpense += row.allocatedGroupExpense;
      summary.totalAllocatedGlobalOverhead += row.allocatedGlobalOverhead;
      summary.totalAdSpend += row.allocatedAdSpend;
      summary.totalNetProfit += row.netProfit;
    }

    const summaryByGroup = Array.from(summaryByGroupMap.values())
      .map((summary) => ({
        ...summary,
        totalRevenue: roundCurrency(summary.totalRevenue),
        totalTeacherCost: roundCurrency(summary.totalTeacherCost),
        totalDirectParentExpense: roundCurrency(summary.totalDirectParentExpense),
        totalAllocatedGroupExpense: roundCurrency(summary.totalAllocatedGroupExpense),
        totalAllocatedGlobalOverhead: roundCurrency(summary.totalAllocatedGlobalOverhead),
        totalAdSpend: roundCurrency(summary.totalAdSpend),
        totalNetProfit: roundCurrency(summary.totalNetProfit),
        netMargin: summary.totalRevenue > 0
          ? roundCurrency((summary.totalNetProfit / summary.totalRevenue) * 100)
          : 0,
      }))
      .sort((a, b) => b.totalNetProfit - a.totalNetProfit || b.totalRevenue - a.totalRevenue);

    const overall = {
      parentCount: rows.length,
      totalSessions: rows.reduce((sum, row) => sum + row.sessionCount, 0),
      totalStudents: rows.reduce((sum, row) => sum + row.studentCount, 0),
      totalRevenue: roundCurrency(rows.reduce((sum, row) => sum + row.revenue, 0)),
      totalTeacherCost: roundCurrency(rows.reduce((sum, row) => sum + row.teacherCost, 0)),
      totalDirectParentExpense: roundCurrency(rows.reduce((sum, row) => sum + row.directParentExpense, 0)),
      totalAllocatedGroupExpense: roundCurrency(rows.reduce((sum, row) => sum + row.allocatedGroupExpense, 0)),
      totalAllocatedGlobalOverhead: roundCurrency(rows.reduce((sum, row) => sum + row.allocatedGlobalOverhead, 0)),
      totalAdSpend: roundCurrency(rows.reduce((sum, row) => sum + row.allocatedAdSpend, 0)),
      totalNetProfit: roundCurrency(rows.reduce((sum, row) => sum + row.netProfit, 0)),
      netMargin: 0,
    };
    if (overall.totalRevenue > 0) {
      overall.netMargin = roundCurrency((overall.totalNetProfit / overall.totalRevenue) * 100);
    }

    return { rows, summaryByGroup, overall };
  }
}
