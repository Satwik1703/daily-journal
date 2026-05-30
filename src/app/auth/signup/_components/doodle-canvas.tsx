"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { Stroke, StrokePoint } from "@/lib/auth/recovery-stroke";

type Props = {
  size?: number;
  onChange: (strokes: Stroke[]) => void;
  initial?: Stroke[];
};

export function DoodleCanvas({ size = 240, onChange, initial }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokesRef = useRef<Stroke[]>(initial ? initial.map((s) => [...s]) : []);
  const drawingRef = useRef(false);
  const currentRef = useRef<StrokePoint[]>([]);
  const initialHadInk = (initial?.length ?? 0) > 0;
  const [hasInk, setHasInk] = useState(initialHadInk);

  function redraw() {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "rgba(79, 168, 150, 0.95)";
    const all = [...strokesRef.current, currentRef.current];
    for (const s of all) {
      if (s.length < 2) {
        if (s.length === 1) {
          ctx.beginPath();
          ctx.arc(s[0].x, s[0].y, 2, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(79, 168, 150, 0.95)";
          ctx.fill();
        }
        continue;
      }
      ctx.beginPath();
      ctx.moveTo(s[0].x, s[0].y);
      for (let i = 1; i < s.length; i++) {
        ctx.lineTo(s[i].x, s[i].y);
      }
      ctx.stroke();
    }
  }

  useEffect(() => {
    redraw();
  }, []);

  function pointFromEvent(e: React.PointerEvent<HTMLCanvasElement>): StrokePoint {
    const c = canvasRef.current!;
    const rect = c.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * c.width,
      y: ((e.clientY - rect.top) / rect.height) * c.height,
      t: e.timeStamp,
    };
  }

  function pointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    e.preventDefault();
    canvasRef.current?.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    currentRef.current = [pointFromEvent(e)];
    redraw();
  }

  function pointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    currentRef.current.push(pointFromEvent(e));
    redraw();
  }

  function pointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    try {
      canvasRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    if (currentRef.current.length > 0) {
      strokesRef.current.push(currentRef.current);
    }
    currentRef.current = [];
    redraw();
    setHasInk(strokesRef.current.length > 0);
    onChange(strokesRef.current);
  }

  function clear() {
    strokesRef.current = [];
    currentRef.current = [];
    setHasInk(false);
    redraw();
    onChange([]);
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <canvas
        ref={canvasRef}
        width={size}
        height={size}
        onPointerDown={pointerDown}
        onPointerMove={pointerMove}
        onPointerUp={pointerUp}
        onPointerLeave={pointerUp}
        className="rounded-xl border border-border bg-muted/30 touch-none"
        style={{ width: size, height: size }}
      />
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={clear}
        disabled={!hasInk}
      >
        Clear & redraw
      </Button>
    </div>
  );
}
