"use client";

import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { Minus, Plus, Trash2, Trophy } from "lucide-react";
import { mutate } from "@/lib/sync/mutate";
import { cn } from "@/lib/utils";
import type { WorkoutSet } from "@/lib/gym-meta";

const WEIGHT_STEP = 2.5;
const REPS_STEP = 5;
const REPS_LADDER: number[] = [0, 5, 8, 10, 12, 15, 20];
const DEBOUNCE_MS = 800;

function nextRepsLadder(current: number | null, delta: number): number | null {
  if (delta === 0) return current;
  if (current == null) {
    return delta > 0 ? REPS_LADDER[0] : null;
  }
  if (delta > 0) {
    for (const v of REPS_LADDER) {
      if (v > current) return v;
    }
    return current;
  }
  for (let i = REPS_LADDER.length - 1; i >= 0; i--) {
    if (REPS_LADDER[i] < current) return REPS_LADDER[i];
  }
  return current;
}

export function SetRow({
  set,
  perHand,
  isPR,
  onUpdate,
  onDelete,
  onDirty,
  onFlushed,
  newSetLogPromisesRef,
}: {
  set: WorkoutSet;
  perHand: boolean;
  isPR?: boolean;
  onUpdate: (patch: Partial<WorkoutSet>) => void;
  onDelete: () => void;
  onDirty?: (id: string) => void;
  onFlushed?: (id: string) => void;
  /**
   * Map from set-id → Promise resolving to log_set POST success. Populated
   * by the parent when a set is added via optimistic UI. `flush()` awaits
   * this before firing `update_set` so a fast stepper edit doesn't race
   * the row-insert and get silently no-op'd.
   */
  newSetLogPromisesRef?: MutableRefObject<Map<string, Promise<boolean>>>;
}) {
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingPatchRef = useRef<Partial<WorkoutSet>>({});
  // Stable refs so the unmount/visibility effects don't need to re-bind
  // every render. setId capture for the flush hand-shake. Refs sync inside
  // an effect (lint rule: no ref writes during render).
  const setIdRef = useRef(set.id);
  const onFlushedRef = useRef(onFlushed);
  useEffect(() => {
    setIdRef.current = set.id;
    onFlushedRef.current = onFlushed;
  });

  async function flush() {
    if (flushTimerRef.current) {
      clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }
    const patch = pendingPatchRef.current;
    pendingPatchRef.current = {};
    if (Object.keys(patch).length === 0) return;
    const id = setIdRef.current;
    // If this set was just added via "Add Set" and its log_set POST is
    // still in flight, wait for the row to actually exist server-side
    // before firing update_set. Otherwise UPDATE runs against a missing
    // row (0 rows affected, silent no-op) and the user's stepper edit is
    // lost the moment the log_set commits with default values.
    const pending = newSetLogPromisesRef?.current.get(id);
    if (pending) {
      const ok = await pending;
      if (!ok) {
        // log_set never landed — don't send an orphaned update_set.
        onFlushedRef.current?.(id);
        return;
      }
    }
    void mutate("update_set", { id, ...patch });
    onFlushedRef.current?.(id);
  }

  function persist(patch: { reps?: number | null; weightKg?: number | null }) {
    onUpdate(patch);
    pendingPatchRef.current = { ...pendingPatchRef.current, ...patch };
    onDirty?.(set.id);
    if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
    flushTimerRef.current = setTimeout(flush, DEBOUNCE_MS);
  }

  // Flush on unmount (card collapse, row delete, page nav). Same gating
  // as flush() — wait for log_set on freshly-added sets before firing
  // update_set, otherwise unmount races the insert.
  useEffect(() => {
    const pendingsRef = newSetLogPromisesRef;
    return () => {
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
      }
      const patch = pendingPatchRef.current;
      pendingPatchRef.current = {};
      if (Object.keys(patch).length === 0) return;
      const id = setIdRef.current;
      const pending = pendingsRef?.current.get(id);
      const send = async () => {
        if (pending) {
          const ok = await pending;
          if (!ok) {
            onFlushedRef.current?.(id);
            return;
          }
        }
        void mutate("update_set", { id, ...patch });
        onFlushedRef.current?.(id);
      };
      void send();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Flush when tab goes to background — keeps prod data fresh even if user
  // backgrounds the app mid-edit.
  useEffect(() => {
    function onHidden() {
      if (document.visibilityState === "hidden") flush();
    }
    document.addEventListener("visibilitychange", onHidden);
    return () => document.removeEventListener("visibilitychange", onHidden);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function stepWeight(delta: number) {
    const current = set.weightKg;
    let next: number | null;
    if (current == null) {
      next = delta > 0 ? Math.abs(delta) : null;
    } else {
      next = Math.max(0, current + delta);
      if (next === 0 && delta < 0) next = 0;
    }
    if (next === current) return;
    persist({ weightKg: next });
  }
  function stepReps(delta: number) {
    const current = set.reps;
    const next = nextRepsLadder(current, delta);
    if (next === current) return;
    persist({ reps: next });
  }

  return (
    <div className="flex items-center gap-2 py-2">
      <span className="w-6 shrink-0 text-center text-xs font-medium text-muted-foreground">
        {set.setNumber}
      </span>

      {/* Weight stepper */}
      <Stepper
        ariaLabel="Weight"
        value={set.weightKg}
        suffix={perHand ? "kg each" : "kg"}
        decimal
        step={WEIGHT_STEP}
        onStep={stepWeight}
        onEdit={() => onDirty?.(set.id)}
        onCommit={(n) => {
          persist({ weightKg: n });
          flush();
        }}
        accent={perHand ? "amber" : "default"}
      />

      {/* Reps stepper */}
      <Stepper
        ariaLabel="Reps"
        value={set.reps}
        suffix="reps"
        step={REPS_STEP}
        onStep={stepReps}
        onEdit={() => onDirty?.(set.id)}
        onCommit={(n) => {
          persist({ reps: n });
          flush();
        }}
      />

      <div className="ml-auto flex items-center gap-1">
        {isPR ? (
          <span
            className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-300"
            title="Personal record"
          >
            <Trophy className="size-3" /> PR
          </span>
        ) : null}
        <button
          type="button"
          onClick={onDelete}
          aria-label="Delete set"
          className="rounded p-1 text-muted-foreground/50 hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>
    </div>
  );
}

function Stepper({
  value,
  suffix,
  decimal,
  step,
  onStep,
  onCommit,
  onEdit,
  ariaLabel,
  accent = "default",
}: {
  value: number | null;
  suffix: string;
  decimal?: boolean;
  step: number;
  onStep: (delta: number) => void;
  onCommit: (n: number | null) => void;
  onEdit?: () => void;
  ariaLabel: string;
  accent?: "default" | "amber";
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string>(value == null ? "" : String(value));
  const inputRef = useRef<HTMLInputElement>(null);
  const valueRef = useRef(value);
  useEffect(() => {
    valueRef.current = value;
  });

  // Only seed draft + focus on the false→true transition. Crucially DO NOT
  // depend on `value` here — a parent refetch landing mid-edit would
  // otherwise overwrite the user's typed input.
  useEffect(() => {
    if (!editing) return;
    setDraft(valueRef.current == null ? "" : String(valueRef.current));
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
  }, [editing]);

  function commit() {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed === "") return onCommit(null);
    const n = decimal ? Number.parseFloat(trimmed) : Number.parseInt(trimmed, 10);
    if (Number.isNaN(n)) return onCommit(valueRef.current);
    onCommit(Math.max(0, n));
  }

  const accentRing =
    accent === "amber"
      ? "ring-amber-400/40 bg-amber-500/5"
      : "ring-border bg-muted/20";

  return (
    <div
      className={cn(
        "flex shrink-0 items-stretch overflow-hidden rounded-md ring-1 transition-colors",
        accentRing,
      )}
    >
      <StepBtn
        ariaLabel={`Decrease ${ariaLabel} by ${step}`}
        onClick={() => onStep(-step)}
        disabled={value == null || value <= 0}
      >
        <Minus className="size-3.5" />
      </StepBtn>
      <button
        type="button"
        onClick={() => {
          if (!editing) onEdit?.();
          setEditing(true);
        }}
        aria-label={`Edit ${ariaLabel}`}
        className="flex min-w-[70px] flex-col items-center justify-center px-2 py-1 leading-none transition-colors hover:bg-muted"
      >
        {editing ? (
          <input
            ref={inputRef}
            type="number"
            inputMode={decimal ? "decimal" : "numeric"}
            step={decimal ? "0.5" : "1"}
            value={draft}
            onChange={(e) => {
              onEdit?.();
              setDraft(e.target.value);
            }}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commit();
              }
              if (e.key === "Escape") {
                setEditing(false);
                setDraft(valueRef.current == null ? "" : String(valueRef.current));
              }
            }}
            className="w-full bg-transparent text-center text-sm tabular-nums focus:outline-none"
          />
        ) : (
          <span
            className={cn(
              "text-sm tabular-nums",
              value == null && "text-muted-foreground/40",
            )}
          >
            {value == null ? "—" : value}
          </span>
        )}
        <span className="mt-0.5 text-[9px] uppercase tracking-wider text-muted-foreground">
          {suffix}
        </span>
      </button>
      <StepBtn ariaLabel={`Increase ${ariaLabel} by ${step}`} onClick={() => onStep(step)}>
        <Plus className="size-3.5" />
      </StepBtn>
    </div>
  );
}

function StepBtn({
  children,
  onClick,
  ariaLabel,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  ariaLabel: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      disabled={disabled}
      className={cn(
        "flex w-8 items-center justify-center text-muted-foreground transition-colors",
        "hover:bg-muted hover:text-foreground active:bg-muted",
        "disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent",
      )}
    >
      {children}
    </button>
  );
}
