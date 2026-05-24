import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatShortDate, parseDate, type DateString } from "@/lib/dates";
import {
  isHabitActiveOnWeekday,
  isHabitDoneOnDate,
  WEEKDAY_LABELS,
  type HabitTrackingKind,
} from "@/lib/habit-meta";
import type { Habit } from "@/db/queries/habits";

const WEEKDAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];

export function HabitGrid({
  habits,
  windowDates,
  windowLogs,
  windowValuesByHabit,
  windowPomoByHabit,
  today,
  anchor,
}: {
  habits: Habit[];
  windowDates: DateString[];
  /** habitId -> array of dates with a binary habit_logs row. */
  windowLogs: Record<string, string[]>;
  /** habitId -> { date -> summed value } for number-kind habits. */
  windowValuesByHabit: Record<string, Record<string, number>>;
  /** habitId -> { date -> session count } for pomo-kind habits. */
  windowPomoByHabit: Record<string, Record<string, number>>;
  today: DateString;
  /** Optional — when set, this cell gets the "selected" ring (defaults to today). */
  anchor?: DateString;
}) {
  const ringDate = anchor ?? today;
  if (habits.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="font-serif text-lg font-normal">
          Last {windowDates.length} days
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {/* Header row of weekday letters every ~5 days for context */}
          <div
            className="grid gap-[3px] pl-[108px] text-[9px] uppercase tracking-wider text-muted-foreground/60"
            style={{ gridTemplateColumns: `repeat(${windowDates.length}, minmax(0, 1fr))` }}
          >
            {windowDates.map((d, i) => (
              <span key={d} className="text-center leading-none">
                {i === windowDates.length - 1 || i % 5 === 0 ? WEEKDAY_LETTERS[parseDate(d).getDay()] : ""}
              </span>
            ))}
          </div>

          {habits.map((h) => {
            const kind = h.trackingKind as HabitTrackingKind;
            const logDates = new Set(windowLogs[h.id] ?? []);
            const valueDays = windowValuesByHabit[h.id] ?? {};
            const pomoDays = windowPomoByHabit[h.id] ?? {};
            return (
              <div key={h.id} className="flex items-start gap-2">
                <div className="flex w-[100px] shrink-0 items-start gap-1.5 pt-px">
                  <span aria-hidden className="text-base leading-none">
                    {h.emoji ?? "•"}
                  </span>
                  <span className="break-words whitespace-normal text-xs leading-tight text-muted-foreground">
                    {h.name}
                  </span>
                </div>
                <div
                  className="grid flex-1 gap-[3px]"
                  style={{ gridTemplateColumns: `repeat(${windowDates.length}, minmax(0, 1fr))` }}
                >
                  {windowDates.map((d) => {
                    const weekday = parseDate(d).getDay();
                    const isMasked = !isHabitActiveOnWeekday(h.weekdayMask, weekday);
                    const hadLog = logDates.has(d);
                    const daySumOrCount =
                      kind === "number"
                        ? valueDays[d] ?? 0
                        : kind === "pomodoro"
                          ? pomoDays[d] ?? 0
                          : 0;
                    const done = isHabitDoneOnDate(kind, h.dailyTarget, daySumOrCount, hadLog);
                    const isRing = d === ringDate;
                    if (isMasked && !done) {
                      return (
                        <span
                          key={d}
                          title={`${h.name} — Off on ${WEEKDAY_LABELS[weekday]}`}
                          className={cn(
                            "flex aspect-square items-center justify-center text-[8px] leading-none text-muted-foreground/40",
                            isRing && "ring-1 ring-foreground/40 rounded-[2px]",
                          )}
                        >
                          –
                        </span>
                      );
                    }
                    return (
                      <span
                        key={d}
                        title={`${h.name} — ${formatShortDate(d)}${done ? " ✓" : ""}`}
                        className={cn(
                          "aspect-square rounded-[2px] transition-colors",
                          isRing && "ring-1 ring-foreground/40",
                        )}
                        style={{
                          backgroundColor: done ? h.color : "rgba(125,125,125,0.10)",
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
