"use client";

import { useMemo, useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { PomoCategory } from "@/db/queries/pomodoro-categories";
import type { DayCategoryAgg } from "@/db/queries/pomodoro";
import { cn } from "@/lib/utils";

type DailyRowSerialized = {
  date: string;
  count: number;
  minutes: number;
  pomos: number;
  byCategory: DayCategoryAgg[];
};

export function FocusTrendChart({
  daily,
  categories,
  rangeDays,
}: {
  daily: DailyRowSerialized[];
  categories: PomoCategory[];
  rangeDays: number;
}) {
  const [catId, setCatId] = useState<string | "all">("all");
  const [unit, setUnit] = useState<"minutes" | "pomos">("minutes");

  const accent = useMemo(() => {
    if (catId === "all") return null;
    return categories.find((c) => c.id === catId)?.color ?? null;
  }, [catId, categories]);

  const data = useMemo(() => {
    return daily.map((d) => {
      let m = 0;
      let p = 0;
      if (catId === "all") {
        m = d.minutes;
        p = d.pomos;
      } else {
        const cat = d.byCategory.find((c) => c.categoryId === catId);
        if (cat) {
          m = cat.minutes;
          p = cat.pomos;
        }
      }
      return {
        date: d.date.slice(5),
        minutes: m,
        pomos: Number(p.toFixed(2)),
      };
    });
  }, [daily, catId]);

  const hasAny = data.some((d) => d.minutes > 0);
  const stroke = accent ?? "var(--primary)";
  const fillId = `focusTrendFill-${catId}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="-mx-1 w-full max-w-full min-w-0 overflow-x-auto pb-1">
          <div className="flex w-max gap-1.5 px-1">
            <CatChip
              label="All"
              active={catId === "all"}
              onClick={() => setCatId("all")}
            />
            {categories.map((c) => (
              <CatChip
                key={c.id}
                label={c.name}
                emoji={c.emoji}
                color={c.color}
                active={catId === c.id}
                onClick={() => setCatId(c.id)}
              />
            ))}
          </div>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-1 rounded-md border border-border bg-muted/30 p-0.5">
          <UnitBtn label="Minutes" active={unit === "minutes"} onClick={() => setUnit("minutes")} />
          <UnitBtn label="Pomos" active={unit === "pomos"} onClick={() => setUnit("pomos")} />
        </div>
      </div>

      <div className="h-56 w-full">
        {hasAny ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
              <defs>
                <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={stroke} stopOpacity={0.55} />
                  <stop offset="100%" stopColor={stroke} stopOpacity={0.02} />
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
                unit={unit === "minutes" ? "m" : ""}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--popover)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                labelStyle={{ color: "var(--muted-foreground)" }}
                formatter={(v) =>
                  unit === "minutes" ? [`${v} min`, "Focus"] : [`${v} pomos`, "Focus"]
                }
              />
              <Area
                type="monotone"
                dataKey={unit}
                stroke={stroke}
                strokeWidth={2}
                fill={`url(#${fillId})`}
                isAnimationActive
                animationDuration={500}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-muted-foreground">
              No focus data for{" "}
              {catId === "all" ? "this range" : "this category in this range"} (last {rangeDays}d).
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function CatChip({
  label,
  emoji,
  color,
  active,
  onClick,
}: {
  label: string;
  emoji?: string | null;
  color?: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors",
        active
          ? "border-transparent text-foreground shadow-sm"
          : "border-border bg-muted/30 text-muted-foreground hover:bg-muted/60",
      )}
      style={
        active && color
          ? { backgroundColor: `${color}22`, boxShadow: `inset 0 0 0 2px ${color}` }
          : active
            ? { backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }
            : undefined
      }
    >
      {emoji ? <span>{emoji}</span> : null}
      <span>{label}</span>
    </button>
  );
}

function UnitBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded px-2 py-0.5 text-[11px] uppercase tracking-wider transition-colors",
        active
          ? "bg-background text-foreground shadow-sm ring-1 ring-border"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}
