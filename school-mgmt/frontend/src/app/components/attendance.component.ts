import { CommonModule } from '@angular/common';
import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  AttendanceByClassResponse,
  AttendanceService,
  AttendanceStatus,
  BulkAttendancePayload,
  StudentAttendanceItem,
} from '../services/attendance.service';
import { ClassItem } from '../services/class.service';
import { FlowGuideComponent } from './shared/flow-guide.component';

@Component({
  selector: 'app-attendance',
  standalone: true,
  imports: [CommonModule, FormsModule, FlowGuideComponent],
  template: `
  <header class="page-header">
    <div>
      <h2>Quan ly diem danh</h2>
      <p>Chi ghi nhan hoc sinh co mat. Hoc sinh nghi se duoc giu o trang thai chua diem danh.</p>
    </div>
  </header>
  <app-flow-guide featureKey="attendance"></app-flow-guide>

  <div class="attendance-controls">
    <div class="control-group">
      <label>
        Chon lop hoc:
        <select [(ngModel)]="selectedClassId" (change)="onClassChange()" [disabled]="loading()">
          <option value="">-- Chon lop hoc --</option>
          <option *ngFor="let cls of classes()" [value]="cls._id">
            {{ cls.code }} - {{ cls.name }} ({{ cls.studentCount || cls.students?.length || 0 }} hoc sinh)
          </option>
        </select>
      </label>
    </div>

    <div class="control-group">
      <label>
        Ngay diem danh:
        <input
          type="date"
          [(ngModel)]="selectedDate"
          (change)="onDateChange()"
          [disabled]="loading() || !selectedClassId"
          [max]="todayString"
        />
      </label>
    </div>

    <div class="control-group" *ngIf="selectedClassId && selectedDate">
      <button class="primary" (click)="loadAttendance()" [disabled]="loading()">
        {{ loading() ? 'Dang tai...' : 'Tai danh sach' }}
      </button>
    </div>
  </div>

  <div class="error" *ngIf="error()">{{ error() }}</div>

  <div class="attendance-content" *ngIf="attendanceData()">
    <div class="class-info">
      <h3>{{ attendanceData()?.class?.code }} - {{ attendanceData()?.class?.name }}</h3>
      <p>Ngay: {{ formatDate(attendanceData()?.date) }}</p>
    </div>

    <div class="attendance-summary" *ngIf="attendanceData()?.attendanceList?.length">
      <div class="summary-stats">
        <span class="stat present">Co mat: {{ getStatusCount(AttendanceStatus.PRESENT) }}</span>
        <span class="stat not-marked">Chua diem danh: {{ getStatusCount(null) }}</span>
      </div>
    </div>

    <div class="attendance-actions" *ngIf="attendanceData()?.attendanceList?.length">
      <button class="secondary" (click)="markAllPresent()" [disabled]="saving()">
        Danh dau tat ca co mat
      </button>
      <button class="primary" (click)="saveAttendance()" [disabled]="saving() || !hasChanges()">
        {{ saving() ? 'Dang luu...' : 'Luu diem danh' }}
      </button>
    </div>

    <div class="attendance-list" *ngIf="attendanceData()?.attendanceList?.length; else noStudents">
      <div class="student-card" *ngFor="let item of attendanceData()?.attendanceList; trackBy: trackByStudentId">
        <div class="student-info">
          <h4>{{ item.student.fullName }}</h4>
          <p>Tuoi: {{ item.student.age }} - Phu huynh: {{ item.student.parentName }}</p>
        </div>

        <div class="student-actions">
          <button
            class="btn-link"
            (click)="generateLinkForStudent(item.student._id)"
            [disabled]="!selectedDate || generatingLink === item.student._id"
            title="Tao link diem danh cho hoc sinh"
          >
            {{ generatingLink === item.student._id ? 'Dang tao...' : 'Tao link' }}
          </button>
        </div>

        <div class="attendance-controls-inline">
          <div class="status-selector">
            <button
              type="button"
              class="status-button present"
              [class.active]="item.attendance.status === AttendanceStatus.PRESENT"
              (click)="setStatus(item, AttendanceStatus.PRESENT)"
            >
              Co mat
            </button>

            <button
              type="button"
              class="status-button neutral"
              [class.active]="item.attendance.status === null"
              (click)="setStatus(item, null)"
            >
              Chua diem danh
            </button>
          </div>
        </div>
      </div>
    </div>

    <ng-template #noStudents>
      <p class="no-data">Lop hoc nay chua co hoc sinh nao.</p>
    </ng-template>
  </div>
  `,
  styles: [`
    .page-header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:24px; }
    .page-header h2 { margin:0 0 4px 0; color:#1e293b; }
    .page-header p { margin:0; color:#64748b; }

    .attendance-controls { display:flex; flex-wrap:wrap; gap:16px; margin-bottom:24px; padding:16px; background:#f8fafc; border-radius:8px; border:1px solid #e2e8f0; }
    .control-group { display:flex; flex-direction:column; }
    .control-group label { font-weight:500; color:#374151; margin-bottom:4px; }
    .control-group select, .control-group input { padding:8px 12px; border:1px solid #d1d5db; border-radius:6px; font-size:14px; min-width:200px; }
    .control-group button { padding:8px 16px; border:none; border-radius:6px; font-weight:500; cursor:pointer; }
    .control-group button.primary { background:#2563eb; color:#fff; }
    .control-group button:disabled { opacity:0.5; cursor:not-allowed; }

    .error { color:#dc2626; background:#fef2f2; padding:12px; border-radius:6px; border:1px solid #fecaca; margin-bottom:16px; }
    .class-info { margin-bottom:20px; }
    .class-info h3 { margin:0 0 4px 0; color:#1e293b; }
    .class-info p { margin:0; color:#64748b; }

    .attendance-summary { margin-bottom:20px; }
    .summary-stats { display:flex; flex-wrap:wrap; gap:16px; }
    .stat { padding:8px 12px; border-radius:6px; font-size:14px; font-weight:500; }
    .stat.present { background:#dcfce7; color:#16a34a; }
    .stat.not-marked { background:#f1f5f9; color:#64748b; }

    .attendance-actions { display:flex; gap:12px; margin-bottom:24px; }
    .attendance-actions button { padding:10px 20px; border:none; border-radius:6px; font-weight:500; cursor:pointer; }
    .attendance-actions button.primary { background:#2563eb; color:#fff; }
    .attendance-actions button.secondary { background:#6b7280; color:#fff; }
    .attendance-actions button:disabled { opacity:0.5; cursor:not-allowed; }

    .attendance-list { display:flex; flex-direction:column; gap:16px; }
    .student-card { background:#fff; border:1px solid #e5e7eb; border-radius:8px; padding:20px; }
    .student-info h4 { margin:0 0 4px 0; color:#1f2937; }
    .student-info p { margin:0; color:#6b7280; font-size:14px; }

    .student-actions { margin:12px 0; }
    .btn-link {
      background:#1d4ed8;
      color:#fff;
      border:none;
      padding:8px 16px;
      border-radius:6px;
      font-size:14px;
      font-weight:500;
      cursor:pointer;
      transition:all 0.2s;
    }
    .btn-link:hover:not(:disabled) { background:#1e40af; transform:translateY(-1px); }
    .btn-link:disabled { opacity:0.5; cursor:not-allowed; }

    .attendance-controls-inline { margin-top:16px; }
    .status-selector { display:flex; flex-wrap:wrap; gap:12px; }
    .status-button { border:1px solid #cbd5e1; background:#fff; color:#334155; padding:8px 14px; border-radius:999px; font-size:14px; font-weight:600; cursor:pointer; }
    .status-button.present.active { background:#dcfce7; border-color:#86efac; color:#166534; }
    .status-button.neutral.active { background:#f1f5f9; border-color:#cbd5e1; color:#475569; }

    .no-data { text-align:center; color:#6b7280; font-style:italic; padding:32px; }
  `],
})
export class AttendanceComponent {
  readonly AttendanceStatus = AttendanceStatus;

