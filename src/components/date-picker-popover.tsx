"use client";

import { useEffect, useRef, useState } from "react";
import { Info } from "lucide-react";
import { Popover } from "@base-ui/react/popover";
import { Calendar, type CalendarCellRenderer } from "@/components/ui/calendar";
import {
  STATUS_META,
  STATUS_ORDER,
  statusBg,
  type JournalStatus,
} from "@/lib/journal-status";
import {
  monthKeyOf,
  shiftMonth,
  todayLocal,
  type DateString,
} from "@/lib/dates";
import type { CalendarLegend } from "@/lib/calendar-legends";
import { cn } from "@/lib/utils";

export type MonthStatusMap = Record<DateString, JournalStatus>;

export function DatePickerPopover({
  selected,
  onSelect,
  fetchMonthStatus,
  children,
  align = "center",
  disableFuture = true,
  legend,
}: {
  selected: DateString;
  onSelect: (date: DateString) => void;
  /** Fetches the status map for a given month-anchor date. Called on open + month nav. */
  fetchMonthStatus: (monthAnchor: DateString) => Promise<MonthStatusMap>;
  children: React.ReactNode;
  align?: "start" | "center" | "end";
  disableFuture?: boolean;
  /** Optional per-tab legend explaining bucket rules. Adds an inline Info icon. */
  legend?: CalendarLegend;
}) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState<DateString>(selected);
  const [statusMap, setStatusMap] = useState<MonthStatusMap>({});
  const [loading, setLoading] = useState(false);
  const [legendOpen, setLegendOpen] = useState(false);
  const loadedMonthsRef = useRef<Set<string>>(new Set());

  // Reset focused month to the current selection whenever it changes externally.
  useEffect(() => {
    setMonth(selected);
  }, [selected]);

  useEffect(() => {
    if (!open) return;
    const key = monthKeyOf(month);
    if (loadedMonthsRef.current.has(key)) return;
    let cancelled = false;
    setLoading(true);
    fetchMonthStatus(month)
      .then((map) => {
        if (cancelled) return;
        loadedMonthsRef.current.add(key);
        setStatusMap((prev) => ({ ...prev, ...map }));
      })
      .catch(() => {
        // swallow — popover is informational; failure just means no colors.
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, month, fetchMonthStatus]);

  const today = todayLocal();
  const cellRenderer: CalendarCellRenderer = (d) => {
    if (d > today) return null; // future dates stay blank
    const status = statusMap[d];
    if (!status || status === "empty") return null;
    return (
      <span
        className="absolute inset-[2px] rounded-[5px]"
        style={{ backgroundColor: statusBg(status) }}
      />
    );
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger className="inline-flex items-center gap-1 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring/40">
        {children}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner align={align} sideOffset={8} className="z-50 outline-none">
          <Popover.Popup
            className={cn(
              "rounded-xl border border-border bg-popover p-3 text-popover-foreground shadow-lg ring-1 ring-foreground/5 outline-none",
              "data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95",
              "data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
              "duration-150",
            )}
          >
            <Calendar
              month={month}
              selected={selected}
              disableFuture={disableFuture}
              onSelect={(d) => {
                onSelect(d);
                setOpen(false);
              }}
              onPrevMonth={() => setMonth((m) => shiftMonth(m, -1))}
              onNextMonth={() => {
                const next = shiftMonth(month, 1);
                // Don't move past current month when future is disabled.
                if (disableFuture && next > todayLocal()) return;
                setMonth(next);
              }}
              cellRenderer={cellRenderer}
            />
            <div className="mt-3 border-t border-border/60 pt-2.5">
              <div className="mb-1.5 flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground/70">
                <span className="inline-flex items-center gap-1.5">
                  <span>Legend</span>
                  {legend ? (
                    <button
                      type="button"
                      aria-label={legendOpen ? "Hide legend details" : "Show legend details"}
                      aria-pressed={legendOpen}
                      onClick={() => setLegendOpen((v) => !v)}
                      className={cn(
                        "inline-flex size-4 items-center justify-center rounded-full text-muted-foreground/80 transition-colors hover:bg-muted hover:text-foreground",
                        legendOpen && "bg-muted text-foreground",
                      )}
                    >
                      <Info className="size-3" />
                    </button>
                  ) : null}
                </span>
                {loading ? <span className="normal-case tracking-normal">loading…</span> : null}
              </div>
              <div className="flex flex-wrap gap-x-2.5 gap-y-1.5 text-[10px] text-muted-foreground">
                {STATUS_ORDER.filter((s) => s !== "empty").map((s) => (
                  <span key={s} className="inline-flex items-center gap-1">
                    <span
                      aria-hidden
                      className="size-2.5 rounded-[3px]"
                      style={{ backgroundColor: statusBg(s) }}
                    />
                    {STATUS_META[s].label}
                  </span>
                ))}
              </div>
              {legend && legendOpen ? (
                <div className="mt-2.5 rounded-md border border-border/60 bg-muted/30 p-2.5">
                  <div className="text-[11px] font-medium text-foreground">{legend.title}</div>
                  <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground">
                    {legend.blurb}
                  </p>
                  <div className="mt-2 space-y-1">
                    {legend.rows.map((r) => (
                      <div key={r.status} className="flex items-start gap-2 text-[10px]">
                        <span
                          aria-hidden
                          className="mt-0.5 size-2.5 shrink-0 rounded-[3px]"
                          style={{ backgroundColor: statusBg(r.status) }}
                        />
                        <span className="font-medium text-foreground/85">{r.label}</span>
                        <span className="text-muted-foreground">— {r.meaning}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
