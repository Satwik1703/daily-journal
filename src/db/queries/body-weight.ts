import { db } from "@/db/client";
import { bodyWeightLogs } from "@/db/schema";
import { and, asc, between, desc, eq, lte } from "drizzle-orm";
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

export async function getLatestBodyWeight(
  userId: string,
): Promise<BodyWeightEntry | null> {
  const rows = await db
    .select()
    .from(bodyWeightLogs)
    .where(eq(bodyWeightLogs.userId, userId))
    .orderBy(desc(bodyWeightLogs.date), desc(bodyWeightLogs.createdAt))
    .limit(1);
  return rows.length > 0 ? row(rows[0]) : null;
}

export async function getLatestBodyWeightAsOf(
  userId: string,
  asOfDate: DateString,
): Promise<BodyWeightEntry | null> {
  const rows = await db
    .select()
    .from(bodyWeightLogs)
    .where(
      and(eq(bodyWeightLogs.userId, userId), lte(bodyWeightLogs.date, asOfDate)),
    )
    .orderBy(desc(bodyWeightLogs.date), desc(bodyWeightLogs.createdAt))
    .limit(1);
  return rows.length > 0 ? row(rows[0]) : null;
}

export async function getBodyWeightForRange(
  userId: string,
  start: DateString,
  end: DateString,
): Promise<BodyWeightEntry[]> {
  const rows = await db
    .select()
    .from(bodyWeightLogs)
    .where(
      and(
        eq(bodyWeightLogs.userId, userId),
        between(bodyWeightLogs.date, start, end),
      ),
    )
    .orderBy(asc(bodyWeightLogs.date), asc(bodyWeightLogs.createdAt));
  return rows.map(row);
}

export async function getBodyWeightCount(userId: string): Promise<number> {
  const rows = await db
    .select({ id: bodyWeightLogs.id })
    .from(bodyWeightLogs)
    .where(eq(bodyWeightLogs.userId, userId))
    .limit(1);
  return rows.length;
}
