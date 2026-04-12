import 'reflect-metadata';
import { strict as assert } from 'node:assert';
import { Types } from 'mongoose';
import { FinancialControlService } from '../src/financial-control/financial-control.service';
import { FinancialControlBankFundService } from '../src/financial-control/financial-control-bank-fund.service';
import { FinancialControlCashflowService } from '../src/financial-control/financial-control-cashflow.service';
import { FinancialControlPnlService } from '../src/financial-control/financial-control-pnl.service';
import { FinancialControlDashboardService } from '../src/financial-control/financial-control-dashboard.service';
import { FinancialControlAgingService } from '../src/financial-control/financial-control-aging.service';
import { StaffPayrollService } from '../src/staff-payroll/staff-payroll.service';
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

class QueryMock {
  constructor(private readonly docs: Doc[]) {}
  sort(): this { return this; }
  skip(): this { return this; }
  limit(): this { return this; }
  populate(): this { return this; }
  lean(): Promise<Doc[]> { return Promise.resolve(this.docs); }
  exec(): Promise<Doc[]> { return Promise.resolve(this.docs); }
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

class StaffPayrollDocMock {
  [key: string]: any;

  constructor(
    private readonly store: Doc[],
    payload: Doc,
  ) {
    Object.assign(this, payload);
  }

  async save(): Promise<this> {
    const idx = this.store.findIndex((d) => String(d._id) === String(this._id));
    if (idx >= 0) {
      this.store[idx] = this;
    } else {
      this.store.push(this);
    }
    return this;
  }
}

class StaffPayrollModelMock {
  constructor(private readonly store: Doc[]) {}

  async findOne(filter: Doc): Promise<StaffPayrollDocMock | null> {
    const found = this.store.find((d) => matches(d, filter));
    return found ? (found as StaffPayrollDocMock) : null;
  }

  async create(payload: Doc): Promise<StaffPayrollDocMock> {
    const doc = new StaffPayrollDocMock(this.store, {
      _id: new Types.ObjectId(),
      createdAt: new Date(),
      updatedAt: new Date(),
      ...payload,
    });
    this.store.push(doc);
    return doc;
  }

