export interface ResolvedStudentDurationConfig {
  baseDuration: number;
  sessionDuration: number;
  totalSessions: number;
}

export interface ResolvedClassPricingConfig extends ResolvedStudentDurationConfig {
  pricePerSession: number;
  teacherPayPerSession: number;
  teacherPayPerStudent: number;
  perMinuteRate: number;
}

function toComparableTime(value?: Date | string | null): number | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  const time = date.getTime();
  return Number.isFinite(time) ? time : null;
}

export function objectIdToString(value: any): string | null {
  return value?._id?.toString?.() || value?.toString?.() || null;
}

export function getStudentConfig(classroom: any, studentId: string) {
  const configs = Array.isArray(classroom?.studentConfigs) ? classroom.studentConfigs : [];
  return configs.find((config: any) => objectIdToString(config?.studentId) === studentId) || null;
}

export function getCurrentTeacherSlot(studentConfig: any) {
  const teacherSlots = Array.isArray(studentConfig?.teacherSlots)
    ? [...studentConfig.teacherSlots]
    : [];
  teacherSlots.sort((left: any, right: any) => Number(left?.slotIndex || 0) - Number(right?.slotIndex || 0));
  return teacherSlots.at(-1) || null;
}

export function getCurrentDurationSlot(studentConfig: any) {
  const durationSlots = Array.isArray(studentConfig?.durationSlots)
    ? [...studentConfig.durationSlots]
    : [];
  durationSlots.sort((left: any, right: any) => Number(left?.slotIndex || 0) - Number(right?.slotIndex || 0));
  return durationSlots.at(-1) || null;
}

export function getTeacherSlotForStudentAt(classroom: any, studentId: string, effectiveAt?: Date | string | null) {
  const studentConfig = getStudentConfig(classroom, studentId);
  const teacherSlots = Array.isArray(studentConfig?.teacherSlots)
    ? [...studentConfig.teacherSlots]
    : [];
  if (!teacherSlots.length) {
    return null;
  }

  teacherSlots.sort((left: any, right: any) => {
    const leftTime = toComparableTime(left?.assignedAt) ?? 0;
    const rightTime = toComparableTime(right?.assignedAt) ?? 0;
    if (leftTime === rightTime) {
      return Number(left?.slotIndex || 0) - Number(right?.slotIndex || 0);
    }
    return leftTime - rightTime;
  });

  const targetTime = toComparableTime(effectiveAt);
  if (targetTime === null) {
    return teacherSlots.at(-1) || null;
  }

  const eligibleSlots = teacherSlots.filter((slot: any) => {
    const assignedAt = toComparableTime(slot?.assignedAt);
    return assignedAt === null || assignedAt <= targetTime;
  });
  return eligibleSlots.at(-1) || teacherSlots[0] || null;
}

export function getDurationSlotForStudentAt(classroom: any, studentId: string, effectiveAt?: Date | string | null) {
  const studentConfig = getStudentConfig(classroom, studentId);
  const durationSlots = Array.isArray(studentConfig?.durationSlots)
    ? [...studentConfig.durationSlots]
    : [];
  if (!durationSlots.length) {
    return null;
  }

  durationSlots.sort((left: any, right: any) => {
    const leftTime = toComparableTime(left?.effectiveAt) ?? 0;
    const rightTime = toComparableTime(right?.effectiveAt) ?? 0;
    if (leftTime === rightTime) {
      return Number(left?.slotIndex || 0) - Number(right?.slotIndex || 0);
    }
    return leftTime - rightTime;
  });

  const targetTime = toComparableTime(effectiveAt);
  if (targetTime === null) {
    return durationSlots.at(-1) || null;
  }

  const eligibleSlots = durationSlots.filter((slot: any) => {
    const slotTime = toComparableTime(slot?.effectiveAt);
    return slotTime === null || slotTime <= targetTime;
  });
  return eligibleSlots.at(-1) || durationSlots[0] || null;
}

export function getClassDurationSnapshotAt(classroom: any, effectiveAt?: Date | string | null) {
  const durationSnapshots = Array.isArray(classroom?.durationSnapshots)
    ? [...classroom.durationSnapshots]
    : [];
  if (!durationSnapshots.length) {
    return null;
  }

  durationSnapshots.sort((left: any, right: any) => {
    const leftTime = toComparableTime(left?.effectiveAt) ?? 0;
    const rightTime = toComparableTime(right?.effectiveAt) ?? 0;
    return leftTime - rightTime;
  });

  const targetTime = toComparableTime(effectiveAt);
  if (targetTime === null) {
    return durationSnapshots.at(-1) || null;
  }

  const eligibleSnapshots = durationSnapshots.filter((snapshot: any) => {
    const snapshotTime = toComparableTime(snapshot?.effectiveAt);
    return snapshotTime === null || snapshotTime <= targetTime;
  });

  return eligibleSnapshots.at(-1) || durationSnapshots[0] || null;
}

