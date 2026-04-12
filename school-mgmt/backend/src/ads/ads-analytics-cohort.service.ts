import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AdCost, AdCostDocument } from './schemas/ad-cost.schema';
import { AdGroup, AdGroupDocument } from './schemas/ad-group.schema';
import { Expense, ExpenseDocument } from '../expenses/schemas/expense.schema';
import { Invoice, InvoiceDocument } from '../invoices/schemas/invoice.schema';
import { Lead, LeadDocument } from '../leads/schemas/lead.schema';
import { LedgerEntry, LedgerEntryDocument } from '../wallets/schemas/ledger-entry.schema';
import { Order, OrderDocument } from '../orders/schemas/order.schema';
import { ParentAttribution, ParentAttributionDocument } from '../marketing-attribution/schemas/parent-attribution.schema';
import { Session, SessionDocument } from '../sessions/schemas/session.schema';
import { Student, StudentDocument } from '../students/schemas/student.schema';
import { TransactionType, TransactionStatus } from '../wallets/schemas/ledger-entry.schema';
import { SessionStatus } from '../sessions/schemas/session.schema';
import { PaymentStatus, ExpenseAllocationScope } from '../expenses/schemas/expense.schema';
import { InvoiceType, InvoiceStatus } from '../invoices/schemas/invoice.schema';
import { normalizePhone, buildParentKey } from '../marketing-attribution/parent-attribution.util';
import { RealizedCohortParentAccumulator, RealizedCohortRow } from './ads.types';

import {
  addUtcDays,
  allocateSharedAmount,
  buildProfitProjectionProfile,
  buildProfitProjectionProfileMap,
  ensureRealizedCohortAccumulator,
  getUtcDateRange,
  groupDayKey,
  isDateWithinInclusiveRange,
  normalizeMaturityDays,
  normalizeRefundRatePercentX,
  normalizeToUtcDay,
  parseOptionalObjectId,
  resolveProfitProjection,
  roundCurrency,
  splitGroupDayKey,
  toUtcDateOnlyString,
} from './ads.utils';

@Injectable()
export class AdsAnalyticsCohortService {
  private readonly logger = new Logger(AdsAnalyticsCohortService.name);
  private readonly maxRealizedCohortRangeDays = 180;

  constructor(
    @InjectModel(AdCost.name) private readonly adCostModel: Model<AdCostDocument>,
    @InjectModel(AdGroup.name) private readonly adGroupModel: Model<AdGroupDocument>,
    @InjectModel(Expense.name) private readonly expenseModel: Model<ExpenseDocument>,
    @InjectModel(Invoice.name) private readonly invoiceModel: Model<InvoiceDocument>,
    @InjectModel(Lead.name) private readonly leadModel: Model<LeadDocument>,
    @InjectModel(LedgerEntry.name) private readonly ledgerEntryModel: Model<LedgerEntryDocument>,
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    @InjectModel(ParentAttribution.name) private readonly parentAttributionModel: Model<ParentAttributionDocument>,
    @InjectModel(Session.name) private readonly sessionModel: Model<SessionDocument>,
    @InjectModel(Student.name) private readonly studentModel: Model<StudentDocument>,
  ) {}

  async getRealizedCohortAnalytics(
    startDate: string,
    endDate: string,
    adGroupId?: string,
    platform?: string,
    maturityDays?: number,
    refundRatePercentX?: number,
  ): Promise<any> {
    const { start, end } = getUtcDateRange(startDate, endDate, this.maxRealizedCohortRangeDays);
    return this.buildRealizedCohortAnalytics(start, end, {
      adGroupObjectId: parseOptionalObjectId(adGroupId),
      platform,
      maturityDays: normalizeMaturityDays(maturityDays),
      refundRatePercentX: normalizeRefundRatePercentX(refundRatePercentX),
    });
  }

