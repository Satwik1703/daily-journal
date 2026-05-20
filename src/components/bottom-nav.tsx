"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, CheckSquare, Target, Timer, Menu } from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = { href: string; label: string; matchPrefix: string; Icon: typeof BookOpen };

const items: NavItem[] = [
  { href: "/journal", label: "Journal", matchPrefix: "/journal", Icon: BookOpen },
  { href: "/habits", label: "Habits", matchPrefix: "/habits", Icon: CheckSquare },
  { href: "/pomodoro", label: "Pomodoro", matchPrefix: "/pomodoro", Icon: Timer },
  { href: "/goals", label: "Goals", matchPrefix: "/goals", Icon: Target },
  { href: "/more", label: "More", matchPrefix: "/more", Icon: Menu },
];

export function BottomNav() {
  const pathname = usePathname();
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
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 py-2.5 text-xs transition-colors",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className={cn("size-5", active && "stroke-[2.5]")} />
                <span className={cn(active && "font-medium")}>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
