/**
 * Unit Tests: WalletsService
 *
 * Strategy: mock Mongoose models and connection via jest.fn(),
 * spy on service methods to isolate business logic.
 * Tests do NOT require a live DB or Redis.
 */
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { WalletsService } from './wallets.service';
import { WalletsTopUpService } from './wallets-topup.service';
import { WalletsOperationsService } from './wallets-operations.service';
import { WalletsQueryService } from './wallets-query.service';
import { WalletStatus } from './schemas/wallet.schema';
import {
  TransactionType,
  TransactionStatus,
  PaymentMethod,
} from './schemas/ledger-entry.schema';

// ─── Mock session ─────────────────────────────────────────────────────────────

const makeMockSession = () => ({
  startTransaction: jest.fn(),
  commitTransaction: jest.fn().mockResolvedValue(undefined),
  abortTransaction: jest.fn().mockResolvedValue(undefined),
  endSession: jest.fn().mockResolvedValue(undefined),
});

// ─── Mock Mongoose chainable query (.session().lean()) ────────────────────────

const chainable = (resolvedValue: any) => ({
  session: jest.fn().mockReturnThis(),
  lean: jest.fn().mockResolvedValue(resolvedValue),
});

// ─── Build service with mocked deps ───────────────────────────────────────────

function buildService(overrides: Partial<{
  walletModel: any;
  ledgerModel: any;
  userModel: any;
  invoiceModel: any;
  bankAccountModel: any;
  studentModel: any;
  parentAttributionModel: any;
  connection: any;
}> = {}) {
  const walletModel = overrides.walletModel ?? ({} as any);
  const ledgerModel = overrides.ledgerModel ?? ({} as any);
  const userModel = overrides.userModel ?? ({} as any);
  const invoiceModel = overrides.invoiceModel ?? ({} as any);
  const bankAccountModel = overrides.bankAccountModel ?? ({} as any);
  const studentModel = overrides.studentModel ?? ({} as any);
  const parentAttributionModel = overrides.parentAttributionModel ?? ({} as any);
  const connection = overrides.connection ?? ({} as any);

  const topUpService = new WalletsTopUpService(walletModel, ledgerModel, bankAccountModel, connection);
  const operationsService = new WalletsOperationsService(walletModel, ledgerModel, userModel, connection);
  const queryService = new WalletsQueryService(walletModel, ledgerModel, userModel, invoiceModel, studentModel, parentAttributionModel);

  return new WalletsService(
    walletModel,
    topUpService,
    operationsService,
    queryService,
  );
}

// ─── Shared fixtures ──────────────────────────────────────────────────────────

const parentId = new Types.ObjectId().toString();
const sessionId = new Types.ObjectId().toString();
const classId = new Types.ObjectId().toString();
const studentId = new Types.ObjectId().toString();

const makeWallet = (overrides: Partial<any> = {}) => ({
  _id: new Types.ObjectId(),
  userId: new Types.ObjectId(parentId),
  balance: 500_000,
  debtLimit: 0,
  trialDebtSessions: 2,
  status: WalletStatus.ACTIVE,
  save: jest.fn().mockResolvedValue(undefined),
  ...overrides,
});

// ══════════════════════════════════════════════════════════════════════════════
//  requestTopUp
// ══════════════════════════════════════════════════════════════════════════════

