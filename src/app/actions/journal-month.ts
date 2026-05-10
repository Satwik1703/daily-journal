"use server";

import { getJournalMonthStatus } from "@/db/queries/journal-month";
import { addDays, firstOfMonth, isValidDateString, shiftMonth } from "@/lib/dates";
import type { JournalStatus } from "@/lib/journal-status";

/**
 * Returns a date-string → status map covering the whole calendar grid for the
 * month of `monthAnchor` (any date inside the month). Includes the leading
 * trailing days from the prior/next month visible in the 6-row grid, so the
 * legend stays correct as the user pages around.
 */
export async function fetchJournalMonthStatus(
  monthAnchor: string,
): Promise<Record<string, JournalStatus>> {
  if (!isValidDateString(monthAnchor)) {
    throw new Error(`Invalid month anchor: ${monthAnchor}`);
  }
  const start = addDays(firstOfMonth(monthAnchor), -7); // covers spill from previous month
  const end = addDays(shiftMonth(monthAnchor, 1), 7); // covers spill into next month
  return getJournalMonthStatus(start, end);
}
