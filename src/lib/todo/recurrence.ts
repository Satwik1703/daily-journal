// Pure recurrence rules for todos. No db/framework imports — unit-testable.
// Stored on todos.repeatJson as JSON.stringify(RepeatRule).

import { addDays, formatLocalYMD, parseDate, type DateString } from "@/lib/dates";

export type RepeatFreq = "daily" | "weekly" | "monthly" | "yearly";

export interface RepeatRule {
  freq: RepeatFreq;
  interval: number; // >= 1
  byDay?: number[]; // weekly only: 0=Sun … 6=Sat
  mode: "dueDate" | "completion"; // advance from the due date, or from completion day
  ends?: { type: "never" | "on" | "after"; date?: DateString; count?: number };
}

const FREQS: RepeatFreq[] = ["daily", "weekly", "monthly", "yearly"];

/** Validate + normalize an untrusted value into a RepeatRule (or null). */
export function parseRule(raw: unknown): RepeatRule | null {
  let obj: unknown = raw;
  if (typeof raw === "string") {
    try {
      obj = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!obj || typeof obj !== "object") return null;
  const r = obj as Record<string, unknown>;
  if (!FREQS.includes(r.freq as RepeatFreq)) return null;
  const interval = Math.max(1, Math.floor(Number(r.interval) || 1));
  const mode = r.mode === "completion" ? "completion" : "dueDate";
  let byDay: number[] | undefined;
  if (Array.isArray(r.byDay)) {
    byDay = [...new Set(r.byDay.map((n) => Number(n)).filter((n) => n >= 0 && n <= 6))].sort();
    if (byDay.length === 0) byDay = undefined;
  }
  let ends: RepeatRule["ends"];
  const e = r.ends as Record<string, unknown> | undefined;
  if (e && (e.type === "on" || e.type === "after")) {
    ends =
      e.type === "on"
        ? { type: "on", date: typeof e.date === "string" ? e.date : undefined }
        : { type: "after", count: Math.max(1, Math.floor(Number(e.count) || 1)) };
  } else {
    ends = { type: "never" };
  }
  return { freq: r.freq as RepeatFreq, interval, byDay, mode, ends };
}

function addMonths(d: DateString, n: number): DateString {
  const dt = parseDate(d);
  const day = dt.getDate();
  const target = new Date(dt.getFullYear(), dt.getMonth() + n, 1);
  // Clamp day to the target month's length.
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(day, lastDay));
  return formatLocalYMD(target);
}

/** The next occurrence strictly after `from`, per the rule. */
export function nextOccurrence(rule: RepeatRule, from: DateString): DateString {
  switch (rule.freq) {
    case "daily":
      return addDays(from, rule.interval);
    case "weekly": {
      if (rule.byDay && rule.byDay.length) {
        // Next day after `from` whose weekday is in byDay (interval ignored for byDay).
        for (let i = 1; i <= 7; i++) {
          const cand = addDays(from, i);
          if (rule.byDay.includes(parseDate(cand).getDay())) return cand;
        }
        return addDays(from, 7);
      }
      return addDays(from, 7 * rule.interval);
    }
    case "monthly":
      return addMonths(from, rule.interval);
    case "yearly":
      return addMonths(from, 12 * rule.interval);
  }
}

/**
 * Given a rule, the base date to advance from, and how many occurrences have
 * already been completed (including the one just completed), return the next
 * due date — or null if the series has ended.
 */
export function advanceOrEnd(
  rule: RepeatRule,
  from: DateString,
  completedCount: number,
): DateString | null {
  const next = nextOccurrence(rule, from);
  const ends = rule.ends ?? { type: "never" };
  if (ends.type === "after" && ends.count != null && completedCount >= ends.count) return null;
  if (ends.type === "on" && ends.date && next > ends.date) return null;
  return next;
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Short human label, e.g. "Every 2 weeks", "Weekly on Mon, Wed". */
export function describeRule(rule: RepeatRule): string {
  const each = rule.interval > 1 ? `${rule.interval} ` : "";
  let base: string;
  switch (rule.freq) {
    case "daily":
      base = rule.interval > 1 ? `Every ${rule.interval} days` : "Daily";
      break;
    case "weekly":
      if (rule.byDay && rule.byDay.length) {
        base = `Weekly on ${rule.byDay.map((d) => DAY_NAMES[d]).join(", ")}`;
      } else {
        base = rule.interval > 1 ? `Every ${each}weeks` : "Weekly";
      }
      break;
    case "monthly":
      base = rule.interval > 1 ? `Every ${rule.interval} months` : "Monthly";
      break;
    case "yearly":
      base = rule.interval > 1 ? `Every ${rule.interval} years` : "Yearly";
      break;
  }
  if (rule.ends?.type === "after") base += `, ${rule.ends.count}×`;
  if (rule.ends?.type === "on" && rule.ends.date) base += `, until ${rule.ends.date}`;
  return base;
}
