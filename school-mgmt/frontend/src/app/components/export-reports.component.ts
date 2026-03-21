import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ExportService } from '../services/export.service';
import { AuthService } from '../services/auth.service';
import { Role } from '../models/role.enum';

import { FlowGuideComponent } from './shared/flow-guide.component';

@Component({
  selector: 'app-export-reports',
  standalone: true,
  imports: [CommonModule, FormsModule, FlowGuideComponent],
  template: `
  <app-flow-guide featureKey="export-reports"></app-flow-guide>
  <div class="container">
    <h2>&#128230; Xuất báo cáo</h2>
    <p class="subtitle">Xuất dữ liệu ra file CSV để phân tích hoặc báo cáo</p>

    <div class="export-grid">
      <!-- Payroll -->
      <div class="export-card" *ngIf="hasRole([Role.DIRECTOR, Role.ACCOUNTING])">
        <div class="card-icon">&#128181;</div>
        <h3>Bảng lương</h3>
        <p>Xuất dữ liệu bảng lương giáo viên</p>
        <div class="card-filters">
          <input type="date" [(ngModel)]="payrollFrom" placeholder="Từ ngày" />
          <input type="date" [(ngModel)]="payrollTo" placeholder="Đến ngày" />
          <select [(ngModel)]="payrollStatus">
            <option value="">Tất cả trạng thái</option>
            <option value="DRAFT">Nháp</option>
            <option value="PENDING_REVIEW">Chờ duyệt</option>
            <option value="APPROVED">Đã duyệt</option>
            <option value="PAID">Đã thanh toán</option>
            <option value="REJECTED">Từ chối</option>
          </select>
        </div>
        <button class="btn-export" (click)="exportPayroll()" [disabled]="exporting === 'payroll'">
          {{ exporting === 'payroll' ? 'Đang xuất...' : '&#11015; Xuất CSV' }}
        </button>
      </div>

      <!-- Invoices -->
      <div class="export-card" *ngIf="hasRole([Role.DIRECTOR, Role.ACCOUNTING])">
        <div class="card-icon">&#128196;</div>
        <h3>Hóa đơn</h3>
        <p>Xuất danh sách hóa đơn thu học phí</p>
        <div class="card-filters">
          <input type="date" [(ngModel)]="invoiceFrom" placeholder="Từ ngày" />
          <input type="date" [(ngModel)]="invoiceTo" placeholder="Đến ngày" />
          <select [(ngModel)]="invoiceStatus">
            <option value="">Tất cả trạng thái</option>
            <option value="PENDING">Chờ TT</option>
            <option value="PENDING_APPROVAL">Chờ duyệt</option>
            <option value="APPROVED">Đã duyệt</option>
            <option value="PAID">Đã TT</option>
            <option value="REJECTED">Từ chối</option>
          </select>
        </div>
        <button class="btn-export" (click)="exportInvoices()" [disabled]="exporting === 'invoices'">
          {{ exporting === 'invoices' ? 'Đang xuất...' : '&#11015; Xuất CSV' }}
        </button>
      </div>

      <!-- Financial -->
      <div class="export-card" *ngIf="hasRole([Role.DIRECTOR, Role.ACCOUNTING])">
        <div class="card-icon">&#128176;</div>
        <h3>Tài chính</h3>
        <p>Xuất sổ cái giao dịch ví</p>
        <div class="card-filters">
          <input type="date" [(ngModel)]="financialFrom" placeholder="Từ ngày" />
          <input type="date" [(ngModel)]="financialTo" placeholder="Đến ngày" />
        </div>
        <button class="btn-export" (click)="exportFinancial()" [disabled]="exporting === 'financial'">
          {{ exporting === 'financial' ? 'Đang xuất...' : '&#11015; Xuất CSV' }}
        </button>
      </div>

      <!-- Students -->
      <div class="export-card" *ngIf="hasRole([Role.DIRECTOR, Role.OPS, Role.ACCOUNTING])">
        <div class="card-icon">&#127891;</div>
        <h3>Học sinh</h3>
        <p>Xuất danh sách toàn bộ học sinh</p>
        <button class="btn-export" (click)="exportStudents()" [disabled]="exporting === 'students'">
          {{ exporting === 'students' ? 'Đang xuất...' : '&#11015; Xuất CSV' }}
        </button>
      </div>

      <!-- Attendance -->
      <div class="export-card" *ngIf="hasRole([Role.DIRECTOR, Role.OPS])">
        <div class="card-icon">&#9745;</div>
        <h3>Điểm danh</h3>
        <p>Xuất dữ liệu điểm danh theo khoảng thời gian</p>
        <div class="card-filters">
          <input type="date" [(ngModel)]="attendanceFrom" placeholder="Từ ngày" />
          <input type="date" [(ngModel)]="attendanceTo" placeholder="Đến ngày" />
        </div>
        <button class="btn-export" (click)="exportAttendance()" [disabled]="exporting === 'attendance'">
          {{ exporting === 'attendance' ? 'Đang xuất...' : '&#11015; Xuất CSV' }}
        </button>
      </div>
      <div class="export-card" *ngIf="hasRole([Role.DIRECTOR, Role.ACCOUNTING])">
        <div class="card-icon">&#128202;</div>
        <h3>Doi soat Ads</h3>
        <p>Xuat report theo ky de finance doi soat doanh thu, chi phi va loi nhuan ads ngoai he thong.</p>
        <div class="card-filters">
          <input type="date" [(ngModel)]="adsStartDate" placeholder="Tu ngay" />
          <input type="date" [(ngModel)]="adsEndDate" placeholder="Den ngay" />
          <select [(ngModel)]="adsPlatform">
            <option value="">Tat ca nen tang</option>
            <option value="FACEBOOK">Facebook</option>
            <option value="GOOGLE">Google</option>
            <option value="TIKTOK">TikTok</option>
          </select>
          <input type="number" [(ngModel)]="adsMaturityDays" min="1" max="180" step="1" placeholder="So ngay chin cohort" />
          <input type="number" [(ngModel)]="adsRefundRatePercentX" min="0" max="100" step="0.1" placeholder="Refund X (%)" />
        </div>
        <div class="card-actions">
          <button class="btn-export" (click)="exportAdsParentProfit()" [disabled]="exporting === 'ads-parent-profit'">
            {{ exporting === 'ads-parent-profit' ? 'Dang xuat...' : '&#11015; Parent profit CSV' }}
          </button>
          <button class="btn-export secondary" (click)="exportAdsRealizedCohort()" [disabled]="exporting === 'ads-realized-cohort'">
            {{ exporting === 'ads-realized-cohort' ? 'Dang xuat...' : '&#11015; Cohort CSV' }}
          </button>
        </div>
      </div>
    </div>

    <div *ngIf="message" class="message" [class.error]="isError">{{ message }}</div>
  </div>
  `,
  styles: [`
    .container { padding:24px; max-width:1200px; margin:0 auto; }
    h2 { margin:0 0 4px; color:#1e293b; font-size:22px; }
    .subtitle { color:#64748b; margin:0 0 24px; font-size:14px; }
    .export-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(300px, 1fr)); gap:16px; }
    .export-card {
      background:#fff; border-radius:12px; padding:24px; box-shadow:0 1px 3px rgba(0,0,0,.06);
      display:flex; flex-direction:column; gap:8px;
    }
    .card-icon { font-size:32px; }
    .export-card h3 { margin:0; font-size:16px; color:#1e293b; }
    .export-card p { margin:0; font-size:13px; color:#64748b; }
    .card-filters { display:flex; flex-direction:column; gap:6px; margin-top:8px; }
    .card-filters input, .card-filters select {
      padding:7px 10px; border:1px solid #e2e8f0; border-radius:6px; font-size:13px; background:#fff;
    }
    .card-actions { display:flex; gap:8px; flex-wrap:wrap; margin-top:12px; }
    .btn-export {
      margin-top:12px; padding:10px 18px; border:none; border-radius:8px;
      background:linear-gradient(135deg, #2563eb, #3b82f6); color:#fff;
      font-size:14px; font-weight:600; cursor:pointer; transition:opacity .15s;
    }
    .card-actions .btn-export { margin-top:0; flex:1 1 180px; }
    .btn-export.secondary { background:linear-gradient(135deg, #0f766e, #14b8a6); }
    .btn-export:hover { opacity:.9; }
    .btn-export:disabled { opacity:.5; cursor:default; }
    .message {
      margin-top:16px; padding:12px 16px; border-radius:8px;
      background:#dcfce7; color:#166534; font-size:13px;
    }
    .message.error { background:#fef2f2; color:#991b1b; }
  `]
})
export class ExportReportsComponent {
  private exportSvc = inject(ExportService);
  private auth = inject(AuthService);
  Role = Role;

