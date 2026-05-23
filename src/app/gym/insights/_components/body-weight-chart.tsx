"use client";

import { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export function BodyWeightChart({
  series,
  delta,
}: {
  series: { date: string; weightKg: number }[];
  delta: { startKg: number; endKg: number; deltaKg: number } | null;
}) {
  // 7-day moving average overlay.
  const data = useMemo(() => {
    return series.map((d, i) => {
      const window = series.slice(Math.max(0, i - 6), i + 1);
      const avg = window.reduce((s, x) => s + x.weightKg, 0) / window.length;
      return {
        date: d.date.slice(5),
        weightKg: Number(d.weightKg.toFixed(2)),
        avg: Number(avg.toFixed(2)),
      };
    });
  }, [series]);

  const hasAny = series.length > 0;

  return (
    <div className="space-y-2">
      {delta ? (
        <p className="text-xs text-muted-foreground">
          Range:{" "}
          <span className="font-medium text-foreground tabular-nums">
            {delta.startKg}kg → {delta.endKg}kg
          </span>{" "}
          ({delta.deltaKg > 0 ? "+" : ""}
          {delta.deltaKg}kg)
        </p>
      ) : null}
      <div className="h-48 w-full">
        {hasAny ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
                stroke="var(--border)"
                interval="preserveStartEnd"
                minTickGap={20}
              />
              <YAxis
                tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
                stroke="var(--border)"
                domain={["dataMin - 0.5", "dataMax + 0.5"]}
                tickFormatter={(v: number) => v.toFixed(0)}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--popover)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                labelStyle={{ color: "var(--muted-foreground)" }}
                formatter={(v, n) => [`${v} kg`, n === "weightKg" ? "Weight" : "7-day avg"]}
              />
              <Line
                type="monotone"
                dataKey="weightKg"
                stroke="var(--primary)"
                strokeWidth={2}
                dot={{ r: 2 }}
                isAnimationActive
                animationDuration={500}
              />
              <Line
                type="monotone"
                dataKey="avg"
                stroke="var(--muted-foreground)"
                strokeWidth={1.5}
                strokeDasharray="4 4"
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-muted-foreground">
              No body weight entries in this range. Log one on the daily page.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
