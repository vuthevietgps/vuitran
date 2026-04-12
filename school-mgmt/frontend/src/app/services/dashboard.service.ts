import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { firstValueFrom } from 'rxjs';

export interface DailyTaskItem {
  id: string;
  type: string;
  title: string;
  detail?: string;
  meta?: string[];
  status?: string;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  dueAt?: string;
  route: string;
  queryParams?: Record<string, string>;
  actionLabel?: string;
  overdue?: boolean;
}

export interface DailyTaskTab {
  key: string;
  label: string;
  description: string;
  emptyMessage: string;
  count: number;
  tasks: DailyTaskItem[];
}

export interface DailyTaskBoard {
  role: string;
  generatedAt: string;
  summary: {
    totalTasks: number;
    overdueTasks: number;
    dueTodayTasks: number;
    highPriorityTasks: number;
  };
  tabs: DailyTaskTab[];
}

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private http = inject(HttpClient);
  private base = `${environment.apiBase}/dashboard`;

  getDirectorDashboard(fromDate?: string, toDate?: string) {
    const params: any = {};
    if (fromDate) params.fromDate = fromDate;
    if (toDate) params.toDate = toDate;
    return firstValueFrom(this.http.get<any>(`${this.base}/director`, { params }));
  }

  getDirectorComprehensive(fromDate?: string, toDate?: string) {
    const params: any = {};
    if (fromDate) params.fromDate = fromDate;
    if (toDate) params.toDate = toDate;
    return firstValueFrom(this.http.get<any>(`${this.base}/director/comprehensive`, { params }));
  }

  getBirthdays(month?: number) {
    const params: any = {};
    if (month) params.month = month;
    return firstValueFrom(this.http.get<any>(`${this.base}/birthdays`, { params }));
  }

  getAccountingDashboard(fromDate?: string, toDate?: string) {
    const params: any = {};
    if (fromDate) params.fromDate = fromDate;
    if (toDate) params.toDate = toDate;
    return firstValueFrom(this.http.get<any>(`${this.base}/accounting`, { params }));
  }

  getOpsDashboard() {
    return firstValueFrom(this.http.get<any>(`${this.base}/ops`));
  }

  getTeacherDashboard() {
    return firstValueFrom(this.http.get<any>(`${this.base}/teacher`));
  }

  getParentDashboard() {
    return firstValueFrom(this.http.get<any>(`${this.base}/parent`));
  }

  getDailyTasks() {
    return firstValueFrom(this.http.get<DailyTaskBoard>(`${this.base}/daily-tasks`));
  }

  getTeacherKPI(fromDate?: string, toDate?: string) {
    const params: any = {};
    if (fromDate) params.fromDate = fromDate;
    if (toDate) params.toDate = toDate;
    return firstValueFrom(this.http.get<any>(`${this.base}/director/teacher-kpi`, { params }));
  }

  getCalendarOverview(month?: number, year?: number, teacherId?: string, classId?: string) {
    const params: any = {};
    if (month) params.month = month;
    if (year) params.year = year;
    if (teacherId) params.teacherId = teacherId;
    if (classId) params.classId = classId;
    return firstValueFrom(this.http.get<any>(`${this.base}/director/calendar`, { params }));
  }
}