export function getClassPricingConfigAt(
  classroom: any,
  effectiveAt?: Date | string | null,
): ResolvedClassPricingConfig {
  const pricingSnapshot = classroom?.pricingSnapshot || {};
  const fallbackPricePerSession =
    Number(classroom?.pricePerSession || 0)
    || Number(pricingSnapshot.pricePerSession || 0)
    || 0;
  const fallbackTeacherPayPerSession =
    Number(classroom?.teacherPayPerSession || 0)
    || Number(pricingSnapshot.teacherPayPerSession || 0)
    || 0;
  const fallbackTeacherPayPerStudent =
    Number(classroom?.teacherPayPerStudent || 0)
    || Number(pricingSnapshot.teacherPayPerStudent || 0)
    || 0;

  const durationSnapshot = getClassDurationSnapshotAt(classroom, effectiveAt);
  if (durationSnapshot) {
    const baseDuration = Number(durationSnapshot.baseDuration || 0) || 60;
    const sessionDuration = Number(durationSnapshot.sessionDuration || 0) || baseDuration;
    const pricePerSession = Number(durationSnapshot.pricePerSession || 0) || fallbackPricePerSession;
    const teacherPayPerSession =
      Number(durationSnapshot.teacherPayPerSession || 0) || fallbackTeacherPayPerSession;
    const teacherPayPerStudent =
      Number(durationSnapshot.teacherPayPerStudent || 0) || fallbackTeacherPayPerStudent;
    return {
      baseDuration,
      sessionDuration,
      totalSessions: Number(classroom?.totalSessions || 0) || 0,
      pricePerSession,
      teacherPayPerSession,
      teacherPayPerStudent,
      perMinuteRate: baseDuration > 0 ? pricePerSession / baseDuration : 0,
    };
  }

  const baseDuration =
    Number(classroom?.baseDuration || 0)
    || Number(pricingSnapshot.referenceDuration || 0)
    || 60;
  const sessionDuration =
    Number(classroom?.sessionDuration || 0)
    || Number(pricingSnapshot.sessionDuration || 0)
    || baseDuration;
  const pricePerSession = fallbackPricePerSession;
  const teacherPayPerSession = fallbackTeacherPayPerSession;
  const teacherPayPerStudent = fallbackTeacherPayPerStudent;
  const perMinuteRate =
    Number(pricingSnapshot.perMinuteRate || 0)
    || (baseDuration > 0 ? pricePerSession / baseDuration : 0);

  return {
    baseDuration,
    sessionDuration,
    totalSessions: Number(classroom?.totalSessions || 0) || 0,
    pricePerSession,
    teacherPayPerSession,
    teacherPayPerStudent,
    perMinuteRate,
  };
}

export function getTeacherIdForStudentAt(
  classroom: any,
  studentId: string,
  effectiveAt?: Date | string | null,
): string | null {
  const slotTeacherId = objectIdToString(
    getTeacherSlotForStudentAt(classroom, studentId, effectiveAt)?.teacherId,
  );
  return slotTeacherId || objectIdToString(classroom?.teacher) || null;
}

export function getDurationForStudentAt(
  classroom: any,
  studentId: string,
  effectiveAt?: Date | string | null,
): ResolvedStudentDurationConfig {
  const durationSlot = getDurationSlotForStudentAt(classroom, studentId, effectiveAt);
  if (durationSlot) {
    return {
      baseDuration: Number(durationSlot.baseDuration || 0) || 60,
      sessionDuration: Number(durationSlot.sessionDuration || 0) || 60,
      totalSessions: Number(durationSlot.totalSessions || 0) || 0,
    };
  }

  const classPricing = getClassPricingConfigAt(classroom, effectiveAt);
  return {
    baseDuration: classPricing.baseDuration,
    sessionDuration: classPricing.sessionDuration,
    totalSessions: classPricing.totalSessions,
  };
}

export function getCurrentTeacherIdForStudent(classroom: any, studentId: string): string | null {
  return getTeacherIdForStudentAt(classroom, studentId);
}

export function getCurrentDurationForStudent(
  classroom: any,
  studentId: string,
): ResolvedStudentDurationConfig {
  return getDurationForStudentAt(classroom, studentId);
}

export function getTeacherOwnedStudentIdsAt(
  classroom: any,
  teacherId: string,
  effectiveAt?: Date | string | null,
): string[] {
  const studentIds = Array.isArray(classroom?.students)
    ? classroom.students
        .map((student: any) => objectIdToString(student))
        .filter((studentId: string | null): studentId is string => !!studentId)
    : [];

  return studentIds.filter((studentId) =>
    getTeacherIdForStudentAt(classroom, studentId, effectiveAt) === teacherId,
  );
}

export function getTeacherOwnedStudentIds(classroom: any, teacherId: string): string[] {
  return getTeacherOwnedStudentIdsAt(classroom, teacherId);
}

export function isTeacherAssignedToStudentAt(
  classroom: any,
  studentId: string,
  teacherId: string,
  effectiveAt?: Date | string | null,
): boolean {
  return getTeacherIdForStudentAt(classroom, studentId, effectiveAt) === teacherId;
}

export function isTeacherAssignedToStudent(
  classroom: any,
  studentId: string,
  teacherId: string,
): boolean {
  return isTeacherAssignedToStudentAt(classroom, studentId, teacherId);
}
