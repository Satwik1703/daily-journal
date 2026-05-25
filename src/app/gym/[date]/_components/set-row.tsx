"use client";

import { useEffect, useRef, useState } from "react";
import { Minus, Plus, Trash2, Trophy } from "lucide-react";
import { mutate } from "@/lib/sync/mutate";
import { cn } from "@/lib/utils";
import type { WorkoutSet } from "@/lib/gym-meta";

const WEIGHT_STEP = 2.5;
const REPS_STEP = 5;
const DEBOUNCE_MS = 800;

export function SetRow({
  set,
  perHand,
  isPR,
  onUpdate,
  onDelete,
  onDirty,
  onFlushed,
}: {
  set: WorkoutSet;
  perHand: boolean;
  isPR?: boolean;
  onUpdate: (patch: Partial<WorkoutSet>) => void;
  onDelete: () => void;
  onDirty?: (id: string) => void;
  onFlushed?: (id: string) => void;
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

  function flush() {
    if (flushTimerRef.current) {
      clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }
    const patch = pendingPatchRef.current;
    pendingPatchRef.current = {};
    if (Object.keys(patch).length === 0) return;
    void mutate("update_set", { id: setIdRef.current, ...patch });
    onFlushedRef.current?.(setIdRef.current);
  }

  function persist(patch: { reps?: number | null; weightKg?: number | null }) {
    onUpdate(patch);
    pendingPatchRef.current = { ...pendingPatchRef.current, ...patch };
    onDirty?.(set.id);
    if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
    flushTimerRef.current = setTimeout(flush, DEBOUNCE_MS);
  }

  // Flush on unmount (card collapse, row delete, page nav).
  useEffect(() => {
    return () => {
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
      }
      const patch = pendingPatchRef.current;
      pendingPatchRef.current = {};
      if (Object.keys(patch).length === 0) return;
      void mutate("update_set", { id: setIdRef.current, ...patch });
      onFlushedRef.current?.(setIdRef.current);
    };
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
    let next: number | null;
    if (current == null) {
      next = delta > 0 ? Math.abs(delta) : null;
    } else {
      next = Math.max(0, current + delta);
    }
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
  ariaLabel,
  accent = "default",
}: {
  value: number | null;
  suffix: string;
  decimal?: boolean;
  step: number;
  onStep: (delta: number) => void;
  onCommit: (n: number | null) => void;
  ariaLabel: string;
  accent?: "default" | "amber";
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string>(value == null ? "" : String(value));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      setDraft(value == null ? "" : String(value));
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      });
    }
  }, [editing, value]);

  function commit() {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed === "") return onCommit(null);
    const n = decimal ? Number.parseFloat(trimmed) : Number.parseInt(trimmed, 10);
    if (Number.isNaN(n)) return onCommit(value);
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
        onClick={() => setEditing(true)}
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
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commit();
              }
              if (e.key === "Escape") {
                setEditing(false);
                setDraft(value == null ? "" : String(value));
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
