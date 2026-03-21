import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ExportService {
  private http = inject(HttpClient);
  private base = `${environment.apiBase}/export`;

  exportPayroll(params: { fromDate?: string; toDate?: string; status?: string } = {}) {
    return this.downloadCsv(`${this.base}/payroll`, params, 'bang-luong');
  }

  exportInvoices(params: { fromDate?: string; toDate?: string; status?: string } = {}) {
    return this.downloadCsv(`${this.base}/invoices`, params, 'hoa-don');
  }

  exportStudents() {
    return this.downloadCsv(`${this.base}/students`, {}, 'hoc-sinh');
  }

  exportFinancial(params: { fromDate?: string; toDate?: string } = {}) {
    return this.downloadCsv(`${this.base}/financial`, params, 'tai-chinh');
  }

  exportAttendance(params: { fromDate?: string; toDate?: string } = {}) {
    return this.downloadCsv(`${this.base}/attendance`, params, 'diem-danh');
  }

  exportAdsParentProfit(params: {
    startDate?: string;
    endDate?: string;
    adGroupId?: string;
    platform?: string;
  } = {}) {
    return this.downloadCsv(`${this.base}/ads-parent-profit`, params, 'ads-parent-profit');
  }

  exportAdsRealizedCohort(params: {
    startDate?: string;
    endDate?: string;
    maturityDays?: number;
    adGroupId?: string;
    platform?: string;
    refundRatePercentX?: number;
  } = {}) {
    return this.downloadCsv(`${this.base}/ads-realized-cohort`, params, 'ads-realized-cohort');
  }

  private async downloadCsv(url: string, params: Record<string, any>, filename: string) {
    const q: any = {};
    Object.entries(params).forEach(([k, v]) => { if (v) q[k] = v; });

    const queryStr = new URLSearchParams(q).toString();
    const fullUrl = queryStr ? `${url}?${queryStr}` : url;

    // Use fetch with credentials for cookie-based auth
    const response = await fetch(fullUrl, { credentials: 'include' });
    if (!response.ok) throw new Error('Export failed');

    const blob = await response.blob();
    const date = new Date().toISOString().slice(0, 10);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${filename}_${date}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  }
}
