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

// ---------- Goal periods (week / month / year) ----------

export type GoalPeriod = "week" | "month" | "year";

/** Sunday-anchored start of the calendar week containing s. Matches monthMatrix's Sun-start. */
export function weekStartOf(s: DateString): DateString {
  const d = parseDate(s);
  return addDays(s, -d.getDay());
}

/**
 * ISO 8601 week key: "YYYY-Www". Note the year may differ from the calendar
 * year for early-Jan / late-Dec dates (2026-01-01 → "2025-W53"). Use this for
 * the `periodKey` column on weekly goals so weeks are unambiguous.
 */
export function isoWeekKey(s: DateString): string {
  // Standard ISO algorithm: shift to nearest Thursday, then compute week number.
  const d = parseDate(s);
  // Adjust to Thursday of the same ISO week. ISO: Mon=1..Sun=7. JS: Sun=0..Sat=6.
  const isoDay = d.getDay() === 0 ? 7 : d.getDay();
  d.setDate(d.getDate() + 4 - isoDay);
  const isoYear = d.getFullYear();
  // Week 1 contains Jan 4 by definition.
  const jan4 = new Date(isoYear, 0, 4);
  const jan4IsoDay = jan4.getDay() === 0 ? 7 : jan4.getDay();
  const week1Thu = new Date(isoYear, 0, 4 + (4 - jan4IsoDay));
  const weekNo = 1 + Math.round((d.getTime() - week1Thu.getTime()) / (7 * 86_400_000));
  return `${isoYear}-W${String(weekNo).padStart(2, "0")}`;
}

/** periodKey for a given date and period. */
export function periodKeyFor(s: DateString, period: GoalPeriod): string {
  if (period === "week") return isoWeekKey(s);
  if (period === "month") return s.slice(0, 7);
  return s.slice(0, 4);
}

/**
 * Inverse of periodKeyFor: { start, end } DateStrings (inclusive) for the
 * calendar span covered by a periodKey. For weeks we render Sun→Sat in the UI
 * even though the ISO key is Mon→Sun-anchored; we explicitly use the Sunday of
 * the ISO week's Thursday to keep display consistent with the rest of the app.
 */
export function periodRangeFor(
  key: string,
  period: GoalPeriod,
): { start: DateString; end: DateString } {
  if (period === "year") {
    return { start: `${key}-01-01`, end: `${key}-12-31` };
  }
  if (period === "month") {
    const start = `${key}-01` as DateString;
    const next = shiftMonth(start, 1);
    const end = addDays(next, -1);
    return { start, end };
  }
  // week
  const m = key.match(/^(\d{4})-W(\d{2})$/);
  if (!m) throw new Error(`Invalid week key: ${key}`);
  const isoYear = Number(m[1]);
  const weekNo = Number(m[2]);
  // Find Thursday of the requested ISO week (which determines the week's year).
  const jan4 = new Date(isoYear, 0, 4);
  const jan4IsoDay = jan4.getDay() === 0 ? 7 : jan4.getDay();
  const week1Thu = new Date(isoYear, 0, 4 + (4 - jan4IsoDay));
  const targetThu = new Date(week1Thu.getTime());
  targetThu.setDate(targetThu.getDate() + (weekNo - 1) * 7);
  // Step back to Sunday of that calendar week for display.
  const start = addDays(formatLocalYMD(targetThu), -targetThu.getDay());
  const end = addDays(start, 6);
  return { start, end };
}

/** Number of ISO weeks (52 or 53) in a given calendar year. */
export function weeksInYear(year: number): number {
  // A year has 53 ISO weeks iff Jan 1 or Dec 31 is a Thursday (or in leap years, either).
  const jan1 = new Date(year, 0, 1).getDay();
  const dec31 = new Date(year, 11, 31).getDay();
  return jan1 === 4 || dec31 === 4 ? 53 : 52;
}

/** Step a periodKey by ±N units (negative = past, positive = future). */
export function shiftPeriodKey(key: string, period: GoalPeriod, delta: number): string {
  if (delta === 0) return key;
  const { start } = periodRangeFor(key, period);
  if (period === "year") {
    return String(Number(key) + delta);
  }
  if (period === "month") {
    return shiftMonth(start, delta).slice(0, 7);
  }
  // Week: our display range is Sun-start, but Sunday belongs to the
  // *previous* ISO week (ISO weeks end on Sunday), so shifting from `start`
  // by 7 days lands inside the same ISO week. Pivot off the period's
  // Thursday — it's always unambiguously in the current ISO week.
  const thu = addDays(start, 4);
  return isoWeekKey(addDays(thu, delta * 7));
}

export const prevPeriodAnchor = (key: string, period: GoalPeriod) =>
  shiftPeriodKey(key, period, -1);
export const nextPeriodAnchor = (key: string, period: GoalPeriod) =>
  shiftPeriodKey(key, period, 1);

/**
 * Enumerate ISO week keys from `currentKey` through the chosen end horizon.
 * Inclusive on both ends. Stops at the last week whose Thursday lies within
 * the horizon (ISO weeks belong to the year/month of their Thursday).
 *
 *   enumerateWeeksThrough("2026-W21", "endOfYear", "2026")  → ~32 keys
 *   enumerateWeeksThrough("2026-W21", "endOfMonth", "2026-08") → ~14 keys
 *
 * Returns [currentKey] only if the end is before the current week. Caller
 * is responsible for surfacing that as an error if it matters.
 */
export function enumerateWeeksThrough(
  currentKey: string,
  endKind: "endOfMonth" | "endOfYear",
  endRef: string,
): string[] {
  let endDate: DateString;
  if (endKind === "endOfYear") {
    if (!/^\d{4}$/.test(endRef)) throw new Error(`endRef for endOfYear must be YYYY: ${endRef}`);
    endDate = `${endRef}-12-31`;
  } else {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(endRef)) {
      throw new Error(`endRef for endOfMonth must be YYYY-MM: ${endRef}`);
    }
    const { end } = periodRangeFor(endRef, "month");
    endDate = end;
  }
  const out: string[] = [currentKey];
  let k = currentKey;
  // Safety bound: never enumerate more than ~110 weeks.
  for (let i = 0; i < 110; i++) {
    const next = shiftPeriodKey(k, "week", 1);
    // Next week's Thursday is the canonical "which year/month does it belong to" anchor.
    const nextStart = periodRangeFor(next, "week").start;
    const nextThursday = addDays(nextStart, 4);
    if (nextThursday > endDate) break;
    out.push(next);
    k = next;
  }
  return out;
}

/** Quick format helper for human-readable period labels. */
export function formatPeriodRange(key: string, period: GoalPeriod): string {
  if (period === "year") return key;
  const { start, end } = periodRangeFor(key, period);
  if (period === "month") {
    return `${MONTHS[parseDate(start).getMonth()]} ${parseDate(start).getFullYear()}`;
  }
  // week
  const a = parseDate(start);
  const b = parseDate(end);
  const sameMonth = a.getMonth() === b.getMonth();
  const left = `${MONTHS_SHORT[a.getMonth()]} ${a.getDate()}`;
  const right = sameMonth
    ? `${b.getDate()}`
    : `${MONTHS_SHORT[b.getMonth()]} ${b.getDate()}`;
  return `${left} – ${right}, ${b.getFullYear()}`;
}
