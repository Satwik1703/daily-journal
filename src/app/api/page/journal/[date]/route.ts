import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { journalEntries } from "@/db/schema";
import { eq } from "drizzle-orm";
import { isValidDateString } from "@/lib/dates";
import { getActiveQuestions } from "@/db/queries/journal-questions";
import { getTasksForDate } from "@/db/queries/journal-tasks";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ date: string }> },
) {
  const { date } = await ctx.params;
  if (!isValidDateString(date)) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }

  const [rows, questions, tasks] = await Promise.all([
    db.select().from(journalEntries).where(eq(journalEntries.date, date)).limit(1),
    getActiveQuestions(),
    getTasksForDate(date),
  ]);
  const entry = rows[0] ?? null;

  return NextResponse.json({
    entry: entry
      ? {
          gratitude1: entry.gratitude1 ?? "",
          gratitude2: entry.gratitude2 ?? "",
          gratitude3: entry.gratitude3 ?? "",
          identity1: entry.identity1 ?? "",
          identity2: entry.identity2 ?? "",
          identity3: entry.identity3 ?? "",
          identity4: entry.identity4 ?? "",
          identity5: entry.identity5 ?? "",
          energy: entry.energy ?? 5,
          mood: entry.mood ?? 5,
          sleepQuality: entry.sleepQuality ?? 5,
          tomorrowPlan: entry.tomorrowPlan ?? "",
          answers: (entry.answers as Record<string, unknown>) ?? {},
        }
      : null,
    questions,
    tasks,
  });
}
