import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

export interface OrderItem {
  productId: string;
  productName?: string;
  sessions: number;
  sessionDuration: number;
  pricePerSession: number;
  amount: number;
  teachingMode?: string;
  preferredSchedule?: string;
  preferredTeacherId?: string;
  notes?: string;
}

export interface OrderCommunicationSummary {
  saleMessage?: string;
  parentMessage?: string;
  teacherMessage?: string;
  parentRecipientId?: string;
  teacherRecipientIds?: string[];
  generatedAt?: string;
}

export interface OrderProcessedResults {
  studentId?: string;
  invoiceIds?: string[];
  classIds?: string[];
  communicationSummary?: OrderCommunicationSummary;
}

export interface OrderData {
  _id: string;
  orderCode: string;
  orderType: string;
  status: string;
  parentName: string;
  parentPhone: string;
  parentEmail?: string;
  parentUserId?: string;
  studentName: string;
  studentDob?: string;
  studentGrade?: string;
  existingStudentId?: string;
  items: OrderItem[];
  totalAmount: number;
  discountAmount?: number;
  discountReason?: string;
  finalAmount: number;
  paymentPlan?: string;
  saleId: string;
  saleName?: string;
  saleCommission?: number;
  leadSource?: string;
  leadId?: string;
  consultationNotes?: string;
  processedResults?: any;
  approvedBy?: string;
  approvedAt?: string;
  rejectionReason?: string;
  needsInfoReason?: string;
  createdAt?: string;
}

export interface EnrollmentResult {
  success: boolean;
  studentId?: string;
  studentCode?: string;
  invoiceIds?: string[];
  classIds?: string[];
  errors?: string[];
}

export interface ApproveResponse {
  order: OrderData;
  enrollment: EnrollmentResult;
}

export interface OrderPipeline {
  [status: string]: { count: number; totalValue: number };
}

export interface OrderStats {
  total: number;
  approved: number;
  conversionRate: number;
  totalRevenue: number;
  totalCommission: number;
  thisMonth: { count: number; revenue: number };
  bySale: { saleId: string; saleName: string; total: number; approved: number; conversionRate: number; revenue: number }[];
  byType: { _id: string; count: number }[];
  bySource: { _id: string; count: number }[];
  pendingOrders: number;
  pendingValue: number;
}

@Injectable({ providedIn: 'root' })
export class OrderService {
  private http = inject(HttpClient);
  private base = `${environment.apiBase}/orders`;

  async list(params?: Record<string, string>): Promise<OrderData[]> {
    try {
      return await firstValueFrom(
        this.http.get<OrderData[]>(this.base, { withCredentials: true, params }),
      );
    } catch { return []; }
  }

  async getOne(id: string): Promise<OrderData | null> {
    try {
      return await firstValueFrom(
        this.http.get<OrderData>(`${this.base}/${id}`, { withCredentials: true }),
      );
    } catch { return null; }
  }

  async create(payload: any): Promise<{ ok: boolean; message?: string; data?: OrderData }> {
    try {
      const data = await firstValueFrom(
        this.http.post<OrderData>(this.base, payload, { withCredentials: true }),
      );
      return { ok: true, data };
    } catch (e: any) {
      return { ok: false, message: e?.error?.message || 'Lỗi tạo đơn' };
    }
  }

  async update(id: string, payload: any): Promise<{ ok: boolean; message?: string }> {
    try {
      await firstValueFrom(
        this.http.patch(`${this.base}/${id}`, payload, { withCredentials: true }),
      );
      return { ok: true };
    } catch (e: any) {
      return { ok: false, message: e?.error?.message || 'Lỗi cập nhật' };
    }
  }

  async submit(id: string): Promise<{ ok: boolean; message?: string }> {
    try {
      await firstValueFrom(
        this.http.post(`${this.base}/${id}/submit`, {}, { withCredentials: true }),
      );
      return { ok: true };
    } catch (e: any) {
      return { ok: false, message: e?.error?.message || 'Lỗi gửi duyệt' };
    }
  }

  async approve(id: string): Promise<{ ok: boolean; message?: string; data?: ApproveResponse }> {
    try {
      const data = await firstValueFrom(
        this.http.post<ApproveResponse>(`${this.base}/${id}/approve`, {}, { withCredentials: true }),
      );
      return { ok: true, data };
    } catch (e: any) {
      return { ok: false, message: e?.error?.message || 'Lỗi duyệt' };
    }
  }

  async reject(id: string, reason: string): Promise<{ ok: boolean; message?: string }> {
    try {
      await firstValueFrom(
        this.http.post(`${this.base}/${id}/reject`, { reason }, { withCredentials: true }),
      );
      return { ok: true };
    } catch (e: any) {
      return { ok: false, message: e?.error?.message || 'Lỗi từ chối' };
    }
  }

  async requestInfo(id: string, reason: string): Promise<{ ok: boolean; message?: string }> {
    try {
      await firstValueFrom(
        this.http.post(`${this.base}/${id}/request-info`, { reason }, { withCredentials: true }),
      );
      return { ok: true };
    } catch (e: any) {
      return { ok: false, message: e?.error?.message || 'Lỗi' };
    }
  }

  async cancel(id: string): Promise<{ ok: boolean; message?: string }> {
    try {
      await firstValueFrom(
        this.http.post(`${this.base}/${id}/cancel`, {}, { withCredentials: true }),
      );
      return { ok: true };
    } catch (e: any) {
      return { ok: false, message: e?.error?.message || 'Lỗi hủy' };
    }
  }

  async remove(id: string): Promise<{ ok: boolean; message?: string }> {
    try {
      await firstValueFrom(
        this.http.delete(`${this.base}/${id}`, { withCredentials: true }),
      );
      return { ok: true };
    } catch (e: any) {
      return { ok: false, message: e?.error?.message || 'Lỗi xóa' };
    }
  }

  async getPipeline(): Promise<OrderPipeline | null> {
    try {
      return await firstValueFrom(
        this.http.get<OrderPipeline>(`${this.base}/pipeline`, { withCredentials: true }),
      );
    } catch { return null; }
  }

  async getStats(): Promise<OrderStats | null> {
    try {
      return await firstValueFrom(
        this.http.get<OrderStats>(`${this.base}/stats`, { withCredentials: true }),
      );
    } catch { return null; }
  }
}
