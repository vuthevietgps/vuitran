import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

export type WorkSessionStatus = 'ACTIVE' | 'COMPLETED' | 'AUTO_CLOSED';

export interface WorkSessionUser {
  _id?: string;
  fullName?: string;
  email?: string;
  role?: string;
}

export interface WorkSessionItem {
  _id: string;
  userId?: WorkSessionUser;
  date: string;
  loginTime: string;
  logoutTime?: string | null;
  totalMinutes?: number | null;
  isLate?: boolean;
  lateMinutes?: number | null;
  isEarlyLeave?: boolean;
  earlyLeaveMinutes?: number | null;
  status: WorkSessionStatus;
  scheduledStartTime?: string | null;
  scheduledEndTime?: string | null;
  notes?: string | null;
}

export interface WorkSessionListSummary {
  totalSessions: number;
  activeSessions: number;
  totalMinutes: number;
  lateSessions: number;
}

export interface WorkSessionListResponse {
  data: WorkSessionItem[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  summary: WorkSessionListSummary;
}

export interface WorkSessionListQuery {
  userId?: string;
  fromDate?: string;
  toDate?: string;
  status?: WorkSessionStatus;
  search?: string;
  page?: number;
  limit?: number;
}

@Injectable({ providedIn: 'root' })
export class WorkSessionService {
  private readonly apiUrl = `${environment.apiBase}/work-sessions`;

  constructor(private readonly http: HttpClient) {}

  async list(
    query: WorkSessionListQuery = {},
  ): Promise<WorkSessionListResponse> {
    return firstValueFrom(
      this.http.get<WorkSessionListResponse>(this.apiUrl, {
        params: this.buildParams(query as any),
      }),
    );
  }

  async getMy(
    query: WorkSessionListQuery = {},
  ): Promise<WorkSessionListResponse> {
    return firstValueFrom(
      this.http.get<WorkSessionListResponse>(`${this.apiUrl}/my`, {
        params: this.buildParams(query as any),
      }),
    );
  }

  async getSummary(periodStart: string, periodEnd: string): Promise<any[]> {
    const params = new HttpParams()
      .set('periodStart', periodStart)
      .set('periodEnd', periodEnd);
    return firstValueFrom(this.http.get<any[]>(`${this.apiUrl}/summary`, { params }));
  }

  async update(
    id: string,
    data: any,
  ): Promise<{ ok: boolean; message?: string }> {
    try {
      await firstValueFrom(this.http.patch(`${this.apiUrl}/${id}`, data));
      return { ok: true };
    } catch (err: any) {
      return { ok: false, message: err.error?.message || 'Update failed' };
    }
  }

  private buildParams(params: Record<string, unknown>): HttpParams {
    let httpParams = new HttpParams();
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null || value === '') {
        continue;
      }
      httpParams = httpParams.set(key, String(value));
    }
    return httpParams;
  }
}
