import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { BankTransaction, BankTransactionDocument } from './schemas/bank-transaction.schema';
import { LedgerEntry, LedgerEntryDocument } from '../wallets/schemas/ledger-entry.schema';

@Injectable()
export class FinancialControlBankReconciliationService {
  constructor(
    @InjectModel(BankTransaction.name) private bankTransactionModel: Model<BankTransactionDocument>,
    @InjectModel(LedgerEntry.name) private ledgerModel: Model<LedgerEntryDocument>,
  ) {}

  async getReconciliation(bankAccountId: string, fromDate: string, toDate: string) {
    if (!bankAccountId) {
      throw new BadRequestException('bankAccountId is required');
    }
    if (!Types.ObjectId.isValid(bankAccountId)) {
      throw new BadRequestException('Invalid bankAccountId');
    }
    if (!fromDate || !toDate) {
      throw new BadRequestException('fromDate and toDate are required');
    }

    const from = new Date(fromDate);
    const to = new Date(toDate);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      throw new BadRequestException('Invalid fromDate/toDate');
    }
    if (from.getTime() > to.getTime()) {
      throw new BadRequestException('fromDate must be less than or equal to toDate');
    }
    to.setHours(23, 59, 59, 999);

    const dateFilter = {
      $gte: from,
      $lte: to,
    };

    const bankTxns = await this.bankTransactionModel.find({
      bankAccountId: new Types.ObjectId(bankAccountId),
      type: { $in: ['DEPOSIT', 'TRANSFER_IN'] },
      transactionDate: dateFilter,
    }).sort({ transactionDate: 1 }).lean();

    const ledgerFrom = new Date(from);
    ledgerFrom.setDate(ledgerFrom.getDate() - 2);
    const ledgerTo = new Date(to);
    ledgerTo.setDate(ledgerTo.getDate() + 2);
    const ledgerDateFilter = {
      $gte: ledgerFrom,
      $lte: ledgerTo,
    };

    const ledgerEntries = await this.ledgerModel.find({
      type: 'TOP_UP',
      status: 'APPROVED',
      paymentMethod: 'BANK_TRANSFER',
      $or: [
        { approvedAt: ledgerDateFilter },
        { createdAt: ledgerDateFilter },
      ],
    }).lean();

    const normalizedBankAccountId = bankAccountId.trim();

    const normalizeRef = (value: unknown): string =>
      typeof value === 'string' ? value.trim().toUpperCase() : '';

    const isUsableRef = (value: string): boolean =>
      value.length >= 4 && value !== 'CONFIRMED';

    const extractLedgerRefs = (ledger: any): string[] => {
      const refs = new Set<string>();
      const directRef = normalizeRef(ledger?.transactionRef);
      if (isUsableRef(directRef)) {
        refs.add(directRef);
      }

      const notes = typeof ledger?.accountingNotes === 'string' ? ledger.accountingNotes : '';
      const refRegex = /BANK_MATCHED_REF:\s*([^|]+)/gi;
      let match: RegExpExecArray | null;
      while ((match = refRegex.exec(notes)) !== null) {
        const noteRef = normalizeRef(match[1]);
        if (isUsableRef(noteRef)) {
          refs.add(noteRef);
        }
      }

      return Array.from(refs);
    };

    const extractLedgerBankAccountIds = (ledger: any): string[] => {
      const ids = new Set<string>();
      const notes = typeof ledger?.accountingNotes === 'string' ? ledger.accountingNotes : '';
      const accountIdRegex = /BANK_MATCHED_BANK_ACCOUNT_ID:\s*([^|]+)/gi;
      let match: RegExpExecArray | null;
      while ((match = accountIdRegex.exec(notes)) !== null) {
        const id = (match[1] || '').trim();
        if (Types.ObjectId.isValid(id)) {
          ids.add(id);
        }
      }
      return Array.from(ids);
    };

    const scopedLedgerEntries = ledgerEntries.filter((ledger: any) => {
      const taggedIds = extractLedgerBankAccountIds(ledger);
      return taggedIds.length === 0 || taggedIds.includes(normalizedBankAccountId);
    });

    const hasReferenceMatch = (bank: any, ledger: any): boolean => {
      const bankText = [bank?.reference, bank?.description]
        .map(v => normalizeRef(v))
        .filter(Boolean)
        .join(' ');
      if (!bankText) return false;

      const ledgerRefs = extractLedgerRefs(ledger);
      if (ledgerRefs.length === 0) return false;
      return ledgerRefs.some(ref => bankText.includes(ref));
    };

