import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FlowGuideComponent } from './shared/flow-guide.component';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  ComprehensiveReportResponse,
  ComprehensiveReportRow,
  SessionCell,
  StudentService,
} from '../services/student.service';
import { ClassItem, ClassService } from '../services/class.service';

@Component({
  selector: 'app-comprehensive-report',
  standalone: true,
  imports: [CommonModule, FormsModule, FlowGuideComponent],
  template: `
  <app-flow-guide featureKey="comprehensive-report"></app-flow-guide>
    <div class="report-container">
      <h1>Bang diem danh tong hop</h1>

      <div class="filters compact">
        <div class="filter-item">
          <label>Lop</label>
          <select [(ngModel)]="selectedClassId" (change)="loadReport()">
            <option value="">Tat ca lop</option>
            <option *ngFor="let cls of classes()" [value]="cls._id">
              {{ cls.code }} - {{ cls.name }}
            </option>
          </select>
        </div>

        <div class="filter-item">
          <label>Sale</label>
          <select [ngModel]="selectedSaleId()" (ngModelChange)="onSaleFilterChange($event)">
            <option value="">Tat ca sale</option>
            <option *ngFor="let sale of saleOptions()" [value]="sale.id">
              {{ sale.name }}
            </option>
          </select>
        </div>

        <div class="filter-item">
          <label>Tinh trang data</label>
          <select [ngModel]="selectedDataStatus()" (ngModelChange)="onDataStatusFilterChange($event)">
            <option value="">Tat ca tinh trang</option>
            <option *ngFor="let option of dataStatusOptions" [value]="option.value">
              {{ option.label }}
            </option>
          </select>
        </div>

        <div class="filter-item filter-item-search">
          <label>Tim kiem</label>
          <input
            type="text"
            [(ngModel)]="searchTerm"
            (input)="onSearchInput()"
            placeholder="Ten HS, ma HS, phu huynh, SDT..."
          />
        </div>

        <div class="filter-actions">
          <button class="btn btn-primary" (click)="loadReport()">Tim kiem</button>
          <button class="btn btn-export" (click)="exportCSV()">Xuat CSV</button>
        </div>
      </div>

      <div *ngIf="loading()" class="loading">Dang tai du lieu...</div>
      <div *ngIf="error()" class="error">{{ error() }}</div>

      <div *ngIf="!loading() && reportRows().length > 0" class="report-summary">
        <div class="summary-card">
          <h3>Tong so dong</h3>
          <p class="summary-number">{{ reportRows().length }}</p>
        </div>
        <div class="summary-card">
          <h3>So lop</h3>
          <p class="summary-number">{{ uniqueClasses() }}</p>
        </div>
        <div class="summary-card">
          <h3>Buoi toi da</h3>
          <p class="summary-number">{{ visibleMaxSessions() }}</p>
        </div>
        <div class="summary-card">
          <h3>Tong luot co mat</h3>
          <p class="summary-number">{{ totalAttended() }}</p>
        </div>
        <div class="summary-card">
          <h3>So bang</h3>
          <p class="summary-number">{{ sessionChunks().length }}</p>
        </div>
      </div>

      <ng-container *ngIf="!loading() && reportRows().length > 0">
        <div *ngFor="let chunk of sessionChunks()" class="table-block">
          <h3 class="table-title">Bang buoi {{ chunk.start + 1 }} - {{ chunk.end }}</h3>

          <div class="report-table-container">
            <table class="report-table">
              <thead>
                <tr>
                  <th class="sticky-col col-stt">STT</th>
                  <th class="sticky-col col-type">Loai lop</th>
                  <th class="sticky-col col-code">Ma HS</th>
                  <th class="sticky-col col-name">Ten HS</th>
                  <th>Level</th>
                  <th>Ngay sinh</th>
                  <th>Ten PH</th>
                  <th>SDT</th>
                  <th>Ngay sinh me</th>
                  <th>Ma lop</th>
                  <th>Ma GV + ten GV</th>
                  <th>Luong GV</th>
                  <th>So Hoa Don</th>
                  <th>Tong buoi</th>
                  <th>Da Hoc</th>
                  <th>Sale</th>
                  <th>Tinh Trang Data</th>
                  <th *ngFor="let si of chunk.indices" class="session-col">Buoi {{ si + 1 }}</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let row of reportRows(); let i = index">
                  <td class="sticky-col col-stt">{{ i + 1 }}</td>
                  <td class="sticky-col col-type">{{ getClassModeLabel(row.classMode) }}</td>
                  <td class="sticky-col col-code">{{ row.studentCode || '-' }}</td>
                  <td class="sticky-col col-name"><strong>{{ row.fullName || '-' }}</strong></td>
                  <td>{{ row.level || row.grade || '-' }}</td>
                  <td>{{ formatBirthDate(row.dateOfBirth, row.studentBirthMonth) }}</td>
                  <td>{{ row.parentName || '-' }}</td>
                  <td>{{ row.parentPhone || '-' }}</td>
                  <td>{{ formatMonthBirth(row.parentBirthMonth) }}</td>
                  <td class="class-code">{{ row.classCode || '-' }}</td>
                  <td [title]="row.teacherCodeAndName || row.teacherName">{{ row.teacherCodeAndName || row.teacherName || '-' }}</td>
                  <td class="number-cell">{{ formatTeacherSalary(row) }}</td>
                  <td>{{ row.invoiceNumber || '-' }}</td>
                  <td class="number-cell">{{ row.totalSessions || '-' }}</td>
                  <td class="number-cell">{{ row.sessionsCompleted || 0 }}</td>
                  <td>{{ row.saleName || '-' }}</td>
                  <td>
                    <span class="badge" [ngClass]="getDataStatusClass(row.dataStatus)">
                      {{ getDataStatusLabel(row.dataStatus) }}
                    </span>
                  </td>

                  <td
                    *ngFor="let si of chunk.indices"
                    class="session-cell"
                    [ngClass]="getSessionCellClass(row.sessions[si])"
                  >
                    <ng-container *ngIf="row.sessions[si] as s; else emptySessionCell">
                      <div class="cell-status">{{ getStatusLabel(s.status) }}</div>
                      <div class="cell-meta">{{ formatSessionDateTime(s) }}</div>
                      <div class="cell-meta">{{ formatSessionDuration(s.duration) }}</div>
                      <div class="cell-meta cell-teacher" [title]="getSessionTeacher(s)">
                        {{ getSessionTeacher(s) }}
                      </div>
                    </ng-container>
                    <ng-template #emptySessionCell>
                      <span class="cell-empty">-</span>
                    </ng-template>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </ng-container>

      <div *ngIf="!loading() && reportRows().length === 0 && !error()" class="no-data">
        Khong tim thay du lieu phu hop. Hay thu thay doi lop, sale, tinh trang data hoac tu khoa tim kiem.
      </div>
    </div>
  `,
  styles: [`
    .report-container { padding: 2rem; max-width: 100%; margin: 0 auto; }
    h1 { color: #1f2937; margin-bottom: 1.5rem; }

    .filters {
      display: flex;
      flex-wrap: wrap;
      align-items: end;
      gap: 10px;
      background: white;
      padding: 10px 12px;
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      margin-bottom: 16px;
    }

    .filter-item {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 180px;
      flex: 0 1 auto;
    }

    .filter-item-search { flex: 1 1 320px; }

    .filter-item label {
      font-weight: 600;
      color: #4b5563;
      font-size: 12px;
    }

    .filter-item select,
    .filter-item input {
      height: 34px;
      padding: 6px 10px;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      font-size: 13px;
    }

    .filter-actions {
      display: flex;
      gap: 8px;
      margin-left: auto;
    }

    .btn {
      height: 34px;
      padding: 0 14px;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-weight: 600;
      font-size: 13px;
      white-space: nowrap;
    }

    .btn-primary { background: #3b82f6; color: white; }
    .btn-primary:hover { background: #2563eb; }
    .btn-export { background: #10b981; color: white; }
    .btn-export:hover { background: #059669; }

    .loading,
    .error,
    .no-data {
      text-align: center;
      padding: 40px;
      background: white;
      border-radius: 8px;
      margin: 20px 0;
    }

    .error { color: #dc2626; }

    .report-summary {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }

    .summary-card {
      background: white;
      padding: 14px;
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      text-align: center;
    }

    .summary-card h3 {
      font-size: 12px;
      color: #6b7280;
      margin-bottom: 8px;
      font-weight: 600;
      text-transform: uppercase;
    }

    .summary-number { font-size: 24px; font-weight: 700; color: #1f2937; margin: 0; }

    .table-block { margin-bottom: 18px; }

    .table-title {
      margin: 0 0 8px;
      font-size: 15px;
      font-weight: 700;
      color: #1f2937;
    }

    .report-table-container {
      background: white;
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      overflow: auto;
      max-height: 72vh;
      max-width: 100%;
      margin-bottom: 24px;
    }

    .report-table { width: max-content; min-width: 100%; border-collapse: collapse; }
    .report-table thead { background: #f9fafb; border-bottom: 2px solid #e5e7eb; }

    .report-table th {
      position: sticky;
      top: 0;
      z-index: 4;
      background: #f9fafb;
      padding: 10px 8px;
      text-align: center;
      font-weight: 600;
      color: #374151;
      font-size: 12px;
      white-space: nowrap;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }

    .report-table td {
      padding: 6px 8px;
      border-bottom: 1px solid #e5e7eb;
      color: #1f2937;
      font-size: 13px;
      white-space: nowrap;
      text-align: center;
    }

    .report-table tbody tr:hover { background: #f9fafb; }

    .sticky-col { position: sticky; background: white; z-index: 2; }
    thead .sticky-col { background: #f9fafb; z-index: 6; }

    .col-stt { left: 0; min-width: 48px; }
    .col-type { left: 48px; min-width: 92px; }
    .col-code { left: 140px; min-width: 96px; }
    .col-name {
      left: 236px;
      min-width: 170px;
      text-align: left;
      border-right: 2px solid #e5e7eb;
    }

    .class-code { font-weight: 600; color: #2563eb; }
    .number-cell { text-align: center; }

    .session-col {
      min-width: 150px;
      text-align: center;
      background: #eef2ff;
    }

    .session-cell {
      min-width: 150px;
      line-height: 1.25;
      padding: 6px !important;
      white-space: normal !important;
      text-align: left !important;
      vertical-align: top;
    }

    .cell-status {
      font-size: 12px;
      font-weight: 700;
      text-align: center;
      margin-bottom: 4px;
    }

    .cell-meta {
      display: block;
      font-size: 11px;
      color: #374151;
      margin-top: 2px;
      word-break: break-word;
    }

    .cell-teacher { font-weight: 600; }
    .cell-empty {
      color: #d1d5db;
      display: inline-block;
      width: 100%;
      text-align: center;
      padding-top: 12px;
    }

    .sc-present { background: #d1fae5; }
    .sc-absent { background: #fee2e2; }
    .sc-late { background: #fef3c7; }
    .sc-excused { background: #dbeafe; }
    .sc-empty { background: #f9fafb; }

    .badge {
      padding: 4px 8px;
      border-radius: 10px;
      font-weight: 600;
      font-size: 12px;
      display: inline-block;
    }

    .badge-active { background: #d1fae5; color: #065f46; }
    .badge-paused { background: #fef3c7; color: #92400e; }
    .badge-completed { background: #e5e7eb; color: #374151; }
    .badge-refund { background: #dbeafe; color: #1d4ed8; }
    .badge-other { background: #e5e7eb; color: #374151; }
  `],
})
export class ComprehensiveReportComponent implements OnInit {
  private studentService = inject(StudentService);
  private classService = inject(ClassService);

