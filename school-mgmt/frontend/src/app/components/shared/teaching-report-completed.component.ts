import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SessionItem } from '../../services/session.service';
import {
  ReportTemplate,
  ReportTemplateDynamicFieldDefinition,
} from '../../services/report-template.service';
import { TeachingMaterial } from '../../services/teacher.service';
import { Quiz } from '../../services/quiz.service';
import {
  TeachingReportFormComponent,
  ReportFormValues,
} from './teaching-report-form.component';

export interface CompletedMeta {
  total?: number;
  page?: number;
  limit?: number;
  totalPages?: number;
}

type CompletedReportRow = { label: string; value: string; isUrl?: boolean };

@Component({
  selector: 'app-teaching-report-completed',
  standalone: true,
  imports: [CommonModule, TeachingReportFormComponent],
  template: `
    <div *ngIf="sessions.length === 0" class="empty">Chưa có buổi học nào đã nộp báo cáo.</div>
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
        <button class="btn-expand" type="button">{{ viewingId === s._id ? '▲ Thu gọn' : '▼ Xem' }}</button>
      </div>

      <div *ngIf="viewingId === s._id && editingId !== s._id" class="report-view">
        <table class="report-table">
          <tr *ngFor="let row of reportRows(s)">
            <th>{{ row.label }}</th>
            <td>
              <a *ngIf="row.isUrl && row.value !== '—'" [href]="sanitizeUrl(row.value)" target="_blank" rel="noopener noreferrer">{{ row.value }}</a>
              <span *ngIf="!row.isUrl || row.value === '—'">{{ row.value }}</span>
            </td>
          </tr>
          <tr><th>Ngày nộp</th><td>{{ s.teachingReport?.submittedAt | date:'dd/MM/yyyy HH:mm' }}</td></tr>
          <tr *ngIf="s.teachingReport?.isLateSubmission"><th>Tình trạng</th><td><span class="badge late-badge">Nộp muộn {{ getLateHours(s) }}h</span></td></tr>
        </table>
        <div class="form-actions" *ngIf="canEdit"><button class="btn secondary" type="button" (click)="startEdit(s)">Sửa báo cáo</button></div>
      </div>

      <div *ngIf="canEdit && viewingId === s._id && editingId === s._id" class="report-form-wrapper">
        <app-teaching-report-form
          [contextClassId]="s.classId._id || ''"
          [initialValues]="editInitialValues"
          [draftStorageKey]="draftStorageKey(s._id)"
          [templates]="templates"
          [homeworkMaterials]="homeworkMaterials"
          [quizzes]="quizzes"
          [submitting]="submitting"
          submitLabel="💾 Cập nhật báo cáo"
          (formSubmit)="onSubmit(s._id, $event)"
          (formCancel)="editingId = ''">
        </app-teaching-report-form>
      </div>
    </div>

    <div class="pagination" *ngIf="(meta.totalPages || 0) > 1">
      <button (click)="pageChange.emit((meta.page || 1) - 1)" [disabled]="(meta.page || 1) <= 1">← Trước</button>
      <span>Trang {{ meta.page || 1 }} / {{ meta.totalPages }}</span>
      <button (click)="pageChange.emit((meta.page || 1) + 1)" [disabled]="(meta.page || 1) >= (meta.totalPages || 1)">Sau →</button>
    </div>
  `,
  styles: [`
    .empty{text-align:center;padding:40px;color:#94a3b8;font-size:15px}.session-card{background:#fff;border-radius:10px;margin-bottom:10px;box-shadow:0 1px 3px rgba(0,0,0,.06);border-left:4px solid #22c55e;overflow:hidden}.session-header{display:flex;justify-content:space-between;align-items:center;padding:14px 18px;cursor:pointer}.session-header:hover{background:#f8fafc}.session-info{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:13px;color:#475569}.session-info strong{color:#1e293b}.divider{color:#cbd5e1}.badge{padding:2px 8px;border-radius:99px;font-size:11px;font-weight:600}.badge.success{background:#dcfce7;color:#16a34a}.badge.late-badge{background:#fee2e2;color:#dc2626}.btn-expand{padding:6px 14px;border:1px solid #cbd5e1;border-radius:6px;background:#fff;cursor:pointer;font-size:12px;font-weight:600;color:#475569}.report-view,.report-form-wrapper{padding:0 18px 18px}.report-table{width:100%;border-collapse:collapse;font-size:14px}.report-table th{text-align:left;padding:8px 12px;background:#f8fafc;color:#64748b;font-size:12px;width:160px;font-weight:600;white-space:nowrap}.report-table td{padding:8px 12px;color:#1e293b;word-break:break-word}.report-table tr{border-bottom:1px solid #f1f5f9}.report-table a{color:#2563eb;text-decoration:none}.form-actions{display:flex;gap:8px;margin-top:12px}.btn{padding:8px 18px;border:none;border-radius:6px;cursor:pointer;font-size:14px;font-weight:600}.btn.secondary{background:#f1f5f9;color:#475569}.pagination{display:flex;gap:12px;align-items:center;justify-content:center;padding:20px 0}.pagination button{padding:6px 14px;border:1px solid #cbd5e1;border-radius:6px;background:#fff;cursor:pointer;font-size:13px}.pagination button:disabled{opacity:.5;cursor:not-allowed}.pagination span{font-size:13px;color:#64748b}@media (max-width:768px){.session-header{flex-direction:column;align-items:flex-start;gap:10px}}
  `],
})
export class TeachingReportCompletedComponent {
  @Input() sessions: SessionItem[] = [];
  @Input() templates: ReportTemplate[] = [];
  @Input() homeworkMaterials: TeachingMaterial[] = [];
  @Input() quizzes: Quiz[] = [];
  @Input() submitting = false;
  @Input() canEdit = false;
  @Input() teacherView = false;
  @Input() meta: CompletedMeta = {};
  @Output() submitReport = new EventEmitter<{ sessionId: string; data: ReportFormValues }>();
  @Output() pageChange = new EventEmitter<number>();

