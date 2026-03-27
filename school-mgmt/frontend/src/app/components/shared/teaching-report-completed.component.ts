import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SessionItem } from '../../services/session.service';
import { ReportTemplate } from '../../services/report-template.service';
import {
  TeachingReportFormComponent,
  ReportFormValues,
  teachingReportDraftStorageKey,
} from './teaching-report-form.component';

export interface CompletedMeta {
  total?: number;
  page?: number;
  limit?: number;
  totalPages?: number;
}

@Component({
  selector: 'app-teaching-report-completed',
  standalone: true,
  imports: [CommonModule, TeachingReportFormComponent],
  template: `
    <div *ngIf="sessions.length === 0" class="empty">
      Chưa có buổi học nào đã nộp báo cáo.
    </div>

    <div *ngFor="let s of sessions; trackBy: trackById" class="session-card completed">
      <div class="session-header" (click)="toggleView(s)">
        <div class="session-info">
          <span class="badge success">Đã có báo cáo</span>
          <span *ngIf="!teacherView">GV: {{ s.teacherId.fullName || 'N/A' }}</span>
          <span *ngIf="!teacherView" class="divider">|</span>
          <strong>{{ s.classId.name || 'N/A' }}</strong>
          <span class="divider">|</span>
          <span>HS: {{ s.studentId.fullName || 'N/A' }}</span>
          <span class="divider">|</span>
          <span>{{ s.scheduledDate | date:'dd/MM/yyyy' }}</span>
          <span class="divider">|</span>
          <span>{{ s.durationMinutes || 60 }} phút</span>
          <span *ngIf="teacherView" class="divider">|</span>
          <span *ngIf="teacherView">Lương: {{ formatCurrency(s.teacherPayout) }}</span>
        </div>
        <button class="btn-expand" type="button">
          {{ viewingId === s._id ? '▲ Thu gọn' : '▼ Xem' }}
        </button>
      </div>

      <!-- Read-only view -->
      <div *ngIf="viewingId === s._id && editingId !== s._id" class="report-view">
        <table class="report-table">
          <tr><th>Nội dung học</th><td>{{ s.teachingReport?.lessonContent || '—' }}</td></tr>
          <tr><th>Thái độ HS</th><td>{{ s.teachingReport?.studentAttitude || '—' }}</td></tr>
          <tr>
            <th>Link ghi hình</th>
            <td>
              <a *ngIf="s.teachingReport?.recordingUrl"
                 [href]="sanitizeUrl(s.teachingReport!.recordingUrl!)"
                 target="_blank" rel="noopener noreferrer">
                {{ s.teachingReport?.recordingUrl }}
              </a>
              <span *ngIf="!s.teachingReport?.recordingUrl">—</span>
            </td>
          </tr>
          <tr><th>Nhận xét</th><td>{{ s.teachingReport?.teacherComment || '—' }}</td></tr>
          <tr><th>Bài tập</th><td>{{ s.teachingReport?.homework || '—' }}</td></tr>
          <tr><th>Ghi chú</th><td>{{ s.teachingReport?.additionalNotes || '—' }}</td></tr>
          <tr><th>Ngày nộp</th><td>{{ s.teachingReport?.submittedAt | date:'dd/MM/yyyy HH:mm' }}</td></tr>
          <tr *ngIf="s.teachingReport?.isLateSubmission">
            <th>Tình trạng</th>
            <td><span class="badge late-badge">Nộp muộn {{ getLateHours(s) }}h</span></td>
          </tr>
        </table>
        <div class="form-actions" *ngIf="canEdit">
          <button class="btn secondary" type="button" (click)="startEdit(s)">Sửa báo cáo</button>
        </div>
      </div>

      <!-- Edit mode -->
      <div *ngIf="canEdit && viewingId === s._id && editingId === s._id" class="report-form-wrapper">
        <app-teaching-report-form
          [initialValues]="editInitialValues"
          [draftKey]="draftKeyFor(s._id)"
          [templates]="templates"
          [submitting]="submitting"
          submitLabel="💾 Cập nhật báo cáo"
          (formSubmit)="onSubmit(s._id, $event)"
          (formCancel)="editingId = ''">
        </app-teaching-report-form>
      </div>
    </div>

    <!-- Pagination -->
    <div class="pagination" *ngIf="(meta.totalPages || 0) > 1">
      <button (click)="pageChange.emit((meta.page || 1) - 1)" [disabled]="(meta.page || 1) <= 1">← Trước</button>
      <span>Trang {{ meta.page || 1 }} / {{ meta.totalPages }}</span>
      <button (click)="pageChange.emit((meta.page || 1) + 1)" [disabled]="(meta.page || 1) >= (meta.totalPages || 1)">Sau →</button>
    </div>
  `,
  styles: [`
    .empty { text-align: center; padding: 40px; color: #94a3b8; font-size: 15px; }
    .session-card {
      background: #fff; border-radius: 10px; margin-bottom: 10px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.06); border-left: 4px solid #22c55e; overflow: hidden;
    }
    .session-header {
      display: flex; justify-content: space-between; align-items: center;
      padding: 14px 18px; cursor: pointer; transition: background 0.15s;
    }
    .session-header:hover { background: #f8fafc; }
    .session-info { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: 13px; color: #475569; }
    .session-info strong { color: #1e293b; }
    .divider { color: #cbd5e1; }
    .badge { padding: 2px 8px; border-radius: 99px; font-size: 11px; font-weight: 600; }
    .badge.success { background: #dcfce7; color: #16a34a; }
    .badge.late-badge { background: #fee2e2; color: #dc2626; }
    .btn-expand {
      padding: 6px 14px; border: 1px solid #cbd5e1; border-radius: 6px; background: #fff;
      cursor: pointer; font-size: 12px; font-weight: 600; color: #475569; white-space: nowrap;
    }
    .btn-expand:hover { background: #f1f5f9; }
    .report-view { padding: 0 18px 18px; }
    .report-form-wrapper { padding: 0 18px 18px; }
    .report-table { width: 100%; border-collapse: collapse; font-size: 14px; }
    .report-table th {
      text-align: left; padding: 8px 12px; background: #f8fafc;
      color: #64748b; font-size: 12px; width: 140px; font-weight: 600; white-space: nowrap;
    }
    .report-table td { padding: 8px 12px; color: #1e293b; word-break: break-word; }
    .report-table tr { border-bottom: 1px solid #f1f5f9; }
    .report-table a { color: #2563eb; text-decoration: none; }
    .report-table a:hover { text-decoration: underline; }
    .form-actions { display: flex; gap: 8px; margin-top: 12px; }
    .btn {
      padding: 8px 18px; border: none; border-radius: 6px; cursor: pointer;
      font-size: 14px; font-weight: 600;
    }
    .btn.secondary { background: #f1f5f9; color: #475569; }
    .btn.secondary:hover { background: #e2e8f0; }
    .pagination { display: flex; gap: 12px; align-items: center; justify-content: center; padding: 20px 0; }
    .pagination button {
      padding: 6px 14px; border: 1px solid #cbd5e1; border-radius: 6px;
      background: #fff; cursor: pointer; font-size: 13px;
    }
    .pagination button:disabled { opacity: 0.5; cursor: not-allowed; }
    .pagination span { font-size: 13px; color: #64748b; }
    @media (max-width: 768px) {
      .session-header { flex-direction: column; align-items: flex-start; gap: 10px; }
    }
  `],
})
export class TeachingReportCompletedComponent {
  @Input() sessions: SessionItem[] = [];
  @Input() templates: ReportTemplate[] = [];
  @Input() submitting = false;
  @Input() canEdit = false;
  @Input() teacherView = false;
  @Input() meta: CompletedMeta = {};
  @Output() submitReport = new EventEmitter<{ sessionId: string; data: ReportFormValues }>();
  @Output() pageChange = new EventEmitter<number>();

