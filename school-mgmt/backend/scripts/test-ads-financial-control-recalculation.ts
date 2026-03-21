import 'reflect-metadata';
import { strict as assert } from 'node:assert';
import { BadRequestException } from '@nestjs/common';
import { AdsService } from '../src/ads/ads.service';
import { AdCostSource } from '../src/ads/schemas/ad-cost.schema';
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

const sameValue = (left: any, right: any): boolean => {
  const leftDate = asDate(left);
  const rightDate = asDate(right);
  if (leftDate && rightDate) return leftDate.getTime() === rightDate.getTime();
  return String(left) === String(right);
};

const isOperatorObject = (value: any): boolean => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.keys(value).some((key) => key.startsWith('$'));
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
  if (expr && expr.$dateToString) {
    const format = expr.$dateToString.format || '%Y-%m-%d';
    const dateExpr = expr.$dateToString.date;
    return formatDate(evalExpr(dateExpr, doc), format);
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
  if (condition instanceof Date) return sameValue(value, condition);
  if (!condition || typeof condition !== 'object' || Array.isArray(condition)) {
    return sameValue(value, condition);
  }
  if (!isOperatorObject(condition)) {
    return sameValue(value, condition);
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
    if (!Array.isArray(condition.$in) || !condition.$in.some((v: any) => sameValue(v, value))) return false;
  }
  if (condition.$nin !== undefined) {
    if (Array.isArray(condition.$nin) && condition.$nin.some((v: any) => sameValue(v, value))) return false;
  }
  if (condition.$ne !== undefined) {
    if (sameValue(value, condition.$ne)) return false;
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
        const left = getByPath(a, field);
        const right = getByPath(b, field);
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

  select(): this {
    return this;
  }

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

  select(): this {
    return this;
  }

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

class AdGroupModelMock extends AggregateModelMock {
  constructor(private readonly store: Doc[]) {
    super(() => store);
  }

  findById(id: string): QueryOneMock {
    return new QueryOneMock(() => this.store.find((d) => sameValue(d._id, id)) || null);
  }
}

class AdCostModelMock extends AggregateModelMock {
  private beforeFindOneAndUpdateHooks: Array<(filter: Doc, update: Doc, options: Doc) => void> = [];
  private idCounter = 1;

  constructor(private readonly store: Doc[]) {
    super(() => store);
  }

  queueBeforeFindOneAndUpdate(hook: (filter: Doc, update: Doc, options: Doc) => void): void {
    this.beforeFindOneAndUpdateHooks.push(hook);
  }

  private sameUniqueKey(left: Doc, right: Doc): boolean {
    return sameValue(left.adGroupId, right.adGroupId) && sameValue(left.date, right.date);
  }

  findOneAndUpdate(filter: Doc, update: Doc, options: Doc = {}): QueryOneMock {
    return new QueryOneMock(() => {
      const hook = this.beforeFindOneAndUpdateHooks.shift();
      if (hook) hook(filter, update, options);

      const idx = this.store.findIndex((d) => this.sameUniqueKey(d, filter));
      if (idx >= 0) {
        const current = this.store[idx];
        const previous = { ...current };
        applyUpdate(current, update || {});
        current.updatedAt = new Date();
        this.store[idx] = current;
        return options.new ? current : previous;
      }

      if (!options.upsert) return null;

      const duplicate = this.store.find((d) => this.sameUniqueKey(d, filter));
      if (duplicate) {
        const err: any = new Error('E11000 duplicate key error');
        err.code = 11000;
        throw err;
      }

      const created: Doc = {
        _id: `adc-${String(this.idCounter++).padStart(4, '0')}`,
        ...filter,
      };
      applyUpdate(created, update || {});
      created.createdAt = new Date();
      created.updatedAt = new Date();
      this.store.push(created);
      return created;
    });
  }
}

const createModel = (dataRef: () => Doc[]) => new AggregateModelMock(dataRef);

async function main() {
  const state = {
    bankAccounts: [{ _id: 'ba-1', accountCode: 'BA-001', bankName: 'VCB', accountNumber: '123', currentBalance: 0, status: 'ACTIVE' }],
    funds: [{ _id: 'fund-1', fundCode: 'FUND-001', name: 'Reserve', fundType: 'RESERVE', currentBalance: 0, minimumBalance: 0, targetBalance: 0, status: 'ACTIVE' }],
    sessions: [] as Doc[],
    expenses: [] as Doc[],
    invoices: [] as Doc[],
    ledgers: [] as Doc[],
    wallets: [{ _id: 'w-1', status: 'ACTIVE', balance: 0 }],
    adGroups: [
      {
        _id: 'group-1',
        name: 'Facebook Group 1',
        adAccountId: 'acc-1',
        platform: 'FACEBOOK',
        status: 'ACTIVE',
      },
    ] as Doc[],
    adCosts: [
      {
        _id: 'adc-1',
        adGroupId: 'group-1',
        adGroupName: 'Facebook Group 1',
        adAccountId: 'acc-1',
        platform: 'FACEBOOK',
        date: new Date('2026-02-10T00:00:00.000Z'),
        spend: 1_000_000,
        impressions: 0,
        clicks: 0,
        conversions: 0,
        source: AdCostSource.MANUAL,
        syncedAt: new Date('2026-02-10T01:00:00.000Z'),
      },
    ] as Doc[],
    orders: [] as Doc[],
    leads: [] as Doc[],
    students: [] as Doc[],
    conversations: [] as Doc[],
    parentAttributions: [] as Doc[],
    payrolls: [] as Doc[],
    staffPayrolls: [] as Doc[],
    loans: [] as Doc[],
    loanPayments: [] as Doc[],
  };

  state.adGroups.push({
    _id: 'group-2',
    name: 'Google Group 2',
    adAccountId: 'acc-2',
    platform: 'GOOGLE',
    status: 'ACTIVE',
  });
  state.leads.push({
    _id: 'lead-1',
    adGroupId: 'group-2',
    createdAt: new Date('2026-02-11T10:00:00.000Z'),
  });
  state.orders.push({
    _id: 'order-1',
    adGroupId: 'group-2',
    finalAmount: 2_500_000,
    status: 'APPROVED',
    createdAt: new Date('2026-02-11T11:00:00.000Z'),
  });

  state.adCosts.push({
    _id: 'adc-jan-1',
    adGroupId: 'group-1',
    adGroupName: 'Facebook Group 1',
    adAccountId: 'acc-1',
    platform: 'FACEBOOK',
    date: new Date('2026-01-01T00:00:00.000Z'),
    spend: 200_000,
    impressions: 5_000,
    clicks: 120,
    conversions: 8,
    source: AdCostSource.MANUAL,
    syncedAt: new Date('2026-01-01T01:00:00.000Z'),
  });

  state.parentAttributions.push(
    {
      _id: 'attr-1',
      parentKey: 'parent-1',
      parentUserId: '507f1f77bcf86cd799439011',
      parentPhone: '0901000001',
      normalizedParentPhone: '0901000001',
      adGroupId: 'group-1',
      adGroupName: 'Facebook Group 1',
      platform: 'FACEBOOK',
      firstAttributedAt: new Date('2026-01-01T00:00:00.000Z'),
    },
    {
      _id: 'attr-2',
      parentKey: 'parent-2',
      parentUserId: '507f1f77bcf86cd799439021',
      parentPhone: '0901000002',
      normalizedParentPhone: '0901000002',
      adGroupId: 'group-1',
      adGroupName: 'Facebook Group 1',
      platform: 'FACEBOOK',
      firstAttributedAt: new Date('2026-02-10T00:00:00.000Z'),
    },
  );

  state.students.push(
    {
      _id: '507f1f77bcf86cd799439012',
      parentUserId: '507f1f77bcf86cd799439011',
      parentPhone: '0901000001',
      parentName: 'Parent One',
      adGroupId: 'group-1',
      adGroupName: 'Facebook Group 1',
    },
    {
      _id: '507f1f77bcf86cd799439022',
      parentUserId: '507f1f77bcf86cd799439021',
      parentPhone: '0901000002',
      parentName: 'Parent Two',
      adGroupId: 'group-1',
      adGroupName: 'Facebook Group 1',
    },
  );

  state.invoices.push(
    {
      _id: '507f1f77bcf86cd799439013',
      invoiceType: 'TUITION',
      status: 'APPROVED',
      studentId: '507f1f77bcf86cd799439012',
      sessions: 1,
      sessionsRemaining: 0,
      pricePerSession: 4_000_000,
      amount: 4_000_000,
      paymentDate: new Date('2026-01-02T00:00:00.000Z'),
    },
    {
      _id: '507f1f77bcf86cd799439023',
      invoiceType: 'TUITION',
      status: 'APPROVED',
      studentId: '507f1f77bcf86cd799439022',
      sessions: 1,
      sessionsRemaining: 1,
      pricePerSession: 3_000_000,
      amount: 3_000_000,
      paymentDate: new Date('2026-02-15T00:00:00.000Z'),
    },
  );

  state.sessions.push({
    _id: '507f1f77bcf86cd799439014',
    studentId: '507f1f77bcf86cd799439012',
    parentUserId: '507f1f77bcf86cd799439011',
    adGroupId: 'group-1',
    adGroupName: 'Facebook Group 1',
    status: 'FINALIZED',
    scheduledDate: new Date('2026-01-20T00:00:00.000Z'),
    amountCharged: 4_000_000,
    teacherPayout: 1_000_000,
  });

  state.sessions.push({
    _id: '507f1f77bcf86cd799439024',
    studentId: '507f1f77bcf86cd799439022',
    parentUserId: '507f1f77bcf86cd799439021',
    adGroupId: 'group-1',
    adGroupName: 'Facebook Group 1',
    status: 'SCHEDULED',
    scheduledDate: new Date('2099-01-15T00:00:00.000Z'),
    amountCharged: 3_000_000,
    teacherPayout: 900_000,
  });

  state.ledgers.push({
    _id: 'led-1',
    userId: '507f1f77bcf86cd799439011',
    studentId: '507f1f77bcf86cd799439012',
    sessionId: '507f1f77bcf86cd799439014',
    type: 'SESSION_DEDUCT',
    status: 'COMPLETED',
    amount: 4_000_000,
    createdAt: new Date('2026-01-20T00:00:00.000Z'),
  });

  const empty = createModel(() => []);
  const adCostModel = new AdCostModelMock(state.adCosts);
  const adGroupModel = new AdGroupModelMock(state.adGroups);

  const payrollAggregate = new PayrollFinancialAggregateService(
    createModel(() => state.payrolls) as any,
    createModel(() => state.staffPayrolls) as any,
  );
  const expenseAggregate = new ExpenseFinancialAggregateService(createModel(() => state.expenses) as any);
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

  const financialControlService = new FinancialControlService(
    createModel(() => state.bankAccounts) as any,
    empty as any,
    createModel(() => state.funds) as any,
    empty as any,
    createModel(() => state.sessions) as any,
    createModel(() => state.expenses) as any,
    createModel(() => state.invoices) as any,
    createModel(() => state.ledgers) as any,
    createModel(() => state.wallets) as any,
    adCostModel as any,
    createModel(() => state.adGroups) as any,
    createModel(() => state.orders) as any,
    createModel(() => state.leads) as any,
    createModel(() => state.students) as any,
    empty as any,
    {} as any,
    payrollAggregate as any,
    expenseAggregate as any,
    loanAggregate as any,
    bankFundService as any,
    undefined,
  );

  const adsService = new AdsService(
    empty as any,
    adGroupModel as any,
    empty as any,
    adCostModel as any,
    createModel(() => state.orders) as any,
    createModel(() => state.invoices) as any,
    createModel(() => state.leads) as any,
    createModel(() => state.sessions) as any,
    createModel(() => state.ledgers) as any,
    createModel(() => state.expenses) as any,
    createModel(() => state.students) as any,
    empty as any,
    createModel(() => state.conversations) as any,
    createModel(() => state.parentAttributions) as any,
    { get: (_key: string, fallback?: string) => fallback } as any,
    { upsertParentAttribution: async () => null } as any,
  );

  const pnlBefore = await financialControlService.getProfitAndLoss('2026-02-01', '2026-02-28');
  assert.equal(
    pnlBefore.costs.adCost,
    1_000_000,
    'Financial Control must read initial ad cost correctly',
  );

  const cashFlowBefore = await financialControlService.getCashFlow({
    startDate: '2026-02-01',
    endDate: '2026-02-28',
    groupBy: 'day',
  } as any);
  const feb10Before = cashFlowBefore.timeline.find((t: any) => t.date === '2026-02-10');
  assert.ok(feb10Before, 'Cash-flow timeline must contain ad cost date');
  assert.equal(
    feb10Before.outflow.adCost,
    1_000_000,
    'Cash-flow must include initial ad cost amount',
  );
  assert.equal(
    cashFlowBefore.totalOutflow,
    1_000_000,
    'Total outflow must match initial ad cost',
  );

  await adsService.createOrUpdateCost({
    adGroupId: 'group-1',
    adAccountId: 'acc-1',
    platform: 'FACEBOOK',
    date: '2026-02-10',
    spend: 1_350_000,
    source: AdCostSource.MANUAL,
  } as any);

  const feb10CostsAfterUpdate = state.adCosts.filter((row) =>
    sameValue(row.adGroupId, 'group-1') && sameValue(row.date, new Date('2026-02-10T00:00:00.000Z')));
  assert.equal(feb10CostsAfterUpdate.length, 1, 'Update same group+day must not create duplicate rows');

  const pnlAfterUpdate = await financialControlService.getProfitAndLoss('2026-02-01', '2026-02-28');
  assert.equal(
    pnlAfterUpdate.costs.adCost,
    1_350_000,
    'Updating ad cost must recalculate Financial Control P&L immediately',
  );

  const cashFlowAfterUpdate = await financialControlService.getCashFlow({
    startDate: '2026-02-01',
    endDate: '2026-02-28',
    groupBy: 'day',
  } as any);
  const feb10AfterUpdate = cashFlowAfterUpdate.timeline.find((t: any) => t.date === '2026-02-10');
  assert.ok(feb10AfterUpdate, 'Cash-flow timeline must keep ad cost day after update');
  assert.equal(
    feb10AfterUpdate.outflow.adCost,
    1_350_000,
    'Cash-flow ad cost must reflect updated amount',
  );

  adCostModel.queueBeforeFindOneAndUpdate((_filter, _update, options) => {
    if (!options?.upsert) return;
    const err: any = new Error('E11000 duplicate key error collection: ad_costs');
    err.code = 11000;
    throw err;
  });

  await adsService.createOrUpdateCost({
    adGroupId: 'group-1',
    adAccountId: 'acc-1',
    platform: 'FACEBOOK',
    date: '2026-02-10',
    spend: 1_800_000,
    source: AdCostSource.SYNCED,
  } as any);

  assert.equal(
    state.adCosts.filter((row) =>
      sameValue(row.adGroupId, 'group-1') && sameValue(row.date, new Date('2026-02-10T00:00:00.000Z'))).length,
    1,
    'Race duplicate-key handling must keep one canonical ad cost row',
  );
  const feb10Canonical = state.adCosts.find((row) =>
    sameValue(row.adGroupId, 'group-1') && sameValue(row.date, new Date('2026-02-10T00:00:00.000Z')));
  assert.equal(
    feb10Canonical?.spend,
    1_800_000,
    'Race duplicate-key handling must still persist latest spend value',
  );

  const pnlAfterRace = await financialControlService.getProfitAndLoss('2026-02-01', '2026-02-28');
  assert.equal(
    pnlAfterRace.costs.adCost,
    1_800_000,
    'Financial Control must recalculate correctly after race-safe update',
  );

  await assert.rejects(
    () => adsService.createOrUpdateCost({
      adGroupId: 'group-1',
      adAccountId: 'acc-2',
      platform: 'FACEBOOK',
      date: '2026-02-10',
      spend: 500_000,
    } as any),
    (err: any) => err instanceof BadRequestException,
    'Mismatched adAccountId must be rejected to prevent inconsistent financial data',
  );

  await assert.rejects(
    () => adsService.createOrUpdateCost({
      adGroupId: 'group-1',
      adAccountId: 'acc-1',
      platform: 'GOOGLE',
      date: '2026-02-10',
      spend: 500_000,
    } as any),
    (err: any) => err instanceof BadRequestException,
    'Mismatched platform must be rejected to prevent inconsistent financial data',
  );

  const analytics = await adsService.getAnalytics('2026-02-01', '2026-02-28');
  const rowGroup2 = analytics.rows.find((row: any) => row.adGroupId === 'group-2');
  assert.ok(
    rowGroup2,
    'Ads analytics must include ad groups that have leads/orders even when ad cost is missing',
  );
  assert.equal(
    rowGroup2.totalSpend,
    0,
    'Ads analytics row without ad cost must default spend to zero',
  );
  assert.equal(
    rowGroup2.leadCount,
    1,
    'Ads analytics must count leads for groups without ad cost records',
  );
  assert.equal(
    rowGroup2.orderCount,
    1,
    'Ads analytics must count orders for groups without ad cost records',
  );

  const parentProfitability = await adsService.getParentProfitability('2026-01-01', '2026-02-28');
  const parentOneRow = parentProfitability.rows.find((row: any) => row.parentKey === 'parent-1');
  assert.ok(
    parentOneRow,
    'Parent-profit analytics must surface the attributed parent row',
  );
  assert.equal(
    parentOneRow.revenue,
    4_000_000,
    'Parent-profit analytics must attribute realized session revenue back to the parent row',
  );
  assert.equal(
    parentOneRow.teacherCost,
    1_000_000,
    'Parent-profit analytics must include teacher cost for the parent row',
  );
  assert.equal(
    parentOneRow.allocatedAdSpend,
    2_000_000,
    'Parent-profit analytics must allocate ad spend back to the revenue-driving parent',
  );
  assert.equal(
    parentOneRow.netProfit,
    1_000_000,
    'Parent-profit analytics must compute parent-level net profit after allocated ad spend',
  );

  const groupOneSummary = parentProfitability.summaryByGroup.find((row: any) => row.adGroupId === 'group-1');
  assert.ok(
    groupOneSummary,
    'Parent-profit analytics must return group summary rows',
  );
  assert.equal(
    groupOneSummary.parentCount,
    2,
    'Parent-profit group summary must count all attributed parents in the group',
  );
  assert.equal(
    groupOneSummary.totalAdSpend,
    2_000_000,
    'Parent-profit group summary must preserve full ad spend allocation at group level',
  );
  assert.equal(
    parentProfitability.overall.totalNetProfit,
    1_000_000,
    'Parent-profit overall summary must roll up parent-level profit correctly',
  );

  const projectedCohort = await adsService.getRealizedCohortAnalytics(
    '2026-01-01',
    '2026-02-28',
    undefined,
    undefined,
    45,
  );
  const febProjectedRow = projectedCohort.rows.find((row: any) => row.date === '2026-02-10');
  assert.ok(
    febProjectedRow,
    'Cohort analytics must include the active acquisition cohort',
  );
  assert.equal(
    febProjectedRow.collectedRevenue,
    3_000_000,
    'Projected cohort analytics must surface approved tuition cash already collected',
  );
  assert.equal(
    febProjectedRow.remainingSessionUnits,
    1,
    'Projected cohort analytics must surface remaining session units from approved invoices',
  );
  assert.equal(
    febProjectedRow.isMatured,
    false,
    'Active cohort should remain immature so projected profit is used before full realization',
  );
  assert.equal(
    febProjectedRow.projectedRevenue,
    3_000_000,
    'Projected revenue should use collected tuition cash when there is no refund yet',
  );
  assert.equal(
    febProjectedRow.projectedNetProfit,
    300_000,
    'Projected net profit should subtract teacher cost from the actual scheduled remaining session and keep actual ad spend',
  );
  assert.equal(
    projectedCohort.summary.totalProjectedNetProfit,
    3_100_000,
    'Projected cohort summary must aggregate actual mature profit with session-based remaining service costs',
  );

  const projectedCohortWithRefundX = await adsService.getRealizedCohortAnalytics(
    '2026-01-01',
    '2026-02-28',
    undefined,
    undefined,
    45,
    10,
  );
  const febProjectedRowWithRefundX = projectedCohortWithRefundX.rows.find((row: any) => row.date === '2026-02-10');
  assert.ok(
    febProjectedRowWithRefundX,
    'Cohort analytics with refund X must keep the active acquisition cohort',
  );
  assert.equal(
    projectedCohortWithRefundX.refundRatePercentX,
    10,
    'Cohort analytics must surface the configured refund X override',
  );
  assert.equal(
    febProjectedRowWithRefundX.projectedRevenue,
    2_700_000,
    'Refund X must reduce projected revenue for the remaining undelivered service',
  );
  assert.equal(
    febProjectedRowWithRefundX.projectedNetProfit,
    0,
    'Refund X must reduce projected net profit while preserving the session-based teacher cost profile',
  );
  assert.equal(
    projectedCohortWithRefundX.summary.totalProjectedNetProfit,
    2_800_000,
    'Projected cohort summary must respect the configured refund X override',
  );

  const suggestionsWithRefundX = await adsService.getSuggestions(
    '2026-01-01',
    '2026-02-28',
    1_000_000,
    45,
    10,
  );
  const febSuggestionRow = suggestionsWithRefundX.summaryTable.find((row: any) => row.date === '2026-02-10');
  assert.ok(
    febSuggestionRow,
    'Suggestion summary must include the active acquisition cohort when refund X is used',
  );
  assert.equal(
    suggestionsWithRefundX.refundRatePercentX,
    10,
    'Suggestions API must surface the configured refund X override',
  );
  assert.equal(
    febSuggestionRow.effectiveNetProfit,
    0,
    'Suggestions must fit on the projected net profit after applying refund X to the remaining cohort',
  );

  let capturedGoogleQuery = '';
  let capturedGoogleHeaders: any = {};
  (adsService as any).fetchWithRetry = async (_url: string, options?: any) => {
    if (options?.body) {
      capturedGoogleQuery = JSON.parse(options.body).query || '';
    }
    capturedGoogleHeaders = options?.headers || {};
    return [{ results: [] }];
  };
  await (adsService as any).syncGoogleCosts(
    'token',
    { _id: 'acc-google', platformAccountId: '123456' } as any,
    [{ _id: 'group-2', platformCampaignId: 'cmp-2' }] as any,
    new Date('2026-02-11T00:00:00.000Z'),
    '999888777',
  );
  assert.ok(
    capturedGoogleQuery.includes("segments.date = '2026-02-11'"),
    'Google sync query date must use YYYY-MM-DD format',
  );
  assert.ok(
    !capturedGoogleQuery.includes("segments.date = '20260211'"),
    'Google sync query must not use YYYYMMDD date format',
  );
  assert.equal(
    capturedGoogleHeaders['login-customer-id'],
    '999888777',
    'Google MCC sync must pass login-customer-id when syncing child accounts through a manager token',
  );

  let googleManagerRunCalled = false;
  (adsService as any).getTokenByIdForUse = async () => ({
    _id: 'tok-google-mcc',
    platform: 'GOOGLE',
    tokenType: 'GOOGLE_MCC',
    accessToken: 'enc-google',
    save: async () => null,
  });
  (adsService as any).decrypt = (_value: string) => 'google-access-token';
  (adsService as any).runGoogleMccTokenSync = async (_tokenDoc: any, accessToken: string, syncDates: Date[]) => {
    googleManagerRunCalled = accessToken === 'google-access-token' && syncDates.length === 1;
    return {
      synced: 2,
      adAccountsSynced: 1,
      adGroupsSynced: 1,
      fanpagesSynced: 0,
      errors: [],
    };
  };
  const googleManagerSyncResult = await adsService.syncGoogleMccToken('tok-google-mcc', '2026-02-11');
  assert.ok(
    googleManagerRunCalled,
    'Google MCC token sync must dispatch to the manager-level sync pipeline',
  );
  assert.equal(
    googleManagerSyncResult.adAccountsSynced,
    1,
    'Google MCC token sync must return manager-level account discovery counts',
  );

  let tiktokBusinessCenterRunCalled = false;
  (adsService as any).getTokenByIdForUse = async () => ({
    _id: 'tok-tiktok-bc',
    platform: 'TIKTOK',
    tokenType: 'TIKTOK_BUSINESS_CENTER',
    accessToken: 'enc-tiktok',
    save: async () => null,
  });
  (adsService as any).decrypt = (_value: string) => 'tiktok-access-token';
  (adsService as any).runTikTokBusinessCenterTokenSync = async (_tokenDoc: any, accessToken: string, syncDates: Date[]) => {
    tiktokBusinessCenterRunCalled = accessToken === 'tiktok-access-token' && syncDates.length === 1;
    return {
      synced: 3,
      adAccountsSynced: 2,
      adGroupsSynced: 2,
      fanpagesSynced: 0,
      errors: [],
    };
  };
  const tiktokBusinessCenterSyncResult = await adsService.syncTikTokBusinessCenterToken('tok-tiktok-bc', '2026-02-11');
  assert.ok(
    tiktokBusinessCenterRunCalled,
    'TikTok Business Center token sync must dispatch to the manager-level sync pipeline',
  );
  assert.equal(
    tiktokBusinessCenterSyncResult.adGroupsSynced,
    2,
    'TikTok Business Center token sync must return manager-level campaign discovery counts',
  );

  console.log('PASS: update ads cost -> financial control recalculation checks');
}

main().catch((err) => {
  console.error('FAIL: update ads cost -> financial control recalculation checks');
  console.error(err);
  process.exit(1);
});
