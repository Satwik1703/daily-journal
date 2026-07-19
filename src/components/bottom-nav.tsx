"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BookOpen, CheckSquare, Target, Timer, Menu, Dumbbell, ListTodo, Utensils } from "lucide-react";
import { cn } from "@/lib/utils";
import { listPending } from "@/lib/sync/queue";

type NavVariant = {
  href: string;
  label: string;
  matchPrefix: string;
  Icon: typeof BookOpen;
};

type NavSlot = {
  id: string;
  /** 1 = plain tab. 2+ = cycles through on long-press. */
  variants: NavVariant[];
};

const SLOTS: NavSlot[] = [
  {
    id: "journal-gym",
    variants: [
      { href: "/journal", label: "Journal", matchPrefix: "/journal", Icon: BookOpen },
      { href: "/gym", label: "Gym", matchPrefix: "/gym", Icon: Dumbbell },
    ],
  },
  {
    id: "habits-todo",
    variants: [
      { href: "/habits", label: "Habits", matchPrefix: "/habits", Icon: CheckSquare },
      { href: "/todo", label: "Todo", matchPrefix: "/todo", Icon: ListTodo },
    ],
  },
  {
    id: "pomodoro-food",
    variants: [
      { href: "/pomodoro", label: "Pomodoro", matchPrefix: "/pomodoro", Icon: Timer },
      { href: "/food", label: "Food", matchPrefix: "/food", Icon: Utensils },
    ],
  },
  {
    id: "goals",
    variants: [{ href: "/goals", label: "Goals", matchPrefix: "/goals", Icon: Target }],
  },
  {
    id: "more",
    variants: [{ href: "/more", label: "More", matchPrefix: "/more", Icon: Menu }],
  },
];

const LONG_PRESS_MS = 500;
const CANCEL_MOVE_PX = 10;
const RIPPLE_DURATION_MS = 620;
const STORAGE_KEY = "__habit_log_bn_modes";

type Ripple = { id: number; x: number; y: number };

// -------- Persisted per-slot mode index --------

function loadModes(): Record<string, number> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") return parsed as Record<string, number>;
  } catch {
    /* corrupt / disabled */
  }
  return {};
}

function saveModes(m: Record<string, number>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(m));
  } catch {
    /* ignore */
  }
}

function useQueueCount(): number {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let cancelled = false;
    async function refresh() {
      try {
        const rows = await listPending();
        if (!cancelled) setCount(rows.length);
      } catch {
        /* IDB not ready */
      }
    }
    refresh();
    const interval = window.setInterval(refresh, 2000);
    let ch: BroadcastChannel | null = null;
    try {
      ch = new BroadcastChannel("sync-status");
      ch.onmessage = refresh;
    } catch {
      /* ignore */
    }
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      ch?.close();
    };
  }, []);
  return count;
}

export function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const pendingCount = useQueueCount();

  const [modes, setModes] = useState<Record<string, number>>({});
  const [hydrated, setHydrated] = useState(false);
  const [ripple, setRipple] = useState<Ripple | null>(null);

  // Hydrate persisted mode on mount.
  useEffect(() => {
    setModes(loadModes());
    setHydrated(true);
  }, []);

  // Auto-align a slot's mode with the current pathname whenever the path
  // changes. Handles bookmarks / back-button / /reset return / any nav
  // that didn't go through cycleSlot() — the tab always reflects where
  // the user actually is.
  useEffect(() => {
    if (!hydrated) return;
    let dirty = false;
    const next = { ...modes };
    for (const slot of SLOTS) {
      if (slot.variants.length < 2) continue;
      const idx = slot.variants.findIndex((v) => pathname.startsWith(v.matchPrefix));
      if (idx >= 0 && next[slot.id] !== idx) {
        next[slot.id] = idx;
        dirty = true;
      }
    }
    if (dirty) {
      setModes(next);
      saveModes(next);
    }
  }, [pathname, hydrated, modes]);

  function cycleSlot(slotId: string, origin: { x: number; y: number }) {
    const slot = SLOTS.find((s) => s.id === slotId);
    if (!slot || slot.variants.length < 2) return;
    const current = modes[slotId] ?? 0;
    const nextIdx = (current + 1) % slot.variants.length;
    const target = slot.variants[nextIdx];

    // Fire the full-screen ripple from the tapped icon's center.
    setRipple({ id: Date.now(), x: origin.x, y: origin.y });
    window.setTimeout(() => setRipple(null), RIPPLE_DURATION_MS + 50);

    // Persist and navigate. Auto-align effect will confirm mode too, but
    // set it here so the tab flips immediately (not after nav settles).
    const nextModes = { ...modes, [slotId]: nextIdx };
    setModes(nextModes);
    saveModes(nextModes);
    router.push(target.href);
  }

  if (pathname.startsWith("/auth")) return null;
  if (pathname === "/reset") return null;

  return (
    <>
      <nav
        className={cn(
          "fixed bottom-0 inset-x-0 z-40 border-t border-border bg-background/85 backdrop-blur",
          "pb-[env(safe-area-inset-bottom)]",
        )}
      >
        <ul className="mx-auto flex max-w-3xl items-stretch justify-around">
          {SLOTS.map((slot) => {
            const modeIdx = modes[slot.id] ?? 0;
            const currentVariant = slot.variants[Math.min(modeIdx, slot.variants.length - 1)];
            const active = slot.variants.some((v) => pathname.startsWith(v.matchPrefix));
            return (
              <NavCell
                key={slot.id}
                slot={slot}
                variant={currentVariant}
                active={active}
                onCycle={cycleSlot}
                pendingCount={pendingCount}
              />
            );
          })}
        </ul>
      </nav>
      {ripple ? <RippleFX key={ripple.id} x={ripple.x} y={ripple.y} /> : null}
    </>
  );
}

