import { Component, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { AuthService } from '../services/auth.service';
import { Role } from '../models/role.enum';

import { FlowGuideComponent } from './shared/flow-guide.component';

interface AgingSummary {
  totalAR: number;
  current: number;
  '1-30': number;
  '31-60': number;
  '61-90': number;
  '90+': number;
}

interface AgingDetail {
  parentName: string;
  parentPhone: string;
  students: string[];
  totalDebt: number;
  oldestDate: string;
  bucket: string;
  items: any[];
}

interface AgingReport {
  summary: AgingSummary;
  details: AgingDetail[];
}

@Component({
  selector: 'app-aging-report',
  standalone: true,
  imports: [CommonModule, FormsModule, FlowGuideComponent],
  template: `
  <header class="page-header">
    <div>
      <h2>Bao cao Cong no theo tuoi no (Aging Report)</h2>
      <p>Phan tich cong no phu huynh theo thoi gian qua han.</p>
    </div>
  </header>

  <app-flow-guide featureKey="aging-report"></app-flow-guide>

  <!-- Summary cards -->
  <section class="summary-grid" *ngIf="report()">
    <div class="summary-card total">
      <div class="summary-icon">&#128176;</div>
      <div class="summary-value">{{report()!.summary.totalAR | number}}d</div>
      <div class="summary-label">Tong cong no (AR)</div>
    </div>
    <div class="summary-card current">
      <div class="summary-icon">&#9989;</div>
      <div class="summary-value">{{report()!.summary.current | number}}d</div>
      <div class="summary-label">Hien tai (Current)</div>
    </div>
    <div class="summary-card bucket-1-30">
      <div class="summary-icon">&#128312;</div>
      <div class="summary-value">{{report()!.summary['1-30'] | number}}d</div>
      <div class="summary-label">1-30 ngay</div>
    </div>
    <div class="summary-card bucket-31-60">
      <div class="summary-icon">&#128993;</div>
      <div class="summary-value">{{report()!.summary['31-60'] | number}}d</div>
      <div class="summary-label">31-60 ngay</div>
    </div>
    <div class="summary-card bucket-61-90">
      <div class="summary-icon">&#128992;</div>
      <div class="summary-value">{{report()!.summary['61-90'] | number}}d</div>
      <div class="summary-label">61-90 ngay</div>
    </div>
    <div class="summary-card bucket-90-plus">
      <div class="summary-icon">&#128308;</div>
      <div class="summary-value">{{report()!.summary['90+'] | number}}d</div>
      <div class="summary-label">Qua 90 ngay</div>
    </div>
  </section>

  <!-- Filter -->
  <section class="filters" *ngIf="report()">
    <select [(ngModel)]="filterBucket" (ngModelChange)="applyFilter()">
      <option value="">Tat ca nhom no</option>
      <option value="current">Hien tai (Current)</option>
      <option value="1-30">1-30 ngay</option>
      <option value="31-60">31-60 ngay</option>
      <option value="61-90">61-90 ngay</option>
      <option value="90+">Qua 90 ngay</option>
    </select>
  </section>

  <p class="privacy-note" *ngIf="isShareholder()">
    Chi tiet ca nhan da duoc an danh cho vai tro co dong.
  </p>

  <!-- Table -->
  <table class="data" *ngIf="filteredDetails().length">
    <thead>
      <tr>
        <th>Phu huynh</th>
        <th>So dien thoai</th>
        <th>Hoc sinh</th>
        <th>Tong no</th>
        <th>Ngay cu nhat</th>
        <th>Nhom no</th>
      </tr>
    </thead>
    <tbody>
      <tr *ngFor="let d of filteredDetails(); let i = index">
        <td><strong>{{displayParentName(d, i)}}</strong></td>
        <td>{{displayParentPhone(d)}}</td>
        <td>{{displayStudents(d)}}</td>
        <td class="right amount-red"><strong>{{d.totalDebt | number}}d</strong></td>
        <td>{{d.oldestDate | date:'dd/MM/yyyy'}}</td>
        <td>
          <span class="badge"
                [class.bucket-current]="d.bucket === 'current'"
                [class.bucket-1-30]="d.bucket === '1-30'"
                [class.bucket-31-60]="d.bucket === '31-60'"
                [class.bucket-61-90]="d.bucket === '61-90'"
                [class.bucket-90-plus]="d.bucket === '90+'">
            {{bucketLabel(d.bucket)}}
          </span>
        </td>
      </tr>
    </tbody>
  </table>

  <p class="empty-text" *ngIf="report() && !filteredDetails().length">Khong co cong no nao trong nhom nay.</p>
  <p class="empty-text" *ngIf="!report()">Dang tai du lieu bao cao cong no...</p>
  `,
  styles: [`
    .page-header { display:flex; justify-content:space-between; align-items:flex-start; padding:24px 32px 16px; }
    .page-header h2 { margin:0; font-size:22px; color:#1e293b; }
    .page-header p { margin:4px 0 0; color:#64748b; font-size:13px; }

    .summary-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:16px; padding:0 32px 16px; }
    .summary-card { background:#fff; border-radius:12px; padding:20px; box-shadow:0 1px 3px rgba(0,0,0,0.08); }
    .summary-icon { font-size:28px; margin-bottom:8px; }
    .summary-value { font-size:20px; font-weight:700; color:#1e293b; }
    .summary-label { font-size:12px; color:#64748b; margin-top:4px; }
    .summary-card.total { border-left:4px solid #6366f1; }
    .summary-card.current { border-left:4px solid #3b82f6; }
    .summary-card.bucket-1-30 { border-left:4px solid #10b981; }
    .summary-card.bucket-31-60 { border-left:4px solid #f59e0b; }
    .summary-card.bucket-61-90 { border-left:4px solid #f97316; }
    .summary-card.bucket-90-plus { border-left:4px solid #ef4444; }

    .filters { display:flex; gap:8px; padding:0 32px 16px; flex-wrap:wrap; }
    .filters select { padding:6px 10px; border:1px solid #cbd5e1; border-radius:6px; font-size:13px; }
    .privacy-note {
      margin: 0 32px 16px;
      padding: 12px 14px;
      border-radius: 10px;
      background: #eff6ff;
      color: #1d4ed8;
      border: 1px solid #bfdbfe;
      font-size: 13px;
    }

    .data { width:calc(100% - 64px); margin:0 32px; border-collapse:collapse; background:#fff; border-radius:12px; overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,0.08); }
    .data th { background:#f8fafc; text-align:left; padding:10px 12px; font-size:12px; color:#64748b; text-transform:uppercase; letter-spacing:0.5px; }
    .data td { padding:10px 12px; border-top:1px solid #f1f5f9; font-size:13px; }
    .data tr:hover { background:#f8fafc; }
    .right { text-align:right; }

    .amount-red { color:#ef4444; }
    .amount-green { color:#10b981; }

    .badge { display:inline-block; padding:2px 10px; border-radius:999px; font-size:11px; font-weight:600; }
    .badge.bucket-current { background:#dbeafe; color:#2563eb; }
    .badge.bucket-1-30 { background:#dcfce7; color:#16a34a; }
    .badge.bucket-31-60 { background:#fef9c3; color:#a16207; }
    .badge.bucket-61-90 { background:#ffedd5; color:#c2410c; }
    .badge.bucket-90-plus { background:#fee2e2; color:#dc2626; }

    .empty-text { text-align:center; color:#94a3b8; padding:32px; font-size:14px; }
  `]
})
export class AgingReportComponent implements OnInit {
  private apiUrl = `${environment.apiBase}/financial-control`;

  report = signal<AgingReport | null>(null);
  filteredDetails = signal<AgingDetail[]>([]);
  filterBucket = '';

  constructor(private http: HttpClient, private auth: AuthService) {}

  ngOnInit() {
    this.loadReport();
  }

  async loadReport() {
    try {
      const data = await this.http.get<AgingReport>(`${this.apiUrl}/aging-report`).toPromise();
      this.report.set(data ?? null);
      this.applyFilter();
    } catch (err) {
      console.error('Error loading aging report:', err);
    }
  }

  applyFilter() {
    const r = this.report();
    if (!r) { this.filteredDetails.set([]); return; }
    if (!this.filterBucket) {
      this.filteredDetails.set(r.details);
    } else {
      this.filteredDetails.set(r.details.filter(d => d.bucket === this.filterBucket));
    }
  }

  bucketLabel(bucket: string): string {
    const labels: Record<string, string> = {
      'current': 'Hien tai',
      '1-30': '1-30 ngay',
      '31-60': '31-60 ngay',
      '61-90': '61-90 ngay',
      '90+': '90+ ngay',
    };
    return labels[bucket] || bucket;
  }

  isShareholder(): boolean {
    return this.auth.hasRole([Role.SHAREHOLDER]);
  }

  displayParentName(detail: AgingDetail, index: number): string {
    return this.isShareholder() ? `PH #${index + 1}` : (detail.parentName || '-');
  }

  displayParentPhone(detail: AgingDetail): string {
    return this.isShareholder() ? 'An danh' : (detail.parentPhone || '-');
  }

  displayStudents(detail: AgingDetail): string {
    if (this.isShareholder()) {
      const count = Array.isArray(detail.students) ? detail.students.length : 0;
      return `${count} hoc sinh`;
    }
    return detail.students?.length ? detail.students.join(', ') : '-';
  }
}
