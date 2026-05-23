"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Star, BookOpen } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { mutate } from "@/lib/sync/mutate";
import { formatHumanDate, type DateString } from "@/lib/dates";
import type { GoalWithDerived } from "@/db/queries/goals";

export function ReflectionSheet({
  open,
  onOpenChange,
  goal,
  periodEnd,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  goal: GoalWithDerived;
  periodEnd: DateString;
}) {
  const [rating, setRating] = useState<number>(3);
  const [note, setNote] = useState<string>("");
  const [linkToJournal, setLinkToJournal] = useState<boolean>(true);

  const achieved = goal.status === "achieved";
  const target =
    goal.targetValue ?? ((goal.checklist?.length ?? 0) || 1);

  function submit() {
    if (!note.trim()) {
      toast.error("Write a quick note");
      return;
    }
    void mutate("save_reflection", {
      goalId: goal.id,
      note,
      rating,
      linkedDate: linkToJournal ? periodEnd : null,
    });
    onOpenChange(false);
    toast.success("Reflection saved");
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Reflect — {goal.title}</SheetTitle>
        </SheetHeader>
        <div className="space-y-4 px-4 pb-4">
          <div className={cn(
            "rounded-md border px-3 py-2 text-sm",
            achieved
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
              : "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300",
          )}>
            {achieved ? "✓ Achieved" : "✗ Missed"} — {formatValue(goal.currentValue)} / {formatValue(target)}
            {goal.unit ? ` ${goal.unit}` : ""}
          </div>

          <div className="space-y-1.5">
            <Label>Rate the period</Label>
            <div className="flex items-center gap-1.5">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRating(n)}
                  className={cn(
                    "rounded p-1",
                    n <= rating ? "text-amber-500" : "text-muted-foreground/40",
                  )}
                  aria-label={`Rate ${n}`}
                >
                  <Star className="size-5" fill={n <= rating ? "currentColor" : "none"} />
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="reflection-note">What worked, what didn&apos;t?</Label>
            <Textarea
              id="reflection-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="A sentence is enough."
              rows={4}
              autoFocus
            />
          </div>

          <label className="flex items-start gap-2 rounded-md border border-dashed border-input bg-muted/30 p-3 text-sm">
            <input
              type="checkbox"
              checked={linkToJournal}
              onChange={(e) => setLinkToJournal(e.target.checked)}
              className="mt-1 size-4"
            />
            <span className="flex-1">
              <span className="flex items-center gap-1.5 font-medium">
                <BookOpen className="size-3.5" /> Save to journal on {formatHumanDate(periodEnd)}
              </span>
              <span className="block text-[11px] text-muted-foreground">
                Adds a checked-off secondary task with the reflection note.
              </span>
            </span>
          </label>

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Skip
            </Button>
            <Button onClick={submit}>
              {"Save"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function formatValue(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(1);
}
