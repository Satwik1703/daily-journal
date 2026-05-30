"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, CheckSquare, Target, Timer, Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { listPending } from "@/lib/sync/queue";

type NavItem = { href: string; label: string; matchPrefix: string; Icon: typeof BookOpen };

const items: NavItem[] = [
  { href: "/journal", label: "Journal", matchPrefix: "/journal", Icon: BookOpen },
  { href: "/habits", label: "Habits", matchPrefix: "/habits", Icon: CheckSquare },
  { href: "/pomodoro", label: "Pomodoro", matchPrefix: "/pomodoro", Icon: Timer },
  { href: "/goals", label: "Goals", matchPrefix: "/goals", Icon: Target },
  { href: "/more", label: "More", matchPrefix: "/more", Icon: Menu },
];

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
  return (
    <nav
      className={cn(
        "fixed bottom-0 inset-x-0 z-40 border-t border-border bg-background/85 backdrop-blur",
        "pb-[env(safe-area-inset-bottom)]",
      )}
    >
      <ul className="mx-auto flex max-w-3xl items-stretch justify-around">
        {items.map(({ href, label, matchPrefix, Icon }) => {
          const active = pathname.startsWith(matchPrefix);
          const showBadge = href === "/more" && pendingCount > 0;
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                className={cn(
                  "relative flex flex-col items-center justify-center gap-1 py-2.5 text-xs transition-colors",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <div className="relative">
                  <Icon className={cn("size-5", active && "stroke-[2.5]")} />
                  {showBadge ? (
                    <span
                      aria-label={`${pendingCount} pending sync`}
                      className="absolute -right-2 -top-1 grid min-w-[16px] place-items-center rounded-full bg-primary px-1 text-[9px] font-medium leading-none text-primary-foreground"
                    >
                      {pendingCount > 9 ? "9+" : pendingCount}
                    </span>
                  ) : null}
                </div>
                <span className={cn(active && "font-medium")}>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