  viewingId = '';
  editingId = '';
  editInitialValues: ReportFormValues = emptyForm();

  trackById(_: number, item: SessionItem) {
    return item._id;
  }

  toggleView(session: SessionItem) {
    if (this.viewingId === session._id) {
      this.viewingId = '';
      this.editingId = '';
    } else {
      this.viewingId = session._id;
      this.editingId = '';
    }
  }

  startEdit(session: SessionItem) {
    this.editingId = session._id;
    this.editInitialValues = {
      lessonContent: session.teachingReport?.lessonContent || '',
      studentAttitude: session.teachingReport?.studentAttitude || '',
      recordingUrl: session.teachingReport?.recordingUrl || '',
      teacherComment: session.teachingReport?.teacherComment || '',
      homework: session.teachingReport?.homework || '',
      additionalNotes: session.teachingReport?.additionalNotes || '',
    };
  }

  onSubmit(sessionId: string, data: ReportFormValues) {
    this.submitReport.emit({ sessionId, data });
    this.editingId = '';
  }

  draftKeyFor(sessionId: string): string {
    return teachingReportDraftStorageKey(sessionId);
  }

  /** Sanitize URL: only allow http/https to prevent javascript: XSS */
  sanitizeUrl(url: string): string {
    try {
      const parsed = new URL(url);
      if (['http:', 'https:'].includes(parsed.protocol)) return url;
    } catch {}
    return '#';
  }

  formatCurrency(amount?: number): string {
    if (amount == null) return '-';
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
  }

  getLateHours(session: SessionItem): number {
    const deadline = new Date(session.scheduledDate).getTime() + 24 * 60 * 60 * 1000;
    const submitted = session.teachingReport?.submittedAt
      ? new Date(session.teachingReport.submittedAt).getTime()
      : Date.now();
    return Math.max(0, Math.floor((submitted - deadline) / (60 * 60 * 1000)));
  }
}

function emptyForm(): ReportFormValues {
  return {
    lessonContent: '',
    studentAttitude: '',
    recordingUrl: '',
    teacherComment: '',
    homework: '',
    additionalNotes: '',
  };
}
