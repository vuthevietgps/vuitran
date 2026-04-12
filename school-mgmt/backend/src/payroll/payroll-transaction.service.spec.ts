/**
 * Unit Tests: PayrollTransactionService
 *
 * Strategy: mock the PayrollTransaction Mongoose model with jest.fn(),
 * test all business logic branches without a live DB.
 */
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import {
  PayrollTransactionService,
  CreatePayrollTransactionDto,
  PenaltyConfig,
} from './payroll-transaction.service';
import {
  PayrollTransactionStatus,
  HoldReason,
} from './schemas/payroll-transaction.schema';

// ─── Shared fixtures ──────────────────────────────────────────────────────────

const teacherId = new Types.ObjectId().toString();
const sessionId = new Types.ObjectId().toString();
const classId = new Types.ObjectId().toString();
const studentId = new Types.ObjectId().toString();

const BASE_SALARY = 100_000;

const baseDto: CreatePayrollTransactionDto = {
  teacherId,
  sessionId,
  classId,
  studentId,
  sessionDate: new Date('2026-03-01'),
  baseSalary: BASE_SALARY,
};

const PENALTY_CONFIG: PenaltyConfig = {
  penaltyPerHour: 10_000,
  maxPenaltyPercent: 30,
  graceHours: 0,
};

// ─── Make a mocked PayrollTransaction document ────────────────────────────────

