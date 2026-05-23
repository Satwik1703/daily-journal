"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Play, Pause, Square, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { nanoid } from "nanoid";
import { cn } from "@/lib/utils";
import {
  POMO_DURATIONS,
  DEFAULT_DURATION_KEY,
  type PomoDurationKey,
} from "@/lib/pomodoro-meta";
import { primeAudio, playPomodoroSound } from "@/lib/pomodoro-audio";
import { formatLocalYMD } from "@/lib/dates";
import type { PomoCategory } from "@/db/queries/pomodoro-categories";
import { mutate } from "@/lib/sync/mutate";
import { CategoryPicker } from "./category-picker";
import { TimeSpanBar } from "./time-span-bar";
import { ManualSessionDialog } from "./manual-session-dialog";

const STORAGE_KEY = "pomodoro.activeSession";
const LAST_CATEGORY_KEY = "pomodoro.lastCategoryId";
const LAST_DURATION_KEY = "pomodoro.lastDuration";
const NOTIF_TAG = "pomo-completion";

type TimestampTriggerCtor = new (ts: number) => object;
type NotifOptsWithTrigger = NotificationOptions & {
  showTrigger?: object;
  vibrate?: number[];
};
type GetNotifsExtraOpts = { tag?: string; includeTriggered?: boolean };

async function scheduleCompletionNotification(endsAt: number, label: string): Promise<void> {
  if (typeof window === "undefined") return;
  if (!("Notification" in window) || !("serviceWorker" in navigator)) return;
  try {
    let perm = Notification.permission;
    if (perm === "default") perm = await Notification.requestPermission();
    if (perm !== "granted") return;
    const reg = await navigator.serviceWorker.ready;
    const TT = (window as unknown as { TimestampTrigger?: TimestampTriggerCtor }).TimestampTrigger;
    if (!TT) return;
    const opts: NotifOptsWithTrigger = {
      tag: NOTIF_TAG,
      body: label,
      icon: "/icon",
      badge: "/icon",
      vibrate: [200, 100, 200, 100, 400],
      showTrigger: new TT(endsAt),
    };
    await reg.showNotification("Pomodoro complete", opts);
  } catch {
    /* ignore */
  }
}

async function cancelCompletionNotification(): Promise<void> {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    const notifs = await reg.getNotifications({
      tag: NOTIF_TAG,
      includeTriggered: false,
    } as GetNotifsExtraOpts);
    for (const n of notifs) n.close();
  } catch {
    /* ignore */
  }
}

type ActiveSession = {
  id: string;
  startedAt: number;
  pausedMs: number;
  pauseStartedAt: number | null;
  plannedMin: number;
  categoryId: string | null;
};

type Phase = "idle" | "running" | "paused";