  readonly sessionColumnCount = 20;
  readonly dataStatusOptions = [
    { value: 'DANG_HOC', label: 'Dang hoc' },
    { value: 'BAO_LUU', label: 'Bao luu' },
    { value: 'KET_THUC', label: 'Ket thuc' },
    { value: 'HOAN_HOC_PHI', label: 'Hoan hoc phi' },
  ];

  allRows = signal<ComprehensiveReportRow[]>([]);
  classes = signal<ClassItem[]>([]);
  loading = signal(false);
  error = signal('');
  selectedSaleId = signal('');
  selectedDataStatus = signal('');

  selectedClassId = '';
  searchTerm = '';

  private searchTimeout: any;

  saleOptions = computed(() => {
    const options = new Map<string, string>();
    for (const row of this.allRows()) {
      const key = this.getSaleKey(row);
      const label = (row.saleName || '').trim();
      if (!key || !label || options.has(key)) continue;
      options.set(key, label);
    }

    return Array.from(options.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'vi', { sensitivity: 'base' }));
  });

  reportRows = computed(() =>
    this.allRows().filter((row) => {
      if (this.selectedSaleId()) {
        const saleKey = this.getSaleKey(row);
        if (saleKey !== this.selectedSaleId()) return false;
      }

      if (this.selectedDataStatus() && row.dataStatus !== this.selectedDataStatus()) {
        return false;
      }

      return true;
    }),
  );

  visibleMaxSessions = computed(() => {
    let max = 0;
    for (const row of this.reportRows()) {
      max = Math.max(max, this.getRowSessionSpan(row));
    }
    return max;
  });

  sessionChunks = computed(() => {
    const rows = this.reportRows();
    if (rows.length === 0) return [];

    const totalSessions = Math.max(this.visibleMaxSessions(), this.sessionColumnCount);
    const chunks: Array<{ start: number; end: number; indices: number[] }> = [];

    for (let start = 0; start < totalSessions; start += this.sessionColumnCount) {
      const endExclusive = Math.min(start + this.sessionColumnCount, totalSessions);
      const indices = Array.from({ length: endExclusive - start }, (_, offset) => start + offset);
      chunks.push({
        start,
        end: endExclusive,
        indices,
      });
    }

    return chunks;
  });

  async ngOnInit() {
    await this.loadClasses();
    await this.loadReport();
  }

  async loadClasses(): Promise<void> {
    try {
      const classes = await this.classService.list();
      this.classes.set(classes);
    } catch (err) {
      console.error('Error loading classes:', err);
    }
  }

  onSearchInput() {
    clearTimeout(this.searchTimeout);
    this.searchTimeout = setTimeout(() => this.loadReport(), 400);
  }

  onSaleFilterChange(value: string) {
    this.selectedSaleId.set(value || '');
  }

  onDataStatusFilterChange(value: string) {
    this.selectedDataStatus.set(value || '');
  }

  async loadReport() {
    this.loading.set(true);
    this.error.set('');

    try {
      const data: ComprehensiveReportResponse = await this.studentService.getComprehensiveReport(
        this.selectedClassId || undefined,
        this.searchTerm || undefined,
      );
      this.allRows.set(data.rows);

      const availableSales = new Set(data.rows.map((row) => this.getSaleKey(row)).filter(Boolean));
      if (this.selectedSaleId() && !availableSales.has(this.selectedSaleId())) {
        this.selectedSaleId.set('');
      }
    } catch (err: any) {
      this.error.set(err.message || 'Khong the tai bao cao');
      this.allRows.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  uniqueClasses(): number {
    return new Set(this.reportRows().map((row) => row.classCode)).size;
  }

  totalAttended(): number {
    return this.reportRows().reduce((sum, row) => sum + (row.attendedCount || 0), 0);
  }

  formatBirthDate(dateOfBirth?: string | null, birthMonth?: number | null): string {
    if (dateOfBirth) {
      const d = new Date(dateOfBirth);
      if (!Number.isNaN(d.getTime())) {
        return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1)
          .toString()
          .padStart(2, '0')}/${d.getFullYear()}`;
      }
    }
    if (birthMonth) return `Thang ${birthMonth}`;
    return '-';
  }

  formatMonthBirth(month?: number | null): string {
    if (!month) return '-';
    return `Thang ${month}`;
  }

  formatSessionDateTime(session?: SessionCell): string {
    if (!session) return '-';

    if (session.attendedAt) {
      const attendedAt = new Date(session.attendedAt);
      if (!Number.isNaN(attendedAt.getTime())) {
        return `${attendedAt.getHours().toString().padStart(2, '0')}:${attendedAt
          .getMinutes()
          .toString()
          .padStart(2, '0')} ${attendedAt.getDate().toString().padStart(2, '0')}/${(
          attendedAt.getMonth() + 1
        )
          .toString()
          .padStart(2, '0')}/${attendedAt.getFullYear()}`;
      }
    }

    if (session.date) {
      const d = new Date(`${session.date}T00:00:00`);
      if (!Number.isNaN(d.getTime())) {
        return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1)
          .toString()
          .padStart(2, '0')}/${d.getFullYear()}`;
      }
    }

    return '-';
  }

  formatSessionDuration(duration?: number): string {
    const minutes = Number(duration || 0);
    return minutes > 0 ? `Thoi luong: ${minutes} phut` : 'Thoi luong: -';
  }

  getSessionTeacher(session?: SessionCell): string {
    const teacher = session?.teacherDisplay || session?.teacherName || session?.teacherCode || '-';
    return `GV: ${teacher}`;
  }

  getClassModeLabel(classMode?: string): string {
    return classMode === 'OFFLINE' ? 'Offline' : 'Online';
  }

  formatTeacherSalary(row: ComprehensiveReportRow): string {
    const amount = Number(row.teacherSalary || 0);
    if (!amount) return '-';
    const suffix = row.teacherSalaryType === 'PER_STUDENT' ? '/HS' : '/buoi';
    return `${amount.toLocaleString('vi-VN')}d${suffix}`;
  }

  getDataStatusLabel(status?: string): string {
    switch (status) {
      case 'DANG_HOC':
        return 'Dang hoc';
      case 'BAO_LUU':
        return 'Bao luu';
      case 'KET_THUC':
        return 'Ket thuc';
      case 'HOAN_HOC_PHI':
        return 'Hoan hoc phi';
      default:
        return status || '-';
    }
  }

  getDataStatusClass(status?: string): string {
    switch (status) {
      case 'DANG_HOC':
        return 'badge-active';
      case 'BAO_LUU':
        return 'badge-paused';
      case 'KET_THUC':
        return 'badge-completed';
      case 'HOAN_HOC_PHI':
        return 'badge-refund';
      default:
        return 'badge-other';
    }
  }

  getStatusLabel(status: string | null): string {
    switch (status) {
      case 'PRESENT':
        return 'CM';
      case 'ABSENT':
        return 'V';
      case 'LATE':
        return 'M';
      case 'EXCUSED':
        return 'CP';
      default:
        return '-';
    }
  }

  getSessionCellClass(session?: SessionCell): string {
    if (!session) return 'sc-empty';
    switch (session.status) {
      case 'PRESENT':
        return 'sc-present';
      case 'ABSENT':
        return 'sc-absent';
      case 'LATE':
        return 'sc-late';
      case 'EXCUSED':
        return 'sc-excused';
      default:
        return 'sc-empty';
    }
  }

  exportCSV() {
    const rows = this.reportRows();
    const max = Math.max(this.visibleMaxSessions(), this.sessionColumnCount);
    if (rows.length === 0) return;

    const headers = [
      'STT',
      'Loai lop (Online/Offline)',
      'Ma HS',
      'Ten HS',
      'Level',
      'Ngay sinh',
      'Ten PH',
      'SDT',
      'Ngay sinh me',
      'Ma lop',
      'Ma GV + ten GV',
      'Luong GV',
      'So Hoa Don',
      'Tong buoi',
      'Da Hoc',
      'Sale',
      'Tinh Trang Data',
    ];
    for (let i = 1; i <= max; i++) {
      headers.push(`Buoi ${i}`);
    }

    const csvRows = [headers.join(',')];
    rows.forEach((row, idx) => {
      const cells: (string | number)[] = [
        idx + 1,
        this.csvEscape(this.getClassModeLabel(row.classMode)),
        this.csvEscape(row.studentCode || ''),
        this.csvEscape(row.fullName || ''),
        this.csvEscape(row.level || row.grade || ''),
        this.csvEscape(this.formatBirthDate(row.dateOfBirth, row.studentBirthMonth)),
        this.csvEscape(row.parentName || ''),
        this.csvEscape(row.parentPhone || ''),
        this.csvEscape(this.formatMonthBirth(row.parentBirthMonth)),
        this.csvEscape(row.classCode || ''),
        this.csvEscape(row.teacherCodeAndName || row.teacherName || ''),
        this.csvEscape(this.formatTeacherSalary(row)),
        this.csvEscape(row.invoiceNumber || ''),
        row.totalSessions || '',
        row.sessionsCompleted || 0,
        this.csvEscape(row.saleName || ''),
        this.csvEscape(this.getDataStatusLabel(row.dataStatus)),
      ];

      for (let i = 0; i < max; i++) {
        cells.push(this.csvEscape(this.formatSessionForExport(row.sessions[i])));
      }

      csvRows.push(cells.join(','));
    });

    const bom = '\uFEFF';
    const blob = new Blob([bom + csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bao-cao-tong-hop-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  private getRowSessionSpan(row: ComprehensiveReportRow): number {
    return Math.max(Number(row.totalSessions || 0), Array.isArray(row.sessions) ? row.sessions.length : 0);
  }

  private getSaleKey(row: ComprehensiveReportRow): string {
    return row.saleId || row.saleName || '';
  }

  private formatSessionForExport(session?: SessionCell): string {
    if (!session) return '';
    return [
      this.getStatusLabel(session.status),
      this.formatSessionDateTime(session),
      this.formatSessionDuration(session.duration),
      this.getSessionTeacher(session),
    ]
      .filter((part) => part && part !== '-')
      .join(' | ');
  }

  private csvEscape(value: string): string {
    if (!value) return '';
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }
}
