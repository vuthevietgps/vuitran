import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

import { FlowGuideComponent } from './shared/flow-guide.component';

type EmployeeTab = 'teachers' | 'sales' | 'ops';

interface EmployeeBase {
  _id?: string;
  name: string;
  email?: string | null;
}

interface TeacherPerf extends EmployeeBase {
  totalSessions: number;
  reportRate: number;
  avgRating: number | null;
}

interface SalesPerf extends EmployeeBase {
  totalLeads: number;
  convertedLeads: number;
  conversionRate: number;
  revenue: number;
  commission: number;
}

interface OpsPerf extends EmployeeBase {
  totalTickets: number;
  resolvedTickets: number;
  resolutionRate: number;
}

interface EmployeePerformanceData {
  teachers: TeacherPerf[];
  sales: SalesPerf[];
  ops: OpsPerf[];
}

@Component({
  selector: 'app-employee-performance',
  standalone: true,
  imports: [CommonModule, FormsModule, FlowGuideComponent],
  template: `
  <div class="employee-performance-page" data-testid="employee-performance-page">
    <header class="page-header">
      <div>
        <h2 data-testid="employee-performance-heading">Hieu suat nhan vien</h2>
        <p>Tong quan hieu suat theo bo phan: giao vien, kinh doanh, van hanh.</p>
      </div>
      <div class="controls">
        <input
          data-testid="employee-performance-filter-input"
          type="text"
          [(ngModel)]="searchTerm"
          placeholder="Tim theo ten hoac email"
        />
        <button
          type="button"
          class="ghost"
          data-testid="employee-performance-filter-clear"
          (click)="clearFilter()"
          [disabled]="!searchTerm.trim()"
        >
          Xoa loc
        </button>
      </div>
    </header>

    <app-flow-guide featureKey="employee-performance"></app-flow-guide>

    <div class="tab-bar">
      <button
        *ngFor="let t of tabs"
        [class.active]="activeTab() === t.key"
        (click)="activeTab.set(t.key)"
        [attr.data-testid]="'employee-performance-tab-' + t.key"
      >
        {{ t.label }}
      </button>
      <span class="result-count" data-testid="employee-performance-result-count">
        {{ currentRows().length }} ket qua
      </span>
    </div>

    <div class="loading" *ngIf="loading()" data-testid="employee-performance-loading">Dang tai du lieu...</div>
    <div class="error" *ngIf="error()" data-testid="employee-performance-error">{{ error() }}</div>

    <ng-container *ngIf="activeTab() === 'teachers' && !loading() && !error()">
      <table class="data" *ngIf="filteredTeachers().length; else emptyState" data-testid="employee-performance-table-teachers">
        <thead>
          <tr>
            <th>#</th>
            <th>Giao vien</th>
            <th class="right">Tong buoi day</th>
            <th class="right">Ty le bao cao (%)</th>
            <th class="right">Danh gia TB</th>
            <th class="right">Chi tiet</th>
          </tr>
        </thead>
        <tbody>
          <tr
            *ngFor="let t of filteredTeachers(); let i = index"
            [attr.data-testid]="'employee-performance-row-teachers-' + i"
          >
            <td>{{ i + 1 }}</td>
            <td>
              <div class="name-cell">
                <strong>{{ t.name }}</strong>
                <small *ngIf="t.email">{{ t.email }}</small>
              </div>
            </td>
            <td class="right">{{ t.totalSessions | number:'1.0-0' }}</td>
            <td class="right">{{ t.reportRate | number:'1.1-1' }}%</td>
            <td class="right">{{ displayRating(t.avgRating) }}</td>
            <td class="right">
              <button
                type="button"
                class="detail-button"
                [attr.data-testid]="'employee-performance-detail-button-teachers-' + i"
                (click)="openTeacherDetail(t)"
              >
                Xem
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </ng-container>

    <ng-container *ngIf="activeTab() === 'sales' && !loading() && !error()">
      <table class="data" *ngIf="filteredSales().length; else emptyState" data-testid="employee-performance-table-sales">
        <thead>
          <tr>
            <th>#</th>
            <th>Kinh doanh</th>
            <th class="right">Tong leads</th>
            <th class="right">Da chuyen doi</th>
            <th class="right">Ty le (%)</th>
            <th class="right">Doanh thu</th>
            <th class="right">Hoa hong</th>
            <th class="right">Chi tiet</th>
          </tr>
        </thead>
        <tbody>
          <tr
            *ngFor="let s of filteredSales(); let i = index"
            [attr.data-testid]="'employee-performance-row-sales-' + i"
          >
            <td>{{ i + 1 }}</td>
            <td>
              <div class="name-cell">
                <strong>{{ s.name }}</strong>
                <small *ngIf="s.email">{{ s.email }}</small>
              </div>
            </td>
            <td class="right">{{ s.totalLeads | number:'1.0-0' }}</td>
            <td class="right">{{ s.convertedLeads | number:'1.0-0' }}</td>
            <td class="right">{{ s.conversionRate | number:'1.1-1' }}%</td>
            <td class="right">{{ s.revenue | number:'1.0-0' }}</td>
            <td class="right">{{ s.commission | number:'1.0-0' }}</td>
            <td class="right">
              <button
                type="button"
                class="detail-button"
                [attr.data-testid]="'employee-performance-detail-button-sales-' + i"
                (click)="openSalesDetail(s)"
              >
                Xem
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </ng-container>

    <ng-container *ngIf="activeTab() === 'ops' && !loading() && !error()">
      <table class="data" *ngIf="filteredOps().length; else emptyState" data-testid="employee-performance-table-ops">
        <thead>
          <tr>
            <th>#</th>
            <th>Van hanh</th>
            <th class="right">Tong ticket</th>
            <th class="right">Da xu ly</th>
            <th class="right">Ty le xu ly (%)</th>
            <th class="right">Chi tiet</th>
          </tr>
        </thead>
        <tbody>
          <tr
            *ngFor="let o of filteredOps(); let i = index"
            [attr.data-testid]="'employee-performance-row-ops-' + i"
          >
            <td>{{ i + 1 }}</td>
            <td>
              <div class="name-cell">
                <strong>{{ o.name }}</strong>
                <small *ngIf="o.email">{{ o.email }}</small>
              </div>
            </td>
            <td class="right">{{ o.totalTickets | number:'1.0-0' }}</td>
            <td class="right">{{ o.resolvedTickets | number:'1.0-0' }}</td>
            <td class="right">{{ o.resolutionRate | number:'1.1-1' }}%</td>
            <td class="right">
              <button
                type="button"
                class="detail-button"
                [attr.data-testid]="'employee-performance-detail-button-ops-' + i"
                (click)="openOpsDetail(o)"
              >
                Xem
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </ng-container>

    <ng-template #emptyState>
      <div class="empty" data-testid="employee-performance-empty">{{ emptyMessage() }}</div>
    </ng-template>

    <div
      class="modal-overlay"
      *ngIf="detailTab()"
      (click)="closeDetail()"
      data-testid="employee-performance-detail-overlay"
    >
      <div
        class="modal-content"
        *ngIf="detailTab()"
        (click)="$event.stopPropagation()"
        data-testid="employee-performance-detail-modal"
      >
        <button
          type="button"
          class="modal-close"
          data-testid="employee-performance-detail-close"
          (click)="closeDetail()"
        >
          x
        </button>

        <h3 data-testid="employee-performance-detail-title">{{ detailTitle() }}</h3>

        <div class="detail-grid" *ngIf="teacherDetail() as teacher">
          <div class="detail-row" data-testid="employee-performance-detail-email">
            <span>Email</span>
            <strong>{{ teacher.email || 'N/A' }}</strong>
          </div>
          <div class="detail-row" data-testid="employee-performance-detail-total-sessions">
            <span>Tong buoi day</span>
            <strong>{{ teacher.totalSessions | number:'1.0-0' }}</strong>
          </div>
          <div class="detail-row" data-testid="employee-performance-detail-report-rate">
            <span>Ty le bao cao</span>
            <strong>{{ teacher.reportRate | number:'1.1-1' }}%</strong>
          </div>
          <div class="detail-row" data-testid="employee-performance-detail-avg-rating">
            <span>Danh gia trung binh</span>
            <strong>{{ displayRating(teacher.avgRating) }}</strong>
          </div>
        </div>

        <div class="detail-grid" *ngIf="salesDetail() as sales">
          <div class="detail-row" data-testid="employee-performance-detail-email">
            <span>Email</span>
            <strong>{{ sales.email || 'N/A' }}</strong>
          </div>
          <div class="detail-row" data-testid="employee-performance-detail-total-leads">
            <span>Tong leads</span>
            <strong>{{ sales.totalLeads | number:'1.0-0' }}</strong>
          </div>
          <div class="detail-row" data-testid="employee-performance-detail-converted-leads">
            <span>Da chuyen doi</span>
            <strong>{{ sales.convertedLeads | number:'1.0-0' }}</strong>
          </div>
          <div class="detail-row" data-testid="employee-performance-detail-conversion-rate">
            <span>Ty le chuyen doi</span>
            <strong>{{ sales.conversionRate | number:'1.1-1' }}%</strong>
          </div>
          <div class="detail-row" data-testid="employee-performance-detail-revenue">
            <span>Doanh thu</span>
            <strong>{{ sales.revenue | number:'1.0-0' }}</strong>
          </div>
          <div class="detail-row" data-testid="employee-performance-detail-commission">
            <span>Hoa hong</span>
            <strong>{{ sales.commission | number:'1.0-0' }}</strong>
          </div>
        </div>

        <div class="detail-grid" *ngIf="opsDetail() as ops">
          <div class="detail-row" data-testid="employee-performance-detail-email">
            <span>Email</span>
            <strong>{{ ops.email || 'N/A' }}</strong>
          </div>
          <div class="detail-row" data-testid="employee-performance-detail-total-tickets">
            <span>Tong ticket</span>
            <strong>{{ ops.totalTickets | number:'1.0-0' }}</strong>
          </div>
          <div class="detail-row" data-testid="employee-performance-detail-resolved-tickets">
            <span>Da xu ly</span>
            <strong>{{ ops.resolvedTickets | number:'1.0-0' }}</strong>
          </div>
          <div class="detail-row" data-testid="employee-performance-detail-resolution-rate">
            <span>Ty le xu ly</span>
            <strong>{{ ops.resolutionRate | number:'1.1-1' }}%</strong>
          </div>
        </div>
      </div>
    </div>
  </div>
  `,
  styles: [`
    :host {
      display: block;
      padding: 24px;
    }

    .employee-performance-page {
      max-width: 1200px;
      margin: 0 auto;
    }

    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 16px;
      margin-bottom: 20px;
      flex-wrap: wrap;
    }

    .page-header h2 {
      margin: 0 0 4px;
      font-size: 1.4rem;
    }

    .page-header p {
      margin: 0;
      color: #6b7280;
      font-size: 0.9rem;
    }

    .controls {
      display: flex;
      gap: 8px;
      align-items: center;
      flex-wrap: wrap;
    }

    .controls input {
      min-width: 240px;
      padding: 10px 12px;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      font-size: 0.9rem;
    }

    .ghost {
      padding: 10px 14px;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      background: #fff;
      color: #334155;
      cursor: pointer;
    }

    .ghost:disabled {
      opacity: 0.5;
      cursor: default;
    }

    .tab-bar {
      display: flex;
      gap: 8px;
      align-items: center;
      margin-bottom: 20px;
      border-bottom: 2px solid #e5e7eb;
      padding-bottom: 0;
      flex-wrap: wrap;
    }

    .tab-bar button {
      padding: 10px 20px;
      border: none;
      background: none;
      font-size: 0.95rem;
      cursor: pointer;
      color: #6b7280;
      border-bottom: 3px solid transparent;
      margin-bottom: -2px;
      transition: all 0.2s;
    }

    .tab-bar button:hover {
      color: #111827;
    }

    .tab-bar button.active {
      color: #2563eb;
      border-bottom-color: #2563eb;
      font-weight: 600;
    }

    .result-count {
      margin-left: auto;
      color: #64748b;
      font-size: 0.85rem;
      font-weight: 600;
    }

    .loading,
    .empty {
      text-align: center;
      padding: 40px;
      color: #6b7280;
      font-size: 0.95rem;
    }

    .error {
      background: #fef2f2;
      color: #dc2626;
      padding: 12px 16px;
      border-radius: 8px;
      margin-bottom: 16px;
    }

    table.data {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.9rem;
      background: #fff;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 1px 3px rgba(15, 23, 42, 0.08);
    }

    table.data th {
      text-align: left;
      padding: 10px 12px;
      font-weight: 600;
      border-bottom: 2px solid #e5e7eb;
      color: #374151;
      font-size: 0.85rem;
    }

    table.data td {
      padding: 10px 12px;
      border-bottom: 1px solid #f3f4f6;
    }

    table.data tbody tr:hover {
      background: #f8fafb;
    }

    .right {
      text-align: right;
    }

    .name-cell {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .name-cell small {
      color: #64748b;
      font-size: 0.78rem;
    }

    .detail-button {
      padding: 6px 12px;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      background: #fff;
      color: #1d4ed8;
      cursor: pointer;
      font-weight: 600;
    }

    .modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(15, 23, 42, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      z-index: 1000;
    }

    .modal-content {
      position: relative;
      width: min(560px, 100%);
      background: #fff;
      border-radius: 16px;
      padding: 24px;
      box-shadow: 0 20px 60px rgba(15, 23, 42, 0.2);
    }

    .modal-close {
      position: absolute;
      right: 12px;
      top: 12px;
      width: 32px;
      height: 32px;
      border: none;
      border-radius: 999px;
      background: #e2e8f0;
      color: #0f172a;
      cursor: pointer;
    }

    .modal-content h3 {
      margin: 0 0 16px;
      font-size: 1.1rem;
      color: #0f172a;
    }

    .detail-grid {
      display: grid;
      gap: 12px;
    }

    .detail-row {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      padding: 12px 14px;
      border-radius: 10px;
      background: #f8fafc;
      align-items: center;
    }

    .detail-row span {
      color: #475569;
      font-size: 0.9rem;
    }

    .detail-row strong {
      color: #0f172a;
      font-size: 0.95rem;
      text-align: right;
    }
  `],
})
export class EmployeePerformanceComponent implements OnInit {
  private readonly http = inject(HttpClient);