  classes = signal<ClassItem[]>([]);
  attendanceData = signal<AttendanceByClassResponse | null>(null);
  loading = signal(false);
  saving = signal(false);
  error = signal('');
  generatingLink = '';

  selectedClassId = '';
  selectedDate = '';
  todayString = '';

  private originalAttendanceData = new Map<string, AttendanceStatus | null>();

  constructor(private attendanceService: AttendanceService) {
    this.todayString = this.formatLocalDateInput(new Date());
    this.selectedDate = this.todayString;
    this.loadClasses();
  }

  async loadClasses() {
    try {
      const classes = await this.attendanceService.getClassesWithStudents();

      const availableClasses: ClassItem[] = classes
        .map<ClassItem>((cls) => ({
          _id: cls.classId,
          name: cls.className || cls.classCode,
          code: cls.classCode,
          students: cls.students.map((student) => ({
            _id: student.studentId,
            fullName: student.fullName,
            age: student.age,
            parentName: student.parentName,
          })),
          studentCount: cls.studentCount,
        }))
        .sort((a, b) => (a.code || '').localeCompare(b.code || '', 'vi', { sensitivity: 'base' }));

      this.classes.set(availableClasses);

      if (this.selectedClassId && !availableClasses.some((cls) => cls._id === this.selectedClassId)) {
        this.selectedClassId = '';
        this.attendanceData.set(null);
      }
    } catch (error) {
      this.error.set('Khong the tai danh sach lop hoc');
      console.error('Error loading classes:', error);
    }
  }

