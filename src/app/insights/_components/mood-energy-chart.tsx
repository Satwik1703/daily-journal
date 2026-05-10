"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import type { DailyMetric } from "@/db/queries/insights";

export function MoodEnergyChart({ metrics }: { metrics: DailyMetric[] }) {
  const hasAny = metrics.some((m) => m.energy != null || m.mood != null || m.sleepQuality != null);
  if (!hasAny) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Log a few days to see trends here.
      </p>
    );
  }
  const data = metrics.map((m) => ({
    date: m.date.slice(5), // MM-DD for axis brevity
    Energy: m.energy,
    Mood: m.mood,
    Sleep: m.sleepQuality,
  }));
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="date" tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} stroke="var(--border)" interval="preserveStartEnd" minTickGap={20} />
          <YAxis domain={[1, 10]} ticks={[1, 5, 10]} tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} stroke="var(--border)" />
          <Tooltip
            contentStyle={{
              backgroundColor: "var(--popover)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 12,
            }}
            labelStyle={{ color: "var(--muted-foreground)" }}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} iconType="line" />
          <Line type="monotone" dataKey="Energy" stroke="var(--chart-1)" strokeWidth={2} dot={false} connectNulls />
          <Line type="monotone" dataKey="Mood" stroke="var(--chart-2)" strokeWidth={2} dot={false} connectNulls />
          <Line type="monotone" dataKey="Sleep" stroke="var(--chart-3)" strokeWidth={2} dot={false} connectNulls />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
