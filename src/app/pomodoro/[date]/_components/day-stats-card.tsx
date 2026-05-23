"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { fmtMinutes, fmtPomos } from "@/lib/pomodoro-meta";
import type { PomodoroDay } from "@/db/queries/pomodoro";
import { cn } from "@/lib/utils";

export function DayStatsCard({
  today,
  prev,
  prevLabel,
}: {
  today: PomodoroDay;
  prev: PomodoroDay;
  prevLabel: string;
}) {
  const t = today.totals;
  const p = prev.totals;
  const diffMin = t.minutes - p.minutes;
  const diffPomos = t.pomos - p.pomos;

  // Bucket hour-of-day client-side so the user's actual TZ wins
  // (server query runs on Vercel UTC and would mis-bucket).
  const hourMinutes = useMemo(() => {
    const bins = new Array<number>(24).fill(0);
    for (const s of today.sessions) {
      const hr = new Date(s.startedAt).getHours();
      bins[hr] += s.durationMin;
    }
    return bins;
  }, [today.sessions]);
  const hourMax = Math.max(1, ...hourMinutes);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="font-serif text-lg font-normal">Today</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Top-line metrics */}
        <div className="flex items-end gap-6">
          <Metric label="Pomos" value={fmtPomos(t.pomos)} sub={`${t.count} session${t.count === 1 ? "" : "s"}`} />
          <Metric label="Focus" value={fmtMinutes(t.minutes)} sub={t.minutes ? `${Math.round(t.minutes / 60 * 10) / 10}h total` : "—"} />
          <div className="ml-auto flex flex-col items-end gap-1">
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground">{prevLabel}</span>
            <div className="flex items-center gap-1.5 text-sm">
              <span className="tabular-nums text-muted-foreground">{fmtPomos(p.pomos)} · {fmtMinutes(p.minutes)}</span>
            </div>
            <Delta diffMinutes={diffMin} diffPomos={diffPomos} />
          </div>
        </div>

        {/* Per-category breakdown */}
        {today.byCategory.length > 0 ? (
          <div className="space-y-1.5">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
              By category
            </div>
            {today.byCategory.map((c) => {
              const max = today.byCategory[0]?.minutes || 1;
              const widthPct = (c.minutes / max) * 100;
              return (
                <div key={c.categoryId ?? "_none"} className="flex items-center gap-2">
                  <span aria-hidden className="w-5 text-center text-base leading-none">
                    {c.emoji ?? "•"}
                  </span>
                  <div className="min-w-0 flex-1 truncate text-xs">{c.name}</div>
                  <div className="flex w-1/2 items-center gap-2">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${widthPct}%`, backgroundColor: c.color }}
                      />
                    </div>
                    <span className="w-16 text-right font-mono text-[11px] tabular-nums text-muted-foreground">
                      {fmtPomos(c.pomos)}p · {c.minutes}m
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-center text-xs text-muted-foreground">
            No sessions yet today.
          </p>
        )}

        {/* Hourly strip — 24 vertical bars */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-muted-foreground">
            <span>Hours of day</span>
            <span className="normal-case tracking-normal text-muted-foreground/70">12 AM → 11 PM</span>
          </div>
          <div className="flex h-16 items-end gap-[2px]">
            {hourMinutes.map((m, hr) => {
              const h = hourMax > 0 ? (m / hourMax) * 100 : 0;
              return (
                <div
                  key={hr}
                  className={cn(
                    "flex-1 rounded-sm",
                    m > 0 ? "bg-primary/70" : "bg-muted/40",
                  )}
                  style={{ height: `${Math.max(h, m > 0 ? 8 : 4)}%` }}
                  title={`${formatHour(hr)} · ${m}m`}
                />
              );
            })}
          </div>
          <div className="flex justify-between text-[9px] text-muted-foreground/60 tabular-nums">
            {[0, 6, 12, 18].map((h) => (
              <span key={h}>{formatHour(h)}</span>
            ))}
            <span>11 PM</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Metric({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className="font-serif text-3xl tabular-nums leading-none">{value}</span>
      <span className="text-[11px] text-muted-foreground mt-0.5">{sub}</span>
    </div>
  );
}

function Delta({ diffMinutes, diffPomos }: { diffMinutes: number; diffPomos: number }) {
  if (diffMinutes === 0 && Math.abs(diffPomos) < 0.05) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[11px] text-muted-foreground">
        <Minus className="size-3" /> Same
      </span>
    );
  }
  const up = diffMinutes >= 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-[11px] tabular-nums",
        up ? "text-status-good" : "text-status-bad",
      )}
    >
      {up ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
      {up ? "+" : ""}
      {diffMinutes}m
    </span>
  );
}

function formatHour(h: number): string {
  if (h === 0) return "12 AM";
  if (h === 12) return "12 PM";
  return h < 12 ? `${h} AM` : `${h - 12} PM`;
}
