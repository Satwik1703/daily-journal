"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { addDays, formatHumanDate, todayLocal } from "@/lib/dates";
import { cn } from "@/lib/utils";

export function DateStepper({ date }: { date: string }) {
  const prev = addDays(date, -1);
  const next = addDays(date, 1);
  const today = todayLocal();
  const isToday = date === today;

  return (
    <div className="sticky top-0 z-30 -mx-4 mb-4 flex items-center justify-between gap-2 border-b border-border/60 bg-background/85 px-4 py-3 backdrop-blur">
      <Link
        href={`/journal/${prev}`}
        aria-label="Previous day"
        className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <ChevronLeft className="size-5" />
      </Link>
      <div className="flex flex-col items-center">
        <h1 className="text-base font-medium leading-tight">{formatHumanDate(date)}</h1>
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
          {isToday ? "Today" : ""}
        </span>
      </div>
      <Link
        href={`/journal/${next}`}
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
