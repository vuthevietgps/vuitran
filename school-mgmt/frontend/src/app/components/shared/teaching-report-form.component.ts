import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  SimpleChanges,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import {
  ReportTemplate,
  ReportTemplateDynamicFieldDefinition,
} from '../../services/report-template.service';

export type ReportDynamicFieldValue = string | number | boolean;
export interface ReportFormValues {
  lessonContent: string;
  studentAttitude: string;
  recordingUrl: string;
  teacherComment: string;
  homework: string;
  additionalNotes: string;
  templateId?: string;
  templateTitle?: string;
  templateVersion?: number;
  dynamicFieldValues?: Record<string, ReportDynamicFieldValue>;
  dynamicFieldSchemaSnapshot?: ReportTemplateDynamicFieldDefinition[];
}

type LegacyFieldKey = 'lessonContent' | 'studentAttitude' | 'recordingUrl' | 'teacherComment' | 'homework' | 'additionalNotes';

type LegacyFieldConfig = {
  key: LegacyFieldKey;
  label: string;
  placeholder: string;
  testId: string;
  full?: boolean;
  rows?: number;
  required?: boolean;
  maxLength?: number;
  type?: 'textarea' | 'url';
};

const LEGACY_FIELDS: LegacyFieldConfig[] = [
  { key: 'lessonContent', label: 'Nội dung học', placeholder: 'Mô tả nội dung đã học trong buổi... (tối thiểu 20 ký tự)', testId: 'report-lesson-content', full: true, rows: 4, required: true, maxLength: 2000, type: 'textarea' },
  { key: 'studentAttitude', label: 'Thái độ học sinh', placeholder: 'Nhận xét về thái độ, hành vi...', testId: 'report-student-attitude', rows: 2, maxLength: 1000, type: 'textarea' },
  { key: 'recordingUrl', label: 'Link ghi hình bài giảng', placeholder: 'https://drive.google.com/...', testId: 'report-recording-url', maxLength: 500, type: 'url' },
  { key: 'teacherComment', label: 'Nhận xét chung', placeholder: 'Nhận xét tổng quan về buổi học...', testId: 'report-teacher-comment', full: true, rows: 2, maxLength: 1000, type: 'textarea' },
  { key: 'homework', label: 'Bài tập về nhà', placeholder: 'Bài tập giao cho HS...', testId: 'report-homework', rows: 2, maxLength: 1000, type: 'textarea' },
  { key: 'additionalNotes', label: 'Ghi chú thêm', placeholder: 'Ghi chú khác nếu có...', testId: 'report-additional-notes', rows: 2, maxLength: 500, type: 'textarea' },
];

