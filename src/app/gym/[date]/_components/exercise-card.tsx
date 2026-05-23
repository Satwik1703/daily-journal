"use client";

import { customAlphabet } from "nanoid";
import { useState } from "react";
import { ChevronDown, ChevronUp, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { mutate } from "@/lib/sync/mutate";
import { cn } from "@/lib/utils";
import { MUSCLE_LABELS } from "@/lib/muscle-groups";
import type {
  Exercise,
  WorkoutSet,
  SetPrefill,
  ProgressionSuggestion,
} from "@/lib/gym-meta";
import { SetRow } from "./set-row";

const setIdGen = customAlphabet(
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",
  12,
);

type SetWithFlags = WorkoutSet & { isPR?: boolean };

export function ExerciseCard({
  date,
  workoutId,
  exercise,
  sets,
  prefill,
  progression,
  onLocalSets,
  removable,
  onRemove,
}: {
  date: string;
  workoutId: string;
  exercise: Exercise;
  sets: SetWithFlags[];
  prefill: SetPrefill;
  progression?: ProgressionSuggestion;
  onLocalSets: (next: SetWithFlags[]) => void;
  removable?: boolean;
  onRemove?: () => void;
}) {
  const [open, setOpen] = useState(true);

  function nextSetNumber(): number {
    return (sets.at(-1)?.setNumber ?? 0) + 1;
  }
  function defaultsForNextSet(): SetPrefill {
    if (sets.length > 0) {
      const last = sets[sets.length - 1];
      return { reps: last.reps, weightKg: last.weightKg };
    }
    return prefill;
  }

  async function addSet() {
    const id = setIdGen();
    const { reps, weightKg } = defaultsForNextSet();
    const setNumber = nextSetNumber();
    const optimistic: SetWithFlags = {
      id,
      workoutId,
      exerciseId: exercise.id,
      setNumber,
      reps,
      weightKg,
      rpe: null,
      isWarmup: false,
      note: null,
      createdAt: Date.now(),
    };
    onLocalSets([...sets, optimistic]);

    const { id: mid } = await mutate("log_set", {
      id,
      workoutId,
      exerciseId: exercise.id,
      setNumber,
      reps,
      weightKg,
      date,
    });
    void mid;
    // PR detection happens server-side; we won't know until the next page refetch.
    // For instant feedback, do a lightweight client-side PR check: did this match/exceed
    // any prior set's weight in the same exercise? — defer to insights fetcher.
  }

  function updateSet(id: string, patch: Partial<WorkoutSet>) {
    onLocalSets(sets.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }
  function deleteSet(id: string) {
    onLocalSets(sets.filter((s) => s.id !== id));
    void mutate("delete_set", { id, date });
    toast.success("Set deleted");
  }

  const eachSuffix = exercise.perHand ? " each" : "";
  const subtitle =
    prefill.reps != null || prefill.weightKg != null
      ? `Last: ${prefill.reps ?? "—"}${
          prefill.weightKg != null ? ` × ${prefill.weightKg}kg${eachSuffix}` : ""
        }`
      : exercise.perHand
        ? "No history yet · weight is per-hand"
        : "No history yet";

  return (
    <div
      className="rounded-xl border border-border bg-card/30"
      style={{
        boxShadow: open ? `inset 4px 0 0 0 ${exercise.color}` : undefined,
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-start justify-between gap-2 px-3 py-2.5 text-left"
      >
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex items-center gap-1.5 truncate text-[15px] font-medium">
            {exercise.emoji ? <span aria-hidden>{exercise.emoji}</span> : null}
            <span className="truncate">{exercise.name}</span>
            {exercise.perHand ? (
              <span className="rounded-full bg-amber-500/15 px-1.5 py-0 text-[10px] font-medium text-amber-600 dark:text-amber-300">
                each
              </span>
            ) : null}
          </span>
          <span className="truncate text-[11px] text-muted-foreground">
            {sets.length > 0
              ? `${sets.length} set${sets.length === 1 ? "" : "s"} done · ${subtitle}`
              : subtitle}
          </span>
          {progression && progression.kind !== "none" ? (
            <span className="truncate text-[11px] italic text-primary/80">
              ↗ {progression.message}
              {exercise.perHand ? " each" : ""}
            </span>
          ) : null}
          <span className="mt-0.5 flex flex-wrap gap-1">
            {exercise.muscleGroups.slice(0, 4).map((m) => (
              <span
                key={m}
                className="rounded bg-muted/40 px-1.5 py-0 text-[10px] text-muted-foreground"
              >
                {MUSCLE_LABELS[m]}
              </span>
            ))}
          </span>
        </span>
        <span className="flex items-center gap-1">
          {removable ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRemove?.();
              }}
              aria-label="Remove exercise"
              className="rounded p-1 text-muted-foreground/60 hover:bg-muted hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          ) : null}
          {open ? (
            <ChevronUp className="size-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="size-4 text-muted-foreground" />
          )}
        </span>
      </button>

      {open ? (
        <div className="border-t border-border/60 px-3 py-2">
          {sets.length === 0 ? (
            <p className="py-1 text-xs text-muted-foreground">No sets yet.</p>
          ) : (
            <div className="divide-y divide-border/40">
              {sets.map((s) => (
                <SetRow
                  key={s.id}
                  set={s}
                  perHand={exercise.perHand}
                  isPR={s.isPR}
                  onUpdate={(p) => updateSet(s.id, p)}
                  onDelete={() => deleteSet(s.id)}
                />
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={addSet}
            className={cn(
              "mt-2 inline-flex items-center gap-1.5 rounded-full border border-dashed border-border px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
            )}
          >
            <Plus className="size-3" /> Add Set
            {defaultsForNextSet().reps != null || defaultsForNextSet().weightKg != null ? (
              <span className="text-[10px] opacity-60">
                ({defaultsForNextSet().weightKg ?? "—"}
                {defaultsForNextSet().weightKg != null ? `kg${eachSuffix}` : ""}
                {" × "}
                {defaultsForNextSet().reps ?? "—"})
              </span>
            ) : null}
          </button>
        </div>
      ) : null}
    </div>
  );
}
