"use client";

import { useEffect, useState } from "react";
import { nanoid } from "nanoid";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatLocalYMD, isValidDateString, todayLocal } from "@/lib/dates";
import {
  POMO_DURATIONS,
  fmtMinutes,
  type PomoDurationKey,
} from "@/lib/pomodoro-meta";
import type { PomoCategory } from "@/db/queries/pomodoro-categories";
import { CategoryPicker } from "./category-picker";
import { mutate } from "@/lib/sync/mutate";

const MAX_POMOS = 10;

export function ManualSessionDialog({
  open,
  onOpenChange,
  categories,
  defaultDate,
  defaultCategoryId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: PomoCategory[];
  defaultDate: string;
  defaultCategoryId: string | null;
}) {
  const [date, setDate] = useState<string>(defaultDate);
  const [time, setTime] = useState<string>("");
  const [pomoCount, setPomoCount] = useState<number>(1);
  const [pomoKind, setPomoKind] = useState<PomoDurationKey>("full");
  const [categoryId, setCategoryId] = useState<string | null>(defaultCategoryId);
  const [description, setDescription] = useState<string>("");

  useEffect(() => {
    if (!open) return;
    setDate(defaultDate);
    setCategoryId(defaultCategoryId);
    setDescription("");
    setPomoCount(1);
    setPomoKind("full");
    const d = new Date();
    setTime(
      `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`,
    );
  }, [open, defaultDate, defaultCategoryId]);

  const kindMin = POMO_DURATIONS.find((d) => d.key === pomoKind)!.min;
  const totalMin = kindMin * pomoCount;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!isValidDateString(date)) {
      toast.error("Invalid date");
      return;
    }
    if (!/^\d{2}:\d{2}$/.test(time)) {
      toast.error("Invalid time");
      return;
    }
    if (!Number.isInteger(pomoCount) || pomoCount < 1 || pomoCount > MAX_POMOS) {
      toast.error(`Number of pomos must be 1–${MAX_POMOS}`);
      return;
    }
    if (date > todayLocal()) {
      toast.error("Can't log a future date");
      return;
    }
    const [y, mo, da] = date.split("-").map(Number);
    const [h, m] = time.split(":").map(Number);
    const baseMs = new Date(y, mo - 1, da, h, m, 0, 0).getTime();
    const desc = description.trim() || null;

    for (let i = 0; i < pomoCount; i++) {
      const startedAt = baseMs + i * kindMin * 60_000;
      const endedAt = startedAt + kindMin * 60_000;
      const sessionDate = formatLocalYMD(new Date(startedAt));
      void mutate("create_session", {
        id: nanoid(12),
        date: sessionDate,
        startedAt,
        endedAt,
        durationMin: kindMin,
        plannedMin: kindMin,
        categoryId,
        description: desc,
        source: "manual",
      });
    }
    toast.success(
      pomoCount === 1
        ? `Logged ${kindMin}m`
        : `Logged ${pomoCount} pomos · ${fmtMinutes(totalMin)} total`,
    );
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full min-w-0">
        <DialogHeader>
          <DialogTitle className="font-serif text-base">Add session manually</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="w-full min-w-0 space-y-4">
          <div className="grid grid-cols-[1fr_1fr] gap-3 min-w-0">
            <div className="space-y-1.5 min-w-0">
              <Label htmlFor="manual-date">Date</Label>
              <Input
                id="manual-date"
                type="date"
                value={date}
                max={todayLocal()}
                onChange={(e) => setDate(e.target.value)}
                className="w-full min-w-0"
                required
              />
            </div>
            <div className="space-y-1.5 min-w-0">
              <Label htmlFor="manual-time">Start time</Label>
              <Input
                id="manual-time"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full min-w-0"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5 min-w-0">
            <Label htmlFor="manual-pomo-count">Number of pomos</Label>
            <Input
              id="manual-pomo-count"
              type="number"
              min={1}
              max={MAX_POMOS}
              value={pomoCount}
              onChange={(e) => {
                const n = Number(e.target.value);
                setPomoCount(Number.isFinite(n) ? Math.max(1, Math.min(MAX_POMOS, Math.floor(n))) : 1);
              }}
              className="w-full min-w-0"
              required
            />
          </div>

          <div className="space-y-1.5 min-w-0">
            <Label>Pomo length</Label>
            <div className="grid grid-cols-2 gap-2">
              {POMO_DURATIONS.map((d) => (
                <button
                  key={d.key}
                  type="button"
                  onClick={() => setPomoKind(d.key)}
                  className={cn(
                    "rounded-md border px-2 py-2 text-xs transition-colors",
                    pomoKind === d.key
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border text-muted-foreground hover:bg-muted",
                  )}
                >
                  <span className="font-medium">{d.label}</span>
                </button>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground tabular-nums">
              {pomoCount} {pomoCount === 1 ? "pomo" : "pomos"} × {kindMin} min ={" "}
              {fmtMinutes(totalMin)} total
              {pomoCount > 1 ? " · saved as separate sessions back-to-back" : ""}
            </p>
          </div>

          <div className="space-y-1.5 min-w-0">
            <Label>Category</Label>
            <CategoryPicker
              categories={categories}
              selectedId={categoryId}
              onSelect={setCategoryId}
            />
          </div>

          <div className="space-y-1.5 min-w-0">
            <Label htmlFor="manual-desc">Description</Label>
            <Textarea
              id="manual-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What did you work on?"
              className="w-full min-w-0"
              rows={3}
            />
            {pomoCount > 1 ? (
              <p className="text-[11px] text-muted-foreground">
                Same description applied to all {pomoCount} sessions.
              </p>
            ) : null}
          </div>

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              Cancel
            </DialogClose>
            <Button type="submit">
              {pomoCount === 1 ? "Add" : `Add ${pomoCount} pomos`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
