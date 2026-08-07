export const WORKING_STATUS = "Working";
const LOCK_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

// True if the TC selected a duty status within the last 24 hours
export function isDutyLocked(dutyStatusSetAt?: string): boolean {
  if (!dutyStatusSetAt) return false;
  return Date.now() - new Date(dutyStatusSetAt).getTime() < LOCK_DURATION_MS;
}

// True if the TC is currently on REST/Leave/etc. (locked + not Working)
export function isRestrictedDuty(dutyStatus?: string, dutyStatusSetAt?: string): boolean {
  return isDutyLocked(dutyStatusSetAt) && !!dutyStatus && dutyStatus !== WORKING_STATUS;
}