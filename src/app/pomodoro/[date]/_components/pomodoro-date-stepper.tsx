"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";
import { addDays, formatHumanDate, todayLocal } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { DatePickerPopover } from "@/components/date-picker-popover";
import { POMODORO_LEGEND } from "@/lib/calendar-legends";
import { fetchPomodoroMonthStatus } from "@/app/actions/pomodoro-month";

export function PomodoroDateStepper({ date }: { date: string }) {
  const router = useRouter();
  const prev = addDays(date, -1);
  const next = addDays(date, 1);
  const today = todayLocal();
  const isToday = date === today;

  return (
    <div className="sticky top-0 z-30 -mx-4 mb-4 flex items-center justify-between gap-2 border-b border-border/60 bg-background/85 px-4 py-3 backdrop-blur">
      <Link
        href={`/pomodoro/${prev}`}
        aria-label="Previous day"
        className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <ChevronLeft className="size-5" />
      </Link>

      <DatePickerPopover
        selected={date}
        onSelect={(d) => router.push(`/pomodoro/${d}`)}
        fetchMonthStatus={fetchPomodoroMonthStatus}
        legend={POMODORO_LEGEND}
      >
        <span className="flex flex-col items-center gap-0.5 px-2 py-1 transition-colors hover:bg-muted/60 rounded-md">
          <span className="inline-flex items-center gap-1 text-base font-medium leading-tight">
            {formatHumanDate(date)}
            <ChevronDown className="size-3.5 text-muted-foreground" />
          </span>
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
            {isToday ? "Today" : "Tap to jump"}
          </span>
        </span>
      </DatePickerPopover>

      <Link
        href={`/pomodoro/${next}`}
        aria-label="Next day"
        className={cn(
          "rounded-md p-2 transition-colors",
          date >= today
            ? "pointer-events-none text-muted-foreground/40"
            : "text-muted-foreground hover:bg-muted hover:text-foreground",
        )}
        aria-disabled={date >= today}
      >
        <ChevronRight className="size-5" />
      </Link>
    </div>
  );
}
