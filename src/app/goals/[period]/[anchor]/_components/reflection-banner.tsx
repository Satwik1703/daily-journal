"use client";

import { Sparkle } from "lucide-react";

/**
 * Page-level nag when there are finalized goals without a saved reflection.
 * Tapping scrolls the user to the first card with a "Reflect" CTA (handled by
 * native anchor scroll-margin in the goal card).
 */
export function ReflectionBanner({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <a
      href="#first-reflect"
      className="flex items-center gap-2 rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-xs text-foreground hover:bg-primary/15"
    >
      <Sparkle className="size-4 text-primary" />
      <span className="flex-1">
        Reflect on {count} closed goal{count === 1 ? "" : "s"} →
      </span>
    </a>
  );
}
