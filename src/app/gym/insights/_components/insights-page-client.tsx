"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Trophy } from "lucide-react";
import { useCachedPage } from "@/lib/sync/cache";
import { todayLocal } from "@/lib/dates";
import { cn } from "@/lib/utils";
import {
  buildRecoveryFillFor,
  buildVolumeFillFor,
  GYM_RANGES,
  type GymRange,
  type Exercise,
  type Split,
  type Workout,
  type WorkoutSet,
} from "@/lib/gym-meta";
import { MUSCLE_GROUPS, MUSCLE_LABELS, type MuscleGroup } from "@/lib/muscle-groups";
import { Body3DDynamic } from "@/components/body-3d";
import { VolumeTrendChart } from "./volume-trend-chart";
import { WeekdayFrequencyChart } from "./weekday-frequency-chart";
import { BodyWeightChart } from "./body-weight-chart";
import { SplitStreaksCard } from "./split-streaks-card";
import { CompareWeeksCard } from "./compare-weeks-card";

type InsightsData = {
  range: GymRange;
  start: string;
  end: string;
  workoutsInRange: Workout[];
  setsInRange: WorkoutSet[];
  splits: Split[];
  exercises: Exercise[];
  volumePerMuscle: Record<MuscleGroup, number>;
  setsPerMuscle: Record<MuscleGroup, number>;
  workoutsPerDay: Record<string, number>;
  splitFrequency: Record<string, number>;
  topExercises: { exerciseId: string; name: string; volume: number; sets: number }[];
  personalRecords: {
    exerciseId: string;
    exerciseName: string;
    weightKg: number;
    reps: number;
    est1RM: number;
    date: string;
    kind: "weight" | "1rm";
  }[];
  hoursSinceLastHitByMuscle: Partial<Record<MuscleGroup, number | null>>;
  weekCompare: {
    thisWeek: {
      weekKey: string;
      start: string;
      end: string;
      workoutCount: number;
      totalVolume: number;
      totalSets: number;
      topExercises: { exerciseId: string; name: string; topWeightKg: number; topReps: number }[];
      setsPerMuscle: Record<MuscleGroup, number>;
    };
    lastWeek: {
      weekKey: string;
      start: string;
      end: string;
      workoutCount: number;
      totalVolume: number;
      totalSets: number;
      topExercises: { exerciseId: string; name: string; topWeightKg: number; topReps: number }[];
      setsPerMuscle: Record<MuscleGroup, number>;
    };
  };
  splitStreaks: {
    splitId: string;
    splitName: string;
    emoji: string | null;
    color: string;
    current: number;
    longest: number;
  }[];
  bodyWeightSeries: { date: string; weightKg: number }[];
  bodyWeightDelta: { startKg: number; endKg: number; deltaKg: number } | null;
};

