export interface ResolvedStudentDurationConfig {
  baseDuration: number;
  sessionDuration: number;
  totalSessions: number;
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

export function getCurrentTeacherIdForStudent(classroom: any, studentId: string): string | null {
  const studentConfig = getStudentConfig(classroom, studentId);
  const teacherSlots = Array.isArray(studentConfig?.teacherSlots) ? studentConfig.teacherSlots : [];
  if (teacherSlots.length > 1) {
    return objectIdToString(getCurrentTeacherSlot(studentConfig)?.teacherId) || objectIdToString(classroom?.teacher);
  }
  return objectIdToString(classroom?.teacher) || objectIdToString(getCurrentTeacherSlot(studentConfig)?.teacherId);
}

export function getCurrentDurationForStudent(
  classroom: any,
  studentId: string,
): ResolvedStudentDurationConfig {
  const studentConfig = getStudentConfig(classroom, studentId);
  const durationSlots = Array.isArray(studentConfig?.durationSlots) ? studentConfig.durationSlots : [];
  const currentDurationSlot = getCurrentDurationSlot(studentConfig);
  if (currentDurationSlot && durationSlots.length > 1) {
    return {
      baseDuration: Number(currentDurationSlot.baseDuration || 0) || 60,
      sessionDuration: Number(currentDurationSlot.sessionDuration || 0) || 60,
      totalSessions: Number(currentDurationSlot.totalSessions || 0) || 0,
    };
  }

  return {
    baseDuration: Number(classroom?.baseDuration || classroom?.pricingSnapshot?.referenceDuration || 0) || 60,
    sessionDuration:
      Number(classroom?.sessionDuration || classroom?.pricingSnapshot?.sessionDuration || 0)
      || Number(classroom?.baseDuration || classroom?.pricingSnapshot?.referenceDuration || 0)
      || 60,
    totalSessions: Number(classroom?.totalSessions || 0) || 0,
  };
}

export function getTeacherOwnedStudentIds(classroom: any, teacherId: string): string[] {
  const studentIds = Array.isArray(classroom?.students)
    ? classroom.students
        .map((student: any) => objectIdToString(student))
        .filter((studentId: string | null): studentId is string => !!studentId)
    : [];

  return studentIds.filter((studentId) => getCurrentTeacherIdForStudent(classroom, studentId) === teacherId);
}

export function isTeacherAssignedToStudent(
  classroom: any,
  studentId: string,
  teacherId: string,
): boolean {
  return getCurrentTeacherIdForStudent(classroom, studentId) === teacherId;
}
