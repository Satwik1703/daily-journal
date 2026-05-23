"use client";

import { useState, useTransition } from "react";
import { MoreHorizontal, Pencil, Trash2, Archive, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { archiveGoal, deleteGoalCascade, unarchiveGoal } from "@/app/actions/goals";
import { GoalFormDialog, type GoalEditable } from "./goal-form-dialog";
import type { CategoryOption, HabitOption } from "./add-goal-button";
import type { GoalWithDerived } from "@/db/queries/goals";
import type { GoalPeriod } from "@/lib/dates";
import type { GoalType, PomoMetric } from "@/lib/goal-meta";

/**
 * Floating kebab menu next to the pin button. Owns the edit dialog + the
 * delete confirm dialog. Both flow through the cross-level cascade.
 */
export function GoalActionsMenu({
  goal,
  period,
  periodKey,
  habits,
  categories,
}: {
  goal: GoalWithDerived;
  period: GoalPeriod;
  periodKey: string;
  habits: HabitOption[];
  categories: CategoryOption[];
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const editable: GoalEditable = {
    id: goal.id,
    title: goal.title,
    emoji: goal.emoji,
    color: goal.color,
    type: goal.type as GoalType,
    targetValue: goal.targetValue,
    unit: goal.unit,
    habitId: goal.habitId,
    pomoCategoryId: goal.pomoCategoryId,
    pomoMetric: goal.pomoMetric as PomoMetric | null,
    pinned: goal.pinned === true,
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Actions for ${goal.title}`}
              className="size-7 rounded-full text-muted-foreground/60 hover:bg-muted hover:text-foreground"
            />
          }
        >
          <MoreHorizontal className="size-3.5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setEditOpen(true)}>
            <Pencil />
            Edit goal
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              const isArchived = goal.archivedAt != null;
              startTransition(async () => {
                try {
                  if (isArchived) {
                    await unarchiveGoal(goal.id);
                    toast.success(
                      goal.habitId ? "Restored goal + linked habit" : "Restored",
                    );
                  } else {
                    await archiveGoal(goal.id);
                    toast.success(
                      goal.habitId ? "Archived goal + linked habit" : "Archived",
                    );
                  }
                  router.refresh();
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Failed");
                }
              });
            }}
          >
            {goal.archivedAt ? <RotateCcw /> : <Archive />}
            {goal.archivedAt ? "Unarchive" : "Archive"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => setConfirmOpen(true)}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 />
            Delete…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <GoalFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        period={period}
        periodKey={periodKey}
        habits={habits}
        categories={categories}
        goal={editable}
      />

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-serif text-base">Delete goal?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Deletes this goal and its current + future cascade across week / month / year.
            Past instances stay as history.
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
                    toast.success("Deleted current + future instances");
                    setConfirmOpen(false);
                    router.refresh();
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Failed to delete");
                  }
                });
              }}
            >
              {pending ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
