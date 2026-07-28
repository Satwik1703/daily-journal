"use server";

import { requireUser } from "@/lib/auth/context";
import { getTimeboxMonthStatus, type TimeboxDayStatus } from "@/db/queries/timebox";
import { addDays, firstOfMonth, shiftMonth } from "@/lib/dates";

export async function fetchTimeboxMonthStatus(
  monthAnchor: string,
): Promise<Record<string, TimeboxDayStatus>> {
  const { user } = await requireUser();
  const monthStart = firstOfMonth(monthAnchor);
  const nextMonth = shiftMonth(monthAnchor, 1);
  const end = addDays(firstOfMonth(nextMonth), -1);
  const start = addDays(monthStart, -7);
  const end2 = addDays(end, 7);
  return getTimeboxMonthStatus(user.id, start, end2);
}