  exporting = '';
  message = '';
  isError = false;

  payrollFrom = '';
  payrollTo = '';
  payrollStatus = '';

  invoiceFrom = '';
  invoiceTo = '';
  invoiceStatus = '';

  financialFrom = '';
  financialTo = '';

  attendanceFrom = '';
  attendanceTo = '';

  adsEndDate = new Date().toISOString().split('T')[0];
  adsStartDate = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
  adsPlatform = '';
  adsMaturityDays = 60;
  adsRefundRatePercentX: number | null = null;

  hasRole(roles: Role[]): boolean {
    return this.auth.hasRole(roles);
  }

  async exportPayroll() {
    await this.doExport('payroll', () =>
      this.exportSvc.exportPayroll({ fromDate: this.payrollFrom, toDate: this.payrollTo, status: this.payrollStatus })
    );
  }

  async exportInvoices() {
    await this.doExport('invoices', () =>
      this.exportSvc.exportInvoices({ fromDate: this.invoiceFrom, toDate: this.invoiceTo, status: this.invoiceStatus })
    );
  }

  async exportStudents() {
    await this.doExport('students', () => this.exportSvc.exportStudents());
  }

  async exportFinancial() {
    await this.doExport('financial', () =>
      this.exportSvc.exportFinancial({ fromDate: this.financialFrom, toDate: this.financialTo })
    );
  }

