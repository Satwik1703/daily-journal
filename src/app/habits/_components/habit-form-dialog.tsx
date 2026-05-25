"use client";

import { useEffect, useState } from "react";
import { nanoid } from "nanoid";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { mutate } from "@/lib/sync/mutate";
import {
  arrayFromWeekdayMask,
  HABIT_TRACKING_KINDS,
  PRESET_COLORS,
  TRACKING_KIND_HINTS,
  TRACKING_KIND_LABELS,
  WEEKDAY_LABELS,
  WEEKDAY_MASK_ALL,
  WEEKDAY_MASK_WEEKDAYS,
  WEEKDAY_MASK_WEEKENDS,
  weekdayMaskFromArray,
  type HabitTrackingKind,
} from "@/lib/habit-meta";
import { cn } from "@/lib/utils";
import type { Habit } from "@/db/queries/habits";
import { toast } from "sonner";

const SUGGESTED_EMOJI = ["💧", "📚", "🏃", "🧘", "💊", "🥗", "🛌", "🙏", "🎯", "✏️"];

function difficultyLabel(d: number): string {
  if (d <= 0.7) return "(easy)";
  if (d <= 1.2) return "(default)";
  if (d <= 1.7) return "(medium)";
  if (d <= 2.5) return "(hard)";
  return "(insane)";
}

export type CategoryOption = {
  id: string;
  name: string;
  emoji: string | null;
  color: string;
};

