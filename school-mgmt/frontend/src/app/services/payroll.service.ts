import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

// ── Interfaces ──────────────────────────────────────────────────────

export interface PayrollPreviewSummary {
  totalSessions: number;
  totalAttended: number;
  eligibleForPayroll: number;
  missingReport: number;
  pendingParentConfirm: number;
  pendingFinalize: number;
  finalizedNoReport: number;
  heldCount?: number;
  alreadyPaid: number;
  cancelled: number;
  noShow: number;
}

export interface PayrollPreviewAmounts {
  totalEligiblePayout: number;
  totalAlreadyPaid: number;
  totalBlockedByReport: number;
  totalPendingConfirm: number;
  totalPendingFinalize: number;
  totalHeldPayout?: number;
  totalAttendedPayout: number;
  totalOfflineMinGuaranteeAmount?: number;
}

export interface PayrollPreviewSession {
  _id: string;
  classId?: {
    _id: string;
    name: string;
    code: string;
    classMode?: string;
    teacherPayPerStudent?: number;
  };
  classMode?: string;
  studentId?: { _id: string; fullName: string; studentCode?: string };
  scheduledDate: string;
  durationMinutes: number;
  teacherPayout: number;
  offlineBasePayout?: number;
  offlineMinGuaranteeAmount?: number;
  offlineMinGuaranteeFloor?: number;
  offlineMinGuaranteeApplied?: boolean;
  penaltyAmount?: number;
  finalPayout?: number;
  isLateReport?: boolean;
  lateHours?: number;
  status: string;
  hasTeachingReport: boolean;
  isTeacherPaid: boolean;
  isPaid: boolean;
  confirmation?: {
    teacherCompletedAt?: string;
    parentConfirmedAt?: string;
    autoConfirmedAt?: string;
    finalizedAt?: string;
  };
  teachingReport?: {
    lessonContent?: string;
    submittedAt?: string;
    isLateSubmission?: boolean;
  } | null;
  holdReason?: string;
  holdDescription?: string;
  payrollStatus:
    | 'PAID'
    | 'ELIGIBLE'
    | 'BLOCKED_NO_REPORT'
    | 'WAITING_PARENT'
    | 'WAITING_FINALIZE'
    | 'HELD'
    | 'CANCELLED'
    | 'NO_SHOW'
    | 'OTHER';
}

export interface PayrollPreview {
  teacherId: string;
  periodStart: string;
  periodEnd: string;
  summary: PayrollPreviewSummary;
  amounts: PayrollPreviewAmounts;
  sessions: PayrollPreviewSession[];
  existingPayrolls: PayrollItem[];
}

export interface PayrollItem {
  _id: string;
  teacherId?: { _id: string; fullName: string; email?: string; phone?: string };
  periodStart: string;
  periodEnd: string;
  payrollCode: string;
  totalSessions: number;
  grossAmount: number;
  adjustmentAmount: number;
  bonusAmount: number;
  deductionAmount: number;
  netAmount: number;
  status: string;
  createdBy?: { _id: string; fullName: string };
  approvedBy?: { _id: string; fullName: string };
  approvedAt?: string;
  rejectionReason?: string;
  paidAt?: string;
  paidBy?: { _id: string; fullName: string };
  paymentRef?: string;
  notes?: string;
  createdAt?: string;
}

export interface PayrollItemDetail {
  _id: string;
  payrollId: string;
  sessionId?: { _id: string; scheduledDate: string; status: string };
  classId?: { _id: string; name: string; code: string };
  studentId?: { _id: string; fullName: string; studentCode?: string };
  sessionDate: string;
  teacherPayout: number;
  adjustedPayout: number;
  adjustmentReason?: string;
  status: string;
}

export interface PayrollQueryParams {
  teacherId?: string;
  status?: string;
  fromDate?: string;
  toDate?: string;
  page?: number;
  limit?: number;
}

@Injectable({ providedIn: 'root' })
export class PayrollService {
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

  // ── Preview ─────────────────────────────────────────────────────

  async getTeacherPreview(teacherId: string, periodStart: string, periodEnd: string): Promise<PayrollPreview | null> {
    try {
      const res = await firstValueFrom(
        this.http.get<PayrollPreview>(`${environment.apiBase}/payroll/teacher-preview`, {
          params: this.buildParams({ teacherId, periodStart, periodEnd }),
          withCredentials: true,
        }),
      );
      return res;
    } catch {
      return null;
    }
  }

  // ── CRUD ────────────────────────────────────────────────────────

  async list(params: PayrollQueryParams = {}): Promise<{ data: PayrollItem[]; meta: any }> {
    try {
      const res = await firstValueFrom(
        this.http.get<{ data: PayrollItem[]; meta: any }>(`${environment.apiBase}/payroll`, {
          params: this.buildParams(params),
          withCredentials: true,
        }),
      );
      return res;
    } catch {
      return { data: [], meta: {} };
    }
  }

