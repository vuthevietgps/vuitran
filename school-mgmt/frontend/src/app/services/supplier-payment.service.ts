import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../environments/environment';

export interface SupplierPaymentItem {
  _id: string;
  paymentCode: string;
  supplierName: string;
  supplierPhone?: string;
  supplierEmail?: string;
  supplierBankAccount?: string;
  supplierBankName?: string;
  title: string;
  description?: string;
  amount: number;
  paymentDate: string;
  status: string;
  paymentMethod?: string;
  supplierQuoteId?: string;
  createdById: string;
  createdByName: string;
  approvedById?: string;
  approvedByName?: string;
  approvedAt?: string;
  paidById?: string;
  paidByName?: string;
  paidAt?: string;
  rejectionReason?: string;
  receiptUrl?: string;
  receiptUrls?: string[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SupplierPaymentStats {
  totalCount: number;
  totalAmount: number;
  byStatus: Record<string, { count: number; total: number }>;
}

export interface SupplierPaymentPaginatedResponse {
  data: SupplierPaymentItem[];
  total: number;
  page: number;
  limit: number;
}

@Injectable({ providedIn: 'root' })
export class SupplierPaymentService {
  private apiUrl = `${environment.apiBase}/supplier-payments`;

  constructor(private http: HttpClient) {}

  async list(params?: Record<string, string>): Promise<SupplierPaymentPaginatedResponse> {
    let httpParams = new HttpParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value) httpParams = httpParams.set(key, value);
      });
    }
    return this.http.get<SupplierPaymentPaginatedResponse>(this.apiUrl, { params: httpParams }).toPromise() as any;
  }

  async getStats(): Promise<SupplierPaymentStats> {
    return this.http.get<SupplierPaymentStats>(`${this.apiUrl}/stats`).toPromise() as any;
  }

  async getOne(id: string): Promise<SupplierPaymentItem> {
    return this.http.get<SupplierPaymentItem>(`${this.apiUrl}/${id}`).toPromise() as any;
  }

  async create(data: any): Promise<SupplierPaymentItem> {
    return this.http.post<SupplierPaymentItem>(this.apiUrl, data).toPromise() as any;
  }

  async update(id: string, data: any): Promise<SupplierPaymentItem> {
    return this.http.patch<SupplierPaymentItem>(`${this.apiUrl}/${id}`, data).toPromise() as any;
  }

  async delete(id: string): Promise<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`).toPromise() as any;
  }

  async approve(id: string): Promise<SupplierPaymentItem> {
    return this.http.post<SupplierPaymentItem>(`${this.apiUrl}/${id}/approve`, {}).toPromise() as any;
  }

  async reject(id: string, reason: string): Promise<SupplierPaymentItem> {
    return this.http.post<SupplierPaymentItem>(`${this.apiUrl}/${id}/reject`, { reason }).toPromise() as any;
  }

  async markPaid(id: string, data: { paymentMethod: string; paidAt?: string; notes?: string }): Promise<SupplierPaymentItem> {
    return this.http.post<SupplierPaymentItem>(`${this.apiUrl}/${id}/mark-paid`, data).toPromise() as any;
  }
}
