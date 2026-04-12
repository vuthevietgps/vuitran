import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { AttendanceStatus, COUNTED_ATTENDANCE_STATUSES } from './schemas/attendance.schema';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { Classroom } from '../classes/schemas/class.schema';
import { Student } from '../students/schemas/student.schema';
import { Role } from '../common/interfaces/role.enum';

export type StudentLean = Student & { _id: Types.ObjectId };
export type ClassLean = Classroom & { _id: Types.ObjectId };
export const OFFLINE_MIN_TEACHER_PAYOUT = 200_000;

export interface AttendancePermissionsSnapshot {
  canBulkEdit: boolean;
  canGenerateLink: boolean;
  blockedReason: string | null;
  substituteActive: boolean;
  substituteTeacherId: string | null;
  activeTeacherId: string | null;
}

export interface CoTeacherAttendanceConfig {
  teacherId: string;
  role?: string | null;
  canManageAttendance?: boolean;
  canManageReports?: boolean;
  canCreateLink?: boolean;
}

export function getUserId(user: JwtPayload): string {
  return user?.sub ?? user?._id;
}

export function isCountedAttendanceStatus(status?: AttendanceStatus | null): boolean {
  return !!status && COUNTED_ATTENDANCE_STATUSES.includes(status);
}

export function normalizeInteractiveAttendanceStatus(
  status?: AttendanceStatus | null,
): AttendanceStatus | null {
  if (status === undefined) {
    return AttendanceStatus.PRESENT;
  }
  return status ?? null;
}

export function normalizeBulkAttendanceStatus(
  status?: AttendanceStatus | null,
): AttendanceStatus | null {
  return status ?? null;
}

export function isTeacher(user: JwtPayload): boolean {
  return user?.role === Role.TEACHER;
}

export function hasFullAccess(user: JwtPayload): boolean {
  return [Role.DIRECTOR, Role.OPS].includes(user?.role as Role);
}

export function getOpsCheckerId(user: JwtPayload): Types.ObjectId | null {
  if (![Role.DIRECTOR, Role.OPS].includes(user?.role as Role)) {
    return null;
  }
  return new Types.ObjectId(getUserId(user));
}

export function assertClassAccess(
  classroom: ClassLean | null,
  user: JwtPayload,
  date?: Date,
): asserts classroom is ClassLean {
  if (!classroom) throw new NotFoundException('Khong tim thay lop hoc');
  if (hasFullAccess(user)) return;
  if (isTeacher(user)) {
    const uid = getUserId(user);
    const tid = classroom.teacher?.toString();
    if (tid && tid === uid) return;
    if (getCoTeacherInfo(classroom, user)) return;

    if (date) {
      const subs = (classroom as any).substituteTeachers || [];
      const d = new Date(
        Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
      );
      const activeSub = subs.find((s: any) => {
        if (s.teacherId?.toString() !== uid) return false;
        const from = new Date(s.fromDate);
        from.setUTCHours(0, 0, 0, 0);
        const to = new Date(s.toDate);
        to.setUTCHours(23, 59, 59, 999);
        return d >= from && d <= to;
      });
      if (activeSub) return;
    }

    throw new ForbiddenException(
      'Ban khong phu trach lop hoc nay va khong co quyen day thay cho ngay nay',
    );
  }

  throw new ForbiddenException('Ban khong co quyen truy cap lop hoc nay');
}

export function getActiveSubstituteForDate(
  classroom: ClassLean,
  date: Date,
): { teacherId: string; payRate: number; canCreateLink: boolean } | null {
  const subs = (classroom as any).substituteTeachers || [];
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const active = subs.find((s: any) => {
    const teacherId = s?.teacherId?.toString();
    if (!teacherId) return false;
    const from = new Date(s.fromDate);
    from.setUTCHours(0, 0, 0, 0);
    const to = new Date(s.toDate);
    to.setUTCHours(23, 59, 59, 999);
    return d >= from && d <= to;
  });

  if (!active?.teacherId) return null;
  return {
    teacherId: active.teacherId.toString(),
    payRate: active.payRate ?? 0,
    canCreateLink: active.canCreateLink ?? true,
  };
}

export function getSubstituteInfo(
  classroom: ClassLean,
  user: JwtPayload,
  date: Date,
): { teacherId: string; payRate: number; canCreateLink: boolean } | null {
  if (!isTeacher(user)) return null;
  const uid = getUserId(user);
  if (classroom.teacher?.toString() === uid) return null;
  const active = getActiveSubstituteForDate(classroom, date);
  if (!active || active.teacherId !== uid) return null;
  return active;
}

