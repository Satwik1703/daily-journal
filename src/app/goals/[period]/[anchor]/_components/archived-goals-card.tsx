"use client";

import { useState, useTransition } from "react";
import { RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { deleteGoalCascade, unarchiveGoal } from "@/app/actions/goals";
import { goals } from "@/db/schema";

type GoalRow = typeof goals.$inferSelect;

/**
 * Collapsible card listing archived goals for the current period. Each row
 * shows the goal's emoji + title + restore button + delete-forever button.
 * Unarchiving cascades to the linked habit (Phase 7C bi-directional rule).
 */
export function ArchivedGoalsCard({ goals: archived }: { goals: GoalRow[] }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  return (
    <Card className="bg-muted/20">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between font-serif text-base font-normal">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
          >
            <span>Archived ({archived.length})</span>
            <span className="text-xs">{open ? "Hide" : "Show"}</span>
          </button>
        </CardTitle>
      </CardHeader>
      {open ? (
        <CardContent className="space-y-1.5">
          {archived.map((g) => (
            <ArchivedRow key={g.id} goal={g} onChanged={() => router.refresh()} />
          ))}
        </CardContent>
      ) : null}
    </Card>
  );
}

function ArchivedRow({ goal, onChanged }: { goal: GoalRow; onChanged: () => void }) {
  const [pending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  return (
    <div className="flex items-center gap-2 rounded-md border border-dashed border-border px-3 py-2 opacity-80">
      <span
        aria-hidden
        className="flex size-7 shrink-0 items-center justify-center rounded-full text-sm"
        style={{ backgroundColor: goal.color, color: "#fff" }}
      >
        {goal.emoji ?? "•"}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm">{goal.title}</div>
        <div className="truncate text-[10px] uppercase tracking-wider text-muted-foreground">
          {goal.type}
          {goal.habitId ? " · habit-linked" : null}
        </div>
      </div>
      <Button
        size="icon-sm"
        variant="ghost"
        aria-label="Unarchive"
        disabled={pending}
        onClick={() => {
          startTransition(async () => {
            try {
              await unarchiveGoal(goal.id);
              toast.success(
                goal.habitId ? "Restored goal + linked habit" : "Restored",
              );
              onChanged();
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Failed");
            }
          });
        }}
      >
        <RotateCcw />
      </Button>
      <Button
        size="icon-sm"
        variant="ghost"
        aria-label="Delete forever"
        className="text-destructive hover:bg-destructive/10"
        onClick={() => setConfirmOpen(true)}
      >
        <Trash2 />
      </Button>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-serif text-base">Delete forever?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Deletes this goal and its current + future cascade. Past instances stay as history.
          </p>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="ghost" />}>
              Cancel
            </DialogClose>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() => {
                startTransition(async () => {
                  try {
                    await deleteGoalCascade(goal.id);
                    toast.success("Deleted");
                    setConfirmOpen(false);
                    onChanged();
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Failed");
                  }
                });
              }}
            >
              {pending ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
