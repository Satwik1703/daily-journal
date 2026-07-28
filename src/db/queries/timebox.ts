import { and, asc, desc, eq, gte, isNull, lte, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { timeboxCategories, timeboxSlots } from "@/db/schema";
import { DEFAULT_TIMEBOX_CATEGORIES, type LabelStat, type TimeboxCategory, type TimeboxSlot } from "@/lib/timebox-meta";
import { nanoid } from "nanoid";

function toCategory(r: typeof timeboxCategories.$inferSelect): TimeboxCategory {
  return {
    id: r.id,
    name: r.name,
    emoji: r.emoji,
    color: r.color,
    position: r.position,
    pomoCategoryId: r.pomoCategoryId,
  };
}

function toSlot(r: typeof timeboxSlots.$inferSelect): TimeboxSlot {
  return {
    slotIndex: r.slotIndex,
    categoryId: r.categoryId,
    label: r.label,
    note: r.note,
    source: r.source as TimeboxSlot["source"],
  };
}

/**
 * Lazy-seed the 8 default categories on first read. Idempotent — only
 * inserts when the user has zero categories. Runs as part of
 * getTimeboxCategories.
 */
async function seedDefaultCategoriesIfEmpty(userId: string): Promise<void> {
  const count = await db
    .select({ n: sql<number>`count(*)` })
    .from(timeboxCategories)
    .where(eq(timeboxCategories.userId, userId));
  if ((count[0]?.n ?? 0) > 0) return;
  for (let i = 0; i < DEFAULT_TIMEBOX_CATEGORIES.length; i++) {
    const d = DEFAULT_TIMEBOX_CATEGORIES[i];
    await db.insert(timeboxCategories).values({
      id: nanoid(12),
      userId,
      name: d.name,
      emoji: d.emoji,
      color: d.color,
      position: i,
    });
  }
}

export async function getTimeboxCategories(
  userId: string,
): Promise<TimeboxCategory[]> {
  await seedDefaultCategoriesIfEmpty(userId);
  const rows = await db
    .select()
    .from(timeboxCategories)
    .where(
      and(
        eq(timeboxCategories.userId, userId),
        isNull(timeboxCategories.archivedAt),
      ),
    )
    .orderBy(asc(timeboxCategories.position), asc(timeboxCategories.name));
  return rows.map(toCategory);
}

export async function getTimeboxSlotsForDate(
  userId: string,
  date: string,
): Promise<TimeboxSlot[]> {
  const rows = await db
    .select()
    .from(timeboxSlots)
    .where(and(eq(timeboxSlots.userId, userId), eq(timeboxSlots.date, date)))
    .orderBy(asc(timeboxSlots.slotIndex));
  return rows.map(toSlot);
}

/**
 * Preloaded label stats for the client-side autocomplete. Uses the last 90
 * days of manual entries. Keeps to ~200 labels max to keep the payload
 * lean; long-tail labels get pruned.
 */
export async function getLabelStats(
  userId: string,
  windowDays = 90,
): Promise<LabelStat[]> {
  const cutoffTs = Math.floor((Date.now() - windowDays * 86400_000) / 1000);
  const rows = await db
    .select({
      label: timeboxSlots.label,
      categoryId: timeboxSlots.categoryId,
      slotIndex: timeboxSlots.slotIndex,
      updatedAt: timeboxSlots.updatedAt,
    })
    .from(timeboxSlots)
    .where(
      and(
        eq(timeboxSlots.userId, userId),
        sql`${timeboxSlots.label} IS NOT NULL`,
        sql`length(trim(${timeboxSlots.label})) > 0`,
        gte(sql`unixepoch(${timeboxSlots.updatedAt})`, cutoffTs),
      ),
    );

  type Bucket = {
    label: string;
    count: number;
    lastUsedTs: number;
    catCounts: Map<string, number>;
    slotCounts: Map<number, number>;
  };
  const byLabel = new Map<string, Bucket>();

  for (const r of rows) {
    const label = (r.label ?? "").trim();
    if (!label) continue;
    const key = label.toLowerCase();
    let b = byLabel.get(key);
    if (!b) {
      b = {
        label,
        count: 0,
        lastUsedTs: 0,
        catCounts: new Map(),
        slotCounts: new Map(),
      };
      byLabel.set(key, b);
    }
    b.count += 1;
    const ts =
      r.updatedAt instanceof Date ? r.updatedAt.getTime() : Number(r.updatedAt) * 1000;
    if (ts > b.lastUsedTs) b.lastUsedTs = ts;
    if (r.categoryId) {
      b.catCounts.set(r.categoryId, (b.catCounts.get(r.categoryId) ?? 0) + 1);
    }
    b.slotCounts.set(r.slotIndex, (b.slotCounts.get(r.slotIndex) ?? 0) + 1);
  }

  const stats: LabelStat[] = [];
  for (const b of byLabel.values()) {
    let bestCat: string | null = null;
    let bestCatN = 0;
    for (const [k, v] of b.catCounts) {
      if (v > bestCatN) {
        bestCatN = v;
        bestCat = k;
      }
    }
    let bestSlot = 0;
    let bestSlotN = 0;
    for (const [k, v] of b.slotCounts) {
      if (v > bestSlotN) {
        bestSlotN = v;
        bestSlot = k;
      }
    }
    stats.push({
      label: b.label,
      count: b.count,
      lastUsedTs: b.lastUsedTs,
      mostCommonCategoryId: bestCat,
      mostCommonSlotIndex: bestSlot,
    });
  }

  stats.sort((a, b) => b.count - a.count || b.lastUsedTs - a.lastUsedTs);
  return stats.slice(0, 200);
}

/**
 * Pomo sessions overlapping a given date. Client uses these to compute
 * ghost overlays. Server just returns raw times + category ids; snapping
 * happens client-side via pomoSlotsCovered.
 */
export async function getPomoSessionsForDate(
  userId: string,
  date: string,
): Promise<
  Array<{
    id: string;
    startedAt: number;
    durationMin: number;
    categoryId: string | null;
    categoryName: string | null;
    description: string | null;
  }>
> {
  const { pomodoroSessions, pomodoroCategories } = await import("@/db/schema");
  const rows = await db
    .select({
      s: pomodoroSessions,
      catName: pomodoroCategories.name,
    })
    .from(pomodoroSessions)
    .leftJoin(pomodoroCategories, eq(pomodoroSessions.categoryId, pomodoroCategories.id))
    .where(
      and(
        eq(pomodoroSessions.userId, userId),
        eq(pomodoroSessions.date, date),
      ),
    )
    .orderBy(asc(pomodoroSessions.startedAt));
  return rows.map((r) => ({
    id: r.s.id,
    startedAt:
      r.s.startedAt instanceof Date ? r.s.startedAt.getTime() : Number(r.s.startedAt),
    durationMin: r.s.durationMin,
    categoryId: r.s.categoryId,
    categoryName: r.catName ?? null,
    description: r.s.description,
  }));
}

/** Status map for the date-stepper calendar popover.
 *  Buckets by how many of the 48 slots have a manual fill (auto-pomo
 *  ghosts don't count — that would make every day look "logged"). */
export type TimeboxDayStatus =
  | "crazy"
  | "great"
  | "good"
  | "avg"
  | "bad"
  | "empty";
export async function getTimeboxMonthStatus(
  userId: string,
  start: string,
  end: string,
): Promise<Record<string, TimeboxDayStatus>> {
  const rows = await db
    .select({
      date: timeboxSlots.date,
      n: sql<number>`count(*)`,
    })
    .from(timeboxSlots)
    .where(
      and(
        eq(timeboxSlots.userId, userId),
        eq(timeboxSlots.source, "manual"),
        gte(timeboxSlots.date, start),
        lte(timeboxSlots.date, end),
      ),
    )
    .groupBy(timeboxSlots.date);
  const out: Record<string, TimeboxDayStatus> = {};
  for (const r of rows) {
    const n = r.n ?? 0;
    if (n >= 30) out[r.date] = "crazy";
    else if (n >= 20) out[r.date] = "great";
    else if (n >= 10) out[r.date] = "good";
    else if (n >= 3) out[r.date] = "avg";
    else out[r.date] = "bad";
  }
  return out;
}

/** Insights: hours per category over a window. Grouped in JS. */
export async function getTimeboxRangeAgg(
  userId: string,
  start: string,
  end: string,
): Promise<{
  byCategoryPerDay: Array<{ date: string; totals: Record<string, number> }>;
  totalMinutes: number;
  totalsPerCategory: Record<string, number>;
}> {
  const rows = await db
    .select({
      date: timeboxSlots.date,
      categoryId: timeboxSlots.categoryId,
    })
    .from(timeboxSlots)
    .where(
      and(
        eq(timeboxSlots.userId, userId),
        eq(timeboxSlots.source, "manual"),
        gte(timeboxSlots.date, start),
        lte(timeboxSlots.date, end),
      ),
    );

  const perDay = new Map<string, Map<string, number>>();
  const totals = new Map<string, number>();
  let totalMinutes = 0;
  const UNCAT = "__uncat__";
  for (const r of rows) {
    const k = r.categoryId ?? UNCAT;
    let d = perDay.get(r.date);
    if (!d) {
      d = new Map();
      perDay.set(r.date, d);
    }
    d.set(k, (d.get(k) ?? 0) + 30);
    totals.set(k, (totals.get(k) ?? 0) + 30);
    totalMinutes += 30;
  }
  const byCategoryPerDay = Array.from(perDay.entries())
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([date, m]) => ({ date, totals: Object.fromEntries(m) }));
  return {
    byCategoryPerDay,
    totalMinutes,
    totalsPerCategory: Object.fromEntries(totals),
  };
}
