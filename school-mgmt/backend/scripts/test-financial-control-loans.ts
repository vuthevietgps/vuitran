import 'reflect-metadata';
import { strict as assert } from 'node:assert';
import { FinancialControlService } from '../src/financial-control/financial-control.service';
import { FinancialControlBankFundService } from '../src/financial-control/financial-control-bank-fund.service';
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
  if (expr && typeof expr === 'object' && Array.isArray(expr.$subtract)) {
    const left = Number(evalExpr(expr.$subtract[0], doc) ?? 0);
    const right = Number(evalExpr(expr.$subtract[1], doc) ?? 0);
    return left - right;
  }
  if (expr && typeof expr === 'object' && Array.isArray(expr.$max)) {
    return expr.$max.reduce((max: number, item: any) => {
      const value = Number(evalExpr(item, doc) ?? 0);
      return value > max ? value : max;
    }, Number.NEGATIVE_INFINITY);
  }
  if (expr && typeof expr === 'object' && Array.isArray(expr.$eq)) {
    return evalExpr(expr.$eq[0], doc) === evalExpr(expr.$eq[1], doc);
  }
  if (expr && typeof expr === 'object' && Array.isArray(expr.$cond)) {
    const [condition, whenTrue, whenFalse] = expr.$cond;
    return evalExpr(condition, doc) ? evalExpr(whenTrue, doc) : evalExpr(whenFalse, doc);
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
  sort(): this { return this; }
  skip(): this { return this; }
  limit(): this { return this; }
  lean(): Promise<Doc[]> { return Promise.resolve(this.docs); }
  exec(): Promise<Doc[]> { return Promise.resolve(this.docs); }
}

class ModelMock {
  constructor(private readonly dataRef: () => Doc[]) {}
  aggregate(pipeline: PipelineStage[]): Promise<Doc[]> { return Promise.resolve(runPipeline(this.dataRef(), pipeline)); }
  find(filter: Doc = {}): QueryMock { return new QueryMock(this.dataRef().filter((d) => matches(d, filter))); }
  countDocuments(filter: Doc = {}): Promise<number> { return Promise.resolve(this.dataRef().filter((d) => matches(d, filter)).length); }
}

const createModel = (dataRef: () => Doc[]) => new ModelMock(dataRef);