    const toTimestamp = (value: unknown): number | null => {
      if (!value) return null;
      const ts = new Date(value as any).getTime();
      return Number.isNaN(ts) ? null : ts;
    };

    const matched: { bank: any; ledger: any }[] = [];
    const usedBankIds = new Set<string>();
    const usedLedgerIds = new Set<string>();

    const findBestLedgerMatch = (bank: any, requireReferenceMatch: boolean): any | null => {
      const bankDate = toTimestamp(bank?.transactionDate);
      if (bankDate == null) return null;
      const bankAmount = Number(bank?.amount || 0);

      let best: any | null = null;
      let bestDayDiff = Number.POSITIVE_INFINITY;
      let bestAmountDiff = Number.POSITIVE_INFINITY;

      for (const ledger of scopedLedgerEntries) {
        const ledgerId = (ledger as any)?._id?.toString?.();
        if (!ledgerId || usedLedgerIds.has(ledgerId)) continue;

        const ledgerBankAccountIds = extractLedgerBankAccountIds(ledger);
        if (ledgerBankAccountIds.length > 0 && !ledgerBankAccountIds.includes(normalizedBankAccountId)) {
          continue;
        }

        const ledgerDate = toTimestamp((ledger as any).approvedAt || (ledger as any).createdAt);
        if (ledgerDate == null) continue;

        const ledgerAmount = Number((ledger as any).amount || 0);
        const amountDiff = Math.abs(bankAmount - ledgerAmount);
        if (amountDiff >= 1) continue;

        const dayDiff = Math.abs(bankDate - ledgerDate) / (1000 * 60 * 60 * 24);
        const allowedDayDiff = requireReferenceMatch ? 2 : 1;
        if (dayDiff > allowedDayDiff) continue;

        const ledgerRefs = extractLedgerRefs(ledger);
        if (requireReferenceMatch && !hasReferenceMatch(bank, ledger)) {
          continue;
        }
        if (!requireReferenceMatch && ledgerRefs.length > 0) {
          continue;
        }

        if (
          best == null ||
          dayDiff < bestDayDiff ||
          (dayDiff === bestDayDiff && amountDiff < bestAmountDiff)
        ) {
          best = ledger;
          bestDayDiff = dayDiff;
          bestAmountDiff = amountDiff;
        }
      }

      return best;
    };

    // Pass 1: reference-based matches first.
    for (const bank of bankTxns) {
      const bankId = (bank as any)?._id?.toString?.();
      if (!bankId || usedBankIds.has(bankId)) continue;

      const bestRefMatch = findBestLedgerMatch(bank, true);
      if (!bestRefMatch) continue;

      const ledgerId = (bestRefMatch as any)._id.toString();
      matched.push({ bank, ledger: bestRefMatch });
      usedBankIds.add(bankId);
      usedLedgerIds.add(ledgerId);
    }

    // Pass 2: fallback to amount + nearest date.
    for (const bank of bankTxns) {
      const bankId = (bank as any)?._id?.toString?.();
      if (!bankId || usedBankIds.has(bankId)) continue;

      const bestFallbackMatch = findBestLedgerMatch(bank, false);
      if (!bestFallbackMatch) continue;

      const ledgerId = (bestFallbackMatch as any)._id.toString();
      matched.push({ bank, ledger: bestFallbackMatch });
      usedBankIds.add(bankId);
      usedLedgerIds.add(ledgerId);
    }

    const unmatchedBank = bankTxns.filter((b: any) => !usedBankIds.has(b._id.toString()));
    const unmatchedLedger = scopedLedgerEntries.filter((l: any) => !usedLedgerIds.has(l._id.toString()));

    const matchedAmount = matched.reduce((s, m) => s + ((m.bank as any).amount || 0), 0);
    const unmatchedBankAmount = unmatchedBank.reduce((s, b: any) => s + (b.amount || 0), 0);
    const unmatchedLedgerAmount = unmatchedLedger.reduce((s, l: any) => s + (l.amount || 0), 0);

    return {
      matched: matched.map((m) => ({
        bankTxn: m.bank,
        ledgerEntry: m.ledger,
      })),
      unmatchedBank,
      unmatchedLedger,
      unmatchedSystem: unmatchedLedger,
      summary: {
        matchedCount: matched.length,
        matchedAmount,
        unmatchedBankCount: unmatchedBank.length,
        unmatchedBankAmount,
        unmatchedLedgerCount: unmatchedLedger.length,
        unmatchedLedgerAmount,
        unmatchedSystemCount: unmatchedLedger.length,
        unmatchedSystemAmount: unmatchedLedgerAmount,
        variance: unmatchedBankAmount - unmatchedLedgerAmount,
      },
    };
  }
}
