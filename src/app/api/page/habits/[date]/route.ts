import { NextResponse } from "next/server";
import { getHabitsSnapshot } from "@/db/queries/habits";
import { getActiveCategories } from "@/db/queries/pomodoro-categories";
import { formatLocalYMD, isValidDateString } from "@/lib/dates";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ date: string }> },
) {
  const { date } = await ctx.params;
  if (!isValidDateString(date)) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }

  const [snapshot, pomoCategories] = await Promise.all([
    getHabitsSnapshot({ anchor: date, windowDays: 15 }),
    getActiveCategories(),
  ]);

  const activeForAnchor = snapshot.active.filter(
    (h) => formatLocalYMD(h.createdAt) <= date,
  );

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
      active: activeForAnchor,
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
  });
}