// -------- Individual tab cell --------

function NavCell({
  slot,
  variant,
  active,
  onCycle,
  pendingCount,
}: {
  slot: NavSlot;
  variant: NavVariant;
  active: boolean;
  onCycle: (slotId: string, origin: { x: number; y: number }) => void;
  pendingCount: number;
}) {
  const { Icon, label, href } = variant;
  const hasCycle = slot.variants.length > 1;
  const showBadge = slot.id === "more" && pendingCount > 0;

  const iconWrapRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startXY = useRef<{ x: number; y: number } | null>(null);
  const firedLongRef = useRef(false);
  const [pressing, setPressing] = useState(false);

  function clearTimer() {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  function fireLongPress() {
    if (!hasCycle) return;
    const rect = iconWrapRef.current?.getBoundingClientRect();
    if (!rect) return;
    firedLongRef.current = true;
    setPressing(false);
    onCycle(slot.id, { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
  }

  function onPointerDown(e: React.PointerEvent) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (!hasCycle) return;
    startXY.current = { x: e.clientX, y: e.clientY };
    setPressing(true);
    clearTimer();
    timerRef.current = setTimeout(fireLongPress, LONG_PRESS_MS);
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

  function onClickCapture(e: React.MouseEvent) {
    if (firedLongRef.current) {
      e.preventDefault();
      e.stopPropagation();
      firedLongRef.current = false;
    }
  }

  function onContextMenu(e: React.MouseEvent) {
    if (hasCycle) e.preventDefault();
  }

  const altVariant = hasCycle
    ? slot.variants[(slot.variants.findIndex((v) => v.href === variant.href) + 1) % slot.variants.length]
    : null;

  return (
    <li className="flex-1">
      <Link
        href={href}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onPointerLeave={onPointerEnd}
        onClickCapture={onClickCapture}
        onContextMenu={onContextMenu}
        aria-label={
          altVariant ? `${label} (long-press for ${altVariant.label})` : label
        }
        className={cn(
          "relative flex select-none flex-col items-center justify-center gap-1 py-2.5 text-xs transition-colors",
          "touch-manipulation",
          active ? "text-primary" : "text-muted-foreground hover:text-foreground",
        )}
        style={{ WebkitTouchCallout: "none" }}
      >
        <div ref={iconWrapRef} className="relative">
          {/* Alt-variant underlay — the icon we'd swap to on long-press,
              rendered behind the primary at a small offset + reduced
              opacity, so users can see the "other side" of the cycling
              slot without any mystery dot. Brightens on hold. */}
          {altVariant ? (
            <altVariant.Icon
              aria-hidden
              className={cn(
                "pointer-events-none absolute size-4 transition-all",
                pressing
                  ? "opacity-70 translate-x-[3px] translate-y-[3px]"
                  : "opacity-30 translate-x-[2px] translate-y-[2px]",
                active ? "text-primary" : "text-muted-foreground",
              )}
              style={{ left: "2px", top: "2px" }}
            />
          ) : null}
          <Icon
            key={variant.href}
            className={cn(
              "relative size-5 transition-transform",
              "animate-in fade-in zoom-in-95 duration-150",
              active && "stroke-[2.5]",
              pressing && "scale-110",
            )}
          />
          {showBadge ? (
            <span
              aria-label={`${pendingCount} pending sync`}
              className="absolute -right-2 -top-1 grid min-w-[16px] place-items-center rounded-full bg-primary px-1 text-[9px] font-medium leading-none text-primary-foreground"
            >
              {pendingCount > 9 ? "9+" : pendingCount}
            </span>
          ) : null}
          {/* Small hold ring — grows locally around the icon during the 500ms wait. */}
          {pressing && hasCycle ? (
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 -m-1 rounded-full border border-primary/70 animate-[ping_600ms_ease-out]"
            />
          ) : null}
        </div>
        <span key={variant.label} className={cn("animate-in fade-in duration-150", active && "font-medium")}>
          {label}
        </span>
      </Link>
    </li>
  );
}

// -------- Full-viewport ripple portal --------

function RippleFX({ x, y }: { x: number; y: number }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[60] overflow-hidden"
    >
      <div
        className="absolute rounded-full border-2 border-primary bg-primary/20 animate-nav-ripple"
        style={{
          left: x - 20,
          top: y - 20,
          width: 40,
          height: 40,
        }}
      />
    </div>,
    document.body,
  );
}
