import { Types } from 'mongoose';

import { AdsGroupProfitCostService } from './ads-group-profit-cost.service';
import { ExpenseAllocationScope, PaymentStatus } from '../expenses/schemas/expense.schema';
import { OrderStatus } from '../orders/schemas/order.schema';
import { StaffPayrollStatus } from '../staff-payroll/schemas/staff-payroll.schema';

function buildFindResult<T>(value: T) {
  return {
    select: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(value),
  };
}

describe('AdsGroupProfitCostService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('allocates teacher cost, parent expense, group expense, global expense, and staff payroll to ad groups', async () => {
    const adGroupId = new Types.ObjectId();
    const parentUserId = new Types.ObjectId();
    const start = new Date('2026-04-01T00:00:00.000Z');
    const end = new Date('2026-04-30T23:59:59.999Z');

    const orderModel = {
      find: jest.fn().mockReturnValue(
        buildFindResult([
          {
            _id: new Types.ObjectId(),
            adGroupId,
            parentUserId,
            parentPhone: '0901 222 333',
            status: OrderStatus.APPROVED,
            finalAmount: 2_000_000,
            items: [
              {
                sessions: 10,
                teacherPayPerSession: 100_000,
                teacherPayPerStudent: 0,
              },
            ],
          },
        ]),
      ),
    };
    const expenseModel = {
      find: jest.fn().mockReturnValue(
        buildFindResult([
          {
            amount: 50_000,
            paymentStatus: PaymentStatus.PAID,
            allocationScope: ExpenseAllocationScope.PARENT,
            parentUserId,
          },
          {
            amount: 80_000,
            paymentStatus: PaymentStatus.PAID,
            allocationScope: ExpenseAllocationScope.AD_GROUP,
            adGroupId,
          },
          {
            amount: 120_000,
            paymentStatus: PaymentStatus.PAID,
            allocationScope: ExpenseAllocationScope.GLOBAL,
          },
        ]),
      ),
    };
    const staffPayrollModel = {
      find: jest.fn().mockReturnValue(
        buildFindResult([
          {
            periodStart: new Date('2026-04-01T00:00:00.000Z'),
            periodEnd: new Date('2026-04-30T00:00:00.000Z'),
            netAmount: 300_000,
          },
        ]),
      ),
    };

    const service = new AdsGroupProfitCostService(
      orderModel as any,
      expenseModel as any,
      staffPayrollModel as any,
    );

    const result = await service.buildBreakdownByAdGroup(start, end);

    expect(orderModel.find).toHaveBeenCalledWith(
      expect.objectContaining({
        adGroupId: { $exists: true, $ne: null },
        status: { $in: [OrderStatus.APPROVED, OrderStatus.COMPLETED] },
      }),
    );
    expect(expenseModel.find).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentStatus: { $in: [PaymentStatus.PAID, PaymentStatus.APPROVED_UNPAID] },
      }),
    );
    expect(staffPayrollModel.find).toHaveBeenCalledWith({
      status: { $in: [StaffPayrollStatus.APPROVED, StaffPayrollStatus.PAID] },
      periodStart: { $lte: end },
      periodEnd: { $gte: start },
    });
    expect(result.get(adGroupId.toString())).toEqual({
      estimatedTeacherCost: 1_000_000,
      directParentExpense: 50_000,
      allocatedGroupExpense: 80_000,
      allocatedGlobalExpense: 120_000,
      allocatedStaffLaborCost: 300_000,
    });
  });

  it('uses per-student teacher pay for offline order items without double-counting session pay', async () => {
    const adGroupId = new Types.ObjectId();
    const orderModel = {
      find: jest.fn().mockReturnValue(
        buildFindResult([
          {
            _id: new Types.ObjectId(),
            adGroupId,
            finalAmount: 1_000_000,
            items: [
              {
                sessions: 2,
                teachingMode: 'OFFLINE',
                teacherPayPerSession: 500_000,
                teacherPayPerStudent: 40_000,
              },
            ],
          },
        ]),
      ),
    };
    const expenseModel = {
      find: jest.fn().mockReturnValue(buildFindResult([])),
    };
    const staffPayrollModel = {
      find: jest.fn().mockReturnValue(buildFindResult([])),
    };

    const service = new AdsGroupProfitCostService(
      orderModel as any,
      expenseModel as any,
      staffPayrollModel as any,
    );

    const result = await service.buildBreakdownByAdGroup(
      new Date('2026-04-01T00:00:00.000Z'),
      new Date('2026-04-30T23:59:59.999Z'),
    );

    expect(result.get(adGroupId.toString())?.estimatedTeacherCost).toBe(80_000);
  });

  it('prorates staff payroll by overlapping days in the analytics range', async () => {
    const adGroupId = new Types.ObjectId();
    const orderModel = {
      find: jest.fn().mockReturnValue(
        buildFindResult([
          {
            _id: new Types.ObjectId(),
            adGroupId,
            finalAmount: 1_000_000,
            items: [],
          },
        ]),
      ),
    };
    const expenseModel = {
      find: jest.fn().mockReturnValue(buildFindResult([])),
    };
    const staffPayrollModel = {
      find: jest.fn().mockReturnValue(
        buildFindResult([
          {
            periodStart: new Date('2026-04-01T00:00:00.000Z'),
            periodEnd: new Date('2026-04-30T00:00:00.000Z'),
            netAmount: 3_000_000,
          },
        ]),
      ),
    };

    const service = new AdsGroupProfitCostService(
      orderModel as any,
      expenseModel as any,
      staffPayrollModel as any,
    );

    const result = await service.buildBreakdownByAdGroup(
      new Date('2026-04-01T00:00:00.000Z'),
      new Date('2026-04-10T23:59:59.999Z'),
    );

    expect(result.get(adGroupId.toString())?.allocatedStaffLaborCost).toBe(1_000_000);
  });
});
