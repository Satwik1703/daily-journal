import {
  firstOfMonth,
  monthKeyOf,
  monthMatrix,
  parseDate,
  shiftMonth,
  todayLocal,
  type DateString,
} from "@/lib/dates";
import { computePomodoroStatus } from "@/lib/pomodoro-status";
import { statusBg, STATUS_META, STATUS_ORDER } from "@/lib/journal-status";
import { cn } from "@/lib/utils";

const WEEKDAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];
const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export function FocusMonthGrid({
  start,
  end,
  perDate,
}: {
  start: DateString;
  end: DateString;
  perDate: Map<DateString, { pomos: number; hadAny: boolean }>;
}) {
  const today = todayLocal();
  const months: DateString[] = [];
  let cursor = firstOfMonth(start);
  while (cursor <= firstOfMonth(end)) {
    months.push(cursor);
    cursor = shiftMonth(cursor, 1);
  }

  return (
    <div className="space-y-3">
      <div className={cn(
        "grid gap-4",
        months.length === 1 ? "grid-cols-1" : months.length === 2 ? "grid-cols-2" : "sm:grid-cols-3 grid-cols-1",
      )}>
        {months.map((m) => (
          <MonthBlock
            key={m}
            month={m}
            today={today}
            start={start}
            end={end}
            perDate={perDate}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1.5 text-[10px] text-muted-foreground">
        {STATUS_ORDER.filter((s) => s !== "empty").map((s) => (
          <span key={s} className="inline-flex items-center gap-1">
            <span
              aria-hidden
              className="size-2.5 rounded-[3px]"
              style={{ backgroundColor: statusBg(s) }}
            />
            {STATUS_META[s].label}
          </span>
        ))}
      </div>
    </div>
  );
}

function MonthBlock({
  month,
  today,
  start,
  end,
  perDate,
}: {
  month: DateString;
  today: DateString;
  start: DateString;
  end: DateString;
  perDate: Map<DateString, { pomos: number; hadAny: boolean }>;
}) {
  const cells = monthMatrix(month);
  const monthIdx = parseDate(firstOfMonth(month)).getMonth();
  const year = parseDate(firstOfMonth(month)).getFullYear();

  return (
    <div>
      <div className="mb-1.5 font-serif text-xs">
        {MONTH_NAMES[monthIdx]} {year}
      </div>
      <div className="grid grid-cols-7 gap-[3px] pb-1 text-center text-[9px] uppercase tracking-wider text-muted-foreground/60">
        {WEEKDAY_LETTERS.map((w, i) => (
          <span key={i}>{w}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-[3px]">
        {cells.map((d) => {
          const inMonth = d.slice(0, 7) === monthKeyOf(month);
          const inRange = d >= start && d <= end;
          const isFuture = d > today;
          const isToday = d === today;
          const data = perDate.get(d);
          const renderable = inRange && !isFuture;
          const status = renderable
            ? computePomodoroStatus({
                pomos: data?.pomos ?? 0,
                hadAny: data?.hadAny ?? false,
              })
            : "empty";
          const dayNum = Number(d.slice(-2));
          // Use the shared --status-* palette for every cell. Out-of-range
          // and future cells reuse status-empty so the heatmap matches the
          // calendar popover at all places.
          const bg = statusBg(status);
          return (
            <div
              key={d}
              title={
                renderable
                  ? `${d}${data ? ` · ${data.pomos.toFixed(1)} pomo${data.pomos === 1 ? "" : "s"}` : ""}`
                  : d
              }
              className={cn(
                "relative flex aspect-square items-center justify-center rounded-sm text-[9px] tabular-nums",
                !inMonth && "opacity-30",
                !renderable && "opacity-50",
                isToday && "ring-1 ring-primary/70",
              )}
              style={{
                backgroundColor: bg,
                opacity:
                  !inMonth ? 0.3 : !renderable ? 0.5 : status === "empty" ? 0.7 : 1,
              }}
            >
              <span
                className={cn(
                  status === "empty"
                    ? "text-muted-foreground"
                    : "text-foreground/85",
                )}
              >
                {dayNum}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Used by parents to build the perDate map from `getPomodoroWindow().daily`. */
export function buildPerDateMap(
  daily: { date: DateString; pomos: number; count: number }[],
): Map<DateString, { pomos: number; hadAny: boolean }> {
  const m = new Map<DateString, { pomos: number; hadAny: boolean }>();
  for (const d of daily) {
    m.set(d.date, { pomos: d.pomos, hadAny: d.count > 0 });
  }
  return m;
}
