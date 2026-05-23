"use client";

import { useEffect, useMemo, useState } from "react";
import { nanoid } from "nanoid";
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
import { mutate } from "@/lib/sync/mutate";
import {
  GOAL_TYPE_HINTS,
  GOAL_TYPE_LABELS,
  POMO_METRIC_LABELS,
  PRESET_COLORS,
  autoSplitTargets,
  type GoalType,
  type PomoMetric,
} from "@/lib/goal-meta";
import {
  enumerateWeeksThrough,
  periodKeyFor,
  todayLocal,
  type GoalPeriod,
} from "@/lib/dates";
import type { CategoryOption, HabitOption } from "./add-goal-button";

type RepeatThrough = "week" | "endOfMonth" | "endOfYear";
const MONTH_LABELS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const EMOJI_SUGGESTIONS = ["📚", "🏋️", "🎯", "🚀", "💪", "🧘", "📈", "💰", "🌱", "🔥"];

const TYPE_OPTIONS: ReadonlyArray<GoalType> = ["number", "habit", "pomodoro", "milestone"];

export type GoalEditable = {
  id: string;
  title: string;
  emoji: string | null;
  color: string;
  type: GoalType;
  targetValue: number | null;
  unit: string | null;
  habitId: string | null;
  pomoCategoryId: string | null;
  pomoMetric: PomoMetric | null;
  pinned: boolean;
};

