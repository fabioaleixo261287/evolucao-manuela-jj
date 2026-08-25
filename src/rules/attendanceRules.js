import { parseLocalDate } from "../utils/dates.js";

export const ABSENCE_ALERT_DAYS = 7;

export function getStudentPresenceAlertDays(student, today = new Date()) {
  const lastPresence = parseLocalDate(student?.ultimaPresenca);
  if (!lastPresence) return null;
  return Math.floor((today - lastPresence) / 86400000);
}

export function shouldAlertAbsence(student, today = new Date()) {
  const days = getStudentPresenceAlertDays(student, today);
  return days !== null && days >= ABSENCE_ALERT_DAYS;
}
