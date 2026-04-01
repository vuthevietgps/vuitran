import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

export interface ClassMember {
  _id: string;
  fullName: string;
  email?: string;
  userCode?: string;
}

export interface StudentTeacherSlot {
  slotIndex: number;
  slotType: 'INITIAL' | 'UPDATE';
  teacherId?: ClassMember | string | null;
  assignedAt?: string;
  assignedBy?: ClassMember | null;
}

export interface StudentDurationSlot {
  slotIndex: number;
  slotType: 'INITIAL' | 'UPDATE';
  effectiveAt?: string;
  effectiveBy?: ClassMember | null;
  baseDuration: number;
  sessionDuration: number;
  totalSessions: number;
}

export interface StudentClassConfig {
  studentId?: (ClassMember & { studentCode?: string }) | string | null;
  teacherSlots?: StudentTeacherSlot[];
  durationSlots?: StudentDurationSlot[];
  updatedAt?: string;
}

export interface PendingSaleUpdate {
  status: 'PENDING' | 'REJECTED';
  requestType?: 'GENERAL' | 'DURATION_CHANGE';
  requestedChanges?: Record<string, unknown>;
  requestedBy?: ClassMember | null;
  requestedAt?: string;
  changeSummary?: ClassEditHistoryChange[];
  durationPreview?: ClassDurationPreview | null;
  reviewedBy?: ClassMember | null;
  reviewedAt?: string;
  rejectionReason?: string;
}

export interface DurationSnapshot {
  source: 'INITIAL' | 'MANAGER_DIRECT' | 'APPROVED_SALE_UPDATE' | 'APPROVED_DURATION_CHANGE';
  requestType?: 'GENERAL' | 'DURATION_CHANGE';
  effectiveAt: string;
  baseDuration: number;
  sessionDuration: number;
  pricePerSession?: number;
  teacherPayPerSession?: number;
  teacherPayPerStudent?: number;
}

export interface ClassEditHistoryChange {
  field: string;
  label: string;
  beforeValue?: string;
  afterValue?: string;
}

export interface ClassDurationPreviewStudent {
  studentId?: string | null;
  studentName?: string;
  studentCode?: string;
  oldDurationMinutes: number;
  newDurationMinutes: number;
  paidSessionsRemainingBefore?: number;
  bonusSessionsRemainingBefore?: number;
  totalSessionsRemainingBefore?: number;
  paidSessionsRemainingAfter?: number;
  bonusSessionsRemainingAfter?: number;
  totalSessionsRemainingAfter?: number;
  projectedTotalSessionsBefore?: number;
  projectedTotalSessionsAfter?: number;
}

export interface ClassDurationPreview {
  oldBaseDuration: number;
  oldSessionDuration: number;
  newBaseDuration: number;
  newSessionDuration: number;
  students: ClassDurationPreviewStudent[];
}

export interface ClassEditHistoryEntry {
  editedAt: string;
  editedByName?: string;
  editedByRole?: string;
  action:
    | 'SALE_DIRECT_UPDATED'
    | 'SALE_REQUESTED'
    | 'APPROVED'
    | 'REJECTED'
    | 'MANAGER_UPDATED';
  requestType?: 'GENERAL' | 'DURATION_CHANGE';
  changes: ClassEditHistoryChange[];
  durationPreview?: ClassDurationPreview | null;
  note?: string;
}

export interface ClassItem {
  _id: string;
  name: string;
  code: string;
  classMode?: 'ONLINE' | 'OFFLINE';
  productPackage?: {
    _id: string;
    name: string;
    code?: string;
    teachingMode?: string;
    pricePerSession?: number;
    suggestedPrice?: number;
  } | null;
  teacher?: ClassMember | null;
  sale?: ClassMember | null;
  students?: (ClassMember & { studentCode?: string })[];

  pricePerSession?: number;
  teacherPayPerSession?: number;
  teacherPayPerStudent?: number;
  baseDuration?: number;
  sessionDuration?: number;
  subject?: string;
  learningGoals?: string;
  maxStudents?: number;
  actualPricePerSession?: number;
  actualTeacherPayPerSession?: number;

  revenuePerStudent?: number;
  teacherSalaryCost?: number;

  totalRevenue?: number;
  totalCost?: number;
  profit?: number;
  studentCount?: number;
  status?: string;
  schedule?: any[];
  totalSessions?: number;
  sessionsCompleted?: number;
  pendingSaleUpdate?: PendingSaleUpdate | null;
  durationSnapshots?: DurationSnapshot[];
  studentConfigs?: StudentClassConfig[];
  editHistory?: ClassEditHistoryEntry[];
}

