"use client";

import { customAlphabet } from "nanoid";
import { useTransition, useState } from "react";
import { mutate } from "@/lib/sync/mutate";
import { cn } from "@/lib/utils";
import type { Split, Workout } from "@/lib/gym-meta";

const wid = customAlphabet(
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",
  12,
);

export function SplitPicker({
  date,
  splits,
  workout,
}: {
  date: string;
  splits: Split[];
  workout: Workout | null;
}) {
  const [, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useState<{ splitId: string | null; workoutId: string | null }>({
    splitId: workout?.splitId ?? null,
    workoutId: workout?.id ?? null,
  });

  function pick(splitId: string | null) {
    startTransition(() => {
      const id = optimistic.workoutId ?? wid();
      setOptimistic({ splitId, workoutId: id });
      void mutate("start_workout", { id, date, splitId });
    });
  }

  const current = optimistic.splitId;

  return (
    <div className="flex flex-wrap gap-1.5">
      {splits.map((s) => {
        const active = s.id === current;
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => pick(active ? null : s.id)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors",
              active
                ? "border-transparent text-foreground font-medium"
                : "border-border bg-muted/30 text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
            style={
              active
                ? {
                    backgroundColor: `${s.color}22`,
                    boxShadow: `inset 0 0 0 1.5px ${s.color}`,
                  }
                : undefined
            }
          >
            {s.emoji ? <span aria-hidden>{s.emoji}</span> : null}
            <span>{s.name}</span>
          </button>
        );
      })}
      <button
        type="button"
        onClick={() => pick(null)}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors",
          current == null && optimistic.workoutId
            ? "border-foreground/60 text-foreground font-medium"
            : "border-dashed border-border bg-muted/10 text-muted-foreground hover:bg-muted hover:text-foreground",
        )}
      >
        + Free
      </button>
    </div>
  );
}