function makeTxDoc(overrides: Partial<any> = {}): any {
  const doc: any = {
    _id: new Types.ObjectId(),
    sessionId: new Types.ObjectId(sessionId),
    baseSalary: BASE_SALARY,
    penaltyAmount: 0,
    bonusAmount: 0,
    adjustmentAmount: 0,
    finalSalary: BASE_SALARY,
    lateHours: 0,
    isLateReport: false,
    status: PayrollTransactionStatus.PENDING,
    save: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  return doc;
}

// ─── Build service ─────────────────────────────────────────────────────────────

function buildService(txModelOverride?: Partial<any>) {
  // Constructor model mock — new this.txModel(...) must work
  const MockModel: any = function(this: any, data: any) {
    Object.assign(this, data);
    this.save = jest.fn().mockResolvedValue(this);
  };
  Object.assign(MockModel, txModelOverride ?? {});
  MockModel.findOne = txModelOverride?.findOne ?? jest.fn().mockResolvedValue(null);
  MockModel.findOneAndUpdate =
    txModelOverride?.findOneAndUpdate ?? jest.fn().mockImplementation(async (_filter: any, update: any) => {
      return makeTxDoc({
        teacherId: update?.$setOnInsert?.teacherId,
        sessionId: update?.$setOnInsert?.sessionId,
        classId: update?.$setOnInsert?.classId,
        studentId: update?.$setOnInsert?.studentId,
        sessionDate: update?.$setOnInsert?.sessionDate,
        baseSalary: update?.$setOnInsert?.baseSalary,
        penaltyAmount: update?.$setOnInsert?.penaltyAmount ?? 0,
        bonusAmount: update?.$setOnInsert?.bonusAmount ?? 0,
        adjustmentAmount: update?.$setOnInsert?.adjustmentAmount ?? 0,
        finalSalary: update?.$setOnInsert?.finalSalary ?? update?.$setOnInsert?.baseSalary ?? BASE_SALARY,
        status: update?.$setOnInsert?.status ?? PayrollTransactionStatus.PENDING,
        isLateReport: update?.$setOnInsert?.isLateReport ?? false,
        lateHours: update?.$setOnInsert?.lateHours ?? 0,
        reportDeadline: update?.$setOnInsert?.reportDeadline,
        reportSubmittedAt: update?.$setOnInsert?.reportSubmittedAt,
        createdBy: update?.$setOnInsert?.createdBy,
      });
    });

  return new PayrollTransactionService(MockModel as any, {} as any);
}

// ══════════════════════════════════════════════════════════════════════════════
//  createFromSession
// ══════════════════════════════════════════════════════════════════════════════

describe('PayrollTransactionService.createFromSession()', () => {
  it('creates a transaction with no penalty when report is on time', async () => {
    const service = buildService();
    const dto: CreatePayrollTransactionDto = { ...baseDto, isLateReport: false, lateHours: 0 };

    const result = await service.createFromSession(dto, PENALTY_CONFIG);

    expect(result.penaltyAmount).toBe(0);
    expect(result.finalSalary).toBe(BASE_SALARY);
    expect(result.status).toBe(PayrollTransactionStatus.PENDING);
  });

  it('applies penalty proportional to lateHours', async () => {
    const service = buildService();
    const dto: CreatePayrollTransactionDto = {
      ...baseDto,
      isLateReport: true,
      lateHours: 3, // 3h × 10k = 30k penalty
    };

    const result = await service.createFromSession(dto, PENALTY_CONFIG);

    expect(result.penaltyAmount).toBe(30_000);
    expect(result.finalSalary).toBe(BASE_SALARY - 30_000);
    expect(result.isLateReport).toBe(true);
  });

  it('caps penalty at maxPenaltyPercent of baseSalary', async () => {
    const service = buildService();
    const dto: CreatePayrollTransactionDto = {
      ...baseDto,
      isLateReport: true,
      lateHours: 99, // 99 × 10k = 990k, but cap = 30% of 100k = 30k
    };

    const result = await service.createFromSession(dto, PENALTY_CONFIG);

    const maxAllowed = Math.round(BASE_SALARY * PENALTY_CONFIG.maxPenaltyPercent / 100);
    expect(result.penaltyAmount).toBe(maxAllowed);
    expect(result.finalSalary).toBe(Math.max(0, BASE_SALARY - maxAllowed));
  });

  it('finalSalary never goes below 0 when penalty exceeds baseSalary', async () => {
    const service = buildService();
    const dto: CreatePayrollTransactionDto = {
      ...baseDto,
      baseSalary: 10_000, // very small salary
      isLateReport: true,
      lateHours: 5,
    };

    const result = await service.createFromSession(dto, PENALTY_CONFIG);

    expect(result.finalSalary).toBeGreaterThanOrEqual(0);
  });

  it('is idempotent: returns existing record without creating another', async () => {
    const existing = makeTxDoc();
    const txModel = {
      findOneAndUpdate: jest.fn().mockResolvedValue(existing),
    };
    const service = buildService(txModel);

    const result = await service.createFromSession(baseDto, PENALTY_CONFIG);

    expect(txModel.findOneAndUpdate).toHaveBeenCalledTimes(1);
    expect(result).toBe(existing);
  });

  it('does not apply penalty when lateHours <= graceHours', async () => {
    const service = buildService();
    const configWithGrace: PenaltyConfig = { ...PENALTY_CONFIG, graceHours: 2 };
    const dto: CreatePayrollTransactionDto = {
      ...baseDto,
      isLateReport: true,
      lateHours: 2, // exactly at grace period boundary
    };

    const result = await service.createFromSession(dto, configWithGrace);

    expect(result.penaltyAmount).toBe(0);
    expect(result.finalSalary).toBe(BASE_SALARY);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
//  applyPenalty
// ══════════════════════════════════════════════════════════════════════════════

describe('PayrollTransactionService.applyPenalty()', () => {
  it('throws NotFoundException when session not found', async () => {
    const txModel = { findOne: jest.fn().mockResolvedValue(null) };
    const service = buildService(txModel);

    await expect(service.applyPenalty(sessionId, 3, PENALTY_CONFIG)).rejects.toThrow(NotFoundException);
  });

  it('throws BadRequestException when status is not PENDING', async () => {
    const tx = makeTxDoc({ status: PayrollTransactionStatus.APPROVED });
    const txModel = { findOne: jest.fn().mockResolvedValue(tx) };
    const service = buildService(txModel);

    await expect(service.applyPenalty(sessionId, 3, PENALTY_CONFIG)).rejects.toThrow(BadRequestException);
  });

  it('updates penaltyAmount, lateHours and recalculates finalSalary', async () => {
    const tx = makeTxDoc({ status: PayrollTransactionStatus.PENDING, baseSalary: 100_000 });
    const txModel = { findOne: jest.fn().mockResolvedValue(tx) };
    const service = buildService(txModel);

    // 2h × 10k = 20k penalty, cap = 30% of 100k = 30k → not capped
    const result = await service.applyPenalty(sessionId, 2, PENALTY_CONFIG);

    expect(result.penaltyAmount).toBe(20_000); // 2h × 10k
    expect(result.lateHours).toBe(2);
    expect(result.isLateReport).toBe(true);
    expect(result.finalSalary).toBe(80_000);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
//  holdSalary
// ══════════════════════════════════════════════════════════════════════════════

describe('PayrollTransactionService.holdSalary()', () => {
  const holderId = new Types.ObjectId().toString();

  it('throws NotFoundException when session not found', async () => {
    const txModel = { findOne: jest.fn().mockResolvedValue(null) };
    const service = buildService(txModel);

    await expect(
      service.holdSalary(sessionId, HoldReason.QUALITY_ISSUE, 'bad quality', holderId),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws BadRequestException when status is not PENDING', async () => {
    const tx = makeTxDoc({ status: PayrollTransactionStatus.APPROVED });
    const txModel = { findOne: jest.fn().mockResolvedValue(tx) };
    const service = buildService(txModel);

    await expect(
      service.holdSalary(sessionId, HoldReason.ADMIN_HOLD, 'admin reason', holderId),
    ).rejects.toThrow(BadRequestException);
  });

  it('transitions PENDING → HELD with reason and sets heldAt', async () => {
    const tx = makeTxDoc({ status: PayrollTransactionStatus.PENDING });
    const txModel = { findOne: jest.fn().mockResolvedValue(tx) };
    const service = buildService(txModel);

    const result = await service.holdSalary(
      sessionId,
      HoldReason.PARENT_REJECTED,
      'Parent rejected session',
      holderId,
    );

    expect(result.status).toBe(PayrollTransactionStatus.HELD);
    expect(result.holdReason).toBe(HoldReason.PARENT_REJECTED);
    expect(result.holdDescription).toBe('Parent rejected session');
    expect(result.heldAt).toBeInstanceOf(Date);
    expect(tx.save).toHaveBeenCalled();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
//  releaseHold
// ══════════════════════════════════════════════════════════════════════════════

describe('PayrollTransactionService.releaseHold()', () => {
  const managerId = new Types.ObjectId().toString();

  it('throws NotFoundException when session not found', async () => {
    const txModel = { findOne: jest.fn().mockResolvedValue(null) };
    const service = buildService(txModel);

    await expect(service.releaseHold(sessionId, 'APPROVE', managerId)).rejects.toThrow(NotFoundException);
  });

  it('throws BadRequestException when status is not HELD', async () => {
    const tx = makeTxDoc({ status: PayrollTransactionStatus.PENDING });
    const txModel = { findOne: jest.fn().mockResolvedValue(tx) };
    const service = buildService(txModel);

    await expect(service.releaseHold(sessionId, 'APPROVE', managerId)).rejects.toThrow(BadRequestException);
  });

  it('APPROVE: transitions HELD → APPROVED and sets approvedAt', async () => {
    const tx = makeTxDoc({ status: PayrollTransactionStatus.HELD });
    const txModel = { findOne: jest.fn().mockResolvedValue(tx) };
    const service = buildService(txModel);

    const result = await service.releaseHold(sessionId, 'APPROVE', managerId);

    expect(result.status).toBe(PayrollTransactionStatus.APPROVED);
    expect(result.approvedAt).toBeInstanceOf(Date);
    expect(tx.save).toHaveBeenCalled();
  });

  it('EXCLUDE: transitions HELD → EXCLUDED with reason', async () => {
    const tx = makeTxDoc({ status: PayrollTransactionStatus.HELD });
    const txModel = { findOne: jest.fn().mockResolvedValue(tx) };
    const service = buildService(txModel);

    const result = await service.releaseHold(sessionId, 'EXCLUDE', managerId, 'dispute resolved - no pay');

    expect(result.status).toBe(PayrollTransactionStatus.EXCLUDED);
    expect(result.excludedReason).toBe('dispute resolved - no pay');
    expect(result.excludedAt).toBeInstanceOf(Date);
    expect(tx.save).toHaveBeenCalled();
  });
});