  async findById(id: string): Promise<StaffPayrollDocMock | null> {
    const found = this.store.find((d) => String(d._id) === String(id));
    return found ? (found as StaffPayrollDocMock) : null;
  }
}

const createModel = (dataRef: () => Doc[]) => new AggregateModelMock(dataRef);

async function testSalaryConfigAttendanceToPayroll() {
  const staffPayrollStore: Doc[] = [];
  const salaryConfig = {
    baseSalary: 10_000_000,
    standardHours: 160,
    latePenaltyAmount: 50_000,
    commissionEnabled: false,
    commissionTiers: [],
    kpiBonusEnabled: false,
    kpiBonusTiers: [],
  };

  const userId = new Types.ObjectId().toString();
  const accountingId = new Types.ObjectId().toString();
  const directorId = new Types.ObjectId().toString();

  const model = new StaffPayrollModelMock(staffPayrollStore);
  const service = new StaffPayrollService(
    model as any,
    {
      model: (name: string) => {
        if (name === 'User') {
          return {
            findById: () => ({
              lean: async () => ({ _id: userId, fullName: 'Ops User', role: 'OPS' }),
            }),
          };
        }
        if (name === 'Order') {
          return {
            aggregate: async () => [{ _id: null, totalRevenue: 0 }],
          };
        }
        if (name === 'Session') {
          return {
            find: () => ({ lean: async () => [] }),
          };
        }
        throw new Error(`Unexpected model request: ${name}`);
      },
    } as any,
    {
      getSummary: async () => ({ totalHours: 120, lateDays: 2 }),
    } as any,
    {
      findByUserId: async () => salaryConfig,
      findAll: async () => ({ data: [] }),
    } as any,
    {
      recordBankTransaction: async () => null,
    } as any,
  );

  const payroll = await service.generate(
    {
      userId,
      periodStart: '2026-02-01',
      periodEnd: '2026-02-28',
      bonusAmount: 200_000,
      deductionAmount: 50_000,
    },
    accountingId,
  );

  // baseSalaryAmount = 10,000,000 * (120/160) = 7,500,000
  // net = 7,500,000 - late(2*50,000) + bonus 200,000 - deduction 50,000 = 7,550,000
  assert.equal(payroll.baseSalaryAmount, 7_500_000, 'Salary config + attendance ratio must drive base salary amount');
  assert.equal(payroll.netAmount, 7_550_000, 'Staff payroll net amount must follow configured salary formula');
  assert.equal(payroll.status, 'DRAFT', 'Generated payroll must start as DRAFT');

  await service.submitForReview(String(payroll._id));
  const approved = await service.approve(String(payroll._id), directorId);
  assert.equal(approved.status, 'APPROVED', 'Payroll must move to APPROVED after director approval');

  // Change salary config and regenerate for next period to validate impact.
  salaryConfig.baseSalary = 12_000_000;
  const payrollNext = await service.generate(
    {
      userId,
      periodStart: '2026-03-01',
      periodEnd: '2026-03-31',
    },
    accountingId,
  );
  assert.equal(payrollNext.baseSalaryAmount, 9_000_000, 'Salary config change must affect next payroll base amount');
  assert.equal(payrollNext.netAmount, 8_900_000, 'Salary config change must affect next payroll net amount');

  return { service, store: staffPayrollStore, payrollId: String(payroll._id), accountingId };
}

async function testPayrollImpactToFinancialControl(payload: {
  service: StaffPayrollService;
  store: Doc[];
  payrollId: string;
  accountingId: string;
}) {
  const { service: staffPayrollService, store: staffPayrollStore, payrollId, accountingId } = payload;

  const state = {
    bankAccounts: [
      {
        _id: 'ba-1',
        accountCode: 'BA-001',
        bankName: 'VCB',
        accountNumber: '123456789',
        currentBalance: 20_000_000,
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
        currentBalance: 3_000_000,
        minimumBalance: 0,
        targetBalance: 0,
        status: 'ACTIVE',
      },
    ],
    sessions: [
      {
        _id: 's-1',
        status: 'FINALIZED',
        amountCharged: 4_000_000,
        teacherPayout: 1_000_000,
        scheduledDate: new Date('2026-02-05T00:00:00.000Z'),
      },
    ],
    payrolls: [
      {
        _id: 'tp-1',
        payrollCode: 'PRL-202602-ABC123',
        status: 'APPROVED',
        netAmount: 1_000_000,
      },
    ] as Doc[],
    expenses: [] as Doc[],
    invoices: [] as Doc[],
    ledgers: [] as Doc[],
    wallets: [{ _id: 'w-1', status: 'ACTIVE', balance: 0 }],
    adCosts: [] as Doc[],
    orders: [] as Doc[],
    loans: [] as Doc[],
    loanPayments: [] as Doc[],
  };

  const empty = createModel(() => []);
  const payrollAggregate = new PayrollFinancialAggregateService(
    createModel(() => state.payrolls) as any,
    createModel(() => staffPayrollStore.map((d) => ({ ...d }))) as any,
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

  const dashboardBeforePay = await service.getFinancialDashboard();
  assert.equal(
    dashboardBeforePay.obligations.payrollPayable,
    8_550_000,
    'Dashboard payable payroll must include both teacher and staff APPROVED payrolls',
  );
  assert.equal(
    dashboardBeforePay.obligations.payrollPayableCount,
    2,
    'Dashboard payable payroll count must include teacher + staff payroll records',
  );

  const pnlBeforeAttendanceChange = await service.getProfitAndLoss('2026-02-01', '2026-02-28');
  assert.equal(
    pnlBeforeAttendanceChange.costs.teacherCost,
    1_000_000,
    'Teacher cost must reflect finalized sessions (attendance-driven)',
  );

  // Simulate attendance update: new PRESENT/LATE record created another finalized session.
  state.sessions.push({
    _id: 's-2',
    status: 'FINALIZED',
    amountCharged: 3_000_000,
    teacherPayout: 500_000,
    scheduledDate: new Date('2026-02-10T00:00:00.000Z'),
  });

  const pnlAfterAttendanceChange = await service.getProfitAndLoss('2026-02-01', '2026-02-28');
  assert.equal(
    pnlAfterAttendanceChange.costs.teacherCost,
    1_500_000,
    'Teacher cost must increase when attendance generates additional finalized sessions',
  );

  // Payroll payments completed.
  state.payrolls[0].status = 'PAID';
  state.payrolls[0].paidAt = new Date('2026-02-15T00:00:00.000Z');

  await staffPayrollService.markPaid(payrollId, accountingId, 'STAFF-PAY-REF');
  const paidStaff = staffPayrollStore.find((d) => String(d._id) === payrollId)!;
  paidStaff.paidAt = new Date('2026-02-16T00:00:00.000Z');

  const dashboardAfterPay = await service.getFinancialDashboard();
  assert.equal(dashboardAfterPay.obligations.payrollPayable, 0, 'Payroll payable must be zero after all payrolls are paid');

  const cashFlow = await service.getCashFlow({
    startDate: '2026-02-01',
    endDate: '2026-02-28',
    groupBy: 'day',
  } as any);
  const feb15 = cashFlow.timeline.find((t: any) => t.date === '2026-02-15');
  const feb16 = cashFlow.timeline.find((t: any) => t.date === '2026-02-16');
  assert.equal(feb15?.outflow?.payroll || 0, 1_000_000, 'Cash flow payroll outflow must include teacher payroll payment');
  assert.equal(feb16?.outflow?.payroll || 0, 7_550_000, 'Cash flow payroll outflow must include staff payroll payment');
  assert.equal(cashFlow.totalOutflow, 8_550_000, 'Cash flow total outflow must include all payroll payments');

  const pnlAfterPay = await service.getProfitAndLoss('2026-02-01', '2026-02-28');
  assert.equal(
    pnlAfterPay.costs.payrollCost,
    8_550_000,
    'P&L payrollCost must include both paid teacher and staff payroll',
  );
}

async function main() {
  const setup = await testSalaryConfigAttendanceToPayroll();
  await testPayrollImpactToFinancialControl(setup);
  console.log('PASS: payroll and salary-config financial-control regression checks');
}

main().catch((err) => {
  console.error('FAIL: payroll and salary-config financial-control regression checks');
  console.error(err);
  process.exit(1);
});
