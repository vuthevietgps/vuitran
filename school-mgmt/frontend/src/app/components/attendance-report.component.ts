import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AttendanceService } from '../services/attendance.service';
import { ClassItem } from '../services/class.service';
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

@Component({
  selector: 'app-attendance-report',
  standalone: true,
  imports: [CommonModule, FormsModule, FlowGuideComponent],
  template: `
  <app-flow-guide featureKey="attendance-report"></app-flow-guide>
    <div class="report-container">
      <h1>📊 Báo cáo điểm danh tổng hợp</h1>

      <div class="filters">
        <div class="filter-group">
          <label>Từ ngày:</label>
          <input type="date" [(ngModel)]="startDate" />
        </div>

        <div class="filter-group">
          <label>Đến ngày:</label>
          <input type="date" [(ngModel)]="endDate" />
        </div>

        <div class="filter-group">
          <label>Lớp học (tùy chọn):</label>
          <select [(ngModel)]="selectedClassId">
            <option value="">-- Tất cả các lớp --</option>
            <option *ngFor="let cls of classes()" [value]="cls._id">
              {{cls.code}} - {{cls.name}} ({{cls.studentCount || cls.students?.length || 0}} HS)
            </option>
          </select>
        </div>

        <button class="btn-search" (click)="onApplyFilter()" [disabled]="loading()">
          {{ loading() ? '⏳ Đang tải...' : '🔍 Xem báo cáo' }}
        </button>
      </div>

      <div *ngIf="error()" class="error-message">
        ❌ {{ error() }}
      </div>

      <div *ngIf="!loading() && reportData().length === 0 && !error()" class="no-data">
        Không có dữ liệu điểm danh trong khoảng thời gian này.
      </div>

      <div *ngIf="reportData().length > 0" class="report-summary">
        <div class="summary-card">
          <h3>Tổng số lượt điểm danh</h3>
          <p class="summary-number">{{ totalItems() }}</p>
        </div>
        <div class="summary-card">
          <h3>Trang hiện tại</h3>
          <p class="summary-number">{{ page() }} / {{ totalPages() }}</p>
        </div>
      </div>

      <div *ngIf="reportData().length > 0" class="report-table-container">
        <table class="report-table">
          <thead>
            <tr>
              <th>Ngày</th>
              <th>Thời gian điểm danh</th>
              <th>Lớp</th>
              <th>Học sinh</th>
              <th title="Tổng số buổi lấy từ các hóa đơn đã thanh toán/đã duyệt">Tổng buổi (Đã mua)</th>
              <th>Ảnh học sinh</th>
              <th>Giáo viên</th>
              <th>Hình ảnh điểm danh</th>
              <th>Ghi chú</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let item of reportData()">
              <td>{{ formatDate(item.date) }}</td>
              <td>{{ formatDateTime(item.attendedAt || item.updatedAt || item.date) }}</td>
              <td>
                <div class="class-info">
                  <strong>{{ item.classId.code }}</strong><br />
                  <small>{{ item.classId.name }}</small>
                </div>
              </td>
              <td>
                <div class="student-info">
                  <strong>{{ item.studentId.fullName }}</strong><br />
                  <small>Mã: {{ item.studentId.studentCode }} | Tuổi: {{ item.studentId.age }}</small>
                </div>
              </td>
              <td>
                <strong>{{ item.studentId.totalPurchasedSessions || 0 }}</strong>
              </td>
              <td class="image-cell">
                <img 
                  *ngIf="item.studentId.faceImage" 
                  [src]="getImageUrl(item.studentId.faceImage)" 
                  alt="Ảnh học sinh"
                  (click)="showImageModal(getImageUrl(item.studentId.faceImage))"
                  class="thumbnail"
                />
                <span *ngIf="!item.studentId.faceImage" class="no-image">Không có ảnh</span>
              </td>
              <td>
                <div class="teacher-info">
                  <strong>{{ item.teacherId.fullName }}</strong><br />
                  <small>{{ item.teacherId.email }}</small>
                </div>
              </td>
              <td class="image-cell">
                <img 
                  *ngIf="item.imageUrl" 
                  [src]="getImageUrl(item.imageUrl)" 
                  alt="Ảnh điểm danh"
                  (click)="showImageModal(getImageUrl(item.imageUrl))"
                  class="thumbnail"
                />
                <span *ngIf="!item.imageUrl" class="no-image">Không có ảnh</span>
              </td>
              <td>{{ item.notes || '-' }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Khối Phân trang -->
      <div class="pagination" *ngIf="totalPages() > 1">
        <button (click)="goToPage(page() - 1)" [disabled]="page() <= 1 || loading()">&laquo; Trước</button>
        <span>Trang {{ page() }} / {{ totalPages() }} (Tổng: {{ totalItems() }} bản ghi)</span>
        <button (click)="goToPage(page() + 1)" [disabled]="page() >= totalPages() || loading()">Sau &raquo;</button>
      </div>

      <!-- Image Modal -->
      <div class="modal" *ngIf="modalImage()" (click)="closeImageModal()">
        <div class="modal-content">
          <span class="close">&times;</span>
          <img [src]="modalImage()" alt="Ảnh điểm danh" />
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
    .filter-group label { font-weight:600; color:#374151; font-size:14px; }
    .filter-group input,
    .filter-group select { 
      padding:8px 12px; 
      border:1px solid #d1d5db; 
      border-radius:6px; 
      font-size:14px;
    }

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

    .class-info strong { color:#1f2937; }
    .class-info small { color:#6b7280; }

    .student-info strong { color:#1f2937; }
    .student-info small { color:#6b7280; }

    .teacher-info strong { color:#1f2937; }
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
      transform:scale(1.1); 
      border-color:#2563eb;
    }

    .no-image { 
      color:#9ca3af; 
      font-style:italic; 
      font-size:12px;
    }

    /* Modal */
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
  `]
})
export class AttendanceReportComponent implements OnInit {
  private attendanceService = inject(AttendanceService);

