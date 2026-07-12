import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { Expense, ExpenseAllocationScope, ExpenseDocument, PaymentStatus } from '../expenses/schemas/expense.schema';
import { Order, OrderDocument, OrderStatus } from '../orders/schemas/order.schema';
import {
  StaffPayroll,
  StaffPayrollDocument,
  StaffPayrollStatus,
} from '../staff-payroll/schemas/staff-payroll.schema';
import { roundCurrency } from './ads.utils';

export interface AdGroupProfitCostBreakdown {
  estimatedTeacherCost: number;
  directParentExpense: number;
  allocatedGroupExpense: number;
  allocatedGlobalExpense: number;
  allocatedStaffLaborCost: number;
}

interface GroupWeight {
  revenue: number;
  orderCount: number;
}

@Injectable()
export class AdsGroupProfitCostService {
  private readonly approvedOrderStatuses = [OrderStatus.APPROVED, OrderStatus.COMPLETED];
  private readonly paidExpenseStatuses = [PaymentStatus.PAID, PaymentStatus.APPROVED_UNPAID];
  private readonly activeStaffPayrollStatuses = [StaffPayrollStatus.APPROVED, StaffPayrollStatus.PAID];

  constructor(
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    @InjectModel(Expense.name) private readonly expenseModel: Model<ExpenseDocument>,
    @InjectModel(StaffPayroll.name) private readonly staffPayrollModel: Model<StaffPayrollDocument>,
  ) {}

  async buildBreakdownByAdGroup(start: Date, end: Date): Promise<Map<string, AdGroupProfitCostBreakdown>> {
    const orders = await this.orderModel
      .find({
        adGroupId: { $exists: true, $ne: null },
        createdAt: { $gte: start, $lte: end },
        status: { $in: this.approvedOrderStatuses },
      })
      .select('_id adGroupId parentUserId parentPhone finalAmount items')
      .lean();

    const breakdownByGroup = new Map<string, AdGroupProfitCostBreakdown>();
    const groupWeights = new Map<string, GroupWeight>();
    const parentWeights = new Map<string, Map<string, GroupWeight>>();

    for (const order of orders as any[]) {
      const groupId = this.objectIdToString(order?.adGroupId);
      if (!groupId) continue;

      const revenue = this.toSafeNumber(order?.finalAmount);
      const teacherCost = this.estimateOrderTeacherCost(order);
      this.ensureBreakdown(breakdownByGroup, groupId).estimatedTeacherCost += teacherCost;
      this.addWeight(groupWeights, groupId, revenue);

      for (const parentKey of this.parentKeysFromOrder(order)) {
        let weights = parentWeights.get(parentKey);
        if (!weights) {
          weights = new Map<string, GroupWeight>();
          parentWeights.set(parentKey, weights);
        }
        this.addWeight(weights, groupId, revenue);
      }
    }

    const expenses = await this.expenseModel
      .find({
        paymentStatus: { $in: this.paidExpenseStatuses },
        expenseDate: { $gte: start, $lte: end },
      })
      .select('amount allocationScope adGroupId parentUserId normalizedParentPhone parentPhone')
      .lean();

    let globalExpense = 0;
    for (const expense of expenses as any[]) {
      const amount = this.toSafeNumber(expense?.amount);
      if (amount <= 0) continue;

      if (expense?.allocationScope === ExpenseAllocationScope.AD_GROUP) {
        const groupId = this.objectIdToString(expense?.adGroupId);
        if (groupId) this.ensureBreakdown(breakdownByGroup, groupId).allocatedGroupExpense += amount;
        continue;
      }

      if (expense?.allocationScope === ExpenseAllocationScope.PARENT) {
        const parentKey = this.parentKeyFromExpense(expense);
        const weights = parentKey ? parentWeights.get(parentKey) : undefined;
        if (weights) {
          this.allocateAmount(amount, weights, breakdownByGroup, 'directParentExpense');
        }
        continue;
      }

      globalExpense += amount;
    }

    if (globalExpense > 0) {
      this.allocateAmount(globalExpense, groupWeights, breakdownByGroup, 'allocatedGlobalExpense');
    }

    const staffLaborCost = await this.getStaffLaborCost(start, end);
    if (staffLaborCost > 0) {
      this.allocateAmount(staffLaborCost, groupWeights, breakdownByGroup, 'allocatedStaffLaborCost');
    }

    for (const row of breakdownByGroup.values()) {
      row.estimatedTeacherCost = roundCurrency(row.estimatedTeacherCost);
      row.directParentExpense = roundCurrency(row.directParentExpense);
      row.allocatedGroupExpense = roundCurrency(row.allocatedGroupExpense);
      row.allocatedGlobalExpense = roundCurrency(row.allocatedGlobalExpense);
      row.allocatedStaffLaborCost = roundCurrency(row.allocatedStaffLaborCost);
    }

    return breakdownByGroup;
  }