export function HabitFormDialog({
  open,
  onOpenChange,
  habit,
  categories,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  habit: Habit | null;
  categories: CategoryOption[];
}) {
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState<string>("");
  const [color, setColor] = useState<string>(PRESET_COLORS[0]);
  const [trackingKind, setTrackingKind] = useState<HabitTrackingKind>("binary");
  const [dailyTarget, setDailyTarget] = useState<string>("");
  const [unit, setUnit] = useState<string>("");
  const [pomoCategoryId, setPomoCategoryId] = useState<string>("");
  const [weekdays, setWeekdays] = useState<boolean[]>(() => arrayFromWeekdayMask(WEEKDAY_MASK_ALL));
  const [difficulty, setDifficulty] = useState<number>(1.0);

  // Reset form fields when the dialog opens.
  useEffect(() => {
    if (open) {
      setName(habit?.name ?? "");
      setEmoji(habit?.emoji ?? "");
      setColor(habit?.color ?? PRESET_COLORS[0]);
      setTrackingKind((habit?.trackingKind as HabitTrackingKind) ?? "binary");
      setDailyTarget(habit?.dailyTarget != null ? String(habit.dailyTarget) : "");
      setUnit(habit?.unit ?? "");
      setPomoCategoryId(habit?.pomoCategoryId ?? "");
      setWeekdays(arrayFromWeekdayMask(habit?.weekdayMask ?? WEEKDAY_MASK_ALL));
      setDifficulty(habit?.difficulty ?? 1.0);
    }
  }, [open, habit]);

  const weekdayMask = weekdayMaskFromArray(weekdays);
  const anyDayOn = weekdayMask > 0;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!name.trim()) return;
    if (!anyDayOn) {
      toast.error("Pick at least one day");
      return;
    }
    const targetNum = dailyTarget.trim() ? Number(dailyTarget) : null;
    if (trackingKind !== "binary") {
      if (targetNum == null || !Number.isFinite(targetNum) || targetNum <= 0) {
        toast.error("Daily target must be a positive number");
        return;
      }
    }
    if (trackingKind === "pomodoro" && !pomoCategoryId) {
      toast.error("Pick a pomodoro category");
      return;
    }
    const payload = {
      name,
      emoji: emoji || null,
      color,
      trackingKind,
      dailyTarget: trackingKind === "binary" ? null : targetNum,
      unit: trackingKind === "number" ? unit || null : null,
      pomoCategoryId: trackingKind === "pomodoro" ? pomoCategoryId : null,
      weekdayMask,
      difficulty,
    };
    if (habit) {
      void mutate("update_habit", { id: habit.id, ...payload });
      toast.success(`Updated “${name}”`);
    } else {
      void mutate("create_habit", { id: nanoid(12), ...payload });
      toast.success(`Added “${name}”`);
    }
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif text-base">
            {habit ? "Edit habit" : "New habit"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="habit-name">Name</Label>
            <Input
              id="habit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Read 30 minutes"
              maxLength={80}
              autoFocus
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="habit-emoji">Emoji</Label>
            <div className="flex flex-wrap items-center gap-1.5">
              <Input
                id="habit-emoji"
                value={emoji}
                onChange={(e) => setEmoji(e.target.value)}
                placeholder=""
                maxLength={8}
                className="w-14 text-center text-lg"
              />
              <div className="flex flex-wrap gap-1">
                {SUGGESTED_EMOJI.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => setEmoji(e)}
                    className={cn(
                      "size-8 rounded-md border border-transparent text-base transition-colors hover:bg-muted",
                      emoji === e && "border-primary bg-primary/10",
                    )}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Color</Label>
            <div className="flex flex-wrap gap-2">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  aria-label={`Color ${c}`}
                  className={cn(
                    "size-8 rounded-full ring-offset-2 ring-offset-popover transition-all",
                    color === c ? "ring-2 ring-foreground" : "ring-0",
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>How to track</Label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {HABIT_TRACKING_KINDS.map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setTrackingKind(k)}
                  className={cn(
                    "rounded-md border p-2.5 text-left transition-colors",
                    k === trackingKind
                      ? "border-primary bg-muted/50"
                      : "border-input hover:bg-muted/40",
                  )}
                >
                  <div className="text-sm font-medium">{TRACKING_KIND_LABELS[k]}</div>
                  <div className="text-[11px] text-muted-foreground">{TRACKING_KIND_HINTS[k]}</div>
                </button>
              ))}
            </div>
          </div>

          {trackingKind === "number" ? (
            <div className="grid grid-cols-[1fr_1fr] gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="habit-target">Daily target</Label>
                <Input
                  id="habit-target"
                  inputMode="decimal"
                  value={dailyTarget}
                  onChange={(e) => setDailyTarget(e.target.value)}
                  placeholder="5000"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="habit-unit">Unit (optional)</Label>
                <Input
                  id="habit-unit"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  placeholder="steps, pages…"
                />
              </div>
            </div>
          ) : null}

          {trackingKind === "pomodoro" ? (
            <div className="grid grid-cols-[1fr_1fr] gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="habit-pomo-cat">Category</Label>
                <select
                  id="habit-pomo-cat"
                  value={pomoCategoryId}
                  onChange={(e) => setPomoCategoryId(e.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm shadow-xs"
                >
                  <option value="">Pick…</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.emoji ? `${c.emoji} ` : ""}
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="habit-pomo-target">Sessions/day</Label>
                <Input
                  id="habit-pomo-target"
                  inputMode="numeric"
                  value={dailyTarget}
                  onChange={(e) => setDailyTarget(e.target.value)}
                  placeholder="1"
                />
              </div>
            </div>
          ) : null}

          <div className="space-y-1.5">
            <Label>Active on</Label>
            <div className="flex flex-wrap gap-1.5">
              {WEEKDAY_LABELS.map((label, i) => {
                const on = weekdays[i];
                return (
                  <button
                    key={i}
                    type="button"
                    aria-pressed={on}
                    onClick={() => {
                      const next = [...weekdays];
                      next[i] = !next[i];
                      setWeekdays(next);
                    }}
                    className={cn(
                      "min-w-[44px] rounded-md border px-2 py-1.5 text-xs transition-colors",
                      on
                        ? "border-primary bg-primary/15 text-foreground"
                        : "border-input text-muted-foreground hover:bg-muted/40",
                    )}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            <div className="flex flex-wrap gap-1 pt-1">
              <button
                type="button"
                onClick={() => setWeekdays(arrayFromWeekdayMask(WEEKDAY_MASK_ALL))}
                className="rounded-md border border-input px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-muted/40"
              >
                Daily
              </button>
              <button
                type="button"
                onClick={() => setWeekdays(arrayFromWeekdayMask(WEEKDAY_MASK_WEEKDAYS))}
                className="rounded-md border border-input px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-muted/40"
              >
                Weekdays
              </button>
              <button
                type="button"
                onClick={() => setWeekdays(arrayFromWeekdayMask(WEEKDAY_MASK_WEEKENDS))}
                className="rounded-md border border-input px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-muted/40"
              >
                Weekends
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="habit-difficulty">Difficulty</Label>
              <span className="text-xs tabular-nums text-muted-foreground">
                ×{difficulty.toFixed(1)} {difficultyLabel(difficulty)}
              </span>
            </div>
            <input
              id="habit-difficulty"
              type="range"
              min={0.5}
              max={3}
              step={0.1}
              value={difficulty}
              onChange={(e) => setDifficulty(Number(e.target.value))}
              className="w-full accent-primary"
            />
            <div className="flex justify-between text-[10px] uppercase tracking-wider text-muted-foreground/70">
              <span>Easy</span>
              <span>Default</span>
              <span>Hard</span>
            </div>
          </div>

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              Cancel
            </DialogClose>
            <Button type="submit" disabled={!name.trim() || !anyDayOn}>
              {habit ? "Save" : "Add habit"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
