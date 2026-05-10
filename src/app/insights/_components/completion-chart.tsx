"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import type { HabitCompletionRow } from "@/db/queries/insights";
import { cn } from "@/lib/utils";

export function CompletionChart({
  completion,
  perHabit,
  range,
}: {
  completion: HabitCompletionRow[];
  perHabit: { id: string; name: string; emoji: string | null; color: string; done: number }[];
  range: number;
}) {
  if (completion.every((c) => c.active === 0)) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        Add some habits to start tracking completion.
      </p>
    );
  }
  const data = completion.map((c) => ({ date: c.date.slice(5), pct: Math.round(c.pct * 100) }));
  return (
    <div className="space-y-4">
      <div className="h-44 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="date" tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} stroke="var(--border)" interval="preserveStartEnd" minTickGap={20} />
            <YAxis domain={[0, 100]} ticks={[0, 50, 100]} unit="%" tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} stroke="var(--border)" />
            <Tooltip
              contentStyle={{
                backgroundColor: "var(--popover)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                fontSize: 12,
              }}
              labelStyle={{ color: "var(--muted-foreground)" }}
              formatter={(v) => [`${v}%`, "Completion"]}
            />
            <Bar dataKey="pct" fill="var(--primary)" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      {perHabit.length > 0 ? (
        <div className="space-y-1.5">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Per habit (last {range}d)</div>
          {perHabit.map((h) => {
            const max = perHabit[0]?.done || 1;
            return (
              <div key={h.id} className="flex items-center gap-2">
                <span aria-hidden className="w-5 text-center text-base leading-none">{h.emoji ?? "•"}</span>
                <div className="min-w-0 flex-1 truncate text-xs">{h.name}</div>
                <div className="flex w-1/2 items-center gap-2">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn("h-full rounded-full")}
                      style={{ width: `${(h.done / max) * 100}%`, backgroundColor: h.color }}
                    />
                  </div>
                  <span className="w-8 text-right font-mono text-[11px] tabular-nums text-muted-foreground">{h.done}</span>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
