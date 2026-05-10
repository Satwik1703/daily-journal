/**
 * Local-time date helpers. The journal stores one entry per *calendar* day
 * in the user's local timezone. Never use UTC ISO formatting for entry keys —
 * a 00:30 entry would land in the wrong day.
 */

export type DateString = string; // YYYY-MM-DD

export function todayLocal(): DateString {
  return formatLocalYMD(new Date());
}

export function formatLocalYMD(d: Date): DateString {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseDate(s: DateString): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function isValidDateString(s: unknown): s is DateString {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(parseDate(s).getTime());
}

export function addDays(s: DateString, n: number): DateString {
  const d = parseDate(s);
  d.setDate(d.getDate() + n);
  return formatLocalYMD(d);
}

export function daysBetween(a: DateString, b: DateString): number {
  const ms = parseDate(b).getTime() - parseDate(a).getTime();
  return Math.round(ms / 86_400_000);
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export function formatHumanDate(s: DateString): string {
  const d = parseDate(s);
  return `${WEEKDAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

/** "Mar 04" — short tooltip format. */
export function formatShortDate(s: DateString): string {
  const d = parseDate(s);
  return `${MONTHS_SHORT[d.getMonth()]} ${String(d.getDate()).padStart(2, "0")}`;
}

/** YYYY-MM key for the month containing a date. */
export function monthKeyOf(s: DateString): string {
  return s.slice(0, 7);
}

/** First day of the month containing a date. */
export function firstOfMonth(s: DateString): DateString {
  return `${s.slice(0, 7)}-01`;
}

/** Shift a date by N calendar months (anchor falls on the 1st of the resulting month). */
export function shiftMonth(s: DateString, delta: number): DateString {
  const d = parseDate(firstOfMonth(s));
  d.setMonth(d.getMonth() + delta);
  return formatLocalYMD(d);
}

/** Sun-start 6-row 42-cell matrix of dates covering the month of `s`. */
export function monthMatrix(s: DateString): DateString[] {
  const first = parseDate(firstOfMonth(s));
  const startOffset = first.getDay(); // 0 = Sun
  const start = addDays(formatLocalYMD(first), -startOffset);
  const out: DateString[] = [];
  for (let i = 0; i < 42; i++) out.push(addDays(start, i));
  return out;
}
