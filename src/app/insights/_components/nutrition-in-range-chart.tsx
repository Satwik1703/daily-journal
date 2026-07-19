"use client";

import {
  Bar,
  BarChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export function NutritionInRangeChart({
  daily,
  target,
}: {
  daily: Array<{ date: string; kcal: number }>;
  target: number | null;
}) {
  if (daily.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-border bg-muted/20 py-6 text-center text-xs text-muted-foreground">
        No food logs in this range.
      </p>
    );
  }
  return (
    <div className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={daily} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
          <XAxis
            dataKey="date"
            tickFormatter={(d) => (d as string).slice(-5)}
            fontSize={10}
            stroke="var(--muted-foreground)"
            interval="preserveStartEnd"
          />
          <YAxis fontSize={10} stroke="var(--muted-foreground)" />
          <Tooltip
            contentStyle={{
              background: "var(--popover)",
              border: "1px solid var(--border)",
              borderRadius: 6,
              fontSize: 12,
            }}
            labelFormatter={(v) => String(v)}
            formatter={(v) => [`${Math.round(Number(v))} kcal`, "kcal"]}
          />
          {target != null && target > 0 ? (
            <ReferenceLine
              y={target}
              stroke="var(--primary)"
              strokeDasharray="4 4"
              label={{ value: `Target ${Math.round(target)}`, fontSize: 10, position: "insideTopRight" }}
            />
          ) : null}
          <Bar dataKey="kcal" fill="var(--chart-2)" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
