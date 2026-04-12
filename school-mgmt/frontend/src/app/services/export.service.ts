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

  exportInvestorSummary(params: { monthCount?: number } = {}) {
    return this.downloadCsv(`${this.base}/investor-summary`, params, 'bao-cao-co-dong');
  }

  private async downloadCsv(url: string, params: Record<string, any>, filename: string) {
    const q: any = {};
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') {
        q[k] = v;
      }
    });

    const queryStr = new URLSearchParams(q).toString();
    const fullUrl = queryStr ? `${url}?${queryStr}` : url;

    let response: Response;
    try {
      response = await fetch(fullUrl, { credentials: 'include' });
    } catch {
      throw new Error('Khong the ket noi toi dich vu export.');
    }

    if (!response.ok) {
      const message = await this.readErrorMessage(response);
      throw new Error(message);
    }

    const blob = await response.blob();
    const date = new Date().toISOString().slice(0, 10);
    const resolvedFilename = this.readFilename(response.headers.get('content-disposition')) || `${filename}_${date}.csv`;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = resolvedFilename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  }

  private async readErrorMessage(response: Response): Promise<string> {
    const contentType = response.headers.get('content-type') || '';

    if (contentType.toLowerCase().includes('application/json')) {
      try {
        const body = await response.clone().json() as { message?: string | string[] };
        if (Array.isArray(body?.message) && body.message.length > 0) {
          return body.message[0];
        }
        if (typeof body?.message === 'string' && body.message.trim()) {
          return body.message;
        }
      } catch {
        // Fall through to status-based message.
      }
    }

    if (response.status === 408 || response.status === 504) {
      return 'Export dang bi timeout. Vui long thu lai sau.';
    }

    if (response.status === 403) {
      return 'Tai khoan hien tai khong co quyen tai bao cao nay.';
    }

    if (response.status >= 500) {
      return 'Backend export dang loi. Vui long thu lai sau.';
    }

    return `Export that bai (HTTP ${response.status}).`;
  }

  private readFilename(contentDisposition: string | null): string | null {
    if (!contentDisposition) {
      return null;
    }

    const utf8Match = /filename\*=UTF-8''([^;]+)/i.exec(contentDisposition);
    if (utf8Match?.[1]) {
      return decodeURIComponent(utf8Match[1]);
    }

    const basicMatch = /filename=\"?([^\";]+)\"?/i.exec(contentDisposition);
    return basicMatch?.[1] || null;
  }
}
