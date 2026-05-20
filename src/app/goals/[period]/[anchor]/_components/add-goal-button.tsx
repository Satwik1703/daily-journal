"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GoalFormDialog } from "./goal-form-dialog";
import type { GoalPeriod } from "@/lib/dates";

export type HabitOption = { id: string; name: string; emoji: string | null; color: string };
export type CategoryOption = { id: string; name: string; emoji: string | null; color: string };

export function AddGoalButton({
  period,
  periodKey,
  disabled = false,
  habits,
  categories,
}: {
  period: GoalPeriod;
  periodKey: string;
  disabled?: boolean;
  habits: HabitOption[];
  categories: CategoryOption[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        size="sm"
        className="gap-1.5"
        onClick={() => setOpen(true)}
        disabled={disabled}
        title={disabled ? "Adding goals is locked on closed periods" : undefined}
      >
        <Plus className="size-4" /> Add goal
      </Button>
      <GoalFormDialog
        open={open}
        onOpenChange={setOpen}
        period={period}
        periodKey={periodKey}
        habits={habits}
        categories={categories}
      />
    </>
  );
}