export interface ClassPayload {
  name: string;
  code: string;
  teacherId: string;
  saleId?: string;
  invoiceId?: string;
  productPackageId?: string;
  classMode?: 'ONLINE' | 'OFFLINE';
  studentIds?: string[];
  pricePerSession?: number;
  teacherPayPerSession?: number;
  teacherPayPerStudent?: number;
  baseDuration?: number;
  sessionDuration?: number;
  subject?: string;
  learningGoals?: string;
  maxStudents?: number;
  revenuePerStudent?: number;
  teacherSalaryCost?: number;
  requestType?: 'GENERAL' | 'DURATION_CHANGE';
}

export interface ClassMutationResult {
  ok: boolean;
  message?: string;
  data?: any;
}

export interface UpdateStudentConfigPayload {
  teacherId?: string;
  baseDuration?: number;
  sessionDuration?: number;
}

@Injectable({ providedIn: 'root' })
export class ClassService {
  private http = inject(HttpClient);

  async list(): Promise<ClassItem[]> {
    try {
      return await firstValueFrom(
        this.http.get<ClassItem[]>(`${environment.apiBase}/classes`, { withCredentials: true }),
      );
    } catch {
      return [];
    }
  }

  async create(payload: ClassPayload): Promise<ClassMutationResult> {
    try {
      const response = await firstValueFrom(
        this.http.post(`${environment.apiBase}/classes`, payload, { withCredentials: true }),
      );
      return { ok: true, data: response };
    } catch (error: any) {
      return this.fail(error);
    }
  }

  async listSaleOfflineOptions(): Promise<ClassItem[]> {
    try {
      return await firstValueFrom(
        this.http.get<ClassItem[]>(`${environment.apiBase}/classes/sale-offline-options`, {
          withCredentials: true,
        }),
      );
    } catch {
      return [];
    }
  }

  async update(id: string, payload: Partial<ClassPayload>): Promise<ClassMutationResult> {
    try {
      const response = await firstValueFrom(
        this.http.patch(`${environment.apiBase}/classes/${id}`, payload, { withCredentials: true }),
      );
      return {
        ok: true,
        data: response,
        message: this.normalizeMessage((response as any)?.message),
      };
    } catch (error: any) {
      return this.fail(error);
    }
  }

  async remove(id: string): Promise<ClassMutationResult> {
    try {
      await firstValueFrom(
        this.http.delete(`${environment.apiBase}/classes/${id}`, { withCredentials: true }),
      );
      return { ok: true };
    } catch (error: any) {
      return this.fail(error);
    }
  }

  async assignStudents(
    id: string,
    studentIds: string[],
    invoiceId?: string,
  ): Promise<ClassMutationResult> {
    try {
      const response = await firstValueFrom(
        this.http.post(
          `${environment.apiBase}/classes/${id}/assign-students`,
          { studentIds, invoiceId },
          { withCredentials: true },
        ),
      );
      return { ok: true, data: response };
    } catch (error: any) {
      return this.fail(error);
    }
  }

  async updateStudentConfig(
    classId: string,
    studentId: string,
    payload: UpdateStudentConfigPayload,
  ): Promise<ClassMutationResult> {
    try {
      const response = await firstValueFrom(
        this.http.patch(
          `${environment.apiBase}/classes/${classId}/students/${studentId}/config`,
          payload,
          { withCredentials: true },
        ),
      );
      return { ok: true, data: response };
    } catch (error: any) {
      return this.fail(error);
    }
  }

  async approvePendingUpdate(id: string): Promise<ClassMutationResult> {
    try {
      const response = await firstValueFrom(
        this.http.post(
          `${environment.apiBase}/classes/${id}/pending-sale-update/approve`,
          {},
          { withCredentials: true },
        ),
      );
      return { ok: true, data: response };
    } catch (error: any) {
      return this.fail(error);
    }
  }

  async rejectPendingUpdate(id: string, reason?: string): Promise<ClassMutationResult> {
    try {
      const response = await firstValueFrom(
        this.http.post(
          `${environment.apiBase}/classes/${id}/pending-sale-update/reject`,
          { reason },
          { withCredentials: true },
        ),
      );
      return { ok: true, data: response };
    } catch (error: any) {
      return this.fail(error);
    }
  }

  private fail(error: any, fallback = 'Khong the thuc hien thao tac'): ClassMutationResult {
    const message = this.normalizeMessage(error?.error?.message)
      || this.normalizeMessage(error?.message)
      || fallback;
    return { ok: false, message };
  }

  private normalizeMessage(value: any): string | undefined {
    if (!value) return undefined;
    if (typeof value === 'string') return value;
    if (Array.isArray(value)) {
      const normalized = value
        .map((item) => this.normalizeMessage(item))
        .filter((item): item is string => !!item);
      return normalized.length ? normalized.join(', ') : undefined;
    }
    if (typeof value === 'object') {
      return this.normalizeMessage(value.message)
        || this.normalizeMessage(value.error)
        || undefined;
    }
    return String(value);
  }
}

