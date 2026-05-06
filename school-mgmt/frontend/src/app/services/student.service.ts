import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

export interface StudentItem {
  _id: string;
  studentCode: string;
  fullName: string;
  age: number;
  grade?: string;
  level?: string;
  studentBirthMonth?: number;
  parentBirthMonth?: number;
  parentUserId?: string;
  parentUserIds?: string[];
  secondaryParentUserIds?: string[];
  parentUsers?: Array<{
    _id: string;
    userCode?: string;
    fullName: string;
    phone?: string;
    role?: string;
  }>;
  linkedParents?: Array<{
    _id: string;
    userCode?: string;
    fullName: string;
    phone?: string;
    role?: string;
  }>;
  parentName: string;
  parentPhone: string;
  saleId?: string;
  saleName?: string;
  faceImage: string;
  productPackage?: {
    _id: string;
    name: string;
    price: number;
  };
}

export interface StudentReportEntry {
  _id: string;
  studentCode: string;
  fullName: string;
  age: number;
  parentName: string;
  parentPhone: string;
  faceImage?: string;
  productPackage?: {
    _id: string;
    name: string;
    price: number;
  };
  totalAttendance: number;
}

export interface StudentReportMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface StudentReportResponse {
  rows: StudentReportEntry[];
  meta: StudentReportMeta;
}

export interface StudentReportClassOption {
  _id: string;
  code: string;
  name: string;
  studentCount: number;
}

export interface SessionCell {
  date: string | null;
  status: string | null;
  attendedAt: string | null;
  duration: number;
  teacherCode: string;
  teacherName?: string;
  teacherDisplay?: string;
  sessionIndex?: number | null;
}

export interface ComprehensiveReportRow {
  studentId: string;
  studentCode: string;
  fullName: string;
  age: number;
  parentName: string;
  parentPhone: string;
  faceImage: string;
  classMode?: 'ONLINE' | 'OFFLINE';
  classId: string;
  classCode: string;
  className: string;
  subject: string;
  grade: string;
  level?: string;
  dateOfBirth?: string | null;
  studentBirthMonth?: number | null;
  parentBirthMonth?: number | null;
  teacherName: string;
  teacherCode?: string;
  teacherCodeAndName?: string;
  teacherSalary?: number;
  teacherSalaryType?: 'PER_SESSION' | 'PER_STUDENT';
  invoiceNumber?: string;
  saleId?: string;
  saleName?: string;
  dataStatus?: string;
  pricePerSession: number;
  totalSessions: number;
  sessionsCompleted: number;
  attendedCount: number;
  absentCount: number;
  sessions: SessionCell[];
}

export interface ComprehensiveReportMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ComprehensiveReportResponse {
  maxSessions: number;
  rows: ComprehensiveReportRow[];
  meta: ComprehensiveReportMeta;
}

export interface ComprehensiveReportClassOption {
  _id: string;
  code: string;
  name: string;
  studentCount: number;
}

@Injectable({ providedIn: 'root' })
export class StudentService {
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

  async list(): Promise<StudentItem[]> {
    try {
      return await firstValueFrom(
        this.http.get<StudentItem[]>(`${environment.apiBase}/students`, {
          withCredentials: true,
        }),
      );
    } catch {
      return [];
    }
  }

  async getStudentReport(
    classId?: string,
    searchTerm?: string,
    page: number = 1,
    limit: number = 25,
  ): Promise<StudentReportResponse> {
    try {
      return await firstValueFrom(
        this.http.get<StudentReportResponse>(`${environment.apiBase}/students/report`, {
          params: this.buildParams({ classId, searchTerm, page, limit }),
          withCredentials: true,
        }),
      );
    } catch {
      return {
        rows: [],
        meta: { total: 0, page, limit, totalPages: 1 },
      };
    }
  }

  async getStudentReportClasses(searchTerm?: string, limit: number = 500): Promise<StudentReportClassOption[]> {
    try {
      return await firstValueFrom(
        this.http.get<StudentReportClassOption[]>(`${environment.apiBase}/students/report/classes`, {
          params: this.buildParams({ searchTerm, limit }),
          withCredentials: true,
        }),
      );
    } catch {
      return [];
    }
  }

  async getComprehensiveReport(
    classId?: string,
    searchTerm?: string,
    saleId?: string,
    dataStatus?: string,
    page: number = 1,
    limit: number = 50,
    classMode?: 'ONLINE' | 'OFFLINE',
  ): Promise<ComprehensiveReportResponse> {
    try {
      return await firstValueFrom(
        this.http.get<ComprehensiveReportResponse>(`${environment.apiBase}/students/comprehensive-report`, {
          params: this.buildParams({ classId, searchTerm, saleId, dataStatus, page, limit, classMode }),
          withCredentials: true,
        }),
      );
    } catch {
      return {
        maxSessions: 0,
        rows: [],
        meta: { total: 0, page, limit, totalPages: 1 },
      };
    }
  }

  async getComprehensiveReportClasses(
    searchTerm?: string,
    limit: number = 500,
    classMode?: 'ONLINE' | 'OFFLINE',
  ): Promise<ComprehensiveReportClassOption[]> {
    try {
      return await firstValueFrom(
        this.http.get<ComprehensiveReportClassOption[]>(`${environment.apiBase}/students/comprehensive-report/classes`, {
          params: this.buildParams({ searchTerm, limit, classMode }),
          withCredentials: true,
        }),
      );
    } catch {
      return [];
    }
  }

  async create(data: any): Promise<StudentItem> {
    const res = await firstValueFrom(
      this.http.post<StudentItem>(`${environment.apiBase}/students`, data, {
        withCredentials: true,
      }),
    );
    return res;
  }

  async update(id: string, data: any): Promise<StudentItem> {
    const res = await firstValueFrom(
      this.http.patch<StudentItem>(`${environment.apiBase}/students/${id}`, data, {
        withCredentials: true,
      }),
    );
    return res;
  }

  async remove(id: string): Promise<void> {
    await firstValueFrom(
      this.http.delete(`${environment.apiBase}/students/${id}`, {
        withCredentials: true,
      }),
    );
  }

  async uploadFace(file: File): Promise<{ url: string }> {
    const formData = new FormData();
    formData.append('file', file);
    const res = await firstValueFrom(
      this.http.post<{ url: string }>(`${environment.apiBase}/students/face-upload`, formData, {
        withCredentials: true,
      }),
    );
    return res;
  }
}