  onClassChange() {
    this.attendanceData.set(null);
    this.error.set('');
    if (this.selectedClassId && this.selectedDate) {
      this.loadAttendance();
    }
  }

  onDateChange() {
    this.attendanceData.set(null);
    this.error.set('');
    if (this.selectedClassId && this.selectedDate) {
      this.loadAttendance();
    }
  }

  async loadAttendance() {
    if (!this.selectedClassId || !this.selectedDate) return;

    this.loading.set(true);
    this.error.set('');

    try {
      const data = await this.attendanceService.getAttendanceByClass(
        this.selectedClassId,
        this.selectedDate,
      );

      if (data) {
        const normalized = this.normalizeAttendanceData(data);
        this.attendanceData.set(normalized);
        this.saveOriginalData(normalized);
      } else {
        const selectedClass = this.classes().find((cls) => cls._id === this.selectedClassId);
        if (!selectedClass) {
          this.error.set('Khong tim thay thong tin lop hoc');
          return;
        }

        const fallback: AttendanceByClassResponse = {
          class: {
            _id: selectedClass._id,
            name: selectedClass.name,
            code: selectedClass.code,
          },
          date: this.selectedDate,
          attendanceList: (selectedClass.students || []).map((student) => ({
            student: {
              _id: student._id,
              fullName: student.fullName,
              age: (student as any).age || null,
              parentName: (student as any).parentName || '',
            },
            attendance: {
              classId: selectedClass._id,
              studentId: student._id,
              date: this.selectedDate,
              status: null,
              notes: '',
            },
          })),
        };
        this.attendanceData.set(fallback);
        this.saveOriginalData(fallback);
      }
    } catch (error) {
      this.error.set('Co loi xay ra khi tai du lieu diem danh');
      console.error('Error loading attendance:', error);
    } finally {
      this.loading.set(false);
    }
  }

  private normalizeAttendanceData(data: AttendanceByClassResponse): AttendanceByClassResponse {
    return {
      ...data,
      attendanceList: data.attendanceList.map((item) => ({
        ...item,
        attendance: {
          ...item.attendance,
          status:
            item.attendance.status === AttendanceStatus.PRESENT
              ? AttendanceStatus.PRESENT
              : null,
          notes: '',
        },
      })),
    };
  }

  private saveOriginalData(data: AttendanceByClassResponse) {
    this.originalAttendanceData.clear();
    data.attendanceList.forEach((item) => {
      this.originalAttendanceData.set(item.student._id, item.attendance.status);
    });
  }

  setStatus(item: StudentAttendanceItem, status: AttendanceStatus | null) {
    item.attendance.status = status;
    this.onStatusChange(item);
  }

  onStatusChange(item: StudentAttendanceItem) {
    item.attendance.notes = '';
  }

