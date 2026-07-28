"use client";

import { useRef, useState } from "react";
import { StickyNote } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  formatSlotLabel,
  type TimeboxCategory,
  type TimeboxSlot,
} from "@/lib/timebox-meta";

const LONG_PRESS_MS = 350;
const CANCEL_MOVE_PX = 8;

export type SlotDisplay = {
  slotIndex: number;
  manual: TimeboxSlot | null;
  ghost: { label: string; categoryId: string | null } | null;
  isNow: boolean;
  isPast: boolean;
};

export function SlotRow({
  display,
  categories,
  selected,
  multiSelectActive,
  onTap,
  onLongPress,
  onGhostPromote,
}: {
  display: SlotDisplay;
  categories: Map<string, TimeboxCategory>;
  selected: boolean;
  multiSelectActive: boolean;
  onTap: (slotIndex: number) => void;
  onLongPress: (slotIndex: number) => void;
  onGhostPromote?: (slotIndex: number) => void;
}) {
  const { slotIndex, manual, ghost, isNow, isPast } = display;
  const category = manual?.categoryId
    ? categories.get(manual.categoryId)
    : ghost?.categoryId
      ? categories.get(ghost.categoryId)
      : null;

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startXY = useRef<{ x: number; y: number } | null>(null);
  const firedLong = useRef(false);
  const [pressing, setPressing] = useState(false);

  function clearTimer() {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  function onPointerDown(e: React.PointerEvent) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    startXY.current = { x: e.clientX, y: e.clientY };
    setPressing(true);
    clearTimer();
    firedLong.current = false;
    timerRef.current = setTimeout(() => {
      firedLong.current = true;
      setPressing(false);
      onLongPress(slotIndex);
    }, LONG_PRESS_MS);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!startXY.current || !timerRef.current) return;
    const dx = Math.abs(e.clientX - startXY.current.x);
    const dy = Math.abs(e.clientY - startXY.current.y);
    if (dx > CANCEL_MOVE_PX || dy > CANCEL_MOVE_PX) {
      clearTimer();
      setPressing(false);
      startXY.current = null;
    }
  }

  function onPointerEnd() {
    clearTimer();
    setPressing(false);
    startXY.current = null;
  }

  function onClick() {
    if (firedLong.current) {
      firedLong.current = false;
      return;
    }
    if (ghost && !manual && onGhostPromote && !multiSelectActive) {
      onGhostPromote(slotIndex);
      return;
    }
    onTap(slotIndex);
  }

  const empty = !manual && !ghost;
  const label = manual?.label ?? ghost?.label ?? "";
  const isGhostOnly = !manual && !!ghost;

  return (
    <button
      type="button"
      data-slot-index={slotIndex}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      onPointerLeave={onPointerEnd}
      onContextMenu={(e) => e.preventDefault()}
      onClick={onClick}
      aria-label={`${formatSlotLabel(slotIndex)}${label ? ` — ${label}` : " — empty"}`}
      style={{ scrollMarginTop: "180px" }}
      className={cn(
        "group relative flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors select-none",
        "touch-manipulation",
        selected && "ring-2 ring-primary bg-primary/5",
        isNow && !selected && "ring-1 ring-primary/50",
        pressing && "scale-[0.99]",
        empty
          ? "text-muted-foreground/50 hover:bg-muted/30"
          : "hover:bg-muted/40",
        isGhostOnly && "opacity-60",
      )}
    >
      {/* left color bar */}
      <span
        aria-hidden
        className={cn(
          "w-1 h-6 shrink-0 rounded-full transition-colors",
          empty ? "bg-transparent" : "",
        )}
        style={category && !empty ? { background: category.color } : undefined}
      />
      {/* time label */}
      <span
        className={cn(
          "w-[62px] shrink-0 text-[11px] tabular-nums leading-tight",
          isNow ? "text-primary font-medium" : "text-muted-foreground",
        )}
      >
        {formatSlotLabel(slotIndex)}
      </span>
      {/* content */}
      <span className="flex min-w-0 flex-1 flex-col leading-tight">
        {empty ? (
          <span className="text-xs italic">— empty —</span>
        ) : (
          <>
            <span className="flex items-center gap-1 truncate text-sm">
              {category?.emoji ? <span>{category.emoji}</span> : null}
              <span
                className={cn(
                  "truncate",
                  isGhostOnly ? "italic" : "font-medium",
                )}
              >
                {label || (category?.name ?? "")}
              </span>
              {isGhostOnly ? (
                <span className="ml-1 rounded bg-amber-500/15 px-1 text-[9px] uppercase text-amber-700 dark:text-amber-300">
                  auto
                </span>
              ) : null}
            </span>
            {manual?.note ? (
              <span className="flex items-center gap-1 truncate text-[11px] text-muted-foreground">
                <StickyNote className="size-2.5 shrink-0" />
                <span className="truncate">{manual.note}</span>
              </span>
            ) : null}
          </>
        )}
      </span>
      {isPast && !empty && manual ? (
        <span className="text-[10px] text-muted-foreground/60">✓</span>
      ) : null}
    </button>
  );
}
