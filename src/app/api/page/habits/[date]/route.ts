import { NextResponse } from "next/server";
import {
  getHabitsSnapshot,
  getValueLogsOnDate,
  getXpByHabit,
} from "@/db/queries/habits";
import { getActiveCategories } from "@/db/queries/pomodoro-categories";
import { getActiveBooks, getActiveBookId } from "@/db/queries/books";
import { formatLocalYMD, isValidDateString } from "@/lib/dates";
import { getCurrentUser } from "@/lib/auth/context";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ date: string }> },
) {
  const { date } = await ctx.params;
  if (!isValidDateString(date)) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const [
    snapshot,
    pomoCategories,
    valueLogsByHabit,
    xpByHabit,
    readingBooks,
    activeBookId,
  ] = await Promise.all([
    getHabitsSnapshot(userId, { anchor: date, windowDays: 15 }),
    getActiveCategories(userId),
    getValueLogsOnDate(userId, date),
    getXpByHabit(userId),
    getActiveBooks(userId),
    getActiveBookId(userId),
  ]);

  // Lifespan filter applies to both lists; weekday-mask filter only to the
  // anchor-day toggles, not the multi-day grid.
  const lifespanFilter = (h: { createdAt: Date }) => formatLocalYMD(h.createdAt) <= date;
  const activeForAnchor = snapshot.activeForAnchor.filter(lifespanFilter);
  const activeAll = snapshot.active.filter(lifespanFilter);

  const valueAtAnchor: Record<string, number> = {};
  const pomoCountAtAnchor: Record<string, number> = {};
  for (const h of activeForAnchor) {
    if (h.trackingKind === "number") {
      valueAtAnchor[h.id] = snapshot.windowValuesByHabit.get(h.id)?.get(date) ?? 0;
    } else if (h.trackingKind === "pomodoro") {
      pomoCountAtAnchor[h.id] = snapshot.windowPomoByHabit.get(h.id)?.get(date) ?? 0;
    }
  }

  const windowValuesRecord: Record<string, Record<string, number>> = {};
  for (const [hid, dayMap] of snapshot.windowValuesByHabit) {
    windowValuesRecord[hid] = Object.fromEntries(dayMap);
  }
  const windowPomoRecord: Record<string, Record<string, number>> = {};
  for (const [hid, dayMap] of snapshot.windowPomoByHabit) {
    windowPomoRecord[hid] = Object.fromEntries(dayMap);
  }
  const windowLogsRecord: Record<string, string[]> = {};
  for (const [hid, dateSet] of snapshot.windowLogs) {
    windowLogsRecord[hid] = Array.from(dateSet);
  }

  return NextResponse.json({
    snapshot: {
      active: activeForAnchor,        // toggles use this (mask-filtered)
      activeAll,                       // grid uses this (full list, mask not applied)
      archived: snapshot.archived,
      today: snapshot.today,
      doneOnAnchorIds: Array.from(snapshot.doneOnAnchorIds),
      windowDates: snapshot.windowDates,
    },
    pomoCategories,
    valueAtAnchor,
    pomoCountAtAnchor,
    windowValuesRecord,
    windowPomoRecord,
    windowLogsRecord,
    valueLogsByHabit,
    xpByHabit,
    readingBooks,
    activeBookId,
  });
}