  async buildRealizedCohortAnalytics(
    start: Date,
    end: Date,
    options: {
      adGroupObjectId?: Types.ObjectId;
      platform?: string;
      maturityDays: number;
      refundRatePercentX: number | null;
    },
  ): Promise<{
    basis: string;
    maturityDays: number;
    realizedThrough: string;
    refundRatePercentX: number | null;
    rows: RealizedCohortRow[];
    matureRows: RealizedCohortRow[];
    summary: any;
  }> {
    const todayStart = normalizeToUtcDay(new Date());
    const todayEnd = new Date(todayStart);
    todayEnd.setUTCHours(23, 59, 59, 999);
    const realizedThrough = toUtcDateOnlyString(todayStart);
    const refundRatePercentX = normalizeRefundRatePercentX(options.refundRatePercentX);
    const refundRateOverride = refundRatePercentX !== null
      ? refundRatePercentX / 100
      : null;

    const attributionMatch: any = {
      adGroupId: { $exists: true, $ne: null },
      firstAttributedAt: { $gte: start, $lte: end },
    };
    if (options.adGroupObjectId) attributionMatch.adGroupId = options.adGroupObjectId;
    if (options.platform) attributionMatch.platform = options.platform;

    const attributions = await this.parentAttributionModel.find(attributionMatch)
      .select(
        'parentKey parentUserId parentPhone normalizedParentPhone adGroupId adGroupName platform firstAttributedAt',
      )
      .lean();

    const emptySummary = {
      totalSpend: 0,
      totalImpressions: 0,
      totalClicks: 0,
      totalConversions: 0,
      totalLeads: 0,
      totalOrders: 0,
      totalNewParents: 0,
      totalCollectedRevenue: 0,
      totalRemainingSessionUnits: 0,
      totalRealizedParents: 0,
      totalRealizedSessions: 0,
      totalRealizedRevenue: 0,
      totalRefundAmount: 0,
      totalNetRealizedRevenue: 0,
      totalProjectedRevenue: 0,
      totalTeacherCost: 0,
      totalDirectParentExpense: 0,
      totalAllocatedGroupExpense: 0,
      totalAllocatedGlobalOverhead: 0,
      totalNetProfit: 0,
      totalProjectedNetProfit: 0,
      totalRoi: 0,
      matureRowCount: 0,
      immatureRowCount: 0,
    };

    if (!attributions.length) {
      return {
        basis: 'REALIZED_SESSION_DEDUCT_REFUND + PROJECTED_APPROVED_TUITION_CASH_WITH_SESSION_COSTS',
        maturityDays: options.maturityDays,
        realizedThrough,
        refundRatePercentX,
        rows: [],
        matureRows: [],
        summary: emptySummary,
      };
    }

    const parentRows = new Map<string, RealizedCohortParentAccumulator>();
    const aliasMap = new Map<string, string>();
    const newParentCountMap = new Map<string, number>();
    const groupIds = new Set<string>();
    let maxObservationEnd = new Date(start);

    const registerAliases = (
      parentKey: string,
      parentUserId?: string | Types.ObjectId | null,
      parentPhone?: string | null,
    ) => {
      if (parentUserId) aliasMap.set(`user:${parentUserId.toString()}`, parentKey);
      const normalizedParentPhone = normalizePhone(parentPhone);
      if (normalizedParentPhone) aliasMap.set(`phone:${normalizedParentPhone}`, parentKey);
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
      const adGroupIdValue = attribution.adGroupId?.toString?.();
      if (!parentKey || !adGroupIdValue) continue;

      const attributedAt = new Date(attribution.firstAttributedAt);
      const cohortStart = normalizeToUtcDay(attributedAt);
      const cohortDate = toUtcDateOnlyString(cohortStart);
      const maturityEndDay = addUtcDays(cohortStart, options.maturityDays - 1);
      const cappedEndDay = maturityEndDay > todayStart ? todayStart : maturityEndDay;
      const observationEnd = new Date(cappedEndDay);
      observationEnd.setUTCHours(23, 59, 59, 999);
      const cohortAgeDays = Math.max(
        1,
        Math.floor((todayStart.getTime() - cohortStart.getTime()) / 86400000) + 1,
      );

      ensureRealizedCohortAccumulator(parentRows, {
        parentKey,
        adGroupId: attribution.adGroupId,
        adGroupName: attribution.adGroupName,
        platform: attribution.platform,
        attributedAt,
        cohortDate,
        cohortStart,
        observationEnd,
        cohortAgeDays,
        isMatured: cohortAgeDays >= options.maturityDays,
        parentUserId: attribution.parentUserId,
        parentPhone: attribution.parentPhone || attribution.normalizedParentPhone,
      });

      const cohortKey = groupDayKey(adGroupIdValue, cohortDate);
      newParentCountMap.set(cohortKey, (newParentCountMap.get(cohortKey) || 0) + 1);
      groupIds.add(adGroupIdValue);
      registerAliases(parentKey, attribution.parentUserId, attribution.parentPhone || attribution.normalizedParentPhone);
      if (observationEnd > maxObservationEnd) maxObservationEnd = observationEnd;
    }

    const leadMatch: any = {
      adGroupId: { $exists: true, $ne: null },
      createdAt: { $gte: start, $lte: end },
    };
    const orderMatch: any = {
      adGroupId: { $exists: true, $ne: null },
      createdAt: { $gte: start, $lte: end },
      status: { $in: ['APPROVED', 'COMPLETED'] },
    };
    const adCostMatch: any = { date: { $gte: start, $lte: end } };
    if (options.adGroupObjectId) {
      leadMatch.adGroupId = options.adGroupObjectId;
      orderMatch.adGroupId = options.adGroupObjectId;
      adCostMatch.adGroupId = options.adGroupObjectId;
    }
    if (options.platform) {
      leadMatch.source = options.platform;
      orderMatch.leadSource = options.platform;
      adCostMatch.platform = options.platform;
    }

    const [leadRows, orderRows, adCostRows, invoiceRows, ledgerEntries, expenses] = await Promise.all([
      this.leadModel.aggregate([
        { $match: leadMatch },
        {
          $group: {
            _id: {
              adGroupId: '$adGroupId',
              date: {
                $dateToString: {
                  format: '%Y-%m-%d',
                  date: '$createdAt',
                  timezone: 'UTC',
                },
              },
            },
            leadCount: { $sum: 1 },
          },
        },
      ]),
      this.orderModel.aggregate([
        { $match: orderMatch },
        {
          $group: {
            _id: {
              adGroupId: '$adGroupId',
              date: {
                $dateToString: {
                  format: '%Y-%m-%d',
                  date: '$createdAt',
                  timezone: 'UTC',
                },
              },
            },
            orderCount: { $sum: 1 },
          },
        },
      ]),
      this.adCostModel.aggregate([
        { $match: adCostMatch },
        {
          $group: {
            _id: {
              adGroupId: '$adGroupId',
              date: {
                $dateToString: {
                  format: '%Y-%m-%d',
                  date: '$date',
                  timezone: 'UTC',
                },
              },
            },
            adGroupName: { $first: '$adGroupName' },
            platform: { $first: '$platform' },
            spend: { $sum: { $ifNull: ['$spend', 0] } },
            impressions: { $sum: { $ifNull: ['$impressions', 0] } },
            clicks: { $sum: { $ifNull: ['$clicks', 0] } },
            conversions: { $sum: { $ifNull: ['$conversions', 0] } },
          },
        },
      ]),
      this.invoiceModel.find({
        invoiceType: InvoiceType.TUITION,
        status: { $in: [InvoiceStatus.APPROVED, InvoiceStatus.PAID] },
        paymentDate: { $gte: start, $lte: maxObservationEnd },
        studentId: { $exists: true, $ne: null },
      })
        .select('studentId amount paymentDate sessions sessionsRemaining pricePerSession')
        .lean(),
      this.ledgerEntryModel.find({
        type: { $in: [TransactionType.SESSION_DEDUCT, TransactionType.REFUND] },
        status: { $in: [TransactionStatus.COMPLETED, TransactionStatus.APPROVED] },
        createdAt: { $gte: start, $lte: maxObservationEnd },
        sessionId: { $exists: true, $ne: null },
      })
        .select('sessionId studentId userId type amount createdAt')
        .lean(),
      this.expenseModel.find({
        paymentStatus: { $in: [PaymentStatus.PAID, PaymentStatus.APPROVED_UNPAID] },
        expenseDate: { $gte: start, $lte: maxObservationEnd },
      })
        .select('allocationScope adGroupId parentUserId parentPhone normalizedParentPhone amount expenseDate')
        .lean(),
    ]);

    const sessionIds = Array.from(new Set(
      (ledgerEntries as any[])
        .map((entry) => entry.sessionId?.toString?.())
        .filter((id: string | undefined): id is string => !!id && Types.ObjectId.isValid(id)),
    )).map((id) => new Types.ObjectId(id));

    const sessions = sessionIds.length
      ? await this.sessionModel.find({ _id: { $in: sessionIds } })
        .select('_id studentId parentUserId adGroupId adGroupName teacherPayout amountCharged')
        .lean()
      : [];

    const studentIds = Array.from(new Set(
      [
        ...(sessions as any[]).map((session) => session.studentId?.toString?.()),
        ...(invoiceRows as any[]).map((invoice) => invoice.studentId?.toString?.()),
      ]
        .filter((id: string | undefined): id is string => !!id && Types.ObjectId.isValid(id)),
    )).map((id) => new Types.ObjectId(id));

    const students = studentIds.length
      ? await this.studentModel.find({ _id: { $in: studentIds } })
        .select('_id parentUserId parentPhone parentName adGroupId adGroupName')
        .lean()
      : [];

    const sessionMap = new Map<string, any>(sessions.map((session: any) => [session._id.toString(), session]));
    const studentMap = new Map<string, any>(students.map((student: any) => [student._id.toString(), student]));
    const futureSessions = studentIds.length
      ? await this.sessionModel.find({
        studentId: { $in: studentIds },
        scheduledDate: { $gt: todayEnd },
        status: {
          $in: [
            SessionStatus.SCHEDULED,
            SessionStatus.TEACHER_COMPLETED,
            SessionStatus.PARENT_CONFIRMED,
          ],
        },
      })
        .select('studentId parentUserId adGroupId adGroupName scheduledDate teacherPayout')
        .lean()
      : [];

    for (const entry of ledgerEntries as any[]) {
      const sessionId = entry.sessionId?.toString?.();
      if (!sessionId) continue;
      const session = sessionMap.get(sessionId);
      if (!session) continue;
      const student = studentMap.get(session.studentId?.toString?.());
      const parentKey = resolveMappedParentKey(
        entry.userId || session.parentUserId || student?.parentUserId,
        student?.parentPhone,
      );
      if (!parentKey) continue;

      const row = parentRows.get(parentKey);
      if (!row) continue;
      if (!isDateWithinInclusiveRange(entry.createdAt, row.cohortStart, row.observationEnd)) continue;

      if (session.parentUserId && !row.parentUserId) row.parentUserId = session.parentUserId.toString();
      if (student?.parentPhone && !row.parentPhone) row.parentPhone = student.parentPhone;
      if (student?.parentPhone && !row.normalizedParentPhone) row.normalizedParentPhone = normalizePhone(student.parentPhone);
      if (student?.parentName && !row.parentName) row.parentName = student.parentName;
      if (student?._id) row.studentIds.add(student._id.toString());
      if (session.adGroupId && !row.adGroupId) row.adGroupId = session.adGroupId.toString();
      if (session.adGroupName && (!row.adGroupName || row.adGroupName === 'UNATTRIBUTED')) {
        row.adGroupName = session.adGroupName;
      }
      if (student?.adGroupId && !row.adGroupId) row.adGroupId = student.adGroupId.toString();
      if (student?.adGroupName && (!row.adGroupName || row.adGroupName === 'UNATTRIBUTED')) {
        row.adGroupName = student.adGroupName;
      }

      registerAliases(parentKey, entry.userId || session.parentUserId || student?.parentUserId, student?.parentPhone);

      const amount = Number(entry.amount || 0);
      if (entry.type === TransactionType.SESSION_DEDUCT) {
        row.revenue += amount;
        if (!row.realizedSessionIds.has(sessionId)) {
          row.realizedSessionIds.add(sessionId);
          row.sessionCount += 1;
          row.teacherCost += Number(session.teacherPayout || 0);
        }
      } else if (entry.type === TransactionType.REFUND) {
        row.refundAmount += amount;
      }
    }

    for (const invoice of invoiceRows as any[]) {
      const student = studentMap.get(invoice.studentId?.toString?.());
      if (!student) continue;

      const parentKey = resolveMappedParentKey(
        student.parentUserId,
        student.parentPhone,
      );
      if (!parentKey) continue;

      const row = parentRows.get(parentKey);
      if (!row) continue;
      if (!isDateWithinInclusiveRange(invoice.paymentDate, row.cohortStart, row.observationEnd)) continue;

      registerAliases(parentKey, student.parentUserId, student.parentPhone);

      row.collectedRevenue += Number(invoice.amount || 0);
      row.remainingSessionUnits += Number(invoice.sessionsRemaining || 0);
      if (student.parentUserId && !row.parentUserId) row.parentUserId = student.parentUserId.toString();
      if (student.parentPhone && !row.parentPhone) row.parentPhone = student.parentPhone;
      if (student.parentPhone && !row.normalizedParentPhone) {
        row.normalizedParentPhone = normalizePhone(student.parentPhone);
      }
      if (student.parentName && !row.parentName) row.parentName = student.parentName;
      if (student._id) row.studentIds.add(student._id.toString());
      if (student.adGroupId && !row.adGroupId) row.adGroupId = student.adGroupId.toString();
      if (student.adGroupName && (!row.adGroupName || row.adGroupName === 'UNATTRIBUTED')) {
        row.adGroupName = student.adGroupName;
      }
    }

    for (const session of futureSessions as any[]) {
      const student = studentMap.get(session.studentId?.toString?.());
      if (!student) continue;

      const parentKey = resolveMappedParentKey(
        session.parentUserId || student.parentUserId,
        student.parentPhone,
      );
      if (!parentKey) continue;

      const row = parentRows.get(parentKey);
      if (!row) continue;

      registerAliases(parentKey, session.parentUserId || student.parentUserId, student.parentPhone);

      row.scheduledRemainingSessionCount += 1;
      row.scheduledRemainingTeacherCost += Number(session.teacherPayout || 0);
      if (student.parentUserId && !row.parentUserId) row.parentUserId = student.parentUserId.toString();
      if (student.parentPhone && !row.parentPhone) row.parentPhone = student.parentPhone;
      if (student.parentPhone && !row.normalizedParentPhone) {
        row.normalizedParentPhone = normalizePhone(student.parentPhone);
      }
      if (student.parentName && !row.parentName) row.parentName = student.parentName;
      if (student._id) row.studentIds.add(student._id.toString());
      if (session.adGroupId && !row.adGroupId) row.adGroupId = session.adGroupId.toString();
      if (session.adGroupName && (!row.adGroupName || row.adGroupName === 'UNATTRIBUTED')) {
        row.adGroupName = session.adGroupName;
      }
      if (student.adGroupId && !row.adGroupId) row.adGroupId = student.adGroupId.toString();
      if (student.adGroupName && (!row.adGroupName || row.adGroupName === 'UNATTRIBUTED')) {
        row.adGroupName = student.adGroupName;
      }
    }

    const rawParentRows = Array.from(parentRows.values());
    const rowsByCohort = new Map<string, RealizedCohortParentAccumulator[]>();
    for (const row of rawParentRows) {
      if (!row.adGroupId) continue;
      const cohortKey = groupDayKey(row.adGroupId, row.cohortDate);
      if (!rowsByCohort.has(cohortKey)) rowsByCohort.set(cohortKey, []);
      rowsByCohort.get(cohortKey)!.push(row);
      groupIds.add(row.adGroupId);
    }

    const groupExpenseItems: Array<{ adGroupId: string; amount: number; expenseDate: Date }> = [];
    const globalExpenseItems: Array<{ amount: number; expenseDate: Date }> = [];

    for (const expense of expenses as any[]) {
      const scope = expense.allocationScope || ExpenseAllocationScope.GLOBAL;
      const amount = Number(expense.amount || 0);
      if (amount <= 0) continue;

      if (scope === ExpenseAllocationScope.PARENT) {
        const parentKey = resolveMappedParentKey(
          expense.parentUserId,
          expense.parentPhone || expense.normalizedParentPhone,
        );
        if (!parentKey) continue;
        const row = parentRows.get(parentKey);
        if (!row) continue;
        if (!isDateWithinInclusiveRange(expense.expenseDate, row.cohortStart, row.observationEnd)) continue;
        row.directParentExpense += amount;
        continue;
      }

      if (scope === ExpenseAllocationScope.AD_GROUP && expense.adGroupId) {
        groupExpenseItems.push({
          adGroupId: expense.adGroupId.toString(),
          amount,
          expenseDate: expense.expenseDate,
        });
        continue;
      }

      globalExpenseItems.push({ amount, expenseDate: expense.expenseDate });
    }

    for (const item of groupExpenseItems) {
      const eligibleRows = rawParentRows.filter((row) => (
        row.adGroupId === item.adGroupId
        && isDateWithinInclusiveRange(item.expenseDate, row.cohortStart, row.observationEnd)
      ));
      allocateSharedAmount(eligibleRows, item.amount, 'allocatedGroupExpense');
    }

    for (const item of globalExpenseItems) {
      const eligibleRows = rawParentRows.filter((row) => (
        isDateWithinInclusiveRange(item.expenseDate, row.cohortStart, row.observationEnd)
      ));
      allocateSharedAmount(eligibleRows, item.amount, 'allocatedGlobalOverhead');
    }

    const adCostMap = new Map<string, any>();
    for (const cost of adCostRows as any[]) {
      const groupId = cost._id?.adGroupId?.toString?.();
      const date = String(cost._id?.date || '');
      if (!groupId || !date) continue;
      const cohortKey = groupDayKey(groupId, date);
      adCostMap.set(cohortKey, cost);
      allocateSharedAmount(rowsByCohort.get(cohortKey) || [], Number(cost.spend || 0), 'allocatedAdSpend');
      groupIds.add(groupId);
    }

    const leadCountMap = new Map<string, number>();
    for (const lead of leadRows as any[]) {
      const groupId = lead._id?.adGroupId?.toString?.();
      const date = String(lead._id?.date || '');
      if (!groupId || !date) continue;
      leadCountMap.set(groupDayKey(groupId, date), Number(lead.leadCount || 0));
      groupIds.add(groupId);
    }

    const orderCountMap = new Map<string, number>();
    for (const order of orderRows as any[]) {
      const groupId = order._id?.adGroupId?.toString?.();
      const date = String(order._id?.date || '');
      if (!groupId || !date) continue;
      orderCountMap.set(groupDayKey(groupId, date), Number(order.orderCount || 0));
      groupIds.add(groupId);
    }

    const groupObjectIds = Array.from(groupIds)
      .filter((id) => Types.ObjectId.isValid(id))
      .map((id) => new Types.ObjectId(id));
    const adGroups = groupObjectIds.length
      ? await this.adGroupModel.find({ _id: { $in: groupObjectIds } }).select('_id name platform').lean()
      : [];
    const groupMetaMap = new Map<string, { name?: string; platform?: string }>(
      adGroups.map((group: any) => [group._id.toString(), { name: group.name, platform: group.platform }]),
    );

    const cohortPerformanceMap = new Map<string, any>();
    for (const row of rawParentRows) {
      if (!row.adGroupId) continue;
      const cohortKey = groupDayKey(row.adGroupId, row.cohortDate);
      if (!cohortPerformanceMap.has(cohortKey)) {
          cohortPerformanceMap.set(cohortKey, {
            date: row.cohortDate,
            cohortAgeDays: row.cohortAgeDays,
            isMatured: row.isMatured,
            adGroupId: row.adGroupId,
            adGroupName: row.adGroupName,
            platform: row.platform,
            collectedRevenue: 0,
            remainingSessionUnits: 0,
            scheduledRemainingSessionCount: 0,
            scheduledRemainingTeacherCost: 0,
            realizedRevenue: 0,
            refundAmount: 0,
            teacherCost: 0,
            directParentExpense: 0,
            allocatedGroupExpense: 0,
          allocatedGlobalOverhead: 0,
          newParentCount: 0,
          realizedParentCount: 0,
          realizedSessionCount: 0,
        });
      }

      const cohort = cohortPerformanceMap.get(cohortKey);
      cohort.collectedRevenue += row.collectedRevenue;
      cohort.remainingSessionUnits += row.remainingSessionUnits;
      cohort.scheduledRemainingSessionCount += row.scheduledRemainingSessionCount;
      cohort.scheduledRemainingTeacherCost += row.scheduledRemainingTeacherCost;
      cohort.realizedRevenue += row.revenue;
      cohort.refundAmount += row.refundAmount;
      cohort.teacherCost += row.teacherCost;
      cohort.directParentExpense += row.directParentExpense;
      cohort.allocatedGroupExpense += row.allocatedGroupExpense;
      cohort.allocatedGlobalOverhead += row.allocatedGlobalOverhead;
      cohort.newParentCount += 1;
      cohort.realizedSessionCount += row.sessionCount;
      if (row.revenue > 0 || row.refundAmount > 0 || row.sessionCount > 0) {
        cohort.realizedParentCount += 1;
      }
    }

    const allKeys = new Set<string>([
      ...Array.from(newParentCountMap.keys()),
      ...Array.from(leadCountMap.keys()),
      ...Array.from(orderCountMap.keys()),
      ...Array.from(adCostMap.keys()),
      ...Array.from(cohortPerformanceMap.keys()),
    ]);

    const rawRows = Array.from(allKeys)
      .map((key) => {
        const { adGroupId, date } = splitGroupDayKey(key);
        if (!adGroupId || !date) return null;

        const performance = cohortPerformanceMap.get(key);
        const adCost = adCostMap.get(key);
        const adMeta = groupMetaMap.get(adGroupId);
        const adSpend = Number(adCost?.spend || 0);
        const leadCount = Number(leadCountMap.get(key) || 0);
        const orderCount = Number(orderCountMap.get(key) || 0);
        const newParentCount = Number(newParentCountMap.get(key) || performance?.newParentCount || 0);
        const collectedRevenue = roundCurrency(Number(performance?.collectedRevenue || 0));
        const remainingSessionUnits = roundCurrency(Number(performance?.remainingSessionUnits || 0));
        const scheduledRemainingSessionCount = Number(performance?.scheduledRemainingSessionCount || 0);
        const scheduledRemainingTeacherCost = roundCurrency(Number(performance?.scheduledRemainingTeacherCost || 0));
        const realizedRevenue = roundCurrency(Number(performance?.realizedRevenue || 0));
        const refundAmount = roundCurrency(Number(performance?.refundAmount || 0));
        const teacherCost = roundCurrency(Number(performance?.teacherCost || 0));
        const directParentExpense = roundCurrency(Number(performance?.directParentExpense || 0));
        const allocatedGroupExpense = roundCurrency(Number(performance?.allocatedGroupExpense || 0));
        const allocatedGlobalOverhead = roundCurrency(Number(performance?.allocatedGlobalOverhead || 0));
        const netRealizedRevenue = roundCurrency(realizedRevenue - refundAmount);
        const netProfit = roundCurrency(
          netRealizedRevenue
          - teacherCost
          - directParentExpense
          - allocatedGroupExpense
          - allocatedGlobalOverhead
          - adSpend,
        );
        const impressions = Number(adCost?.impressions || 0);
        const clicks = Number(adCost?.clicks || 0);
        const conversions = Number(adCost?.conversions || 0);
        const cohortDate = normalizeToUtcDay(date);
        const cohortAgeDays = performance?.cohortAgeDays
          || Math.max(1, Math.floor((todayStart.getTime() - cohortDate.getTime()) / 86400000) + 1);
        const isMatured = Boolean(performance?.isMatured ?? (cohortAgeDays >= options.maturityDays));

        const row: RealizedCohortRow = {
          date,
          realizedThrough,
          maturityDays: options.maturityDays,
          cohortAgeDays,
          isMatured,
          adGroupId,
          adGroupName: performance?.adGroupName || adCost?.adGroupName || adMeta?.name || '',
          platform: performance?.platform || adCost?.platform || adMeta?.platform || '',
          impressions,
          clicks,
          conversions,
          ctr: impressions > 0 ? roundCurrency((clicks / impressions) * 100) : 0,
          cpc: clicks > 0 ? roundCurrency(adSpend / clicks) : null,
          cpm: impressions > 0 ? roundCurrency((adSpend / impressions) * 1000) : null,
          costPerConversion: conversions > 0 ? roundCurrency(adSpend / conversions) : null,
          leadCount,
          orderCount,
          newParentCount,
          realizedParentCount: Number(performance?.realizedParentCount || 0),
          realizedSessionCount: Number(performance?.realizedSessionCount || 0),
          adSpend: roundCurrency(adSpend),
          collectedRevenue,
          remainingSessionUnits,
          scheduledRemainingSessionCount,
          scheduledRemainingTeacherCost,
          realizedRevenue,
          refundAmount,
          netRealizedRevenue,
          estimatedRemainingRefund: 0,
          estimatedRemainingTeacherCost: 0,
          estimatedRemainingOtherCost: 0,
          projectedRevenue: netRealizedRevenue,
          projectedNetProfit: netProfit,
          effectiveNetProfit: netProfit,
          projectionBasis: 'ACTUAL_ONLY',
          teacherCost,
          directParentExpense,
          allocatedGroupExpense,
          allocatedGlobalOverhead,
          netProfit,
          roi: adSpend > 0 ? roundCurrency((netProfit / adSpend) * 100) : 0,
          costPerLead: leadCount > 0 ? roundCurrency(adSpend / leadCount) : null,
          costPerNewParent: newParentCount > 0 ? roundCurrency(adSpend / newParentCount) : null,
          profitPerLead: leadCount > 0 ? roundCurrency(netProfit / leadCount) : null,
          profitPerNewParent: newParentCount > 0 ? roundCurrency(netProfit / newParentCount) : null,
        };
        return row;
      })
      .filter((row): row is RealizedCohortRow => row !== null)
      .sort((a, b) => a.date.localeCompare(b.date) || a.adGroupName.localeCompare(b.adGroupName));

    const rawMatureRows = rawRows.filter((row) => row.isMatured);
    const rowsWithActualService = rawRows.filter((row) => row.realizedRevenue > 0);
    const matureRowsWithActualService = rawMatureRows.filter((row) => row.realizedRevenue > 0);
    const profitProfiles = {
      groupMature: buildProfitProjectionProfileMap(matureRowsWithActualService, (row) => row.adGroupId),
      platformMature: buildProfitProjectionProfileMap(matureRowsWithActualService, (row) => row.platform),
      overallMature: buildProfitProjectionProfile(matureRowsWithActualService),
      groupLive: buildProfitProjectionProfileMap(rowsWithActualService, (row) => row.adGroupId),
      platformLive: buildProfitProjectionProfileMap(rowsWithActualService, (row) => row.platform),
      overallLive: buildProfitProjectionProfile(rowsWithActualService),
    };

    const rows = rawRows.map((row) => {
      const projection = resolveProfitProjection(row, profitProfiles);
      const deferredRevenue = roundCurrency(Math.max(0, row.collectedRevenue - row.realizedRevenue));
      const remainingSessionUnitsVal = roundCurrency(Math.max(0, row.remainingSessionUnits || 0));
      const scheduledRemainingSessionUnits = roundCurrency(
        Math.min(remainingSessionUnitsVal, Math.max(0, row.scheduledRemainingSessionCount || 0)),
      );
      const unscheduledRemainingSessionUnits = roundCurrency(
        Math.max(0, remainingSessionUnitsVal - scheduledRemainingSessionUnits),
      );
      const remainingRefundRate = refundRateOverride ?? projection?.profile.refundRate ?? 0;
      const estimatedRemainingRefund = (!row.isMatured && deferredRevenue > 0)
        ? roundCurrency(deferredRevenue * remainingRefundRate)
        : 0;
      const estimatedRemainingTeacherCost = (!row.isMatured && deferredRevenue > 0 && projection)
        ? remainingSessionUnitsVal > 0
          ? roundCurrency(
            row.scheduledRemainingTeacherCost
            + (
              projection.profile.teacherCostPerSession !== null
                ? (unscheduledRemainingSessionUnits * projection.profile.teacherCostPerSession)
                : (unscheduledRemainingSessionUnits > 0
                  ? ((unscheduledRemainingSessionUnits / Math.max(remainingSessionUnitsVal, 1))
                    * deferredRevenue
                    * projection.profile.teacherCostRate)
                  : 0)
            ),
          )
          : roundCurrency(deferredRevenue * projection.profile.teacherCostRate)
        : 0;
      const estimatedRemainingOtherCost = (!row.isMatured && deferredRevenue > 0 && projection)
        ? remainingSessionUnitsVal > 0 && projection.profile.otherCostPerSession !== null
          ? roundCurrency(remainingSessionUnitsVal * projection.profile.otherCostPerSession)
          : roundCurrency(deferredRevenue * projection.profile.otherCostRate)
        : 0;
      const projectedRevenue = (!row.isMatured && row.collectedRevenue > 0)
        ? roundCurrency(row.netRealizedRevenue + deferredRevenue - estimatedRemainingRefund)
        : row.netRealizedRevenue;
      const projectedNetProfit = (!row.isMatured && row.collectedRevenue > 0)
        ? roundCurrency(
          row.netProfit
          + deferredRevenue
          - estimatedRemainingRefund
          - estimatedRemainingTeacherCost
          - estimatedRemainingOtherCost,
        )
        : row.netProfit;
      return {
        ...row,
        estimatedRemainingRefund,
        estimatedRemainingTeacherCost,
        estimatedRemainingOtherCost,
        projectedRevenue,
        projectedNetProfit,
        effectiveNetProfit: (!row.isMatured && row.collectedRevenue > 0) ? projectedNetProfit : row.netProfit,
        projectionBasis: projection?.basis || 'ACTUAL_ONLY',
      };
    });
    const matureRows = rows.filter((row) => row.isMatured);

    const summary = {
      totalSpend: roundCurrency(rows.reduce((sum, row) => sum + row.adSpend, 0)),
      totalImpressions: rows.reduce((sum, row) => sum + row.impressions, 0),
      totalClicks: rows.reduce((sum, row) => sum + row.clicks, 0),
      totalConversions: rows.reduce((sum, row) => sum + row.conversions, 0),
      totalLeads: rows.reduce((sum, row) => sum + row.leadCount, 0),
      totalOrders: rows.reduce((sum, row) => sum + row.orderCount, 0),
      totalNewParents: rows.reduce((sum, row) => sum + row.newParentCount, 0),
      totalCollectedRevenue: roundCurrency(rows.reduce((sum, row) => sum + row.collectedRevenue, 0)),
      totalRemainingSessionUnits: roundCurrency(rows.reduce((sum, row) => sum + row.remainingSessionUnits, 0)),
      totalRealizedParents: rows.reduce((sum, row) => sum + row.realizedParentCount, 0),
      totalRealizedSessions: rows.reduce((sum, row) => sum + row.realizedSessionCount, 0),
      totalRealizedRevenue: roundCurrency(rows.reduce((sum, row) => sum + row.realizedRevenue, 0)),
      totalRefundAmount: roundCurrency(rows.reduce((sum, row) => sum + row.refundAmount, 0)),
      totalNetRealizedRevenue: roundCurrency(rows.reduce((sum, row) => sum + row.netRealizedRevenue, 0)),
      totalProjectedRevenue: roundCurrency(rows.reduce((sum, row) => sum + row.projectedRevenue, 0)),
      totalTeacherCost: roundCurrency(rows.reduce((sum, row) => sum + row.teacherCost, 0)),
      totalDirectParentExpense: roundCurrency(rows.reduce((sum, row) => sum + row.directParentExpense, 0)),
      totalAllocatedGroupExpense: roundCurrency(rows.reduce((sum, row) => sum + row.allocatedGroupExpense, 0)),
      totalAllocatedGlobalOverhead: roundCurrency(rows.reduce((sum, row) => sum + row.allocatedGlobalOverhead, 0)),
      totalNetProfit: roundCurrency(rows.reduce((sum, row) => sum + row.netProfit, 0)),
      totalProjectedNetProfit: roundCurrency(rows.reduce((sum, row) => sum + row.projectedNetProfit, 0)),
      totalRoi: 0,
      matureRowCount: matureRows.length,
      immatureRowCount: rows.length - matureRows.length,
    };
    if (summary.totalSpend > 0) {
      summary.totalRoi = roundCurrency((summary.totalNetProfit / summary.totalSpend) * 100);
    }

    return {
      basis: 'REALIZED_SESSION_DEDUCT_REFUND + PROJECTED_APPROVED_TUITION_CASH_WITH_SESSION_COSTS',
      maturityDays: options.maturityDays,
      realizedThrough,
      refundRatePercentX,
      rows,
      matureRows,
      summary,
    };
  }
}
