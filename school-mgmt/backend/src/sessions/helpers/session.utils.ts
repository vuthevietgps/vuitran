import { Types } from 'mongoose';
import { SessionStatus, SessionType } from '../schemas/session.schema';
import { calculateVietnamHoursBefore } from './vietnam-timezone.utils';

// ─── ObjectId helpers ───────────────────────────────────────────────

export function objectIdToString(value: any): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (value instanceof Types.ObjectId) return value.toString();
  if (value?._id) return objectIdToString(value._id);
  if (typeof value.toString === 'function') {
    const str = value.toString();
    return str && str !== '[object Object]' ? str : null;
  }
  return null;
}

// ─── Number / Money helpers ─────────────────────────────────────────

export function toSafeNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function roundTo2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function roundTo4(value: number): number {
  return Math.round(value * 10000) / 10000;
}

export function roundMoneyToThousand(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.round(value / 1000) * 1000;
}

export function roundMoneyDownToThousand(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.floor(value / 1000) * 1000;
}

export function floorSessionCount(value: number): number {
  const normalized = Number.isFinite(value) ? value : 0;
  return normalized > 0 ? Math.floor(normalized) : 0;
}

// ─── Error / Text helpers ───────────────────────────────────────────

export function extractErrorMessage(err: unknown): string {
  if (typeof err === 'string') return err;
  if (err instanceof Error) return err.message;
  if (err && typeof (err as any).message === 'string') {
    return (err as any).message;
  }
  return 'Unknown error';
}

export function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export function isWalletInsufficientError(err: unknown): boolean {
  const normalized = normalizeText(extractErrorMessage(err));
  return (
    normalized.includes('gioi han no') ||
    normalized.includes('can nap them tien') ||
    normalized.includes('insufficient') ||
    normalized.includes('not enough')
  );
}

// ─── Session status helpers ─────────────────────────────────────────

export function shouldKeepZeroTeacherPayout(session: { status?: SessionStatus | string }): boolean {
  return [
    SessionStatus.CANCELLED,
    SessionStatus.NO_SHOW,
    SessionStatus.RESCHEDULED,
  ].includes(session.status as SessionStatus);
}

// ─── Time helpers ───────────────────────────────────────────────────

export function isTimeOverlap(
  start1: string,
  end1: string,
  start2: string,
  end2: string,
): boolean {
  const toMinutes = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };
  const s1 = toMinutes(start1);
  const e1 = toMinutes(end1);
  const s2 = toMinutes(start2);
  const e2 = toMinutes(end2);
  return s1 < e2 && s2 < e1;
}

export function calcHoursBefore(scheduledDate: Date, scheduledStartTime?: string): number {
  return calculateVietnamHoursBefore(scheduledDate, scheduledStartTime);
}

// ─── History / Display helpers ──────────────────────────────────────

export function formatDateForHistory(value: unknown): string {
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return emptyHistoryValue();
  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const year = date.getUTCFullYear();
  return `${day}/${month}/${year}`;
}

export function emptyHistoryValue(): string {
  return 'Khong co';
}

export function formatSessionTypeLabel(value?: string | null): string {
  const labels: Record<string, string> = {
    [SessionType.REGULAR]: 'Buoi hoc thuong',
    [SessionType.TRIAL]: 'Buoi hoc thu',
    [SessionType.MAKE_UP]: 'Buoi hoc bu',
    [SessionType.EXAM_PREP]: 'On thi',
    [SessionType.REVIEW]: 'On tap',
    [SessionType.EXTRA]: 'Buoi hoc them',
  };
  if (!value) return emptyHistoryValue();
  return labels[value] || value;
}

export function getSessionEditFieldLabel(field: string): string {
  const labels: Record<string, string> = {
    teacherId: 'Giao vien',
    scheduledDate: 'Ngay hoc',
    scheduledStartTime: 'Gio bat dau',
    scheduledEndTime: 'Gio ket thuc',
    durationMinutes: 'Thoi luong',
    sessionType: 'Loai buoi hoc',
    topicsCovered: 'Noi dung',
    homework: 'BTVN',
    teacherNotes: 'Ghi chu GV',
    amountCharged: 'Hoc phi',
    teacherPayout: 'Luong GV',
    autoConfirmAfterHours: 'So gio auto-confirm',
    lessonObjective: 'Muc tieu buoi hoc',
  };
  return labels[field] || field;
}

export function formatSessionHistoryValue(
  field: string,
  value: unknown,
  teacherNameMap: Map<string, string>,
): string {
  if (value === undefined || value === null) {
    return emptyHistoryValue();
  }

  if (typeof value === 'string' && !value.trim()) {
    return emptyHistoryValue();
  }

  switch (field) {
    case 'teacherId': {
      const teacherId = objectIdToString(value);
      if (!teacherId) return emptyHistoryValue();
      return teacherNameMap.get(teacherId) || teacherId;
    }
    case 'scheduledDate':
      return formatDateForHistory(value);
    case 'durationMinutes':
      return `${toSafeNumber(value, 0)} phut`;
    case 'amountCharged':
    case 'teacherPayout':
      return `${toSafeNumber(value, 0).toLocaleString('vi-VN')}d`;
    case 'autoConfirmAfterHours':
      return `${toSafeNumber(value, 0)} gio`;
    case 'sessionType':
      return formatSessionTypeLabel(String(value));
    default:
      return String(value);
  }
}

export function buildShareholderDisplayLabel(prefix: string, code: unknown, fallbackId: unknown): string {
  const normalizedCode = typeof code === 'string' ? code.trim() : '';
  if (normalizedCode) {
    return normalizedCode;
  }

  const id = objectIdToString(fallbackId);
  if (id) {
    return `${prefix} #${id.slice(-6).toUpperCase()}`;
  }

  return `${prefix} #AN_DANH`;
}
