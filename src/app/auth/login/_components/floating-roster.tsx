"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { UserTile } from "@/components/user-tile";
import { EmojiPassphraseGrid } from "./emoji-passphrase-grid";
import type { TileBorder, TileFont } from "@/lib/auth/tile-style";
import { cn } from "@/lib/utils";

export type RosterUser = {
  id: string;
  name: string;
  gradientFrom: string;
  gradientTo: string;
  font: TileFont;
  border: TileBorder;
  lastSeenAt: number | null;
};

type Tile = {
  user: RosterUser;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  vr: number;
  size: number;
  glow: number;
};

type Props = {
  users: RosterUser[];
  next?: string;
};

function recencyBoost(lastSeenAt: number | null): number {
  if (!lastSeenAt) return 0;
  const days = (Date.now() - lastSeenAt) / (1000 * 60 * 60 * 24);
  return Math.max(0, 1 - Math.min(days / 14, 1));
}

export function FloatingRoster({ users, next }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const tilesRef = useRef<Tile[]>([]);
  const [selected, setSelected] = useState<RosterUser | null>(null);
  const [, forceRender] = useState(0);
  const cursorRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (selected) return;
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    tilesRef.current = users.map((u) => {
      const size = 56;
      const padding = size + 12;
      const x = padding + Math.random() * (rect.width - padding * 2);
      const y = padding + Math.random() * (rect.height - padding * 2);
      return {
        user: u,
        x,
        y,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        r: (Math.random() - 0.5) * 10,
        vr: (Math.random() - 0.5) * 0.2,
        size: size + Math.random() * 8,
        glow: recencyBoost(u.lastSeenAt),
      };
    });
    let raf = 0;
    const tick = () => {
      const r = el.getBoundingClientRect();
      for (const t of tilesRef.current) {
        t.x += t.vx;
        t.y += t.vy;
        t.r += t.vr;
        // bounce
        if (t.x < t.size) {
          t.x = t.size;
          t.vx *= -1;
        }
        if (t.x > r.width - t.size) {
          t.x = r.width - t.size;
          t.vx *= -1;
        }
        if (t.y < t.size) {
          t.y = t.size;
          t.vy *= -1;
        }
        if (t.y > r.height - t.size) {
          t.y = r.height - t.size;
          t.vy *= -1;
        }
        // cursor repel
        const c = cursorRef.current;
        if (c) {
          const dx = t.x - c.x;
          const dy = t.y - c.y;
          const dist2 = dx * dx + dy * dy;
          if (dist2 < 100 * 100 && dist2 > 0) {
            const dist = Math.sqrt(dist2);
            const force = (100 - dist) * 0.002;
            t.vx += (dx / dist) * force;
            t.vy += (dy / dist) * force;
          }
        }
        // dampen
        const vmax = 1.2;
        t.vx = Math.max(-vmax, Math.min(vmax, t.vx));
        t.vy = Math.max(-vmax, Math.min(vmax, t.vy));
      }
      forceRender((n) => (n + 1) % 1024);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    function onMove(e: PointerEvent) {
      const rect2 = el!.getBoundingClientRect();
      cursorRef.current = { x: e.clientX - rect2.left, y: e.clientY - rect2.top };
    }
    function onLeave() {
      cursorRef.current = null;
    }
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);

    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
    };
  }, [users, selected]);

  if (selected) {
    return (
      <div className="w-full max-w-md flex flex-col gap-5 items-center">
        <UserTile
          name={selected.name}
          gradientFrom={selected.gradientFrom}
          gradientTo={selected.gradientTo}
          font={selected.font}
          border={selected.border}
          size={84}
        />
        <p className="text-center text-sm text-muted-foreground">
          Tap your 4-emoji passphrase (in order).
        </p>
        <EmojiPassphraseGrid
          name={selected.name}
          next={next}
          onCancel={() => setSelected(null)}
        />
      </div>
    );
  }

  return (
    <div className="w-full max-w-3xl flex flex-col gap-4 items-center">
      <h1 className="font-serif text-3xl text-center">Who are you?</h1>
      <p className="text-sm text-muted-foreground text-center">
        Tap your tile to sign in.
      </p>
      <div
        ref={containerRef}
        className={cn(
          "relative w-full overflow-hidden rounded-2xl border border-border bg-muted/20",
          "h-[480px] sm:h-[520px]",
        )}
      >
        {/* eslint-disable-next-line react-hooks/refs */}
        {tilesRef.current.map((t) => (
          <button
            key={t.user.id}
            type="button"
            onClick={() => setSelected(t.user)}
            className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-transform hover:scale-110"
            style={{
              left: t.x,
              top: t.y,
              transform: `translate(-50%, -50%) rotate(${t.r}deg)`,
            }}
          >
            <UserTile
              name={t.user.name}
              gradientFrom={t.user.gradientFrom}
              gradientTo={t.user.gradientTo}
              font={t.user.font}
              border={t.user.border}
              size={t.size}
              glow={t.glow}
            />
          </button>
        ))}
        {users.length === 0 ? (
          <div className="absolute inset-0 grid place-items-center text-center text-muted-foreground text-sm px-6">
            No one here yet. Tap below to sign up.
          </div>
        ) : null}
      </div>
      <Link
        href="/auth/signup"
        className="inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-5 py-2 text-sm hover:bg-primary/90 active:scale-95 transition"
      >
        <Plus className="size-4" />
        New here? Sign up
      </Link>
    </div>
  );
}
