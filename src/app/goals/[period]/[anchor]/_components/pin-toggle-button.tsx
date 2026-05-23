"use client";

import { useTransition } from "react";
import { Pin, PinOff } from "lucide-react";
import { toast } from "sonner";
import { setGoalPinned } from "@/app/actions/goals";
import { cn } from "@/lib/utils";

/**
 * Tiny floating pin/unpin button rendered in the corner of every goal card.
 * Moves the goal between the "Important" top section and the main list.
 */
export function PinToggleButton({
  goalId,
  pinned,
}: {
  goalId: string;
  pinned: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const Icon = pinned ? PinOff : Pin;
  return (
    <button
      type="button"
      aria-label={pinned ? "Unpin from Important" : "Pin to Important"}
      title={pinned ? "Unpin from Important" : "Pin to Important"}
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          try {
            await setGoalPinned({ id: goalId, pinned: !pinned });
            toast.success(pinned ? "Unpinned" : "Pinned to Important");
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to pin");
          }
        });
      }}
      className={cn(
        "grid size-7 place-items-center rounded-full transition-colors",
        pinned
          ? "bg-primary/15 text-primary hover:bg-primary/25"
          : "text-muted-foreground/60 hover:bg-muted hover:text-foreground",
        pending && "opacity-50",
      )}
    >
      <Icon className="size-3.5" />
    </button>
  );
}
