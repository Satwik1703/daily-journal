"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type Row = { date: string; minutes: number; pomos: number };

export function FocusBarChart({ daily }: { daily: Row[] }) {
  if (daily.every((d) => d.minutes === 0)) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        No focus sessions in this range yet.
      </p>
    );
  }
  const data = daily.map((d) => ({
    date: d.date.slice(5),
    minutes: d.minutes,
    pomos: Number(d.pomos.toFixed(1)),
  }));
  return (
    <div className="h-44 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
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
            unit="m"
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "var(--popover)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 12,
            }}
            labelStyle={{ color: "var(--muted-foreground)" }}
            formatter={(v) => [`${v} min`, "Focus"]}
          />
          <Bar dataKey="minutes" fill="var(--primary)" radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