@Component({
  selector: 'app-teaching-report-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="template-bar" *ngIf="applicableTemplates.length > 0">
      <label>Dùng template:</label>
      <select data-testid="report-template-select" (change)="applyTemplate($event)" class="template-select">
        <option value="">— Chọn template —</option>
        <optgroup [label]="'Template của bạn'" *ngIf="ownTemplates.length > 0">
          <option *ngFor="let t of ownTemplates" [value]="t._id">{{ t.title }}</option>
        </optgroup>
        <optgroup [label]="'Template chung'" *ngIf="globalTemplates.length > 0">
          <option *ngFor="let t of globalTemplates" [value]="t._id">{{ t.title }}</option>
        </optgroup>
      </select>
      <span *ngIf="activeTemplateTitle" class="active-template" data-testid="report-active-template">Đang áp dụng: {{ activeTemplateTitle }}</span>
      <button *ngIf="usesDynamicTemplate" class="btn-chip" type="button" data-testid="report-clear-template" (click)="clearActiveTemplate()">Bỏ template</button>
    </div>
    <div class="template-error" *ngIf="errors['__template']">{{ errors['__template'] }}</div>

    <div *ngIf="usesDynamicTemplate; else legacyBlock" class="form-grid">
      <div *ngFor="let field of activeDynamicFields; trackBy: trackByFieldKey" class="form-group" [class.full]="field.type === 'textarea'" [class.has-error]="errors[field.key]">
        <label>
          <span>{{ field.label }} <span class="required" *ngIf="field.required">*</span></span>
          <span class="char-count" *ngIf="field.maxLength && field.type !== 'checkbox'">{{ dynamicTextLength(field) }}/{{ field.maxLength }}</span>
        </label>
        <ng-container [ngSwitch]="field.type">
          <textarea *ngSwitchCase="'textarea'" [attr.data-testid]="dynamicFieldTestId(field.key)" [value]="dynamicStringValue(field.key)" [rows]="3" [placeholder]="field.placeholder || ''" (input)="onDynamicValueInput(field, $any($event.target).value)"></textarea>
          <input *ngSwitchCase="'url'" [attr.data-testid]="dynamicFieldTestId(field.key)" type="url" [value]="dynamicStringValue(field.key)" [placeholder]="field.placeholder || 'https://...'" (input)="onDynamicValueInput(field, $any($event.target).value)">
          <input *ngSwitchCase="'number'" [attr.data-testid]="dynamicFieldTestId(field.key)" type="number" [value]="dynamicInputValue(field.key)" [placeholder]="field.placeholder || ''" (input)="onDynamicValueInput(field, $any($event.target).value)">
          <select *ngSwitchCase="'select'" [attr.data-testid]="dynamicFieldTestId(field.key)" [value]="dynamicStringValue(field.key)" (change)="onDynamicValueInput(field, $any($event.target).value)"><option value="">— Chọn —</option><option *ngFor="let option of field.options || []" [value]="option.value">{{ option.label }}</option></select>
          <label *ngSwitchCase="'checkbox'" class="checkbox-field" [attr.data-testid]="dynamicFieldTestId(field.key)"><input type="checkbox" [checked]="dynamicBooleanValue(field.key)" (change)="onDynamicCheckboxInput(field.key, $any($event.target).checked)"><span>{{ field.placeholder || 'Đánh dấu nếu áp dụng' }}</span></label>
          <input *ngSwitchCase="'date'" [attr.data-testid]="dynamicFieldTestId(field.key)" type="date" [value]="dynamicStringValue(field.key)" (input)="onDynamicValueInput(field, $any($event.target).value)">
          <input *ngSwitchDefault [attr.data-testid]="dynamicFieldTestId(field.key)" type="text" [value]="dynamicStringValue(field.key)" [placeholder]="field.placeholder || ''" (input)="onDynamicValueInput(field, $any($event.target).value)">
        </ng-container>
        <span class="error-msg" *ngIf="errors[field.key]">{{ errors[field.key] }}</span>
      </div>
    </div>

    <ng-template #legacyBlock>
      <div class="form-grid">
        <div *ngFor="let field of legacyFields" class="form-group" [class.full]="field.full" [class.has-error]="errors[field.key]">
          <label><span>{{ field.label }} <span class="required" *ngIf="field.required">*</span></span><span class="char-count" *ngIf="field.maxLength">{{ legacyValueLength(field.key) }}/{{ field.maxLength }}</span></label>
          <textarea *ngIf="field.type === 'textarea'" [attr.data-testid]="field.testId" [(ngModel)]="form[field.key]" [rows]="field.rows || 2" [placeholder]="field.placeholder" (input)="onDraftInput()"></textarea>
          <input *ngIf="field.type === 'url'" [attr.data-testid]="field.testId" type="url" [(ngModel)]="form[field.key]" [placeholder]="field.placeholder" (input)="onDraftInput()">
          <span class="error-msg" *ngIf="errors[field.key]">{{ errors[field.key] }}</span>
        </div>
      </div>
    </ng-template>

    <div class="form-actions">
      <span class="draft-hint" *ngIf="draftSaving()">Đang lưu nháp...</span>
      <span class="draft-hint saved" *ngIf="!draftSaving() && draftSaved()">💾 Đã lưu nháp</span>
      <button class="btn secondary" data-testid="report-cancel" type="button" (click)="onCancel()">Hủy</button>
      <button class="btn primary" data-testid="report-submit" type="button" (click)="onSubmit()" [disabled]="submitting">{{ submitting ? '⏳ Đang gửi...' : submitLabel }}</button>
    </div>
  `,
  styles: [`
    .template-bar{display:flex;align-items:center;gap:8px;margin-bottom:12px;flex-wrap:wrap}.template-bar label{font-size:12px;color:#64748b;font-weight:600}.template-select{padding:5px 10px;border:1px solid #cbd5e1;border-radius:6px;font-size:13px;background:#fff;min-width:220px;cursor:pointer}.active-template{display:inline-flex;align-items:center;padding:4px 10px;border-radius:999px;background:#eff6ff;color:#1d4ed8;font-size:12px;font-weight:700}.btn-chip{border:1px solid #bfdbfe;background:#fff;color:#1d4ed8;border-radius:999px;padding:4px 10px;font-size:12px;font-weight:700;cursor:pointer}.template-error{margin-bottom:10px;color:#dc2626;font-size:12px;font-weight:600}.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}.form-group{display:flex;flex-direction:column;gap:4px}.form-group.full{grid-column:1/-1}.form-group label{font-size:13px;font-weight:600;color:#475569;display:flex;justify-content:space-between;align-items:center;gap:8px}.required{color:#ef4444}.char-count{font-size:11px;font-weight:400;color:#94a3b8}.form-group textarea,.form-group input,.form-group select{padding:8px 12px;border:1px solid #cbd5e1;border-radius:6px;font-size:14px;font-family:inherit;resize:vertical;background:#fff}.form-group.has-error textarea,.form-group.has-error input,.form-group.has-error select,.form-group.has-error .checkbox-field{border-color:#ef4444;background:#fef2f2}.checkbox-field{display:inline-flex;align-items:center;gap:8px;padding:10px 12px;border:1px solid #cbd5e1;border-radius:6px;background:#fff;color:#334155;font-size:14px;font-weight:500}.error-msg{font-size:12px;color:#dc2626}.form-actions{display:flex;gap:8px;justify-content:flex-end;align-items:center;margin-top:14px}.draft-hint{font-size:12px;color:#64748b;margin-right:auto}.draft-hint.saved{color:#16a34a}.btn{padding:8px 18px;border:none;border-radius:6px;cursor:pointer;font-size:14px;font-weight:600}.btn.primary{background:#2563eb;color:#fff}.btn.primary:disabled{background:#93c5fd;cursor:not-allowed}.btn.secondary{background:#f1f5f9;color:#475569}@media (max-width:768px){.form-grid{grid-template-columns:1fr}}
  `],
})
export class TeachingReportFormComponent implements OnInit, OnDestroy, OnChanges {
  @Input() initialValues: ReportFormValues = emptyForm();
  @Input() templates: ReportTemplate[] = [];
  @Input() contextClassId = '';
  @Input() submitting = false;
  @Input() submitLabel = '📤 Nộp báo cáo';
  @Input() draftStorageKey = '';
  @Input() validationErrors: Record<string, string> = {};
  @Output() formSubmit = new EventEmitter<ReportFormValues>();
  @Output() formCancel = new EventEmitter<void>();
  @Output() draftChange = new EventEmitter<ReportFormValues>();

  readonly legacyFields = LEGACY_FIELDS;
  form: ReportFormValues = emptyForm();
  errors: Record<string, string> = {};
  draftSaved = signal(false);
  draftSaving = signal(false);
  private draft$ = new Subject<ReportFormValues>();
  private draftTimer?: ReturnType<typeof setTimeout>;
  private initialized = false;
  private activeTemplateId = '';

  get applicableTemplates(): ReportTemplate[] { return this.templates.filter((template) => !template.classId || template.classId === this.contextClassId); }
  get ownTemplates(): ReportTemplate[] { return this.applicableTemplates.filter((template) => !template.isGlobal); }
  get globalTemplates(): ReportTemplate[] { return this.applicableTemplates.filter((template) => template.isGlobal); }
  get activeTemplate(): ReportTemplate | null { return this.activeTemplateId ? this.applicableTemplates.find((template) => template._id === this.activeTemplateId) || null : null; }
  get activeTemplateTitle(): string { return this.activeTemplate?.title || this.form.templateTitle || ''; }
  get activeDynamicFields(): ReportTemplateDynamicFieldDefinition[] { const templateFields = this.normalizeDynamicFields(this.activeTemplate?.dynamicFields); return templateFields.length > 0 ? templateFields : this.normalizeDynamicFields(this.form.dynamicFieldSchemaSnapshot); }
  get usesDynamicTemplate(): boolean { return this.activeDynamicFields.length > 0; }

  ngOnInit(): void {
    this.form = this.restoreDraft() || normalizeFormValues(this.initialValues);
    this.errors = { ...this.validationErrors };
    this.syncTemplateStateFromForm();
    this.initialized = true;
    this.draft$.pipe(debounceTime(800), distinctUntilChanged((left, right) => JSON.stringify(left) === JSON.stringify(right))).subscribe((values) => {
      this.persistDraft(values);
      this.draftChange.emit(values);
      this.draftSaving.set(false);
      this.draftSaved.set(true);
      if (this.draftTimer) clearTimeout(this.draftTimer);
      this.draftTimer = setTimeout(() => this.draftSaved.set(false), 2000);
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.initialized) return;
    if (changes['templates'] || changes['contextClassId']) this.syncTemplateStateFromForm();
    if (changes['validationErrors']) this.errors = { ...this.validationErrors };
  }

  ngOnDestroy(): void {
    this.draft$.complete();
    if (this.draftTimer) clearTimeout(this.draftTimer);
  }

  applyTemplate(event: Event): void {
    const select = event.target as HTMLSelectElement;
    const templateId = select.value;
    if (!templateId) return;
    const template = this.applicableTemplates.find((item) => item._id === templateId);
    if (!template) return;
    this.activeTemplateId = template._id;
    const normalizedFields = this.normalizeDynamicFields(template.dynamicFields);
    if (normalizedFields.length > 0) {
      this.form = {
        ...emptyForm(),
        templateId: template._id,
        templateTitle: template.title,
        templateVersion: template.version ?? 1,
        dynamicFieldSchemaSnapshot: normalizedFields,
        dynamicFieldValues: this.seedDynamicFieldValues(normalizedFields),
      };
    } else {
      this.form = { ...this.form, lessonContent: template.templateContent };
    }
    this.errors = {};
    this.onDraftInput();
    select.value = '';
  }

  clearActiveTemplate(): void {
    this.activeTemplateId = '';
    this.form = { ...emptyForm() };
    this.errors = {};
    this.onDraftInput();
  }

  onDynamicValueInput(field: ReportTemplateDynamicFieldDefinition, rawValue: string): void {
    const dynamicFieldValues = { ...(this.form.dynamicFieldValues || {}) };
    dynamicFieldValues[field.key] = field.type === 'number' ? (rawValue === '' ? '' : Number(rawValue)) : rawValue;
    this.form = { ...this.form, dynamicFieldValues, templateId: this.activeTemplateId || this.form.templateId, templateTitle: this.activeTemplateTitle || this.form.templateTitle, templateVersion: this.activeTemplate?.version ?? this.form.templateVersion, dynamicFieldSchemaSnapshot: this.activeDynamicFields };
    this.onDraftInput();
  }

  onDynamicCheckboxInput(key: string, checked: boolean): void {
    const dynamicFieldValues = { ...(this.form.dynamicFieldValues || {}) };
    dynamicFieldValues[key] = checked;
    this.form = { ...this.form, dynamicFieldValues, templateId: this.activeTemplateId || this.form.templateId, templateTitle: this.activeTemplateTitle || this.form.templateTitle, templateVersion: this.activeTemplate?.version ?? this.form.templateVersion, dynamicFieldSchemaSnapshot: this.activeDynamicFields };
    this.onDraftInput();
  }

  onDraftInput(): void {
    this.draftSaving.set(true);
    this.draftSaved.set(false);
    this.draft$.next(this.snapshotForDraft());
  }

  onSubmit(): void {
    if (!this.validate()) return;
    const payload = this.buildSubmitPayload();
    this.clearDraft();
    this.formSubmit.emit(payload);
  }

  onCancel(): void { this.formCancel.emit(); }
  trackByFieldKey(_: number, field: ReportTemplateDynamicFieldDefinition): string { return field.key; }
  dynamicFieldTestId(key: string): string { return `report-dynamic-field-${this.dynamicFieldDomKey(key)}`; }
  dynamicFieldDomKey(key: string): string { return key.replace(/[^a-zA-Z0-9_-]/g, '-'); }
  dynamicInputValue(key: string): string | number { const value = this.form.dynamicFieldValues?.[key]; return typeof value === 'number' ? value : typeof value === 'string' ? value : ''; }
  dynamicStringValue(key: string): string { const value = this.form.dynamicFieldValues?.[key]; return typeof value === 'string' ? value : ''; }
  dynamicBooleanValue(key: string): boolean { return this.form.dynamicFieldValues?.[key] === true; }
  dynamicTextLength(field: ReportTemplateDynamicFieldDefinition): number { return this.dynamicStringValue(field.key).length; }
  legacyValueLength(key: LegacyFieldKey): number { return (this.form[key] || '').length; }

  private validate(): boolean {
    const nextErrors: Record<string, string> = {};
    if (this.usesDynamicTemplate) {
      const normalizedDynamicValues = this.normalizeDynamicValuesForSubmit();
      for (const field of this.activeDynamicFields) {
        const value = normalizedDynamicValues[field.key];
        const present = this.isDynamicValuePresent(field, value);
        if (!present && field.required) { nextErrors[field.key] = `${field.label} không được để trống`; continue; }
        if (typeof value === 'string') {
          if (field.maxLength && value.length > field.maxLength) { nextErrors[field.key] = `${field.label} không được vượt quá ${field.maxLength} ký tự`; continue; }
          if (field.type === 'url' && value) {
            try { const parsed = new URL(value); if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('unsupported'); } catch { nextErrors[field.key] = `${field.label} phải là URL hợp lệ`; continue; }
          }
          if (field.type === 'select' && Array.isArray(field.options) && field.options.length > 0) {
            const allowedValues = new Set(field.options.map((option) => option.value));
            if (!allowedValues.has(value)) { nextErrors[field.key] = `${field.label} có giá trị không hợp lệ`; continue; }
          }
        }
      }
      if (this.buildDynamicLessonContent(normalizedDynamicValues).trim().length < 20) nextErrors['__template'] = 'Template động cần đủ nội dung để tạo tóm tắt báo cáo tối thiểu 20 ký tự';
    } else {
      const lessonContent = (this.form.lessonContent || '').trim();
      if (!lessonContent) nextErrors['lessonContent'] = 'Nội dung học không được để trống';
      else if (lessonContent.length < 20) nextErrors['lessonContent'] = 'Nội dung học phải có ít nhất 20 ký tự';
      else if (lessonContent.length > 2000) nextErrors['lessonContent'] = 'Nội dung học không được vượt quá 2000 ký tự';
      if ((this.form.recordingUrl || '').trim()) {
        try { const parsed = new URL((this.form.recordingUrl || '').trim()); if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('unsupported'); } catch { nextErrors['recordingUrl'] = 'Link ghi hình phải là URL hợp lệ (https://...)'; }
      }
      if ((this.form.studentAttitude || '').length > 1000) nextErrors['studentAttitude'] = 'Thái độ học sinh không được vượt quá 1000 ký tự';
      if ((this.form.teacherComment || '').length > 1000) nextErrors['teacherComment'] = 'Nhận xét không được vượt quá 1000 ký tự';
      if ((this.form.homework || '').length > 1000) nextErrors['homework'] = 'Bài tập về nhà không được vượt quá 1000 ký tự';
      if ((this.form.additionalNotes || '').length > 500) nextErrors['additionalNotes'] = 'Ghi chú thêm không được vượt quá 500 ký tự';
    }
    this.errors = nextErrors;
    return Object.keys(nextErrors).length === 0;
  }

  private buildSubmitPayload(): ReportFormValues {
    if (!this.usesDynamicTemplate) return { lessonContent: this.form.lessonContent || '', studentAttitude: this.form.studentAttitude || '', recordingUrl: this.form.recordingUrl || '', teacherComment: this.form.teacherComment || '', homework: this.form.homework || '', additionalNotes: this.form.additionalNotes || '' };
    const normalizedDynamicValues = this.normalizeDynamicValuesForSubmit();
    return {
      lessonContent: this.buildDynamicLessonContent(normalizedDynamicValues),
      studentAttitude: this.resolveLegacyValueFromDynamicField('studentAttitude', normalizedDynamicValues),
      recordingUrl: this.resolveLegacyValueFromDynamicField('recordingUrl', normalizedDynamicValues),
      teacherComment: this.resolveLegacyValueFromDynamicField('teacherComment', normalizedDynamicValues),
      homework: this.resolveLegacyValueFromDynamicField('homework', normalizedDynamicValues),
      additionalNotes: this.resolveLegacyValueFromDynamicField('additionalNotes', normalizedDynamicValues),
      templateId: this.activeTemplateId || this.form.templateId,
      templateTitle: this.activeTemplateTitle || this.form.templateTitle,
      templateVersion: this.activeTemplate?.version ?? this.form.templateVersion ?? 1,
      dynamicFieldValues: normalizedDynamicValues,
      dynamicFieldSchemaSnapshot: this.activeDynamicFields,
    };
  }

  private resolveLegacyValueFromDynamicField(key: Exclude<LegacyFieldKey, 'lessonContent'>, values: Record<string, ReportDynamicFieldValue>): string {
    const value = values[key];
    return typeof value === 'string' ? value : '';
  }

  private normalizeDynamicValuesForSubmit(): Record<string, ReportDynamicFieldValue> {
    const normalized: Record<string, ReportDynamicFieldValue> = {};
    const source = this.form.dynamicFieldValues || {};
    for (const field of this.activeDynamicFields) {
      const rawValue = source[field.key];
      if (field.type === 'checkbox') { normalized[field.key] = rawValue === true; continue; }
      if (field.type === 'number') {
        if (rawValue === '' || rawValue == null) continue;
        const numericValue = typeof rawValue === 'number' ? rawValue : Number(rawValue);
        if (!Number.isNaN(numericValue)) normalized[field.key] = numericValue;
        continue;
      }
      const textValue = typeof rawValue === 'string' ? rawValue.trim() : rawValue == null ? '' : String(rawValue).trim();
      if (textValue) normalized[field.key] = textValue;
    }
    return normalized;
  }

  private isDynamicValuePresent(field: ReportTemplateDynamicFieldDefinition, value: ReportDynamicFieldValue | undefined): boolean {
    if (field.type === 'checkbox') return value === true;
    if (typeof value === 'number') return Number.isFinite(value);
    return typeof value === 'string' && value.trim().length > 0;
  }

  private buildDynamicLessonContent(values: Record<string, ReportDynamicFieldValue>): string {
    return this.activeDynamicFields.filter((field) => this.isDynamicValuePresent(field, values[field.key])).map((field) => `${field.label}: ${this.formatDynamicValue(values[field.key])}`).join('\n').trim();
  }

  private formatDynamicValue(value: ReportDynamicFieldValue): string {
    return typeof value === 'boolean' ? (value ? 'Có' : 'Không') : String(value).trim();
  }

  private seedDynamicFieldValues(fields: ReportTemplateDynamicFieldDefinition[]): Record<string, ReportDynamicFieldValue> {
    const seededValues: Record<string, ReportDynamicFieldValue> = {};
    for (const field of fields) {
      if (field.defaultValue == null || field.defaultValue === '') continue;
      if (field.type === 'number') {
        const numericValue = Number(field.defaultValue);
        if (!Number.isNaN(numericValue)) seededValues[field.key] = numericValue;
      } else if (field.type === 'checkbox') seededValues[field.key] = field.defaultValue === 'true';
      else seededValues[field.key] = field.defaultValue;
    }
    return seededValues;
  }

  private syncTemplateStateFromForm(): void {
    this.form = normalizeFormValues(this.form);
    if (this.form.templateId) this.activeTemplateId = this.form.templateId;
    const template = this.activeTemplate;
    if (template && this.normalizeDynamicFields(template.dynamicFields).length > 0) {
      const templateFields = this.normalizeDynamicFields(template.dynamicFields);
      this.form = { ...this.form, templateId: template._id, templateTitle: template.title, templateVersion: template.version ?? 1, dynamicFieldSchemaSnapshot: templateFields, dynamicFieldValues: { ...this.seedDynamicFieldValues(templateFields), ...(this.form.dynamicFieldValues || {}) } };
      return;
    }
    if (this.normalizeDynamicFields(this.form.dynamicFieldSchemaSnapshot).length > 0) {
      this.form = { ...this.form, dynamicFieldSchemaSnapshot: this.normalizeDynamicFields(this.form.dynamicFieldSchemaSnapshot), dynamicFieldValues: { ...(this.form.dynamicFieldValues || {}) } };
      return;
    }
    if (!template) this.activeTemplateId = '';
  }

  private normalizeDynamicFields(fields?: ReportTemplateDynamicFieldDefinition[]): ReportTemplateDynamicFieldDefinition[] {
    if (!Array.isArray(fields)) return [];
    return fields.map((field) => ({ key: (field.key || '').trim(), label: (field.label || '').trim(), type: field.type || 'textarea', required: field.required === true, placeholder: field.placeholder?.trim() || undefined, maxLength: typeof field.maxLength === 'number' ? field.maxLength : undefined, order: typeof field.order === 'number' ? field.order : 0, defaultValue: field.defaultValue || undefined, options: Array.isArray(field.options) ? field.options.map((option) => ({ value: option.value, label: option.label })) : undefined })).filter((field) => field.key && field.label).sort((left, right) => (left.order || 0) - (right.order || 0));
  }

  private restoreDraft(): ReportFormValues | null {
    if (typeof window === 'undefined' || !this.draftStorageKey) return null;
    try {
      const raw = window.sessionStorage.getItem(this.draftStorageKey);
      if (!raw) return null;
      return normalizeFormValues(JSON.parse(raw) as Partial<ReportFormValues>);
    } catch { return null; }
  }

  private persistDraft(values: ReportFormValues): void {
    if (typeof window === 'undefined' || !this.draftStorageKey) return;
    try { window.sessionStorage.setItem(this.draftStorageKey, JSON.stringify(values)); } catch {}
  }

  private clearDraft(): void {
    if (typeof window === 'undefined' || !this.draftStorageKey) return;
    try { window.sessionStorage.removeItem(this.draftStorageKey); } catch {}
  }

  private snapshotForDraft(): ReportFormValues {
    if (!this.usesDynamicTemplate) return { lessonContent: this.form.lessonContent || '', studentAttitude: this.form.studentAttitude || '', recordingUrl: this.form.recordingUrl || '', teacherComment: this.form.teacherComment || '', homework: this.form.homework || '', additionalNotes: this.form.additionalNotes || '' };
    return { lessonContent: this.form.lessonContent || '', studentAttitude: this.form.studentAttitude || '', recordingUrl: this.form.recordingUrl || '', teacherComment: this.form.teacherComment || '', homework: this.form.homework || '', additionalNotes: this.form.additionalNotes || '', templateId: this.activeTemplateId || this.form.templateId, templateTitle: this.activeTemplateTitle || this.form.templateTitle, templateVersion: this.activeTemplate?.version ?? this.form.templateVersion ?? 1, dynamicFieldValues: { ...(this.form.dynamicFieldValues || {}) }, dynamicFieldSchemaSnapshot: this.activeDynamicFields };
  }
}

export function emptyForm(): ReportFormValues {
  return { lessonContent: '', studentAttitude: '', recordingUrl: '', teacherComment: '', homework: '', additionalNotes: '' };
}

function normalizeFormValues(values?: Partial<ReportFormValues>): ReportFormValues {
  return {
    lessonContent: values?.lessonContent || '',
    studentAttitude: values?.studentAttitude || '',
    recordingUrl: values?.recordingUrl || '',
    teacherComment: values?.teacherComment || '',
    homework: values?.homework || '',
    additionalNotes: values?.additionalNotes || '',
    templateId: values?.templateId,
    templateTitle: values?.templateTitle,
    templateVersion: values?.templateVersion,
    dynamicFieldValues: values?.dynamicFieldValues ? { ...values.dynamicFieldValues } : undefined,
    dynamicFieldSchemaSnapshot: values?.dynamicFieldSchemaSnapshot ? values.dynamicFieldSchemaSnapshot.map((field) => ({ ...field })) : undefined,
  };
}

export function teachingReportDraftStorageKey(sessionId: string): string {
  return `teaching-report-draft-${sessionId}`;
}