export function GoalFormDialog({
  open,
  onOpenChange,
  period,
  periodKey,
  habits,
  categories,
  goal = null,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  period: GoalPeriod;
  periodKey: string;
  habits: HabitOption[];
  categories: CategoryOption[];
  /** If present, dialog runs in edit mode for that goal. */
  goal?: GoalEditable | null;
}) {
  const isEdit = goal != null;
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
  const [pinned, setPinned] = useState<boolean>(false);

  // ---------- Reverse-cascade state (week view only) ----------
  const today = todayLocal();
  const todayMonthKey = periodKeyFor(today, "month");
  const currentYear = period === "week" ? Number(periodKey.slice(0, 4)) : new Date().getFullYear();
  const futureMonthKeys = useMemo(() => {
    if (period !== "week") return [];
    const out: string[] = [];
    for (let m = 1; m <= 12; m++) {
      const key = `${currentYear}-${String(m).padStart(2, "0")}`;
      if (key >= todayMonthKey) out.push(key);
    }
    return out;
  }, [period, currentYear, todayMonthKey]);
  const [repeat, setRepeat] = useState<RepeatThrough>("week");
  const [repeatMonth, setRepeatMonth] = useState<string>(futureMonthKeys[0] ?? todayMonthKey);

  // Sync form to goal in edit mode whenever the dialog opens or goal changes.
  useEffect(() => {
    if (!open) return;
    if (goal) {
      setTitle(goal.title);
      setEmoji(goal.emoji ?? "🎯");
      setColor(goal.color);
      setType(goal.type);
      setTargetValue(goal.targetValue != null ? String(goal.targetValue) : "");
      setUnit(goal.unit ?? "");
      if (goal.habitId) setHabitId(goal.habitId);
      setPomoCategoryId(goal.pomoCategoryId ?? "");
      setPomoMetric(goal.pomoMetric ?? "minutes");
      setPinned(goal.pinned === true);
      setAutoSplit(false);
      setRepeat("week");
    }
  }, [open, goal]);

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
    setPinned(false);
    setRepeat("week");
    setRepeatMonth(futureMonthKeys[0] ?? todayMonthKey);
  }

  // Live preview of the reverse-cascade rows that will be created.
  const repeatPreview = useMemo(() => {
    if (period !== "week" || type === "milestone" || repeat === "week") return null;
    try {
      const endRef = repeat === "endOfYear" ? String(currentYear) : repeatMonth;
      const weeks = enumerateWeeksThrough(periodKey, repeat, endRef);
      const months = new Set<string>();
      for (const wk of weeks) months.add(wk.slice(0, 4)); // dummy use; recomputed below
      months.clear();
      // Group by Thursday month: rough estimate via slice on the iso year
      // is wrong; rely on count of unique months by stripping the week number
      // (we don't need pixel-perfect here, just an approx). The action does
      // the canonical grouping.
      const monthSet = new Set<string>();
      for (const wk of weeks) {
        const yr = wk.slice(0, 4);
        const wnum = Number(wk.slice(6, 8));
        // Approximate month from week number: weeks 1-4≈Jan, 5-8≈Feb, ... 49-53≈Dec
        const approxMonth = Math.min(11, Math.floor((wnum - 1) / 4.345));
        monthSet.add(`${yr}-${String(approxMonth + 1).padStart(2, "0")}`);
      }
      return {
        weekCount: weeks.length,
        monthCount: monthSet.size,
        yearCount: repeat === "endOfYear" ? 1 : 0,
      };
    } catch {
      return null;
    }
  }, [period, type, repeat, repeatMonth, currentYear, periodKey]);

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
    if (isEdit && goal) {
      void mutate("update_goal_cascade", {
        id: goal.id,
        title,
        emoji: emoji || null,
        color,
        targetValue: needsTarget ? targetNum : null,
        unit: needsTarget && unit.trim() ? unit.trim() : null,
        habitId: goal.type === "habit" ? (habitId || null) : null,
        pomoCategoryId: goal.type === "pomodoro" ? (pomoCategoryId || null) : null,
        pomoMetric: goal.type === "pomodoro" ? pomoMetric : null,
        pinned,
      });
      toast.success("Saved · current + future updated");
      onOpenChange(false);
      return;
    }
    const isReverseCascade = period === "week" && repeat !== "week" && type !== "milestone";
    void mutate("create_goal", {
      id: nanoid(12),
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
      pinned,
      repeat: isReverseCascade
        ? {
            through: repeat as "endOfMonth" | "endOfYear",
            monthKey: repeat === "endOfMonth" ? repeatMonth : undefined,
          }
        : undefined,
    });
    toast.success("Goal added");
    reset();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit goal" : "New goal"}</DialogTitle>
          {isEdit ? (
            <p className="text-[11px] text-muted-foreground">
              Edits apply to this + every current and future instance in the cascade.
              Past instances stay as history.
            </p>
          ) : null}
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

          <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-input bg-muted/20 px-3 py-2 text-sm">
            <input
              type="checkbox"
              checked={pinned}
              onChange={(e) => setPinned(e.target.checked)}
              className="size-4"
            />
            <span className="flex-1">Pin to top section</span>
            <span className="text-[11px] text-muted-foreground">
              Surfaces in &ldquo;Important&rdquo;
            </span>
          </label>

          <div className="space-y-1.5">
            <Label>Type</Label>
            {isEdit ? (
              <p className="rounded-md border border-input bg-muted/30 p-2.5 text-xs text-muted-foreground">
                {GOAL_TYPE_LABELS[type]} — type can&apos;t be changed after creation.
              </p>
            ) : (
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
            )}
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

          {!isEdit && period !== "week" && type !== "milestone" ? (
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

          {!isEdit && period === "week" && type !== "milestone" ? (
            <div className="rounded-md border border-dashed border-input bg-muted/20 p-3 space-y-2">
              <Label>Repeat through</Label>
              <div className="space-y-1.5 text-sm">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="repeat"
                    value="week"
                    checked={repeat === "week"}
                    onChange={() => setRepeat("week")}
                  />
                  This week only
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="repeat"
                    value="endOfMonth"
                    checked={repeat === "endOfMonth"}
                    onChange={() => setRepeat("endOfMonth")}
                    disabled={futureMonthKeys.length === 0}
                  />
                  End of month:
                  <select
                    value={repeatMonth}
                    onChange={(e) => setRepeatMonth(e.target.value)}
                    disabled={repeat !== "endOfMonth" || futureMonthKeys.length === 0}
                    className="h-7 rounded-md border border-input bg-background px-2 text-xs shadow-xs disabled:opacity-50"
                  >
                    {futureMonthKeys.map((k) => {
                      const monthIdx = Number(k.slice(5)) - 1;
                      return (
                        <option key={k} value={k}>
                          {MONTH_LABELS[monthIdx]} {k.slice(0, 4)}
                        </option>
                      );
                    })}
                  </select>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="repeat"
                    value="endOfYear"
                    checked={repeat === "endOfYear"}
                    onChange={() => setRepeat("endOfYear")}
                  />
                  End of year ({currentYear})
                </label>
              </div>
              {repeatPreview && repeat !== "week" ? (
                <p className="text-[11px] text-muted-foreground">
                  Will create {repeatPreview.weekCount} weekly clone{repeatPreview.weekCount === 1 ? "" : "s"}
                  {" + "}{repeatPreview.monthCount} monthly parent{repeatPreview.monthCount === 1 ? "" : "s"}
                  {repeatPreview.yearCount > 0 ? " + 1 yearly parent" : ""}.
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={submit}>
              {isEdit ? "Save changes" : "Save goal"}
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
