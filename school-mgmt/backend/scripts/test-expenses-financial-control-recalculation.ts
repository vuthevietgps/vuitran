import 'reflect-metadata';
import { strict as assert } from 'node:assert';
import { BadRequestException } from '@nestjs/common';
import { ExpensesService } from '../src/expenses/expenses.service';
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

const setByPath = (doc: Doc, path: string, value: any): void => {
  const parts = path.split('.');
  let cursor: Doc = doc;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    if (cursor[key] == null || typeof cursor[key] !== 'object') {
      cursor[key] = {};
    }
    cursor = cursor[key];
  }
  cursor[parts[parts.length - 1]] = value;
};

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

  const dateValue = asDate(value);
  if (condition.$gte !== undefined) {
    const c = asDate(condition.$gte);
    if (dateValue && c) {
      if (dateValue < c) return false;
    } else if (value < condition.$gte) {
      return false;
    }
  }
  if (condition.$lte !== undefined) {
    const c = asDate(condition.$lte);
    if (dateValue && c) {
      if (dateValue > c) return false;
    } else if (value > condition.$lte) {
      return false;
    }
  }
  if (condition.$gt !== undefined) {
    const c = asDate(condition.$gt);
    if (dateValue && c) {
      if (dateValue <= c) return false;
    } else if (value <= condition.$gt) {
      return false;
    }
  }
  if (condition.$lt !== undefined) {
    const c = asDate(condition.$lt);
    if (dateValue && c) {
      if (dateValue >= c) return false;
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
      const path = String(stage.$unwind).replace(/^\$/, '');
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

class QueryArrayMock {
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

  populate(): this {
    return this;
  }

  lean(): Promise<Doc[]> {
    return Promise.resolve(this.docs);
  }

  exec(): Promise<Doc[]> {
    return Promise.resolve(this.docs);
  }
}

class QueryOneMock {
  constructor(private readonly runner: () => Doc | null | Promise<Doc | null>) {}

  async lean(): Promise<Doc | null> {
    return this.runner();
  }

  async exec(): Promise<Doc | null> {
    return this.runner();
  }
}

class AggregateModelMock {
  constructor(private readonly dataRef: () => Doc[]) {}

  aggregate(pipeline: PipelineStage[]): Promise<Doc[]> {
    return Promise.resolve(runPipeline(this.dataRef(), pipeline));
  }

  find(filter: Doc = {}): QueryArrayMock {
    return new QueryArrayMock(this.dataRef().filter((d) => matches(d, filter)));
  }

  countDocuments(filter: Doc = {}): Promise<number> {
    return Promise.resolve(this.dataRef().filter((d) => matches(d, filter)).length);
  }
}

const applyUpdate = (doc: Doc, update: Doc): void => {
  if (update.$set && typeof update.$set === 'object') {
    for (const [key, value] of Object.entries(update.$set)) {
      setByPath(doc, key, value);
    }
  }

  if (update.$inc && typeof update.$inc === 'object') {
    for (const [key, value] of Object.entries(update.$inc)) {
      const current = Number(getByPath(doc, key) || 0);
      setByPath(doc, key, current + Number(value));
    }
  }

  for (const [key, value] of Object.entries(update)) {
    if (!key.startsWith('$')) {
      setByPath(doc, key, value);
    }
  }
};

class ExpenseModelMock extends AggregateModelMock {
  private beforeFindOneAndUpdateHooks: Array<(filter: Doc, update: Doc) => void> = [];

  constructor(private readonly store: Doc[]) {
    super(() => store);
  }

  queueBeforeFindOneAndUpdate(hook: (filter: Doc, update: Doc) => void): void {
    this.beforeFindOneAndUpdateHooks.push(hook);
  }

  findById(id: string): QueryOneMock {
    return new QueryOneMock(() => this.store.find((d) => String(d._id) === String(id)) || null);
  }

  findOne(filter: Doc = {}): QueryOneMock {
    return new QueryOneMock(() => this.store.find((d) => matches(d, filter)) || null);
  }

  findOneAndUpdate(filter: Doc, update: Doc, options: Doc = {}): QueryOneMock {
    return new QueryOneMock(() => {
      const hook = this.beforeFindOneAndUpdateHooks.shift();
      if (hook) hook(filter, update);

      const idx = this.store.findIndex((d) => matches(d, filter));
      if (idx < 0) return null;

      const current = this.store[idx];
      const previous = { ...current };
      applyUpdate(current, update || {});
      current.updatedAt = new Date();
      this.store[idx] = current;

      return options.new ? current : previous;
    });
  }

  findOneAndDelete(filter: Doc): QueryOneMock {
    return new QueryOneMock(() => {
      const idx = this.store.findIndex((d) => matches(d, filter));
      if (idx < 0) return null;
      const [deleted] = this.store.splice(idx, 1);
      return deleted || null;
    });
  }
}

const createModel = (dataRef: () => Doc[]) => new AggregateModelMock(dataRef);

async function main() {
  const state = {
    bankAccounts: [
      {
        _id: 'ba-1',
        accountCode: 'BA-001',
        bankName: 'VCB',
        accountNumber: '123456789',
        currentBalance: 12_000_000,
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
    sessions: [] as Doc[],
    invoices: [] as Doc[],
    ledgers: [] as Doc[],
    wallets: [{ _id: 'w-1', status: 'ACTIVE', balance: 0 }],
    adCosts: [] as Doc[],
    adGroups: [] as Doc[],
    orders: [] as Doc[],
    leads: [] as Doc[],
    students: [] as Doc[],
    expenses: [
      {
        _id: 'exp-1',
        expenseCode: 'EXP-00001',
        title: 'Office rent',
        category: 'RENT',
        amount: 1_000_000,
        expenseDate: new Date('2026-01-25T00:00:00.000Z'),
        paymentStatus: 'APPROVED_UNPAID',
        createdById: 'user-1',
        createdByName: 'Creator',
      },
      {
        _id: 'exp-2',
        expenseCode: 'EXP-00002',
        title: 'Water bill',
        category: 'UTILITIES',
        amount: 400_000,
        expenseDate: new Date('2026-01-28T00:00:00.000Z'),
        paymentStatus: 'APPROVED_UNPAID',
        createdById: 'user-1',
        createdByName: 'Creator',
      },
      {
        _id: 'exp-3',
        expenseCode: 'EXP-00003',
        title: 'Internet',
        category: 'UTILITIES',
        amount: 500_000,
        expenseDate: new Date('2026-01-15T00:00:00.000Z'),
        paidAt: new Date('2026-02-03T00:00:00.000Z'),
        paymentStatus: 'PAID',
        createdById: 'user-1',
        createdByName: 'Creator',
      },
    ] as Doc[],
    payrolls: [] as Doc[],
    staffPayrolls: [] as Doc[],
    loans: [] as Doc[],
    loanPayments: [] as Doc[],
  };

  const expenseModel = new ExpenseModelMock(state.expenses);
  const empty = createModel(() => []);
  const mockConnection = {
    startSession: async () => ({
      startTransaction: () => undefined,
      commitTransaction: async () => undefined,
      abortTransaction: async () => undefined,
      withTransaction: async (work: () => Promise<any>) => work(),
      endSession: () => undefined,
    }),
  };
  const payrollAggregate = new PayrollFinancialAggregateService(
    createModel(() => state.payrolls) as any,
    createModel(() => state.staffPayrolls) as any,
  );
  const expenseAggregate = new ExpenseFinancialAggregateService(expenseModel as any);
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
    mockConnection as any,
  );

  const financialControlService = new FinancialControlService(
    createModel(() => state.bankAccounts) as any,
    empty as any,
    createModel(() => state.funds) as any,
    empty as any,
    createModel(() => state.sessions) as any,
    expenseModel as any,
    createModel(() => state.invoices) as any,
    createModel(() => state.ledgers) as any,
    createModel(() => state.wallets) as any,
    createModel(() => state.adCosts) as any,
    createModel(() => state.adGroups) as any,
    createModel(() => state.orders) as any,
    createModel(() => state.leads) as any,
    createModel(() => state.students) as any,
    empty as any,
    mockConnection as any,
    payrollAggregate as any,
    expenseAggregate as any,
    loanAggregate as any,
    bankFundService as any,
  );

  const expensesService = new ExpensesService(
    expenseModel as any,
    mockConnection as any,
    financialControlService,
  );

  const creatorUser = {
    sub: 'user-1',
    _id: 'user-1',
    email: 'creator@example.com',
    role: 'OPS',
    fullName: 'Creator',
  } as any;
  const accountingUser = {
    sub: 'acc-1',
    _id: 'acc-1',
    email: 'accounting@example.com',
    role: 'ACCOUNTING',
    fullName: 'Accounting',
  } as any;

  const dashboardBefore = await financialControlService.getFinancialDashboard();
  assert.equal(
    dashboardBefore.obligations.expensePayable,
    1_400_000,
    'Dashboard payable must include all APPROVED_UNPAID expenses',
  );
  assert.equal(
    dashboardBefore.obligations.expensePayableCount,
    2,
    'Dashboard payable count must reflect APPROVED_UNPAID expenses',
  );

  await expensesService.update('exp-1', { amount: 1_250_000 }, creatorUser);

  const dashboardAfterUpdate = await financialControlService.getFinancialDashboard();
  assert.equal(
    dashboardAfterUpdate.obligations.expensePayable,
    1_650_000,
    'Updating expense amount must recalculate Financial Control payable in real time',
  );
  assert.equal(
    dashboardAfterUpdate.obligations.expensePayableCount,
    2,
    'Updating amount must not alter payable count',
  );

  expenseModel.queueBeforeFindOneAndUpdate(() => {
    const raceTarget = state.expenses.find((e) => e._id === 'exp-2');
    if (!raceTarget) return;
    raceTarget.paymentStatus = 'PAID';
    raceTarget.paidAt = new Date('2026-03-01T00:00:00.000Z');
  });

  await assert.rejects(
    () => expensesService.update('exp-2', { amount: 999_000 }, creatorUser),
    (err: any) =>
      err instanceof BadRequestException &&
      String(err.message).includes('Cannot update a paid expense'),
    'Race update must be rejected once expense turns PAID before atomic update commit',
  );

  const expenseAfterRace = state.expenses.find((e) => e._id === 'exp-2');
  assert.ok(expenseAfterRace, 'Race expense must still exist');
  assert.equal(
    expenseAfterRace?.amount,
    400_000,
    'Race-protected update must not overwrite amount after expense became PAID',
  );

  const dashboardAfterRace = await financialControlService.getFinancialDashboard();
  assert.equal(
    dashboardAfterRace.obligations.expensePayable,
    1_250_000,
    'Once race expense became PAID, payable must exclude it immediately',
  );
  assert.equal(
    dashboardAfterRace.obligations.expensePayableCount,
    1,
    'Once race expense became PAID, payable count must decrease',
  );

  const paidExpense = await expensesService.markPaid(
    'exp-1',
    { paymentMethod: 'CASH', paidAt: '2026-02-10' } as any,
    accountingUser,
  );
  assert.equal(paidExpense.paymentStatus, 'PAID', 'Expense status must move to PAID');

  const dashboardAfterPaid = await financialControlService.getFinancialDashboard();
  assert.equal(
    dashboardAfterPaid.obligations.expensePayable,
    0,
    'After markPaid, Financial Control payable must be zero',
  );
  assert.equal(
    dashboardAfterPaid.obligations.expensePayableCount,
    0,
    'After markPaid, payable count must be zero',
  );

  const pnl = await financialControlService.getProfitAndLoss('2026-02-01', '2026-02-28');
  assert.equal(
    pnl.costs.operatingExpenses,
    1_750_000,
    'P&L must reflect updated paid expense amount in February',
  );

  const cashFlow = await financialControlService.getCashFlow({
    startDate: '2026-02-01',
    endDate: '2026-02-28',
    groupBy: 'day',
  } as any);
  const feb10 = cashFlow.timeline.find((t: any) => t.date === '2026-02-10');
  assert.ok(feb10, 'Cash-flow timeline must include paid date after update');
  assert.equal(
    feb10.outflow.expenses,
    1_250_000,
    'Cash-flow outflow must use updated amount when expense is paid',
  );
  assert.equal(
    cashFlow.totalOutflow,
    1_750_000,
    'Cash-flow total outflow must be recalculated correctly after updates',
  );

  console.log('PASS: update expense -> financial control recalculation checks');
}

main().catch((err) => {
  console.error('FAIL: update expense -> financial control recalculation checks');
  console.error(err);
  process.exit(1);
});
