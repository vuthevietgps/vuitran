import {
  INVOICE_COURSE_STATUS_LABELS,
  InvoiceCourseStatus,
  InvoiceItem,
  InvoiceStatus,
} from '../services/invoice.service';
import { ClassItem } from '../services/class.service';
import { environment } from '../../environments/environment';

export interface InvoiceForm {
  invoiceNumber: string;
  courseStatus: InvoiceCourseStatus;
  studentId: string;
  classId: string;
  classType: 'ONLINE' | 'OFFLINE' | '';
  saleId: string;
  sessions: number;
  bonusSessions: number;
  trialSessions: number;
  paymentRound: number;
  amount: number;
  paymentDate: string;
  description: string;
  receiptImage: string;
}

export function roundMoneyToThousand(amount?: number): number {
  const normalized = Number(amount || 0);
  if (!Number.isFinite(normalized) || normalized <= 0) return 0;
  return Math.round(normalized / 1000) * 1000;
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(roundMoneyToThousand(amount));
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('vi-VN');
}

export function formatRegisteredSessions(invoice: InvoiceItem): string {
  const sessions = Number(invoice.sessions || 0);
  const bonusSessions = Number(invoice.bonusSessions || 0);
  const trialSessions = Number(invoice.trialSessions || 0);

  const parts: string[] = [];
  if (sessions > 0) parts.push(`${sessions} chính`);
  if (bonusSessions > 0) parts.push(`${bonusSessions} tặng`);
  if (trialSessions > 0) parts.push(`${trialSessions} thử`);

  const total = sessions + bonusSessions + trialSessions;

  if (parts.length === 0) return '-';
  if (parts.length === 1) return String(total);
  return `${total} (${parts.join(' + ')})`;
}

export function getInvoiceClassLabel(value: InvoiceItem['classId']): string {
  if (!value) return '-';
  if (typeof value === 'string') {
    return value;
  }
  const code = value.code?.trim();
  const name = value.name?.trim();
  if (code && name) return `${code} - ${name}`;
  return code || name || '-';
}

export function formatClassOption(item: ClassItem): string {
  const code = item.code?.trim() || '';
  const name = item.name?.trim() || '';
  if (code && name) return `${code} - ${name}`;
  return code || name || item._id;
}

export function formatClassCodeOption(item: ClassItem): string {
  const code = item.code?.trim();
  if (code) {
    return code;
  }
  return item.name?.trim() || item._id;
}

export function getStatusText(status: InvoiceStatus | string): string {
  const map: Record<string, string> = {
    PENDING_APPROVAL: 'Chờ duyệt',
    APPROVED: 'Đã duyệt',
    REJECTED: 'Từ chối',
    CANCELLED: 'Đã hủy',
    PAID: 'Đã thanh toán',
    PENDING: 'Chờ thanh toán',
  };
  return map[status] || status;
}

export function getCourseStatusText(status?: InvoiceCourseStatus | string): string {
  if (!status) return INVOICE_COURSE_STATUS_LABELS.NEW;
  return INVOICE_COURSE_STATUS_LABELS[status as InvoiceCourseStatus] || String(status);
}

export function getStatusClass(status: InvoiceStatus | string): string {
  const map: Record<string, string> = {
    PENDING_APPROVAL: 'pending-approval',
    APPROVED: 'approved',
    REJECTED: 'rejected',
    CANCELLED: 'cancelled',
    PAID: 'approved',
    PENDING: 'pending-approval',
  };
  return map[status] || 'pending-approval';
}

export function getImageUrl(imagePath: string): string {
  if (imagePath.startsWith('http')) return imagePath;
  return `${environment.apiBase}${imagePath}`;
}

export function methodLabel(method: string): string {
  const map: Record<string, string> = {
    BANK_TRANSFER: 'Chuyển khoản',
    CASH: 'Tiền mặt',
    MOMO: 'MoMo',
    SYSTEM: 'Hệ thống',
  };
  return map[method] || method;
}

export function blankForm(): InvoiceForm {
  return {
    invoiceNumber: '',
    courseStatus: 'NEW',
    studentId: '',
    classId: '',
    classType: '',
    saleId: '',
    sessions: 0,
    bonusSessions: 0,
    trialSessions: 0,
    paymentRound: 0,
    amount: 0,
    paymentDate: new Date().toISOString().split('T')[0],
    description: '',
    receiptImage: '',
  };
}
