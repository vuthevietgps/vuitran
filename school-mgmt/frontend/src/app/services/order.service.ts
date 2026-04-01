import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

export interface OrderItem {
  productId: string;
  productName?: string;
  sessions: number;
  invoiceSessions?: number;
  sessionDuration: number;
  baseDuration?: number;
  pricePerSession: number;
  amount: number;
  bonusSessions?: number;
  trialSessions?: number;
  courseStatus?: string;
  teachingMode?: string;
  preferredSchedule?: string;
  selectedClassId?: string;
  preferredTeacherId?: string;
  paymentRound?: number;
  teacherPayPerSession?: number;
  teacherPayPerStudent?: number;
  subject?: string;
  learningGoals?: string;
  maxStudents?: number;
  invoiceDescription?: string;
  invoiceNumber?: string;
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
  parentUserCode?: string;
  parentAddress?: string;
  parentFacebookLink?: string;
  studentName: string;
  studentCode?: string;
  studentDob?: string;
  studentGrade?: string;
  studentLevel?: string;
  studentAge?: number;
  studentBirthMonth?: number;
  parentBirthMonth?: number;
  studentFaceImage?: string;
  existingStudentId?: string;
  items: OrderItem[];
  totalAmount: number;
  discountAmount?: number;
  discountReason?: string;
  finalAmount: number;
  paymentPlan?: string;
  paymentDate?: string;
  receiptImage?: string;
  saleId: string;
  saleName?: string;
  saleCommission?: number;
  leadSource?: string;
  leadId?: string;
  adGroupId?: string;
  adGroupName?: string;
  referredByUserId?: string;
  consultationNotes?: string;
  processedResults?: OrderProcessedResults;
  approvedBy?: string;
  approvedAt?: string;
  approvalImage?: string;
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

  private normalizeErrorMessage(error: any, fallback: string): string {
    const payload = error?.error;
    const rawMessage = payload?.message;

    if (typeof rawMessage === 'string' && rawMessage.trim()) {
      return rawMessage;
    }

    if (Array.isArray(rawMessage)) {
      return rawMessage.map((item) => String(item)).join('\n');
    }

    if (rawMessage && typeof rawMessage === 'object') {
      const nestedMessage = (rawMessage as any).message;
      if (typeof nestedMessage === 'string' && nestedMessage.trim()) {
        return nestedMessage;
      }
      if (Array.isArray(nestedMessage)) {
        return nestedMessage.map((item) => String(item)).join('\n');
      }

      const nestedError = (rawMessage as any).error;
      if (typeof nestedError === 'string' && nestedError.trim()) {
        return nestedError;
      }
    }

    const payloadError = payload?.error;
    if (typeof payloadError === 'string' && payloadError.trim()) {
      return payloadError;
    }

    return fallback;
  }

  async list(params?: Record<string, string>): Promise<OrderData[]> {
    try {
      return await firstValueFrom(
        this.http.get<OrderData[]>(this.base, { withCredentials: true, params }),
      );
    } catch {
      return [];
    }
  }

  async getOne(id: string): Promise<OrderData | null> {
    try {
      return await firstValueFrom(
        this.http.get<OrderData>(`${this.base}/${id}`, { withCredentials: true }),
      );
    } catch {
      return null;
    }
  }

  async create(payload: any): Promise<{ ok: boolean; message?: string; data?: OrderData }> {
    try {
      const data = await firstValueFrom(
        this.http.post<OrderData>(this.base, payload, { withCredentials: true }),
      );
      return { ok: true, data };
    } catch (e: any) {
      return { ok: false, message: this.normalizeErrorMessage(e, 'Lỗi tạo đơn') };
    }
  }

  async update(id: string, payload: any): Promise<{ ok: boolean; message?: string }> {
    try {
      await firstValueFrom(
        this.http.patch(`${this.base}/${id}`, payload, { withCredentials: true }),
      );
      return { ok: true };
    } catch (e: any) {
      return { ok: false, message: this.normalizeErrorMessage(e, 'Lỗi cập nhật') };
    }
  }

  async submit(id: string): Promise<{ ok: boolean; message?: string }> {
    try {
      await firstValueFrom(
        this.http.post(`${this.base}/${id}/submit`, {}, { withCredentials: true }),
      );
      return { ok: true };
    } catch (e: any) {
      return { ok: false, message: this.normalizeErrorMessage(e, 'Lỗi gửi duyệt') };
    }
  }

  async approve(id: string, approvalImage?: string): Promise<{ ok: boolean; message?: string; data?: ApproveResponse }> {
    try {
      const data = await firstValueFrom(
        this.http.post<ApproveResponse>(`${this.base}/${id}/approve`, { ...(approvalImage ? { approvalImage } : {}) }, { withCredentials: true }),
      );
      return { ok: true, data };
    } catch (e: any) {
      return { ok: false, message: this.normalizeErrorMessage(e, 'Lỗi duyệt') };
    }
  }

  async reject(id: string, reason: string): Promise<{ ok: boolean; message?: string }> {
    try {
      await firstValueFrom(
        this.http.post(`${this.base}/${id}/reject`, { reason }, { withCredentials: true }),
      );
      return { ok: true };
    } catch (e: any) {
      return { ok: false, message: this.normalizeErrorMessage(e, 'Lỗi từ chối') };
    }
  }

  async requestInfo(id: string, reason: string): Promise<{ ok: boolean; message?: string }> {
    try {
      await firstValueFrom(
        this.http.post(`${this.base}/${id}/request-info`, { reason }, { withCredentials: true }),
      );
      return { ok: true };
    } catch (e: any) {
      return { ok: false, message: this.normalizeErrorMessage(e, 'Lỗi') };
    }
  }

  async cancel(id: string): Promise<{ ok: boolean; message?: string }> {
    try {
      await firstValueFrom(
        this.http.post(`${this.base}/${id}/cancel`, {}, { withCredentials: true }),
      );
      return { ok: true };
    } catch (e: any) {
      return { ok: false, message: this.normalizeErrorMessage(e, 'Lỗi hủy') };
    }
  }

  async remove(id: string): Promise<{ ok: boolean; message?: string }> {
    try {
      await firstValueFrom(
        this.http.delete(`${this.base}/${id}`, { withCredentials: true }),
      );
      return { ok: true };
    } catch (e: any) {
      return { ok: false, message: this.normalizeErrorMessage(e, 'Lỗi xóa') };
    }
  }

  async getPipeline(): Promise<OrderPipeline | null> {
    try {
      return await firstValueFrom(
        this.http.get<OrderPipeline>(`${this.base}/pipeline`, { withCredentials: true }),
      );
    } catch {
      return null;
    }
  }

  async getStats(): Promise<OrderStats | null> {
    try {
      return await firstValueFrom(
        this.http.get<OrderStats>(`${this.base}/stats`, { withCredentials: true }),
      );
    } catch {
      return null;
    }
  }
}
