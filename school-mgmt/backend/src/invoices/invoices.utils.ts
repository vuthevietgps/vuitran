import { Types } from 'mongoose';
import { InvoiceDocument, InvoiceStatus, InvoiceType, InvoiceCourseStatus } from './schemas/invoice.schema';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';

export function getActorId(actor?: JwtPayload): string {
  return String(actor?.sub ?? actor?._id ?? (actor as any)?.userId ?? '');
}

export function normalizeObjectId(value: unknown): string | undefined {
  if (!value) {
    return undefined;
  }
  if (typeof value === 'string') {
    return value;
  }
  return (value as any)?._id?.toString?.() || (value as any)?.toString?.() || undefined;
}

export function getRemainingStudySessions(invoice: Partial<InvoiceDocument> | any): number {
  return Number(invoice?.sessionsRemaining || 0) + Number(invoice?.bonusSessionsRemaining || 0) + Number(invoice?.trialSessionsRemaining || 0);
}

export function isPurchasedSessionsSourceStatus(status?: string | null): boolean {
  return status === InvoiceStatus.APPROVED || status === InvoiceStatus.PAID;
}

export function getPurchasedSessionsForInvoice(invoice?: Partial<InvoiceDocument> | null): number {
  if (!invoice || invoice.invoiceType !== InvoiceType.TUITION) {
    return 0;
  }

  return Math.max(0, Number(invoice.sessions || 0)) + Math.max(0, Number(invoice.bonusSessions || 0)) + Math.max(0, Number((invoice as any).trialSessions || 0));
}

export function getInvoiceStudentId(invoice?: Partial<InvoiceDocument> | null): string | null {
  const studentId = invoice?.studentId as Types.ObjectId | string | undefined;
  if (!studentId) {
    return null;
  }
  return studentId.toString();
}

export function isFinanciallyLockedInvoice(
  invoice?: any,
): boolean {
  if (!invoice) {
    return false;
  }

  const status = String(invoice.status || '');
  return (
    status === InvoiceStatus.PAID ||
    (invoice as any).isReconciled === true ||
    Boolean((invoice as any).reconciledAt) ||
    Boolean((invoice as any).financiallyLocked)
  );
}

export function buildInvoiceClawbackReason(invoiceNumber: string, reason?: string): string {
  const trimmedReason = reason?.trim();
  return trimmedReason
    ? `[CLAWBACK] Invoice ${invoiceNumber}: ${trimmedReason}`
    : `[CLAWBACK] Invoice ${invoiceNumber}: financial rollback required`;
}

export function mapPaymentRoundToCourseStatus(round: number): string {
  if (round <= 1) return InvoiceCourseStatus.NEW;
  if (round === 2) return InvoiceCourseStatus.CONTINUE_1;
  if (round === 3) return InvoiceCourseStatus.CONTINUE_2;
  if (round === 4) return InvoiceCourseStatus.CONTINUE_3;
  if (round === 5) return InvoiceCourseStatus.CONTINUE_4;
  return InvoiceCourseStatus.CONTINUE_5;
}
