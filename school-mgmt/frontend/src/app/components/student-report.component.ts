import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  StudentReportClassOption,
  StudentReportEntry,
  StudentReportResponse,
  StudentService,
} from '../services/student.service';
import { environment } from '../../environments/environment';

import { FlowGuideComponent } from './shared/flow-guide.component';

type StudentReportRowView = {
  key: string;
  item: StudentReportEntry;
  faceImageUrl: string;
};

@Component({
  selector: 'app-student-report',
  standalone: true,
  imports: [CommonModule, FormsModule, FlowGuideComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-flow-guide featureKey="student-report"></app-flow-guide>
    <div class="report-container">
      <h1>Bao cao hoc sinh</h1>

      <div class="filters">
        <div class="filter-group">
          <label>Lop hoc</label>
          <select
            data-testid="student-report-class-filter"
            [ngModel]="selectedClassId"
            (ngModelChange)="onClassFilterChange($event)"
          >
            <option value="">Tat ca lop</option>
            <option
              *ngFor="let cls of classOptions(); trackBy: trackClassOption"
              [value]="cls._id"
            >
              {{ cls.code }} - {{ cls.name }} ({{ cls.studentCount }} HS)
            </option>
          </select>
        </div>

        <div class="filter-group filter-group-search">
          <label>Tim kiem</label>
          <input
            data-testid="student-report-search-input"
            type="text"
            [(ngModel)]="searchTerm"
            (keyup.enter)="applyFilters()"
            placeholder="Ten HS, ma HS, phu huynh, SDT..."
          />
        </div>

        <button
          type="button"
          class="btn btn-primary"
          data-testid="student-report-search-button"
          (click)="applyFilters()"
          [disabled]="loading()"
        >
          Tim kiem
        </button>
      </div>

      <div *ngIf="loading()" class="loading">Dang tai du lieu...</div>
      <div *ngIf="error()" class="error">{{ error() }}</div>

      <div
        *ngIf="!loading() && reportRows().length > 0"
        class="report-summary"
        data-testid="student-report-summary"
      >
        <div class="summary-card">
          <h3>Tong hoc sinh phu hop</h3>
          <p class="summary-number">{{ totalItems() }}</p>
        </div>
        <div class="summary-card">
          <h3>Trang hien tai</h3>
          <p class="summary-number">{{ currentPage() }} / {{ totalPages() }}</p>
        </div>
        <div class="summary-card">
          <h3>Tong luot diem danh tren trang</h3>
          <p class="summary-number">{{ totalAttendanceOnPage() }}</p>
        </div>
      </div>

      <div
        *ngIf="reportRows().length > 0"
        class="report-table-container"
        data-testid="student-report-table-container"
      >
        <table class="report-table">
          <thead>
            <tr>
              <th>STT</th>
              <th>Anh</th>
              <th>Ma hoc sinh</th>
              <th>Ten hoc sinh</th>
              <th>Tuoi</th>
              <th>Phu huynh</th>
              <th>So dien thoai</th>
              <th>Goi san pham</th>
              <th>So buoi diem danh</th>
            </tr>
          </thead>
          <tbody>
            <tr
              *ngFor="let row of reportRows(); let i = index; trackBy: trackReportRow"
              [attr.data-testid]="'student-report-row-' + row.key"
            >
              <td>{{ getRowNumber(i) }}</td>
              <td class="image-cell">
                <img
                  *ngIf="row.faceImageUrl; else noImage"
                  [src]="row.faceImageUrl"
                  alt="Anh hoc sinh"
                  (click)="showImageModal(row.faceImageUrl)"
                  class="student-avatar"
                />
                <ng-template #noImage>
                  <span class="no-image">Khong co anh</span>
                </ng-template>
              </td>
              <td>{{ row.item.studentCode }}</td>
              <td><strong>{{ row.item.fullName }}</strong></td>
              <td>{{ row.item.age }}</td>
              <td>{{ row.item.parentName }}</td>
              <td>{{ row.item.parentPhone }}</td>
              <td>{{ row.item.productPackage?.name || '-' }}</td>
              <td class="attendance-count">
                <span class="badge badge-success">{{ row.item.totalAttendance }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div
        class="pagination"
        *ngIf="totalPages() > 1"
        data-testid="student-report-pagination"
      >
        <button
          type="button"
          (click)="goToPage(currentPage() - 1)"
          [disabled]="currentPage() <= 1 || loading()"
        >
          &laquo; Truoc
        </button>
        <span>
          Trang {{ currentPage() }} / {{ totalPages() }}
          ({{ reportRows().length }} / {{ totalItems() }} dong)
        </span>
        <button
          type="button"
          (click)="goToPage(currentPage() + 1)"
          [disabled]="currentPage() >= totalPages() || loading()"
        >
          Sau &raquo;
        </button>
      </div>

      <div
        *ngIf="!loading() && reportRows().length === 0 && !error()"
        class="no-data"
      >
        Khong tim thay hoc sinh phu hop.
      </div>

      <div class="modal" *ngIf="modalImage()" (click)="closeImageModal()">
        <div class="modal-content">
          <span class="close">&times;</span>
          <img [src]="modalImage()" alt="Anh hoc sinh" />
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .report-container {
        padding: 2rem;
        max-width: 1600px;
        margin: 0 auto;
      }

      h1 {
        color: #1f2937;
        margin-bottom: 1.5rem;
      }

      .filters {
        display: flex;
        gap: 12px;
        flex-wrap: wrap;
        align-items: end;
        background: white;
        padding: 16px;
        border-radius: 8px;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        margin-bottom: 24px;
      }

      .filter-group {
        display: flex;
        flex-direction: column;
        gap: 6px;
        min-width: 220px;
        flex: 0 1 auto;
      }

      .filter-group-search {
        flex: 1 1 320px;
      }

      .filter-group label {
        font-weight: 600;
        color: #374151;
        font-size: 13px;
      }

      .filter-group select,
      .filter-group input {
        height: 36px;
        padding: 8px 10px;
        border: 1px solid #d1d5db;
        border-radius: 6px;
        font-size: 14px;
      }

      .btn {
        height: 36px;
        padding: 0 16px;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-weight: 600;
      }

      .btn-primary {
        background: #2563eb;
        color: white;
      }

      .btn-primary:hover:not(:disabled) {
        background: #1d4ed8;
      }

      .btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
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
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 16px;
        margin-bottom: 24px;
      }

      .summary-card {
        background: white;
        padding: 18px;
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
        font-size: 28px;
        font-weight: 700;
        color: #1f2937;
        margin: 0;
      }

      .report-table-container {
        background: white;
        border-radius: 8px;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        overflow: auto;
        max-height: 72vh;
      }

      .report-table {
        width: 100%;
        border-collapse: collapse;
      }

      .report-table thead {
        background: #f9fafb;
        border-bottom: 2px solid #e5e7eb;
      }

      .report-table th {
        position: sticky;
        top: 0;
        z-index: 2;
        background: #f9fafb;
        padding: 14px 16px;
        text-align: left;
        font-weight: 600;
        color: #374151;
        font-size: 13px;
        text-transform: uppercase;
        letter-spacing: 0.4px;
      }

      .report-table td {
        padding: 14px 16px;
        border-bottom: 1px solid #e5e7eb;
        color: #1f2937;
        white-space: nowrap;
      }

      .report-table tbody tr:hover {
        background: #f9fafb;
      }

      .image-cell {
        text-align: center;
      }

      .student-avatar {
        width: 50px;
        height: 50px;
        object-fit: cover;
        border-radius: 50%;
        cursor: pointer;
        transition: transform 0.2s;
        border: 2px solid #e5e7eb;
      }

      .student-avatar:hover {
        transform: scale(1.06);
      }

      .no-image {
        color: #9ca3af;
        font-size: 12px;
        font-style: italic;
      }

      .attendance-count {
        text-align: center;
      }

      .badge {
        padding: 6px 12px;
        border-radius: 999px;
        font-weight: 600;
        font-size: 13px;
      }

      .badge-success {
        background: #d1fae5;
        color: #065f46;
      }

      .pagination {
        display: flex;
        gap: 12px;
        align-items: center;
        justify-content: center;
        padding: 16px;
        margin-top: 12px;
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

      .modal {
        display: flex;
        align-items: center;
        justify-content: center;
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        z-index: 1000;
        cursor: pointer;
      }

      .modal-content {
        position: relative;
        max-width: 90%;
        max-height: 90%;
      }

      .modal-content img {
        max-width: 100%;
        max-height: 90vh;
        border-radius: 8px;
      }

      .close {
        position: absolute;
        top: -40px;
        right: 0;
        color: white;
        font-size: 40px;
        font-weight: bold;
        cursor: pointer;
      }

      @media (max-width: 900px) {
        .report-container {
          padding: 1rem;
        }

        .filter-group,
        .filter-group-search {
          min-width: 100%;
          flex-basis: 100%;
        }

        .btn {
          width: 100%;
        }
      }
    `,
  ],
})
export class StudentReportComponent implements OnInit {
  readonly pageSize = 25;
  private readonly studentService = inject(StudentService);

  reportData = signal<StudentReportEntry[]>([]);
  classOptions = signal<StudentReportClassOption[]>([]);
  loading = signal(false);
  error = signal('');
  modalImage = signal('');
  totalItems = signal(0);
  totalPages = signal(1);
  currentPage = signal(1);

  selectedClassId = '';
  searchTerm = '';

  readonly reportRows = computed<StudentReportRowView[]>(() =>
    this.reportData().map((item) => ({
      key: item._id,
      item,
      faceImageUrl: this.resolveImageUrl(item.faceImage),
    })),
  );

  readonly totalAttendanceOnPage = computed(() =>
    this.reportData().reduce(
      (sum, item) => sum + Number(item.totalAttendance || 0),
      0,
    ),
  );

  async ngOnInit() {
    await Promise.all([this.loadClassOptions(), this.loadReport()]);
  }

  async loadClassOptions(): Promise<void> {
    try {
      const classes = await this.studentService.getStudentReportClasses();
      this.classOptions.set(
        [...classes].sort((left, right) =>
          `${left.code} ${left.name}`.localeCompare(
            `${right.code} ${right.name}`,
            'vi',
            { sensitivity: 'base' },
          ),
        ),
      );
    } catch (error) {
      console.error('Error loading classes:', error);
      this.classOptions.set([]);
    }
  }

  onClassFilterChange(value: string) {
    this.selectedClassId = value || '';
    this.currentPage.set(1);
    void this.loadReport();
  }

  applyFilters() {
    this.currentPage.set(1);
    void this.loadReport();
  }

  async loadReport() {
    this.loading.set(true);
    this.error.set('');

    try {
      const response: StudentReportResponse =
        await this.studentService.getStudentReport(
          this.selectedClassId || undefined,
          this.searchTerm.trim() || undefined,
          this.currentPage(),
          this.pageSize,
        );

      this.reportData.set(response.rows || []);
      this.totalItems.set(response.meta?.total || 0);
      this.totalPages.set(response.meta?.totalPages || 1);
      this.currentPage.set(response.meta?.page || 1);
    } catch (error: any) {
      this.error.set(error.message || 'Khong the tai bao cao');
      this.reportData.set([]);
      this.totalItems.set(0);
      this.totalPages.set(1);
      this.currentPage.set(1);
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

  getRowNumber(index: number): number {
    return (this.currentPage() - 1) * this.pageSize + index + 1;
  }

  showImageModal(imageUrl: string) {
    if (!imageUrl) {
      return;
    }
    this.modalImage.set(imageUrl);
  }

  closeImageModal() {
    this.modalImage.set('');
  }

  trackClassOption(_index: number, item: StudentReportClassOption): string {
    return item._id;
  }

  trackReportRow(_index: number, row: StudentReportRowView): string {
    return row.key;
  }

  private resolveImageUrl(imageUrl?: string | null): string {
    if (!imageUrl) {
      return '';
    }
    if (imageUrl.startsWith('http')) {
      return imageUrl;
    }
    return `${environment.apiBase}${imageUrl}`;
  }
}
