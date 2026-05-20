"use client";

import { useMemo, useState, useTransition } from "react";
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
  POMO_METRIC_LABELS,
  PRESET_COLORS,
  autoSplitTargets,
  type GoalType,
  type PomoMetric,
} from "@/lib/goal-meta";
import type { GoalPeriod } from "@/lib/dates";
import type { CategoryOption, HabitOption } from "./add-goal-button";

const EMOJI_SUGGESTIONS = ["📚", "🏋️", "🎯", "🚀", "💪", "🧘", "📈", "💰", "🌱", "🔥"];

const TYPE_OPTIONS: ReadonlyArray<GoalType> = ["number", "habit", "pomodoro", "milestone"];

export function GoalFormDialog({
  open,
  onOpenChange,
  period,
  periodKey,
  habits,
  categories,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  period: GoalPeriod;
  periodKey: string;
  habits: HabitOption[];
  categories: CategoryOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState("");
  const [emoji, setEmoji] = useState<string>("🎯");
  const [color, setColor] = useState<string>(PRESET_COLORS[0]);
  const [type, setType] = useState<GoalType>("number");
  const [targetValue, setTargetValue] = useState("4");
  const [unit, setUnit] = useState("");
  const [habitId, setHabitId] = useState<string>(habits[0]?.id ?? "");
  const [pomoCategoryId, setPomoCategoryId] = useState<string>(""); // "" = all
  const [pomoMetric, setPomoMetric] = useState<PomoMetric>("minutes");
  const [autoSplit, setAutoSplit] = useState<boolean>(period !== "week");

  // Auto-disable habit/pomo types if the user has none yet.
  const habitAvailable = habits.length > 0;
  const pomoAvailable = true;

  function reset() {
    setTitle("");
    setEmoji("🎯");
    setColor(PRESET_COLORS[0]);
    setType("number");
    setTargetValue("4");
    setUnit("");
    setPomoCategoryId("");
    setPomoMetric("minutes");
    setAutoSplit(period !== "week");
  }

  const splitPreview = useMemo(() => {
    if (!autoSplit || period === "week") return null;
    const n = Number(targetValue);
    if (!Number.isFinite(n) || n <= 0) return null;
    const slices = period === "year" ? 12 : 4;
    return autoSplitTargets(n, slices, unit === "min" || unit === "minutes");
  }, [autoSplit, period, targetValue, unit]);

  function submit() {
    if (!title.trim()) {
      toast.error("Give the goal a title");
      return;
    }
    const targetNum = Number(targetValue);
    const needsTarget = type !== "milestone";
    if (needsTarget && (!Number.isFinite(targetNum) || targetNum <= 0)) {
      toast.error("Target must be a positive number");
      return;
    }
    if (type === "habit" && !habitId) {
      toast.error("Pick a habit to link");
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
          targetValue: needsTarget ? targetNum : null,
          unit: needsTarget && unit.trim() ? unit.trim() : null,
          habitId: type === "habit" ? habitId : null,
          pomoCategoryId: type === "pomodoro" && pomoCategoryId ? pomoCategoryId : null,
          pomoMetric: type === "pomodoro" ? pomoMetric : null,
          autoSplitChildren: autoSplit && period !== "week" && needsTarget,
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
                    e === emoji ? "border-primary bg-muted" : "border-input hover:bg-muted",
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
              {TYPE_OPTIONS.map((t) => {
                const available =
                  t === "habit" ? habitAvailable : t === "pomodoro" ? pomoAvailable : true;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => available && setType(t)}
                    disabled={!available}
                    className={cn(
                      "rounded-md border p-2.5 text-left transition-colors",
                      t === type
                        ? "border-primary bg-muted/50"
                        : "border-input hover:bg-muted/40",
                      !available && "cursor-not-allowed opacity-50",
                    )}
                  >
                    <div className="text-sm font-medium">
                      {GOAL_TYPE_LABELS[t]}
                      {t === "habit" && !habitAvailable ? (
                        <span className="ml-1 text-[10px]">(no habits yet)</span>
                      ) : null}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {GOAL_TYPE_HINTS[t]}
                    </div>
                  </button>
                );
              })}
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

          {type === "habit" ? (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="goal-habit">Linked habit</Label>
                <select
                  id="goal-habit"
                  className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm shadow-xs"
                  value={habitId}
                  onChange={(e) => setHabitId(e.target.value)}
                >
                  {habits.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.emoji ? `${h.emoji} ` : ""}{h.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="goal-habit-target">Times in period</Label>
                <Input
                  id="goal-habit-target"
                  inputMode="numeric"
                  value={targetValue}
                  onChange={(e) => setTargetValue(e.target.value)}
                />
                <p className="text-[11px] text-muted-foreground">
                  Counts unique days you logged this habit in the period.
                </p>
              </div>
            </div>
          ) : null}

          {type === "pomodoro" ? (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="goal-pomo-cat">Category</Label>
                <select
                  id="goal-pomo-cat"
                  className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm shadow-xs"
                  value={pomoCategoryId}
                  onChange={(e) => setPomoCategoryId(e.target.value)}
                >
                  <option value="">All categories</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.emoji ? `${c.emoji} ` : ""}{c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-[1fr_1fr] gap-3">
                <div className="space-y-1.5">
                  <Label>Metric</Label>
                  <select
                    className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm shadow-xs"
                    value={pomoMetric}
                    onChange={(e) => setPomoMetric(e.target.value as PomoMetric)}
                  >
                    <option value="minutes">{POMO_METRIC_LABELS.minutes}</option>
                    <option value="pomos">{POMO_METRIC_LABELS.pomos}</option>
                    <option value="sessions">{POMO_METRIC_LABELS.sessions}</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="goal-pomo-target">Target</Label>
                  <Input
                    id="goal-pomo-target"
                    inputMode="decimal"
                    value={targetValue}
                    onChange={(e) => setTargetValue(e.target.value)}
                  />
                </div>
              </div>
            </div>
          ) : null}

          {type === "milestone" ? (
            <p className="rounded-md border border-dashed border-input bg-muted/30 p-3 text-xs text-muted-foreground">
              Add sub-tasks on the goal card after creating it. Each tick counts toward progress.
            </p>
          ) : null}

          {period !== "week" && type !== "milestone" ? (
            <div className="rounded-md border border-dashed border-input bg-muted/20 p-3 space-y-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={autoSplit}
                  onChange={(e) => setAutoSplit(e.target.checked)}
                  className="size-4"
                />
                Auto-create {period === "year" ? "monthly" : "weekly"} children
              </label>
              {splitPreview ? (
                <p className="text-[11px] text-muted-foreground">
                  Split preview: [{splitPreview.map((n) => formatSplit(n)).join(", ")}]
                </p>
              ) : null}
            </div>
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

function formatSplit(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(1);
}
