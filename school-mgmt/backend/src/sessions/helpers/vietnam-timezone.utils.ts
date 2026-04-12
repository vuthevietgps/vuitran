export const VIETNAM_TIME_ZONE = 'Asia/Ho_Chi_Minh';
export const VIETNAM_OFFSET_HOURS = 7;
export const VIETNAM_OFFSET_MS = VIETNAM_OFFSET_HOURS * 60 * 60 * 1000;

const HOUR_MS = 60 * 60 * 1000;

function shiftToVietnamClock(date: Date): Date {
  return new Date(date.getTime() + VIETNAM_OFFSET_MS);
}

function shiftFromVietnamClock(date: Date): Date {
  return new Date(date.getTime() - VIETNAM_OFFSET_MS);
}

export function addVietnamHours(baseDate: Date, hours: number): Date {
  const shifted = shiftToVietnamClock(baseDate);
  shifted.setUTCHours(shifted.getUTCHours() + hours);
  return shiftFromVietnamClock(shifted);
}

export function calculateTeachingReportDeadline(
  scheduledDate: Date,
  deadlineHours = 24,
): Date {
  return addVietnamHours(scheduledDate, deadlineHours);
}

export function calculateVietnamLateHours(submittedAt: Date, deadline: Date): number {
  const submitted = shiftToVietnamClock(submittedAt);
  const due = shiftToVietnamClock(deadline);
  const diffMs = submitted.getTime() - due.getTime();
  return diffMs > 0 ? Math.floor(diffMs / HOUR_MS) : 0;
}

export function calculateVietnamHoursBefore(
  scheduledDate: Date,
  scheduledStartTime?: string,
  now: Date = new Date(),
): number {
  const sessionStart = shiftToVietnamClock(scheduledDate);
  if (scheduledStartTime) {
    const [hours, minutes] = scheduledStartTime.split(':').map(Number);
    sessionStart.setUTCHours(hours, minutes, 0, 0);
  } else {
    sessionStart.setUTCHours(0, 0, 0, 0);
  }

  const current = shiftToVietnamClock(now);
  return (sessionStart.getTime() - current.getTime()) / HOUR_MS;
}
