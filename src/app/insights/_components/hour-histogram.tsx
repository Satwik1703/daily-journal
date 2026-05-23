"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import type { HourSample } from "@/db/queries/pomodoro";

/**
 * 24-bar hour-of-day strip. Bucket happens in the browser so the user's
 * actual timezone determines which hour a session belongs to — the server
 * (Vercel UTC) can't do this correctly without per-user TZ context.
 */
export function HourHistogram({ samples }: { samples: HourSample[] }) {
  const hourMinutes = useMemo(() => {
    const bins = new Array<number>(24).fill(0);
    for (const s of samples) {
      const hr = new Date(s.startedAt).getHours();
      bins[hr] += s.durationMin;
    }
    return bins;
  }, [samples]);

  const max = Math.max(1, ...hourMinutes);
  const totalMin = hourMinutes.reduce((a, b) => a + b, 0);
  if (totalMin === 0) {
    return (
      <p className="py-4 text-center text-sm text-muted-foreground">
        No focus data yet.
      </p>
    );
  }
  return (
    <div className="space-y-1.5">
      <div className="flex h-16 items-end gap-[2px]">
        {hourMinutes.map((m, hr) => {
          const h = (m / max) * 100;
          return (
            <div
              key={hr}
              className={cn(
                "flex-1 rounded-sm transition-colors",
                m > 0 ? "bg-primary/70" : "bg-muted/40",
              )}
              style={{ height: `${Math.max(h, m > 0 ? 8 : 4)}%` }}
              title={`${formatHour(hr)} · ${m}m`}
            />
          );
        })}
      </div>
      <div className="flex justify-between text-[9px] text-muted-foreground/60 tabular-nums">
        <span>12 AM</span>
        <span>6 AM</span>
        <span>12 PM</span>
        <span>6 PM</span>
        <span>11 PM</span>
      </div>
    </div>
  );
}

function formatHour(h: number): string {
  if (h === 0) return "12 AM";
  if (h === 12) return "12 PM";
  return h < 12 ? `${h} AM` : `${h - 12} PM`;
}
