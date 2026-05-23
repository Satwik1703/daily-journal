"use client";

import { useState } from "react";
import { Pin, PinOff } from "lucide-react";
import { toast } from "sonner";
import { mutate } from "@/lib/sync/mutate";
import { cn } from "@/lib/utils";

/**
 * Tiny floating pin/unpin button rendered in the corner of every goal card.
 * Moves the goal between the "Important" top section and the main list.
 * Optimistic: flips local state immediately + queues server mutation.
 */
export function PinToggleButton({
  goalId,
  pinned,
}: {
  goalId: string;
  pinned: boolean;
}) {
  const [optimisticPinned, setOptimisticPinned] = useState(pinned);
  const Icon = optimisticPinned ? PinOff : Pin;
  return (
    <button
      type="button"
      aria-label={optimisticPinned ? "Unpin from Important" : "Pin to Important"}
      title={optimisticPinned ? "Unpin from Important" : "Pin to Important"}
      onClick={() => {
        const next = !optimisticPinned;
        setOptimisticPinned(next);
        void mutate("set_goal_pinned", { id: goalId, pinned: next });
        toast.success(next ? "Pinned to Important" : "Unpinned");
      }}
      className={cn(
        "grid size-7 place-items-center rounded-full transition-colors",
        optimisticPinned
          ? "bg-primary/15 text-primary hover:bg-primary/25"
          : "text-muted-foreground/60 hover:bg-muted hover:text-foreground",
      )}
    >
      <Icon className="size-3.5" />
    </button>
  );
}