async function main() {
  const now = new Date();
  const in10Days = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000);
  const in20Days = new Date(now.getTime() + 20 * 24 * 60 * 60 * 1000);
  const past7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const past14Days = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  const state = {
    bankAccounts: [{
      _id: 'ba-1',
      accountCode: 'BA-001',
      bankName: 'VCB',
      accountNumber: '123456',
      currentBalance: 10_000_000,
      status: 'ACTIVE',
      isPrimary: true,
    }],
    funds: [] as Doc[],
    sessions: [] as Doc[],
    invoices: [] as Doc[],
    expenses: [] as Doc[],
    bankTransactions: [
      {
        _id: 'bt-1',
        category: 'LOAN_DISBURSEMENT',
        amount: 100_000_000,
        transactionDate: past14Days,
      },
      {
        _id: 'bt-2',
        category: 'LOAN_REPAYMENT',
        amount: 8_000_000,
        transactionDate: past7Days,
      },
      {
        _id: 'bt-3',
        category: 'LOAN_REPAYMENT',
        amount: 2_000_000,
        transactionDate: past14Days,
      },
    ] as Doc[],
    ledgers: [] as Doc[],
    wallets: [{ _id: 'w-1', status: 'ACTIVE', balance: 0 }],
    adCosts: [] as Doc[],
    orders: [] as Doc[],
    loans: [{
      _id: 'loan-1',
      status: 'ACTIVE',
      principal: 100_000_000,
      remainingBalance: 70_000_000,
      startDate: past14Days,
      endDate: in20Days,
    }],
    loanPayments: [
      {
        _id: 'lp-1',
        status: 'PARTIAL',
        dueDate: in10Days,
        paidDate: past7Days,
        totalAmount: 20_000_000,
        principalAmount: 15_000_000,
        interestAmount: 5_000_000,
        paidAmount: 8_000_000,
        paidPrincipal: 3_000_000,
        paidInterest: 5_000_000,
      },
      {
        _id: 'lp-2',
        status: 'SCHEDULED',
        dueDate: in20Days,
        totalAmount: 30_000_000,
        principalAmount: 30_000_000,
        interestAmount: 0,
        paidAmount: 0,
        paidPrincipal: 0,
        paidInterest: 0,
      },
      {
        _id: 'lp-3',
        status: 'OVERDUE',
        dueDate: past7Days,
        paidDate: past14Days,
        totalAmount: 10_000_000,
        principalAmount: 5_000_000,
        interestAmount: 5_000_000,
        paidAmount: 2_000_000,
        paidPrincipal: 500_000,
        paidInterest: 1_500_000,
      },
    ] as Doc[],
  };

  const empty = createModel(() => []);
  const payrollAggregate = new PayrollFinancialAggregateService(empty as any, empty as any);
  const expenseAggregate = new ExpenseFinancialAggregateService(createModel(() => state.expenses) as any);
  const loanAggregate = new LoanFinancialAggregateService(
    createModel(() => state.loans) as any,
    createModel(() => state.loanPayments) as any,
    createModel(() => state.bankTransactions) as any,
  );
  const bankFundService = new FinancialControlBankFundService(
    createModel(() => state.bankAccounts) as any,
    createModel(() => state.bankTransactions) as any,
    createModel(() => state.funds) as any,
    empty as any,
    {} as any,
  );

  const service = new FinancialControlService(
    createModel(() => state.bankAccounts) as any,
    createModel(() => state.bankTransactions) as any,
    createModel(() => state.funds) as any,
    empty as any,
    createModel(() => state.sessions) as any,
    createModel(() => state.expenses) as any,
    createModel(() => state.invoices) as any,
    createModel(() => state.ledgers) as any,
    createModel(() => state.wallets) as any,
    createModel(() => state.adCosts) as any,
    empty as any,
    createModel(() => state.orders) as any,
    empty as any,
    empty as any,
    empty as any,
    {} as any,
    payrollAggregate as any,
    expenseAggregate as any,
    loanAggregate as any,
    bankFundService as any,
  );

  const cashFlowBefore = await service.getCashFlow({ groupBy: 'day' } as any);
  assert.equal(cashFlowBefore.totalInflow, 100_000_000, 'Cash-flow inflow must include 100M loan disbursement principal');
  assert.equal(cashFlowBefore.totalOutflow, 10_000_000, 'Cash-flow outflow must include paid loan amounts only');

  const pnlBefore = await service.getProfitAndLoss();
  assert.equal(pnlBefore.costs.interestExpense, 6_500_000, 'P&L interest expense must use paid interest, including partial payments');

  const dashboardBefore = await service.getFinancialDashboard();
  assert.equal(dashboardBefore.debtPosition.totalDebt, 70_000_000, 'Dashboard debt must use remaining loan balance');
  assert.equal(dashboardBefore.debtPosition.loanPayable, 50_000_000, 'Dashboard upcoming loan payable must use outstanding installment amounts');
  assert.equal(dashboardBefore.debtPosition.loanPayableCount, 3, 'Dashboard loan payable count must include overdue/scheduled/partial installments');

  const balanceSheetBefore = await service.getBalanceSheet();
  assert.equal(balanceSheetBefore.liabilities.totalLoans, 70_000_000, 'Balance sheet liabilities must use outstanding debt');

  // Simulate repayment update from loans module and verify Financial Control re-calculates from source data.
  state.bankTransactions.push({
    _id: 'bt-4',
    category: 'LOAN_REPAYMENT',
    amount: 12_000_000,
    transactionDate: now,
  });
  state.loanPayments[0].paidAmount = 20_000_000;
  state.loanPayments[0].paidPrincipal = 15_000_000;
  state.loanPayments[0].paidInterest = 5_000_000;
  state.loanPayments[0].status = 'PAID';
  state.loanPayments[0].paidDate = now;
  state.loans[0].remainingBalance = 58_000_000;

  const cashFlowAfter = await service.getCashFlow({ groupBy: 'day' } as any);
  assert.equal(cashFlowAfter.totalOutflow, 22_000_000, 'Cash-flow outflow must increase after additional loan repayment');

  const dashboardAfter = await service.getFinancialDashboard();
  assert.equal(dashboardAfter.debtPosition.totalDebt, 58_000_000, 'Dashboard debt must decrease after principal repayment');
  assert.equal(dashboardAfter.debtPosition.loanPayable, 38_000_000, 'Dashboard upcoming payable must recalculate after repayment');
  assert.equal(dashboardAfter.debtPosition.loanPayableCount, 2, 'Dashboard payable count must drop after installment becomes PAID');

  const balanceSheetAfter = await service.getBalanceSheet();
  assert.equal(balanceSheetAfter.liabilities.totalLoans, 58_000_000, 'Balance sheet liabilities must be recalculated after loan update');

  console.log('PASS: financial-control loan regression checks');
}

main().catch((err) => {
  console.error('FAIL: financial-control loan regression checks');
  console.error(err);
  process.exitCode = 1;
});
