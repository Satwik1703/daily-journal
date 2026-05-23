"use client";

import { useEffect, useRef, useState } from "react";
import TextareaAutosize from "react-textarea-autosize";
import { mutate } from "@/lib/sync/mutate";

export function WorkoutNotes({
  workoutId,
  initialNotes,
  initialDurationMin,
}: {
  workoutId: string;
  initialNotes: string | null;
  initialDurationMin: number | null;
}) {
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [duration, setDuration] = useState<string>(
    initialDurationMin == null ? "" : String(initialDurationMin),
  );
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setNotes(initialNotes ?? "");
  }, [initialNotes]);
  useEffect(() => {
    setDuration(initialDurationMin == null ? "" : String(initialDurationMin));
  }, [initialDurationMin]);

  function schedule(patch: { notes?: string; durationMin?: number | null }) {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      void mutate("update_workout", { id: workoutId, ...patch });
    }, 800);
  }

  return (
    <div className="space-y-2 rounded-xl border border-border bg-card/30 p-3">
      <label className="block text-[11px] uppercase tracking-wider text-muted-foreground">
        Notes
      </label>
      <TextareaAutosize
        minRows={2}
        value={notes}
        onChange={(e) => {
          setNotes(e.target.value);
          schedule({ notes: e.target.value });
        }}
        placeholder="How did it feel? Mood, energy, what hurt, what was easy…"
        className="w-full resize-none rounded-md border border-border/60 bg-background px-2 py-1.5 text-sm leading-snug placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none"
      />
      <div className="flex items-center gap-2 pt-1">
        <label className="text-[11px] uppercase tracking-wider text-muted-foreground">
          Duration
        </label>
        <input
          type="number"
          min="0"
          step="1"
          value={duration}
          onChange={(e) => {
            setDuration(e.target.value);
            const n = e.target.value === "" ? null : Number.parseInt(e.target.value, 10);
            schedule({ durationMin: Number.isNaN(n) ? null : n });
          }}
          placeholder="—"
          className="w-16 rounded border border-border bg-background px-1.5 py-0.5 text-sm tabular-nums focus:border-primary focus:outline-none"
        />
        <span className="text-[11px] text-muted-foreground">min</span>
      </div>
    </div>
  );
}
