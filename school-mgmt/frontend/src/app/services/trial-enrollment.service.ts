import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

export type TrialEnrollmentStatus = 'PENDING_TRIAL' | 'WAITING_DECISION' | 'CONVERTED' | 'REJECTED';

export interface TrialEnrollmentListParams {
  keyword?: string;
  status?: string;
  classId?: string;
  productId?: string;
  saleId?: string;
}

export interface TrialEnrollmentRef {
  _id: string;
  name?: string;
  fullName?: string;
  code?: string;
  email?: string;
  phone?: string;
  studentCode?: string;
  classMode?: string;
  teachingMode?: string;
}

export interface TrialEnrollmentItem {
  _id: string;
  trialCode?: string;
  status: TrialEnrollmentStatus | string;
  teacherPaidOnlyDecision?: boolean;
  studentName: string;
  studentPhone?: string;
  parentName?: string;
  parentPhone?: string;
  parentEmail?: string;
  classId?: TrialEnrollmentRef | string | null;
  productId?: TrialEnrollmentRef | string | null;
  saleId?: TrialEnrollmentRef | string | null;
  studentId?: TrialEnrollmentRef | string | null;
  orderId?: TrialEnrollmentRef | string | null;
  invoiceId?: TrialEnrollmentRef | string | null;
  maxTrialSessions?: number;
  trialSessionsUsed?: number;
  notes?: string;
  decisionNotes?: string;
  decisionAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface TrialEnrollmentPayload {
  studentName: string;
  studentPhone?: string;
  parentName: string;
  parentPhone: string;
  parentEmail?: string;
  classId: string;
  productId: string;
  saleId?: string;
  status?: TrialEnrollmentStatus;
  maxTrialSessions?: number;
  trialSessionsUsed?: number;
  notes?: string;
  invoiceId?: string;
  orderId?: string;
}

export interface TrialEnrollmentMutationResult {
  ok: boolean;
  message?: string;
  data?: TrialEnrollmentItem;
}

@Injectable({ providedIn: 'root' })
export class TrialEnrollmentService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBase}/trial-enrollments`;

  async list(params?: TrialEnrollmentListParams): Promise<TrialEnrollmentItem[]> {
    try {
      const query: Record<string, string> = {};
      if (params?.keyword) query['search'] = params.keyword;
      if (params?.status) query['status'] = params.status;
      if (params?.classId) query['classId'] = params.classId;
      if (params?.productId) query['productId'] = params.productId;
      if (params?.saleId) query['saleId'] = params.saleId;

      return await firstValueFrom(
        this.http.get<TrialEnrollmentItem[]>(this.base, {
          withCredentials: true,
          params: query,
        }),
      );
    } catch {
      return [];
    }
  }

  async create(payload: TrialEnrollmentPayload): Promise<TrialEnrollmentMutationResult> {
    try {
      const response = await firstValueFrom(
        this.http.post<TrialEnrollmentItem>(this.base, payload, {
          withCredentials: true,
        }),
      );
      return { ok: true, data: response };
    } catch (error: any) {
      return { ok: false, message: this.normalizeMessage(error, 'Khong the tao hoc thu') };
    }
  }

  async update(id: string, payload: Partial<TrialEnrollmentPayload>): Promise<TrialEnrollmentMutationResult> {
    try {
      const response = await firstValueFrom(
        this.http.patch<TrialEnrollmentItem>(`${this.base}/${id}`, payload, {
          withCredentials: true,
        }),
      );
      return { ok: true, data: response };
    } catch (error: any) {
      return { ok: false, message: this.normalizeMessage(error, 'Khong the cap nhat hoc thu') };
    }
  }

  async updateStatus(
    id: string,
    status: TrialEnrollmentStatus,
    payload: { decisionNotes?: string; notes?: string } = {},
  ): Promise<TrialEnrollmentMutationResult> {
    return this.update(id, { status, ...payload });
  }

  async markWaitingDecision(id: string, notes?: string): Promise<TrialEnrollmentMutationResult> {
    return this.updateStatus(id, 'WAITING_DECISION', notes ? { notes } : {});
  }

  async convert(id: string, decisionNotes?: string): Promise<TrialEnrollmentMutationResult> {
    try {
      const response = await firstValueFrom(
        this.http.post<TrialEnrollmentItem>(
          `${this.base}/${id}/convert`,
          decisionNotes ? { notes: decisionNotes, decisionNotes } : {},
          { withCredentials: true },
        ),
      );
      return { ok: true, data: response };
    } catch (error: any) {
      return { ok: false, message: this.normalizeMessage(error, 'Khong the chuyen doi hoc thu') };
    }
  }

  async reject(id: string, decisionNotes?: string): Promise<TrialEnrollmentMutationResult> {
    try {
      const response = await firstValueFrom(
        this.http.post<TrialEnrollmentItem>(
          `${this.base}/${id}/reject`,
          decisionNotes ? { notes: decisionNotes, decisionNotes } : {},
          { withCredentials: true },
        ),
      );
      return { ok: true, data: response };
    } catch (error: any) {
      return { ok: false, message: this.normalizeMessage(error, 'Khong the tu choi hoc thu') };
    }
  }

  async teacherPaidOnly(id: string, decisionNotes?: string): Promise<TrialEnrollmentMutationResult> {
    try {
      const response = await firstValueFrom(
        this.http.post<TrialEnrollmentItem>(
          `${this.base}/${id}/teacher-paid-only`,
          decisionNotes ? { notes: decisionNotes, decisionNotes } : {},
          { withCredentials: true },
        ),
      );
      return { ok: true, data: response };
    } catch (error: any) {
      return {
        ok: false,
        message: this.normalizeMessage(error, 'Khong the chot tra luong giao vien'),
      };
    }
  }

  private normalizeMessage(error: any, fallback: string): string {
    const raw = error?.error?.message;
    if (typeof raw === 'string' && raw.trim()) return raw;
    if (Array.isArray(raw) && raw.length) return raw.join(', ');
    return fallback;
  }
}
