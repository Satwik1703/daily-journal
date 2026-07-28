"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { TimeboxCategory } from "@/lib/timebox-meta";

const LONG_PRESS_MS = 500;
const CANCEL_MOVE_PX = 8;

/**
 * Sticky-bottom category chips row.
 *
 *   Tap        → fill the current live slot with this category + default label.
 *   Long-press → apply this category to every slot from the last-filled slot
 *                (inclusive of the one after it) up to and including the
 *                current live slot. Perfect for catching up an hour later.
 */
export function CategoryChips({
  categories,
  activeCategoryId,
  onTap,
  onLongPress,
  onManageOpen,
}: {
  categories: TimeboxCategory[];
  activeCategoryId: string | null;
  onTap: (c: TimeboxCategory) => void;
  onLongPress: (c: TimeboxCategory) => void;
  onManageOpen?: () => void;
}) {
  return (
    <div className="pointer-events-auto fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] left-0 right-0 z-30 border-t border-border bg-background/95 backdrop-blur">
      <div className="mx-auto max-w-2xl overflow-x-auto px-3 py-2">
        <div className="flex gap-1.5">
          {categories.map((c) => (
            <Chip
              key={c.id}
              cat={c}
              active={activeCategoryId === c.id}
              onTap={() => onTap(c)}
              onLongPress={() => onLongPress(c)}
            />
          ))}
          {onManageOpen ? (
            <button
              type="button"
              onClick={onManageOpen}
              className="shrink-0 rounded-full border border-dashed border-border px-3 py-1 text-xs text-muted-foreground hover:bg-muted/50"
            >
              +
            </button>
          ) : null}
        </div>
        <p className="mt-1 px-0.5 text-[10px] text-muted-foreground">
          Tap = fill current slot · Long-press = catch up empty slots since last log
        </p>
      </div>
    </div>
  );
}

function Chip({
  cat,
  active,
  onTap,
  onLongPress,
}: {
  cat: TimeboxCategory;
  active: boolean;
  onTap: () => void;
  onLongPress: () => void;
}) {
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
      onLongPress();
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
    onTap();
  }

  return (
    <button
      type="button"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      onPointerLeave={onPointerEnd}
      onContextMenu={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        "relative shrink-0 rounded-full border px-3 py-1 text-xs transition-transform select-none",
        "touch-manipulation",
        active
          ? "border-transparent shadow-sm"
          : "border-border hover:bg-muted/60",
        pressing && "scale-105",
      )}
      style={
        active
          ? { background: cat.color + "26", color: cat.color, borderColor: cat.color + "80" }
          : undefined
      }
    >
      {cat.emoji ? <span className="mr-1">{cat.emoji}</span> : null}
      {cat.name}
      {pressing ? (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-full border border-primary/60 animate-[ping_600ms_ease-out]"
        />
      ) : null}
    </button>
  );
}
