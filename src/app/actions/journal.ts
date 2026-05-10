"use server";

import { db } from "@/db/client";
import { journalEntries } from "@/db/schema";
import { sql } from "drizzle-orm";
import { isValidDateString } from "@/lib/dates";

export type JournalPatch = {
  date: string;
  gratitude1?: string | null;
  gratitude2?: string | null;
  gratitude3?: string | null;
  energy?: number | null;
  mood?: number | null;
  sleepQuality?: number | null;
  tomorrowPlan?: string | null;
  /** Full replacement for the answers JSON map (caller sends the merged result). */
  answers?: Record<string, unknown> | null;
};

function clean<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v;
  }
  return out as Partial<T>;
}

export async function saveJournalEntry(patch: JournalPatch): Promise<{ ok: true; updatedAt: number }> {
  if (!isValidDateString(patch.date)) {
    throw new Error(`Invalid date: ${patch.date}`);
  }

  const { date, ...rest } = patch;
  const fields = clean(rest);

  await db
    .insert(journalEntries)
    .values({
      date,
      ...fields,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: journalEntries.date,
      set: {
        ...fields,
        updatedAt: sql`(unixepoch())`,
      },
    });

  return { ok: true, updatedAt: Math.floor(Date.now() / 1000) };
}
