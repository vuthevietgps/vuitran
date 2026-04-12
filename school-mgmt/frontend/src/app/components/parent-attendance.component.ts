import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { FlowGuideComponent } from './shared/flow-guide.component';

interface AttendanceRecord {
  _id: string;
  studentId: string;
  studentName: string;
  date: string;
  className: string;
  classCode: string;
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
  note: string;
  parentConfirm: boolean;
}

interface StudentStats {
  studentId: string;
  studentName: string;
  totalSessions: number;
  presentCount: number;
  absentCount: number;
  lateCount: number;
  excusedCount: number;
  presentPercent: number;
  absentPercent: number;
  latePercent: number;
}

interface ChildrenAttendanceResponse {
  children: Array<{
    student: {
      _id: string;
      fullName: string;
    };
    records: Array<{
      _id: string;
      date: string;
      status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
      className: string;
      classCode: string;
      notes?: string;
      parentConfirm?: string;
    }>;
  }>;
}

interface ChildrenAttendanceStatsResponse {
  children: Array<{
    student: {
      _id: string;
      fullName: string;
    };
    total: number;
    present: number;
    absent: number;
    late: number;
    presentRate: number;
    absentRate: number;
    lateRate: number;
  }>;
}

@Component({
  selector: 'app-parent-attendance',
  standalone: true,
  imports: [CommonModule, FormsModule, FlowGuideComponent],
  template: `
  <header class="page-header">
    <div>
      <h2>Lich su diem danh</h2>
      <p>Theo doi tinh hinh diem danh cua con.</p>
    </div>
  </header>
  <app-flow-guide featureKey="parent-attendance"></app-flow-guide>

  <!-- Filters -->
  <section class="filters">
    <label class="filter-label">Tu ngay
      <input type="date" [(ngModel)]="fromDate" (ngModelChange)="reload()" />
    </label>
    <label class="filter-label">Den ngay
      <input type="date" [(ngModel)]="toDate" (ngModelChange)="reload()" />
    </label>
    <select [ngModel]="selectedStudentId()" (ngModelChange)="selectedStudentId.set($event)" *ngIf="studentList().length > 1">
      <option value="">Tat ca con</option>
      <option *ngFor="let s of studentList()" [value]="s.studentId">{{s.studentName}}</option>
    </select>
    <button (click)="reload()">Lam moi</button>
  </section>

  <!-- Loading -->
  <p class="loading-text" *ngIf="loading()">Dang tai du lieu...</p>

  <!-- Stats Cards -->
  <section class="stats-grid" *ngIf="filteredStats().length">
    <div class="stat-card" *ngFor="let s of filteredStats()">
      <div class="stat-header">
        <h3 class="stat-name">{{s.studentName}}</h3>
      </div>
      <div class="stat-body">
        <div class="stat-item">
          <div class="stat-value">{{s.totalSessions}}</div>
          <div class="stat-label">Tong buoi</div>
        </div>
        <div class="stat-item present">
          <div class="stat-value">{{s.presentPercent}}%</div>
          <div class="stat-label">Co mat</div>
        </div>
        <div class="stat-item absent">
          <div class="stat-value">{{s.absentPercent}}%</div>
          <div class="stat-label">Vang mat</div>
        </div>
        <div class="stat-item late">
          <div class="stat-value">{{s.latePercent}}%</div>
          <div class="stat-label">Di tre</div>
        </div>
      </div>
    </div>
  </section>

  <!-- Attendance Table per student -->
  <section *ngFor="let s of filteredStats()" class="student-section">
    <h3 class="section-title">{{s.studentName}} <small>({{getStudentRecords(s.studentId).length}} buoi)</small></h3>
    <table class="data" *ngIf="getStudentRecords(s.studentId).length; else emptyStudent">
      <thead><tr>
        <th>Ngay</th>
        <th>Lop</th>
        <th>Ma lop</th>
        <th>Trang thai</th>
        <th>Ghi chu</th>
        <th>PH xac nhan</th>
      </tr></thead>
      <tbody>
        <tr *ngFor="let r of getStudentRecords(s.studentId)">
          <td>{{r.date | date:'dd/MM/yyyy'}}</td>
          <td>{{r.className}}</td>
          <td><code>{{r.classCode}}</code></td>
          <td>
            <span class="badge"
              [style.background]="statusColor(r.status) + '20'"
              [style.color]="statusColor(r.status)">
              {{statusLabel(r.status)}}
            </span>
          </td>
          <td>{{r.note || '-'}}</td>
          <td>
            <span class="confirm-badge" [class.confirmed]="r.parentConfirm" [class.unconfirmed]="!r.parentConfirm">
              {{r.parentConfirm ? 'Da xac nhan' : 'Chua xac nhan'}}
            </span>
          </td>
        </tr>
      </tbody>
    </table>
    <ng-template #emptyStudent><p class="empty-text">Khong co du lieu diem danh.</p></ng-template>
  </section>

  <!-- Empty state when no stats at all -->
  <p class="empty-text" *ngIf="!loading() && filteredStats().length === 0">Khong co du lieu diem danh trong khoang thoi gian nay.</p>
  `,
  styles: [`
    .page-header { display:flex; justify-content:space-between; align-items:center; padding:16px; }
    .page-header h2 { margin:0; color:#0f172a; }
    .page-header p { margin:4px 0 0; color:#64748b; font-size:13px; }
    .filters { display:flex; gap:10px; padding:0 16px 16px; flex-wrap:wrap; align-items:flex-end; }
    .filter-label { display:flex; flex-direction:column; gap:4px; font-size:13px; color:#334155; }
    input, select { padding:6px 8px; border:1px solid #cbd5e1; border-radius:4px; font-size:13px; }
    button { padding:6px 14px; border:1px solid #cbd5e1; border-radius:4px; background:#fff; cursor:pointer; font-size:13px; }
    button:hover { background:#f1f5f9; }
    .loading-text { padding:16px; color:#64748b; font-size:13px; }

    /* Stats cards */
    .stats-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(300px, 1fr)); gap:16px; padding:0 16px 16px; }
    .stat-card { background:#fff; border-radius:8px; border:1px solid #e2e8f0; overflow:hidden; }
    .stat-header { padding:12px 16px; background:#f8fafc; border-bottom:1px solid #e2e8f0; }
    .stat-name { margin:0; font-size:15px; color:#0f172a; }
    .stat-body { display:grid; grid-template-columns:1fr 1fr 1fr 1fr; gap:0; }
    .stat-item { padding:12px 16px; text-align:center; border-right:1px solid #e2e8f0; }
    .stat-item:last-child { border-right:none; }
    .stat-value { font-size:20px; font-weight:700; color:#0f172a; }
    .stat-label { font-size:11px; color:#64748b; margin-top:2px; }
    .stat-item.present .stat-value { color:#059669; }
    .stat-item.absent .stat-value { color:#dc2626; }
    .stat-item.late .stat-value { color:#d97706; }

    /* Student section */
    .student-section { padding:0 16px 16px; }
    .section-title { color:#334155; font-size:15px; margin:8px 0; }
    .section-title small { color:#94a3b8; font-weight:400; font-size:13px; }

    /* Data table */
    .data { width:100%; border-collapse:collapse; background:#fff; font-size:13px; }
    th, td { padding:8px 10px; border:1px solid #e2e8f0; }
    thead { background:#f1f5f9; font-size:12px; text-transform:uppercase; color:#64748b; }

    /* Badges */
    .badge { font-size:11px; padding:2px 8px; border-radius:9px; font-weight:600; white-space:nowrap; }
    .confirm-badge { font-size:11px; padding:2px 8px; border-radius:9px; font-weight:600; }
    .confirm-badge.confirmed { background:#d1fae520; color:#059669; }
    .confirm-badge.unconfirmed { background:#fef2f220; color:#94a3b8; }

    .empty-text { padding:16px; color:#64748b; font-size:13px; }
  `]
})
export class ParentAttendanceComponent implements OnInit {
  private http = inject(HttpClient);
  private apiBase = environment.apiBase;

