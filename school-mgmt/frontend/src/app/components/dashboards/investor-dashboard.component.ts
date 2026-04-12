import { CommonModule } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { ExportService } from '../../services/export.service';
import {
  FinancialAlertsResponse,
  FinancialControlService,
  FinancialDashboard,
  InvestorMetrics,
} from '../../services/financial-control.service';

type InvestorSectionKey = 'metrics' | 'dashboard' | 'alerts';
type InvestorSectionErrors = Partial<Record<InvestorSectionKey, string>>;

@Component({
  selector: 'app-investor-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './investor-dashboard.component.html',
  styleUrls: ['./investor-dashboard.component.css'],
})
export class InvestorDashboardComponent implements OnInit {
  metrics = signal<InvestorMetrics | null>(null);
  dashboard = signal<FinancialDashboard | null>(null);
  alerts = signal<FinancialAlertsResponse | null>(null);
  loading = signal(false);
  pageError = signal('');
  statusMessage = signal('');
  exportSuccess = signal('');
  exportError = signal('');
  exporting = signal(false);
  sectionErrors = signal<InvestorSectionErrors>({});
  monthCount = 6;

  constructor(
    private readonly service: FinancialControlService,
    private readonly auth: AuthService,
    private readonly exportService: ExportService,
  ) {}

  ngOnInit(): void {
    void this.loadMetrics();
  }

  currentRole(): string {
    return this.auth.userSignal()?.role || '';
  }

  hasAnyData(): boolean {
    return !!(this.metrics() || this.dashboard() || this.alerts());
  }

  hasSectionErrors(): boolean {
    return Object.keys(this.sectionErrors()).length > 0;
  }

  canExportInvestorSummary(): boolean {
    return this.currentRole() === 'SHAREHOLDER';
  }

  sectionError(key: InvestorSectionKey): string {
    return this.sectionErrors()[key] || '';
  }

  async onMonthCountChange(value: number | string): Promise<void> {
    const normalized = Number(value);
    this.monthCount = [3, 6, 12].includes(normalized) ? normalized : 6;
    await this.loadMetrics();
  }

  async loadMetrics(): Promise<void> {
    this.loading.set(true);
    this.pageError.set('');
    this.statusMessage.set('');

    const nextErrors: InvestorSectionErrors = {};

    const results = await Promise.allSettled([
      this.withRetry(() => this.service.getInvestorMetrics(this.monthCount)),
      this.withRetry(() => this.service.getDashboard()),
      this.withRetry(() => this.service.getAlerts()),
    ]);

    const [metricsResult, dashboardResult, alertsResult] = results;
    let successCount = 0;
    let authExpired = false;

    if (metricsResult.status === 'fulfilled') {
      this.metrics.set(metricsResult.value);
      successCount += 1;
    } else {
      nextErrors.metrics = this.describeSectionError('Investor metrics', metricsResult.reason);
      authExpired = authExpired || this.readErrorStatus(metricsResult.reason) === 401;
    }

    if (dashboardResult.status === 'fulfilled') {
      this.dashboard.set(dashboardResult.value);
      successCount += 1;
    } else {
      nextErrors.dashboard = this.describeSectionError('Financial dashboard', dashboardResult.reason);
      authExpired = authExpired || this.readErrorStatus(dashboardResult.reason) === 401;
    }

    if (alertsResult.status === 'fulfilled') {
      this.alerts.set(alertsResult.value);
      successCount += 1;
    } else {
      nextErrors.alerts = this.describeSectionError('Financial alerts', alertsResult.reason);
      authExpired = authExpired || this.readErrorStatus(alertsResult.reason) === 401;
    }

    this.sectionErrors.set(nextErrors);

    if (authExpired) {
      this.pageError.set('Phiên đăng nhập đã hết hạn. Hệ thống sẽ đưa anh về màn đăng nhập.');
      this.loading.set(false);
      void this.auth.logout();
      return;
    }

    if (successCount === 0) {
      this.pageError.set('Không thể tải dữ liệu cổ đông. Vui lòng thử lại sau.');
    } else if (Object.keys(nextErrors).length > 0) {
      this.statusMessage.set('Một phần dữ liệu chưa tải được. Các khối còn lại vẫn được giữ nguyên để tiếp tục xem.');
    }

    this.loading.set(false);
  }

  async exportInvestorSummary(): Promise<void> {
    if (!this.canExportInvestorSummary() || this.exporting()) {
      return;
    }

    this.exporting.set(true);
    this.exportSuccess.set('');
    this.exportError.set('');

    try {
      await this.exportService.exportInvestorSummary({ monthCount: this.monthCount });
      this.exportSuccess.set('Bao cao CSV dang duoc tai ve.');
    } catch (error) {
      if (error instanceof Error && error.message) {
        this.exportError.set(error.message);
      } else {
        this.exportError.set('Khong the xuat bao cao co dong.');
      }
    } finally {
      this.exporting.set(false);
    }
  }

