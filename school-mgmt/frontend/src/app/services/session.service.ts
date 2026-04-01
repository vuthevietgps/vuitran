import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

export interface SessionItem {
  _id: string;
  classId: { _id: string; name: string; code: string };
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
  topicsCovered?: string;
  homework?: string;
  teacherNotes?: string;
  parentNotes?: string;
  parentRating?: number;
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
    refundAmount?: number;
  };
  teachingReport?: {
    lessonContent?: string;
    studentAttitude?: string;
    recordingUrl?: string;
    teacherComment?: string;
    homework?: string;
    additionalNotes?: string;
    submittedAt?: string;
    deadline?: string;
    isLateSubmission?: boolean;
  };
  hasTeachingReport?: boolean;
  createdAt?: string;
  editHistory?: SessionEditHistoryEntry[];
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
  requestedTeacherId?: { _id?: string; fullName?: string; email?: string };
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
  requestedTeacherId?: string;
  requestedDurationMinutes?: number;
  reason: string;
}

export interface ReviewSessionChangeRequestPayload {
  action: 'APPROVE' | 'REJECT';
  rejectionReason?: string;
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

@Injectable({ providedIn: 'root' })
export class SessionService {
  private http = inject(HttpClient);

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

  async finalize(id: string): Promise<boolean> {
    try {
      await firstValueFrom(
        this.http.post(`${environment.apiBase}/sessions/${id}/finalize`, {}, { withCredentials: true }),
      );
      return true;
    } catch {
      return false;
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