  viewingId = '';
  editingId = '';
  editInitialValues: ReportFormValues = emptyForm();

  trackById(_: number, item: SessionItem) { return item._id; }

  toggleView(session: SessionItem) {
    if (this.viewingId === session._id) { this.viewingId = ''; this.editingId = ''; }
    else { this.viewingId = session._id; this.editingId = ''; }
  }

  startEdit(session: SessionItem) {
    const evaluation = (session as any).evaluation || {};
    this.editingId = session._id;
    this.editInitialValues = {
      lessonContent: session.teachingReport?.lessonContent || '',
      studentAttitude: session.teachingReport?.studentAttitude || '',
      recordingUrl: session.teachingReport?.recordingUrl || '',
      teacherComment: session.teachingReport?.teacherComment || '',
      homework: session.teachingReport?.homework || '',
      homeworkSubmissionMode: evaluation.homeworkSubmissionMode || 'HYBRID',
      homeworkDeadline: evaluation.homeworkDeadline ? String(evaluation.homeworkDeadline).slice(0, 10) : '',
      homeworkMaterialIds: Array.isArray(evaluation.homeworkMaterialIds)
        ? evaluation.homeworkMaterialIds
            .map((material: any) => material?._id || material)
            .filter(Boolean)
        : [],
      homeworkQuizIds: Array.isArray(evaluation.homeworkQuizIds)
        ? evaluation.homeworkQuizIds
            .map((quiz: any) => quiz?._id || quiz)
            .filter(Boolean)
        : [],
      lessonProgressStatus: evaluation.lessonProgressStatus || 'COMPLETED',
      progressPercent: evaluation.progressPercent ?? 100,
      studentPerformance: evaluation.studentPerformance ?? 3,
      studentEngagement: evaluation.studentEngagement ?? 3,
      comprehensionLevel: evaluation.comprehensionLevel ?? 3,
      deviationReason: evaluation.deviationReason || '',
      nextSessionPlan: evaluation.nextSessionPlan || '',
      overallComment: evaluation.overallComment || '',
      additionalNotes: session.teachingReport?.additionalNotes || '',
      templateId: session.teachingReport?.templateId,
      templateTitle: session.teachingReport?.templateTitle,
      templateVersion: session.teachingReport?.templateVersion,
      dynamicFieldValues: session.teachingReport?.dynamicFieldValues,
      dynamicFieldSchemaSnapshot: session.teachingReport?.dynamicFieldSchemaSnapshot,
    };
  }

  onSubmit(sessionId: string, data: ReportFormValues) {
    this.submitReport.emit({ sessionId, data });
    this.editingId = '';
  }

  draftStorageKey(sessionId: string): string { return `teaching-report-draft-${sessionId}`; }

  sanitizeUrl(url: string): string {
    try { const parsed = new URL(url); if (['http:', 'https:'].includes(parsed.protocol)) return url; } catch {}
    return '#';
  }

