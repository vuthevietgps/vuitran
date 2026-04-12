import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { ReportTemplateDynamicFieldDefinition } from './report-template.service';

export interface SessionItem {
  _id: string;
  classId: { _id: string; name: string; code: string; classMode?: 'ONLINE' | 'OFFLINE' };
  studentId: { _id: string; fullName: string; studentCode?: string };
  teacherId: { _id: string; fullName: string; email?: string };
  parentUserId?: { _id: string; fullName: string };
  scheduledDate: string;
  scheduledStartTime: string;
  scheduledEndTime: string;
  attendedAt?: string | null;
  attendanceStatus?: string | null;
  durationMinutes?: number;
  amountCharged: number;
  teacherPayout: number;
  status: string;
  isPaid: boolean;
  isTeacherPaid: boolean;
  walletDeductError?: string;
  walletDeductAlertSentAt?: string;
  topicsCovered?: string;
  homework?: string;
  teacherNotes?: string;
  parentNotes?: string;
  parentRating?: number;
  parentFeedback?: {
    overallRating?: number;
    teachingQualityRating?: number;
    communicationRating?: number;
    facilityRating?: number;
    parentNotes?: string;
  };
  confirmation?: {
    teacherCompletedAt?: string;
    parentConfirmedAt?: string;
    autoConfirmedAt?: string;
    finalizedAt?: string;
    finalizedBy?: string | { _id: string; fullName?: string } | null;
  };
  cancellation?: {
    cancelledBy?: string;
    cancelReason?: string;
    cancelledAt?: string;
    refundAmount?: number;
  };
  teachingReport?: {
    lessonContent?: string;
    studentAttitude?: string;
    recordingUrl?: string;
    teacherComment?: string;
    homework?: string;
    additionalNotes?: string;
    templateId?: string;
    templateTitle?: string;
    templateVersion?: number;
    dynamicFieldValues?: Record<string, string | number | boolean>;
    dynamicFieldSchemaSnapshot?: ReportTemplateDynamicFieldDefinition[];
    submittedAt?: string;
    deadline?: string;
    isLateSubmission?: boolean;
  };
  hasTeachingReport?: boolean;
  createdAt?: string;
  rescheduledFromId?: SessionReference | string | null;
  rescheduledToId?: SessionReference | string | null;
  editHistory?: SessionEditHistoryEntry[];
}

export interface SessionActionResult<T = unknown> {
  ok: boolean;
  data?: T | null;
  errorMessage?: string;
}

export interface SessionReference {
  _id?: string;
  scheduledDate?: string;
  scheduledStartTime?: string;
  scheduledEndTime?: string;
  status?: string;
}

export interface SessionChangeFinancialImpact {
  oldDurationMinutes: number;
  newDurationMinutes: number;
  oldAmountCharged: number;
  newAmountCharged: number;
  deltaAmountCharged: number;
  oldTeacherPayout: number;
  newTeacherPayout: number;
  deltaTeacherPayout: number;
  requestedTeacherDefaultRate?: number;
  note?: string;
}

export interface SessionChangeRequestItem {
  _id: string;
  sessionId?: any;
  classId?: { _id?: string; name?: string; code?: string };
  studentId?: { _id?: string; fullName?: string; studentCode?: string };
  parentUserId?: { _id?: string; fullName?: string; email?: string };
  currentTeacherId?: { _id?: string; fullName?: string; email?: string };
  currentScheduledDate?: string;
  currentStartTime?: string;
  currentEndTime?: string;
  requestedTeacherId?: { _id?: string; fullName?: string; email?: string };
  requestedScheduledDate?: string;
  requestedStartTime?: string;
  requestedEndTime?: string;
  currentDurationMinutes: number;
  requestedDurationMinutes?: number;
  reason: string;
  status: string;
  financialImpact: SessionChangeFinancialImpact;
  requestedBy?: { _id?: string; fullName?: string; email?: string; role?: string };
  requestedAt?: string;
  reviewedBy?: { _id?: string; fullName?: string; email?: string; role?: string };
  reviewedAt?: string;
  rejectionReason?: string;
  cancelledReason?: string;
}

