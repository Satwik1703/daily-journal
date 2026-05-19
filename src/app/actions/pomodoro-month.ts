"use server";

import { getPomodoroMonthStatus } from "@/db/queries/pomodoro";
import { addDays, firstOfMonth, isValidDateString, shiftMonth } from "@/lib/dates";
import type { JournalStatus } from "@/lib/journal-status";

export async function fetchPomodoroMonthStatus(
  monthAnchor: string,
): Promise<Record<string, JournalStatus>> {
  if (!isValidDateString(monthAnchor)) {
    throw new Error(`Invalid month anchor: ${monthAnchor}`);
  }
  const start = addDays(firstOfMonth(monthAnchor), -7);
  const end = addDays(shiftMonth(monthAnchor, 1), 7);
  return getPomodoroMonthStatus(start, end);
}
