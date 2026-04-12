import {
  ClassEditHistoryEntry,
  ClassItem,
  ClassMember,
  StudentClassConfig,
  StudentDurationSlot,
  StudentTeacherSlot,
} from '../services/class.service';
import { InvoiceItem } from '../services/invoice.service';
import { ProductItem } from '../services/product.service';
import { TeacherProfile } from '../services/teacher.service';
import { UserItem } from '../services/user.service';

export function roundMoneyToThousand(value?: number): number {
  const normalized = Number(value || 0);
  if (!Number.isFinite(normalized) || normalized === 0) return 0;
  return Math.round(normalized / 1000) * 1000;
}

export function roundMoneyDownToThousand(value?: number): number {
  const normalized = Number(value || 0);
  if (!Number.isFinite(normalized) || normalized === 0) return 0;
  return normalized > 0
    ? Math.floor(normalized / 1000) * 1000
    : Math.ceil(normalized / 1000) * 1000;
}

export function formatCurrency(amount?: number): string {
  if (!amount && amount !== 0) return '-';
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(roundMoneyToThousand(amount));
}

export function formatTeacherCurrency(amount?: number): string {
  if (!amount && amount !== 0) return '-';
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(roundMoneyDownToThousand(amount));
}

export function getProfitClass(profit?: number): string {
  if (!profit && profit !== 0) return '';
  if (profit > 0) return 'profit-positive';
  if (profit < 0) return 'profit-negative';
  return 'profit-zero';
}

export function isOfflineClass(c: ClassItem): boolean {
  return (c.classMode || 'ONLINE') === 'OFFLINE';
}

export function formatTeacherBase(c: ClassItem): string {
  if (isOfflineClass(c)) {
    return `${formatTeacherCurrency(c.teacherPayPerStudent)} / HS`;
  }
  return formatTeacherCurrency(c.teacherPayPerSession);
}

export function formatTeacherActual(c: ClassItem): string {
  if (isOfflineClass(c)) return 'Theo diem danh (min 200k)';
  return formatTeacherCurrency(c.actualTeacherPayPerSession ?? c.teacherPayPerSession);
}

export function getClassProfit(c: ClassItem): number {
  if (typeof c.profit === 'number') return c.profit;

  if (isOfflineClass(c)) {
    const studentCount = c.studentCount ?? c.students?.length ?? 0;
    const pricePerStudent = c.actualPricePerSession ?? c.pricePerSession ?? 0;
    const teacherPerStudent = c.teacherPayPerStudent ?? 0;
    return (pricePerStudent * studentCount) - (teacherPerStudent * studentCount);
  }

  const price = c.actualPricePerSession ?? c.pricePerSession ?? 0;
  const pay = c.actualTeacherPayPerSession ?? c.teacherPayPerSession ?? 0;
  return price - pay;
}

export function calcProportional(
  basePrice: number | undefined,
  targetDuration: number,
  baseDuration: number,
  defaultBaseDuration: number,
): number {
  if (!basePrice) return 0;
  const base = baseDuration || defaultBaseDuration;
  return roundMoneyToThousand(basePrice * (targetDuration / base));
}

export function calcTeacherProportional(
  basePay: number | undefined,
  targetDuration: number,
  baseDuration: number,
  defaultBaseDuration: number,
): number {
  if (!basePay) return 0;
  const base = baseDuration || defaultBaseDuration;
  return Math.floor((basePay * (targetDuration / base)) / 1000) * 1000;
}

export function formatSessionCount(value?: number): string {
  if (!value && value !== 0) return '-';
  const normalized = Number(value);
  if (!Number.isFinite(normalized)) return '-';
  return Math.max(Math.floor(normalized), 0).toLocaleString('vi-VN');
}

export function formatHistoryTimestamp(value?: string): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('vi-VN');
}

export function classHistoryActionLabel(action?: ClassEditHistoryEntry['action']): string {
  switch (action) {
    case 'SALE_DIRECT_UPDATED':
      return 'Sale cap nhat truc tiep';
    case 'SALE_REQUESTED':
      return 'Sale gui yeu cau';
    case 'APPROVED':
      return 'Da phe duyet';
    case 'REJECTED':
      return 'Da tu choi';
    case 'MANAGER_UPDATED':
      return 'Director/Ops cap nhat';
    default:
      return 'Cap nhat lop hoc';
  }
}

export function getInvoiceClassId(invoice: InvoiceItem): string | null {
  const classId = invoice.classId;
  if (!classId) return null;
  return typeof classId === 'string' ? classId : classId._id || null;
}

export function matchesProductMode(
  product: ProductItem | undefined | null,
  classMode: 'ONLINE' | 'OFFLINE',
): product is ProductItem {
  if (!product || product.isActive === false) {
    return false;
  }
  const teachingMode = (product.teachingMode || 'BOTH').toUpperCase();
  return teachingMode === 'BOTH' || teachingMode === classMode;
}