export function GymInsightsPageClient() {
  const [range, setRange] = useState<GymRange>(30);
  const [mode, setMode] = useState<"volume" | "recovery">("volume");

  const data = useCachedPage<InsightsData | null>(
    `gym-insights:v2:${range}`,
    null,
    async () => {
      const res = await fetch(`/api/page/gym/insights/${range}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Fetch failed");
      return (await res.json()) as InsightsData;
    },
  );

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pt-4 pb-8 space-y-4">
      <div className="flex items-center justify-between">
        <Link
          href={`/gym/${todayLocal()}`}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-3.5" /> Back to log
        </Link>
        <RangeToggle range={range} onChange={setRange} />
      </div>
      <div>
        <h1 className="font-serif text-2xl font-normal leading-tight">Gym insights</h1>
        <p className="text-xs text-muted-foreground">
          Last {range} days{data ? ` · ${data.workoutsInRange.length} workout(s)` : ""}
        </p>
      </div>

      {data == null ? <PageSkeleton /> : <Loaded data={data} mode={mode} onModeChange={setMode} />}
    </div>
  );
}

function Loaded({
  data,
  mode,
  onModeChange,
}: {
  data: InsightsData;
  mode: "volume" | "recovery";
  onModeChange: (m: "volume" | "recovery") => void;
}) {
  const fillFor = useMemo(() => {
    if (mode === "recovery") return buildRecoveryFillFor(data.hoursSinceLastHitByMuscle);
    return buildVolumeFillFor(data.volumePerMuscle);
  }, [mode, data.volumePerMuscle, data.hoursSinceLastHitByMuscle]);

  const splitName = (id: string | "__free__") => {
    if (id === "__free__") return "Free";
    return data.splits.find((s) => s.id === id)?.name ?? "—";
  };

  const topMusclesByVolume = useMemo(() => {
    return (Object.entries(data.volumePerMuscle) as [MuscleGroup, number][])
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);
  }, [data.volumePerMuscle]);

  return (
    <>
      <section className="space-y-2 rounded-xl border border-border bg-card/30 p-3">
        <div className="flex items-center justify-between">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
            {mode === "volume" ? "Volume heatmap" : "Recovery status"}
          </p>
          <div className="flex items-center gap-1 rounded-md border border-border bg-muted/30 p-0.5">
            <ModeBtn label="Volume" active={mode === "volume"} onClick={() => onModeChange("volume")} />
            <ModeBtn label="Recovery" active={mode === "recovery"} onClick={() => onModeChange("recovery")} />
          </div>
        </div>
        <Body3DDynamic fillFor={fillFor} height={380} />
        {mode === "volume" ? (
          <div className="space-y-1 pt-2">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Top muscles
            </p>
            {topMusclesByVolume.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Log some sets with weight + reps to fill the body.
              </p>
            ) : (
              <ul className="space-y-1">
                {topMusclesByVolume.map(([m, v]) => (
                  <li key={m} className="flex items-center justify-between text-xs">
                    <span>{MUSCLE_LABELS[m]}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {(data.setsPerMuscle[m] ?? 0)} sets · {Math.round(v)} kg·reps
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <RecoveryLegend hours={data.hoursSinceLastHitByMuscle} />
        )}
      </section>

      {data.weekCompare ? (
        <section className="space-y-3 rounded-xl border border-border bg-card/30 p-3">
          <h2 className="font-serif text-base font-normal">This week vs last</h2>
          <CompareWeeksCard
            thisWeek={data.weekCompare.thisWeek}
            lastWeek={data.weekCompare.lastWeek}
            exercises={data.exercises}
          />
        </section>
      ) : null}

      <section className="space-y-3 rounded-xl border border-border bg-card/30 p-3">
        <h2 className="font-serif text-base font-normal">Volume trend</h2>
        <VolumeTrendChart
          sets={data.setsInRange}
          workouts={data.workoutsInRange}
          exercises={data.exercises}
          start={data.start}
          end={data.end}
        />
      </section>

      <section className="space-y-3 rounded-xl border border-border bg-card/30 p-3">
        <h2 className="font-serif text-base font-normal">Frequency by weekday</h2>
        <WeekdayFrequencyChart workoutsPerDay={data.workoutsPerDay} />
      </section>

      <section className="space-y-3 rounded-xl border border-border bg-card/30 p-3">
        <h2 className="font-serif text-base font-normal">Split streaks</h2>
        <SplitStreaksCard streaks={data.splitStreaks ?? []} />
      </section>

      <section className="space-y-3 rounded-xl border border-border bg-card/30 p-3">
        <h2 className="font-serif text-base font-normal">Body weight</h2>
        <BodyWeightChart
          series={data.bodyWeightSeries ?? []}
          delta={data.bodyWeightDelta ?? null}
        />
      </section>

      <section className="space-y-2 rounded-xl border border-border bg-card/30 p-3">
        <h2 className="font-serif text-base font-normal">Split frequency</h2>
        {Object.keys(data.splitFrequency).length === 0 ? (
          <p className="text-xs text-muted-foreground">No workouts in range.</p>
        ) : (
          <ul className="space-y-1.5">
            {Object.entries(data.splitFrequency)
              .sort((a, b) => b[1] - a[1])
              .map(([id, n]) => {
                const split = id === "__free__" ? null : data.splits.find((s) => s.id === id);
                const total = Object.values(data.splitFrequency).reduce((a, b) => a + b, 0);
                const pct = total ? (n / total) * 100 : 0;
                return (
                  <li key={id} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="inline-flex items-center gap-1.5">
                        {split?.emoji ? <span aria-hidden>{split.emoji}</span> : null}
                        <span>{splitName(id as string)}</span>
                      </span>
                      <span className="tabular-nums text-muted-foreground">
                        {n} · {pct.toFixed(0)}%
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted/40">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: split?.color ?? "var(--primary)",
                        }}
                      />
                    </div>
                  </li>
                );
              })}
          </ul>
        )}
      </section>

      <section className="space-y-2 rounded-xl border border-border bg-card/30 p-3">
        <h2 className="font-serif text-base font-normal">Personal records</h2>
        {data.personalRecords.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No PRs landed in this range. Log a heavier set or more reps to crown one.
          </p>
        ) : (
          <ul className="divide-y divide-border/40">
            {data.personalRecords.slice(0, 12).map((pr, i) => {
              const ex = data.exercises.find((e) => e.id === pr.exerciseId);
              const each = ex?.perHand ? " each" : "";
              return (
                <li key={i} className="flex items-center justify-between gap-2 py-1.5 text-xs">
                  <span className="inline-flex items-center gap-2">
                    <Trophy className="size-3.5 text-amber-500" />
                    <span className="font-medium">{pr.exerciseName}</span>
                    <span className="text-muted-foreground">{pr.date.slice(5)}</span>
                  </span>
                  <span className="tabular-nums">
                    {pr.weightKg}kg{each} × {pr.reps}{" "}
                    <span className="text-muted-foreground">
                      · 1RM ~{pr.est1RM.toFixed(1)}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="space-y-2 rounded-xl border border-border bg-card/30 p-3">
        <h2 className="font-serif text-base font-normal">Top exercises</h2>
        {data.topExercises.length === 0 ? (
          <p className="text-xs text-muted-foreground">No exercises logged in this range.</p>
        ) : (
          <ul className="space-y-1.5">
            {data.topExercises.map((ex) => {
              const max = data.topExercises[0]?.volume ?? 1;
              const pct = max ? (ex.volume / max) * 100 : 0;
              return (
                <li key={ex.exerciseId} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="truncate">{ex.name}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {ex.sets} sets · {Math.round(ex.volume)}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted/40">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}

function RecoveryLegend({
  hours,
}: {
  hours: Partial<Record<MuscleGroup, number | null>>;
}) {
  const items: { color: string; label: string }[] = [
    { color: "#dc2626", label: "Fresh (<24h)" },
    { color: "#f59e0b", label: "Recent (24-48h)" },
    { color: "#facc15", label: "Recovering (48-72h)" },
    { color: "#22c55e", label: "Ready (>72h)" },
    { color: "#94a3b8", label: "Untrained (this window)" },
  ];
  const untrained = MUSCLE_GROUPS.filter((m) => hours[m] == null);
  return (
    <div className="pt-2 space-y-2">
      <div className="flex flex-wrap gap-x-3 gap-y-1.5 text-[10px] text-muted-foreground">
        {items.map((it) => (
          <span key={it.label} className="inline-flex items-center gap-1.5">
            <span aria-hidden className="size-2.5 rounded-full" style={{ backgroundColor: it.color }} />
            {it.label}
          </span>
        ))}
      </div>
      {untrained.length > 0 ? (
        <p className="text-[10px] text-muted-foreground">
          Untrained last 14d: {untrained.map((m) => MUSCLE_LABELS[m]).join(", ")}
        </p>
      ) : null}
    </div>
  );
}

function RangeToggle({
  range,
  onChange,
}: {
  range: GymRange;
  onChange: (r: GymRange) => void;
}) {
  return (
    <div className="flex items-center gap-1 rounded-md border border-border bg-muted/30 p-0.5">
      {GYM_RANGES.map((r) => (
        <button
          key={r}
          type="button"
          onClick={() => onChange(r)}
          className={cn(
            "rounded px-2 py-0.5 text-[11px] uppercase tracking-wider transition-colors",
            r === range
              ? "bg-background text-foreground shadow-sm ring-1 ring-border"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {r}d
        </button>
      ))}
    </div>
  );
}

function ModeBtn({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
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

function PageSkeleton() {
  return (
    <>
      <div className="h-96 animate-pulse rounded-md bg-muted/40" />
      <div className="h-48 animate-pulse rounded-md bg-muted/40" />
      <div className="h-48 animate-pulse rounded-md bg-muted/40" />
    </>
  );
}