  markAllPresent() {
    const data = this.attendanceData();
    if (!data) return;

    data.attendanceList.forEach((item) => {
      item.attendance.status = AttendanceStatus.PRESENT;
      item.attendance.notes = '';
    });

    this.attendanceData.set({ ...data, attendanceList: [...data.attendanceList] });
  }

  hasChanges(): boolean {
    const data = this.attendanceData();
    if (!data) return false;

    return data.attendanceList.some(
      (item) => this.originalAttendanceData.get(item.student._id) !== item.attendance.status,
    );
  }

  async saveAttendance() {
    const data = this.attendanceData();
    if (!data || !this.hasChanges()) return;

    this.saving.set(true);
    this.error.set('');

    try {
      const attendances = data.attendanceList.map((item) => ({
        studentId: item.student._id,
        status: item.attendance.status,
        notes: '',
      }));

      const payload: BulkAttendancePayload = {
        classId: this.selectedClassId,
        date: this.selectedDate,
        attendances,
      };

      const result = await this.attendanceService.bulkMarkAttendance(payload);

      if (result) {
        await this.loadAttendance();

        if (result.totalErrors > 0) {
          const studentNameMap = new Map(
            data.attendanceList.map((item) => [item.student._id, item.student.fullName]),
          );
          const preview = result.errors
            .slice(0, 3)
            .map((e) => `${studentNameMap.get(e.studentId) || e.studentId}: ${e.message}`)
            .join(' | ');
          const more = result.totalErrors > 3 ? ` (va ${result.totalErrors - 3} loi khac)` : '';
          this.error.set(
            `Da luu mot phan diem danh. Co ${result.totalErrors} hoc sinh loi. ${preview}${more}`,
          );
        }
      } else {
        this.error.set('Khong the luu diem danh. Vui long thu lai.');
      }
    } catch (error) {
      this.error.set('Co loi xay ra khi luu diem danh');
      console.error('Error saving attendance:', error);
    } finally {
      this.saving.set(false);
    }
  }

  getStatusCount(status: AttendanceStatus | null): number {
    const data = this.attendanceData();
    if (!data?.attendanceList) return 0;
    return data.attendanceList.filter((item) => item.attendance.status === status).length;
  }

  formatDate(dateStr?: string): string {
    if (!dateStr) return '';

    const date = new Date(dateStr);
    return date.toLocaleDateString('vi-VN', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  trackByStudentId(index: number, item: StudentAttendanceItem): string {
    return item.student._id;
  }

  private formatLocalDateInput(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  async generateLinkForStudent(studentId: string) {
    if (!this.selectedClassId || !this.selectedDate) {
      alert('Vui long chon lop va ngay truoc khi tao link');
      return;
    }

    this.generatingLink = studentId;
    this.error.set('');

    try {
      const result = await this.attendanceService.generateAttendanceLink(
        this.selectedClassId,
        studentId,
        this.selectedDate,
      );

      let copiedToClipboard = false;
      try {
        await navigator.clipboard.writeText(result.attendanceUrl);
        copiedToClipboard = true;
      } catch {
        copiedToClipboard = false;
      }

      const studentName = this.attendanceData()?.attendanceList.find(
        (item) => item.student._id === studentId,
      )?.student.fullName;

      const copyMessage = copiedToClipboard
        ? 'Link da duoc copy vao clipboard:'
        : 'Khong the tu dong copy. Vui long copy link thu cong:';

      alert(
        `Da tao link diem danh cho ${studentName}.\n\n${copyMessage}\n${result.attendanceUrl}\n\nHan su dung: ${new Date(result.expiresAt).toLocaleString('vi-VN')}`,
      );
    } catch (error: any) {
      const backendMessage = Array.isArray(error?.error?.message)
        ? error.error.message.join(', ')
        : error?.error?.message;
      let message =
        backendMessage ||
        error?.message ||
        'Khong the tao link diem danh';

      if (error?.status === 403 && /csrf/i.test(message)) {
        message = 'Phien bao mat da het han. Vui long tai lai trang roi thu lai.';
      }

      this.error.set(message);
      alert('Loi: ' + message);
    } finally {
      this.generatingLink = '';
    }
  }
}
