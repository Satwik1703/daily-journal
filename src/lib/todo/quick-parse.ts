// Pure natural-language quick-add parser (TickTick-style). NO db / framework
// imports — fully unit-testable. Caller passes `today` (todayLocal()) so the
// function stays deterministic.
//
// Recognized inline tokens, stripped from the resulting title:
//   priority   !  / !!  / !!!   or  !low | !med | !medium | !high
//   tag        #tag
//   list       ~listname  or  ~"multi word"
//   date       today, tomorrow/tom/tmr, tonight, yesterday, <weekday>,
//              next <weekday>, next week, in N days/weeks,
//              "Jun 19" / "19 Jun" / "june 19", YYYY-MM-DD
//   time       3pm, 3:30pm, 9 am, 15:00, "at 3pm"

import { addDays, formatLocalYMD, parseDate, type DateString } from "@/lib/dates";

export interface ParsedQuickAdd {
  title: string;
  priority: number; // 0..3
  dueDate: DateString | null;
  dueTime: string | null; // "HH:MM"
  listName: string | null;
  tags: string[];
}

const WEEKDAYS: Record<string, number> = {
  sun: 0, sunday: 0,
  mon: 1, monday: 1,
  tue: 2, tues: 2, tuesday: 2,
  wed: 3, weds: 3, wednesday: 3,
  thu: 4, thur: 4, thurs: 4, thursday: 4,
  fri: 5, friday: 5,
  sat: 6, saturday: 6,
};

const MONTHS: Record<string, number> = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2,
  apr: 3, april: 3, may: 4, jun: 5, june: 5, jul: 6, july: 6,
  aug: 7, august: 7, sep: 8, sept: 8, september: 8, oct: 9, october: 9,
  nov: 10, november: 10, dec: 11, december: 11,
};

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Days until the next occurrence of weekday `target` strictly after `today` (1..7). */
function daysUntilWeekday(today: DateString, target: number): number {
  const dow = parseDate(today).getDay();
  const diff = (target - dow + 7) % 7;
  return diff === 0 ? 7 : diff;
}

/** Normalize a 12h/24h time match to "HH:MM". Returns null if out of range. */
function normalizeTime(hourStr: string, minStr: string | undefined, ap: string | undefined): string | null {
  let h = parseInt(hourStr, 10);
  const m = minStr ? parseInt(minStr, 10) : 0;
  if (isNaN(h) || isNaN(m) || m > 59) return null;
  if (ap) {
    const a = ap.toLowerCase();
    if (h < 1 || h > 12) return null;
    if (a === "pm" && h !== 12) h += 12;
    if (a === "am" && h === 12) h = 0;
  } else if (h > 23) {
    return null;
  }
  return `${pad2(h)}:${pad2(m)}`;
}

