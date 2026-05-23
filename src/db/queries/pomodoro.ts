import { db } from "@/db/client";
import { pomodoroSessions, pomodoroCategories } from "@/db/schema";
import { and, asc, between, eq, gte, lte } from "drizzle-orm";
import {
  addDays,
  formatLocalYMD,
  todayLocal,
  type DateString,
} from "@/lib/dates";
import { pomoUnits } from "@/lib/pomodoro-meta";
import { computePomodoroStatus } from "@/lib/pomodoro-status";
import type { JournalStatus } from "@/lib/journal-status";

export type PomoSession = typeof pomodoroSessions.$inferSelect;

export type DayTotals = {
  count: number;
  minutes: number;
  pomos: number;
};

export type DayCategoryAgg = {
  categoryId: string | null;
  name: string;
  color: string;
  emoji: string | null;
  count: number;
  minutes: number;
  pomos: number;
};

export type PomodoroDay = {
  date: DateString;
  sessions: Array<PomoSession & { category: { name: string; color: string; emoji: string | null } | null }>;
  totals: DayTotals;
  byCategory: DayCategoryAgg[];
};

export async function getPomodoroDay(date: DateString): Promise<PomodoroDay> {
  const rows = await db
    .select({
      session: pomodoroSessions,
      catName: pomodoroCategories.name,
      catColor: pomodoroCategories.color,
      catEmoji: pomodoroCategories.emoji,
    })
    .from(pomodoroSessions)
    .leftJoin(
      pomodoroCategories,
      eq(pomodoroSessions.categoryId, pomodoroCategories.id),
    )
    .where(eq(pomodoroSessions.date, date))
    .orderBy(asc(pomodoroSessions.startedAt));

  const sessions = rows.map((r) => ({
    ...r.session,
    category: r.catName
      ? { name: r.catName, color: r.catColor!, emoji: r.catEmoji }
      : null,
  }));

  const totals: DayTotals = { count: 0, minutes: 0, pomos: 0 };
  const byCatMap = new Map<string, DayCategoryAgg>();

  for (const s of sessions) {
    totals.count += 1;
    totals.minutes += s.durationMin;
    totals.pomos += pomoUnits(s.durationMin);

    const key = s.categoryId ?? "_none";
    const agg = byCatMap.get(key) ?? {
      categoryId: s.categoryId ?? null,
      name: s.category?.name ?? "Uncategorized",
      color: s.category?.color ?? "#64748b",
      emoji: s.category?.emoji ?? null,
      count: 0,
      minutes: 0,
      pomos: 0,
    };
    agg.count += 1;
    agg.minutes += s.durationMin;
    agg.pomos += pomoUnits(s.durationMin);
    byCatMap.set(key, agg);
  }

  // Hour-of-day bucketing is intentionally NOT computed here — server runtime
  // (Vercel UTC) would bucket by UTC hour, not the user's local hour.
  // day-stats-card.tsx + insights/_components/hour-histogram.tsx aggregate
  // hours client-side from sessions[].startedAt so the browser TZ wins.

  return {
    date,
    sessions,
    totals,
    byCategory: Array.from(byCatMap.values()).sort((a, b) => b.minutes - a.minutes),
  };
}

export type PomodoroDailyRow = {
  date: DateString;
  count: number;
  minutes: number;
  pomos: number;
  byCategory: Map<string, DayCategoryAgg>;
};

export type HourSample = {
  startedAt: Date;
  durationMin: number;
};

export type PomodoroWindow = {
  start: DateString;
  end: DateString;
  daily: PomodoroDailyRow[];
  totals: DayTotals;
  topCategories: DayCategoryAgg[];
  /** Raw start times for client-side hour-of-day bucketing (TZ-correct). */
  hourSamples: HourSample[];
  longestSession: PomoSession | null;
  activeDates: Set<DateString>;
};

