import { db } from "@/db/client";
import { bodyWeightLogs } from "@/db/schema";
import { asc, between, desc, lte } from "drizzle-orm";
import type { DateString } from "@/lib/dates";

export type BodyWeightEntry = {
  id: string;
  date: DateString;
  weightKg: number;
  note: string | null;
  createdAt: number;
};

function row(r: typeof bodyWeightLogs.$inferSelect): BodyWeightEntry {
  return {
    id: r.id,
    date: r.date,
    weightKg: r.weightKg,
    note: r.note,
    createdAt: r.createdAt.getTime(),
  };
}

export async function getLatestBodyWeight(): Promise<BodyWeightEntry | null> {
  const rows = await db
    .select()
    .from(bodyWeightLogs)
    .orderBy(desc(bodyWeightLogs.date), desc(bodyWeightLogs.createdAt))
    .limit(1);
  return rows.length > 0 ? row(rows[0]) : null;
}

/**
 * Most recent entry whose `date <= asOfDate`. Used by the daily gym page so
 * that browsing back in time shows the weight from that period, not today's.
 */
export async function getLatestBodyWeightAsOf(
  asOfDate: DateString,
): Promise<BodyWeightEntry | null> {
  const rows = await db
    .select()
    .from(bodyWeightLogs)
    .where(lte(bodyWeightLogs.date, asOfDate))
    .orderBy(desc(bodyWeightLogs.date), desc(bodyWeightLogs.createdAt))
    .limit(1);
  return rows.length > 0 ? row(rows[0]) : null;
}

export async function getBodyWeightForRange(
  start: DateString,
  end: DateString,
): Promise<BodyWeightEntry[]> {
  const rows = await db
    .select()
    .from(bodyWeightLogs)
    .where(between(bodyWeightLogs.date, start, end))
    .orderBy(asc(bodyWeightLogs.date), asc(bodyWeightLogs.createdAt));
  return rows.map(row);
}

export async function getBodyWeightCount(): Promise<number> {
  const rows = await db.select({ id: bodyWeightLogs.id }).from(bodyWeightLogs).limit(1);
  return rows.length;
}
