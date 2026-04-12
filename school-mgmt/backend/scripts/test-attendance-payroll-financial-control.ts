import 'reflect-metadata';
import { strict as assert } from 'node:assert';
import { Types } from 'mongoose';
import { FinancialControlService } from '../src/financial-control/financial-control.service';
import { FinancialControlBankFundService } from '../src/financial-control/financial-control-bank-fund.service';
import { FinancialControlCashflowService } from '../src/financial-control/financial-control-cashflow.service';
import { FinancialControlPnlService } from '../src/financial-control/financial-control-pnl.service';
import { PayrollFinancialAggregateService } from '../src/financial-control/aggregates/payroll-financial.aggregate';
import { ExpenseFinancialAggregateService } from '../src/financial-control/aggregates/expense-financial.aggregate';

type Doc = Record<string, any>;
type PipelineStage = Record<string, any>;

const asDate = (value: unknown): Date | null => {
  if (value == null) return null;
  if (value instanceof Date) return value;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const normalizeScalar = (value: any): any => {
  if (value instanceof Types.ObjectId) return value.toString();
  return value;
};

const getByPath = (doc: Doc, path: string): any =>
  path.split('.').reduce((acc: any, key: string) => (acc == null ? undefined : acc[key]), doc);

const evalExpr = (expr: any, doc: Doc): any => {
  if (typeof expr === 'string') {
    if (expr.startsWith('$')) return getByPath(doc, expr.slice(1));
    return expr;
  }
  if (expr && typeof expr === 'object' && Array.isArray(expr.$ifNull)) {
    for (const candidate of expr.$ifNull) {
      const value = evalExpr(candidate, doc);
      if (value !== null && value !== undefined) return value;
    }
    return null;
  }
  return expr;
};

const formatDate = (value: unknown, format: string): string => {
  const d = asDate(value);
  if (!d) return '';
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return format === '%Y-%m' ? `${yyyy}-${mm}` : `${yyyy}-${mm}-${dd}`;
};

const evalGroupId = (idExpr: any, doc: Doc): any => {
  if (idExpr === null) return null;
  if (typeof idExpr === 'string') return evalExpr(idExpr, doc);
  if (idExpr && idExpr.$dateToString) {
    const format = idExpr.$dateToString.format || '%Y-%m-%d';
    const dateExpr = idExpr.$dateToString.date;
    return formatDate(evalExpr(dateExpr, doc), format);
  }
  if (idExpr && typeof idExpr === 'object') {
    const out: Doc = {};
    for (const [key, value] of Object.entries(idExpr)) out[key] = evalExpr(value, doc);
    return out;
  }
  return idExpr;
};

const matchesCondition = (value: any, condition: any): boolean => {
  const left = normalizeScalar(value);
  if (!condition || typeof condition !== 'object' || Array.isArray(condition)) {
    return left === normalizeScalar(condition);
  }

  const leftDate = asDate(left);
  if (condition.$gte !== undefined) {
    const c = asDate(condition.$gte);
    if (leftDate && c) {
      if (leftDate < c) return false;
    } else if (left < condition.$gte) {
      return false;
    }
  }
  if (condition.$lte !== undefined) {
    const c = asDate(condition.$lte);
    if (leftDate && c) {
      if (leftDate > c) return false;
    } else if (left > condition.$lte) {
      return false;
    }
  }
  if (condition.$gt !== undefined) {
    const c = asDate(condition.$gt);
    if (leftDate && c) {
      if (leftDate <= c) return false;
    } else if (left <= condition.$gt) {
      return false;
    }
  }
  if (condition.$lt !== undefined) {
    const c = asDate(condition.$lt);
    if (leftDate && c) {
      if (leftDate >= c) return false;
    } else if (left >= condition.$lt) {
      return false;
    }
  }
  if (condition.$in !== undefined) {
    const arr = Array.isArray(condition.$in) ? condition.$in.map(normalizeScalar) : [];
    if (!arr.includes(left)) return false;
  }
  if (condition.$nin !== undefined) {
    const arr = Array.isArray(condition.$nin) ? condition.$nin.map(normalizeScalar) : [];
    if (arr.includes(left)) return false;
  }
  if (condition.$ne !== undefined && left === normalizeScalar(condition.$ne)) {
    return false;
  }
  return true;
};

const matches = (doc: Doc, filter: Doc): boolean => {
  for (const [key, condition] of Object.entries(filter || {})) {
    if (key === '$or') {
      const clauses = Array.isArray(condition) ? condition : [];
      if (!clauses.some((clause: any) => matches(doc, clause))) return false;
      continue;
    }
    const value = getByPath(doc, key);
    if (!matchesCondition(value, condition)) return false;
  }
  return true;
};

const groupDocs = (docs: Doc[], spec: Doc): Doc[] => {
  const groups = new Map<string, Doc>();
  for (const doc of docs) {
    const groupId = evalGroupId(spec._id, doc);
    const mapKey = JSON.stringify(groupId);
    if (!groups.has(mapKey)) {
      const seed: Doc = { _id: groupId };
      for (const [field, agg] of Object.entries(spec)) {
        if (field === '_id') continue;
        if ((agg as any).$sum !== undefined) seed[field] = 0;
      }
      groups.set(mapKey, seed);
    }

    const target = groups.get(mapKey)!;
    for (const [field, agg] of Object.entries(spec)) {
      if (field === '_id') continue;
      if ((agg as any).$sum !== undefined) {
        const sumExpr = (agg as any).$sum;
        const increment = sumExpr === 1 ? 1 : Number(evalExpr(sumExpr, doc) ?? 0);
        target[field] += increment;
      }
    }
  }
  return Array.from(groups.values());
};

const runPipeline = (input: Doc[], pipeline: PipelineStage[]): Doc[] => {
  let docs = [...input];
  for (const stage of pipeline || []) {
    if (stage.$match) {
      docs = docs.filter((d) => matches(d, stage.$match));
      continue;
    }
    if (stage.$addFields) {
      docs = docs.map((d) => {
        const extra: Doc = {};
        for (const [field, expr] of Object.entries(stage.$addFields)) {
          extra[field] = evalExpr(expr, d);
        }
        return { ...d, ...extra };
      });
      continue;
    }
    if (stage.$group) {
      docs = groupDocs(docs, stage.$group);
      continue;
    }
    if (stage.$sort) {
      const [field, direction] = Object.entries(stage.$sort)[0] as [string, number];
      docs = docs.sort((a, b) => {
        const left = a[field];
        const right = b[field];
        if (left === right) return 0;
        if (left === undefined || left === null) return direction >= 0 ? -1 : 1;
        if (right === undefined || right === null) return direction >= 0 ? 1 : -1;
        return left > right ? direction : -direction;
      });
      continue;
    }
  }
  return docs;
};

class QueryMock {
  constructor(private readonly docs: Doc[]) {}
  sort(): this { return this; }
  skip(): this { return this; }
  limit(): this { return this; }
  populate(): this { return this; }
  lean(): Promise<Doc[]> { return Promise.resolve(this.docs); }
}

class AggregateModelMock {
  constructor(private readonly dataRef: () => Doc[]) {}
  aggregate(pipeline: PipelineStage[]): Promise<Doc[]> {
    return Promise.resolve(runPipeline(this.dataRef(), pipeline));
  }
  find(filter: Doc = {}): QueryMock {
    return new QueryMock(this.dataRef().filter((d) => matches(d, filter)));
  }
  countDocuments(filter: Doc = {}): Promise<number> {
    return Promise.resolve(this.dataRef().filter((d) => matches(d, filter)).length);
  }
}

const createModel = (dataRef: () => Doc[]) => new AggregateModelMock(dataRef);

async function main() {
  const state = {
    sessions: [
      {
        _id: 's-1',
        status: 'FINALIZED',
        amountCharged: 1_000_000,
        teacherPayout: 300_000,
        scheduledDate: new Date('2026-02-05T00:00:00.000Z'),
      },
      {
        _id: 's-2',
        status: 'CANCELLED',
        amountCharged: 800_000,
        teacherPayout: 200_000,
        scheduledDate: new Date('2026-02-10T00:00:00.000Z'),
      },
    ] as Doc[],
    payrolls: [
      {
        _id: 'tp-1',
        payrollCode: 'PRL-202602-T1',
        status: 'APPROVED',
        netAmount: 700_000,
      },
    ] as Doc[],
    staffPayrolls: [] as Doc[],
    expenses: [] as Doc[],
    invoices: [] as Doc[],
    adCosts: [] as Doc[],
  };

  const empty = createModel(() => []);

  const payrollAggregate = new PayrollFinancialAggregateService(
    createModel(() => state.payrolls) as any,
    createModel(() => state.staffPayrolls) as any,
  );
  const expenseAggregate = new ExpenseFinancialAggregateService(
    createModel(() => state.expenses) as any,
  );

  const loanAggregate = {
    getInterestExpenseSummary: async () => ({ totalInterest: 0 }),
    getDisbursementTimeline: async () => [],
    getRepaymentTimeline: async () => [],
  };

  const bankFundService = new FinancialControlBankFundService(
    empty as any,
    empty as any,
    empty as any,
    empty as any,
    {} as any,
  );
  const cashflowService = new FinancialControlCashflowService(
    createModel(() => state.sessions) as any,
    createModel(() => state.invoices) as any,
    empty as any,
    empty as any,
    createModel(() => state.adCosts) as any,
    empty as any,
    payrollAggregate as any,
    expenseAggregate as any,
    loanAggregate as any,
  );
  const pnlService = new FinancialControlPnlService(
    empty as any,
    empty as any,
    createModel(() => state.sessions) as any,
    createModel(() => state.invoices) as any,
    empty as any,
    createModel(() => state.adCosts) as any,
    payrollAggregate as any,
    expenseAggregate as any,
    loanAggregate as any,
  );
  const service = new FinancialControlService(
    bankFundService as any,
    cashflowService as any,
    pnlService as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
  );

  const pnlBase = await service.getProfitAndLoss('2026-02-01', '2026-02-28');
  assert.equal(
    pnlBase.costs.teacherCost,
    300_000,
    'Teacher cost must start from current finalized sessions',
  );
  assert.equal(
    pnlBase.costs.payrollCost,
    0,
    'Payroll cost must be zero while payroll status is not PAID',
  );

  // Attendance changed from ABSENT/CANCELLED to PRESENT/LATE -> session finalized and counted.
  state.sessions[1].status = 'FINALIZED';
  state.sessions[1].teacherPayout = 250_000;
  const pnlAfterAttendance = await service.getProfitAndLoss('2026-02-01', '2026-02-28');
  assert.equal(
    pnlAfterAttendance.costs.teacherCost,
    550_000,
    'Teacher cost must increase after attendance-driven finalized session is added',
  );

  // Salary/session changed (teacher payout adjustment) -> Financial Control must recalculate teacher cost.
  state.sessions[1].teacherPayout = 350_000;
  const pnlAfterSessionSalaryUpdate = await service.getProfitAndLoss('2026-02-01', '2026-02-28');
  assert.equal(
    pnlAfterSessionSalaryUpdate.costs.teacherCost,
    650_000,
    'Teacher cost must reflect updated salary per session',
  );

  // Teacher payroll marked as paid -> Financial Control payroll cost and cash outflow must update.
  state.payrolls[0].status = 'PAID';
  state.payrolls[0].paidAt = new Date('2026-02-20T00:00:00.000Z');

  const pnlAfterPayrollPaid = await service.getProfitAndLoss('2026-02-01', '2026-02-28');
  assert.equal(
    pnlAfterPayrollPaid.costs.payrollCost,
    700_000,
    'Payroll cost must update when payroll payment status changes to PAID',
  );

  const cashFlow = await service.getCashFlow({
    startDate: '2026-02-01',
    endDate: '2026-02-28',
    groupBy: 'day',
  } as any);
  const feb20 = cashFlow.timeline.find((t: any) => t.date === '2026-02-20');
  assert.equal(
    feb20?.outflow?.payroll || 0,
    700_000,
    'Cash flow payroll outflow must recalculate from payroll status change',
  );

  console.log('PASS: attendance/payroll update -> financial-control recalculation checks');
}

main().catch((err) => {
  console.error('FAIL: attendance/payroll update -> financial-control recalculation checks');
  console.error(err);
  process.exit(1);
});
