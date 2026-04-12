import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, ClientSession } from 'mongoose';

import { Wallet, WalletDocument, WalletStatus } from './schemas/wallet.schema';
import { LedgerEntryDocument } from './schemas/ledger-entry.schema';

import { WalletsTopUpService } from './wallets-topup.service';
import { WalletsOperationsService } from './wallets-operations.service';
import { WalletsQueryService } from './wallets-query.service';

import { TopUpRequestDto } from './dto/top-up-request.dto';
import { ApproveTopUpDto } from './dto/approve-top-up.dto';
import { AdjustBalanceDto } from './dto/adjust-balance.dto';
import { QueryLedgerDto } from './dto/query-ledger.dto';
import { TransferDto } from './dto/transfer.dto';

@Injectable()
export class WalletsService {
  private readonly logger = new Logger(WalletsService.name);

  constructor(
    @InjectModel(Wallet.name) private walletModel: Model<WalletDocument>,
    private readonly topUpService: WalletsTopUpService,
    private readonly operationsService: WalletsOperationsService,
    private readonly queryService: WalletsQueryService,
  ) {}

  // ══════════════════════════════════════════════════════════════════
  //  WALLET CRUD
  // ══════════════════════════════════════════════════════════════════

  async createWallet(userId: string, mongoSession?: ClientSession): Promise<WalletDocument> {
    const wallet = await this.walletModel
      .findOneAndUpdate(
        { userId: new Types.ObjectId(userId) },
        { $setOnInsert: { userId: new Types.ObjectId(userId), balance: 0 } },
        { upsert: true, new: true, session: mongoSession },
      );
    if (!wallet) {
      throw new NotFoundException('Không thể tạo ví');
    }
    return wallet;
  }

  async getOrCreateWallet(userId: string): Promise<WalletDocument> {
    return this.createWallet(userId);
  }

  async getOrCreateWalletView(userId: string) {
    await this.createWallet(userId);
    return this.getWalletViewByUserId(userId);
  }

  async getWalletViewByUserId(userId: string) {
    const wallet = await this.walletModel.findOne({ userId: new Types.ObjectId(userId) }).lean();
    if (!wallet) throw new NotFoundException('Ví không tồn tại cho user này');
    const [decorated] = await this.queryService.decorateWallets([wallet]);
    return decorated;
  }

  async findWalletById(walletId: string): Promise<WalletDocument> {
    const wallet = await this.walletModel.findById(walletId);
    if (!wallet) throw new NotFoundException('Ví không tồn tại');
    return wallet;
  }

  async findWalletByUserId(userId: string): Promise<WalletDocument> {
    const wallet = await this.walletModel.findOne({ userId: new Types.ObjectId(userId) });
    if (!wallet) throw new NotFoundException('Ví không tồn tại cho user này');
    return wallet;
  }

  async freezeWallet(userId: string): Promise<WalletDocument> {
    const wallet = await this.findWalletByUserId(userId);
    wallet.status = WalletStatus.FROZEN;
    return wallet.save();
  }

  async unfreezeWallet(userId: string): Promise<WalletDocument> {
    const wallet = await this.findWalletByUserId(userId);
    wallet.status = WalletStatus.ACTIVE;
    return wallet.save();
  }

  // ══════════════════════════════════════════════════════════════════
  //  TOP-UP (delegates to WalletsTopUpService)
  // ══════════════════════════════════════════════════════════════════

  requestTopUp(dto: TopUpRequestDto, createdBy: string): Promise<LedgerEntryDocument> {
    return this.topUpService.requestTopUp(dto, createdBy);
  }

  approveTopUp(ledgerEntryId: string, approvedBy: string, dto: ApproveTopUpDto): Promise<LedgerEntryDocument> {
    return this.topUpService.approveTopUp(ledgerEntryId, approvedBy, dto);
  }

  rejectTopUp(ledgerEntryId: string, rejectedBy: string, reason?: string): Promise<LedgerEntryDocument> {
    return this.topUpService.rejectTopUp(ledgerEntryId, rejectedBy, reason);
  }

  topUpFromInvoice(params: {
    parentUserId: string;
    invoiceId: string;
    invoiceNumber: string;
    amount: number;
    studentId: string;
    classId?: string;
    approvedBy: string;
  }, options?: { session?: ClientSession }): Promise<LedgerEntryDocument> {
    return this.topUpService.topUpFromInvoice(params, options);
  }

  reverseInvoiceTopUp(
    params: { invoiceId: string; amount: number; reason: string; cancelledBy: string },
    options?: { session?: ClientSession },
  ): Promise<LedgerEntryDocument> {
    return this.topUpService.reverseInvoiceTopUp(params, options);
  }

  // ══════════════════════════════════════════════════════════════════
  //  OPERATIONS (delegates to WalletsOperationsService)
  // ══════════════════════════════════════════════════════════════════

  deductForSession(
    params: {
      parentUserId: string;
      sessionId: string;
      classId: string;
      studentId: string;
      amount: number;
      pricePerSession?: number;
    },
    systemUserId?: string,
  ): Promise<LedgerEntryDocument> {
    return this.operationsService.deductForSession(params, systemUserId);
  }

  refundForSession(
    params: {
      parentUserId: string;
      sessionId: string;
      classId: string;
      studentId: string;
      refundAmount: number;
    },
    systemUserId?: string,
  ): Promise<LedgerEntryDocument | null> {
    return this.operationsService.refundForSession(params, systemUserId);
  }

  adjustBalance(dto: AdjustBalanceDto, adjustedBy: string): Promise<LedgerEntryDocument> {
    return this.operationsService.adjustBalance(dto, adjustedBy);
  }

  transferBetweenWallets(dto: TransferDto, performedBy: string) {
    return this.operationsService.transferBetweenWallets(dto, performedBy);
  }

  // ══════════════════════════════════════════════════════════════════
  //  QUERY & STATS (delegates to WalletsQueryService)
  // ══════════════════════════════════════════════════════════════════

  queryLedger(query: QueryLedgerDto) {
    return this.queryService.queryLedger(query);
  }

  getPendingTopUps() {
    return this.queryService.getPendingTopUps();
  }

  getFinancialSummary(fromDate?: string, toDate?: string) {
    return this.queryService.getFinancialSummary(fromDate, toDate);
  }

  getAllWallets(page?: number, limit?: number, search?: string, status?: string) {
    return this.queryService.getAllWallets(page, limit, search, status);
  }

  getSessionEquivalence(params: { studentId: string; classId: string; requesterParentUserId?: string }) {
    return this.queryService.getSessionEquivalence(params);
  }

  runManualLedgerVerification() {
    return this.queryService.runManualLedgerVerification();
  }
}
