import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SessionItem } from '../../services/session.service';
import { ReportTemplate } from '../../services/report-template.service';
import {
  TeachingReportFormComponent,
  ReportFormValues,
} from './teaching-report-form.component';

export interface PendingMeta {
  total: number;
  page: number;
  totalPages: number;
}

@Component({
  selector: 'app-teaching-report-pending',
  standalone: true,
  imports: [CommonModule, TeachingReportFormComponent],
  template: `
    <div *ngIf="sessions.length === 0" class="empty">
      🎉 Tất cả buổi học đã có báo cáo!
    </div>

    <div *ngFor="let s of sessions; trackBy: trackById"
         class="session-card"
         [class.editing]="editingId === s._id">

      <div class="session-header" (click)="canEdit && toggleEdit(s)">
        <div class="session-info">
          <span class="badge warning">Chưa có báo cáo</span>
          <span *ngIf="!teacherView">GV: {{ s.teacherId.fullName || 'N/A' }}</span>
          <span *ngIf="!teacherView" class="divider">|</span>
          <strong>{{ s.classId.name || 'N/A' }}</strong>
          <span class="divider">|</span>
          <span>HS: {{ s.studentId.fullName || 'N/A' }}</span>
          <span class="divider">|</span>
          <span>{{ s.scheduledDate | date:'dd/MM/yyyy' }}</span>
          <span class="divider">|</span>
          <span class="deadline-badge"
                [class.overdue]="isOverDeadline(s)"
                [class.near-deadline]="isNearDeadline(s)">
            {{ isOverDeadline(s) ? 'Trễ ' + getOverdueHours(s) + 'h' : 'Còn ' + getRemainingHours(s) + 'h' }}
          </span>
          <span class="divider">|</span>
          <span>{{ s.durationMinutes || 60 }} phút</span>
          <span *ngIf="teacherView" class="divider">|</span>
          <span *ngIf="teacherView">Lương: {{ formatCurrency(s.teacherPayout) }}</span>
          <span class="divider">|</span>
          <span class="badge" [attr.data-status]="s.status">{{ statusLabel(s.status) }}</span>
        </div>
        <button *ngIf="canEdit" class="btn-expand" type="button"
                (click)="$event.stopPropagation(); toggleEdit(s)">
          {{ editingId === s._id ? '▲ Thu gọn' : '▼ Điền báo cáo' }}
        </button>
      </div>

      <div *ngIf="canEdit && editingId === s._id" class="report-form-wrapper">
        <app-teaching-report-form
          [templates]="templates"
          [submitting]="submitting"
          submitLabel="📤 Nộp báo cáo"
          (formSubmit)="onSubmit(s._id, $event)"
          (formCancel)="editingId = ''">
        </app-teaching-report-form>
      </div>
    </div>

    <!-- Pagination -->
    <div class="pagination" *ngIf="meta.totalPages > 1">
      <button (click)="pageChange.emit(meta.page - 1)" [disabled]="meta.page <= 1">← Trước</button>
      <span>Trang {{ meta.page }} / {{ meta.totalPages }}</span>
      <button (click)="pageChange.emit(meta.page + 1)" [disabled]="meta.page >= meta.totalPages">Sau →</button>
    </div>
  `,
  styles: [`
    .empty { text-align: center; padding: 40px; color: #94a3b8; font-size: 15px; }
    .session-card {
      background: #fff; border-radius: 10px; margin-bottom: 10px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.06); border-left: 4px solid #f97316; overflow: hidden;
    }
    .session-card.editing { border-left-color: #2563eb; }
    .session-header {
      display: flex; justify-content: space-between; align-items: center;
      padding: 14px 18px; cursor: pointer; transition: background 0.15s;
    }
    .session-header:hover { background: #f8fafc; }
    .session-info { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: 13px; color: #475569; }
    .session-info strong { color: #1e293b; }
    .divider { color: #cbd5e1; }
    .badge { padding: 2px 8px; border-radius: 99px; font-size: 11px; font-weight: 600; }
    .badge.warning { background: #fef9c3; color: #b45309; }
    .badge[data-status="FINALIZED"] { background: #dcfce7; color: #16a34a; }
    .badge[data-status="TEACHER_COMPLETED"] { background: #dbeafe; color: #2563eb; }
    .badge[data-status="PARENT_CONFIRMED"] { background: #e0e7ff; color: #4f46e5; }
    .badge[data-status="SCHEDULED"] { background: #f1f5f9; color: #64748b; }
    .deadline-badge { padding: 2px 8px; border-radius: 99px; font-size: 11px; font-weight: 600; background: #dcfce7; color: #16a34a; }
    .deadline-badge.near-deadline { background: #fef9c3; color: #b45309; }
    .deadline-badge.overdue { background: #fee2e2; color: #dc2626; }
    .btn-expand {
      padding: 6px 14px; border: 1px solid #cbd5e1; border-radius: 6px; background: #fff;
      cursor: pointer; font-size: 12px; font-weight: 600; color: #475569; white-space: nowrap;
    }
    .btn-expand:hover { background: #f1f5f9; }
    .report-form-wrapper { padding: 0 18px 18px; }
    .pagination { display: flex; gap: 12px; align-items: center; justify-content: center; padding: 20px 0; }
    .pagination button {
      padding: 6px 14px; border: 1px solid #cbd5e1; border-radius: 6px;
      background: #fff; cursor: pointer; font-size: 13px;
    }
    .pagination button:disabled { opacity: 0.5; cursor: not-allowed; }
    .pagination span { font-size: 13px; color: #64748b; }
    @media (max-width: 768px) {
      .session-header { flex-direction: column; align-items: flex-start; gap: 10px; }
      .btn-expand { width: 100%; }
    }
  `],
})
export class TeachingReportPendingComponent {
  @Input() sessions: SessionItem[] = [];
  @Input() templates: ReportTemplate[] = [];
  @Input() submitting = false;
  @Input() canEdit = false;
  @Input() teacherView = false;
  @Input() meta: PendingMeta = { total: 0, page: 1, totalPages: 1 };
  @Output() submitReport = new EventEmitter<{ sessionId: string; data: ReportFormValues }>();
  @Output() pageChange = new EventEmitter<number>();

