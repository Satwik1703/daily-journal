"use client";

import { customAlphabet } from "nanoid";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { useCachedPage } from "@/lib/sync/cache";
import { mutate } from "@/lib/sync/mutate";
import { formatHumanDate } from "@/lib/dates";
import {
  buildVolumeFillFor,
  sumVolumeByMuscle,
  sumSetsByMuscle,
  sortByPosition,
  type Exercise,
  type ProgressionSuggestion,
  type Split,
  type SplitExercise,
  type Workout,
  type WorkoutSet,
  type SetPrefill,
} from "@/lib/gym-meta";
import { WorkoutDateStepper } from "./workout-date-stepper";
import { SplitPicker } from "./split-picker";
import { ExerciseCard } from "./exercise-card";
import { AddExerciseSheet } from "./add-exercise-sheet";
import { WorkoutNotes } from "./workout-notes";
import { BodyWeightCard } from "./body-weight-card";
import { SplitSuggestionBanner } from "./split-suggestion-banner";
import { Body3DDynamic } from "@/components/body-3d";

const wid = customAlphabet(
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",
  12,
);

type PageData = {
  date: string;
  workout: Workout | null;
  sets: WorkoutSet[];
  splits: Split[];
  exercises: Exercise[];
  joins: SplitExercise[];
  prefill: Record<string, SetPrefill>;
  progressionSuggestions: Record<string, ProgressionSuggestion>;
  splitSuggestion:
    | { splitId: string; splitName: string; daysSince: number }
    | null;
  bodyWeight: {
    latest: {
      id: string;
      date: string;
      weightKg: number;
      note: string | null;
      createdAt: number;
    } | null;
    last7: { date: string; weightKg: number }[];
  };
};