export function parseQuickAdd(input: string, today: DateString): ParsedQuickAdd {
  let rest = ` ${input} `; // pad so (^|\s) boundaries are uniform
  const tags: string[] = [];
  let priority = 0;
  let listName: string | null = null;
  let dueDate: DateString | null = null;
  let dueTime: string | null = null;

  // Helper: replace a matched slice with a single space.
  const strip = (re: RegExp, onMatch: (m: RegExpExecArray) => boolean) => {
    let m: RegExpExecArray | null;
    re.lastIndex = 0;
    const keep: string[] = [];
    let last = 0;
    while ((m = re.exec(rest)) !== null) {
      if (onMatch(m)) {
        keep.push(rest.slice(last, m.index), " ");
        last = m.index + m[0].length;
      }
      if (m.index === re.lastIndex) re.lastIndex++;
    }
    keep.push(rest.slice(last));
    rest = keep.join("");
  };

  // --- tags: #word ---
  strip(/(?:^|\s)#([\p{L}\d_-]+)/gu, (m) => {
    tags.push(m[1].toLowerCase());
    return true;
  });

  // --- list: ~"multi word" or ~word ---
  strip(/(?:^|\s)~(?:"([^"]+)"|([\p{L}\d_-]+))/gu, (m) => {
    if (listName) return false; // keep first only
    listName = (m[1] ?? m[2]).trim();
    return true;
  });

  // --- priority: !high|!medium|!med|!low or !!!/!!/! ---
  strip(/(?:^|\s)!(high|h|medium|med|m|low|l|[1-3]|!{0,2})(?=\s)/gi, (m) => {
    const t = m[1].toLowerCase();
    let p: number;
    if (t === "high" || t === "h" || t === "3" || t === "!!") p = 3;
    else if (t === "medium" || t === "med" || t === "m" || t === "2" || t === "!") p = 2;
    else p = 1; // low | l | 1 | "" (single bang)
    priority = p;
    return true;
  });

  // --- explicit numeric date YYYY-MM-DD ---
  strip(/(?:^|\s)(\d{4}-\d{2}-\d{2})(?=\s)/g, (m) => {
    if (dueDate) return false;
    const d = parseDate(m[1]);
    if (isNaN(d.getTime())) return false;
    dueDate = m[1];
    return true;
  });

  // --- month-day: "jun 19" / "june 19" / "19 jun" / "19 june" ---
  const monthNames = Object.keys(MONTHS).join("|");
  strip(new RegExp(`(?:^|\\s)(${monthNames})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?(?=\\s)`, "gi"), (m) => {
    if (dueDate) return false;
    return (dueDate = monthDay(today, MONTHS[m[1].toLowerCase()], parseInt(m[2], 10))) != null;
  });
  strip(new RegExp(`(?:^|\\s)(\\d{1,2})(?:st|nd|rd|th)?\\s+(${monthNames})\\.?(?=\\s)`, "gi"), (m) => {
    if (dueDate) return false;
    return (dueDate = monthDay(today, MONTHS[m[2].toLowerCase()], parseInt(m[1], 10))) != null;
  });

  // --- relative words ---
  let tonight = false;
  strip(/(?:^|\s)(today|tonight|tomorrow|tmr|tom|yesterday)(?=\s)/gi, (m) => {
    if (dueDate) return false;
    const t = m[1].toLowerCase();
    if (t === "today") dueDate = today;
    else if (t === "tonight") { dueDate = today; tonight = true; }
    else if (t === "yesterday") dueDate = addDays(today, -1);
    else dueDate = addDays(today, 1); // tomorrow/tmr/tom
    return true;
  });

  // "in N days" / "in N weeks"
  strip(/(?:^|\s)in\s+(\d{1,3})\s+(day|days|week|weeks)(?=\s)/gi, (m) => {
    if (dueDate) return false;
    const n = parseInt(m[1], 10);
    dueDate = addDays(today, m[2].toLowerCase().startsWith("week") ? n * 7 : n);
    return true;
  });

  // "next week"
  strip(/(?:^|\s)next\s+week(?=\s)/gi, () => {
    if (dueDate) return false;
    dueDate = addDays(today, 7);
    return true;
  });

  // "next <weekday>" and bare "<weekday>"
  const wdNames = Object.keys(WEEKDAYS).join("|");
  strip(new RegExp(`(?:^|\\s)(?:next\\s+)?(${wdNames})(?=\\s)`, "gi"), (m) => {
    if (dueDate) return false;
    dueDate = addDays(today, daysUntilWeekday(today, WEEKDAYS[m[1].toLowerCase()]));
    return true;
  });

  // --- time: "at 3pm", "3:30pm", "9 am", "15:00" ---
  strip(/(?:^|\s)(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)(?=\s)/gi, (m) => {
    if (dueTime) return false;
    const t = normalizeTime(m[1], m[2], m[3]);
    if (!t) return false;
    dueTime = t;
    return true;
  });
  strip(/(?:^|\s)(?:at\s+)?([01]?\d|2[0-3]):([0-5]\d)(?=\s)/g, (m) => {
    if (dueTime) return false;
    const t = normalizeTime(m[1], m[2], undefined);
    if (!t) return false;
    dueTime = t;
    return true;
  });

  if (tonight && !dueTime) dueTime = "21:00";
  // A time with no date implies today.
  if (dueTime && !dueDate) dueDate = today;

  const title = rest.replace(/\s+/g, " ").trim();
  return { title, priority, dueDate, dueTime, listName, tags };
}

/** Resolve a month/day to a DateString, rolling to next year if already past. */
function monthDay(today: DateString, month: number, day: number): DateString | null {
  if (day < 1 || day > 31) return null;
  const t = parseDate(today);
  let year = t.getFullYear();
  let candidate = new Date(year, month, day);
  if (candidate.getMonth() !== month) return null; // invalid day for month
  if (candidate < new Date(t.getFullYear(), t.getMonth(), t.getDate())) {
    year += 1;
    candidate = new Date(year, month, day);
  }
  return formatLocalYMD(candidate);
}
