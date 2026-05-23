"use client";

import { useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { addDays, daysBetween } from "@/lib/dates";
import { setVolume, type Exercise, type Workout, type WorkoutSet } from "@/lib/gym-meta";

export function VolumeTrendChart({
  sets,
  workouts,
  exercises,
  start,
  end,
}: {
  sets: WorkoutSet[];
  workouts: Workout[];
  exercises: Exercise[];
  start: string;
  end: string;
}) {
  const data = useMemo(() => {
    const byId = new Map(exercises.map((e) => [e.id, e]));
    const wDate = new Map(workouts.map((w) => [w.id, w.date]));
    const perDay = new Map<string, number>();
    for (const s of sets) {
      const d = wDate.get(s.workoutId);
      if (!d) continue;
      const ex = byId.get(s.exerciseId);
      if (!ex) continue;
      perDay.set(d, (perDay.get(d) ?? 0) + setVolume(s));
    }
    const n = daysBetween(start, end) + 1;
    const out: { date: string; volume: number }[] = [];
    for (let i = 0; i < n; i++) {
      const d = addDays(start, i);
      out.push({ date: d.slice(5), volume: Math.round(perDay.get(d) ?? 0) });
    }
    return out;
  }, [sets, workouts, exercises, start, end]);

  const hasAny = data.some((d) => d.volume > 0);

  return (
    <div className="h-56 w-full">
      {hasAny ? (
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
            <defs>
              <linearGradient id="volTrendFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.55} />
                <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.02} />
              </linearGradient>
            </defs>
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
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "var(--popover)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                fontSize: 12,
              }}
              labelStyle={{ color: "var(--muted-foreground)" }}
              formatter={(v) => [`${v} kg·reps`, "Volume"]}
            />
            <Area
              type="monotone"
              dataKey="volume"
              stroke="var(--primary)"
              strokeWidth={2}
              fill="url(#volTrendFill)"
              isAnimationActive
              animationDuration={500}
            />
          </AreaChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex h-full items-center justify-center">
          <p className="text-sm text-muted-foreground">
            No volume yet — log sets with weight to see the trend.
          </p>
        </div>
      )}
    </div>
  );
}