  private async getStaffLaborCost(start: Date, end: Date): Promise<number> {
    const rows = await this.staffPayrollModel
      .find({
        status: { $in: this.activeStaffPayrollStatuses },
        periodStart: { $lte: end },
        periodEnd: { $gte: start },
      })
      .select('periodStart periodEnd netAmount')
      .lean();

    return (rows as any[]).reduce((sum, row) => {
      const periodStart = row?.periodStart ? new Date(row.periodStart) : start;
      const periodEnd = row?.periodEnd ? new Date(row.periodEnd) : end;
      const overlapStart = periodStart > start ? periodStart : start;
      const overlapEnd = periodEnd < end ? periodEnd : end;
      const periodDays = this.inclusiveDayCount(periodStart, periodEnd);
      const overlapDays = this.inclusiveDayCount(overlapStart, overlapEnd);
      if (periodDays <= 0 || overlapDays <= 0) return sum;
      return sum + (this.toSafeNumber(row?.netAmount) * overlapDays) / periodDays;
    }, 0);
  }

  private allocateAmount(
    amount: number,
    weights: Map<string, GroupWeight>,
    target: Map<string, AdGroupProfitCostBreakdown>,
    field: keyof AdGroupProfitCostBreakdown,
  ): void {
    const entries = Array.from(weights.entries());
    if (amount <= 0 || entries.length === 0) return;

    const totalRevenue = entries.reduce((sum, [, weight]) => sum + Math.max(0, weight.revenue), 0);
    const totalOrders = entries.reduce((sum, [, weight]) => sum + Math.max(0, weight.orderCount), 0);
    const denominator = totalRevenue > 0 ? totalRevenue : totalOrders > 0 ? totalOrders : entries.length;

    let allocated = 0;
    entries.forEach(([groupId, weight], index) => {
      const basis = totalRevenue > 0 ? weight.revenue : totalOrders > 0 ? weight.orderCount : 1;
      const share = index === entries.length - 1 ? amount - allocated : roundCurrency((amount * basis) / denominator);
      this.ensureBreakdown(target, groupId)[field] += share;
      allocated += share;
    });
  }

  private estimateOrderTeacherCost(order: any): number {
    const items = Array.isArray(order?.items) ? order.items : [];
    return items.reduce((sum: number, item: any) => {
      const invoiceSessions = item?.invoiceSessions !== undefined && item?.invoiceSessions !== null
        ? this.toSafeNumber(item.invoiceSessions)
        : this.toSafeNumber(item?.sessions);
      const totalSessionUnits = Math.max(
        0,
        invoiceSessions + this.toSafeNumber(item?.bonusSessions) + this.toSafeNumber(item?.trialSessions),
      );
      const teacherPayPerSession = this.toSafeNumber(item?.teacherPayPerSession);
      const teacherPayPerStudent = this.toSafeNumber(item?.teacherPayPerStudent);
      const sessionDuration = this.toSafeNumber(item?.sessionDuration) || 60;
      const referenceDuration = this.toSafeNumber(item?.baseDuration) || sessionDuration;
      const durationRatio = referenceDuration > 0 ? sessionDuration / referenceDuration : 1;
      const adjustedTeacherPayPerSession = roundCurrency(teacherPayPerSession * durationRatio);
      const isOffline = String(item?.teachingMode || '').toUpperCase() === 'OFFLINE';
      const teacherCostPerSession = isOffline
        ? teacherPayPerStudent || adjustedTeacherPayPerSession
        : adjustedTeacherPayPerSession || teacherPayPerStudent;
      return sum + totalSessionUnits * teacherCostPerSession;
    }, 0);
  }

  private parentKeysFromOrder(order: any): string[] {
    const keys = new Set<string>();
    const userId = this.objectIdToString(order?.parentUserId);
    if (userId) keys.add(`user:${userId}`);
    const phone = this.normalizePhone(order?.parentPhone);
    if (phone) keys.add(`phone:${phone}`);
    return Array.from(keys);
  }

  private parentKeyFromExpense(expense: any): string | null {
    const userId = this.objectIdToString(expense?.parentUserId);
    if (userId) return `user:${userId}`;
    const phone = this.normalizePhone(expense?.normalizedParentPhone || expense?.parentPhone);
    return phone ? `phone:${phone}` : null;
  }

  private addWeight(target: Map<string, GroupWeight>, groupId: string, revenue: number): void {
    const existing = target.get(groupId) || { revenue: 0, orderCount: 0 };
    existing.revenue += revenue;
    existing.orderCount += 1;
    target.set(groupId, existing);
  }

  private ensureBreakdown(
    target: Map<string, AdGroupProfitCostBreakdown>,
    groupId: string,
  ): AdGroupProfitCostBreakdown {
    let value = target.get(groupId);
    if (!value) {
      value = {
        estimatedTeacherCost: 0,
        directParentExpense: 0,
        allocatedGroupExpense: 0,
        allocatedGlobalExpense: 0,
        allocatedStaffLaborCost: 0,
      };
      target.set(groupId, value);
    }
    return value;
  }

  private objectIdToString(value: any): string {
    return value?.toString?.() || '';
  }

  private normalizePhone(value: any): string {
    return String(value || '').replace(/\D/g, '');
  }

  private inclusiveDayCount(start: Date, end: Date): number {
    if (!(start instanceof Date) || !(end instanceof Date) || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return 0;
    }
    const startDay = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
    const endDay = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate());
    return Math.max(0, Math.floor((endDay - startDay) / 86_400_000) + 1);
  }

  private toSafeNumber(value: any): number {
    const numeric = Number(value || 0);
    return Number.isFinite(numeric) ? numeric : 0;
  }
}