  classes = signal<ClassItem[]>([]);
  reportData = signal<AttendanceReportItem[]>([]);
  loading = signal(false);
  error = signal('');
  modalImage = signal('');

  // ── Pagination state ──────────────────────────────────────────────
  page = signal(1);
  limit = signal(20);
  totalItems = signal(0);
  totalPages = signal(1);

  startDate = '';
  endDate = '';
  selectedClassId = '';

  ngOnInit() {
    // Set default date range to last 7 days
    const today = new Date();
    const lastWeek = new Date();
    lastWeek.setDate(today.getDate() - 7);

    this.endDate = this.formatLocalDateInput(today);
    this.startDate = this.formatLocalDateInput(lastWeek);

    this.loadClasses();
  }

  async loadClasses(): Promise<void> {
    try {
      const classes = await this.attendanceService.getClassesWithStudents();
      const mapped: ClassItem[] = classes.map<ClassItem>((cls) => ({
        _id: cls.classId,
        name: cls.className || cls.classCode,
        code: cls.classCode,
        students: cls.students.map(student => ({
          _id: student.studentId,
          fullName: student.fullName,
        })),
        studentCount: cls.studentCount,
      })).sort((a, b) => (a.code || '').localeCompare(b.code || '', 'vi', { sensitivity: 'base' }));

      this.classes.set(mapped);
    } catch (error) {
      console.error('Error loading classes:', error);
    }
  }

  async loadReport() {
    if (!this.startDate || !this.endDate) {
      this.error.set('Vui lòng chọn khoảng thời gian');
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
      this.error.set(error.message || 'Không thể tải báo cáo');
    } finally {
      this.loading.set(false);
    }
  }

  goToPage(p: number) {
    if (p >= 1 && p <= this.totalPages()) {
      this.page.set(p);
      this.loadReport();
    }
  }

  onApplyFilter() {
    this.page.set(1);
    this.loadReport();
  }

  getImageUrl(imageUrl: string): string {
    if (imageUrl.startsWith('http')) {
      return imageUrl;
    }
    return `${environment.apiBase}${imageUrl}`;
  }

  showImageModal(imageUrl: string) {
    this.modalImage.set(imageUrl);
  }

  closeImageModal() {
    this.modalImage.set('');
  }

  formatDate(dateStr?: string | null): string {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  }

  formatDateTime(dateStr?: string | null): string {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }

  private formatLocalDateInput(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