describe('WalletsService.requestTopUp()', () => {
  it('throws BadRequestException when BANK_TRANSFER is missing receiptImageUrl', async () => {
    const service = buildService();
    await expect(
      service.requestTopUp(
        {
          userId: parentId,
          amount: 100_000,
          paymentMethod: PaymentMethod.BANK_TRANSFER,
          receiptImageUrl: '',
        } as any,
        'creator-id',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('creates a PENDING LedgerEntry for valid CASH top-up', async () => {
    const wallet = makeWallet();
    const createdEntry = { _id: new Types.ObjectId(), type: TransactionType.TOP_UP, status: TransactionStatus.PENDING };
    const creatorId = new Types.ObjectId().toString();

    const walletModel = { findOneAndUpdate: jest.fn().mockResolvedValue(wallet) } as any;
    const ledgerModel = { create: jest.fn().mockResolvedValue(createdEntry) } as any;
    const service = buildService({ walletModel, ledgerModel });

    const result = await service.requestTopUp(
      {
        userId: parentId,
        amount: 200_000,
        paymentMethod: PaymentMethod.CASH,
      } as any,
      creatorId,
    );

    expect(ledgerModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        type: TransactionType.TOP_UP,
        status: TransactionStatus.PENDING,
        amount: 200_000,
      }),
    );
    expect(result).toBe(createdEntry);
  });

  it('creates a PENDING LedgerEntry for BANK_TRANSFER with receiptImageUrl', async () => {
    const wallet = makeWallet();
    const createdEntry = { _id: new Types.ObjectId() };
    const creatorId = new Types.ObjectId().toString();
    const walletModel = { findOneAndUpdate: jest.fn().mockResolvedValue(wallet) } as any;
    const ledgerModel = { create: jest.fn().mockResolvedValue(createdEntry) } as any;
    const service = buildService({ walletModel, ledgerModel });

    await service.requestTopUp(
      {
        userId: parentId,
        amount: 300_000,
        paymentMethod: PaymentMethod.BANK_TRANSFER,
        receiptImageUrl: 'https://example.com/receipt.jpg',
      } as any,
      creatorId,
    );

    expect(ledgerModel.create).toHaveBeenCalledTimes(1);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
//  deductForSession
// ══════════════════════════════════════════════════════════════════════════════

describe('WalletsService.deductForSession()', () => {
  const deductParams = {
    parentUserId: parentId,
    sessionId,
    classId,
    studentId,
    amount: 200_000,
    pricePerSession: 200_000,
  };

  it('returns early (idempotent) when a matching LedgerEntry already exists', async () => {
    const existingEntry = {
      _id: new Types.ObjectId(),
      amount: 200_000,
      studentId: new Types.ObjectId(studentId),
    };
    const mockSession = makeMockSession();
    const ledgerModel = {
      findOne: jest.fn().mockReturnValue(chainable(existingEntry)),
    } as any;
    const connection = { startSession: jest.fn().mockResolvedValue(mockSession) } as any;
    const service = buildService({ ledgerModel, connection });

    const result = await service.deductForSession(deductParams);

    expect(ledgerModel.findOne).toHaveBeenCalledTimes(1);
    expect(mockSession.commitTransaction).not.toHaveBeenCalled();
    expect(result).toBe(existingEntry);
  });

  it('throws BadRequestException when wallet is FROZEN', async () => {
    const mockSession = makeMockSession();
    const frozenWallet = makeWallet({ status: WalletStatus.FROZEN });
    const walletModel = {
      findOneAndUpdate: jest.fn().mockResolvedValue(frozenWallet),
    } as any;
    const ledgerModel = {
      findOne: jest.fn().mockReturnValue(chainable(null)),
    } as any;
    const connection = { startSession: jest.fn().mockResolvedValue(mockSession) } as any;
    const service = buildService({ walletModel, ledgerModel, connection });

    await expect(service.deductForSession(deductParams)).rejects.toThrow(BadRequestException);
    expect(mockSession.abortTransaction).toHaveBeenCalled();
  });

  it('throws BadRequestException when balance is insufficient (atomicResult = null)', async () => {
    const mockSession = makeMockSession();
    const wallet = makeWallet({ balance: 0, debtLimit: 0, trialDebtSessions: 0 });
    const walletModel = {
      findOneAndUpdate: jest.fn()
        .mockResolvedValueOnce(wallet)   // ensureWallet
        .mockResolvedValueOnce(null),    // atomic check fails — balance too low
      findById: jest.fn().mockReturnValue({
        session: jest.fn().mockResolvedValue(wallet), // walletModel.findById(id).session(s) used in error path
      }),
    } as any;
    const ledgerModel = {
      findOne: jest.fn().mockReturnValue(chainable(null)),
    } as any;
    const connection = { startSession: jest.fn().mockResolvedValue(mockSession) } as any;
    const service = buildService({ walletModel, ledgerModel, connection });

    await expect(service.deductForSession(deductParams)).rejects.toThrow(BadRequestException);
    expect(mockSession.abortTransaction).toHaveBeenCalled();
  });

  it('deducts balance and creates LedgerEntry on success', async () => {
    const mockSession = makeMockSession();
    const wallet = makeWallet({ balance: 500_000 });
    const updatedWallet = { ...wallet, balance: 300_000 };
    const createdEntry = { _id: new Types.ObjectId(), amount: 200_000 };

    const walletModel = {
      findOneAndUpdate: jest.fn()
        .mockResolvedValueOnce(wallet)          // ensureWallet
        .mockResolvedValueOnce(updatedWallet),   // atomic deduct
    } as any;
    const ledgerModel = {
      findOne: jest.fn().mockReturnValue(chainable(null)),
      create: jest.fn().mockResolvedValue([createdEntry]),
    } as any;
    const connection = { startSession: jest.fn().mockResolvedValue(mockSession) } as any;
    const service = buildService({ walletModel, ledgerModel, connection });

    const result = await service.deductForSession(deductParams);

    expect(walletModel.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ _id: wallet._id }),
      expect.objectContaining({ $inc: expect.objectContaining({ balance: -200_000 }) }),
      expect.objectContaining({ new: true }),
    );
    expect(ledgerModel.create).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          type: TransactionType.SESSION_DEDUCT,
          status: TransactionStatus.COMPLETED,
          amount: 200_000,
        }),
      ]),
      expect.objectContaining({ session: mockSession }),
    );
    expect(mockSession.commitTransaction).toHaveBeenCalled();
    expect(result).toBe(createdEntry);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
//  freezeWallet / unfreezeWallet
// ══════════════════════════════════════════════════════════════════════════════

describe('WalletsService.freezeWallet() / unfreezeWallet()', () => {
  it('freezeWallet sets status to FROZEN', async () => {
    const wallet = makeWallet({ status: WalletStatus.ACTIVE });
    const service = buildService();
    jest.spyOn(service, 'findWalletByUserId').mockResolvedValue(wallet as any);

    await service.freezeWallet(parentId);

    expect(wallet.status).toBe(WalletStatus.FROZEN);
    expect(wallet.save).toHaveBeenCalled();
  });

  it('unfreezeWallet sets status to ACTIVE', async () => {
    const wallet = makeWallet({ status: WalletStatus.FROZEN });
    const service = buildService();
    jest.spyOn(service, 'findWalletByUserId').mockResolvedValue(wallet as any);

    await service.unfreezeWallet(parentId);

    expect(wallet.status).toBe(WalletStatus.ACTIVE);
    expect(wallet.save).toHaveBeenCalled();
  });

  it('findWalletByUserId throws NotFoundException when wallet not found', async () => {
    const walletModel = {
      findOne: jest.fn().mockResolvedValue(null),
    } as any;
    const service = buildService({ walletModel });

    await expect(service.findWalletByUserId(parentId)).rejects.toThrow(NotFoundException);
  });
});

describe('WalletsService wallet view attribution', () => {
  it('getAllWallets enriches parent wallets with ParentAttribution metadata', async () => {
    const parentObjectId = new Types.ObjectId(parentId);
    const adGroupId = new Types.ObjectId();
    const walletRows = [{
      _id: new Types.ObjectId(),
      userId: {
        _id: parentObjectId,
        fullName: 'Parent Demo',
        email: 'parent@example.com',
        phone: '0901234567',
        role: 'PARENT',
      },
      balance: 120000,
      totalTopUp: 500000,
      totalDeducted: 380000,
      totalRefunded: 0,
      status: WalletStatus.ACTIVE,
    }];

    const walletModel = {
      find: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(walletRows),
      }),
      countDocuments: jest.fn().mockResolvedValue(1),
    } as any;
    const userModel = {
      find: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([{
          _id: parentObjectId,
          fullName: 'Parent Demo',
          email: 'parent@example.com',
          phone: '0901234567',
          role: 'PARENT',
        }]),
      }),
    } as any;
    const parentAttributionModel = {
      find: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([{
          parentUserId: parentObjectId,
          normalizedParentPhone: '0901234567',
          adGroupId,
          adGroupName: 'Nhom Ads A',
          platform: 'facebook',
          lastConfirmedAt: new Date(),
        }]),
      }),
    } as any;

    const service = buildService({ walletModel, userModel, parentAttributionModel });

    const result = await service.getAllWallets(1, 20);

    expect(result.data[0]).toEqual(expect.objectContaining({
      adGroupId: adGroupId.toString(),
      adGroupName: 'Nhom Ads A',
      adPlatform: 'facebook',
      adAttributionSource: 'PARENT_ATTRIBUTION',
    }));
  });

  it('getWalletViewByUserId falls back to student adGroup when attribution doc is missing', async () => {
    const parentObjectId = new Types.ObjectId(parentId);
    const adGroupId = new Types.ObjectId();
    const walletModel = {
      findOne: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          _id: new Types.ObjectId(),
          userId: parentObjectId,
          balance: 0,
          totalTopUp: 0,
          totalDeducted: 0,
          totalRefunded: 0,
          status: WalletStatus.ACTIVE,
        }),
      }),
    } as any;
    const userModel = {
      find: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([{
          _id: parentObjectId,
          fullName: 'Parent Fallback',
          email: 'fallback@example.com',
          phone: '0988888888',
          role: 'PARENT',
        }]),
      }),
    } as any;
    const parentAttributionModel = {
      find: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([]),
      }),
    } as any;
    const studentModel = {
      find: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([{
          parentUserId: parentObjectId,
          adGroupId,
          adGroupName: 'Hoc sinh fallback',
        }]),
      }),
    } as any;

    const service = buildService({ walletModel, userModel, parentAttributionModel, studentModel });

    const result = await service.getWalletViewByUserId(parentId);

    expect(result).toEqual(expect.objectContaining({
      adGroupId: adGroupId.toString(),
      adGroupName: 'Hoc sinh fallback',
      adAttributionSource: 'STUDENT_FALLBACK',
    }));
  });
});
