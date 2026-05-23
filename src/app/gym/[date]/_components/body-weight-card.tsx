"use client";

import { customAlphabet } from "nanoid";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Minus,
  Plus,
  Scale,
} from "lucide-react";
import { mutate } from "@/lib/sync/mutate";
import { cn } from "@/lib/utils";

const wid = customAlphabet(
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",
  12,
);

const STEP = 1;

type LatestEntry = {
  id: string;
  date: string;
  weightKg: number;
  note: string | null;
  createdAt: number;
};

export function BodyWeightCard({
  date,
  latest,
  last7,
}: {
  date: string;
  latest: LatestEntry | null;
  last7: { date: string; weightKg: number }[];
}) {
  // Local draft. Null until user has anything (latest or in-progress entry).
  const [draft, setDraft] = useState<number | null>(latest?.weightKg ?? null);
  // Track the id we last touched on this date so we update instead of inserting
  // a new row on every stepper tap.
  const [todayEntryId, setTodayEntryId] = useState<string | null>(
    latest?.date === date ? latest.id : null,
  );
  const [editing, setEditing] = useState(false);
  const [editDraft, setEditDraft] = useState<string>(
    latest ? String(latest.weightKg) : "",
  );
  const inputRef = useRef<HTMLInputElement>(null);
  // Debounce timer for stepper-induced upserts.
  const upsertTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Resync when server-loaded `latest` changes (different date, fresh fetch).
  useEffect(() => {
    setDraft(latest?.weightKg ?? null);
    setTodayEntryId(latest?.date === date ? latest.id : null);
    setEditDraft(latest ? String(latest.weightKg) : "");
  }, [latest?.id, latest?.weightKg, latest?.date, date]);

  useEffect(() => {
    if (editing) {
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      });
    }
  }, [editing]);

  // Delta vs the most recent prior-day entry in the 7-day window.
  const delta = useMemo(() => {
    if (draft == null) return null;
    const sorted = [...last7].sort((a, b) => (a.date < b.date ? -1 : 1));
    let prior: { date: string; weightKg: number } | null = null;
    for (let i = sorted.length - 1; i >= 0; i--) {
      const e = sorted[i];
      if (e.date < date) {
        prior = e;
        break;
      }
    }
    if (!prior) return null;
    return {
      deltaKg: Number((draft - prior.weightKg).toFixed(2)),
      prior: prior.weightKg,
    };
  }, [draft, last7, date]);

  function persistUpsert(weightKg: number) {
    if (upsertTimer.current) clearTimeout(upsertTimer.current);
    upsertTimer.current = setTimeout(() => {
      if (todayEntryId) {
        void mutate("update_body_weight", { id: todayEntryId, weightKg, date });
      } else {
        const id = wid();
        setTodayEntryId(id);
        void mutate("log_body_weight", { id, date, weightKg });
      }
    }, 350);
  }

  function step(delta: number) {
    const base = draft ?? latest?.weightKg ?? 0;
    const next = Math.max(0, Number((base + delta).toFixed(2)));
    if (next === draft) return;
    setDraft(next);
    setEditDraft(String(next));
    persistUpsert(next);
  }

  function commitEdit() {
    setEditing(false);
    const trimmed = editDraft.trim();
    if (trimmed === "") {
      setEditDraft(draft != null ? String(draft) : "");
      return;
    }
    const n = Number.parseFloat(trimmed);
    if (!Number.isFinite(n) || n <= 0) {
      setEditDraft(draft != null ? String(draft) : "");
      return;
    }
    const rounded = Number(n.toFixed(2));
    if (rounded === draft) return;
    setDraft(rounded);
    persistUpsert(rounded);
  }

  const noValueYet = draft == null;

  return (
    <div className="flex items-center gap-2 rounded-xl border border-border bg-card/30 px-3 py-2">
      <Scale className="size-4 shrink-0 text-muted-foreground" />

      <div
        className={cn(
          "flex shrink-0 items-stretch overflow-hidden rounded-md ring-1 ring-border bg-muted/20 transition-colors",
        )}
      >
        <StepBtn
          ariaLabel="Decrease weight by 1"
          onClick={() => step(-STEP)}
          disabled={noValueYet ? false : draft <= 0}
        >
          <Minus className="size-3.5" />
        </StepBtn>
        <button
          type="button"
          onClick={() => {
            setEditDraft(draft != null ? String(draft) : "");
            setEditing(true);
          }}
          aria-label="Edit body weight"
          className="flex min-w-[72px] flex-col items-center justify-center px-2 py-1 leading-none transition-colors hover:bg-muted"
        >
          {editing ? (
            <input
              ref={inputRef}
              type="number"
              inputMode="decimal"
              step="0.1"
              value={editDraft}
              onChange={(e) => setEditDraft(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitEdit();
                }
                if (e.key === "Escape") {
                  setEditing(false);
                  setEditDraft(draft != null ? String(draft) : "");
                }
              }}
              placeholder="67.5"
              className="w-full bg-transparent text-center text-sm tabular-nums focus:outline-none"
            />
          ) : (
            <span
              className={cn(
                "text-sm tabular-nums",
                noValueYet && "text-muted-foreground/40",
              )}
            >
              {noValueYet ? "—" : draft}
            </span>
          )}
          <span className="mt-0.5 text-[9px] uppercase tracking-wider text-muted-foreground">
            kg
          </span>
        </button>
        <StepBtn ariaLabel="Increase weight by 1" onClick={() => step(STEP)}>
          <Plus className="size-3.5" />
        </StepBtn>
      </div>

      {delta ? <DeltaPill delta={delta.deltaKg} prior={delta.prior} /> : null}

      <span className="ml-auto truncate text-[11px] text-muted-foreground">
        {latest?.date === date
          ? "logged today"
          : latest
            ? `last entry ${latest.date.slice(5)}`
            : "tap to log"}
      </span>
    </div>
  );
}

function StepBtn({
  children,
  onClick,
  ariaLabel,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  ariaLabel: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      disabled={disabled}
      className={cn(
        "flex w-8 items-center justify-center text-muted-foreground transition-colors",
        "hover:bg-muted hover:text-foreground active:bg-muted",
        "disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent",
      )}
    >
      {children}
    </button>
  );
}

function DeltaPill({ delta, prior }: { delta: number; prior: number }) {
  if (delta === 0) {
    return (
      <span
        className="inline-flex items-center gap-0.5 rounded-full bg-muted/40 px-1.5 py-0 text-[10px] tabular-nums text-muted-foreground"
        title={`Prior: ${prior} kg`}
      >
        <Minus className="size-2.5" />0
      </span>
    );
  }
  const Icon = delta > 0 ? ArrowUp : ArrowDown;
  const color =
    delta > 0
      ? "text-amber-600 bg-amber-500/10 dark:text-amber-300"
      : "text-emerald-600 bg-emerald-500/10 dark:text-emerald-300";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0 text-[10px] tabular-nums",
        color,
      )}
      title={`Prior: ${prior} kg`}
    >
      <Icon className="size-2.5" />
      {Math.abs(delta)}
    </span>
  );
}
