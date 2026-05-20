"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GoalFormDialog } from "./goal-form-dialog";
import type { GoalPeriod } from "@/lib/dates";

export function AddGoalButton({
  period,
  periodKey,
  disabled = false,
}: {
  period: GoalPeriod;
  periodKey: string;
  disabled?: boolean;
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
      />
    </>
  );
}
