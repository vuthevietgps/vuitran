import 'reflect-metadata';
import { strict as assert } from 'node:assert';
import { FinancialControlService } from '../src/financial-control/financial-control.service';
import { FinancialControlBankFundService } from '../src/financial-control/financial-control-bank-fund.service';
import { FinancialControlCashflowService } from '../src/financial-control/financial-control-cashflow.service';
import { FinancialControlPnlService } from '../src/financial-control/financial-control-pnl.service';
import { FinancialControlDashboardService } from '../src/financial-control/financial-control-dashboard.service';
import { FinancialControlAgingService } from '../src/financial-control/financial-control-aging.service';
import { PayrollFinancialAggregateService } from '../src/financial-control/aggregates/payroll-financial.aggregate';
import { ExpenseFinancialAggregateService } from '../src/financial-control/aggregates/expense-financial.aggregate';
import { LoanFinancialAggregateService } from '../src/financial-control/aggregates/loan-financial.aggregate';

type Doc = Record<string, any>;
type PipelineStage = Record<string, any>;

const asDate = (value: unknown): Date | null => {
  if (value == null) return null;
  if (value instanceof Date) return value;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
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
  if (expr && typeof expr === 'object' && Array.isArray(expr.$gt)) {
    return Number(evalExpr(expr.$gt[0], doc) ?? 0) > Number(evalExpr(expr.$gt[1], doc) ?? 0);
  }
  if (expr && typeof expr === 'object' && Array.isArray(expr.$lt)) {
    return Number(evalExpr(expr.$lt[0], doc) ?? 0) < Number(evalExpr(expr.$lt[1], doc) ?? 0);
  }
  if (expr && typeof expr === 'object' && Array.isArray(expr.$cond)) {
    const [condition, whenTrue, whenFalse] = expr.$cond;
    return evalExpr(condition, doc) ? evalExpr(whenTrue, doc) : evalExpr(whenFalse, doc);
  }
  if (expr && typeof expr === 'object' && expr.$abs !== undefined) {
    return Math.abs(Number(evalExpr(expr.$abs, doc) ?? 0));
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
    for (const [key, value] of Object.entries(idExpr)) {
      out[key] = evalExpr(value, doc);
    }
    return out;
  }
  return idExpr;
};

