import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

import { FlowGuideComponent } from './shared/flow-guide.component';

interface TeacherPerf {
  name: string;
  totalSessions: number;
  reportRate: number;
  avgRating: number;
}

interface SalesPerf {
  name: string;
  totalLeads: number;
  convertedLeads: number;
  conversionRate: number;
  revenue: number;
  commission: number;
}

interface OpsPerf {
  name: string;
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
  imports: [CommonModule, FlowGuideComponent],
  template: `
  <header class="page-header">
    <div>
      <h2>Hiệu suất nhân viên</h2>
      <p>Tổng quan hiệu suất theo bộ phận: Giáo viên, Kinh doanh, Vận hành.</p>
    </div>
  </header>

  <app-flow-guide featureKey="employee-performance"></app-flow-guide>

  <!-- Tab bar -->
  <div class="tab-bar">
    <button *ngFor="let t of tabs" [class.active]="activeTab() === t.key" (click)="activeTab.set(t.key)">
      {{ t.label }}
    </button>
  </div>

  <div class="loading" *ngIf="loading()">Đang tải dữ liệu...</div>

  <!-- Teachers tab -->
  <ng-container *ngIf="activeTab() === 'teachers' && !loading()">
    <table class="data" *ngIf="teachers().length; else empty">
      <thead>
        <tr>
          <th>#</th>
          <th>Giáo viên</th>
          <th class="right">Tổng buổi dạy</th>
          <th class="right">Tỷ lệ báo cáo (%)</th>
          <th class="right">Đánh giá TB</th>
        </tr>
      </thead>
      <tbody>
        <tr *ngFor="let t of teachers(); let i = index">
          <td>{{ i + 1 }}</td>
          <td>{{ t.name }}</td>
          <td class="right">{{ t.totalSessions | number:'1.0-0' }}</td>
          <td class="right">{{ t.reportRate | number:'1.1-1' }}%</td>
          <td class="right">{{ t.avgRating | number:'1.1-1' }}</td>
        </tr>
      </tbody>
    </table>
  </ng-container>

  <!-- Sales tab -->
  <ng-container *ngIf="activeTab() === 'sales' && !loading()">
    <table class="data" *ngIf="sales().length; else empty">
      <thead>
        <tr>
          <th>#</th>
          <th>Nhân viên KD</th>
          <th class="right">Tổng leads</th>
          <th class="right">Đã chuyển đổi</th>
          <th class="right">Tỷ lệ (%)</th>
          <th class="right">Doanh thu</th>
          <th class="right">Hoa hồng</th>
        </tr>
      </thead>
      <tbody>
        <tr *ngFor="let s of sales(); let i = index">
          <td>{{ i + 1 }}</td>
          <td>{{ s.name }}</td>
          <td class="right">{{ s.totalLeads | number:'1.0-0' }}</td>
          <td class="right">{{ s.convertedLeads | number:'1.0-0' }}</td>
          <td class="right">{{ s.conversionRate | number:'1.1-1' }}%</td>
          <td class="right">{{ s.revenue | number:'1.0-0' }}</td>
          <td class="right">{{ s.commission | number:'1.0-0' }}</td>
        </tr>
      </tbody>
    </table>
  </ng-container>

  <!-- OPS tab -->
  <ng-container *ngIf="activeTab() === 'ops' && !loading()">
    <table class="data" *ngIf="ops().length; else empty">
      <thead>
        <tr>
          <th>#</th>
          <th>Nhân viên VH</th>
          <th class="right">Tổng ticket</th>
          <th class="right">Đã xử lý</th>
          <th class="right">Tỷ lệ xử lý (%)</th>
        </tr>
      </thead>
      <tbody>
        <tr *ngFor="let o of ops(); let i = index">
          <td>{{ i + 1 }}</td>
          <td>{{ o.name }}</td>
          <td class="right">{{ o.totalTickets | number:'1.0-0' }}</td>
          <td class="right">{{ o.resolvedTickets | number:'1.0-0' }}</td>
          <td class="right">{{ o.resolutionRate | number:'1.1-1' }}%</td>
        </tr>
      </tbody>
    </table>
  </ng-container>

  <ng-template #empty>
    <div class="empty">Không có dữ liệu.</div>
  </ng-template>
  `,
  styles: [`
    :host { display: block; padding: 24px; }

    .page-header {
      display: flex; justify-content: space-between; align-items: flex-start;
      margin-bottom: 20px;
    }
    .page-header h2 { margin: 0 0 4px; font-size: 1.4rem; }
    .page-header p { margin: 0; color: #6b7280; font-size: 0.9rem; }

    .tab-bar {
      display: flex; gap: 8px; margin-bottom: 20px;
      border-bottom: 2px solid #e5e7eb; padding-bottom: 0;
    }
    .tab-bar button {
      padding: 10px 20px; border: none; background: none;
      font-size: 0.95rem; cursor: pointer; color: #6b7280;
      border-bottom: 3px solid transparent; margin-bottom: -2px;
      transition: all 0.2s;
    }
    .tab-bar button:hover { color: #111827; }
    .tab-bar button.active {
      color: #2563eb; border-bottom-color: #2563eb; font-weight: 600;
    }

    .loading {
      text-align: center; padding: 40px; color: #6b7280; font-size: 0.95rem;
    }

    table.data {
      width: 100%; border-collapse: collapse; font-size: 0.9rem;
    }
    table.data th {
      text-align: left; padding: 10px 12px; font-weight: 600;
      border-bottom: 2px solid #e5e7eb; color: #374151; font-size: 0.85rem;
    }
    table.data td {
      padding: 10px 12px; border-bottom: 1px solid #f3f4f6;
    }
    table.data tbody tr:hover { background: #f9fafb; }
    .right { text-align: right; }

    .empty {
      text-align: center; padding: 40px; color: #9ca3af; font-size: 0.95rem;
    }
  `],
})
export class EmployeePerformanceComponent implements OnInit {
  private readonly http = inject(HttpClient);

  tabs = [
    { key: 'teachers', label: 'Giáo viên' },
    { key: 'sales', label: 'Kinh doanh' },
    { key: 'ops', label: 'Vận hành' },
  ];

  activeTab = signal<string>('teachers');
  loading = signal(false);
  teachers = signal<TeacherPerf[]>([]);
  sales = signal<SalesPerf[]>([]);
  ops = signal<OpsPerf[]>([]);

  ngOnInit(): void {
    this.loadData();
  }

  async loadData(): Promise<void> {
    this.loading.set(true);
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
    } finally {
      this.loading.set(false);
    }
  }
}
