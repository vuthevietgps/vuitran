import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

export enum AttendanceStatus {
  PRESENT = 'PRESENT',    // Có mặt
  ABSENT = 'ABSENT',      // Vắng mặt
  LATE = 'LATE',          // Đi muộn
  EXCUSED = 'EXCUSED',    // Xin phép
}

/**
 * TeachingReportRow: shape trả về từ GET /reports/teaching
 * Dữ liệu được $lookup read-time từ 3 SSOT:
 *   • sessionContent / comment / recordLink / hasTeachingReport / ... → Sessions
 *   • salaryAmount / paymentStatus / penaltyAmount / bonusAmount      → PayrollTransactions
 *   • imageUrl / attendedAt / date / sessionDuration                  → Attendance
 */
export interface TeachingReportRow {
  _id: string;
  attendanceId: string;
  date: string;
  attendedAt?: string;
  imageUrl?: string;
  sessionDuration?: number;
  sessionIndex?: number;
  sessionId?: string;

  // Từ Sessions (SSOT)
  sessionContent?: string;
  studentAttitude?: string;
  comment?: string;
  recordLink?: string;
  homework?: string;
  additionalNotes?: string;
  reportSubmittedAt?: string;
  isLateReport?: boolean;
  lateHours?: number;
  hasTeachingReport?: boolean;
  sessionStatus?: string;
  parentConfirm?: boolean;

  // Từ PayrollTransactions (SSOT)
  salaryAmount?: number;
  paymentStatus?: string;
  penaltyAmount?: number;
  bonusAmount?: number;

  // Thông tin liên quan
  studentId: { _id: string; studentCode?: string; fullName: string; age?: number; faceImage?: string };
  classId: { _id: string; code: string; name: string };
  teacherId: { _id: string; fullName: string; email?: string };
}

export interface PaginatedReportResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface StudentAttendanceItem {
  student: {
    _id: string;
    fullName: string;
    age: number;
    parentName: string;
    studentCode?: string;
  };
  attendance: {
    _id?: string;
    classId: string;
    studentId: string;
    date: string;
    status: AttendanceStatus | null;
    notes: string;
    attendedAt?: string | null;
    imageUrl?: string | null;
    sessionId?: string | null;
  };
}

export interface AttendanceByClassResponse {
  class: {
    _id: string;
    name: string;
    code: string;
  };
  date: string;
  permissions?: {
    canBulkEdit: boolean;
    canGenerateLink: boolean;
    blockedReason: string | null;
    substituteActive: boolean;
    substituteTeacherId: string | null;
    activeTeacherId: string | null;
  };
  attendanceList: StudentAttendanceItem[];
}

export interface TeacherClassAssignment {
  classId: string;
  classCode: string;
  className: string;
  students: Array<{
    studentId: string;
    fullName: string;
    studentCode: string;
    age?: number;
    parentName?: string;
  }>;
}

export interface ClassWithStudents {
  classId: string;
  classCode: string;
  className: string;
  studentCount: number;
  students: Array<{
    studentId: string;
    fullName: string;
    studentCode: string;
    age?: number;
    parentName?: string;
    parentPhone?: string;
  }>;
}

export interface AttendanceReportClassOption {
  _id: string;
  code: string;
  name: string;
  studentCount: number;
}

export interface BulkAttendancePayload {
  classId: string;
  date: string;
  attendances: Array<{
    studentId: string;
    status: AttendanceStatus | null;
    notes?: string;
  }>;
}

export interface BulkAttendanceResponse {
  success: any[];
  errors: Array<{
    studentId: string;
    message: string;
  }>;
  sessionsCreated: number;
  totalProcessed: number;
  totalErrors: number;
  attendedCount?: number;
  classMode?: string;
}

export interface AttendanceStatsResponse {
  classId: string;
  period: {
    startDate: string;
    endDate: string;
  };
  statistics: Array<{
    _id: AttendanceStatus;
    count: number;
  }>;
}

