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
  HABIT_TRACKING_KINDS,
  PRESET_COLORS,
  TRACKING_KIND_HINTS,
  TRACKING_KIND_LABELS,
  type HabitTrackingKind,
} from "@/lib/habit-meta";
import { cn } from "@/lib/utils";
import type { Habit } from "@/db/queries/habits";
import { toast } from "sonner";

const SUGGESTED_EMOJI = ["💧", "📚", "🏃", "🧘", "💊", "🥗", "🛌", "🙏", "🎯", "✏️"];

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
    }
  }, [open, habit]);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!name.trim()) return;
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

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              Cancel
            </DialogClose>
            <Button type="submit" disabled={!name.trim()}>
              {habit ? "Save" : "Add habit"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