export function GymPageClient({ date }: { date: string }) {
  const data = useCachedPage<PageData | null>(
    `gym:v2:${date}`,
    null,
    async () => {
      const res = await fetch(`/api/page/gym/${date}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Fetch failed");
      return (await res.json()) as PageData;
    },
  );

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pt-4 pb-8 space-y-4">
      <WorkoutDateStepper date={date} />

      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-serif text-2xl font-normal leading-tight">Gym</h1>
          <p className="text-xs text-muted-foreground">{formatHumanDate(date)}</p>
        </div>
        <Link
          href="/gym/insights"
          className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Sparkles className="size-3.5" /> Insights
        </Link>
      </div>

      {data == null ? <PageSkeleton /> : <Loaded date={date} data={data} />}
    </div>
  );
}

function Loaded({ date, data }: { date: string; data: PageData }) {
  // Local optimistic copies of mutable data
  const [workoutId, setWorkoutId] = useState<string | null>(data.workout?.id ?? null);
  const [splitId, setSplitId] = useState<string | null>(data.workout?.splitId ?? null);
  const [sets, setSets] = useState<WorkoutSet[]>(data.sets);
  const [extraExerciseIds, setExtraExerciseIds] = useState<string[]>([]);

  // Track sets with locally-pending edits that haven't flushed to /api/sync
  // yet. Reset by the SetRow flush hand-shake (onSetFlushed).
  const dirtySetIdsRef = useRef<Set<string>>(new Set());
  const markSetDirty = useCallback((id: string) => {
    dirtySetIdsRef.current.add(id);
  }, []);
  const markSetFlushed = useCallback((id: string) => {
    dirtySetIdsRef.current.delete(id);
  }, []);

  // Sync optimistic state when server data arrives. Crucially, keep local
  // state for any set whose mutate is still queued — otherwise a refetch
  // that lands while the user is hammering the stepper would briefly
  // roll back the visible value to the last server commit.
  useEffect(() => {
    if (data.workout?.id && data.workout.id !== workoutId) setWorkoutId(data.workout.id);
    if (data.workout?.splitId !== undefined && data.workout.splitId !== splitId) {
      setSplitId(data.workout?.splitId ?? null);
    }
    setSets((prev) => {
      if (dirtySetIdsRef.current.size === 0) return data.sets;
      const localById = new Map(prev.map((s) => [s.id, s]));
      return data.sets.map((s) =>
        dirtySetIdsRef.current.has(s.id) ? (localById.get(s.id) ?? s) : s,
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.workout?.id, data.workout?.splitId, data.sets]);

  const exById = useMemo(
    () => new Map(data.exercises.map((e) => [e.id, e])),
    [data.exercises],
  );

  // Compute ordered exercise list for the current view:
  //   1. exercises in this split (by split-exercises.position)
  //   2. exercises with logged sets today that aren't in (1)
  //   3. extra picks added via "Add Exercise"
  const orderedExercises = useMemo<Exercise[]>(() => {
    const inSplit: Exercise[] =
      splitId == null
        ? []
        : sortByPosition(data.joins.filter((j) => j.splitId === splitId))
            .map((j) => exById.get(j.exerciseId))
            .filter((e): e is Exercise => e != null);
    const shown = new Set(inSplit.map((e) => e.id));
    const usedToday: Exercise[] = [];
    for (const s of sets) {
      if (shown.has(s.exerciseId)) continue;
      const ex = exById.get(s.exerciseId);
      if (ex && !usedToday.find((e) => e.id === ex.id)) {
        usedToday.push(ex);
        shown.add(ex.id);
      }
    }
    const extras: Exercise[] = [];
    for (const id of extraExerciseIds) {
      if (shown.has(id)) continue;
      const ex = exById.get(id);
      if (ex) {
        extras.push(ex);
        shown.add(id);
      }
    }
    return [...inSplit, ...usedToday, ...extras];
  }, [splitId, data.joins, exById, sets, extraExerciseIds]);

  const setsByExercise = useMemo(() => {
    const m = new Map<string, WorkoutSet[]>();
    for (const s of sets) {
      const arr = m.get(s.exerciseId) ?? [];
      arr.push(s);
      m.set(s.exerciseId, arr);
    }
    for (const arr of m.values()) {
      arr.sort((a, b) => a.setNumber - b.setNumber || a.createdAt - b.createdAt);
    }
    return m;
  }, [sets]);

  function ensureWorkout(): string {
    if (workoutId) return workoutId;
    const id = wid();
    setWorkoutId(id);
    void mutate("start_workout", { id, date, splitId });
    return id;
  }

  function handleAddExercise(exerciseId: string) {
    setExtraExerciseIds((arr) => [...arr, exerciseId]);
    ensureWorkout();
  }

  // 3D body — today's hit muscles
  const todayPerMuscle = useMemo(() => {
    const haveWeight = sets.some((s) => (s.weightKg ?? 0) > 0);
    return haveWeight
      ? sumVolumeByMuscle(sets, data.exercises)
      : sumSetsByMuscle(sets, data.exercises);
  }, [sets, data.exercises]);
  const todayFillFor = useMemo(
    () => buildVolumeFillFor(todayPerMuscle),
    [todayPerMuscle],
  );

  const totalSets = sets.length;
  const usedExerciseIds = new Set(orderedExercises.map((e) => e.id));

  return (
    <>
      <BodyWeightCard
        date={date}
        latest={data.bodyWeight?.latest ?? null}
        last7={data.bodyWeight?.last7 ?? []}
      />

      {data.splitSuggestion && splitId == null ? (
        <SplitSuggestionBanner
          date={date}
          suggestion={data.splitSuggestion}
          splits={data.splits}
          workoutId={workoutId}
          onAccept={(sid, wid) => {
            setSplitId(sid);
            setWorkoutId(wid);
          }}
        />
      ) : null}

      {/* progressionSuggestions safety: stale IDB cache may lack the key */}
      {/* (consumed below in ExerciseCard via data.progressionSuggestions?.[ex.id]) */}

      <SplitPicker
        date={date}
        splits={data.splits}
        workout={
          workoutId
            ? {
                id: workoutId,
                date,
                splitId,
                notes: data.workout?.notes ?? null,
                durationMin: data.workout?.durationMin ?? null,
                createdAt: data.workout?.createdAt ?? 0,
              }
            : null
        }
      />

      <div className="rounded-xl border border-border bg-card/30 p-3">
        <div className="flex items-baseline justify-between">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Today&apos;s muscles
          </p>
          <p className="text-[11px] text-muted-foreground">
            {totalSets} {totalSets === 1 ? "set" : "sets"} ·{" "}
            {orderedExercises.length}{" "}
            {orderedExercises.length === 1 ? "exercise" : "exercises"}
          </p>
        </div>
        <Body3DDynamic fillFor={todayFillFor} height={260} />
      </div>

      {orderedExercises.length === 0 && splitId == null ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/20 p-6 text-center text-sm text-muted-foreground">
          Pick a split above, or tap <em>Add Exercise</em> for a free-form session.
        </div>
      ) : (
        <div className="space-y-2">
          {orderedExercises.map((ex) => (
            <ExerciseCard
              key={ex.id}
              date={date}
              workoutId={workoutId ?? ensureWorkout()}
              exercise={ex}
              sets={setsByExercise.get(ex.id) ?? []}
              prefill={data.prefill[ex.id] ?? { reps: null, weightKg: null }}
              progression={data.progressionSuggestions?.[ex.id]}
              onSetDirty={markSetDirty}
              onSetFlushed={markSetFlushed}
              onLocalSets={(next) =>
                setSets((all) => {
                  const others = all.filter((s) => s.exerciseId !== ex.id);
                  return [...others, ...next];
                })
              }
              removable={
                splitId == null ||
                !data.joins.some(
                  (j) => j.splitId === splitId && j.exerciseId === ex.id,
                )
              }
              onRemove={() => {
                setExtraExerciseIds((arr) => arr.filter((id) => id !== ex.id));
                // Also delete any sets logged against this exercise today.
                const toDelete = (setsByExercise.get(ex.id) ?? []).map((s) => s.id);
                if (toDelete.length > 0) {
                  setSets((all) => all.filter((s) => s.exerciseId !== ex.id));
                  for (const sid of toDelete) {
                    void mutate("delete_set", { id: sid, date });
                  }
                  toast.success(`Removed ${ex.name} + ${toDelete.length} set(s)`);
                }
              }}
            />
          ))}
        </div>
      )}

      <AddExerciseSheet
        exercises={data.exercises}
        alreadyShownIds={usedExerciseIds}
        onPick={handleAddExercise}
      />

      {workoutId ? (
        <WorkoutNotes
          workoutId={workoutId}
          initialNotes={data.workout?.notes ?? null}
          initialDurationMin={data.workout?.durationMin ?? null}
        />
      ) : null}
    </>
  );
}

function PageSkeleton() {
  return (
    <>
      <div className="h-12 animate-pulse rounded-md bg-muted/40" />
      <div className="h-64 animate-pulse rounded-md bg-muted/40" />
      <div className="h-40 animate-pulse rounded-md bg-muted/40" />
      <div className="h-40 animate-pulse rounded-md bg-muted/40" />
    </>
  );
}
