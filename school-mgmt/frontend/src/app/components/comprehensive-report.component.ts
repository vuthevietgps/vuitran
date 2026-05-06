import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FlowGuideComponent } from './shared/flow-guide.component';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  ComprehensiveReportResponse,
  ComprehensiveReportClassOption,
  ComprehensiveReportRow,
  SessionCell,
  StudentService,
} from '../services/student.service';
import { AuthService } from '../services/auth.service';
import { UserService } from '../services/user.service';

type ReportClassMode = 'ONLINE' | 'OFFLINE';

@Component({
  selector: 'app-comprehensive-report',
  standalone: true,
  imports: [CommonModule, FormsModule, FlowGuideComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-flow-guide featureKey="comprehensive-report"></app-flow-guide>
    <div class="report-container">
      <h1>Bang diem danh tong hop</h1>

      <div class="report-tabs" role="tablist" aria-label="Loai bao cao diem danh tong hop">
        <button
          type="button"
          role="tab"
          class="report-tab"
          data-testid="comprehensive-tab-online"
          [class.active]="activeTab() === 'ONLINE'"
          [attr.aria-selected]="activeTab() === 'ONLINE'"
          (click)="onTabChange('ONLINE')"
        >
          Bao cao diem danh tong hop online
        </button>
        <button
          type="button"
          role="tab"
          class="report-tab"
          data-testid="comprehensive-tab-offline"
          [class.active]="activeTab() === 'OFFLINE'"
          [attr.aria-selected]="activeTab() === 'OFFLINE'"
          (click)="onTabChange('OFFLINE')"
        >
          Bao cao diem danh tong hop offline
        </button>
      </div>

      <div class="filters compact">
        <div class="filter-item">
          <label>Lop</label>
          <select
            data-testid="comprehensive-class-filter"
            [ngModel]="selectedClassId"
            (ngModelChange)="onClassFilterChange($event)"
          >
            <option value="">Tat ca lop</option>
            <option *ngFor="let cls of classOptions(); trackBy: trackClassOption" [value]="cls._id">
              {{ cls.code }} - {{ cls.name }}
            </option>
          </select>
        </div>

        <div class="filter-item" *ngIf="!isSale() && !isShareholder()">
          <label>Sale</label>
          <select
            data-testid="comprehensive-sale-filter"
            [ngModel]="selectedSaleId()"
            (ngModelChange)="onSaleFilterChange($event)"
          >
            <option value="">Tat ca sale</option>
            <option *ngFor="let sale of saleOptions()" [value]="sale.id">
              {{ sale.name }}
            </option>
          </select>
        </div>

        <div class="filter-item">
          <label>Tinh trang data</label>
          <select
            data-testid="comprehensive-data-status-filter"
            [ngModel]="selectedDataStatus()"
            (ngModelChange)="onDataStatusFilterChange($event)"
          >
            <option value="">Tat ca tinh trang</option>
            <option
              *ngFor="let option of dataStatusOptions"
              [value]="option.value"
            >
              {{ option.label }}
            </option>
          </select>
        </div>

        <div class="filter-item filter-item-search" *ngIf="!isShareholder()">
          <label>Tim kiem</label>
          <input
            data-testid="comprehensive-search-input"
            type="text"
            [(ngModel)]="searchTerm"
            (input)="onSearchInput()"
            (keyup.enter)="applyFilters()"
            placeholder="Ten HS, ma HS, phu huynh, SDT..."
          />
        </div>

        <div class="filter-actions">
          <button
            data-testid="comprehensive-search-button"
            class="btn btn-primary"
            (click)="applyFilters()"
          >
            Tim kiem
          </button>
          <button
            data-testid="comprehensive-export-button"
            class="btn btn-export"
            (click)="exportCSV()"
            *ngIf="!isShareholder()"
          >
            Xuat CSV
          </button>
        </div>
      </div>

      <div class="privacy-banner" *ngIf="isShareholder()">
        Du lieu chi tiet da duoc an danh cho vai tro co dong.
      </div>

      <div *ngIf="loading()" class="loading">Dang tai du lieu...</div>
      <div *ngIf="error()" class="error">{{ error() }}</div>

      <div
        *ngIf="!loading() && reportRows().length > 0"
        class="report-summary"
        data-testid="comprehensive-summary"
      >
        <div
          class="summary-card"
          data-testid="comprehensive-summary-total-rows"
        >
          <h3>Tong dong phu hop</h3>
          <p class="summary-number">{{ totalItems() }}</p>
        </div>
        <div
          class="summary-card"
          data-testid="comprehensive-summary-page"
        >
          <h3>Trang hien tai</h3>
          <p class="summary-number">{{ currentPage() }} / {{ totalPages() }}</p>
        </div>
        <div
          class="summary-card"
          data-testid="comprehensive-summary-current-page-rows"
        >
          <h3>Dong tren trang</h3>
          <p class="summary-number">{{ reportRows().length }}</p>
        </div>
        <div
          class="summary-card"
          data-testid="comprehensive-summary-max-sessions"
        >
          <h3>Buoi toi da</h3>
          <p class="summary-number">{{ visibleMaxSessions() }}</p>
        </div>
        <div
          class="summary-card"
          data-testid="comprehensive-summary-total-attended"
        >
          <h3>Tong luot co mat</h3>
          <p class="summary-number">{{ totalAttended() }}</p>
        </div>
        <div
          class="summary-card"
          data-testid="comprehensive-summary-total-tables"
        >
          <h3>So bang</h3>
          <p class="summary-number">{{ sessionChunks().length }}</p>
        </div>
      </div>

      <p *ngIf="!loading() && reportRows().length > 0" class="report-note">
        <strong>Nguon du lieu cot Tong buoi:</strong> lay truc tiep tu hoa don
        hoc phi chua huy/tu choi, gom buoi chinh, buoi tang va buoi thu.
      </p>

      <ng-container *ngIf="!loading() && reportRows().length > 0">
        <div
          *ngFor="let chunk of sessionChunks(); trackBy: trackSessionChunk"
          class="table-block"
          [attr.data-testid]="'comprehensive-table-block-' + chunk.start"
        >
          <h3 class="table-title">
            Bang buoi {{ chunk.start + 1 }} - {{ chunk.end }}
          </h3>

          <div
            class="report-table-container"
            data-testid="comprehensive-table-container"
          >
            <table class="report-table">
              <thead>
                <tr>
                  <th class="sticky-col col-stt">STT</th>
                  <th class="sticky-col col-code">Ma HS</th>
                  <th class="sticky-col col-name" *ngIf="!isShareholder()">
                    Ten HS
                  </th>
                  <th>Level</th>
                  <th *ngIf="!isShareholder()">Ngay sinh</th>
                  <th *ngIf="!isShareholder()">Ten PH</th>
                  <th *ngIf="!isShareholder()">SDT</th>
                  <th *ngIf="!isShareholder()">Ngay sinh me</th>
                  <th>Ma lop</th>
                  <th *ngIf="!isShareholder()">Ma GV + ten GV</th>
                  <th *ngIf="showTeacherSalary()">Luong GV</th>
                  <th>So Hoa Don</th>
                  <th
                    title="Tong buoi lay truc tiep tu cac hoa don hoc phi chua huy/tu choi, gom buoi chinh, buoi tang va buoi thu"
                  >
                    Tong buoi (Theo HD)
                  </th>
                  <th>Da Hoc</th>
                  <th *ngIf="!isShareholder()">Sale</th>
                  <th>Tinh Trang Data</th>
                  <th *ngFor="let si of chunk.indices" class="session-col">
                    Buoi {{ si + 1 }}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  *ngFor="let row of reportRows(); let i = index; trackBy: trackReportRow"
                  [attr.data-testid]="
                    'comprehensive-row-' + row.studentId + '-' + row.classId
                  "
                >
                  <td class="sticky-col col-stt">{{ i + 1 }}</td>
                  <td class="sticky-col col-code">
                    {{ row.studentCode || '-' }}
                  </td>
                  <td class="sticky-col col-name" *ngIf="!isShareholder()">
                    <strong>{{ row.fullName || '-' }}</strong>
                  </td>
                  <td>{{ row.level || row.grade || '-' }}</td>
                  <td *ngIf="!isShareholder()">
                    {{
                      formatBirthDate(row.dateOfBirth, row.studentBirthMonth)
                    }}
                  </td>
                  <td *ngIf="!isShareholder()">{{ row.parentName || '-' }}</td>
                  <td *ngIf="!isShareholder()">{{ row.parentPhone || '-' }}</td>
                  <td *ngIf="!isShareholder()">
                    {{ formatMonthBirth(row.parentBirthMonth) }}
                  </td>
                  <td class="class-code">{{ row.classCode || '-' }}</td>
                  <td
                    *ngIf="!isShareholder()"
                    [title]="row.teacherCodeAndName || row.teacherName"
                  >
                    {{ row.teacherCodeAndName || row.teacherName || '-' }}
                  </td>
                  <td *ngIf="showTeacherSalary()" class="number-cell">
                    {{ formatTeacherSalary(row) }}
                  </td>
                  <td
                    [attr.data-testid]="
                      'comprehensive-invoice-number-' + row.studentId
                    "
                  >
                    {{ row.invoiceNumber || '-' }}
                  </td>
                  <td
                    class="number-cell"
                    [attr.data-testid]="
                      'comprehensive-total-sessions-' + row.studentId
                    "
                  >
                    {{ row.totalSessions || '-' }}
                  </td>
                  <td
                    class="number-cell"
                    [attr.data-testid]="
                      'comprehensive-sessions-completed-' + row.studentId
                    "
                  >
                    {{ row.sessionsCompleted || 0 }}
                  </td>
                  <td *ngIf="!isShareholder()">{{ row.saleName || '-' }}</td>
                  <td>
                    <span
                      class="badge"
                      [ngClass]="getDataStatusClass(row.dataStatus)"
                    >
                      {{ getDataStatusLabel(row.dataStatus) }}
                    </span>
                  </td>

                  <td
                    *ngFor="let si of chunk.indices"
                    class="session-cell"
                    [attr.data-testid]="
                      'comprehensive-session-cell-' + row.studentId + '-' + si
                    "
                    [ngClass]="getSessionCellClass(row.sessions[si])"
                  >
                    <ng-container
                      *ngIf="row.sessions[si] as s; else emptySessionCell"
                    >
                      <div class="cell-status">
                        {{ getStatusLabel(s.status) }}
                      </div>
                      <div class="cell-meta">
                        {{ formatSessionDateTime(s) }}
                      </div>
                      <div class="cell-meta">
                        {{ formatSessionDuration(s.duration) }}
                      </div>
                      <div
                        class="cell-meta cell-teacher"
                        [title]="getSessionTeacher(s)"
                        *ngIf="!isShareholder(); else redactedTeacher"
                      >
                        {{ getSessionTeacher(s) }}
                      </div>
                    </ng-container>
                    <ng-template #emptySessionCell>
                      <span class="cell-empty">-</span>
                    </ng-template>
                    <ng-template #redactedTeacher>
                      <div class="cell-meta cell-teacher">GV: an danh</div>
                    </ng-template>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </ng-container>

      <div class="pagination" *ngIf="totalPages() > 1" data-testid="comprehensive-pagination">
        <button
          type="button"
          (click)="goToPage(currentPage() - 1)"
          [disabled]="currentPage() <= 1 || loading()"
          data-testid="comprehensive-prev-page"
        >
          &laquo; Truoc
        </button>
        <span>
          Trang {{ currentPage() }} / {{ totalPages() }} ({{ reportRows().length }} / {{ totalItems() }} dong)
        </span>
        <button
          type="button"
          (click)="goToPage(currentPage() + 1)"
          [disabled]="currentPage() >= totalPages() || loading()"
          data-testid="comprehensive-next-page"
        >
          Sau &raquo;
        </button>
      </div>

      <div
        *ngIf="!loading() && reportRows().length === 0 && !error()"
        class="no-data"
      >
        Khong tim thay du lieu phu hop. Hay thu thay doi lop, sale, tinh trang
        data hoac tu khoa tim kiem.
      </div>
    </div>
  `,
  styles: [
    `
      .report-container {
        padding: 2rem;
        max-width: 100%;
        margin: 0 auto;
      }
      h1 {
        color: #1f2937;
        margin-bottom: 1.5rem;
      }

      .report-tabs {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        margin-bottom: 16px;
      }

      .report-tab {
        min-height: 42px;
        padding: 10px 16px;
        border: 1px solid #cbd5e1;
        border-radius: 999px;
        background: white;
        color: #334155;
        cursor: pointer;
        font-size: 13px;
        font-weight: 700;
        transition: all 0.2s ease;
      }

      .report-tab.active {
        border-color: #2563eb;
        background: #eff6ff;
        color: #1d4ed8;
        box-shadow: 0 0 0 1px rgba(37, 99, 235, 0.08);
      }

      .filters {
        display: flex;
        flex-wrap: wrap;
        align-items: end;
        gap: 10px;
        background: white;
        padding: 10px 12px;
        border-radius: 8px;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        margin-bottom: 16px;
      }

      .filter-item {
        display: flex;
        flex-direction: column;
        gap: 4px;
        min-width: 180px;
        flex: 0 1 auto;
      }

      .filter-item-search {
        flex: 1 1 320px;
      }

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

      .privacy-banner {
        margin: 0 0 16px;
        padding: 12px 14px;
        border-radius: 8px;
        background: #eff6ff;
        color: #1d4ed8;
        border: 1px solid #bfdbfe;
        font-size: 13px;
        font-weight: 600;
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

      .btn-primary {
        background: #3b82f6;
        color: white;
      }
      .btn-primary:hover {
        background: #2563eb;
      }
      .btn-export {
        background: #10b981;
        color: white;
      }
      .btn-export:hover {
        background: #059669;
      }

      .loading,
      .error,
      .no-data {
        text-align: center;
        padding: 40px;
        background: white;
        border-radius: 8px;
        margin: 20px 0;
      }

      .error {
        color: #dc2626;
      }

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
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        text-align: center;
      }

      .summary-card h3 {
        font-size: 12px;
        color: #6b7280;
        margin-bottom: 8px;
        font-weight: 600;
        text-transform: uppercase;
      }

      .summary-number {
        font-size: 24px;
        font-weight: 700;
        color: #1f2937;
        margin: 0;
      }

      .table-block {
        margin-bottom: 18px;
      }

      .table-title {
        margin: 0 0 8px;
        font-size: 15px;
        font-weight: 700;
        color: #1f2937;
      }

      .report-table-container {
        background: white;
        border-radius: 8px;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        overflow: auto;
        max-height: 72vh;
        max-width: 100%;
        margin-bottom: 24px;
      }

      .report-table {
        width: max-content;
        min-width: 100%;
        border-collapse: collapse;
      }
      .report-table thead {
        background: #f9fafb;
        border-bottom: 2px solid #e5e7eb;
      }

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

      .report-table tbody tr:hover {
        background: #f9fafb;
      }

      .sticky-col {
        position: sticky;
        background: white;
        z-index: 2;
      }
      thead .sticky-col {
        background: #f9fafb;
        z-index: 6;
      }

      .col-stt {
        left: 0;
        min-width: 48px;
      }
      .col-code {
        left: 48px;
        min-width: 96px;
      }
      .col-name {
        left: 144px;
        min-width: 170px;
        text-align: left;
        border-right: 2px solid #e5e7eb;
      }

      .class-code {
        font-weight: 600;
        color: #2563eb;
      }
      .number-cell {
        text-align: center;
      }

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

      .cell-teacher {
        font-weight: 600;
      }
      .cell-empty {
        color: #d1d5db;
        display: inline-block;
        width: 100%;
        text-align: center;
        padding-top: 12px;
      }

      .sc-present {
        background: #d1fae5;
      }
      .sc-absent {
        background: #fee2e2;
      }
      .sc-late {
        background: #fef3c7;
      }
      .sc-excused {
        background: #dbeafe;
      }
      .sc-empty {
        background: #f9fafb;
      }

      .badge {
        padding: 4px 8px;
        border-radius: 10px;
        font-weight: 600;
        font-size: 12px;
        display: inline-block;
      }

      .badge-active {
        background: #d1fae5;
        color: #065f46;
      }
      .badge-paused {
        background: #fef3c7;
        color: #92400e;
      }
      .badge-completed {
        background: #e5e7eb;
        color: #374151;
      }
      .badge-refund {
        background: #dbeafe;
        color: #1d4ed8;
      }
      .badge-other {
        background: #e5e7eb;
        color: #374151;
      }

      .pagination {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 12px;
        margin-top: 12px;
        padding: 12px;
        background: white;
        border-radius: 8px;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      }

      .pagination button {
        height: 34px;
        padding: 0 14px;
        border: 1px solid #d1d5db;
        border-radius: 6px;
        background: white;
        cursor: pointer;
        font-weight: 600;
      }

      .pagination button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
    `,
  ],
})
export class ComprehensiveReportComponent implements OnInit, OnDestroy {
  readonly pageSize = 25;
  private studentService = inject(StudentService);
  private auth = inject(AuthService);
  private userService = inject(UserService);

  readonly sessionColumnCount = 20;
  readonly dataStatusOptions = [
    { value: 'DANG_HOC', label: 'Dang hoc' },
    { value: 'BAO_LUU', label: 'Bao luu' },
    { value: 'KET_THUC', label: 'Ket thuc' },
    { value: 'HOAN_HOC_PHI', label: 'Hoan hoc phi' },
  ];

  allRows = signal<ComprehensiveReportRow[]>([]);
  classOptions = signal<ComprehensiveReportClassOption[]>([]);
  saleOptions = signal<Array<{ id: string; name: string }>>([]);
  loading = signal(false);
  error = signal('');
  activeTab = signal<ReportClassMode>('ONLINE');
  selectedSaleId = signal('');
  selectedDataStatus = signal('');
  currentPage = signal(1);
  totalItems = signal(0);
  totalPages = signal(1);

  selectedClassId = '';
  searchTerm = '';

  private searchTimeout: any;
  reportRows = computed(() => this.allRows());

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

    const totalSessions = Math.max(
      this.visibleMaxSessions(),
      this.sessionColumnCount,
    );
    const chunks: Array<{ start: number; end: number; indices: number[] }> = [];

    for (
      let start = 0;
      start < totalSessions;
      start += this.sessionColumnCount
    ) {
      const endExclusive = Math.min(
        start + this.sessionColumnCount,
        totalSessions,
      );
      const indices = Array.from(
        { length: endExclusive - start },
        (_, offset) => start + offset,
      );
      chunks.push({
        start,
        end: endExclusive,
        indices,
      });
    }

    return chunks;
  });

  async ngOnInit() {
    await Promise.all([
      this.loadClassOptions(),
      this.loadSaleOptions(),
    ]);
    await this.loadReport();
  }

  ngOnDestroy() {
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
      this.searchTimeout = null;
    }
  }

  async loadClassOptions(): Promise<void> {
    try {
      const classes = await this.studentService.getComprehensiveReportClasses(
        undefined,
        500,
        this.activeTab(),
      );
      this.classOptions.set(classes);
    } catch (err) {
      console.error('Error loading classes:', err);
    }
  }

  async loadSaleOptions(): Promise<void> {
    if (this.isSale() || this.isShareholder()) {
      this.saleOptions.set([]);
      return;
    }

    try {
      const sales = await this.userService.listSales();
      this.saleOptions.set(
        sales
          .map((sale) => ({ id: sale._id, name: sale.fullName || sale.email }))
          .filter((sale) => !!sale.id && !!sale.name)
          .sort((a, b) => a.name.localeCompare(b.name, 'vi', { sensitivity: 'base' })),
      );
    } catch (err) {
      console.error('Error loading sales:', err);
      this.saleOptions.set([]);
    }
  }

  onSearchInput() {
    clearTimeout(this.searchTimeout);
    this.searchTimeout = setTimeout(() => {
      this.searchTimeout = null;
    }, 250);
  }

  onClassFilterChange(value: string) {
    this.selectedClassId = value || '';
    this.currentPage.set(1);
    void this.loadReport();
  }

  onSaleFilterChange(value: string) {
    this.selectedSaleId.set(value || '');
    this.currentPage.set(1);
    void this.loadReport();
  }

  onDataStatusFilterChange(value: string) {
    this.selectedDataStatus.set(value || '');
    this.currentPage.set(1);
    void this.loadReport();
  }

  async onTabChange(value: ReportClassMode) {
    if (this.activeTab() === value) {
      return;
    }
    this.activeTab.set(value);
    this.selectedClassId = '';
    this.currentPage.set(1);
    await this.loadClassOptions();
    await this.loadReport();
  }

  applyFilters() {
    this.currentPage.set(1);
    void this.loadReport();
  }

  async loadReport() {
    this.loading.set(true);
    this.error.set('');

    try {
      const data: ComprehensiveReportResponse =
        await this.studentService.getComprehensiveReport(
          this.selectedClassId || undefined,
          this.isShareholder() ? undefined : this.searchTerm || undefined,
          this.isShareholder() ? undefined : this.selectedSaleId() || undefined,
          this.selectedDataStatus() || undefined,
          this.currentPage(),
          this.pageSize,
          this.activeTab(),
        );
      this.allRows.set(data.rows);
      this.totalItems.set(data.meta?.total || 0);
      this.totalPages.set(data.meta?.totalPages || 1);
      this.currentPage.set(data.meta?.page || 1);
    } catch (err: any) {
      this.error.set(err.message || 'Khong the tai bao cao');
      this.allRows.set([]);
      this.totalItems.set(0);
      this.totalPages.set(1);
    } finally {
      this.loading.set(false);
    }
  }

  goToPage(page: number) {
    if (page < 1 || page > this.totalPages() || page === this.currentPage()) {
      return;
    }
    this.currentPage.set(page);
    void this.loadReport();
  }

  uniqueClasses(): number {
    return new Set(this.reportRows().map((row) => row.classCode)).size;
  }

  totalAttended(): number {
    return this.reportRows().reduce(
      (sum, row) => sum + (row.attendedCount || 0),
      0,
    );
  }

  formatBirthDate(
    dateOfBirth?: string | null,
    birthMonth?: number | null,
  ): string {
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
          .padStart(
            2,
            '0',
          )} ${attendedAt.getDate().toString().padStart(2, '0')}/${(
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
    const teacher =
      session?.teacherDisplay ||
      session?.teacherName ||
      session?.teacherCode ||
      '-';
    return `GV: ${teacher}`;
  }

  formatTeacherSalary(row: ComprehensiveReportRow): string {
    if (this.isShareholder()) return '-';
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
    if (this.isShareholder()) return;
    const rows = this.reportRows();
    const max = Math.max(this.visibleMaxSessions(), this.sessionColumnCount);
    if (rows.length === 0) return;

    const headers = [
      'STT',
      'Ma HS',
      'Ten HS',
      'Level',
      'Ngay sinh',
      'Ten PH',
      'SDT',
      'Ngay sinh me',
      'Ma lop',
      'Ma GV + ten GV',
      'So Hoa Don',
      'Tong buoi',
      'Da Hoc',
      'Sale',
      'Tinh Trang Data',
    ];
    if (this.showTeacherSalary()) {
      headers.splice(11, 0, 'Luong GV');
    }
    for (let i = 1; i <= max; i++) {
      headers.push(`Buoi ${i}`);
    }

    const csvRows = [headers.join(',')];
    rows.forEach((row, idx) => {
      const cells: (string | number)[] = [
        idx + 1,
        this.csvEscape(row.studentCode || ''),
        this.csvEscape(row.fullName || ''),
        this.csvEscape(row.level || row.grade || ''),
        this.csvEscape(
          this.formatBirthDate(row.dateOfBirth, row.studentBirthMonth),
        ),
        this.csvEscape(row.parentName || ''),
        this.csvEscape(row.parentPhone || ''),
        this.csvEscape(this.formatMonthBirth(row.parentBirthMonth)),
        this.csvEscape(row.classCode || ''),
        this.csvEscape(row.teacherCodeAndName || row.teacherName || ''),
        this.csvEscape(row.invoiceNumber || ''),
        row.totalSessions || '',
        row.sessionsCompleted || 0,
        this.csvEscape(row.saleName || ''),
        this.csvEscape(this.getDataStatusLabel(row.dataStatus)),
      ];
      if (this.showTeacherSalary()) {
        cells.splice(11, 0, this.csvEscape(this.formatTeacherSalary(row)));
      }

      for (let i = 0; i < max; i++) {
        cells.push(
          this.csvEscape(this.formatSessionForExport(row.sessions[i])),
        );
      }

      csvRows.push(cells.join(','));
    });

    const bom = '\uFEFF';
    const blob = new Blob([bom + csvRows.join('\n')], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const reportMode = this.activeTab() === 'OFFLINE' ? 'offline' : 'online';
    a.download = `bao-cao-tong-hop-${reportMode}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  trackClassOption(_index: number, option: ComprehensiveReportClassOption): string {
    return option._id;
  }

  trackSessionChunk(
    _index: number,
    chunk: { start: number; end: number; indices: number[] },
  ): number {
    return chunk.start;
  }

  trackReportRow(_index: number, row: ComprehensiveReportRow): string {
    return `${row.studentId}_${row.classId}`;
  }

  private getRowSessionSpan(row: ComprehensiveReportRow): number {
    return Math.max(
      Number(row.totalSessions || 0),
      Array.isArray(row.sessions) ? row.sessions.length : 0,
    );
  }

  isSale(): boolean {
    return this.auth.userSignal()?.role === 'SALE';
  }

  isShareholder(): boolean {
    return this.auth.userSignal()?.role === 'SHAREHOLDER';
  }

  showTeacherSalary(): boolean {
    return this.auth.userSignal()?.role !== 'PARENT' && !this.isShareholder();
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
