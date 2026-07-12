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
  experienceTeacherId?: string;
  page?: number;
  limit?: number;
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
  experienceTeacherId?: TrialEnrollmentRef | string | null;
  testDate?: string;
  testStartTime?: string;
  testEndTime?: string;
  studentId?: TrialEnrollmentRef | string | null;
  orderId?: TrialEnrollmentRef | string | null;
  invoiceId?: TrialEnrollmentRef | string | null;
  maxTrialSessions?: number;
  trialSessionsUsed?: number;
  notes?: string;
  assessmentScore?: number;
  recommendedLevel?: string;
  assessmentNotes?: string;
  zoomMeetingUrl?: string;
  zoomRecordingUrl?: string;
  resultImageUrls?: string[];
  listeningScore?: number;
  speakingScore?: number;
  readingScore?: number;
  writingScore?: number;
  pronunciationScore?: number;
  grammarScore?: number;
  vocabularyScore?: number;
  reflexScore?: number;
  confidenceScore?: number;
  focusScore?: number;
  testDurationMinutes?: number;
  learningGaps?: string;
  strengthsObserved?: string;
  improvementAreas?: string;
  recommendedRoadmap?: string;
  suggestedPackage?: string;
  suggestedSchedule?: string;
  salesAdvice?: string;
  closingPotential?: string;
  technicalNotes?: string;
  assessmentUpdatedAt?: string;
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
  experienceTeacherId?: string;
  testDate?: string;
  testStartTime?: string;
  testEndTime?: string;
  status?: TrialEnrollmentStatus;
  maxTrialSessions?: number;
  trialSessionsUsed?: number;
  notes?: string;
  assessmentScore?: number;
  recommendedLevel?: string;
  assessmentNotes?: string;
  zoomMeetingUrl?: string;
  zoomRecordingUrl?: string;
  resultImageUrls?: string[];
  listeningScore?: number;
  speakingScore?: number;
  readingScore?: number;
  writingScore?: number;
  pronunciationScore?: number;
  grammarScore?: number;
  vocabularyScore?: number;
  reflexScore?: number;
  confidenceScore?: number;
  focusScore?: number;
  testDurationMinutes?: number;
  learningGaps?: string;
  strengthsObserved?: string;
  improvementAreas?: string;
  recommendedRoadmap?: string;
  suggestedPackage?: string;
  suggestedSchedule?: string;
  salesAdvice?: string;
  closingPotential?: string;
  technicalNotes?: string;
  invoiceId?: string;
  orderId?: string;
}

export interface TrialEnrollmentMutationResult {
  ok: boolean;
  message?: string;
  data?: TrialEnrollmentItem;
}

export interface TrialEnrollmentPage {
  items: TrialEnrollmentItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
}

export interface TrialEnrollmentSummary {
  total: number;
  pendingTrial: number;
  waitingDecision: number;
  converted: number;
  rejected: number;
  active: number;
}

export interface TrialTestSlotBooking {
  id: string;
  trialCode?: string;
  studentName?: string;
  status?: string;
}

export interface TrialTestSlot {
  startTime: string;
  endTime: string;
  available: boolean;
  booking?: TrialTestSlotBooking;
}

export interface AvailableTrialTestSlot {
  date: string;
  startTime: string;
  endTime: string;
  experienceTeacherId: string;
  teacherName?: string;
  teacherEmail?: string;
}

export interface AvailableTrialTestSlotParams {
  fromDate?: string;
  toDate?: string;
  preferredStart?: string;
  preferredEnd?: string;
  experienceTeacherId?: string;
  limit?: number;
}