  private async withRetry<T>(loader: () => Promise<T>, retries = 2, baseDelayMs = 500): Promise<T> {
    let attempt = 0;

    while (true) {
      try {
        return await loader();
      } catch (error) {
        if (attempt >= retries || !this.isTransientError(error)) {
          throw error;
        }

        await this.sleep(baseDelayMs * (2 ** attempt));
        attempt += 1;
      }
    }
  }

  private isTransientError(error: unknown): boolean {
    const status = this.readErrorStatus(error);
    return status === 0 || status === 408 || status === 429 || (status >= 500 && status < 600);
  }

  private readErrorStatus(error: unknown): number {
    if (typeof error === 'object' && error !== null && 'status' in error) {
      const status = Number((error as { status?: unknown }).status);
      if (Number.isFinite(status)) {
        return status;
      }
    }

    return -1;
  }

  private describeSectionError(section: string, error: unknown): string {
    const status = this.readErrorStatus(error);

    if (status === 401) {
      return `${section}: phiên đăng nhập đã hết hạn.`;
    }

    if (status === 403) {
      return `${section}: tài khoản hiện tại không có quyền truy cập.`;
    }

    if (status === 0 || status === 408) {
      return `${section}: lỗi kết nối hoặc timeout.`;
    }

    if (status === 429) {
      return `${section}: hệ thống đang giới hạn tần suất, vui lòng thử lại.`;
    }

    if (status >= 500 && status < 600) {
      return `${section}: backend đang lỗi hoặc trả dữ liệu không ổn định.`;
    }

    if (error instanceof Error && error.message) {
      return `${section}: ${error.message}`;
    }

    return `${section}: không xác định được nguyên nhân lỗi.`;
  }
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  snapshotCashOnHand(): number | null {
    return this.metrics()?.snapshot.cashOnHand
      ?? this.dashboard()?.cashPosition.availableCash
      ?? null;
  }

  snapshotBurnRate(): number | null {
    return this.metrics()?.snapshot.burnRate
      ?? this.dashboard()?.metrics.burnRate
      ?? null;
  }

  snapshotRunway(): number | null {
    return this.metrics()?.snapshot.runway
      ?? this.dashboard()?.metrics.runway
      ?? null;
  }

  criticalAlertHint(): string {
    const alerts = this.alerts();
    if (!alerts) {
      return 'Chưa tải được cảnh báo';
    }

    if (alerts.criticalCount > 0) {
      return `${alerts.criticalCount} cảnh báo mức critical`;
    }

    if (alerts.warningCount > 0) {
      return `${alerts.warningCount} cảnh báo mức warning`;
    }

    return 'Không có cảnh báo nghiêm trọng';
  }

  formatCustomerBase(): string {
    const metrics = this.metrics();
    if (!metrics) {
      return '-';
    }

    return `${metrics.customerBase.enrolledStudents} / ${metrics.customerBase.activeStudents}`;
  }

  topAlerts(alerts: FinancialAlertsResponse) {
    return (alerts.alerts || []).slice(0, 4);
  }

  formatMoney(value?: number | null): string {
    if (value === null || value === undefined) {
      return '-';
    }

    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      maximumFractionDigits: 0,
    }).format(Number(value || 0));
  }

  formatNumber(value?: number | null, digits = 0): string {
    if (value === null || value === undefined) {
      return '-';
    }

    return new Intl.NumberFormat('vi-VN', {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(Number(value || 0));
  }

  formatPercent(value?: number | null): string {
    if (value === null || value === undefined) {
      return '-';
    }

    return `${this.formatNumber(value, 1)}%`;
  }

  formatGrowth(value?: number | null): string {
    if (value === null || value === undefined) {
      return '-';
    }

    const normalized = Number(value || 0);
    const prefix = normalized > 0 ? '+' : '';
    return `${prefix}${this.formatNumber(normalized, 1)}%`;
  }

  runwayHint(runway?: number | null): string {
    const months = Number(runway || 0);
    if (!months) return 'Chưa có runway rõ ràng';
    if (months < 3) return 'Cần theo dõi sát';
    if (months < 6) return 'Mức chấp nhận được';
    return 'Runway an toàn';
  }

  maxTrendValue(data: InvestorMetrics): number {
    const values = [...data.trend.revenue, ...data.trend.netProfit]
      .map((item) => Math.abs(Number(item || 0)));
    return Math.max(1, ...values);
  }

  barPercent(value: number | undefined, max: number): number {
    const numeric = Math.abs(Number(value || 0));
    if (!max || numeric <= 0) return 0;
    return Math.max(10, Math.min(100, (numeric / max) * 100));
  }

  exportButtonLabel(): string {
    return this.exporting() ? 'Dang xuat...' : 'Xuat Bao Cao (CSV)';
  }
}