  formatCurrency(amount?: number): string {
    if (amount == null) return '-';
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
  }

  getLateHours(session: SessionItem): number {
    const deadline = new Date(session.scheduledDate).getTime() + 24 * 60 * 60 * 1000;
    const submitted = session.teachingReport?.submittedAt ? new Date(session.teachingReport.submittedAt).getTime() : Date.now();
    return Math.max(0, Math.floor((submitted - deadline) / (60 * 60 * 1000)));
  }

  reportRows(session: SessionItem): CompletedReportRow[] {
    const teachingReport = session.teachingReport;
    const evaluation = (session as any).evaluation || {};
    const evaluationRows = this.evaluationRows(evaluation);
    const dynamicFields = this.normalizeDynamicFields(teachingReport?.dynamicFieldSchemaSnapshot);
    if (dynamicFields.length > 0) {
      const values = teachingReport?.dynamicFieldValues || {};
      return [
        ...dynamicFields.map((field) => ({ label: field.label, value: this.formatDynamicValue(values[field.key]), isUrl: field.type === 'url' })),
        ...evaluationRows,
      ];
    }
    return [
      { label: 'Nội dung học', value: teachingReport?.lessonContent || '—' },
      { label: 'Thái độ HS', value: teachingReport?.studentAttitude || '—' },
      { label: 'Link ghi hình', value: teachingReport?.recordingUrl || '—', isUrl: true },
      { label: 'Nhận xét', value: teachingReport?.teacherComment || '—' },
      { label: 'Bài tập', value: teachingReport?.homework || '—' },
      { label: 'Ghi chú', value: teachingReport?.additionalNotes || '—' },
      ...evaluationRows,
    ];
  }

  private evaluationRows(evaluation: any): CompletedReportRow[] {
    return [
      { label: 'Tiến độ bài học', value: this.formatLessonProgressStatus(evaluation.lessonProgressStatus) },
      { label: '% hoàn thành', value: evaluation.progressPercent != null ? `${evaluation.progressPercent}%` : '—' },
      { label: 'Năng lực HS', value: this.formatRating(evaluation.studentPerformance) },
      { label: 'Mức độ tham gia', value: this.formatRating(evaluation.studentEngagement) },
      { label: 'Mức độ hiểu bài', value: this.formatRating(evaluation.comprehensionLevel) },
      { label: 'Lý do lệch bài', value: evaluation.deviationReason || '—' },
      { label: 'Kế hoạch buổi sau', value: evaluation.nextSessionPlan || '—' },
      { label: 'Nhận xét tổng quan', value: evaluation.overallComment || '—' },
    ];
  }

  private formatLessonProgressStatus(status?: string): string {
    const labels: Record<string, string> = {
      COMPLETED: 'Hoàn thành đúng bài',
      PARTIAL: 'Hoàn thành một phần',
      REVIEW_NEEDED: 'Cần ôn lại buổi sau',
      SKIPPED: 'Tạm bỏ qua bài',
      REPLACED: 'Thay bằng nội dung khác',
    };
    return status ? labels[status] || status : '—';
  }

  private formatRating(value?: number): string {
    return value != null ? `${value}/5` : '—';
  }

  private formatDynamicValue(value: unknown): string {
    if (value === true) return 'Có';
    if (value === false) return 'Không';
    if (typeof value === 'number') return String(value);
    if (typeof value === 'string' && value.trim()) return value.trim();
    return '—';
  }

  private normalizeDynamicFields(fields?: ReportTemplateDynamicFieldDefinition[]): ReportTemplateDynamicFieldDefinition[] {
    if (!Array.isArray(fields)) return [];
    return fields.map((field) => ({ ...field, key: (field.key || '').trim(), label: (field.label || '').trim() })).filter((field) => field.key && field.label).sort((left, right) => (left.order || 0) - (right.order || 0));
  }
}

function emptyForm(): ReportFormValues {
  return {
    lessonContent: '',
    studentAttitude: '',
    recordingUrl: '',
    teacherComment: '',
    homework: '',
    homeworkSubmissionMode: 'HYBRID',
    homeworkDeadline: '',
    homeworkMaterialIds: [],
    homeworkQuizIds: [],
    lessonProgressStatus: 'COMPLETED',
    progressPercent: 100,
    studentPerformance: 3,
    studentEngagement: 3,
    comprehensionLevel: 3,
    deviationReason: '',
    nextSessionPlan: '',
    overallComment: '',
    additionalNotes: '',
  };
}