  records = signal<AttendanceRecord[]>([]);
  stats = signal<StudentStats[]>([]);
  loading = signal(false);

  fromDate = '';
  toDate = '';
  selectedStudentId = signal('');

  studentList = computed(() => {
    const map = new Map<string, string>();
    for (const s of this.stats()) {
      map.set(s.studentId, s.studentName);
    }
    return Array.from(map.entries()).map(([studentId, studentName]) => ({ studentId, studentName }));
  });

  filteredStats = computed(() => {
    const all = this.stats();
    const selectedStudentId = this.selectedStudentId();
    if (!selectedStudentId) return all;
    return all.filter(s => s.studentId === selectedStudentId);
  });

  ngOnInit() {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    this.fromDate = this.formatDate(new Date(y, m, 1));
    this.toDate = this.formatDate(new Date(y, m + 1, 0));
    this.reload();
  }

  async reload() {
    this.loading.set(true);
    try {
      await Promise.all([this.loadRecords(), this.loadStats()]);
    } finally {
      this.loading.set(false);
    }
  }

  private async loadRecords() {
    const params: any = {};
    if (this.fromDate) params.fromDate = this.fromDate;
    if (this.toDate) params.toDate = this.toDate;
    try {
      const response = await firstValueFrom(
        this.http.get<ChildrenAttendanceResponse>(`${this.apiBase}/attendance/my-children`, {
          params,
          withCredentials: true,
        })
      );
      const records = (response?.children || []).flatMap((child) =>
        (child.records || []).map((record) => ({
          _id: record._id,
          studentId: child.student._id,
          studentName: child.student.fullName,
          date: record.date,
          className: record.className || '',
          classCode: record.classCode || '',
          status: record.status,
          note: record.notes || '',
          parentConfirm: String(record.parentConfirm || '').toUpperCase() === 'OK',
        })),
      );
      this.records.set(records);
    } catch {
      this.records.set([]);
    }
  }