const matchesCondition = (value: any, condition: any): boolean => {
  if (!condition || typeof condition !== 'object' || Array.isArray(condition)) {
    return value === condition;
  }
  const vDate = asDate(value);
  if (condition.$gte !== undefined) {
    const c = asDate(condition.$gte);
    if (vDate && c) {
      if (vDate < c) return false;
    } else if (value < condition.$gte) {
      return false;
    }
  }
  if (condition.$lte !== undefined) {
    const c = asDate(condition.$lte);
    if (vDate && c) {
      if (vDate > c) return false;
    } else if (value > condition.$lte) {
      return false;
    }
  }
  if (condition.$gt !== undefined) {
    const c = asDate(condition.$gt);
    if (vDate && c) {
      if (vDate <= c) return false;
    } else if (value <= condition.$gt) {
      return false;
    }
  }
  if (condition.$lt !== undefined) {
    const c = asDate(condition.$lt);
    if (vDate && c) {
      if (vDate >= c) return false;
    } else if (value >= condition.$lt) {
      return false;
    }
  }
  if (condition.$in !== undefined) {
    if (!Array.isArray(condition.$in) || !condition.$in.includes(value)) return false;
  }
  if (condition.$nin !== undefined) {
    if (Array.isArray(condition.$nin) && condition.$nin.includes(value)) return false;
  }
  if (condition.$ne !== undefined) {
    if (value === condition.$ne) return false;
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
        if ((agg as any).$push !== undefined) seed[field] = [];
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
      if ((agg as any).$push !== undefined) {
        const pushExpr = (agg as any).$push;
        if (pushExpr && typeof pushExpr === 'object' && !Array.isArray(pushExpr)) {
          const pushed: Doc = {};
          for (const [k, v] of Object.entries(pushExpr)) pushed[k] = evalExpr(v, doc);
          target[field].push(pushed);
        } else {
          target[field].push(evalExpr(pushExpr, doc));
        }
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
    if (stage.$unwind) {
      const path: string = String(stage.$unwind).replace(/^\$/, '');
      const out: Doc[] = [];
      for (const d of docs) {
        const arr = getByPath(d, path);
        if (!Array.isArray(arr)) continue;
        for (const item of arr) out.push({ ...d, [path]: item });
      }
      docs = out;
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

  sort(): this {
    return this;
  }

  skip(): this {
    return this;
  }

  limit(): this {
    return this;
  }

  lean(): Promise<Doc[]> {
    return Promise.resolve(this.docs);
  }

  exec(): Promise<Doc[]> {
    return Promise.resolve(this.docs);
  }
}

class ModelMock {
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

const createModel = (dataRef: () => Doc[]) => new ModelMock(dataRef);

async function main() {
  const state = {
    bankAccounts: [
      {
        _id: 'ba-1',
        accountCode: 'BA-001',
        bankName: 'VCB',
        accountNumber: '123456789',
        currentBalance: 10_000_000,
        status: 'ACTIVE',
        isPrimary: true,
      },
    ],
    funds: [
      {
        _id: 'fund-1',
        fundCode: 'FUND-001',
        name: 'Reserve',
        fundType: 'RESERVE',
        currentBalance: 2_000_000,
        minimumBalance: 0,
        targetBalance: 0,
        status: 'ACTIVE',
      },
    ],
    sessions: [
      {
        _id: 's-1',
        status: 'FINALIZED',
        amountCharged: 5_000_000,
        teacherPayout: 2_000_000,
        scheduledDate: new Date('2026-02-01T00:00:00.000Z'),
      },
    ],
    invoices: [
      {
        _id: 'inv-1',
        status: 'APPROVED',
        amount: 2_000_000,
        invoiceType: 'TUITION',
        paymentDate: new Date('2026-02-02T00:00:00.000Z'),
      },
    ] as Doc[],
    payrolls: [] as Doc[],
    expenses: [
      {
        _id: 'e-1',
        title: 'Office rent',
        category: 'RENT',
        amount: 1_000_000,
        paymentStatus: 'APPROVED_UNPAID',
        expenseDate: new Date('2026-01-05T00:00:00.000Z'),
      },
      {
        _id: 'e-2',
        title: 'Electricity',
        category: 'UTILITIES',
        amount: 500_000,
        paymentStatus: 'PAID',
        expenseDate: new Date('2026-01-15T00:00:00.000Z'),
        paidAt: new Date('2026-02-03T00:00:00.000Z'),
      },
    ],
    ledgers: [
      {
        _id: 'led-1',
        type: 'TOP_UP',
        status: 'APPROVED',
        amount: 2_000_000,
        paymentMethod: 'SYSTEM',
        createdAt: new Date('2026-02-02T00:00:00.000Z'),
      },
      {
        _id: 'led-2',
        type: 'TOP_UP',
        status: 'APPROVED',
        amount: 300_000,
        paymentMethod: 'BANK_TRANSFER',
        createdAt: new Date('2026-02-03T00:00:00.000Z'),
      },
    ] as Doc[],
    wallets: [
      { _id: 'w-1', status: 'ACTIVE', balance: 1_000_000 },
      { _id: 'w-2', status: 'ACTIVE', balance: -200_000 },
    ],
    adCosts: [] as Doc[],
    orders: [] as Doc[],
    loans: [] as Doc[],
    loanPayments: [] as Doc[],
  };

  const empty = createModel(() => []);
  const payrollAggregate = new PayrollFinancialAggregateService(
    empty as any,
    empty as any,
  );
  const expenseAggregate = new ExpenseFinancialAggregateService(
    createModel(() => state.expenses) as any,
  );
  const loanAggregate = new LoanFinancialAggregateService(
    createModel(() => state.loans) as any,
    createModel(() => state.loanPayments) as any,
    empty as any,
  );
  const bankFundService = new FinancialControlBankFundService(
    createModel(() => state.bankAccounts) as any,
    empty as any,
    createModel(() => state.funds) as any,
    empty as any,
    {} as any,
  );
  const cashflowService = new FinancialControlCashflowService(
    createModel(() => state.sessions) as any,
    createModel(() => state.invoices) as any,
    createModel(() => state.ledgers) as any,
    createModel(() => state.wallets) as any,
    createModel(() => state.adCosts) as any,
    empty as any,
    payrollAggregate as any,
    expenseAggregate as any,
    loanAggregate as any,
  );
  const pnlService = new FinancialControlPnlService(
    createModel(() => state.bankAccounts) as any,
    createModel(() => state.funds) as any,
    createModel(() => state.sessions) as any,
    createModel(() => state.invoices) as any,
    createModel(() => state.wallets) as any,
    createModel(() => state.adCosts) as any,
    payrollAggregate as any,
    expenseAggregate as any,
    loanAggregate as any,
  );
  const agingService = new FinancialControlAgingService(
    createModel(() => state.invoices) as any,
    createModel(() => state.wallets) as any,
  );
  const dashboardService = new FinancialControlDashboardService(
    empty as any,
    createModel(() => state.funds) as any,
    createModel(() => state.sessions) as any,
    createModel(() => state.invoices) as any,
    createModel(() => state.wallets) as any,
    createModel(() => state.orders) as any,
    empty as any,
    payrollAggregate as any,
    expenseAggregate as any,
    loanAggregate as any,
    bankFundService as any,
    cashflowService as any,
    pnlService as any,
    agingService as any,
    undefined,
    undefined,
  );

  const service = new FinancialControlService(
    bankFundService as any,
    cashflowService as any,
    pnlService as any,
    dashboardService as any,
    {} as any,
    agingService as any,
    {} as any,
  );

  const dashboardBefore = await service.getFinancialDashboard();
  assert.equal(dashboardBefore.obligations.expensePayable, 1_000_000, 'Dashboard payable must include APPROVED_UNPAID expenses');
  assert.equal(dashboardBefore.obligations.expensePayableCount, 1, 'Dashboard payable count must match pending expenses');
  assert.equal(
    dashboardBefore.deferredRevenue.walletBalance,
    1_000_000,
    'Dashboard wallet liability must use positive wallet balances only',
  );

  const balanceBefore = await service.getBalanceSheet();
  assert.equal(balanceBefore.liabilities.totalPendingExpenses, 1_000_000, 'Balance sheet must include pending expense liabilities');
  assert.equal(balanceBefore.assets.totalBankBalance, 10_000_000, 'Balance sheet must use bank currentBalance');
  assert.equal(balanceBefore.assets.totalFundBalance, 2_000_000, 'Balance sheet must use fund currentBalance');

  const pnlBefore = await service.getProfitAndLoss('2026-02-01', '2026-02-28');
  assert.equal(pnlBefore.basis?.selected, 'cash', 'P&L must default to cash basis for CFO consistency');
  assert.equal(pnlBefore.revenue.total, 2_000_000, 'Cash-basis P&L revenue must use approved invoice collections');
  assert.equal(pnlBefore.costs.operatingExpenses, 500_000, 'P&L must classify paid expense into the paid month');
  assert.equal(
    pnlBefore.costs.totalCosts,
    500_000,
    'Cash-basis P&L total costs must not double-count teacher accrual cost',
  );

  const cashFlowBefore = await service.getCashFlow({ startDate: '2026-02-01', endDate: '2026-02-28', groupBy: 'day' } as any);
  const feb03Before = cashFlowBefore.timeline.find((t: any) => t.date === '2026-02-03');
  assert.ok(feb03Before, 'Cash-flow timeline must contain paid expense date');
  assert.equal(feb03Before.outflow.expenses, 500_000, 'Cash-flow expense outflow must use paid date');
  assert.equal(cashFlowBefore.basis?.applied, 'cash', 'Cash-flow totals must remain cash basis');
  assert.equal(cashFlowBefore.accrualReference?.sessionRevenue, 5_000_000, 'Cash-flow must expose session revenue as accrual reference');
  assert.equal(cashFlowBefore.accrualReference?.teacherCost, 2_000_000, 'Cash-flow must expose teacher cost as accrual reference');
  assert.equal(
    cashFlowBefore.totalInflow,
    2_300_000,
    'Cash-flow inflow must not double-count invoice-driven wallet top-ups',
  );

  state.expenses[0].amount = 1_200_000;
  state.expenses[0].paymentStatus = 'PAID';
  state.expenses[0].paidAt = new Date('2026-02-10T00:00:00.000Z');

  const dashboardAfter = await service.getFinancialDashboard();
  assert.equal(dashboardAfter.obligations.expensePayable, 0, 'Paying expense must remove it from dashboard payable');
  assert.equal(dashboardAfter.obligations.expensePayableCount, 0, 'Paying expense must reduce payable count');

  const pnlAfter = await service.getProfitAndLoss('2026-02-01', '2026-02-28');
  assert.equal(pnlAfter.costs.operatingExpenses, 1_700_000, 'P&L must reflect updated paid expense amount');

  const cashFlowAfter = await service.getCashFlow({ startDate: '2026-02-01', endDate: '2026-02-28', groupBy: 'day' } as any);
  const feb10After = cashFlowAfter.timeline.find((t: any) => t.date === '2026-02-10');
  assert.ok(feb10After, 'Cash-flow timeline must include newly paid expense date');
  assert.equal(feb10After.outflow.expenses, 1_200_000, 'Cash-flow must include updated expense amount');
  assert.equal(cashFlowAfter.totalOutflow, 1_700_000, 'Cash-flow total outflow must update after expense changes');

  console.log('PASS: financial-control cost regression checks');
}

main().catch((err) => {
  console.error('FAIL: financial-control cost regression checks');
  console.error(err);
  process.exit(1);
});
