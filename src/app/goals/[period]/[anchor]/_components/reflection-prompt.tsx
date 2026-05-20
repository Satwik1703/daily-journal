"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ReflectionSheet } from "./reflection-sheet";
import type { GoalWithDerived } from "@/db/queries/goals";
import type { DateString } from "@/lib/dates";

/**
 * Small "Reflect →" button + bottom sheet, rendered under finalized goals
 * that don't have a reflection saved yet. Lives in its own client component
 * so the parent card can stay a server component.
 */
export function ReflectionPrompt({
  goal,
  periodEnd,
  anchorId,
}: {
  goal: GoalWithDerived;
  periodEnd: DateString;
  anchorId?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div id={anchorId} className="-mt-1.5 mb-2 flex justify-end">
      <Button
        size="xs"
        variant="outline"
        className="gap-1.5 text-primary"
        onClick={() => setOpen(true)}
      >
        <Sparkles className="size-3" /> Reflect
      </Button>
      <ReflectionSheet
        open={open}
        onOpenChange={setOpen}
        goal={goal}
        periodEnd={periodEnd}
      />
    </div>
  );
}
