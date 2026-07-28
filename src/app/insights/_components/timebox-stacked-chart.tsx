"use client";

import {
  Bar,
  BarChart,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export function TimeboxStackedChart({
  byDay,
  categories,
}: {
  byDay: Array<{ date: string; totals: Record<string, number> }>;
  categories: Array<{ id: string; color: string; name: string }>;
}) {
  const data = byDay.map((d) => {
    const row: Record<string, string | number> = { date: d.date };
    for (const c of categories) {
      // Minutes → hours for readability.
      row[c.id] = (d.totals[c.id] ?? 0) / 60;
    }
    return row;
  });

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 8, left: -14, bottom: 0 }}>
          <XAxis
            dataKey="date"
            tickFormatter={(d) => (d as string).slice(-5)}
            fontSize={10}
            stroke="var(--muted-foreground)"
            interval="preserveStartEnd"
          />
          <YAxis fontSize={10} stroke="var(--muted-foreground)" unit="h" />
          <Tooltip
            contentStyle={{
              background: "var(--popover)",
              border: "1px solid var(--border)",
              borderRadius: 6,
              fontSize: 11,
            }}
            formatter={(v, name) => {
              const cat = categories.find((c) => c.id === name);
              const label = cat?.name ?? String(name);
              const n = Number(v);
              return [`${n.toFixed(1)} hrs`, label];
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: 10 }}
            iconSize={8}
            formatter={(name) => categories.find((c) => c.id === name)?.name ?? String(name)}
          />
          {categories.map((c) => (
            <Bar key={c.id} dataKey={c.id} stackId="a" fill={c.color} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
