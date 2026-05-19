// Pomodoro day status — reuses the shared JournalStatus palette.

import type { JournalStatus } from "@/lib/journal-status";

/**
 * Day status based on cumulative pomos completed that day.
 *
 * pomos >= 6        → crazy
 * pomos === 5       → great
 * pomos in [3, 4]   → good
 * pomos in (0, 3)   → avg
 * pomos === 0       → bad  (only if any session was started — captured by `hadAny`)
 * !hadAny           → empty
 */
export function computePomodoroStatus(input: {
  pomos: number;
  hadAny: boolean;
}): JournalStatus {
  if (!input.hadAny) return "empty";
  if (input.pomos >= 6) return "crazy";
  if (input.pomos >= 5) return "great";
  if (input.pomos >= 3) return "good";
  if (input.pomos > 0) return "avg";
  return "bad";
}
