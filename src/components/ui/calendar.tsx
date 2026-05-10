"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  firstOfMonth,
  monthKeyOf,
  monthMatrix,
  parseDate,
  todayLocal,
  type DateString,
} from "@/lib/dates";
import { cn } from "@/lib/utils";

const WEEKDAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export type CalendarCellRenderer = (date: DateString) => React.ReactNode;

export function Calendar({
  month,
  selected,
  onSelect,
  cellRenderer,
  disableFuture = true,
  onPrevMonth,
  onNextMonth,
}: {
  month: DateString;
  selected?: DateString;
  onSelect: (date: DateString) => void;
  cellRenderer?: CalendarCellRenderer;
  disableFuture?: boolean;
  onPrevMonth?: () => void;
  onNextMonth?: () => void;
}) {
  const today = todayLocal();
  const days = monthMatrix(month);
  const monthIdx = parseDate(firstOfMonth(month)).getMonth();
  const year = parseDate(firstOfMonth(month)).getFullYear();

  return (
    <div className="w-[280px] select-none">
      <div className="mb-2 flex items-center justify-between px-1">
        <button
          type="button"
          aria-label="Previous month"
          onClick={onPrevMonth}
          className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
        </button>
        <div className="font-serif text-sm font-medium">
          {MONTH_NAMES[monthIdx]} {year}
        </div>
        <button
          type="button"
          aria-label="Next month"
          onClick={onNextMonth}
          className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 px-1 pb-1 text-center text-[10px] uppercase tracking-wider text-muted-foreground/70">
        {WEEKDAY_LETTERS.map((w, i) => (
          <span key={i}>{w}</span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1 px-1">
        {days.map((d) => {
          const inMonth = d.slice(0, 7) === monthKeyOf(month);
          const isToday = d === today;
          const isSelected = d === selected;
          const isFuture = disableFuture && d > today;
          const dayNum = Number(d.slice(-2));
          return (
            <button
              key={d}
              type="button"
              disabled={isFuture}
              onClick={() => onSelect(d)}
              aria-label={d}
              aria-pressed={isSelected}
              className={cn(
                "group relative flex aspect-square items-center justify-center rounded-md text-[11px] font-medium outline-none transition-all",
                "focus-visible:ring-2 focus-visible:ring-ring/40",
                !inMonth && "opacity-30",
                isFuture && "pointer-events-none opacity-20",
                !isFuture && "hover:scale-[1.06] active:scale-[0.96]",
                isSelected && "ring-2 ring-foreground/70 ring-offset-1 ring-offset-popover",
                isToday && !isSelected && "ring-1 ring-primary/70",
              )}
            >
              {/* status fill — rendered behind the number */}
              {cellRenderer ? (
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-0 rounded-md"
                >
                  {cellRenderer(d)}
                </span>
              ) : null}
              <span className="relative z-[1] tabular-nums">{dayNum}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