  async getMyPayrolls(params: PayrollQueryParams = {}): Promise<{ data: PayrollItem[]; meta: any }> {
    try {
      const res = await firstValueFrom(
        this.http.get<{ data: PayrollItem[]; meta: any }>(`${environment.apiBase}/payroll/my-payroll`, {
          params: this.buildParams(params),
          withCredentials: true,
        }),
      );
      return res;
    } catch {
      return { data: [], meta: {} };
    }
  }

  async getById(id: string): Promise<PayrollItem | null> {
    try {
      const res = await firstValueFrom(
        this.http.get<PayrollItem>(`${environment.apiBase}/payroll/${id}`, { withCredentials: true }),
      );
      return res;
    } catch {
      return null;
    }
  }

  async getItems(payrollId: string): Promise<PayrollItemDetail[]> {
    try {
      const res = await firstValueFrom(
        this.http.get<PayrollItemDetail[]>(`${environment.apiBase}/payroll/${payrollId}/items`, {
          withCredentials: true,
        }),
      );
      return res;
    } catch {
      return [];
    }
  }

  async getSummary(): Promise<any[]> {
    try {
      const res = await firstValueFrom(
        this.http.get<any[]>(`${environment.apiBase}/payroll/summary`, { withCredentials: true }),
      );
      return res;
    } catch {
      return [];
    }
  }

  // ── Generate ────────────────────────────────────────────────────

  async generate(payload: { teacherId: string; periodStart: string; periodEnd: string; bonusAmount?: number; deductionAmount?: number; notes?: string }): Promise<{ ok: boolean; data?: any; error?: string }> {
    try {
      const data = await firstValueFrom(
        this.http.post(`${environment.apiBase}/payroll`, payload, { withCredentials: true }),
      );
      return { ok: true, data };
    } catch (error: any) {
      return { ok: false, error: error?.error?.message || 'Lỗi tạo bảng lương' };
    }
  }

  async bulkGenerate(periodStart: string, periodEnd: string): Promise<{ ok: boolean; data?: any; error?: string }> {
    try {
      const data = await firstValueFrom(
        this.http.post(`${environment.apiBase}/payroll/bulk-generate`, { periodStart, periodEnd }, {
          withCredentials: true,
        }),
      );
      return { ok: true, data };
    } catch (error: any) {
      return { ok: false, error: error?.error?.message || 'Lỗi tạo hàng loạt' };
    }
  }

  // ── Update ──────────────────────────────────────────────────────

  async update(id: string, payload: { bonusAmount?: number; deductionAmount?: number; notes?: string }): Promise<boolean> {
    await firstValueFrom(
      this.http.patch(`${environment.apiBase}/payroll/${id}`, payload, { withCredentials: true }),
    );
    return true;
  }

  async adjustItem(payrollId: string, itemId: string, payload: { adjustedPayout: number; adjustmentReason?: string; status?: string }): Promise<boolean> {
    await firstValueFrom(
      this.http.patch(`${environment.apiBase}/payroll/${payrollId}/items/${itemId}`, payload, {
        withCredentials: true,
      }),
    );
    return true;
  }

  // ── Workflow ────────────────────────────────────────────────────

  async submitForReview(id: string): Promise<boolean> {
    await firstValueFrom(
      this.http.post(`${environment.apiBase}/payroll/${id}/submit`, {}, { withCredentials: true }),
    );
    return true;
  }

  async approve(id: string): Promise<boolean> {
    await firstValueFrom(
      this.http.post(`${environment.apiBase}/payroll/${id}/approve`, {}, { withCredentials: true }),
    );
    return true;
  }

  async reject(id: string, reason: string): Promise<boolean> {
    await firstValueFrom(
      this.http.post(`${environment.apiBase}/payroll/${id}/reject`, { reason }, { withCredentials: true }),
    );
    return true;
  }

  async reopen(id: string): Promise<boolean> {
    await firstValueFrom(
      this.http.post(`${environment.apiBase}/payroll/${id}/reopen`, {}, { withCredentials: true }),
    );
    return true;
  }

  async markPaid(id: string, paymentRef?: string): Promise<boolean> {
    await firstValueFrom(
      this.http.post(`${environment.apiBase}/payroll/${id}/mark-paid`, { paymentRef }, { withCredentials: true }),
    );
    return true;
  }

  async remove(id: string): Promise<boolean> {
    await firstValueFrom(
      this.http.delete(`${environment.apiBase}/payroll/${id}`, { withCredentials: true }),
    );
    return true;
  }
}
