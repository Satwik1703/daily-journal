"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { addDays, formatHumanDate, todayLocal } from "@/lib/dates";

export function FoodDateStepper({ date }: { date: string }) {
  const router = useRouter();
  const today = todayLocal();
  const prev = addDays(date, -1);
  const next = addDays(date, 1);
  const isToday = date === today;
  const canGoForward = next <= today;

  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-card/30 px-2 py-1">
      <Link
        href={`/food/${prev}`}
        className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        aria-label="Previous day"
      >
        <ChevronLeft className="size-4" />
      </Link>
      <button
        type="button"
        className="flex flex-col items-center px-3"
        onClick={() => router.push(`/food/${today}`)}
      >
        <span className="text-sm font-medium tabular-nums">
          {formatHumanDate(date)}
        </span>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
          {isToday ? "Today" : "Tap for today"}
        </span>
      </button>
      <Link
        href={canGoForward ? `/food/${next}` : `/food/${date}`}
        className={
          "rounded p-1.5 text-muted-foreground " +
          (canGoForward
            ? "hover:bg-muted hover:text-foreground"
            : "pointer-events-none opacity-30")
        }
        aria-label="Next day"
        aria-disabled={!canGoForward}
      >
        <ChevronRight className="size-4" />
      </Link>
    </div>
  );
}
