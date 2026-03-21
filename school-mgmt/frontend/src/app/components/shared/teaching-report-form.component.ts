import {
  Component, Input, Output, EventEmitter, OnInit, OnDestroy, signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { ReportTemplate } from '../../services/report-template.service';

export interface ReportFormValues {
  lessonContent: string;
  studentAttitude: string;
  recordingUrl: string;
  teacherComment: string;
  homework: string;
  additionalNotes: string;
}

@Component({
  selector: 'app-teaching-report-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <!-- Template selector -->
    <div class="template-bar" *ngIf="templates.length > 0">
      <label>Dùng template:</label>
      <select (change)="applyTemplate($event)" class="template-select">
        <option value="">— Chọn template —</option>
        <optgroup [label]="'Template của bạn'" *ngIf="ownTemplates.length > 0">
          <option *ngFor="let t of ownTemplates" [value]="t._id">{{ t.title }}</option>
        </optgroup>
        <optgroup [label]="'Template chung'" *ngIf="globalTemplates.length > 0">
          <option *ngFor="let t of globalTemplates" [value]="t._id">{{ t.title }}</option>
        </optgroup>
      </select>
    </div>

    <div class="form-grid">
      <!-- lessonContent -->
      <div class="form-group full" [class.has-error]="errors['lessonContent']">
        <label>
          Nội dung học <span class="required">*</span>
          <span class="char-count">{{ form.lessonContent.length }}/2000</span>
        </label>
        <textarea
          [(ngModel)]="form.lessonContent"
          rows="4"
          placeholder="Mô tả nội dung đã học trong buổi... (tối thiểu 20 ký tự)"
          (input)="onDraftInput()">
        </textarea>
        <span class="error-msg" *ngIf="errors['lessonContent']">{{ errors['lessonContent'] }}</span>
      </div>

      <!-- studentAttitude -->
      <div class="form-group" [class.has-error]="errors['studentAttitude']">
        <label>
          Thái độ học sinh
          <span class="char-count">{{ form.studentAttitude.length }}/1000</span>
        </label>
        <textarea [(ngModel)]="form.studentAttitude" rows="2"
          placeholder="Nhận xét về thái độ, hành vi...">
        </textarea>
        <span class="error-msg" *ngIf="errors['studentAttitude']">{{ errors['studentAttitude'] }}</span>
      </div>

      <!-- recordingUrl -->
      <div class="form-group" [class.has-error]="errors['recordingUrl']">
        <label>Link ghi hình bài giảng</label>
        <input type="url" [(ngModel)]="form.recordingUrl"
          placeholder="https://drive.google.com/...">
        <span class="error-msg" *ngIf="errors['recordingUrl']">{{ errors['recordingUrl'] }}</span>
      </div>

      <!-- teacherComment -->
      <div class="form-group full" [class.has-error]="errors['teacherComment']">
        <label>
          Nhận xét chung
          <span class="char-count">{{ form.teacherComment.length }}/1000</span>
        </label>
        <textarea [(ngModel)]="form.teacherComment" rows="2"
          placeholder="Nhận xét tổng quan về buổi học...">
        </textarea>
        <span class="error-msg" *ngIf="errors['teacherComment']">{{ errors['teacherComment'] }}</span>
      </div>

      <!-- homework -->
      <div class="form-group" [class.has-error]="errors['homework']">
        <label>
          Bài tập về nhà
          <span class="char-count">{{ form.homework.length }}/1000</span>
        </label>
        <textarea [(ngModel)]="form.homework" rows="2"
          placeholder="Bài tập giao cho HS...">
        </textarea>
        <span class="error-msg" *ngIf="errors['homework']">{{ errors['homework'] }}</span>
      </div>

      <!-- additionalNotes -->
      <div class="form-group" [class.has-error]="errors['additionalNotes']">
        <label>
          Ghi chú thêm
          <span class="char-count">{{ form.additionalNotes.length }}/500</span>
        </label>
        <textarea [(ngModel)]="form.additionalNotes" rows="2"
          placeholder="Ghi chú khác nếu có...">
        </textarea>
        <span class="error-msg" *ngIf="errors['additionalNotes']">{{ errors['additionalNotes'] }}</span>
      </div>
    </div>

    <div class="form-actions">
      <span class="draft-hint" *ngIf="draftSaved()">💾 Đã lưu nháp</span>
      <button class="btn secondary" type="button" (click)="onCancel()">Hủy</button>
      <button class="btn primary" type="button" (click)="onSubmit()" [disabled]="submitting">
        {{ submitting ? '⏳ Đang gửi...' : submitLabel }}
      </button>
    </div>
  `,
  styles: [`
    .template-bar {
      display: flex; align-items: center; gap: 8px; margin-bottom: 12px; flex-wrap: wrap;
    }
    .template-bar label { font-size: 12px; color: #64748b; font-weight: 600; }
    .template-select {
      padding: 5px 10px; border: 1px solid #cbd5e1; border-radius: 6px;
      font-size: 13px; background: #fff; min-width: 200px; cursor: pointer;
    }
    .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
    .form-group { display: flex; flex-direction: column; gap: 4px; position: relative; }
    .form-group.full { grid-column: 1 / -1; }
    .form-group label {
      font-size: 13px; font-weight: 600; color: #475569;
      display: flex; justify-content: space-between; align-items: center;
    }
    .required { color: #ef4444; }
    .char-count { font-size: 11px; font-weight: 400; color: #94a3b8; }
    .form-group textarea, .form-group input {
      padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 6px;
      font-size: 14px; font-family: inherit; resize: vertical; transition: all 0.15s;
    }
    .form-group textarea:focus, .form-group input:focus {
      outline: none; border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37,99,235,0.1);
    }
    .form-group.has-error textarea, .form-group.has-error input {
      border-color: #ef4444; background: #fef2f2;
    }
    .error-msg { font-size: 12px; color: #dc2626; margin-top: 2px; }
    .form-actions {
      display: flex; gap: 8px; justify-content: flex-end; align-items: center; margin-top: 14px;
    }
    .draft-hint { font-size: 12px; color: #16a34a; margin-right: auto; }
    .btn {
      padding: 8px 18px; border: none; border-radius: 6px; cursor: pointer;
      font-size: 14px; font-weight: 600; transition: all 0.15s;
    }
    .btn.primary { background: #2563eb; color: #fff; }
    .btn.primary:hover { background: #1d4ed8; }
    .btn.primary:disabled { background: #93c5fd; cursor: not-allowed; }
    .btn.secondary { background: #f1f5f9; color: #475569; }
    .btn.secondary:hover { background: #e2e8f0; }
    @media (max-width: 768px) { .form-grid { grid-template-columns: 1fr; } }
  `],
})
export class TeachingReportFormComponent implements OnInit, OnDestroy {
  @Input() initialValues: ReportFormValues = emptyForm();
  @Input() templates: ReportTemplate[] = [];
  @Input() submitting = false;
  @Input() submitLabel = '📤 Nộp báo cáo';
  @Input() validationErrors: Record<string, string> = {};
  @Output() formSubmit = new EventEmitter<ReportFormValues>();
  @Output() formCancel = new EventEmitter<void>();
  /** Emits debounced draft values for auto-save to parent */
  @Output() draftChange = new EventEmitter<ReportFormValues>();

  form: ReportFormValues = emptyForm();
  errors: Record<string, string> = {};
  draftSaved = signal(false);

  private draft$ = new Subject<ReportFormValues>();
  private draftTimer?: ReturnType<typeof setTimeout>;

  get ownTemplates() {
    return this.templates.filter((t) => !t.isGlobal);
  }

  get globalTemplates() {
    return this.templates.filter((t) => t.isGlobal);
  }

  ngOnInit() {
    this.form = { ...this.initialValues };
    this.errors = { ...this.validationErrors };

    // Debounce draft auto-save: emit to parent 800ms after user stops typing
    this.draft$.pipe(
      debounceTime(800),
      distinctUntilChanged((a, b) => a.lessonContent === b.lessonContent),
    ).subscribe((values) => {
      this.draftChange.emit(values);
      this.draftSaved.set(true);
      this.draftTimer = setTimeout(() => this.draftSaved.set(false), 2000);
    });
  }

  ngOnDestroy() {
    this.draft$.complete();
    if (this.draftTimer) clearTimeout(this.draftTimer);
  }

  onDraftInput() {
    this.draft$.next({ ...this.form });
  }

  applyTemplate(event: Event) {
    const id = (event.target as HTMLSelectElement).value;
    if (!id) return;
    const tpl = this.templates.find((t) => t._id === id);
    if (tpl) {
      this.form.lessonContent = tpl.templateContent;
      // Reset select to default after applying
      (event.target as HTMLSelectElement).value = '';
    }
  }

  validate(): boolean {
    const e: Record<string, string> = {};

    if (!this.form.lessonContent?.trim()) {
      e['lessonContent'] = 'Nội dung học không được để trống';
    } else if (this.form.lessonContent.trim().length < 20) {
      e['lessonContent'] = 'Nội dung học phải có ít nhất 20 ký tự';
    } else if (this.form.lessonContent.length > 2000) {
      e['lessonContent'] = 'Nội dung học không được vượt quá 2000 ký tự';
    }

    if (this.form.recordingUrl?.trim()) {
      try {
        const url = new URL(this.form.recordingUrl.trim());
        if (!['http:', 'https:'].includes(url.protocol)) {
          e['recordingUrl'] = 'Link ghi hình phải bắt đầu bằng http hoặc https';
        }
      } catch {
        e['recordingUrl'] = 'Link ghi hình phải là URL hợp lệ (https://...)';
      }
    }

    if ((this.form.studentAttitude?.length ?? 0) > 1000)
      e['studentAttitude'] = 'Thái độ học sinh không được vượt quá 1000 ký tự';
    if ((this.form.teacherComment?.length ?? 0) > 1000)
      e['teacherComment'] = 'Nhận xét không được vượt quá 1000 ký tự';
    if ((this.form.homework?.length ?? 0) > 1000)
      e['homework'] = 'Bài tập về nhà không được vượt quá 1000 ký tự';
    if ((this.form.additionalNotes?.length ?? 0) > 500)
      e['additionalNotes'] = 'Ghi chú thêm không được vượt quá 500 ký tự';

    this.errors = e;
    return Object.keys(e).length === 0;
  }

  onSubmit() {
    if (!this.validate()) return;
    this.formSubmit.emit({ ...this.form });
  }

  onCancel() {
    this.formCancel.emit();
  }
}

export function emptyForm(): ReportFormValues {
  return {
    lessonContent: '',
    studentAttitude: '',
    recordingUrl: '',
    teacherComment: '',
    homework: '',
    additionalNotes: '',
  };
}
