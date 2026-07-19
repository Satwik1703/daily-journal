"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BookOpen, CheckSquare, Target, Timer, Menu, Dumbbell, ListTodo } from "lucide-react";
import { cn } from "@/lib/utils";
import { listPending } from "@/lib/sync/queue";

type NavItem = {
  href: string;
  label: string;
  matchPrefix: string;
  Icon: typeof BookOpen;
  /**
   * Optional long-press destination. Held for ≥500ms → navigate here
   * instead of the primary href. Lets us keep the nav at 5 tabs while
   * still surfacing Gym + Todo.
   */
  longPressHref?: string;
  longPressLabel?: string;
  LongPressIcon?: typeof BookOpen;
};

const items: NavItem[] = [
  {
    href: "/journal",
    label: "Journal",
    matchPrefix: "/journal",
    Icon: BookOpen,
    longPressHref: "/gym",
    longPressLabel: "Gym",
    LongPressIcon: Dumbbell,
  },
  {
    href: "/habits",
    label: "Habits",
    matchPrefix: "/habits",
    Icon: CheckSquare,
    longPressHref: "/todo",
    longPressLabel: "Todo",
    LongPressIcon: ListTodo,
  },
  { href: "/pomodoro", label: "Pomodoro", matchPrefix: "/pomodoro", Icon: Timer },
  { href: "/goals", label: "Goals", matchPrefix: "/goals", Icon: Target },
  { href: "/more", label: "More", matchPrefix: "/more", Icon: Menu },
];

const LONG_PRESS_MS = 500;
const CANCEL_MOVE_PX = 10;

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
  const pendingCount = useQueueCount();
  if (pathname.startsWith("/auth")) return null;
  if (pathname === "/reset") return null;
  return (
    <nav
      className={cn(
        "fixed bottom-0 inset-x-0 z-40 border-t border-border bg-background/85 backdrop-blur",
        "pb-[env(safe-area-inset-bottom)]",
      )}
    >
      <ul className="mx-auto flex max-w-3xl items-stretch justify-around">
        {items.map((item) => (
          <NavCell
            key={item.href}
            item={item}
            active={pathname.startsWith(item.matchPrefix)}
            longActive={
              item.longPressHref
                ? pathname.startsWith(item.longPressHref)
                : false
            }
            pendingCount={pendingCount}
          />
        ))}
      </ul>
    </nav>
  );
}

function NavCell({
  item,
  active,
  longActive,
  pendingCount,
}: {
  item: NavItem;
  active: boolean;
  longActive: boolean;
  pendingCount: number;
}) {
  const router = useRouter();
  const { href, label, Icon, longPressHref, longPressLabel, LongPressIcon } = item;
  const showBadge = href === "/more" && pendingCount > 0;

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startXY = useRef<{ x: number; y: number } | null>(null);
  // `true` for the brief window between a fired long-press and the click
  // event React fires on release. The click handler consults this to
  // suppress the primary navigation.
  const firedLongRef = useRef(false);
  const [pressing, setPressing] = useState(false);
  const [longFired, setLongFired] = useState(false);

  function clearTimer() {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  function fireLongPress() {
    if (!longPressHref) return;
    firedLongRef.current = true;
    setLongFired(true);
    // Reset the visual flash shortly after — it's just feedback for the
    // outbound nav.
    window.setTimeout(() => setLongFired(false), 350);
    router.push(longPressHref);
  }

  function onPointerDown(e: React.PointerEvent) {
    // Ignore anything other than the primary button on mouse — keyboard
    // Enter/Space is handled by Link's default behavior.
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (!longPressHref) return;
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
    // Suppress the click that follows a long-press so we don't ALSO
    // navigate to the primary href.
    if (firedLongRef.current) {
      e.preventDefault();
      e.stopPropagation();
      firedLongRef.current = false;
    }
  }

  function onContextMenu(e: React.MouseEvent) {
    // Kill the mobile context menu that pops on long-press.
    if (longPressHref) e.preventDefault();
  }

  const activeVisual = active || longActive;

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
          longPressLabel ? `${label} (long-press for ${longPressLabel})` : label
        }
        className={cn(
          "relative flex select-none flex-col items-center justify-center gap-1 py-2.5 text-xs transition-colors",
          "touch-manipulation",
          activeVisual ? "text-primary" : "text-muted-foreground hover:text-foreground",
        )}
        style={{ WebkitTouchCallout: "none" }}
      >
        <div className="relative">
          {longFired && LongPressIcon ? (
            <LongPressIcon className="size-5 stroke-[2.5] animate-in fade-in zoom-in-95" />
          ) : (
            <Icon
              className={cn(
                "size-5 transition-transform",
                activeVisual && "stroke-[2.5]",
                pressing && "scale-110",
              )}
            />
          )}
          {showBadge ? (
            <span
              aria-label={`${pendingCount} pending sync`}
              className="absolute -right-2 -top-1 grid min-w-[16px] place-items-center rounded-full bg-primary px-1 text-[9px] font-medium leading-none text-primary-foreground"
            >
              {pendingCount > 9 ? "9+" : pendingCount}
            </span>
          ) : null}
          {/* Tiny dot in the corner to hint that a long-press action exists. */}
          {longPressHref ? (
            <span
              aria-hidden
              className={cn(
                "absolute -right-1.5 -bottom-1 size-1.5 rounded-full transition-opacity",
                activeVisual
                  ? "bg-primary/40 opacity-100"
                  : "bg-muted-foreground/40 opacity-70",
                pressing && "bg-primary opacity-100 animate-pulse",
              )}
            />
          ) : null}
          {/* Radial fill that grows during the hold as a progress hint. */}
          {pressing && longPressHref ? (
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 -m-1 rounded-full border border-primary/70 animate-[ping_600ms_ease-out]"
            />
          ) : null}
        </div>
        <span className={cn(activeVisual && "font-medium")}>
          {longFired && longPressLabel ? longPressLabel : label}
        </span>
      </Link>
    </li>
  );
}
