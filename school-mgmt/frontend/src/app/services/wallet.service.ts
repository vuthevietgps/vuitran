import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

export interface WalletItem {
  _id: string;
  userId: { _id: string; fullName: string; email?: string; phone?: string; role?: string };
  balance: number;
  totalTopUp: number;
  totalDeducted: number;
  totalRefunded: number;
  status: string;
  lastTransactionAt?: string;
  adGroupId?: string;
  adGroupName?: string;
  adPlatform?: string;
  adAttributionSource?: 'PARENT_ATTRIBUTION' | 'STUDENT_FALLBACK' | 'UNATTRIBUTED' | null;
}

export interface LedgerItem {
  _id: string;
  walletId: string;
  userId: string;
  type: string;
  status: string;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  description?: string;
  sessionId?: any;
  classId?: any;
  studentId?: any;
  paymentMethod?: string;
  transactionRef?: string;
  approvedBy?: any;
  createdBy?: any;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class WalletService {
  private http = inject(HttpClient);

  private buildParams(params: Record<string, any>): HttpParams {
    let httpParams = new HttpParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        httpParams = httpParams.set(key, String(value));
      }
    });
    return httpParams;
  }

  async getMyWallet(): Promise<WalletItem | null> {
    try {
      const res = await firstValueFrom(
        this.http.get<WalletItem>(`${environment.apiBase}/wallets/me`, { withCredentials: true }),
      );
      return res;
    } catch {
      return null;
    }
  }

  async getAllWallets(page = 1, limit = 50): Promise<{ data: WalletItem[]; meta: any }> {
    try {
      const res = await firstValueFrom(
        this.http.get<{ data: WalletItem[]; meta: any }>(`${environment.apiBase}/wallets`, {
          params: this.buildParams({ page, limit }),
          withCredentials: true,
        }),
      );
      return res;
    } catch {
      return { data: [], meta: {} };
    }
  }

  async requestTopUp(payload: {
    userId: string;
    amount: number;
    paymentMethod: string;
    transactionRef?: string;
    receiptImageUrl?: string;
    description?: string;
  }): Promise<boolean> {
    await firstValueFrom(
      this.http.post(`${environment.apiBase}/wallets/top-up`, payload, { withCredentials: true }),
    );
    return true;
  }

  async getPendingTopUps(): Promise<any[]> {
    try {
      const res = await firstValueFrom(
        this.http.get<any[]>(`${environment.apiBase}/wallets/top-up/pending`, { withCredentials: true }),
      );
      return res;
    } catch {
      return [];
    }
  }

  async approveTopUp(
    id: string,
    payload?: {
      accountingNotes?: string;
      bankMatched?: boolean;
      bankStatementRef?: string;
      bankAccountId?: string;
    },
  ): Promise<boolean> {
    await firstValueFrom(
      this.http.post(`${environment.apiBase}/wallets/top-up/${id}/approve`, payload || {}, {
        withCredentials: true,
      }),
    );
    return true;
  }

  async rejectTopUp(id: string, reason?: string): Promise<boolean> {
    await firstValueFrom(
      this.http.post(`${environment.apiBase}/wallets/top-up/${id}/reject`, { reason: reason || '' }, {
        withCredentials: true,
      }),
    );
    return true;
  }

  async transfer(fromUserId: string, toUserId: string, amount: number, description?: string): Promise<boolean> {
    await firstValueFrom(
      this.http.post(`${environment.apiBase}/wallets/transfer`, { fromUserId, toUserId, amount, description }, {
        withCredentials: true,
      }),
    );
    return true;
  }

  async getMyLedger(params: any = {}): Promise<{ data: LedgerItem[]; meta: any }> {
    try {
      const res = await firstValueFrom(
        this.http.get<{ data: LedgerItem[]; meta: any }>(`${environment.apiBase}/wallets/me/ledger`, {
          params: this.buildParams(params),
          withCredentials: true,
        }),
      );
      return res;
    } catch {
      return { data: [], meta: {} };
    }
  }

  async queryLedger(params: any = {}): Promise<{ data: LedgerItem[]; meta: any }> {
    try {
      const res = await firstValueFrom(
        this.http.get<{ data: LedgerItem[]; meta: any }>(`${environment.apiBase}/wallets/ledger`, {
          params: this.buildParams(params),
          withCredentials: true,
        }),
      );
      return res;
    } catch {
      return { data: [], meta: {} };
    }
  }
}
