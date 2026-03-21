import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StudentService, StudentReportEntry } from '../services/student.service';
import { ClassService, ClassItem } from '../services/class.service';
import { environment } from '../../environments/environment';

import { FlowGuideComponent } from './shared/flow-guide.component';

@Component({
  selector: 'app-student-report',
  standalone: true,
  imports: [CommonModule, FormsModule, FlowGuideComponent],
  template: `
  <app-flow-guide featureKey="student-report"></app-flow-guide>
    <div class="report-container">
      <h1>Báo cáo học sinh</h1>

      <!-- Filters -->
      <div class="filters">
        <div class="filter-group">
          <label>Lọc theo lớp:</label>
          <select [(ngModel)]="selectedClassId" (change)="loadReport()">
            <option value="">Tất cả lớp</option>
            <option *ngFor="let cls of classes()" [value]="cls._id">
              {{ cls.code }} - {{ cls.name }}
            </option>
          </select>
        </div>

        <div class="filter-group">
          <label>Tìm kiếm:</label>
          <input
            type="text"
            [(ngModel)]="searchTerm"
            (input)="loadReport()"
            placeholder="Tên học sinh, phụ huynh, SĐT..."
          />
        </div>

        <button class="btn btn-primary" (click)="loadReport()">
          🔍 Tìm kiếm
        </button>
      </div>

      <!-- Loading & Error -->
      <div *ngIf="loading()" class="loading">Đang tải dữ liệu...</div>
      <div *ngIf="error()" class="error">{{ error() }}</div>

      <!-- Summary -->
      <div *ngIf="!loading() && reportData().length > 0" class="report-summary">
        <div class="summary-card">
          <h3>Tổng số học sinh</h3>
          <p class="summary-number">{{ reportData().length }}</p>
        </div>
        <div class="summary-card">
          <h3>Tổng lượt điểm danh</h3>
          <p class="summary-number">{{ getTotalAttendance() }}</p>
        </div>
      </div>

      <!-- Report Table -->
      <div *ngIf="reportData().length > 0" class="report-table-container">
        <table class="report-table">
          <thead>
            <tr>
              <th>STT</th>
              <th>Ảnh</th>
              <th>Mã học sinh</th>
              <th>Tên học sinh</th>
              <th>Tuổi</th>
              <th>Phụ huynh</th>
              <th>Số điện thoại</th>
              <th>Gói sản phẩm</th>
              <th>Số buổi điểm danh</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let item of reportData(); let i = index">
              <td>{{ i + 1 }}</td>
              <td class="image-cell">
                <img
                  *ngIf="item.faceImage"
                  [src]="getImageUrl(item.faceImage)"
                  alt="Ảnh học sinh"
                  (click)="showImageModal(getImageUrl(item.faceImage))"
                  class="student-avatar"
                />
                <span *ngIf="!item.faceImage" class="no-image">Không có ảnh</span>
              </td>
              <td>{{ item.studentCode }}</td>
              <td>
                <strong>{{ item.fullName }}</strong>
              </td>
              <td>{{ item.age }}</td>
              <td>{{ item.parentName }}</td>
              <td>{{ item.parentPhone }}</td>
              <td>{{ item.productPackage?.name || '-' }}</td>
              <td class="attendance-count">
                <span class="badge badge-success">{{ item.totalAttendance }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div *ngIf="!loading() && reportData().length === 0 && !error()" class="no-data">
        Không tìm thấy học sinh phù hợp.
      </div>

      <!-- Image Modal -->
      <div class="modal" *ngIf="modalImage()" (click)="closeImageModal()">
        <div class="modal-content">
          <span class="close">&times;</span>
          <img [src]="modalImage()" alt="Ảnh học sinh" />
        </div>
      </div>
    </div>
  `,
  styles: [`
    .report-container { padding:2rem; max-width:1600px; margin:0 auto; }
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

    .filter-group {
      display:flex;
      flex-direction:column;
      gap:8px;
      flex:1;
      min-width:200px;
    }

    .filter-group label {
      font-weight:600;
      color:#374151;
      font-size:14px;
    }

    .filter-group select,
    .filter-group input {
      padding:10px 12px;
      border:1px solid #d1d5db;
      border-radius:6px;
      font-size:14px;
    }

    .btn {
      padding:10px 20px;
      border:none;
      border-radius:6px;
      cursor:pointer;
      font-weight:600;
      align-self:flex-end;
    }

    .btn-primary { background:#3b82f6; color:white; }
    .btn-primary:hover { background:#2563eb; }

    .loading, .error, .no-data {
      text-align:center;
      padding:40px;
      background:white;
      border-radius:8px;
      margin:20px 0;
    }

    .error { color:#dc2626; }

    .report-summary {
      display:grid;
      grid-template-columns:repeat(auto-fit, minmax(250px, 1fr));
      gap:20px;
      margin-bottom:24px;
    }

    .summary-card {
      background:white;
      padding:24px;
      border-radius:8px;
      box-shadow:0 1px 3px rgba(0,0,0,0.1);
      text-align:center;
    }

    .summary-card h3 {
      font-size:14px;
      color:#6b7280;
      margin-bottom:12px;
      font-weight:600;
      text-transform:uppercase;
    }

    .summary-number {
      font-size:36px;
      font-weight:700;
      color:#1f2937;
      margin:0;
    }

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
      padding:16px;
      text-align:left;
      font-weight:600;
      color:#374151;
      font-size:13px;
      text-transform:uppercase;
      letter-spacing:0.5px;
    }

    .report-table td {
      padding:16px;
      border-bottom:1px solid #e5e7eb;
      color:#1f2937;
    }

    .report-table tbody tr:hover {
      background:#f9fafb;
    }

    .image-cell {
      text-align:center;
    }

    .student-avatar {
      width:50px;
      height:50px;
      object-fit:cover;
      border-radius:50%;
      cursor:pointer;
      transition:transform 0.2s;
      border:2px solid #e5e7eb;
    }

    .student-avatar:hover {
      transform:scale(1.1);
    }

    .no-image {
      color:#9ca3af;
      font-size:12px;
      font-style:italic;
    }

    .attendance-count {
      text-align:center;
    }

    .badge {
      padding:6px 12px;
      border-radius:12px;
      font-weight:600;
      font-size:13px;
    }

    .badge-success {
      background:#d1fae5;
      color:#065f46;
    }

    .modal {
      display:flex;
      align-items:center;
      justify-content:center;
      position:fixed;
      top:0;
      left:0;
      width:100%;
      height:100%;
      background:rgba(0,0,0,0.8);
      z-index:1000;
      cursor:pointer;
    }

    .modal-content {
      position:relative;
      max-width:90%;
      max-height:90%;
    }

    .modal-content img {
      max-width:100%;
      max-height:90vh;
      border-radius:8px;
    }

    .close {
      position:absolute;
      top:-40px;
      right:0;
      color:white;
      font-size:40px;
      font-weight:bold;
      cursor:pointer;
    }
  `]
})
export class StudentReportComponent implements OnInit {
  private studentService = inject(StudentService);
  private classService = inject(ClassService);

  reportData = signal<StudentReportEntry[]>([]);
  classes = signal<ClassItem[]>([]);
  loading = signal(false);
  error = signal('');
  modalImage = signal('');

  selectedClassId = '';
  searchTerm = '';

  async ngOnInit() {
    this.loadClasses();
    this.loadReport();
  }

  async loadClasses(): Promise<void> {
    try {
      const classes: ClassItem[] = await this.classService.list();
      this.classes.set(classes);
    } catch (error) {
      console.error('Error loading classes:', error);
    }
  }

  async loadReport() {
    this.loading.set(true);
    this.error.set('');

    try {
      const data = (await this.studentService.getStudentReport(
        this.selectedClassId || undefined,
        this.searchTerm || undefined
      )) as StudentReportEntry[];

      this.reportData.set(data);
    } catch (error: any) {
      this.error.set(error.message || 'Không thể tải báo cáo');
    } finally {
      this.loading.set(false);
    }
  }

  getTotalAttendance(): number {
    return this.reportData().reduce((sum, item) => sum + item.totalAttendance, 0);
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
}