function loadActive(): ActiveSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ActiveSession;
    if (
      typeof parsed.startedAt !== "number" ||
      typeof parsed.plannedMin !== "number"
    )
      return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveActive(s: ActiveSession | null): void {
  try {
    if (s) localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

function computeElapsedMs(s: ActiveSession, nowMs: number): number {
  const anchor = s.pauseStartedAt ?? nowMs;
  return Math.max(0, anchor - s.startedAt - s.pausedMs);
}

function fmtMmSs(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const mm = Math.floor(total / 60);
  const ss = total % 60;
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

export function TimerPanel({
  categories,
  soundId,
  isToday,
  pageDate,
  initialCategoryId = null,
  initialAutostart = false,
}: {
  categories: PomoCategory[];
  soundId: string;
  isToday: boolean;
  pageDate: string;
  /** From `?categoryId=` URL param. Wins over the localStorage "last used" cache. */
  initialCategoryId?: string | null;
  /** From `?autostart=1` URL param. Auto-starts a session on mount if idle + today. */
  initialAutostart?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  // ----- initial state from localStorage (lazy init)
  const [phase, setPhase] = useState<Phase>("idle");
  const [active, setActive] = useState<ActiveSession | null>(null);
  const [durationKey, setDurationKey] = useState<PomoDurationKey>(DEFAULT_DURATION_KEY);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [now, setNow] = useState<number>(() => Date.now());
  const [manualOpen, setManualOpen] = useState(false);

  // Stop dialog
  const [stopOpen, setStopOpen] = useState(false);

  // Description dialog (post-completion or post-save-partial)
  const [descDialog, setDescDialog] = useState<{
    sessionId: string;
    source: "timer" | "partial";
    plannedMin: number;
    durationMin: number;
    startedAt: number;
    endedAt: number;
  } | null>(null);
  const [descText, setDescText] = useState("");

  const tickRef = useRef<number | null>(null);
  const stopSoundRef = useRef<(() => void) | null>(null);
  const completionHandledRef = useRef(false);

  function handleCompletion(a: ActiveSession) {
    if (completionHandledRef.current) return;
    completionHandledRef.current = true;
    if (tickRef.current) {
      window.clearInterval(tickRef.current);
      tickRef.current = null;
    }
    setPhase("idle");
    void cancelCompletionNotification();
    try {
      stopSoundRef.current = playPomodoroSound(soundId, 5000);
    } catch {
      /* ignore */
    }
    const startedAt = a.startedAt;
    const endedAt = a.startedAt + a.plannedMin * 60_000;
    const date = formatLocalYMD(new Date(startedAt));
    const sessionId = nanoid(12);
    void mutate("create_session", {
      id: sessionId,
      date,
      startedAt,
      endedAt,
      durationMin: a.plannedMin,
      plannedMin: a.plannedMin,
      categoryId: a.categoryId ?? null,
      source: "timer",
    });
    saveActive(null);
    setActive(null);
    setDescDialog({
      sessionId,
      source: "timer",
      plannedMin: a.plannedMin,
      durationMin: a.plannedMin,
      startedAt,
      endedAt,
    });
    setDescText("");
    toast.success(`Pomo done · ${a.plannedMin}m`);
  }

  // ----- mount: hydrate from URL param > localStorage > null
  useEffect(() => {
    // Priority: URL ?categoryId= (validated server-side) > localStorage last used.
    let resolvedCategoryId: string | null = null;
    if (initialCategoryId) {
      resolvedCategoryId = initialCategoryId;
      setCategoryId(initialCategoryId);
      try {
        localStorage.setItem(LAST_CATEGORY_KEY, initialCategoryId);
      } catch {
        /* ignore */
      }
    } else {
      const last = localStorage.getItem(LAST_CATEGORY_KEY);
      if (last && categories.some((c) => c.id === last)) {
        resolvedCategoryId = last;
        setCategoryId(last);
      }
    }
    const lastDur = localStorage.getItem(LAST_DURATION_KEY);
    let resolvedDur: PomoDurationKey = DEFAULT_DURATION_KEY;
    if (lastDur === "full" || lastDur === "half") {
      resolvedDur = lastDur;
      setDurationKey(lastDur);
    }

    const a = loadActive();
    if (a) {
      setActive(a);
      // Don't let a resumed session override an explicit URL categoryId.
      if (!initialCategoryId) setCategoryId(a.categoryId);
      setDurationKey(a.plannedMin === 30 ? "half" : "full");

      const elapsed = computeElapsedMs(a, Date.now());
      const total = a.plannedMin * 60_000;
      if (elapsed >= total) {
        // Already completed while away — fire completion flow once.
        handleCompletion(a);
      } else if (a.pauseStartedAt) {
        setPhase("paused");
      } else {
        setPhase("running");
        // Re-arm OS notification after refresh while session still running.
        const endsAt = a.startedAt + a.plannedMin * 60_000;
        const cat = categories.find((c) => c.id === a.categoryId);
        const label = cat ? `${cat.emoji ?? ""} ${cat.name} timer is up` : "Timer is up";
        void scheduleCompletionNotification(endsAt, label.trim());
      }
      return;
    }

    // No active session. Try autostart from URL.
    if (initialAutostart && isToday) {
      const plannedMin = POMO_DURATIONS.find((d) => d.key === resolvedDur)!.min;
      primeAudio();
      const startedAt = Date.now();
      const newA: ActiveSession = {
        id: nanoid(12),
        startedAt,
        pausedMs: 0,
        pauseStartedAt: null,
        plannedMin,
        categoryId: resolvedCategoryId,
      };
      saveActive(newA);
      if (resolvedCategoryId) localStorage.setItem(LAST_CATEGORY_KEY, resolvedCategoryId);
      localStorage.setItem(LAST_DURATION_KEY, resolvedDur);
      completionHandledRef.current = false;
      setActive(newA);
      setNow(Date.now());
      setPhase("running");
      const cat = categories.find((c) => c.id === resolvedCategoryId);
      const label = cat ? `${cat.emoji ?? ""} ${cat.name} timer is up` : "Timer is up";
      void scheduleCompletionNotification(startedAt + plannedMin * 60_000, label.trim());
    }
    // Clean autostart param off the URL so a refresh doesn't relaunch.
    if (initialAutostart && pathname) {
      router.replace(pathname);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ----- ticking interval (only while running)
  useEffect(() => {
    if (phase !== "running" || !active) return;
    const id = window.setInterval(() => {
      const t = Date.now();
      setNow(t);
      const elapsed = computeElapsedMs(active, t);
      if (elapsed >= active.plannedMin * 60_000) {
        handleCompletion(active);
      }
    }, 200);
    tickRef.current = id;
    return () => {
      if (tickRef.current) window.clearInterval(tickRef.current);
      tickRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, active?.id]);

  const totalMs = (active?.plannedMin ?? POMO_DURATIONS.find((d) => d.key === durationKey)!.min) * 60_000;
  const elapsedMs = active ? computeElapsedMs(active, now) : 0;
  const remainingMs = Math.max(0, totalMs - elapsedMs);
  const fraction = totalMs <= 0 ? 0 : Math.min(1, elapsedMs / totalMs);

  // Per-second + per-minute keys drive the tick-flash + ring-wave animations.
  const elapsedSec = Math.floor(elapsedMs / 1000);
  const elapsedMin = Math.floor(elapsedMs / 60_000);
  const [secKey, setSecKey] = useState(0);
  const [minKey, setMinKey] = useState(0);
  useEffect(() => {
    if (phase === "running") setSecKey((k) => k + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elapsedSec]);
  useEffect(() => {
    if (phase === "running" && elapsedMin > 0) setMinKey((k) => k + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elapsedMin]);

  // Preview window when idle (so the user sees the time-span even before Start)
  const previewStartedAt = now;
  const previewEndedAt =
    now + (POMO_DURATIONS.find((d) => d.key === durationKey)!.min * 60_000);

  const accentColor = useMemo(() => {
    const c = categories.find((c) => c.id === categoryId);
    return c?.color ?? null;
  }, [categories, categoryId]);

  // ----- actions

  function handleStart() {
    if (!isToday) return;
    primeAudio();
    const plannedMin = POMO_DURATIONS.find((d) => d.key === durationKey)!.min;
    const a: ActiveSession = {
      id: nanoid(12),
      startedAt: Date.now(),
      pausedMs: 0,
      pauseStartedAt: null,
      plannedMin,
      categoryId,
    };
    saveActive(a);
    if (categoryId) localStorage.setItem(LAST_CATEGORY_KEY, categoryId);
    localStorage.setItem(LAST_DURATION_KEY, durationKey);
    completionHandledRef.current = false;
    setActive(a);
    setNow(Date.now());
    setPhase("running");
    const cat = categories.find((c) => c.id === categoryId);
    const label = cat ? `${cat.emoji ?? ""} ${cat.name} timer is up` : "Timer is up";
    void scheduleCompletionNotification(a.startedAt + plannedMin * 60_000, label.trim());
  }

  function handlePause() {
    if (!active || phase !== "running") return;
    const next: ActiveSession = { ...active, pauseStartedAt: Date.now() };
    saveActive(next);
    setActive(next);
    setPhase("paused");
    void cancelCompletionNotification();
  }

  function handleResume() {
    if (!active || phase !== "paused" || active.pauseStartedAt == null) return;
    const delta = Date.now() - active.pauseStartedAt;
    const next: ActiveSession = {
      ...active,
      pausedMs: active.pausedMs + delta,
      pauseStartedAt: null,
    };
    saveActive(next);
    setActive(next);
    setNow(Date.now());
    setPhase("running");
    // Reschedule OS notification for remaining time.
    const remaining = next.plannedMin * 60_000 - computeElapsedMs(next, Date.now());
    const endsAt = Date.now() + Math.max(0, remaining);
    const cat = categories.find((c) => c.id === next.categoryId);
    const label = cat ? `${cat.emoji ?? ""} ${cat.name} timer is up` : "Timer is up";
    void scheduleCompletionNotification(endsAt, label.trim());
  }

  function handleStopRequest() {
    if (!active) return;
    setStopOpen(true);
  }

  async function discardSession() {
    if (stopSoundRef.current) stopSoundRef.current();
    void cancelCompletionNotification();
    saveActive(null);
    setActive(null);
    setPhase("idle");
    setStopOpen(false);
    toast.info("Discarded session");
  }

  function savePartial() {
    if (!active) return;
    setStopOpen(false);
    void cancelCompletionNotification();
    const endedAt = active.pauseStartedAt ?? Date.now();
    const elapsed = computeElapsedMs(active, endedAt);
    const durationMin = Math.max(1, Math.round(elapsed / 60_000));
    const startedAt = active.startedAt;
    const date = formatLocalYMD(new Date(startedAt));
    const sessionId = nanoid(12);
    void mutate("create_session", {
      id: sessionId,
      date,
      startedAt,
      endedAt,
      durationMin,
      plannedMin: active.plannedMin,
      categoryId: active.categoryId ?? null,
      source: "partial",
    });
    saveActive(null);
    setActive(null);
    setPhase("idle");
    setDescDialog({
      sessionId,
      source: "partial",
      plannedMin: active.plannedMin,
      durationMin,
      startedAt,
      endedAt,
    });
    setDescText("");
    toast.success(`Saved ${durationMin}m partial`);
  }

  function handleSaveDescription() {
    if (!descDialog) return;
    const id = descDialog.sessionId;
    const text = descText.trim();
    if (text) void mutate("update_session", { id, description: text });
    setDescDialog(null);
    if (stopSoundRef.current) stopSoundRef.current();
  }

  function dismissDescription() {
    setDescDialog(null);
    if (stopSoundRef.current) stopSoundRef.current();
  }

  // ----- rendering helpers
  const sweep = useMemo(() => {
    const radius = 110;
    const circ = 2 * Math.PI * radius;
    const dashOffset = circ * (1 - fraction);
    return { radius, circ, dashOffset };
  }, [fraction]);

  const display = active ? fmtMmSs(remainingMs) : fmtMmSs(totalMs);

  // ----- render
  return (
    <div className="space-y-5">
      {/* Duration toggle (only when idle) */}
      {!active ? (
        <div className="flex items-center justify-center gap-1.5">
          {POMO_DURATIONS.map((d) => (
            <button
              key={d.key}
              type="button"
              onClick={() => setDurationKey(d.key)}
              disabled={!isToday}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs transition-colors disabled:opacity-50",
                d.key === durationKey
                  ? "bg-primary/15 text-primary ring-1 ring-primary/40"
                  : "text-muted-foreground hover:bg-muted/60",
              )}
            >
              {d.label}
            </button>
          ))}
        </div>
      ) : null}

      {/* Category picker */}
      <CategoryPicker
        categories={categories}
        selectedId={categoryId}
        onSelect={(id) => {
          setCategoryId(id);
          if (id) localStorage.setItem(LAST_CATEGORY_KEY, id);
        }}
        disabled={phase === "running"}
      />

      {/* Circular timer — animated */}
      <div className="relative mx-auto flex h-64 w-64 items-center justify-center">
        {/* Breathing radial backdrop (always on, more intense when running) */}
        <div
          aria-hidden
          className="absolute inset-2 rounded-full pointer-events-none animate-radial-pulse"
          style={{
            background: `radial-gradient(circle at center, ${accentColor ?? "var(--primary)"}55 0%, ${accentColor ?? "var(--primary)"}18 35%, transparent 70%)`,
          }}
        />

        {/* Layered SVG: rotating decorative rings, sweep, particles, wave */}
        <svg viewBox="0 0 240 240" className="absolute inset-0 overflow-visible">
          <defs>
            <linearGradient id="sweep-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={accentColor ?? "var(--primary)"} stopOpacity={1} />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity={0.9} />
            </linearGradient>
            <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="glow-strong" x="-80%" y="-80%" width="260%" height="260%">
              <feGaussianBlur stdDeviation="6" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Perpetual ambient ring wave (decorative, always running) */}
          <circle
            cx="120"
            cy="120"
            r={sweep.radius}
            fill="none"
            stroke={accentColor ?? "var(--primary)"}
            strokeOpacity={0.5}
            strokeWidth="2"
            className="animate-ring-wave-loop"
            style={{ transformOrigin: "120px 120px", transformBox: "fill-box" }}
          />

          {/* Outer dashed rotating ring */}
          <g
            className="animate-orbit-slow"
            style={{ transformOrigin: "120px 120px", transformBox: "fill-box" }}
          >
            <circle
              cx="120"
              cy="120"
              r={sweep.radius + 16}
              fill="none"
              stroke={accentColor ?? "var(--primary)"}
              strokeOpacity={0.55}
              strokeWidth="1.5"
              strokeDasharray="6 10"
            />
          </g>
          {/* Mid dotted reverse ring */}
          <g
            className="animate-orbit-mid"
            style={{ transformOrigin: "120px 120px", transformBox: "fill-box" }}
          >
            <circle
              cx="120"
              cy="120"
              r={sweep.radius - 14}
              fill="none"
              stroke="var(--accent)"
              strokeOpacity={0.55}
              strokeWidth="1.5"
              strokeDasharray="2 8"
            />
          </g>
          {/* Inner thin fast ring */}
          <g
            className="animate-orbit-fast"
            style={{ transformOrigin: "120px 120px", transformBox: "fill-box" }}
          >
            <circle
              cx="120"
              cy="120"
              r={sweep.radius - 30}
              fill="none"
              stroke={accentColor ?? "var(--primary)"}
              strokeOpacity={0.45}
              strokeWidth="1.5"
              strokeDasharray="3 16"
            />
          </g>

          {/* Track */}
          <circle
            cx="120"
            cy="120"
            r={sweep.radius}
            fill="none"
            stroke="var(--border)"
            strokeWidth="8"
          />

          {/* Per-minute wave (re-mounts each minute) */}
          {phase === "running" && minKey > 0 ? (
            <circle
              key={minKey}
              cx="120"
              cy="120"
              r={sweep.radius}
              fill="none"
              stroke={accentColor ?? "var(--primary)"}
              strokeOpacity={0.85}
              strokeWidth="4"
              className="animate-ring-wave"
              filter="url(#glow)"
              style={{ transformOrigin: "120px 120px", transformBox: "fill-box" }}
            />
          ) : null}

          {/* Main sweep with gradient + glow */}
          <circle
            cx="120"
            cy="120"
            r={sweep.radius}
            fill="none"
            stroke="url(#sweep-grad)"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={sweep.circ}
            strokeDashoffset={sweep.dashOffset}
            transform="rotate(-90 120 120)"
            filter="url(#glow)"
            style={{ transition: "stroke-dashoffset 250ms linear" }}
          />

          {/* Orbiting particles along the ring (always rotating; brighter when running) */}
          <g
            className="animate-orbit-slow"
            style={{ transformOrigin: "120px 120px", transformBox: "fill-box" }}
          >
            {Array.from({ length: 10 }).map((_, i) => {
              const angle = (i / 10) * 2 * Math.PI;
              const r = sweep.radius;
              const cx = 120 + Math.cos(angle) * r;
              const cy = 120 + Math.sin(angle) * r;
              return (
                <circle
                  key={i}
                  cx={cx}
                  cy={cy}
                  r={phase === "running" ? 3 : 2.2}
                  fill={accentColor ?? "var(--primary)"}
                  opacity={phase === "running" ? 0.9 : 0.6}
                  className="animate-spark"
                  style={{ animationDelay: `${(i / 10) * 2.4}s` }}
                  filter="url(#glow)"
                />
              );
            })}
          </g>

          {/* Counter-rotating accent particles */}
          <g
            className="animate-orbit-mid"
            style={{ transformOrigin: "120px 120px", transformBox: "fill-box" }}
          >
            {Array.from({ length: 6 }).map((_, i) => {
              const angle = ((i + 0.5) / 6) * 2 * Math.PI;
              const r = sweep.radius + 16;
              const cx = 120 + Math.cos(angle) * r;
              const cy = 120 + Math.sin(angle) * r;
              return (
                <circle
                  key={i}
                  cx={cx}
                  cy={cy}
                  r={2}
                  fill="var(--accent)"
                  opacity={0.7}
                  className="animate-spark"
                  style={{ animationDelay: `${(i / 6) * 2.4}s` }}
                />
              );
            })}
          </g>

          {/* Lead pip at the tip of the sweep (only while active) */}
          {phase !== "idle" ? (() => {
            const tipAngle = -Math.PI / 2 + fraction * 2 * Math.PI;
            const cx = 120 + Math.cos(tipAngle) * sweep.radius;
            const cy = 120 + Math.sin(tipAngle) * sweep.radius;
            return (
              <>
                <circle
                  cx={cx}
                  cy={cy}
                  r={8}
                  fill={accentColor ?? "var(--primary)"}
                  opacity={0.35}
                  filter="url(#glow-strong)"
                />
                <circle
                  cx={cx}
                  cy={cy}
                  r={4.5}
                  fill={accentColor ?? "var(--primary)"}
                  filter="url(#glow)"
                />
              </>
            );
          })() : null}
        </svg>

        {/* Center digits with per-second tick bump + minute flash */}
        <div className="z-10 flex flex-col items-center gap-1">
          <span
            key={`min-${minKey}`}
            className={cn(
              "font-serif text-5xl tabular-nums leading-none",
              phase === "running" && minKey > 0 && "animate-minute-flash",
            )}
          >
            <span
              key={`sec-${secKey}`}
              className={cn("inline-block", phase === "running" && "animate-tick-bump")}
              style={{
                textShadow:
                  phase === "running"
                    ? `0 0 18px ${accentColor ?? "var(--primary)"}88`
                    : undefined,
              }}
            >
              {display}
            </span>
          </span>
          <span
            className={cn(
              "text-[11px] uppercase tracking-wider",
              phase === "running"
                ? "text-foreground/80 animate-drift"
                : "text-muted-foreground",
            )}
          >
            {phase === "running" ? "Focusing" : phase === "paused" ? "Paused" : "Ready"}
          </span>
        </div>
      </div>

      {/* Time span bar */}
      <TimeSpanBar
        startedAt={active ? active.startedAt : previewStartedAt}
        endedAt={
          active ? active.startedAt + active.plannedMin * 60_000 : previewEndedAt
        }
        now={now}
        running={phase === "running"}
      />

      {/* Controls */}
      <div className="flex flex-wrap items-center justify-center gap-2">
        {phase === "idle" ? (
          <Button onClick={handleStart} disabled={!isToday} className="gap-1.5">
            <Play className="size-4" /> Start
          </Button>
        ) : null}
        {phase === "running" ? (
          <Button onClick={handlePause} variant="outline" className="gap-1.5">
            <Pause className="size-4" /> Pause
          </Button>
        ) : null}
        {phase === "paused" ? (
          <Button onClick={handleResume} className="gap-1.5">
            <Play className="size-4" /> Resume
          </Button>
        ) : null}
        {phase !== "idle" ? (
          <Button onClick={handleStopRequest} variant="ghost" className="gap-1.5 text-muted-foreground">
            <Square className="size-4" /> Stop
          </Button>
        ) : null}
        <Button
          variant="outline"
          className="gap-1.5"
          onClick={() => setManualOpen(true)}
        >
          <Plus className="size-4" /> Add manually
        </Button>
      </div>

      {!isToday ? (
        <p className="text-center text-xs text-muted-foreground">
          Timer locked on past dates — use Add manually to backfill.
        </p>
      ) : null}

      {/* Stop dialog */}
      <Dialog open={stopOpen} onOpenChange={setStopOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-serif text-base">Stop pomo?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            You&apos;ve focused for{" "}
            <span className="font-medium text-foreground">
              {active ? Math.max(1, Math.round(computeElapsedMs(active, now) / 60_000)) : 0}m
            </span>
            . Save it as a partial session, or discard.
          </p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setStopOpen(false)}>
              Cancel
            </Button>
            <Button variant="outline" onClick={discardSession}>
              Discard
            </Button>
            <Button onClick={savePartial}>Save partial</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Description dialog */}
      <Dialog
        open={descDialog !== null}
        onOpenChange={(o) => {
          if (!o) dismissDescription();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-serif text-base">
              {descDialog?.source === "timer" ? "Pomo complete 🎉" : "Partial saved"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              {descDialog ? `${descDialog.durationMin}m focused. Anything to note?` : null}
            </p>
            <Textarea
              value={descText}
              onChange={(e) => setDescText(e.target.value)}
              placeholder="What did you work on?"
              rows={4}
              autoFocus
            />
          </div>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="ghost" />}>
              Skip
            </DialogClose>
            <Button onClick={handleSaveDescription}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manual session dialog */}
      <ManualSessionDialog
        open={manualOpen}
        onOpenChange={setManualOpen}
        categories={categories}
        defaultDate={pageDate}
        defaultCategoryId={categoryId}
      />
    </div>
  );
}
