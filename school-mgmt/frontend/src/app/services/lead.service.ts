import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

export interface LeadAttributionTracking {
  landingPageId?: string;
  landingPageSlug?: string;
  landingPageName?: string;
  submittedUrl?: string;
  referrerUrl?: string;
  eventId?: string;
  fbclid?: string;
  fbc?: string;
  fbp?: string;
  gclid?: string;
  gbraid?: string;
  wbraid?: string;
  ttclid?: string;
  ttp?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
}

export interface LeadAttributionSummary {
  parentKey?: string | null;
  attributionModel?: string | null;
  sourceType?: string | null;
  firstAttributedAt?: string | null;
  lastConfirmedAt?: string | null;
  adGroupId?: string | null;
  adGroupName?: string | null;
  platform?: string | null;
}

export interface LeadAttributionTouchpoint {
  capturedAt?: string;
  firstTouchedAt?: string;
  lastConfirmedAt?: string;
  attributionModel?: string;
  sourceType: string;
  parentUserId?: string;
  parentPhone?: string;
  normalizedParentPhone?: string;
  parentEmail?: string;
  normalizedParentEmail?: string;
  adGroupId?: string;
  adGroupName?: string;
  platform?: string;
  adRefParam?: string;
  tracking?: LeadAttributionTracking;
  sourceConversationId?: string;
  sourceLeadId?: string;
  sourceOrderId?: string;
  notes?: string;
}

export interface LeadItem {
  _id: string;
  leadCode: string;
  parentName: string;
  parentPhone: string;
  parentEmail?: string;
  studentName?: string;
  studentGrade?: string;
  interestedSubjects?: string[];
  source: string;
  referredBy?: string;
  status: string;
  saleId?: string;
  saleName?: string;
  contactHistory?: ContactEntry[];
  nextFollowUp?: string;
  estimatedValue?: number;
  lostReason?: string;
  lostNotes?: string;
  convertedOrderId?: string;
  tags?: string[];
  notes?: string;
  createdAt?: string;
  assignedAt?: string;
  lastContactAt?: string;
  returnedToPoolAt?: string;
  returnCount?: number;
  assignmentHistory?: {
    saleId: string;
    saleName: string;
    assignedAt: string;
    returnedAt?: string;
    returnReason?: string;
  }[];
  attributionSummary?: LeadAttributionSummary | null;
  attributionTouchpoints?: LeadAttributionTouchpoint[];
}

export interface ContactEntry {
  date: string;
  method: string;
  notes?: string;
  nextFollowUp?: string;
  contactedBy?: string;
}

export interface LeadPipeline {
  pipeline: Record<string, { count: number; estimatedValue: number }>;
  total: number;
  conversionRate: number;
  assignedCount: number;
  unassignedCount: number;
}

export interface LeadStats {
  bySource: { _id: string; count: number }[];
  byStatus: { _id: string; count: number }[];
  bySale: { saleId: string; saleName: string; total: number; converted: number; conversionRate: number }[];
  thisMonthCount: number;
  pipelineValue: number;
  assignedCount: number;
  unassignedCount: number;
  returnedCount: number;
  staleCount: number;
}

@Injectable({ providedIn: 'root' })
export class LeadService {
  private http = inject(HttpClient);
  private base = `${environment.apiBase}/leads`;

  async list(params?: Record<string, string>): Promise<LeadItem[]> {
    try {
      return await firstValueFrom(
        this.http.get<LeadItem[]>(this.base, { withCredentials: true, params }),
      );
    } catch { return []; }
  }

  async getOne(id: string): Promise<LeadItem | null> {
    try {
      return await firstValueFrom(
        this.http.get<LeadItem>(`${this.base}/${id}`, { withCredentials: true }),
      );
    } catch { return null; }
  }

  async create(payload: Partial<LeadItem>): Promise<{ ok: boolean; message?: string; data?: LeadItem }> {
    try {
      const data = await firstValueFrom(
        this.http.post<LeadItem>(this.base, payload, { withCredentials: true }),
      );
      return { ok: true, data };
    } catch (e: any) {
      return { ok: false, message: e?.error?.message || 'Lỗi tạo lead' };
    }
  }

  async update(id: string, payload: Partial<LeadItem>): Promise<{ ok: boolean; message?: string }> {
    try {
      await firstValueFrom(
        this.http.patch(`${this.base}/${id}`, payload, { withCredentials: true }),
      );
      return { ok: true };
    } catch (e: any) {
      return { ok: false, message: e?.error?.message || 'Lỗi cập nhật' };
    }
  }

  async addContact(id: string, payload: { method: string; notes?: string; nextFollowUp?: string }): Promise<{ ok: boolean; message?: string }> {
    try {
      await firstValueFrom(
        this.http.post(`${this.base}/${id}/contact`, payload, { withCredentials: true }),
      );
      return { ok: true };
    } catch (e: any) {
      return { ok: false, message: e?.error?.message || 'Lỗi' };
    }
  }

  async convert(id: string): Promise<{ ok: boolean; message?: string }> {
    try {
      const res = await firstValueFrom(
        this.http.post<any>(`${this.base}/${id}/convert`, {}, { withCredentials: true }),
      );
      return { ok: true, message: res.message };
    } catch (e: any) {
      return { ok: false, message: e?.error?.message || 'Lỗi chuyển đổi' };
    }
  }

  async markLost(id: string, reason: string, notes?: string): Promise<{ ok: boolean; message?: string }> {
    try {
      await firstValueFrom(
        this.http.post(`${this.base}/${id}/lost`, { reason, notes }, { withCredentials: true }),
      );
      return { ok: true };
    } catch (e: any) {
      return { ok: false, message: e?.error?.message || 'Lỗi' };
    }
  }

  async assign(id: string, saleId: string, saleName: string): Promise<{ ok: boolean; message?: string }> {
    try {
      await firstValueFrom(
        this.http.post(`${this.base}/${id}/assign`, { saleId, saleName }, { withCredentials: true }),
      );
      return { ok: true };
    } catch (e: any) {
      return { ok: false, message: e?.error?.message || 'Lỗi phân công' };
    }
  }

  async returnToPool(id: string, reason: string): Promise<{ ok: boolean; message?: string }> {
    try {
      await firstValueFrom(
        this.http.post(`${this.base}/${id}/return-to-pool`, { reason }, { withCredentials: true }),
      );
      return { ok: true };
    } catch (e: any) {
      return { ok: false, message: e?.error?.message || 'Lỗi thu hồi lead' };
    }
  }

  async getPool(): Promise<LeadItem[]> {
    try {
      return await firstValueFrom(
        this.http.get<LeadItem[]>(`${this.base}/pool/list`, { withCredentials: true }),
      );
    } catch { return []; }
  }

  async getFollowUps(): Promise<LeadItem[]> {
    try {
      return await firstValueFrom(
        this.http.get<LeadItem[]>(`${this.base}/follow-ups`, { withCredentials: true }),
      );
    } catch { return []; }
  }

  async getPipeline(): Promise<LeadPipeline | null> {
    try {
      return await firstValueFrom(
        this.http.get<LeadPipeline>(`${this.base}/pipeline`, { withCredentials: true }),
      );
    } catch { return null; }
  }

  async getStats(): Promise<LeadStats | null> {
    try {
      return await firstValueFrom(
        this.http.get<LeadStats>(`${this.base}/stats`, { withCredentials: true }),
      );
    } catch { return null; }
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
}