export interface CreateSessionChangeRequestPayload {
  requestedScheduledDate?: string;
  requestedStartTime?: string;
  requestedEndTime?: string;
  requestedTeacherId?: string;
  requestedDurationMinutes?: number;
  reason: string;
}

export interface ReviewSessionChangeRequestPayload {
  action: 'APPROVE' | 'REJECT';
  rejectionReason?: string;
}

export interface RescheduleSessionPayload {
  newScheduledDate: string;
  newStartTime?: string;
  newEndTime?: string;
  durationMinutes?: number;
  reason?: string;
}

export interface RescheduleSessionResult {
  oldSession: SessionItem;
  newSession: SessionItem;
}

export interface SessionEditHistoryChange {
  field: string;
  label: string;
  beforeValue?: string;
  afterValue?: string;
}

export interface SessionDurationRemainingSnapshot {
  newDurationMinutes: number;
  paidRemainingMinutes?: number;
  bonusRemainingMinutes?: number;
  totalRemainingMinutes?: number;
  paidSessionsRemaining?: number;
  bonusSessionsRemaining?: number;
  totalSessionsRemaining?: number;
}

export interface SessionEditHistoryEntry {
  editedAt: string;
  editedByName?: string;
  editedByRole?: string;
  changes: SessionEditHistoryChange[];
  durationSnapshot?: SessionDurationRemainingSnapshot;
}

export interface SessionQueryParams {
  classId?: string;
  studentId?: string;
  teacherId?: string;
  status?: string;
  hasReport?: 'true' | 'false';
  fromDate?: string;
  toDate?: string;
  page?: number;
  limit?: number;
}

export interface SessionStats {
  totalSessions: number;
  totalRevenue: number;
  totalTeacherCost: number;
  byStatus: Record<string, { count: number; totalCharged: number; totalPayout: number }>;
}

export interface SessionParentConfirmPayload {
  rating?: number;
  parentNotes?: string;
  parentRating?: number;
  overallRating?: number;
  teachingQualityRating?: number;
  communicationRating?: number;
  concerns?: string;
  isSatisfied?: boolean;
}

export interface SessionGeneralFeedbackPayload {
  overallRating: number;
  teachingQuality: number;
  communication: number;
  facility: number;
  comment?: string;
  studentId?: string;
  sessionId?: string;
}

export interface SessionGeneralFeedbackResult {
  success: boolean;
  message: string;
}

export interface BulkTeachingReportPayload {
  classId: string;
  date: string;
  lessonContent: string;
  studentAttitude?: string;
  recordingUrl?: string;
  teacherComment?: string;
  homework?: string;
  additionalNotes?: string;
  templateId?: string;
  dynamicFieldValues?: Record<string, string | number | boolean>;
}

export interface BulkTeachingReportResult {
  updatedCount: number;
  skippedCount: number;
  results: Array<{
    sessionId: string;
    status: string;
    action: string;
  }>;
}

@Injectable({ providedIn: 'root' })
export class SessionService {
  private http = inject(HttpClient);

  private extractErrorMessage(error: any): string {
    const payload = error?.error;
    if (typeof payload === 'string' && payload.trim()) {
      return payload.trim();
    }

    if (Array.isArray(payload?.message)) {
      const message = payload.message.find((item: unknown) => typeof item === 'string' && item.trim());
      if (message) {
        return String(message).trim();
      }
    }

    if (typeof payload?.message === 'string' && payload.message.trim()) {
      return payload.message.trim();
    }

    if (typeof error?.message === 'string' && error.message.trim()) {
      return error.message.trim();
    }

    return 'Có lỗi xảy ra.';
  }

