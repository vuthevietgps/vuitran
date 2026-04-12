import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Qualification {
  title: string;
  institution?: string;
  year?: number;
  imageUrl?: string;
}

export interface AvailabilitySlot {
  day: string;
  startTime: string;
  endTime: string;
}

export interface BankInfo {
  bankName: string;
  accountNumber: string;
  accountHolderName: string;
  branch?: string;
}

export interface TeacherLinkedUser {
  _id: string;
  userCode?: string;
  fullName: string;
  email: string;
  phone?: string;
}

export interface TeacherProfileUpdatePayload {
  user?: {
    fullName?: string;
    email?: string;
    phone?: string;
    password?: string;
  };
  managedSales?: string[];
  subjects?: string[];
  grades?: string[];
  teachingMode?: 'ONLINE' | 'OFFLINE' | 'BOTH';
  locations?: string[];
  bio?: string;
  qualifications?: Qualification[];
  yearsOfExperience?: number;
  videoIntroUrl?: string;
  availability?: AvailabilitySlot[];
  pricePerSession?: number;
  pricePerHour?: number;
  bankInfo?: BankInfo;
  status?: string;
  adminNotes?: string;
}

export interface TeacherProfile {
  _id: string;
  userId: TeacherLinkedUser | string;
  managedSales?: TeacherLinkedUser[] | string[];
  subjects: string[];
  grades: string[];
  teachingMode: 'ONLINE' | 'OFFLINE' | 'BOTH';
  locations: string[];
  bio?: string;
  qualifications: Qualification[];
  yearsOfExperience: number;
  videoIntroUrl?: string;
  availability: AvailabilitySlot[];
  pricePerSession: number;
  pricePerHour?: number;
  status: string;
  rating: number;
  totalReviews: number;
  totalSessions: number;
  activeClasses: number;
  bankInfo?: BankInfo;
  approvedBy?: { _id: string; fullName: string };
  approvedAt?: string;
  adminNotes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface TeacherFullProfile {
  profile: TeacherProfile;
  classes: {
    active: any[];
    completed: any[];
    totalActive: number;
    totalCompleted: number;
  };
  sessions: {
    byStatus: Record<string, { count: number; totalPayout: number }>;
    totalCount: number;
    totalEarnings: number;
    recent: any[];
  };
  payroll: {
    byStatus: Record<string, { count: number; totalAmount: number }>;
    totalPaid: number;
  };
}

export interface TeachingMaterial {
  _id: string;
  teacherId: string;
  title: string;
  description?: string;
  manualSummary?: string;
  aiSummary?: string;
  extractedTextPreview?: string;
  extractionStatus?: 'PENDING' | 'READY' | 'UNSUPPORTED' | 'FAILED';
  chunkCount?: number;
  lastProcessedAt?: string;
  processingError?: string;
  subject?: string;
  grade?: string;
  classId?: { _id: string; name: string } | string;
  fileUrl: string;
  fileType: string;
  fileCategory?: 'pdf' | 'doc' | 'ppt' | 'excel' | 'image' | 'video' | 'other';
  fileSize: number;
  originalName: string;
  tags: string[];
  isShared: boolean;
  downloadCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface TeachingMaterialListQuery {
  subject?: string;
  grade?: string;
  classId?: string;
  search?: string;
  fileCategory?: 'pdf' | 'doc' | 'ppt' | 'excel' | 'image' | 'video' | 'other';
  extractionStatus?: 'PENDING' | 'READY' | 'UNSUPPORTED' | 'FAILED';
  page?: number;
  limit?: number;
}

export interface TeachingMaterialListResponse {
  data: TeachingMaterial[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export interface TeachingMaterialStats {
  total: number;
  readyForAI: number;
  totalChunks: number;
  bySubject: Record<string, number>;
  byGrade: Record<string, number>;
  totalSizeBytes: number;
  totalSizeMB: number;
}

@Injectable({ providedIn: 'root' })
export class TeacherService {
  private http = inject(HttpClient);
  private base = `${environment.apiBase}/teachers`;

  /** Lấy danh sách tất cả giáo viên */
  async getAllTeachers(params?: { status?: string; subjects?: string; grades?: string }): Promise<TeacherProfile[]> {
    let httpParams = new HttpParams();
    if (params?.status) httpParams = httpParams.set('status', params.status);
    if (params?.subjects) httpParams = httpParams.set('subjects', params.subjects);
    if (params?.grades) httpParams = httpParams.set('grades', params.grades);
    return firstValueFrom(
      this.http.get<TeacherProfile[]>(this.base, {
        withCredentials: true,
        params: httpParams,
      }),
    );
  }

  /** Lấy hồ sơ giáo viên của chính mình */
  async getMyProfile(): Promise<TeacherProfile> {
    return firstValueFrom(
      this.http.get<TeacherProfile>(`${this.base}/me`, { withCredentials: true }),
    );
  }

  /** Lấy profile đầy đủ với thống kê */
  async getFullProfile(id: string): Promise<TeacherFullProfile> {
    return firstValueFrom(
      this.http.get<TeacherFullProfile>(`${this.base}/${id}/profile`, { withCredentials: true }),
    );
  }

  /** Cập nhật hồ sơ giáo viên */
  async updateProfile(id: string, payload: TeacherProfileUpdatePayload): Promise<TeacherProfile> {
    return firstValueFrom(
      this.http.patch<TeacherProfile>(`${this.base}/${id}`, payload, { withCredentials: true }),
    );
  }

  async approve(id: string): Promise<TeacherProfile> {
    return firstValueFrom(
      this.http.post<TeacherProfile>(`${this.base}/${id}/approve`, {}, { withCredentials: true }),
    );
  }

  async activate(id: string): Promise<TeacherProfile> {
    return firstValueFrom(
      this.http.post<TeacherProfile>(`${this.base}/${id}/activate`, {}, { withCredentials: true }),
    );
  }

  async suspend(id: string, reason?: string): Promise<TeacherProfile> {
    return firstValueFrom(
      this.http.post<TeacherProfile>(
        `${this.base}/${id}/suspend`,
        reason ? { reason } : {},
        { withCredentials: true },
      ),
    );
  }

  // ── Teaching Materials ──────────────────────────────────────

  /** Lấy danh sách tài liệu */
  async getMaterials(params?: TeachingMaterialListQuery): Promise<TeachingMaterialListResponse> {
    let httpParams = new HttpParams();
    if (params?.subject) httpParams = httpParams.set('subject', params.subject);
    if (params?.grade) httpParams = httpParams.set('grade', params.grade);
    if (params?.classId) httpParams = httpParams.set('classId', params.classId);
    if (params?.search) httpParams = httpParams.set('search', params.search);
    if (params?.fileCategory) httpParams = httpParams.set('fileCategory', params.fileCategory);
    if (params?.extractionStatus) httpParams = httpParams.set('extractionStatus', params.extractionStatus);
    if (params?.page) httpParams = httpParams.set('page', String(params.page));
    if (params?.limit) httpParams = httpParams.set('limit', String(params.limit));
    return firstValueFrom(
      this.http.get<TeachingMaterialListResponse>(`${environment.apiBase}/teaching-materials`, {
        withCredentials: true,
        params: httpParams,
      }),
    );
  }

  async getMaterialStats(): Promise<TeachingMaterialStats> {
    return firstValueFrom(
      this.http.get<TeachingMaterialStats>(`${environment.apiBase}/teaching-materials/stats`, {
        withCredentials: true,
      }),
    );
  }

  /** Upload tài liệu mới */
  async uploadMaterial(file: File, metadata: {
    title: string;
    description?: string;
    manualSummary?: string;
    subject?: string;
    grade?: string;
    classId?: string;
    tags?: string[];
    isShared?: boolean;
  }): Promise<TeachingMaterial> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', metadata.title);
    if (metadata.description) formData.append('description', metadata.description);
    if (metadata.manualSummary) formData.append('manualSummary', metadata.manualSummary);
    if (metadata.subject) formData.append('subject', metadata.subject);
    if (metadata.grade) formData.append('grade', metadata.grade);
    if (metadata.classId) formData.append('classId', metadata.classId);
    if (metadata.tags?.length) formData.append('tags', JSON.stringify(metadata.tags));
    if (metadata.isShared !== undefined) formData.append('isShared', String(metadata.isShared));

    return firstValueFrom(
      this.http.post<TeachingMaterial>(`${environment.apiBase}/teaching-materials/upload`, formData, {
        withCredentials: true,
      }),
    );
  }

  /** Cập nhật thông tin tài liệu */
  async updateMaterial(id: string, payload: Partial<{
    title: string;
    description: string;
    manualSummary: string;
    subject: string;
    grade: string;
    classId: string;
    tags: string[];
    isShared: boolean;
  }>): Promise<TeachingMaterial> {
    return firstValueFrom(
      this.http.patch<TeachingMaterial>(`${environment.apiBase}/teaching-materials/${id}`, payload, {
        withCredentials: true,
      }),
    );
  }

  async reprocessMaterial(id: string): Promise<TeachingMaterial> {
    return firstValueFrom(
      this.http.post<TeachingMaterial>(`${environment.apiBase}/teaching-materials/${id}/reprocess`, {}, {
        withCredentials: true,
      }),
    );
  }

  /** Xóa tài liệu */
  async recordMaterialDownload(id: string): Promise<{ downloadCount: number }> {
    return firstValueFrom(
      this.http.post<{ downloadCount: number }>(`${environment.apiBase}/teaching-materials/${id}/download`, {}, {
        withCredentials: true,
      }),
    );
  }

  async deleteMaterial(id: string): Promise<void> {
    await firstValueFrom(
      this.http.delete(`${environment.apiBase}/teaching-materials/${id}`, { withCredentials: true }),
    );
  }
}