  tabs: Array<{ key: EmployeeTab; label: string }> = [
    { key: 'teachers', label: 'Giao vien' },
    { key: 'sales', label: 'Kinh doanh' },
    { key: 'ops', label: 'Van hanh' },
  ];

  activeTab = signal<EmployeeTab>('teachers');
  loading = signal(false);
  error = signal('');
  teachers = signal<TeacherPerf[]>([]);
  sales = signal<SalesPerf[]>([]);
  ops = signal<OpsPerf[]>([]);
  detailTab = signal<EmployeeTab | null>(null);
  searchTerm = '';

  private selectedTeacherDetail = signal<TeacherPerf | null>(null);
  private selectedSalesDetail = signal<SalesPerf | null>(null);
  private selectedOpsDetail = signal<OpsPerf | null>(null);

  ngOnInit(): void {
    this.loadData();
  }

  async loadData(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      const data = await firstValueFrom(
        this.http.get<EmployeePerformanceData>(
          `${environment.apiBase}/dashboard/director/employee-performance`,
          { withCredentials: true },
        ),
      );

      this.teachers.set(
        [...(data.teachers || [])].sort((a, b) => b.totalSessions - a.totalSessions),
      );
      this.sales.set(
        [...(data.sales || [])].sort((a, b) => b.revenue - a.revenue),
      );
      this.ops.set(
        [...(data.ops || [])].sort((a, b) => b.resolutionRate - a.resolutionRate),
      );
    } catch (err) {
      console.error('Failed to load employee performance', err);
      this.error.set('Khong the tai dashboard hieu suat nhan vien.');
    } finally {
      this.loading.set(false);
    }
  }

  clearFilter(): void {
    this.searchTerm = '';
  }

  currentRows(): Array<TeacherPerf | SalesPerf | OpsPerf> {
    switch (this.activeTab()) {
      case 'teachers':
        return this.filteredTeachers();
      case 'sales':
        return this.filteredSales();
      case 'ops':
        return this.filteredOps();
    }
  }

  filteredTeachers(): TeacherPerf[] {
    return this.filterRows(this.teachers());
  }

  filteredSales(): SalesPerf[] {
    return this.filterRows(this.sales());
  }

  filteredOps(): OpsPerf[] {
    return this.filterRows(this.ops());
  }

  emptyMessage(): string {
    return this.searchTerm.trim()
      ? 'Khong co du lieu phu hop bo loc.'
      : 'Khong co du lieu.';
  }

  displayRating(value: number | null | undefined): string {
    return value === null || value === undefined ? 'N/A' : `${value.toFixed(1)}/5`;
  }

  openTeacherDetail(row: TeacherPerf): void {
    this.selectedTeacherDetail.set(row);
    this.selectedSalesDetail.set(null);
    this.selectedOpsDetail.set(null);
    this.detailTab.set('teachers');
  }

  openSalesDetail(row: SalesPerf): void {
    this.selectedTeacherDetail.set(null);
    this.selectedSalesDetail.set(row);
    this.selectedOpsDetail.set(null);
    this.detailTab.set('sales');
  }

  openOpsDetail(row: OpsPerf): void {
    this.selectedTeacherDetail.set(null);
    this.selectedSalesDetail.set(null);
    this.selectedOpsDetail.set(row);
    this.detailTab.set('ops');
  }

  closeDetail(): void {
    this.detailTab.set(null);
    this.selectedTeacherDetail.set(null);
    this.selectedSalesDetail.set(null);
    this.selectedOpsDetail.set(null);
  }

  teacherDetail(): TeacherPerf | null {
    return this.selectedTeacherDetail();
  }

  salesDetail(): SalesPerf | null {
    return this.selectedSalesDetail();
  }

  opsDetail(): OpsPerf | null {
    return this.selectedOpsDetail();
  }

  detailTitle(): string {
    const type = this.detailTab();
    if (type === 'teachers' && this.teacherDetail()) {
      return `Chi tiet hieu suat: ${this.teacherDetail()!.name}`;
    }
    if (type === 'sales' && this.salesDetail()) {
      return `Chi tiet hieu suat: ${this.salesDetail()!.name}`;
    }
    if (type === 'ops' && this.opsDetail()) {
      return `Chi tiet hieu suat: ${this.opsDetail()!.name}`;
    }
    return 'Chi tiet hieu suat';
  }

  private filterRows<T extends EmployeeBase>(rows: T[]): T[] {
    const keyword = this.searchTerm.trim().toLowerCase();
    if (!keyword) return rows;

    return rows.filter((row) => {
      const haystack = [row.name, row.email || '']
        .join(' ')
        .toLowerCase();
      return haystack.includes(keyword);
    });
  }
}