@Injectable({ providedIn: 'root' })
export class TrialEnrollmentService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBase}/trial-enrollments`;

  private buildListQuery(params?: TrialEnrollmentListParams): Record<string, string> {
    const query: Record<string, string> = {};
    if (params?.keyword) query['search'] = params.keyword;
    if (params?.status) query['status'] = params.status;
    if (params?.classId) query['classId'] = params.classId;
    if (params?.productId) query['productId'] = params.productId;
    if (params?.saleId) query['saleId'] = params.saleId;
    if (params?.experienceTeacherId) query['experienceTeacherId'] = params.experienceTeacherId;
    if (params?.page) query['page'] = String(params.page);
    if (params?.limit) query['limit'] = String(params.limit);
    return query;
  }

  async list(params?: TrialEnrollmentListParams): Promise<TrialEnrollmentItem[]> {
    try {
      const response = await firstValueFrom(
        this.http.get<TrialEnrollmentItem[] | TrialEnrollmentPage>(this.base, {
          withCredentials: true,
          params: this.buildListQuery(params),
        }),
      );
      return Array.isArray(response) ? response : response.items || [];
    } catch {
      return [];
    }
  }

  async listPage(params: TrialEnrollmentListParams = {}): Promise<TrialEnrollmentPage> {
    const limit = params.limit || 50;
    try {
      const response = await firstValueFrom(
        this.http.get<TrialEnrollmentItem[] | TrialEnrollmentPage>(this.base, {
          withCredentials: true,
          params: this.buildListQuery({ ...params, page: params.page || 1, limit }),
        }),
      );
      if (Array.isArray(response)) {
        return {
          items: response,
          total: response.length,
          page: params.page || 1,
          limit,
          totalPages: 1,
          hasNext: false,
        };
      }
      return response;
    } catch {
      return { items: [], total: 0, page: params.page || 1, limit, totalPages: 1, hasNext: false };
    }
  }

  async getSummary(): Promise<TrialEnrollmentSummary> {
    try {
      return await firstValueFrom(
        this.http.get<TrialEnrollmentSummary>(`${this.base}/summary`, {
          withCredentials: true,
        }),
      );
    } catch {
      return { total: 0, pendingTrial: 0, waitingDecision: 0, converted: 0, rejected: 0, active: 0 };
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
      return { ok: false, message: this.normalizeMessage(error, 'Không thể tạo buổi test') };
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
      return { ok: false, message: this.normalizeMessage(error, 'Không thể cập nhật buổi test') };
    }
  }

  async getTestSlots(params: { experienceTeacherId: string; date: string; excludeId?: string }): Promise<TrialTestSlot[]> {
    try {
      const query: Record<string, string> = {
        experienceTeacherId: params.experienceTeacherId,
        date: params.date,
      };
      if (params.excludeId) query['excludeId'] = params.excludeId;

      const response = await firstValueFrom(
        this.http.get<{ slots: TrialTestSlot[] }>(`${this.base}/test-slots`, {
          withCredentials: true,
          params: query,
        }),
      );
      return response.slots || [];
    } catch {
      return [];
    }
  }

  async getAvailableSlots(params: AvailableTrialTestSlotParams): Promise<AvailableTrialTestSlot[]> {
    try {
      const query: Record<string, string> = {};
      if (params.fromDate) query['fromDate'] = params.fromDate;
      if (params.toDate) query['toDate'] = params.toDate;
      if (params.preferredStart) query['preferredStart'] = params.preferredStart;
      if (params.preferredEnd) query['preferredEnd'] = params.preferredEnd;
      if (params.experienceTeacherId) query['experienceTeacherId'] = params.experienceTeacherId;
      if (params.limit) query['limit'] = String(params.limit);

      const response = await firstValueFrom(
        this.http.get<{ slots: AvailableTrialTestSlot[] }>(`${this.base}/available-slots`, {
          withCredentials: true,
          params: query,
        }),
      );
      return response.slots || [];
    } catch {
      return [];
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
      return { ok: false, message: this.normalizeMessage(error, 'Không thể chốt học sau buổi test') };
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
      return { ok: false, message: this.normalizeMessage(error, 'Không thể chốt không tiếp tục sau buổi test') };
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

  async uploadResultImage(file: File): Promise<{ ok: boolean; url?: string; message?: string }> {
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await firstValueFrom(
        this.http.post<{ url: string }>(`${this.base}/result-upload`, formData, {
          withCredentials: true,
        }),
      );
      return { ok: true, url: response.url };
    } catch (error: any) {
      return { ok: false, message: this.normalizeMessage(error, 'Khong the tai anh ket qua test') };
    }
  }

  private normalizeMessage(error: any, fallback: string): string {
    const raw = error?.error?.message;
    if (typeof raw === 'string' && raw.trim()) return raw;
    if (Array.isArray(raw) && raw.length) return raw.join(', ');
    return fallback;
  }
}
