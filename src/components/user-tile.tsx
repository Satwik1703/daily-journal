"use client";

import { cn } from "@/lib/utils";
import { borderClassFor, fontCssFor, type TileBorder, type TileFont } from "@/lib/auth/tile-style";

export type UserTileProps = {
  name: string;
  gradientFrom: string;
  gradientTo: string;
  font: TileFont;
  border: TileBorder;
  size?: number;
  glow?: number;
  className?: string;
  style?: React.CSSProperties;
};

export function UserTile({
  name,
  gradientFrom,
  gradientTo,
  font,
  border,
  size = 64,
  glow = 0,
  className,
  style,
}: UserTileProps) {
  const padX = Math.max(12, Math.round(size * 0.25));
  const padY = Math.max(6, Math.round(size * 0.12));
  return (
    <div
      className={cn(
        "inline-flex items-center justify-center border border-foreground/15 select-none",
        borderClassFor(border),
        className,
      )}
      style={{
        background: `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})`,
        boxShadow: `0 0 ${Math.round(16 + glow * 24)}px ${gradientFrom}${
          glow > 0 ? Math.round(20 + glow * 60).toString(16).padStart(2, "0") : "33"
        }`,
        padding: `${padY}px ${padX}px`,
        fontFamily: fontCssFor(font),
        fontSize: size * 0.5,
        color: "white",
        textShadow: "0 1px 2px rgba(0,0,0,0.35)",
        ...style,
      }}
    >
      {name}
    </div>
  );
}
