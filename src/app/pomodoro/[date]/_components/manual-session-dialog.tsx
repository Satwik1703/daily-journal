"use client";

import { useEffect, useState, useTransition } from "react";
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
import { isValidDateString, todayLocal } from "@/lib/dates";
import type { PomoCategory } from "@/db/queries/pomodoro-categories";
import { CategoryPicker } from "./category-picker";
import { createSession } from "@/app/actions/pomodoro";

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
  const [duration, setDuration] = useState<number>(50);
  const [categoryId, setCategoryId] = useState<string | null>(defaultCategoryId);
  const [description, setDescription] = useState<string>("");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    setDate(defaultDate);
    setCategoryId(defaultCategoryId);
    setDescription("");
    setDuration(50);
    // sensible default time: now
    const d = new Date();
    setTime(
      `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`,
    );
  }, [open, defaultDate, defaultCategoryId]);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!isValidDateString(date)) {
      toast.error("Invalid date");
      return;
    }
    if (!/^\d{2}:\d{2}$/.test(time)) {
      toast.error("Invalid time");
      return;
    }
    if (!Number.isFinite(duration) || duration < 1) {
      toast.error("Duration must be ≥ 1");
      return;
    }
    if (date > todayLocal()) {
      toast.error("Can't log a future date");
      return;
    }
    const [y, mo, da] = date.split("-").map(Number);
    const [h, m] = time.split(":").map(Number);
    const startedAt = new Date(y, mo - 1, da, h, m, 0, 0).getTime();
    const endedAt = startedAt + duration * 60_000;

    startTransition(async () => {
      try {
        await createSession({
          date,
          startedAt,
          endedAt,
          durationMin: duration,
          plannedMin: duration,
          categoryId,
          description: description.trim() || null,
          source: "manual",
        });
        toast.success(`Logged ${duration}m`);
        onOpenChange(false);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to save");
      }
    });
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
            <Label htmlFor="manual-duration">Duration (min)</Label>
            <Input
              id="manual-duration"
              type="number"
              min={1}
              max={600}
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className="w-full min-w-0"
              required
            />
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
          </div>

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              Cancel
            </DialogClose>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Add"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
