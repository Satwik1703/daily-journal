"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { createGoal } from "@/app/actions/goals";
import {
  GOAL_TYPE_HINTS,
  GOAL_TYPE_LABELS,
  PRESET_COLORS,
  type GoalType,
} from "@/lib/goal-meta";
import type { GoalPeriod } from "@/lib/dates";

const EMOJI_SUGGESTIONS = ["📚", "🏋️", "🎯", "🚀", "💪", "🧘", "📈", "💰", "🌱", "🔥"];

// Day B supports number + milestone. Habit / pomodoro are surfaced as disabled
// options with a hint about the next slice — keeps the dialog forward-compatible.
const TYPE_OPTIONS: Array<{ value: GoalType; available: boolean }> = [
  { value: "number", available: true },
  { value: "milestone", available: true },
  { value: "habit", available: false },
  { value: "pomodoro", available: false },
];

export function GoalFormDialog({
  open,
  onOpenChange,
  period,
  periodKey,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  period: GoalPeriod;
  periodKey: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState("");
  const [emoji, setEmoji] = useState<string>("🎯");
  const [color, setColor] = useState<string>(PRESET_COLORS[0]);
  const [type, setType] = useState<GoalType>("number");
  const [targetValue, setTargetValue] = useState("4");
  const [unit, setUnit] = useState("");

  function reset() {
    setTitle("");
    setEmoji("🎯");
    setColor(PRESET_COLORS[0]);
    setType("number");
    setTargetValue("4");
    setUnit("");
  }

  function submit() {
    if (!title.trim()) {
      toast.error("Give the goal a title");
      return;
    }
    const targetNum = Number(targetValue);
    if (type === "number" && (!Number.isFinite(targetNum) || targetNum <= 0)) {
      toast.error("Target must be a positive number");
      return;
    }
    startTransition(async () => {
      try {
        await createGoal({
          period,
          periodKey,
          title,
          type,
          emoji,
          color,
          targetValue: type === "number" ? targetNum : null,
          unit: type === "number" && unit.trim() ? unit.trim() : null,
        });
        toast.success("Goal added");
        reset();
        onOpenChange(false);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to add goal");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New goal</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="goal-title">Title</Label>
            <Input
              id="goal-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Read 4 books this week"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label>Emoji</Label>
            <div className="flex flex-wrap gap-1.5">
              {EMOJI_SUGGESTIONS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setEmoji(e)}
                  className={cn(
                    "grid size-8 place-items-center rounded-md border text-lg",
                    e === emoji
                      ? "border-primary bg-muted"
                      : "border-input hover:bg-muted",
                  )}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Color</Label>
            <div className="flex flex-wrap gap-1.5">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={cn(
                    "size-7 rounded-full ring-2 transition-all",
                    c === color ? "ring-foreground" : "ring-transparent",
                  )}
                  style={{ background: c }}
                  aria-label={`Pick color ${c}`}
                />
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Type</Label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {TYPE_OPTIONS.map(({ value, available }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => available && setType(value)}
                  disabled={!available}
                  className={cn(
                    "rounded-md border p-2.5 text-left transition-colors",
                    value === type
                      ? "border-primary bg-muted/50"
                      : "border-input hover:bg-muted/40",
                    !available && "cursor-not-allowed opacity-50",
                  )}
                >
                  <div className="text-sm font-medium">
                    {GOAL_TYPE_LABELS[value]}
                    {!available ? <span className="ml-1 text-[10px]">(soon)</span> : null}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {GOAL_TYPE_HINTS[value]}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {type === "number" ? (
            <div className="grid grid-cols-[1fr_1fr] gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="goal-target">Target</Label>
                <Input
                  id="goal-target"
                  inputMode="decimal"
                  value={targetValue}
                  onChange={(e) => setTargetValue(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="goal-unit">Unit (optional)</Label>
                <Input
                  id="goal-unit"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  placeholder="books, km, sessions…"
                />
              </div>
            </div>
          ) : null}

          {type === "milestone" ? (
            <p className="rounded-md border border-dashed border-input bg-muted/30 p-3 text-xs text-muted-foreground">
              Add sub-tasks on the goal card after creating it. Each tick counts toward progress.
            </p>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={pending}>
              {pending ? "Saving…" : "Save goal"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