export async function getPomodoroWindow(rangeDays: number): Promise<PomodoroWindow> {
  const end = todayLocal();
  const start = addDays(end, -(rangeDays - 1));

  const rows = await db
    .select({
      session: pomodoroSessions,
      catName: pomodoroCategories.name,
      catColor: pomodoroCategories.color,
      catEmoji: pomodoroCategories.emoji,
    })
    .from(pomodoroSessions)
    .leftJoin(
      pomodoroCategories,
      eq(pomodoroSessions.categoryId, pomodoroCategories.id),
    )
    .where(between(pomodoroSessions.date, start, end))
    .orderBy(asc(pomodoroSessions.date), asc(pomodoroSessions.startedAt));

  const dailyMap = new Map<DateString, PomodoroDailyRow>();
  for (let i = 0; i < rangeDays; i++) {
    const d = addDays(start, i);
    dailyMap.set(d, { date: d, count: 0, minutes: 0, pomos: 0, byCategory: new Map() });
  }

  const totals: DayTotals = { count: 0, minutes: 0, pomos: 0 };
  const topMap = new Map<string, DayCategoryAgg>();
  const hourSamples: HourSample[] = [];
  let longest: PomoSession | null = null;
  const activeDates = new Set<DateString>();

  for (const r of rows) {
    const s = r.session;
    activeDates.add(s.date);
    const row = dailyMap.get(s.date);
    if (!row) continue;

    const units = pomoUnits(s.durationMin);
    row.count += 1;
    row.minutes += s.durationMin;
    row.pomos += units;

    const key = s.categoryId ?? "_none";
    const name = r.catName ?? "Uncategorized";
    const color = r.catColor ?? "#64748b";
    const emoji = r.catEmoji ?? null;

    let dayCat = row.byCategory.get(key);
    if (!dayCat) {
      dayCat = {
        categoryId: s.categoryId ?? null,
        name,
        color,
        emoji,
        count: 0,
        minutes: 0,
        pomos: 0,
      };
      row.byCategory.set(key, dayCat);
    }
    dayCat.count += 1;
    dayCat.minutes += s.durationMin;
    dayCat.pomos += units;

    let topCat = topMap.get(key);
    if (!topCat) {
      topCat = {
        categoryId: s.categoryId ?? null,
        name,
        color,
        emoji,
        count: 0,
        minutes: 0,
        pomos: 0,
      };
      topMap.set(key, topCat);
    }
    topCat.count += 1;
    topCat.minutes += s.durationMin;
    topCat.pomos += units;

    totals.count += 1;
    totals.minutes += s.durationMin;
    totals.pomos += units;

    hourSamples.push({ startedAt: s.startedAt, durationMin: s.durationMin });

    if (!longest || s.durationMin > longest.durationMin) longest = s;
  }

  const daily = Array.from(dailyMap.values()).sort((a, b) =>
    a.date < b.date ? -1 : a.date > b.date ? 1 : 0,
  );
  const topCategories = Array.from(topMap.values()).sort(
    (a, b) => b.minutes - a.minutes,
  );

  return {
    start,
    end,
    daily,
    totals,
    topCategories,
    hourSamples,
    longestSession: longest,
    activeDates,
  };
}

export async function getPomodoroMonthStatus(
  start: DateString,
  end: DateString,
): Promise<Record<DateString, JournalStatus>> {
  const rows = await db
    .select({
      date: pomodoroSessions.date,
      durationMin: pomodoroSessions.durationMin,
    })
    .from(pomodoroSessions)
    .where(
      and(gte(pomodoroSessions.date, start), lte(pomodoroSessions.date, end)),
    );

  const perDate = new Map<DateString, { pomos: number; any: boolean }>();
  for (const r of rows) {
    const entry = perDate.get(r.date) ?? { pomos: 0, any: false };
    entry.pomos += pomoUnits(r.durationMin);
    entry.any = true;
    perDate.set(r.date, entry);
  }
  const out: Record<DateString, JournalStatus> = {};
  for (const [date, agg] of perDate) {
    out[date] = computePomodoroStatus({ pomos: agg.pomos, hadAny: agg.any });
  }
  return out;
}

/** Distinct dates (sorted ASC) that have at least one session. Used for streak math. */
export async function getAllSessionDates(): Promise<DateString[]> {
  const rows = await db
    .select({ date: pomodoroSessions.date })
    .from(pomodoroSessions);
  const set = new Set<DateString>();
  for (const r of rows) set.add(r.date);
  return Array.from(set).sort();
}

// Re-export the helper for callers that need a clean signature.
export { formatLocalYMD };
