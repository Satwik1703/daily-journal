"use client";

import { useMemo } from "react";
import { ArrowDown, ArrowRight, ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { MUSCLE_LABELS, type MuscleGroup } from "@/lib/muscle-groups";
import type { Exercise } from "@/lib/gym-meta";

type WeekAgg = {
  weekKey: string;
  start: string;
  end: string;
  workoutCount: number;
  totalVolume: number;
  totalSets: number;
  topExercises: { exerciseId: string; name: string; topWeightKg: number; topReps: number }[];
  setsPerMuscle: Record<MuscleGroup, number>;
};

export function CompareWeeksCard({
  thisWeek,
  lastWeek,
  exercises,
}: {
  thisWeek: WeekAgg;
  lastWeek: WeekAgg;
  exercises: Exercise[];
}) {
  const exById = useMemo(() => new Map(exercises.map((e) => [e.id, e])), [exercises]);

  const volumeDelta = thisWeek.totalVolume - lastWeek.totalVolume;
  const volumePct =
    lastWeek.totalVolume > 0
      ? Math.round((volumeDelta / lastWeek.totalVolume) * 100)
      : null;

  // Merge top exercises from both weeks (union by name).
  const exUnion = new Map<
    string,
    { name: string; thisTop?: { weight: number; reps: number }; lastTop?: { weight: number; reps: number } }
  >();
  for (const e of thisWeek.topExercises) {
    exUnion.set(e.exerciseId, {
      name: e.name,
      thisTop: { weight: e.topWeightKg, reps: e.topReps },
    });
  }
  for (const e of lastWeek.topExercises) {
    const cur = exUnion.get(e.exerciseId);
    if (cur) cur.lastTop = { weight: e.topWeightKg, reps: e.topReps };
    else
      exUnion.set(e.exerciseId, {
        name: e.name,
        lastTop: { weight: e.topWeightKg, reps: e.topReps },
      });
  }
  const exerciseRows = Array.from(exUnion.entries()).slice(0, 5);

  // Sets per muscle — union, top 6 by combined.
  const muscleUnion: { muscle: MuscleGroup; thisN: number; lastN: number }[] = [];
  const muscleSet = new Set<MuscleGroup>([
    ...(Object.keys(thisWeek.setsPerMuscle) as MuscleGroup[]),
    ...(Object.keys(lastWeek.setsPerMuscle) as MuscleGroup[]),
  ]);
  for (const m of muscleSet) {
    muscleUnion.push({
      muscle: m,
      thisN: thisWeek.setsPerMuscle[m] ?? 0,
      lastN: lastWeek.setsPerMuscle[m] ?? 0,
    });
  }
  muscleUnion.sort((a, b) => (b.thisN + b.lastN) - (a.thisN + a.lastN));
  const muscleRows = muscleUnion.slice(0, 6);
  const muscleMax = Math.max(1, ...muscleRows.map((r) => Math.max(r.thisN, r.lastN)));

  return (
    <div className="space-y-4">
      {/* Volume delta */}
      <div className="flex items-center justify-between gap-3 rounded-md border border-border/60 bg-muted/10 px-3 py-2">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Total volume
          </p>
          <p className="text-lg font-medium tabular-nums">
            {Math.round(thisWeek.totalVolume).toLocaleString()}
            <span className="ml-1 text-xs text-muted-foreground">kg·reps</span>
          </p>
        </div>
        <DeltaPill delta={volumeDelta} pct={volumePct} />
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Last wk</p>
          <p className="text-sm text-muted-foreground tabular-nums">
            {Math.round(lastWeek.totalVolume).toLocaleString()}
          </p>
        </div>
      </div>

      {/* Top exercises */}
      <div>
        <p className="mb-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
          Top lifts
        </p>
        {exerciseRows.length === 0 ? (
          <p className="text-xs text-muted-foreground">No logged lifts yet.</p>
        ) : (
          <ul className="space-y-1">
            {exerciseRows.map(([id, row]) => {
              const each = exById.get(id)?.perHand ? " each" : "";
              return (
                <li key={id} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-2 text-xs">
                  <span className="truncate">{row.name}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {row.lastTop ? `${row.lastTop.weight}kg${each} × ${row.lastTop.reps}` : "—"}
                  </span>
                  <ArrowRight className="size-3 text-muted-foreground/60" />
                  <span className="tabular-nums font-medium">
                    {row.thisTop ? `${row.thisTop.weight}kg${each} × ${row.thisTop.reps}` : "—"}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Sets per muscle bar pairs */}
      <div>
        <p className="mb-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
          Sets per muscle
        </p>
        {muscleRows.length === 0 ? (
          <p className="text-xs text-muted-foreground">No sets logged.</p>
        ) : (
          <ul className="space-y-2">
            {muscleRows.map((r) => (
              <li key={r.muscle} className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span>{MUSCLE_LABELS[r.muscle]}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {r.lastN}
                    <ArrowRight className="mx-1 inline size-3 text-muted-foreground/60" />
                    <span className="font-medium text-foreground">{r.thisN}</span>
                  </span>
                </div>
                <div className="relative h-2 overflow-hidden rounded-full bg-muted/30">
                  <div
                    className="absolute inset-y-0 left-0 rounded-full bg-muted-foreground/30"
                    style={{ width: `${(r.lastN / muscleMax) * 100}%` }}
                  />
                  <div
                    className="absolute inset-y-0 left-0 rounded-full bg-primary"
                    style={{ width: `${(r.thisN / muscleMax) * 100}%`, mixBlendMode: "normal" }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function DeltaPill({ delta, pct }: { delta: number; pct: number | null }) {
  if (delta === 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-muted/40 px-2 py-0.5 text-xs text-muted-foreground">
        no change
      </span>
    );
  }
  const Icon = delta > 0 ? ArrowUp : ArrowDown;
  const color = delta > 0 ? "text-emerald-600 bg-emerald-500/10 dark:text-emerald-300" : "text-amber-600 bg-amber-500/10 dark:text-amber-300";
  return (
    <span className={cn("inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs tabular-nums", color)}>
      <Icon className="size-3" />
      {pct == null ? `${delta > 0 ? "+" : ""}${Math.round(delta).toLocaleString()}` : `${pct > 0 ? "+" : ""}${pct}%`}
    </span>
  );
}