export function getCoTeacherInfo(
  classroom: ClassLean,
  user: JwtPayload,
): CoTeacherAttendanceConfig | null {
  if (!isTeacher(user)) return null;
  const uid = getUserId(user);
  const coTeachers = Array.isArray((classroom as any)?.coTeachers) ? (classroom as any).coTeachers : [];
  const entry = coTeachers.find((teacher: any) => teacher?.teacherId?.toString() === uid);
  if (!entry?.teacherId) return null;
  return {
    teacherId: entry.teacherId.toString(),
    role: entry.role ?? null,
    canManageAttendance: entry.canManageAttendance !== false,
    canManageReports: entry.canManageReports !== false,
    canCreateLink: entry.canCreateLink !== false,
  };
}

export function getAttendancePermissions(
  classroom: ClassLean,
  user: JwtPayload,
  date: Date,
): AttendancePermissionsSnapshot {
  const activeSubstitute = getActiveSubstituteForDate(classroom, date);
  const coTeacherInfo = getCoTeacherInfo(classroom, user);

  if (hasFullAccess(user)) {
    return {
      canBulkEdit: true,
      canGenerateLink: true,
      blockedReason: null,
      substituteActive: !!activeSubstitute,
      substituteTeacherId: activeSubstitute?.teacherId ?? null,
      activeTeacherId: activeSubstitute?.teacherId ?? classroom.teacher?.toString() ?? null,
    };
  }

  if (!isTeacher(user)) {
    return {
      canBulkEdit: false,
      canGenerateLink: false,
      blockedReason: 'Ban khong co quyen thao tac diem danh cho lop hoc nay.',
      substituteActive: !!activeSubstitute,
      substituteTeacherId: activeSubstitute?.teacherId ?? null,
      activeTeacherId: activeSubstitute?.teacherId ?? classroom.teacher?.toString() ?? null,
    };
  }

  const userId = getUserId(user);
  const isPrimaryTeacher = classroom.teacher?.toString() === userId;
  if (isPrimaryTeacher) {
    const primaryBlockedBySubstitute =
      !!activeSubstitute && activeSubstitute.teacherId !== userId;
    return {
      canBulkEdit: false,
      canGenerateLink: !primaryBlockedBySubstitute,
      blockedReason: primaryBlockedBySubstitute
        ? 'Ngay nay da co giao vien day thay phu trach diem danh. Giao vien chinh khong duoc tao link diem danh.'
        : null,
      substituteActive: !!activeSubstitute,
      substituteTeacherId: activeSubstitute?.teacherId ?? null,
      activeTeacherId: primaryBlockedBySubstitute
        ? activeSubstitute?.teacherId ?? null
        : userId,
    };
  }

  if (coTeacherInfo) {
    const canBulkEdit = !!coTeacherInfo.canManageAttendance;
    const canGenerateLink = !!coTeacherInfo.canCreateLink || canBulkEdit;
    return {
      canBulkEdit,
      canGenerateLink,
      blockedReason: canBulkEdit
        ? null
        : 'Giao vien dong giang khong duoc phep thao tac diem danh.',
      substituteActive: !!activeSubstitute,
      substituteTeacherId: activeSubstitute?.teacherId ?? null,
      activeTeacherId: userId,
    };
  }

  const substituteInfo = getSubstituteInfo(classroom, user, date);
  if (substituteInfo) {
    return {
      canBulkEdit: false,
      canGenerateLink: substituteInfo.canCreateLink,
      blockedReason: substituteInfo.canCreateLink
        ? null
        : 'Giao vien day thay khong duoc OPS cap quyen tao link diem danh.',
      substituteActive: true,
      substituteTeacherId: substituteInfo.teacherId,
      activeTeacherId: substituteInfo.teacherId,
    };
  }

  return {
    canBulkEdit: false,
    canGenerateLink: false,
    blockedReason: 'Ban khong phu trach lop hoc nay va khong co quyen day thay cho ngay nay.',
    substituteActive: !!activeSubstitute,
    substituteTeacherId: activeSubstitute?.teacherId ?? null,
    activeTeacherId: activeSubstitute?.teacherId ?? classroom.teacher?.toString() ?? null,
  };
}

export function resolveAttendanceTeacherId(
  classroom: ClassLean,
  user: JwtPayload,
  date: Date,
): Types.ObjectId {
  if (isTeacher(user)) {
    return new Types.ObjectId(getUserId(user));
  }

  const classTeacherId = (classroom as any).teacher?.toString();
  if (!classTeacherId) {
    throw new BadRequestException('Lop hoc chua co giao vien phu trach');
  }

  return new Types.ObjectId(classTeacherId);
}