  async exportAttendance() {
    await this.doExport('attendance', () =>
      this.exportSvc.exportAttendance({ fromDate: this.attendanceFrom, toDate: this.attendanceTo })
    );
  }

  async exportAdsParentProfit() {
    await this.doExport('ads-parent-profit', () =>
      this.exportSvc.exportAdsParentProfit({
        startDate: this.adsStartDate,
        endDate: this.adsEndDate,
        platform: this.adsPlatform || undefined,
      })
    );
  }

  async exportAdsRealizedCohort() {
    await this.doExport('ads-realized-cohort', () =>
      this.exportSvc.exportAdsRealizedCohort({
        startDate: this.adsStartDate,
        endDate: this.adsEndDate,
        platform: this.adsPlatform || undefined,
        maturityDays: this.adsMaturityDays,
        refundRatePercentX: this.adsRefundRatePercentX === null ? undefined : this.adsRefundRatePercentX,
      })
    );
  }

  private async doExport(type: string, fn: () => Promise<void>) {
    this.exporting = type;
    this.message = '';
    this.isError = false;
    try {
      await fn();
      this.message = 'Xuất báo cáo thành công! File đã được tải về.';
    } catch (err: any) {
      this.isError = true;
      this.message = 'Xuất báo cáo thất bại: ' + (err?.message || 'Lỗi không xác định');
    } finally {
      this.exporting = '';
    }
  }
}