@Injectable({ providedIn: 'root' })
export class AttendanceService {
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

  // Lấy danh sách điểm danh theo lớp và ngày
  async getAttendanceByClass(classId: string, date: string): Promise<AttendanceByClassResponse | null> {
    try {
      const res = await firstValueFrom(
        this.http.get<AttendanceByClassResponse>(
          `${environment.apiBase}/attendance/class/${classId}`,
          {
            params: this.buildParams({ date }),
            withCredentials: true,
          },
        ),
      );
      return res;
    } catch (error) {
      console.error('Error loading attendance:', error);
      return null;
    }
  }

  // Điểm danh nhiều học sinh cùng lúc
  async bulkMarkAttendance(payload: BulkAttendancePayload): Promise<BulkAttendanceResponse | null> {
    try {
      const res = await firstValueFrom(
        this.http.post<BulkAttendanceResponse>(
          `${environment.apiBase}/attendance/bulk-mark`,
          payload,
          { withCredentials: true },
        ),
      );
      return res;
    } catch (error) {
      console.error('Error marking attendance:', error);
      return null;
    }
  }

  // Điểm danh một học sinh
  async markSingleAttendance(classId: string, studentId: string, date: string, status: AttendanceStatus, notes?: string): Promise<boolean> {
    try {
      await firstValueFrom(
        this.http.post(
          `${environment.apiBase}/attendance/mark`,
          {
            classId,
            studentId,
            date,
            status,
            notes: notes || '',
          },
          { withCredentials: true },
        ),
      );
      return true;
    } catch (error) {
      console.error('Error marking single attendance:', error);
      return false;
    }
  }

  async getTeacherClasses(): Promise<TeacherClassAssignment[]> {
    try {
      const res = await firstValueFrom(
        this.http.get<TeacherClassAssignment[]>(`${environment.apiBase}/attendance/teacher/classes`, {
          withCredentials: true,
        }),
      );
      return res;
    } catch (error) {
      console.error('Error loading teacher classes:', error);
      return [];
    }
  }

  async getClassesWithStudents(): Promise<ClassWithStudents[]> {
    try {
      const res = await firstValueFrom(
        this.http.get<ClassWithStudents[]>(`${environment.apiBase}/attendance/classes-with-students`, {
          withCredentials: true,
        }),
      );
      return res;
    } catch (error) {
      console.error('Error loading classes with students:', error);
      return [];
    }
  }

  async getAttendanceReportClasses(
    search?: string,
    limit: number = 50,
  ): Promise<AttendanceReportClassOption[]> {
    try {
      return await firstValueFrom(
        this.http.get<AttendanceReportClassOption[]>(`${environment.apiBase}/attendance/report/classes`, {
          params: this.buildParams({ search, limit }),
          withCredentials: true,
        }),
      );
    } catch (error) {
      console.error('Error loading attendance report classes:', error);
      return [];
    }
  }

  // Cập nhật trạng thái điểm danh
  async updateAttendance(attendanceId: string, status: AttendanceStatus, notes?: string): Promise<boolean> {
    try {
      await firstValueFrom(
        this.http.patch(
          `${environment.apiBase}/attendance/${attendanceId}`,
          {
            status,
            notes: notes || '',
          },
          { withCredentials: true },
        ),
      );
      return true;
    } catch (error) {
      console.error('Error updating attendance:', error);
      return false;
    }
  }

  // Lấy lịch sử điểm danh của học sinh
  async getStudentAttendanceHistory(studentId: string, classId?: string): Promise<any[]> {
    try {
      const res = await firstValueFrom(
        this.http.get<any[]>(`${environment.apiBase}/attendance/student/${studentId}`, {
          params: this.buildParams({ classId }),
          withCredentials: true,
        }),
      );
      return res;
    } catch (error) {
      console.error('Error loading student attendance history:', error);
      return [];
    }
  }

