import Link from "next/link";
import {
  firstOfMonth,
  monthKeyOf,
  monthMatrix,
  parseDate,
  shiftMonth,
  todayLocal,
  type DateString,
} from "@/lib/dates";
import { statusBg, STATUS_META, STATUS_ORDER, type JournalStatus } from "@/lib/journal-status";
import { cn } from "@/lib/utils";

const WEEKDAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];
const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/**
 * Multi-month journal heatmap. Mirrors FocusMonthGrid: same legend, same
 * cell sizing, same status palette via CSS vars. Cells inside the range are
 * tappable Links that jump to /journal/{date}.
 */
export function JournalMonthGrid({
  start,
  end,
  statusByDate,
}: {
  start: DateString;
  end: DateString;
  statusByDate: Record<DateString, JournalStatus>;
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
      <div
        className={cn(
          "grid gap-4",
          months.length === 1
            ? "grid-cols-1"
            : months.length === 2
              ? "grid-cols-2"
              : "sm:grid-cols-3 grid-cols-1",
        )}
      >
        {months.map((m) => (
          <MonthBlock
            key={m}
            month={m}
            today={today}
            start={start}
            end={end}
            statusByDate={statusByDate}
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
  statusByDate,
}: {
  month: DateString;
  today: DateString;
  start: DateString;
  end: DateString;
  statusByDate: Record<DateString, JournalStatus>;
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
          const status: JournalStatus = inRange && !isFuture
            ? statusByDate[d] ?? "empty"
            : "empty";
          const dayNum = Number(d.slice(-2));
          const bg = statusBg(status);
          const renderable = inRange && !isFuture && inMonth;
          const cellClasses = cn(
            "relative flex aspect-square items-center justify-center rounded-sm text-[9px] tabular-nums",
            !inMonth && "opacity-30",
            !inRange && "opacity-50",
            isToday && "ring-1 ring-primary/70",
          );
          const inner = (
            <span
              className={cn(
                status === "empty"
                  ? "text-muted-foreground"
                  : "text-foreground/85",
              )}
            >
              {dayNum}
            </span>
          );
          if (!renderable) {
            return (
              <div
                key={d}
                title={d}
                className={cellClasses}
                style={{
                  backgroundColor: bg,
                  opacity: !inMonth ? 0.3 : !inRange ? 0.5 : status === "empty" ? 0.7 : 1,
                }}
              >
                {inner}
              </div>
            );
          }
          return (
            <Link
              key={d}
              href={`/journal/${d}`}
              title={`${d}${status !== "empty" ? ` · ${STATUS_META[status].label}` : ""}`}
              className={cn(cellClasses, "transition-colors hover:opacity-90")}
              style={{
                backgroundColor: bg,
                opacity: status === "empty" ? 0.7 : 1,
              }}
            >
              {inner}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
