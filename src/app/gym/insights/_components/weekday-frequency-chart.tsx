"use client";

import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { parseDate } from "@/lib/dates";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const WEEKDAYS_LONG = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export function WeekdayFrequencyChart({
  workoutsPerDay,
}: {
  workoutsPerDay: Record<string, number>;
}) {
  const data = useMemo(() => {
    const counts = new Array(7).fill(0) as number[];
    for (const [date, n] of Object.entries(workoutsPerDay)) {
      if (n <= 0) continue;
      const dow = parseDate(date).getDay();
      counts[dow] += 1;
    }
    return WEEKDAYS.map((day, i) => ({ day, count: counts[i] }));
  }, [workoutsPerDay]);

  const hasAny = data.some((d) => d.count > 0);
  const maxCount = Math.max(...data.map((d) => d.count));
  const topDay = data.reduce((best, d) => (d.count > best.count ? d : best), data[0]);
  const skipDay = data.reduce((worst, d) => (d.count < worst.count ? d : worst), data[0]);

  return (
    <div className="space-y-2">
      <div className="h-44 w-full">
        {hasAny ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -28 }}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="day"
                tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                stroke="var(--border)"
              />
              <YAxis
                tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
                stroke="var(--border)"
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--popover)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                labelStyle={{ color: "var(--muted-foreground)" }}
                formatter={(v) => [`${v} workout${v === 1 ? "" : "s"}`, "Count"]}
              />
              <Bar dataKey="count" fill="var(--primary)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-muted-foreground">No workouts in this range.</p>
          </div>
        )}
      </div>
      {hasAny && maxCount > 0 ? (
        <p className="text-[11px] text-muted-foreground">
          Most active: <span className="font-medium text-foreground">{WEEKDAYS_LONG[WEEKDAYS.indexOf(topDay.day)]}</span>
          {skipDay.count === 0 ? (
            <>
              {" "}· Always skipped:{" "}
              <span className="font-medium text-foreground">
                {WEEKDAYS_LONG[WEEKDAYS.indexOf(skipDay.day)]}
              </span>
            </>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}