  async list(params: SessionQueryParams = {}): Promise<{ data: SessionItem[]; meta: any }> {
    const httpParams = this.buildParams(params);
    try {
      return await firstValueFrom(
        this.http.get<{ data: SessionItem[]; meta: any }>(`${environment.apiBase}/sessions`, {
          params: httpParams,
          withCredentials: true,
        }),
      );
    } catch {
      return { data: [], meta: {} };
    }
  }

  async create(payload: any): Promise<boolean> {
    try {
      await firstValueFrom(
        this.http.post(`${environment.apiBase}/sessions`, payload, { withCredentials: true }),
      );
      return true;
    } catch {
      return false;
    }
  }

  async bulkCreate(payload: any): Promise<boolean> {
    try {
      await firstValueFrom(
        this.http.post(`${environment.apiBase}/sessions/bulk`, payload, { withCredentials: true }),
      );
      return true;
    } catch {
      return false;
    }
  }

  async getById(id: string): Promise<SessionItem | null> {
    try {
      return await firstValueFrom(
        this.http.get<SessionItem>(`${environment.apiBase}/sessions/${id}`, {
          withCredentials: true,
        }),
      );
    } catch {
      return null;
    }
  }

  async teacherComplete(id: string, payload: any): Promise<boolean> {
    try {
      await firstValueFrom(
        this.http.post(`${environment.apiBase}/sessions/${id}/complete`, payload, {
          withCredentials: true,
        }),
      );
      return true;
    } catch {
      return false;
    }
  }

  async parentConfirm(id: string, payload: SessionParentConfirmPayload): Promise<boolean> {
    const normalizedPayload: SessionParentConfirmPayload = { ...payload };
    if (normalizedPayload.rating !== undefined) {
      if (normalizedPayload.parentRating === undefined) {
        normalizedPayload.parentRating = normalizedPayload.rating;
      }
      if (normalizedPayload.overallRating === undefined) {
        normalizedPayload.overallRating = normalizedPayload.rating;
      }
      delete normalizedPayload.rating;
    }
    try {
      await firstValueFrom(
        this.http.post(`${environment.apiBase}/sessions/${id}/confirm`, normalizedPayload, {
          withCredentials: true,
        }),
      );
      return true;
    } catch {
      return false;
    }
  }

  async finalize(id: string): Promise<SessionActionResult<SessionItem>> {
    try {
      const data = await firstValueFrom(
        this.http.post<SessionItem>(`${environment.apiBase}/sessions/${id}/finalize`, {}, { withCredentials: true }),
      );
      return {
        ok: true,
        data: data ?? null,
      };
    } catch (error) {
      return {
        ok: false,
        errorMessage: this.extractErrorMessage(error),
      };
    }
  }

  async cancel(id: string, reason: string): Promise<boolean> {
    try {
      await firstValueFrom(
        this.http.post(
          `${environment.apiBase}/sessions/${id}/cancel`,
          { cancelReason: reason },
          { withCredentials: true },
        ),
      );
      return true;
    } catch {
      return false;
    }
  }

  async reschedule(
    id: string,
    payload: RescheduleSessionPayload,
  ): Promise<SessionActionResult<RescheduleSessionResult>> {
    try {
      const data = await firstValueFrom(
        this.http.post<RescheduleSessionResult>(
          `${environment.apiBase}/sessions/${id}/reschedule`,
          payload,
          { withCredentials: true },
        ),
      );
      return {
        ok: true,
        data: data ?? null,
      };
    } catch (error) {
      return {
        ok: false,
        errorMessage: this.extractErrorMessage(error),
      };
    }
  }

  async getStats(params: { teacherId?: string; classId?: string; fromDate?: string; toDate?: string } = {}): Promise<SessionStats> {
    const httpParams = this.buildParams(params);
    try {
      return await firstValueFrom(
        this.http.get<SessionStats>(`${environment.apiBase}/sessions/stats`, {
          params: httpParams,
          withCredentials: true,
        }),
      );
    } catch {
      return { totalSessions: 0, totalRevenue: 0, totalTeacherCost: 0, byStatus: {} };
    }
  }

