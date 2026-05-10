"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HabitFormDialog } from "./habit-form-dialog";

export function AddHabitButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)} size="sm">
        <Plus />
        New
      </Button>
      <HabitFormDialog open={open} onOpenChange={setOpen} habit={null} />
    </>
  );
}
