"use client";

import { useMemo } from "react";
import { formatTimeSpan } from "@/lib/pomodoro-meta";
import { cn } from "@/lib/utils";

/**
 * Horizontal bar spanning `[startedAt → endedAt]`. Shows elapsed fill, tick marks for
 * every :00 and :30 boundary in that window, the wall-clock label, and a marker for now.
 */
export function TimeSpanBar({
  startedAt,
  endedAt,
  now,
  running,
}: {
  startedAt: number;
  endedAt: number;
  now: number;
  running: boolean;
}) {
  const total = endedAt - startedAt;
  const elapsed = Math.max(0, Math.min(total, now - startedAt));
  const fraction = total <= 0 ? 0 : elapsed / total;

  const start = useMemo(() => new Date(startedAt), [startedAt]);
  const end = useMemo(() => new Date(endedAt), [endedAt]);
  const ticks = useMemo(() => computeTicks(start, end), [start, end]);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-muted-foreground">
        <span>Window</span>
        <span className="tabular-nums normal-case tracking-normal text-foreground/80">
          {formatTimeSpan(start, end)}
        </span>
      </div>
      <div className="relative h-7 w-full rounded-md border border-border bg-muted/40 overflow-hidden">
        {/* Fill */}
        <div
          className={cn(
            "absolute inset-y-0 left-0 bg-primary/70 transition-[width] duration-500 ease-linear",
            !running && "bg-primary/40",
          )}
          style={{ width: `${fraction * 100}%` }}
        />
        {/* Tick marks */}
        {ticks.map((t) => (
          <div
            key={t.pos}
            className={cn(
              "absolute top-0 bottom-0 flex flex-col items-center",
              "translate-x-[-50%]",
            )}
            style={{ left: `${t.pos * 100}%` }}
          >
            <span
              className={cn(
                "w-px h-full",
                t.major ? "bg-foreground/40" : "bg-foreground/15",
              )}
            />
          </div>
        ))}
        {/* Tick labels (only major) */}
        {ticks.filter((t) => t.major).map((t) => (
          <span
            key={`l-${t.pos}`}
            className="absolute top-0 -translate-x-1/2 text-[9px] uppercase tracking-wider text-muted-foreground/80 leading-none pt-0.5 px-0.5 bg-background/60 rounded"
            style={{ left: `${t.pos * 100}%` }}
          >
            {t.label}
          </span>
        ))}
        {/* Now marker */}
        {running ? (
          <div
            className="absolute top-0 bottom-0 w-[2px] bg-foreground/80 shadow-[0_0_4px_rgba(255,255,255,0.4)] pointer-events-none"
            style={{ left: `${fraction * 100}%` }}
          />
        ) : null}
      </div>
    </div>
  );
}

type Tick = { pos: number; major: boolean; label: string };

function computeTicks(start: Date, end: Date): Tick[] {
  const total = end.getTime() - start.getTime();
  if (total <= 0) return [];
  const ticks: Tick[] = [];
  // Walk from start ceiling-up to first :00 or :30, then step 30 minutes.
  const cursor = new Date(start);
  cursor.setSeconds(0, 0);
  // Bump to next half-hour boundary (cursor minute → 0 or 30)
  const m = cursor.getMinutes();
  if (m === 0) {
    // already on hour
  } else if (m < 30) {
    cursor.setMinutes(30);
  } else {
    cursor.setMinutes(60); // overflows hour cleanly
  }
  while (cursor.getTime() < end.getTime()) {
    const pos = (cursor.getTime() - start.getTime()) / total;
    const minutes = cursor.getMinutes();
    const major = minutes === 0;
    ticks.push({
      pos,
      major,
      label: major ? formatHourLabel(cursor) : ":30",
    });
    cursor.setMinutes(cursor.getMinutes() + 30);
  }
  return ticks;
}

function formatHourLabel(d: Date): string {
  let h = d.getHours();
  const am = h < 12;
  h = h % 12;
  if (h === 0) h = 12;
  return `${h} ${am ? "AM" : "PM"}`;
}