  async remove(id: string): Promise<boolean> {
    try {
      await firstValueFrom(
        this.http.delete(`${environment.apiBase}/sessions/${id}`, { withCredentials: true }),
      );
      return true;
    } catch {
      return false;
    }
  }

  async submitTeachingReport(id: string, payload: any): Promise<void> {
    await firstValueFrom(
      this.http.patch(`${environment.apiBase}/sessions/${id}/teaching-report`, payload, {
        withCredentials: true,
      }),
    );
  }

  async bulkSubmitTeachingReport(payload: BulkTeachingReportPayload): Promise<BulkTeachingReportResult> {
    return firstValueFrom(
      this.http.patch<BulkTeachingReportResult>(
        `${environment.apiBase}/sessions/bulk-teaching-report`,
        payload,
        {
          withCredentials: true,
        },
      ),
    );
  }

  async submitGeneralFeedback(
    payload: SessionGeneralFeedbackPayload,
  ): Promise<SessionActionResult<SessionGeneralFeedbackResult>> {
    try {
      const data = await firstValueFrom(
        this.http.post<SessionGeneralFeedbackResult>(
          `${environment.apiBase}/sessions/general-feedback`,
          payload,
          {
            withCredentials: true,
          },
        ),
      );
      return {
        ok: true,
        data: data ?? null,
      };
    } catch (error) {
      return {
        ok: false,
        errorMessage: this.extractErrorMessage(error),
      };
    }
  }

  async getChangeRequests(sessionId: string): Promise<SessionChangeRequestItem[]> {
    try {
      return await firstValueFrom(
        this.http.get<SessionChangeRequestItem[]>(
          `${environment.apiBase}/sessions/${sessionId}/change-requests`,
          { withCredentials: true },
        ),
      );
    } catch {
      return [];
    }
  }

  async createChangeRequest(
    sessionId: string,
    payload: CreateSessionChangeRequestPayload,
  ): Promise<SessionChangeRequestItem> {
    return firstValueFrom(
      this.http.post<SessionChangeRequestItem>(
        `${environment.apiBase}/sessions/${sessionId}/change-requests`,
        payload,
        { withCredentials: true },
      ),
    );
  }

  async reviewChangeRequest(
    requestId: string,
    payload: ReviewSessionChangeRequestPayload,
  ): Promise<SessionChangeRequestItem> {
    return firstValueFrom(
      this.http.post<SessionChangeRequestItem>(
        `${environment.apiBase}/sessions/change-requests/${requestId}/review`,
        payload,
        { withCredentials: true },
      ),
    );
  }

  async getSessionsPendingReport(params: SessionQueryParams = {}): Promise<{ data: SessionItem[]; meta: any }> {
    const httpParams = this.buildParams(params);
    try {
      return await firstValueFrom(
        this.http.get<{ data: SessionItem[]; meta: any }>(
          `${environment.apiBase}/sessions/my-sessions/pending-report`,
          { params: httpParams, withCredentials: true },
        ),
      );
    } catch {
      return { data: [], meta: {} };
    }
  }

  async getSessionsCompletedReport(params: SessionQueryParams = {}): Promise<{ data: SessionItem[]; meta: any }> {
    const httpParams = this.buildParams(params);
    try {
      return await firstValueFrom(
        this.http.get<{ data: SessionItem[]; meta: any }>(
          `${environment.apiBase}/sessions/my-sessions/completed-report`,
          { params: httpParams, withCredentials: true },
        ),
      );
    } catch {
      return { data: [], meta: {} };
    }
  }

  private buildParams(params: Record<string, any>): HttpParams {
    let httpParams = new HttpParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') {
        httpParams = httpParams.set(k, String(v));
      }
    });
    return httpParams;
  }
}
