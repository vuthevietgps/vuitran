import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

export type InvoiceStatus =
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'PAID'
  | 'PENDING';

export type InvoiceCourseStatus =
  | 'NEW'
  | 'CONTINUE_1'
  | 'CONTINUE_2'
  | 'CONTINUE_3'
  | 'CONTINUE_4'
  | 'CONTINUE_5';

export const INVOICE_COURSE_STATUS_LABELS: Record<InvoiceCourseStatus, string> = {
  NEW: 'Kh\u00f3a m\u1edbi',
  CONTINUE_1: 'Kh\u00f3a ti\u1ebfp l\u1ea7n 1',
  CONTINUE_2: 'Kh\u00f3a ti\u1ebfp l\u1ea7n 2',
  CONTINUE_3: 'Kh\u00f3a ti\u1ebfp l\u1ea7n 3',
  CONTINUE_4: 'Kh\u00f3a ti\u1ebfp l\u1ea7n 4',
  CONTINUE_5: 'Kh\u00f3a ti\u1ebfp l\u1ea7n 5',
};

export interface InvoiceItem {
  _id: string;
  invoiceNumber: string;
  orderId?: string;
  productId?: string;
  productName?: string;
  studentId: {
    _id: string;
    fullName: string;
    parentName: string;
    parentPhone: string;
    studentCode?: string;
  };
  classType?: 'ONLINE' | 'OFFLINE';
  saleId?: {
    _id: string;
    fullName: string;
    email: string;
  };
  sessions?: number;
  bonusSessions?: number;
  trialSessions?: number;
  bonusSessionsRemaining?: number;
  trialSessionsRemaining?: number;
  paymentRound?: number;
  courseStatus?: InvoiceCourseStatus;
  amount: number;
  pricePerSession?: number;
  referenceDuration?: number;
  teacherPayPerSession?: number;
  paymentDate: string;
  receiptImage?: string;
  approvalImage?: string;
  description?: string;
  classId?: {
    _id: string;
    name: string;
    code: string;
  } | string | null;
  status: InvoiceStatus;
  createdBy: {
    _id: string;
    fullName: string;
    email: string;
  };
  createdAt: string;
  updatedAt: string;
  totalSessionsByStudentClass?: number | null;
}

export interface InvoiceManagementSummary {
  total: number;
  onlineAmount: number;
  offlineAmount: number;
  approvedAmount: number;
  pendingCount: number;
}

export interface InvoiceManagementQuery {
  keyword?: string;
  parentKeyword?: string;
  saleKeyword?: string;
  classType?: 'ONLINE' | 'OFFLINE';
  status?: InvoiceStatus;
  courseStatus?: InvoiceCourseStatus;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

export interface InvoiceManagementResponse {
  data: InvoiceItem[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  summary: InvoiceManagementSummary;
}

export interface InvoiceUpsertPayload {
  invoiceNumber: string;
  studentId: string;
  classId?: string;
  orderId?: string;
  productId?: string;
  productName?: string;
  classType?: 'ONLINE' | 'OFFLINE';
  saleId?: string;
  sessions?: number;
  bonusSessions?: number;
  trialSessions?: number;
  paymentRound?: number;
  courseStatus?: InvoiceCourseStatus;
  amount: number;
  paymentDate: string;
  receiptImage?: string;
  description?: string;
  invoiceType?: 'TUITION' | 'MATERIAL' | 'OTHER';
}

export interface InvoiceMutationResult {
  ok: boolean;
  message?: string;
}

export interface ReceiptUploadResult extends InvoiceMutationResult {
  url?: string;
}

@Injectable({ providedIn: 'root' })
export class InvoiceService {
  private http = inject(HttpClient);

