import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Invoice, InvoiceDocument } from '../invoices/schemas/invoice.schema';
import { Wallet, WalletDocument } from '../wallets/schemas/wallet.schema';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { Role } from '../common/interfaces/role.enum';

@Injectable()
export class FinancialControlAgingService {
  constructor(
    @InjectModel(Invoice.name) private invoiceModel: Model<InvoiceDocument>,
    @InjectModel(Wallet.name) private walletModel: Model<WalletDocument>,
  ) {}

  async getAgingReport(user?: JwtPayload) {
    const now = new Date();

    const walletsWithDebt = await this.walletModel
      .find({ balance: { $lt: 0 } })
      .populate('userId', 'fullName email phone')
      .lean();

    const unpaidInvoices = await this.invoiceModel
      .find({ status: { $in: ['PENDING_APPROVAL'] } })
      .populate('studentId', 'fullName parentName parentPhone parentUserId')
      .lean();

    const agingMap: Map<string, {
      parentName: string;
      parentPhone: string;
      students: string[];
      totalDebt: number;
      oldestDate: Date;
      items: any[];
    }> = new Map();

    for (const w of walletsWithDebt) {
      const user = (w as any).userId;
      if (!user) continue;
      const key = user._id.toString();
      if (!agingMap.has(key)) {
        agingMap.set(key, {
          parentName: user.fullName || '',
          parentPhone: user.phone || '',
          students: [],
          totalDebt: 0,
          oldestDate: new Date(),
          items: [],
        });
      }
      const entry = agingMap.get(key)!;
      entry.totalDebt += Math.abs(w.balance);
      const walletDebtDate = (w as any).updatedAt || now;
      if (walletDebtDate < entry.oldestDate) entry.oldestDate = walletDebtDate;
      entry.items.push({ type: 'WALLET_DEBT', amount: Math.abs(w.balance), date: walletDebtDate });
    }

    for (const inv of unpaidInvoices) {
      const student = (inv as any).studentId;
      if (!student) continue;
      const parentKey = student.parentUserId?.toString() || student.parentPhone || student._id.toString();
      if (!agingMap.has(parentKey)) {
        agingMap.set(parentKey, {
          parentName: student.parentName || '',
          parentPhone: student.parentPhone || '',
          students: [],
          totalDebt: 0,
          oldestDate: new Date(),
          items: [],
        });
      }
      const entry = agingMap.get(parentKey)!;
      entry.totalDebt += (inv as any).amount || 0;
      if (!entry.students.includes(student.fullName)) entry.students.push(student.fullName);
      const invDate = (inv as any).createdAt || now;
      if (invDate < entry.oldestDate) entry.oldestDate = invDate;
      entry.items.push({
        type: 'UNPAID_INVOICE',
        invoiceNumber: (inv as any).invoiceNumber,
        amount: (inv as any).amount,
        date: invDate,
        status: (inv as any).status,
      });
    }

    const getBucket = (date: Date): string => {
      const diffDays = Math.floor((now.getTime() - new Date(date).getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays <= 0) return 'current';
      if (diffDays <= 30) return '1-30';
      if (diffDays <= 60) return '31-60';
      if (diffDays <= 90) return '61-90';
      return '90+';
    };

    const results: any[] = [];
    const bucketSummary: Record<string, number> = { current: 0, '1-30': 0, '31-60': 0, '61-90': 0, '90+': 0 };

    for (const [, entry] of agingMap) {
      const bucket = getBucket(entry.oldestDate);
      bucketSummary[bucket] += entry.totalDebt;
      results.push({
        parentName: entry.parentName,
        parentPhone: entry.parentPhone,
        students: entry.students,
        totalDebt: entry.totalDebt,
        oldestDate: entry.oldestDate,
        bucket,
        items: entry.items,
      });
    }

    results.sort((a, b) => b.totalDebt - a.totalDebt);

    const totalAR = Object.values(bucketSummary).reduce((s, v) => s + v, 0);

    const report: {
      summary: {
        totalAR: number;
        current: number;
        '1-30': number;
        '31-60': number;
        '61-90': number;
        '90+': number;
      };
      details: any[];
    } = {
      summary: {
        totalAR,
        current: bucketSummary.current,
        '1-30': bucketSummary['1-30'],
        '31-60': bucketSummary['31-60'],
        '61-90': bucketSummary['61-90'],
        '90+': bucketSummary['90+'],
      },
      details: results,
    };

    if (user?.role !== Role.SHAREHOLDER) {
      return report;
    }

    return {
      ...report,
      details: report.details.map((detail, index) => ({
        ...detail,
        parentName: `PH #${index + 1}`,
        parentPhone: '',
        students: Array.isArray(detail.students)
          ? detail.students.map((_, studentIndex) => `HS #${studentIndex + 1}`)
          : [],
        items: [],
      })),
    };
  }
}
