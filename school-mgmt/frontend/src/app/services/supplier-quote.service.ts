import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../environments/environment';

export interface QuoteItem {
  itemName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
  notes?: string;
}

export interface SupplierQuoteItem {
  _id: string;
  quoteCode: string;
  supplierName: string;
  supplierPhone?: string;
  supplierEmail?: string;
  supplierAddress?: string;
  title: string;
  description?: string;
  items: QuoteItem[];
  totalAmount: number;
  status: string;
  quoteDate: string;
  validUntil?: string;
  createdById: string;
  createdByName: string;
  approvedById?: string;
  approvedByName?: string;
  approvedAt?: string;
  rejectionReason?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SupplierQuotePaginatedResponse {
  data: SupplierQuoteItem[];
  total: number;
  page: number;
  limit: number;
}

@Injectable({ providedIn: 'root' })
export class SupplierQuoteService {
  private apiUrl = `${environment.apiBase}/supplier-quotes`;

  constructor(private http: HttpClient) {}

  async list(params?: Record<string, string>): Promise<SupplierQuotePaginatedResponse> {
    let httpParams = new HttpParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value) httpParams = httpParams.set(key, value);
      });
    }
    return this.http.get<SupplierQuotePaginatedResponse>(this.apiUrl, { params: httpParams }).toPromise() as any;
  }

  async getOne(id: string): Promise<SupplierQuoteItem> {
    return this.http.get<SupplierQuoteItem>(`${this.apiUrl}/${id}`).toPromise() as any;
  }

  async create(data: any): Promise<SupplierQuoteItem> {
    return this.http.post<SupplierQuoteItem>(this.apiUrl, data).toPromise() as any;
  }

  async update(id: string, data: any): Promise<SupplierQuoteItem> {
    return this.http.patch<SupplierQuoteItem>(`${this.apiUrl}/${id}`, data).toPromise() as any;
  }

  async delete(id: string): Promise<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`).toPromise() as any;
  }

  async accept(id: string): Promise<SupplierQuoteItem> {
    return this.http.post<SupplierQuoteItem>(`${this.apiUrl}/${id}/accept`, {}).toPromise() as any;
  }

  async reject(id: string, reason: string): Promise<SupplierQuoteItem> {
    return this.http.post<SupplierQuoteItem>(`${this.apiUrl}/${id}/reject`, { reason }).toPromise() as any;
  }

  async markSent(id: string): Promise<SupplierQuoteItem> {
    return this.http.post<SupplierQuoteItem>(`${this.apiUrl}/${id}/send`, {}).toPromise() as any;
  }
}
