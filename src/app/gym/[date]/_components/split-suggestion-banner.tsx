"use client";

import { customAlphabet } from "nanoid";
import { useState } from "react";
import { Sparkles, X } from "lucide-react";
import { mutate } from "@/lib/sync/mutate";
import type { Split } from "@/lib/gym-meta";

const wid = customAlphabet(
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",
  12,
);

export function SplitSuggestionBanner({
  date,
  suggestion,
  splits,
  workoutId,
  onAccept,
}: {
  date: string;
  suggestion: { splitId: string; splitName: string; daysSince: number };
  splits: Split[];
  workoutId: string | null;
  /** Called after start_workout fires so the parent can flip splitId locally. */
  onAccept: (splitId: string, workoutId: string) => void;
}) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  const split = splits.find((s) => s.id === suggestion.splitId);
  if (!split) return null;

  function accept() {
    const id = workoutId ?? wid();
    onAccept(suggestion.splitId, id);
    void mutate("start_workout", { id, date, splitId: suggestion.splitId });
    setDismissed(true);
  }

  return (
    <div
      className="flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm"
      style={{
        backgroundColor: `${split.color}15`,
        borderColor: `${split.color}55`,
      }}
    >
      <Sparkles className="size-4 shrink-0" style={{ color: split.color }} />
      <span className="min-w-0 flex-1">
        Haven&apos;t done{" "}
        <span className="font-medium">
          {split.emoji ? `${split.emoji} ` : ""}
          {split.name}
        </span>{" "}
        in {suggestion.daysSince} days.
      </span>
      <button
        type="button"
        onClick={accept}
        className="shrink-0 rounded-full px-3 py-1 text-xs font-medium text-foreground"
        style={{
          backgroundColor: `${split.color}30`,
          boxShadow: `inset 0 0 0 1.5px ${split.color}`,
        }}
      >
        Start
      </button>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss suggestion"
        className="rounded p-1 text-muted-foreground/60 hover:bg-muted hover:text-foreground"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