export function pendingClassChanges(classItem: ClassItem | null | undefined) {
  return classItem?.pendingSaleUpdate?.changeSummary || [];
}

export function classEditHistory(classItem: ClassItem | null | undefined): ClassEditHistoryEntry[] {
  return [...(classItem?.editHistory || [])].sort((left, right) => {
    const leftTime = new Date(left.editedAt || '').getTime();
    const rightTime = new Date(right.editedAt || '').getTime();
    return rightTime - leftTime;
  });
}

export function mapTeacherProfileToUserItem(profile: TeacherProfile): UserItem | null {
  const user = typeof profile.userId === 'string' ? null : profile.userId;
  const teacherId = user?._id || (typeof profile.userId === 'string' ? profile.userId : '');
  const fullName = user?.fullName?.trim() || '';
  const email = user?.email?.trim() || '';

  if (!teacherId || !fullName || !email) {
    return null;
  }

  return {
    _id: teacherId,
    userCode: user?.userCode,
    fullName,
    email,
    phone: user?.phone,
    role: 'TEACHER',
    status: profile.status,
  };
}

// --- Student config helpers ---

export function getStudentConfig(classItem: ClassItem | null, studentId: string): StudentClassConfig | null {
  if (!classItem?.studentConfigs?.length) {
    return null;
  }
  return classItem.studentConfigs.find((config) => {
    const configuredStudentId =
      typeof config.studentId === 'string'
        ? config.studentId
        : config.studentId?._id;
    return configuredStudentId === studentId;
  }) || null;
}

export function sortTeacherSlots(slots?: StudentTeacherSlot[] | null): StudentTeacherSlot[] {
  return [...(slots || [])].sort((left, right) => left.slotIndex - right.slotIndex);
}

export function sortDurationSlots(slots?: StudentDurationSlot[] | null): StudentDurationSlot[] {
  return [...(slots || [])].sort((left, right) => left.slotIndex - right.slotIndex);
}

export function resolveMemberId(member?: ClassMember | string | null): string {
  if (!member) return '';
  return typeof member === 'string' ? member : member._id;
}

export function resolveMemberName(member?: ClassMember | string | null, teachers?: UserItem[]): string {
  if (!member) return '';
  if (typeof member !== 'string') {
    return member.fullName || '';
  }
  return teachers?.find((teacher) => teacher._id === member)?.fullName || '';
}

export function getCurrentTeacherSlot(classItem: ClassItem, studentId: string): StudentTeacherSlot | null {
  const slots = sortTeacherSlots(getStudentConfig(classItem, studentId)?.teacherSlots);
  return slots.length ? slots[slots.length - 1] : null;
}

export function getCurrentDurationSlot(classItem: ClassItem, studentId: string): StudentDurationSlot | null {
  const slots = sortDurationSlots(getStudentConfig(classItem, studentId)?.durationSlots);
  return slots.length ? slots[slots.length - 1] : null;
}

export function getCurrentStudentTeacherId(classItem: ClassItem, studentId: string): string {
  return resolveMemberId(getCurrentTeacherSlot(classItem, studentId)?.teacherId) || classItem.teacher?._id || '';
}

export function getCurrentStudentDuration(
  classItem: ClassItem,
  studentId: string,
  defaultBaseDuration: number,
): StudentDurationSlot {
  const current = getCurrentDurationSlot(classItem, studentId);
  if (current) {
    return current;
  }
  return {
    slotIndex: 1,
    slotType: 'INITIAL',
    baseDuration: classItem.baseDuration || defaultBaseDuration,
    sessionDuration: classItem.sessionDuration || classItem.baseDuration || defaultBaseDuration,
    totalSessions: classItem.totalSessions || 0,
  };
}

export function getTeacherSlotDisplay(slot: StudentTeacherSlot, teachers?: UserItem[]): string {
  return resolveMemberName(slot.teacherId, teachers) || 'Chua gan giao vien';
}

export function getStudentTeacherDisplay(
  classItem: ClassItem,
  studentId: string,
  teachers?: UserItem[],
): string {
  const currentSlot = getCurrentTeacherSlot(classItem, studentId);
  const currentTeacherName = resolveMemberName(currentSlot?.teacherId, teachers) || classItem.teacher?.fullName || 'Chua co';
  const slotLabel = currentSlot?.slotIndex || 1;
  return `GV${slotLabel}: ${currentTeacherName}`;
}

export function getStudentDurationDisplay(
  classItem: ClassItem,
  studentId: string,
  defaultBaseDuration: number,
): string {
  const currentDuration = getCurrentStudentDuration(classItem, studentId, defaultBaseDuration);
  return `Lan ${currentDuration.slotIndex}: ${currentDuration.sessionDuration} phut`;
}

export function getStudentTotalSessions(
  classItem: ClassItem,
  studentId: string,
  defaultBaseDuration: number,
): number {
  return getCurrentStudentDuration(classItem, studentId, defaultBaseDuration).totalSessions;
}
