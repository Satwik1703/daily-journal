"use server";

import { getJournalMonthStatus } from "@/db/queries/journal-month";
import { addDays, firstOfMonth, isValidDateString, shiftMonth } from "@/lib/dates";
import type { JournalStatus } from "@/lib/journal-status";
import { requireUser } from "@/lib/auth/context";

export async function fetchJournalMonthStatus(
  monthAnchor: string,
): Promise<Record<string, JournalStatus>> {
  if (!isValidDateString(monthAnchor)) {
    throw new Error(`Invalid month anchor: ${monthAnchor}`);
  }
  const { user } = await requireUser();
  const start = addDays(firstOfMonth(monthAnchor), -7);
  const end = addDays(shiftMonth(monthAnchor, 1), 7);
  return getJournalMonthStatus(user.id, start, end);
}