  editingId = '';

  trackById(_: number, item: SessionItem) {
    return item._id;
  }

  toggleEdit(session: SessionItem) {
    this.editingId = this.editingId === session._id ? '' : session._id;
  }

  onSubmit(sessionId: string, data: ReportFormValues) {
    this.submitReport.emit({ sessionId, data });
    this.editingId = '';
  }

  statusLabel(s: string): string {
    const map: Record<string, string> = {
      SCHEDULED: 'Đã lên lịch', TEACHER_COMPLETED: 'GV hoàn thành',
      PARENT_CONFIRMED: 'PH xác nhận', FINALIZED: 'Hoàn tất',
      CANCELLED: 'Đã hủy', NO_SHOW: 'Vắng',
    };
    return map[s] || s;
  }

  formatCurrency(amount?: number): string {
    if (amount == null) return '-';
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
  }

  private getDeadlineMs(session: SessionItem): number {
    return new Date(session.scheduledDate).getTime() + 24 * 60 * 60 * 1000;
  }

  isOverDeadline(session: SessionItem): boolean {
    return Date.now() > this.getDeadlineMs(session);
  }

  isNearDeadline(session: SessionItem): boolean {
    const remaining = this.getDeadlineMs(session) - Date.now();
    return remaining > 0 && remaining < 4 * 60 * 60 * 1000;
  }

  getRemainingHours(session: SessionItem): number {
    return Math.ceil((this.getDeadlineMs(session) - Date.now()) / (60 * 60 * 1000));
  }

  getOverdueHours(session: SessionItem): number {
    return Math.floor((Date.now() - this.getDeadlineMs(session)) / (60 * 60 * 1000));
  }
}
