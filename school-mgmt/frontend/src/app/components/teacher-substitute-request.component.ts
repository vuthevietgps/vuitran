import { Component, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from '../services/auth.service';

import { FlowGuideComponent } from './shared/flow-guide.component';

const STATUS_LABELS: Record<string, string> = {
  OPEN: 'Mới tạo',
  IN_PROGRESS: 'Đang xử lý',
  WAITING_INFO: 'Chờ thông tin',
  RESOLVED: 'Đã giải quyết',
  CLOSED: 'Đã đóng',
  CANCELLED: 'Đã hủy',
};

const STATUS_COLORS: Record<string, string> = {
  OPEN: '#3b82f6',
  IN_PROGRESS: '#f59e0b',
  WAITING_INFO: '#f59e0b',
  RESOLVED: '#10b981',
  CLOSED: '#6b7280',
  CANCELLED: '#ef4444',
};

const PRIORITY_LABELS: Record<string, string> = {
  LOW: 'Thấp',
  MEDIUM: 'Trung bình',
  HIGH: 'Cao',
  URGENT: 'Khẩn cấp',
};

@Component({
  selector: 'app-teacher-substitute-request',
  standalone: true,
  imports: [CommonModule, FormsModule, FlowGuideComponent],
  template: `
  <header class="page-header">
    <div>
      <h2>Yêu cầu giáo viên dạy thay</h2>
      <p>Tạo và theo dõi yêu cầu GV dạy thay khi bạn vắng mặt.</p>
    </div>
    <button class="primary" (click)="openCreate()">+ Tạo yêu cầu</button>
  </header>

  <app-flow-guide featureKey="teacher-substitute"></app-flow-guide>

  <!-- Stats -->
  <section class="stats">
    <div class="stat-card total">
      <div class="stat-value">{{ tickets().length }}</div>
      <div class="stat-label">Tổng yêu cầu</div>
    </div>
    <div class="stat-card open">
      <div class="stat-value">{{ countByStatus('OPEN') }}</div>
      <div class="stat-label">Mới tạo</div>
    </div>
    <div class="stat-card in-progress">
      <div class="stat-value">{{ countByStatus('IN_PROGRESS') }}</div>
      <div class="stat-label">Đang xử lý</div>
    </div>
    <div class="stat-card resolved">
      <div class="stat-value">{{ countByStatus('RESOLVED') }}</div>
      <div class="stat-label">Đã giải quyết</div>
    </div>
  </section>

  <!-- Request list -->
  <table class="data" *ngIf="tickets().length; else empty">
    <thead>
      <tr>
        <th>Lớp</th>
        <th>Từ ngày</th>
        <th>Đến ngày</th>
        <th>Lý do</th>
        <th>Trạng thái</th>
        <th>Ngày tạo</th>
      </tr>
    </thead>
    <tbody>
      <tr *ngFor="let t of tickets()">
        <td><strong>{{ getClassName(t) }}</strong></td>
        <td>{{ getFromDate(t) | date:'dd/MM/yyyy' }}</td>
        <td>{{ getToDate(t) | date:'dd/MM/yyyy' }}</td>
        <td class="desc-cell">{{ t.description }}</td>
        <td>
          <span class="badge"
            [style.background]="statusColor(t.status) + '20'"
            [style.color]="statusColor(t.status)">
            {{ statusLabel(t.status) }}
          </span>
        </td>
        <td>{{ t.createdAt | date:'dd/MM/yyyy HH:mm' }}</td>
      </tr>
    </tbody>
  </table>
  <ng-template #empty>
    <p class="empty-text">Chưa có yêu cầu dạy thay nào.</p>
  </ng-template>

  <!-- Create Modal -->
  <div class="modal-backdrop" *ngIf="showModal()">
    <div class="modal">
      <h3>Tạo yêu cầu GV dạy thay</h3>
      <form (ngSubmit)="submitForm()">
        <label>Lớp học <span class="req">*</span>
          <select name="classId" [(ngModel)]="form.classId" required>
            <option value="" disabled>-- Chọn lớp --</option>
            <option *ngFor="let c of classes()" [value]="c._id">{{ c.name }}</option>
          </select>
        </label>
        <div class="form-grid">
          <label>Từ ngày <span class="req">*</span>
            <input name="fromDate" type="date" [(ngModel)]="form.fromDate" required />
          </label>
          <label>Đến ngày <span class="req">*</span>
            <input name="toDate" type="date" [(ngModel)]="form.toDate" required />
          </label>
        </div>
        <label>Lý do <span class="req">*</span>
          <textarea name="reason" [(ngModel)]="form.reason" required rows="3"
            placeholder="Nhập lý do xin dạy thay..."></textarea>
        </label>
        <div class="form-actions">
          <button type="submit" class="primary" [disabled]="submitting()">
            {{ submitting() ? 'Đang gửi...' : 'Gửi yêu cầu' }}
          </button>
          <button type="button" (click)="closeModal()">Hủy</button>
        </div>
        <p class="error" *ngIf="error()">{{ error() }}</p>
        <p class="success-msg" *ngIf="successMsg()">{{ successMsg() }}</p>
      </form>
    </div>
  </div>
  `,
  styles: [`
    .page-header { display:flex; justify-content:space-between; align-items:center; padding:16px; }
    h2 { margin:0 0 4px; font-size:20px; color:#0f172a; }
    p { margin:0; font-size:13px; color:#64748b; }

    .stats { display:flex; gap:12px; padding:0 16px 16px; flex-wrap:wrap; }
    .stat-card { background:#fff; padding:14px 18px; border-radius:8px; min-width:130px; border-left:4px solid #e2e8f0; }
    .stat-card.total { background:#f0f9ff; border-left-color:#3b82f6; }
    .stat-card.open { background:#dbeafe; border-left-color:#3b82f6; }
    .stat-card.in-progress { background:#fef3c7; border-left-color:#f59e0b; }
    .stat-card.resolved { background:#d1fae5; border-left-color:#10b981; }
    .stat-value { font-size:22px; font-weight:700; color:#0f172a; }
    .stat-label { font-size:12px; color:#64748b; margin-top:2px; }

    .data { width:100%; border-collapse:collapse; background:#fff; font-size:13px; }
    th, td { padding:8px 10px; border:1px solid #e2e8f0; }
    thead { background:#f1f5f9; font-size:12px; text-transform:uppercase; color:#64748b; }
    .desc-cell { max-width:260px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }

    .badge { font-size:11px; padding:2px 8px; border-radius:9px; font-weight:600; white-space:nowrap; }

    .modal-backdrop { position:fixed; inset:0; background:rgba(15,23,42,.55); display:flex; align-items:center; justify-content:center; z-index:100; }
    .modal { background:#fff; padding:24px; border-radius:8px; max-width:520px; width:95%; box-shadow:0 8px 24px rgba(15,23,42,.2); max-height:90vh; overflow-y:auto; }
    .modal h3 { margin:0 0 16px; font-size:16px; color:#0f172a; }

    .form-grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin:8px 0; }
    label { display:flex; flex-direction:column; gap:4px; font-size:13px; color:#334155; margin-bottom:8px; }
    .req { color:#dc2626; }
    input, select, textarea { padding:6px 8px; border:1px solid #cbd5e1; border-radius:4px; font-size:13px; }
    textarea { width:100%; resize:vertical; }

    .form-actions { display:flex; gap:8px; justify-content:flex-end; margin-top:12px; }
    .primary { background:#2563eb; color:#fff; border:none; padding:8px 14px; border-radius:4px; cursor:pointer; font-weight:600; }
    .primary:hover { background:#1d4ed8; }
    .primary:disabled { opacity:0.5; cursor:default; }
    .form-actions button[type=button] { padding:8px 14px; border:1px solid #cbd5e1; border-radius:4px; background:#fff; cursor:pointer; }

    .error { color:#dc2626; font-size:13px; margin-top:8px; }
    .success-msg { color:#10b981; font-size:13px; margin-top:8px; font-weight:600; }
    .empty-text { padding:24px 16px; color:#64748b; text-align:center; }
  `]
})
export class TeacherSubstituteRequestComponent implements OnInit {
  classes = signal<any[]>([]);
  tickets = signal<any[]>([]);
  showModal = signal(false);
  error = signal('');
  successMsg = signal('');
  submitting = signal(false);

  form = { classId: '', fromDate: '', toDate: '', reason: '' };

  private api = environment.apiBase;

  constructor(private http: HttpClient, private auth: AuthService) {}

  ngOnInit() {
    this.loadClasses();
    this.loadTickets();
  }

  statusLabel(s: string) { return STATUS_LABELS[s] || s; }
  statusColor(s: string) { return STATUS_COLORS[s] || '#64748b'; }

  countByStatus(status: string): number {
    return this.tickets().filter(t => t.status === status).length;
  }

  getClassName(ticket: any): string {
    const classRef = ticket.classId;
    if (classRef?.name) return classRef.name;
    if (typeof classRef === 'string') return classRef;
    return '—';
  }

  getFromDate(ticket: any): string {
    return ticket.substituteFromDate || '';
  }

  getToDate(ticket: any): string {
    return ticket.substituteToDate || '';
  }

  async loadClasses() {
    try {
      const res: any = await firstValueFrom(
        this.http.get(`${this.api}/classes`, { withCredentials: true })
      );
      const data = Array.isArray(res) ? res : (res?.data ?? []);
      this.classes.set(data);
    } catch (err) {
      console.error('Error loading classes', err);
    }
  }

  async loadTickets() {
    try {
      const res: any = await firstValueFrom(
        this.http.get(`${this.api}/tickets/my-tickets`, { withCredentials: true })
      );
      const data = Array.isArray(res) ? res : (res?.data ?? []);
      // Filter only SUBSTITUTE_TEACHER tickets
      this.tickets.set(data.filter((t: any) => t.type === 'SUBSTITUTE_TEACHER'));
    } catch (err) {
      console.error('Error loading tickets', err);
    }
  }

  openCreate() {
    this.form = { classId: '', fromDate: '', toDate: '', reason: '' };
    this.error.set('');
    this.successMsg.set('');
    this.showModal.set(true);
  }

  closeModal() {
    this.showModal.set(false);
  }

  async submitForm() {
    if (!this.form.classId || !this.form.fromDate || !this.form.toDate || !this.form.reason.trim()) {
      this.error.set('Vui lòng điền đầy đủ thông tin.');
      return;
    }

    if (this.form.toDate < this.form.fromDate) {
      this.error.set('Ngày kết thúc phải sau ngày bắt đầu.');
      return;
    }

    this.submitting.set(true);
    this.error.set('');
    this.successMsg.set('');

    const selectedClass = this.classes().find(c => c._id === this.form.classId);
    const className = selectedClass?.name || '';

    const payload = {
      type: 'SUBSTITUTE_TEACHER',
      subject: `Yêu cầu GV dạy thay - ${className}`,
      description: this.form.reason,
      priority: 'HIGH',
      classId: this.form.classId,
      teacherId: this.auth.userSignal()?.sub,
      substituteFromDate: this.form.fromDate,
      substituteToDate: this.form.toDate,
    };

    try {
      await firstValueFrom(
        this.http.post(`${this.api}/tickets`, payload, { withCredentials: true })
      );
      this.successMsg.set('Gửi yêu cầu thành công!');
      this.loadTickets();
      setTimeout(() => this.closeModal(), 1200);
    } catch (err: any) {
      this.error.set(err?.error?.message || 'Gửi yêu cầu thất bại. Vui lòng thử lại.');
    } finally {
      this.submitting.set(false);
    }
  }
}
