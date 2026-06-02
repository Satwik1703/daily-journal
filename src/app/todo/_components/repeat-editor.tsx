"use client";

import { useState } from "react";
import { Popover } from "@base-ui/react/popover";
import { Repeat, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { describeRule, parseRule, type RepeatRule, type RepeatFreq } from "@/lib/todo/recurrence";
import { cn } from "@/lib/utils";

const FREQS: { key: RepeatFreq; label: string }[] = [
  { key: "daily", label: "Daily" },
  { key: "weekly", label: "Weekly" },
  { key: "monthly", label: "Monthly" },
  { key: "yearly", label: "Yearly" },
];
const DAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];

export function RepeatEditor({
  value,
  onChange,
  children,
}: {
  value: string | null;
  onChange: (json: string | null) => void;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const rule = value ? parseRule(value) : null;
  const [draft, setDraft] = useState<RepeatRule>(
    rule ?? { freq: "weekly", interval: 1, mode: "dueDate", ends: { type: "never" } },
  );

  const commit = (next: RepeatRule) => {
    setDraft(next);
    onChange(JSON.stringify(next));
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger className="inline-flex outline-none">{children}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner align="start" sideOffset={8} className="z-50 outline-none">
          <Popover.Popup className="w-64 rounded-xl border border-border bg-popover p-3 text-popover-foreground shadow-lg ring-1 ring-foreground/5 outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95">
            <div className="grid grid-cols-4 gap-1">
              {FREQS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => commit({ ...draft, freq: f.key, byDay: f.key === "weekly" ? draft.byDay : undefined })}
                  className={cn(
                    "rounded-md py-1.5 text-xs font-medium",
                    (value ? draft.freq : null) === f.key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground",
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="mt-3 flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">Every</span>
              <input
                type="number"
                min={1}
                max={99}
                value={draft.interval}
                onChange={(e) => commit({ ...draft, interval: Math.max(1, Number(e.target.value) || 1) })}
                className="h-7 w-14 rounded-md border border-border bg-background px-2 outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
              />
              <span className="text-muted-foreground">
                {draft.freq === "daily" ? "day(s)" : draft.freq === "weekly" ? "week(s)" : draft.freq === "monthly" ? "month(s)" : "year(s)"}
              </span>
            </div>

            {draft.freq === "weekly" ? (
              <div className="mt-3 flex gap-1">
                {DAY_LETTERS.map((d, i) => {
                  const on = draft.byDay?.includes(i);
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        const set = new Set(draft.byDay ?? []);
                        if (set.has(i)) set.delete(i);
                        else set.add(i);
                        commit({ ...draft, byDay: [...set].sort((a, b) => a - b) });
                      }}
                      className={cn(
                        "flex size-7 items-center justify-center rounded-full text-xs",
                        on ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                      )}
                    >
                      {d}
                    </button>
                  );
                })}
              </div>
            ) : null}

            <div className="mt-3 border-t border-border/60 pt-2.5 text-xs">
              <div className="mb-1 text-muted-foreground">Mode</div>
              <div className="flex gap-1">
                {(["dueDate", "completion"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => commit({ ...draft, mode: m })}
                    className={cn(
                      "flex-1 rounded-md py-1 text-[11px]",
                      draft.mode === m ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                    )}
                  >
                    {m === "dueDate" ? "From due date" : "From completion"}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">
                {value ? describeRule(draft) : "Not repeating"}
              </span>
              {value ? (
                <Button
                  size="xs"
                  variant="ghost"
                  className="gap-1 text-muted-foreground"
                  onClick={() => {
                    onChange(null);
                    setOpen(false);
                  }}
                >
                  <X className="size-3" /> Clear
                </Button>
              ) : (
                <Button size="xs" onClick={() => commit(draft)}>
                  <Repeat className="size-3" /> Set
                </Button>
              )}
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