  // Lấy thống kê điểm danh
  async getAttendanceStats(classId: string, startDate: string, endDate: string): Promise<AttendanceStatsResponse | null> {
    try {
      const res = await firstValueFrom(
        this.http.get<AttendanceStatsResponse>(`${environment.apiBase}/attendance/stats/${classId}`, {
          params: this.buildParams({ startDate, endDate }),
          withCredentials: true,
        }),
      );
      
      return res;
    } catch (error) {
      console.error('Error loading attendance stats:', error);
      return null;
    }
  }

  // Helper method để format ngày cho API
  formatDateForAPI(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // Helper method để get status display text
  getStatusDisplayText(status: AttendanceStatus | null): string {
    switch (status) {
      case AttendanceStatus.PRESENT:
        return 'Có mặt';
      case AttendanceStatus.ABSENT:
        return 'Vắng mặt';
      case AttendanceStatus.LATE:
        return 'Đi muộn';
      case AttendanceStatus.EXCUSED:
        return 'Xin phép';
      default:
        return 'Chưa điểm danh';
    }
  }

  // Helper method để get status CSS class
  getStatusClass(status: AttendanceStatus | null): string {
    switch (status) {
      case AttendanceStatus.PRESENT:
        return 'status-present';
      case AttendanceStatus.ABSENT:
        return 'status-absent';
      case AttendanceStatus.LATE:
        return 'status-late';
      case AttendanceStatus.EXCUSED:
        return 'status-excused';
      default:
        return 'status-not-marked';
    }
  }

  // Tạo link điểm danh cho học sinh
  async generateAttendanceLink(
    classId: string,
    studentId: string,
    date: string,
  ): Promise<{ attendanceUrl: string; expiresAt: string }> {
    return firstValueFrom(
      this.http.post<{ attendanceUrl: string; expiresAt: string }>(
        `${environment.apiBase}/attendance/generate-link`,
        { classId, studentId, date },
        { withCredentials: true },
      ),
    );
  }

  // Lấy báo cáo điểm danh tổng hợp (physical attendance — ảnh chụp, check-in) — server-side pagination
  async getAttendanceReport(
    startDate: string,
    endDate: string,
    classId?: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<PaginatedReportResponse<any>> {
    return firstValueFrom(
      this.http.get<PaginatedReportResponse<any>>(`${environment.apiBase}/attendance/report`, {
        params: this.buildParams({ startDate, endDate, classId, page, limit }),
        withCredentials: true,
      }),
    );
  }

  /**
   * GET /reports/teaching
   * Báo cáo giảng dạy tổng hợp (SSOT):
   *   • Nội dung dạy / link record / nhận xét → từ Sessions (SSOT)
   *   • Lương / trạng thái thanh toán         → từ PayrollTransactions (SSOT)
   *   • Ảnh điểm danh / thời gian check-in    → từ Attendance
   */
  async getTeachingReport(params: {
    startDate: string;
    endDate: string;
    classId?: string;
    teacherId?: string;
    page?: number;
    limit?: number;
  }): Promise<PaginatedReportResponse<TeachingReportRow>> {
    return firstValueFrom(
      this.http.get<PaginatedReportResponse<TeachingReportRow>>(`${environment.apiBase}/reports/teaching`, {
        params: this.buildParams(params),
        withCredentials: true,
      }),
    );
  }

  /**
   * PATCH /reports/:attendanceId/inline-update
   * Cập nhật inline với phân luồng SSOT:
   *   • sessionContent / comment / recordLink → Sessions.teachingReport (SSOT)
   *   • imageUrl                              → Attendance.imageUrl     (SSOT)
   */
  async updateReportRow(
    attendanceId: string,
    dto: Partial<Pick<TeachingReportRow, 'sessionContent' | 'comment' | 'recordLink' | 'imageUrl'>>,
  ): Promise<{ success: boolean }> {
    return firstValueFrom(
      this.http.patch<{ success: boolean }>(
        `${environment.apiBase}/reports/${attendanceId}/inline-update`,
        dto,
        { withCredentials: true },
      ),
    );
  }
}
