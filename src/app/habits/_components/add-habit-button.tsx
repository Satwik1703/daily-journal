"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HabitFormDialog, type CategoryOption } from "./habit-form-dialog";
import { cn } from "@/lib/utils";

export function AddHabitButton({
  disabled = false,
  categories,
}: {
  disabled?: boolean;
  categories: CategoryOption[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        size="sm"
        disabled={disabled}
        aria-label={disabled ? "Add a habit (locked off-today)" : "Add a habit"}
        title={disabled ? "Adding habits is locked on past dates" : undefined}
        className={cn(disabled && "opacity-50")}
      >
        <Plus />
        New
      </Button>
      <HabitFormDialog open={open} onOpenChange={setOpen} habit={null} categories={categories} />
    </>
  );
}