  private buildParams(params: Record<string, unknown>): HttpParams {
    let httpParams = new HttpParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        httpParams = httpParams.set(key, String(value));
      }
    });
    return httpParams;
  }

  async list(): Promise<InvoiceItem[]> {
    try {
      const res = await firstValueFrom(
        this.http.get<InvoiceItem[]>(`${environment.apiBase}/invoices`, { withCredentials: true }),
      );
      return res;
    } catch (error) {
      console.error('Failed to load invoices', error);
      return [];
    }
  }

  async create(payload: InvoiceUpsertPayload): Promise<InvoiceMutationResult> {
    try {
      await firstValueFrom(
        this.http.post(`${environment.apiBase}/invoices`, payload, { withCredentials: true }),
      );
      return { ok: true };
    } catch (error: any) {
      return this.fail(error);
    }
  }

  async update(id: string, payload: Partial<InvoiceUpsertPayload>): Promise<InvoiceMutationResult> {
    try {
      await firstValueFrom(
        this.http.patch(`${environment.apiBase}/invoices/${id}`, payload, { withCredentials: true }),
      );
      return { ok: true };
    } catch (error: any) {
      return this.fail(error);
    }
  }

  async approve(
    id: string,
    action: 'APPROVE' | 'REJECT',
    rejectedReason?: string,
    approvalImage?: string,
  ): Promise<InvoiceMutationResult> {
    try {
      await firstValueFrom(
        this.http.post(
          `${environment.apiBase}/invoices/${id}/approve`,
          { action, rejectedReason, approvalImage },
          { withCredentials: true },
        ),
      );
      return { ok: true };
    } catch (error: any) {
      return this.fail(error);
    }
  }

  async listManagement(query: InvoiceManagementQuery = {}): Promise<InvoiceManagementResponse> {
    try {
      return await firstValueFrom(
        this.http.get<InvoiceManagementResponse>(`${environment.apiBase}/invoices/management`, {
          params: this.buildParams(query as any),
          withCredentials: true,
        }),
      );
    } catch (error) {
      console.error('Failed to load invoice management list', error);
      return {
        data: [],
        meta: {
          total: 0,
          page: Number(query.page) || 1,
          limit: Number(query.limit) || 25,
          totalPages: 1,
        },
        summary: {
          total: 0,
          onlineAmount: 0,
          offlineAmount: 0,
          approvedAmount: 0,
          pendingCount: 0,
        },
      };
    }
  }

  async cancel(id: string, reason?: string): Promise<InvoiceMutationResult> {
    try {
      await firstValueFrom(
        this.http.post(
          `${environment.apiBase}/invoices/${id}/cancel`,
          { reason },
          { withCredentials: true },
        ),
      );
      return { ok: true };
    } catch (error: any) {
      return this.fail(error);
    }
  }

  async remove(id: string): Promise<InvoiceMutationResult> {
    try {
      await firstValueFrom(
        this.http.delete(`${environment.apiBase}/invoices/${id}`, { withCredentials: true }),
      );
      return { ok: true };
    } catch (error: any) {
      return this.fail(error);
    }
  }

  async uploadReceipt(file: File): Promise<ReceiptUploadResult> {
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await firstValueFrom(
        this.http.post<{ url?: string }>(`${environment.apiBase}/invoices/receipt-upload`, formData, {
          withCredentials: true,
        }),
      );
      return { ok: true, url: res?.url };
    } catch (error: any) {
      return this.fail(error, 'Khong the tai anh len');
    }
  }

  async getInvoicesByStudent(studentId: string): Promise<InvoiceItem[]> {
    try {
      const res = await firstValueFrom(
        this.http.get<InvoiceItem[]>(`${environment.apiBase}/invoices/student/${studentId}`, {
          withCredentials: true,
        }),
      );
      return res;
    } catch (error) {
      console.error('Failed to load student invoices', error);
      return [];
    }
  }

  private fail(error: any, fallback = 'Khong the thuc hien thao tac'): InvoiceMutationResult {
    const message = this.normalizeMessage(error?.error?.message)
      || this.normalizeMessage(error?.message)
      || fallback;
    return { ok: false, message };
  }

  private normalizeMessage(value: any): string | undefined {
    if (!value) return undefined;
    if (typeof value === 'string') return value;
    if (Array.isArray(value)) {
      const normalized = value
        .map((item) => this.normalizeMessage(item))
        .filter((item): item is string => !!item);
      return normalized.length ? normalized.join(', ') : undefined;
    }
    if (typeof value === 'object') {
      return this.normalizeMessage(value.message)
        || this.normalizeMessage(value.error)
        || undefined;
    }
    return String(value);
  }
}
