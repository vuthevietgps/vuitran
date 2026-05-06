import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AttendanceReportClassOption, AttendanceService } from '../services/attendance.service';
import { environment } from '../../environments/environment';

import { FlowGuideComponent } from './shared/flow-guide.component';

interface AttendanceReportItem {
  _id: string;
  date: string;
  attendedAt?: string;
  updatedAt?: string;
  status: string;
  imageUrl?: string;
  studentId: {
    _id: string;
    studentCode: string;
    fullName: string;
    age: number;
    level?: string;
    parentName: string;
    faceImage?: string;
    totalPurchasedSessions?: number;
  };
  classId: {
    _id: string;
    name: string;
    code: string;
  };
  teacherId: {
    _id: string;
    fullName: string;
    email: string;
  };
  notes?: string;
}

type AttendanceReportRowView = {
  key: string;
  item: AttendanceReportItem;
  dateDisplay: string;
  attendanceTimeDisplay: string;
  studentFaceImageUrl: string;
  attendanceImageUrl: string;
  totalPurchasedSessions: number;
};

@Component({
  selector: 'app-attendance-report',
  standalone: true,
  imports: [CommonModule, FormsModule, FlowGuideComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-flow-guide featureKey="attendance-report"></app-flow-guide>
    <div class="report-container">
      <h1>Bang diem danh tong hop</h1>

      <div class="filters">
        <div class="filter-group">
          <label>Tu ngay:</label>
          <input data-testid="attendance-report-start-date" type="date" [(ngModel)]="startDate" />
        </div>

        <div class="filter-group">
          <label>Den ngay:</label>
          <input data-testid="attendance-report-end-date" type="date" [(ngModel)]="endDate" />
        </div>

        <div class="filter-group class-picker">
          <label>Tim lop hoc:</label>
          <input
            data-testid="attendance-report-class-search"
            type="text"
            [ngModel]="classSearchKeyword"
            (ngModelChange)="onClassSearchChange($event)"
            placeholder="Nhap ma lop hoac ten lop" />
          <small class="filter-hint" *ngIf="classesLoading()">Dang tai goi y lop...</small>
        </div>

        <div class="filter-group class-picker">
          <label>Lop hoc (tuy chon):</label>
          <select
            data-testid="attendance-report-class-filter"
            [ngModel]="selectedClassId"
            (ngModelChange)="onClassSelectionChange($event)">
            <option value="">-- Tat ca cac lop --</option>
            <option *ngFor="let cls of classOptionsForSelect(); trackBy: trackClassOption" [value]="cls._id">
              {{ cls.code }} - {{ cls.name }} ({{ cls.studentCount }} HS)
            </option>
          </select>
          <small class="filter-hint" *ngIf="selectedClassOption() as selected">
            Da chon: {{ selected.code }} - {{ selected.name }}
          </small>
        </div>

        <button
          data-testid="attendance-report-search-button"
          class="btn-search"
          (click)="onApplyFilter()"
          [disabled]="loading()">
          {{ loading() ? 'Dang tai...' : 'Xem bao cao' }}
        </button>
      </div>

      <div *ngIf="error()" class="error-message">
        {{ error() }}
      </div>

      <div *ngIf="!loading() && reportRows().length === 0 && !error()" class="no-data">
        Khong co du lieu diem danh trong khoang thoi gian nay.
      </div>

      <div *ngIf="reportRows().length > 0" class="report-summary" data-testid="attendance-report-summary">
        <div class="summary-card" data-testid="attendance-report-summary-total-items">
          <h3>Tong so luot diem danh</h3>
          <p class="summary-number">{{ totalItems() }}</p>
        </div>
        <div class="summary-card" data-testid="attendance-report-summary-page">
          <h3>Trang hien tai</h3>
          <p class="summary-number">{{ page() }} / {{ totalPages() }}</p>
        </div>
      </div>

      <p *ngIf="reportRows().length > 0" class="report-note">
        <strong>Nguon du lieu cot Tong buoi:</strong>
        lay realtime tu hoa don hoc phi chua huy/tu choi, gom buoi chinh, buoi tang va buoi thu.
      </p>

      <div *ngIf="reportRows().length > 0" class="report-table-container" data-testid="attendance-report-table-container">
        <table class="report-table">
          <thead>
            <tr>
              <th>Ngay</th>
              <th>Thoi gian diem danh</th>
              <th>Lop</th>
              <th>Hoc sinh</th>
              <th>Level</th>
              <th title="Tong so buoi duoc cong realtime tu cac hoa don hoc phi chua huy hoac tu choi">
                Tong buoi (Da mua)
              </th>
              <th>Anh hoc sinh</th>
              <th>Giao vien</th>
              <th>Hinh anh diem danh</th>
              <th>Ghi chu</th>
            </tr>
          </thead>
          <tbody>
            <tr
              *ngFor="let row of reportRows(); trackBy: trackReportRow"
              [attr.data-testid]="'attendance-report-row-' + row.key">
              <td>{{ row.dateDisplay }}</td>
              <td>{{ row.attendanceTimeDisplay }}</td>
              <td>
                <div class="class-info">
                  <strong>{{ row.item.classId.code }}</strong><br />
                  <small>{{ row.item.classId.name }}</small>
                </div>
              </td>
              <td>
                <div class="student-info">
                  <strong>{{ row.item.studentId.fullName }}</strong><br />
                  <small>Ma: {{ row.item.studentId.studentCode }} | Tuoi: {{ row.item.studentId.age }}</small>
                </div>
              </td>
              <td>{{ row.item.studentId.level || '-' }}</td>
              <td [attr.data-testid]="'attendance-report-total-purchased-' + row.key">
                <strong>{{ row.totalPurchasedSessions }}</strong>
              </td>
              <td class="image-cell">
                <img
                  *ngIf="row.studentFaceImageUrl"
                  [src]="row.studentFaceImageUrl"
                  alt="Anh hoc sinh"
                  (click)="showImageModal(row.studentFaceImageUrl)"
                  class="thumbnail" />
                <span *ngIf="!row.studentFaceImageUrl" class="no-image">Khong co anh</span>
              </td>
              <td>
                <div class="teacher-info">
                  <strong>{{ row.item.teacherId.fullName }}</strong><br />
                  <small>{{ row.item.teacherId.email }}</small>
                </div>
              </td>
              <td class="image-cell">
                <img
                  *ngIf="row.attendanceImageUrl"
                  [src]="row.attendanceImageUrl"
                  alt="Anh diem danh"
                  (click)="showImageModal(row.attendanceImageUrl)"
                  class="thumbnail" />
                <span *ngIf="!row.attendanceImageUrl" class="no-image">Khong co anh</span>
              </td>
              <td>{{ row.item.notes || '-' }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="pagination" *ngIf="totalPages() > 1">
        <button (click)="goToPage(page() - 1)" [disabled]="page() <= 1 || loading()">&laquo; Truoc</button>
        <span>Trang {{ page() }} / {{ totalPages() }} (Tong: {{ totalItems() }} ban ghi)</span>
        <button (click)="goToPage(page() + 1)" [disabled]="page() >= totalPages() || loading()">Sau &raquo;</button>
      </div>

      <div class="modal" *ngIf="modalImage()" (click)="closeImageModal()">
        <div class="modal-content">
          <span class="close">&times;</span>
          <img [src]="modalImage()" alt="Anh diem danh" />
        </div>
      </div>
    </div>
  `,
  styles: [`
    .report-container { padding:2rem; max-width:1400px; margin:0 auto; }
    h1 { color:#1f2937; margin-bottom:1.5rem; }

    .filters {
      display:flex;
      gap:16px;
      flex-wrap:wrap;
      background:white;
      padding:20px;
      border-radius:8px;
      box-shadow:0 1px 3px rgba(0,0,0,0.1);
      margin-bottom:24px;
    }

    .filter-group { display:flex; flex-direction:column; gap:8px; min-width:200px; }
    .filter-group.class-picker { min-width:260px; flex:1 1 260px; }
    .filter-group label { font-weight:600; color:#374151; font-size:14px; }
    .filter-group input,
    .filter-group select {
      padding:8px 12px;
      border:1px solid #d1d5db;
      border-radius:6px;
      font-size:14px;
    }
    .filter-hint { color:#64748b; font-size:12px; min-height:16px; }

    .btn-search {
      align-self:flex-end;
      background:#2563eb;
      color:white;
      border:none;
      padding:10px 24px;
      border-radius:6px;
      font-weight:600;
      cursor:pointer;
      transition: all 0.2s;
    }
    .btn-search:hover:not(:disabled) { background:#1d4ed8; }
    .btn-search:disabled { opacity:0.5; cursor:not-allowed; }

    .error-message {
      background:#fee2e2;
      color:#dc2626;
      padding:16px;
      border-radius:8px;
      margin-bottom:24px;
    }

    .no-data {
      text-align:center;
      color:#6b7280;
      padding:48px;
      background:white;
      border-radius:8px;
      font-style:italic;
    }

    .report-summary {
      display:flex;
      gap:16px;
      margin-bottom:24px;
    }

    .report-note {
      margin:0 0 12px;
      color:#475569;
      font-size:13px;
    }

    .summary-card {
      background:linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color:white;
      padding:24px;
      border-radius:8px;
      flex:1;
      box-shadow:0 4px 6px rgba(0,0,0,0.1);
    }

    .summary-card h3 { margin:0 0 8px; font-size:14px; opacity:0.9; }
    .summary-number { margin:0; font-size:32px; font-weight:700; }

    .report-table-container {
      background:white;
      border-radius:8px;
      box-shadow:0 1px 3px rgba(0,0,0,0.1);
      overflow-x:auto;
    }

    .report-table {
      width:100%;
      border-collapse:collapse;
    }

    .report-table thead {
      background:#f9fafb;
      border-bottom:2px solid #e5e7eb;
    }

    .report-table th {
      padding:12px 16px;
      text-align:left;
      font-weight:600;
      color:#374151;
      font-size:14px;
      white-space:nowrap;
    }

    .report-table td {
      padding:12px 16px;
      border-bottom:1px solid #f3f4f6;
      font-size:14px;
    }

    .report-table tbody tr:hover {
      background:#f9fafb;
    }

    .class-info strong,
    .student-info strong,
    .teacher-info strong { color:#1f2937; }

    .class-info small,
    .student-info small,
    .teacher-info small { color:#6b7280; }

    .image-cell { text-align:center; }

    .thumbnail {
      width:80px;
      height:80px;
      object-fit:cover;
      border-radius:8px;
      cursor:pointer;
      border:2px solid #e5e7eb;
      transition: all 0.2s;
    }

    .thumbnail:hover {
      transform:scale(1.05);
      border-color:#2563eb;
    }

    .no-image {
      color:#9ca3af;
      font-style:italic;
      font-size:12px;
    }

    .modal {
      display:flex;
      position:fixed;
      z-index:1000;
      left:0;
      top:0;
      width:100%;
      height:100%;
      background:rgba(0,0,0,0.9);
      align-items:center;
      justify-content:center;
    }

    .modal-content {
      position:relative;
      max-width:90%;
      max-height:90%;
    }

    .modal-content img {
      width:100%;
      height:auto;
      border-radius:8px;
    }

    .close {
      position:absolute;
      top:-40px;
      right:0;
      color:#fff;
      font-size:40px;
      font-weight:bold;
      cursor:pointer;
    }

    .close:hover { color:#ccc; }

    .pagination {
      display:flex;
      gap:16px;
      align-items:center;
      justify-content:center;
      padding:20px 0;
      background:white;
      border-top:1px solid #e5e7eb;
    }
    .pagination button {
      padding:8px 18px;
      border:1px solid #d1d5db;
      border-radius:6px;
      background:#fff;
      cursor:pointer;
      font-size:14px;
      font-weight:600;
      color:#374151;
      transition:all 0.2s;
    }
    .pagination button:hover:not(:disabled) { background:#f9fafb; border-color:#2563eb; color:#2563eb; }
    .pagination button:disabled { opacity:0.4; cursor:not-allowed; }
    .pagination span { font-size:14px; color:#6b7280; }

    @media (max-width: 900px) {
      .report-container { padding:1rem; }
      .filters { padding:16px; }
      .filter-group,
      .filter-group.class-picker { min-width:100%; }
      .btn-search { width:100%; }
      .report-summary { flex-direction:column; }
    }
  `],
})
export class AttendanceReportComponent implements OnInit, OnDestroy {
  private readonly attendanceService = inject(AttendanceService);
  private readonly dateFormatter = new Intl.DateTimeFormat('vi-VN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  private readonly dateTimeFormatter = new Intl.DateTimeFormat('vi-VN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  reportData = signal<AttendanceReportItem[]>([]);
  classOptions = signal<AttendanceReportClassOption[]>([]);
  selectedClassOption = signal<AttendanceReportClassOption | null>(null);
  loading = signal(false);
  classesLoading = signal(false);
  error = signal('');
  modalImage = signal('');

  page = signal(1);
  limit = signal(20);
  totalItems = signal(0);
  totalPages = signal(1);

  startDate = '';
  endDate = '';
  selectedClassId = '';
  classSearchKeyword = '';

  private classSearchTimer: ReturnType<typeof setTimeout> | null = null;
  private latestClassRequestId = 0;

  readonly classOptionsForSelect = computed<AttendanceReportClassOption[]>(() => {
    const options = [...this.classOptions()];
    const selected = this.selectedClassOption();
    if (selected && !options.some((item) => item._id === selected._id)) {
      options.unshift(selected);
    }
    return options;
  });

  readonly reportRows = computed<AttendanceReportRowView[]>(() =>
    this.reportData().map((item) => ({
      key: item._id,
      item,
      dateDisplay: this.formatDate(item.date),
      attendanceTimeDisplay: this.formatDateTime(item.attendedAt || item.updatedAt || item.date),
      studentFaceImageUrl: this.resolveImageUrl(item.studentId.faceImage),
      attendanceImageUrl: this.resolveImageUrl(item.imageUrl),
      totalPurchasedSessions: Number(item.studentId.totalPurchasedSessions || 0),
    })),
  );

  ngOnInit() {
    const today = new Date();
    const lastWeek = new Date();
    lastWeek.setDate(today.getDate() - 7);

    this.endDate = this.formatLocalDateInput(today);
    this.startDate = this.formatLocalDateInput(lastWeek);
    void this.loadClassOptions();
  }

  ngOnDestroy() {
    if (this.classSearchTimer) {
      clearTimeout(this.classSearchTimer);
      this.classSearchTimer = null;
    }
  }

  async loadClassOptions(search: string = this.classSearchKeyword): Promise<void> {
    const requestId = ++this.latestClassRequestId;
    this.classesLoading.set(true);

    try {
      const classes = await this.attendanceService.getAttendanceReportClasses(search.trim() || undefined, 50);
      if (requestId !== this.latestClassRequestId) {
        return;
      }

      this.classOptions.set(
        [...classes].sort((left, right) =>
          `${left.code} ${left.name}`.localeCompare(`${right.code} ${right.name}`, 'vi', { sensitivity: 'base' }),
        ),
      );

      if (this.selectedClassId) {
        const selected = classes.find((item) => item._id === this.selectedClassId);
        if (selected) {
          this.selectedClassOption.set(selected);
        }
      }
    } finally {
      if (requestId === this.latestClassRequestId) {
        this.classesLoading.set(false);
      }
    }
  }

  onClassSearchChange(value: string) {
    this.classSearchKeyword = String(value || '');
    if (this.classSearchTimer) {
      clearTimeout(this.classSearchTimer);
    }
    this.classSearchTimer = setTimeout(() => {
      this.classSearchTimer = null;
      void this.loadClassOptions(this.classSearchKeyword);
    }, 250);
  }

  onClassSelectionChange(classId: string) {
    this.selectedClassId = String(classId || '');
    if (!this.selectedClassId) {
      this.selectedClassOption.set(null);
      return;
    }
    this.selectedClassOption.set(
      this.classOptionsForSelect().find((item) => item._id === this.selectedClassId) || null,
    );
  }

  async loadReport() {
    if (!this.startDate || !this.endDate) {
      this.error.set('Vui long chon khoang thoi gian');
      return;
    }

    this.loading.set(true);
    this.error.set('');

    try {
      const res = await this.attendanceService.getAttendanceReport(
        this.startDate,
        this.endDate,
        this.selectedClassId || undefined,
        this.page(),
        this.limit(),
      );

      this.reportData.set(res.data);
      this.totalItems.set(res.meta.total);
      this.totalPages.set(res.meta.totalPages);
    } catch (error: any) {
      this.error.set(error.message || 'Khong the tai bao cao');
    } finally {
      this.loading.set(false);
    }
  }

  goToPage(nextPage: number) {
    if (nextPage < 1 || nextPage > this.totalPages() || nextPage === this.page()) {
      return;
    }
    this.page.set(nextPage);
    void this.loadReport();
  }

  onApplyFilter() {
    this.page.set(1);
    void this.loadReport();
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

  trackClassOption(_index: number, item: AttendanceReportClassOption): string {
    return item._id;
  }

  trackReportRow(_index: number, row: AttendanceReportRowView): string {
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

  private formatDate(dateStr?: string | null): string {
    if (!dateStr) {
      return '-';
    }
    return this.dateFormatter.format(new Date(dateStr));
  }

  private formatDateTime(dateStr?: string | null): string {
    if (!dateStr) {
      return '-';
    }
    return this.dateTimeFormatter.format(new Date(dateStr));
  }

  private formatLocalDateInput(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