  private async loadStats() {
    const params: any = {};
    if (this.fromDate) params.fromDate = this.fromDate;
    if (this.toDate) params.toDate = this.toDate;

    try {
      const response = await firstValueFrom(
        this.http.get<ChildrenAttendanceStatsResponse>(`${this.apiBase}/attendance/my-children/stats`, {
          params,
          withCredentials: true,
        })
      );
      const stats = (response?.children || []).map((item) => {
        const total = Number(item.total || 0);
        const present = Number(item.present || 0);
        const absent = Number(item.absent || 0);
        const late = Number(item.late || 0);
        const excused = Math.max(0, total - present - absent - late);

        return {
          studentId: item.student._id,
          studentName: item.student.fullName,
          totalSessions: total,
          presentCount: present,
          absentCount: absent,
          lateCount: late,
          excusedCount: excused,
          presentPercent: Number(item.presentRate ?? (total > 0 ? Math.round((present / total) * 100) : 0)),
          absentPercent: Number(item.absentRate ?? (total > 0 ? Math.round((absent / total) * 100) : 0)),
          latePercent: Number(item.lateRate ?? (total > 0 ? Math.round((late / total) * 100) : 0)),
        } as StudentStats;
      });
      this.stats.set(stats);
    } catch {
      this.stats.set([]);
    }
  }

  getStudentRecords(studentId: string): AttendanceRecord[] {
    return this.records().filter(r => r.studentId === studentId);
  }

  statusLabel(status: string): string {
    const labels: Record<string, string> = {
      PRESENT: 'Co mat',
      ABSENT: 'Vang mat',
      LATE: 'Di tre',
      EXCUSED: 'Co phep',
    };
    return labels[status] || status;
  }

  statusColor(status: string): string {
    const colors: Record<string, string> = {
      PRESENT: '#059669',
      ABSENT: '#dc2626',
      LATE: '#d97706',
      EXCUSED: '#6b7280',
    };
    return colors[status] || '#64748b';
  }

  private formatDate(d: Date): string {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
}
