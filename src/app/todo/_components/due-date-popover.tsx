"use client";

import { useState } from "react";
import { Popover } from "@base-ui/react/popover";
import { CalendarX, Clock } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { addDays, shiftMonth, todayLocal, type DateString } from "@/lib/dates";
import { cn } from "@/lib/utils";

export function DueDatePopover({
  date,
  time,
  onChange,
  children,
  align = "start",
}: {
  date: DateString | null;
  time: string | null;
  onChange: (date: DateString | null, time: string | null) => void;
  children: React.ReactNode;
  align?: "start" | "center" | "end";
}) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState<DateString>(date ?? todayLocal());

  const quick = (d: DateString | null) => {
    onChange(d, time);
    setOpen(false);
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
              "data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 duration-150",
            )}
          >
            <div className="mb-2 flex flex-wrap gap-1.5">
              <Button size="xs" variant="outline" onClick={() => quick(todayLocal())}>
                Today
              </Button>
              <Button size="xs" variant="outline" onClick={() => quick(addDays(todayLocal(), 1))}>
                Tomorrow
              </Button>
              <Button size="xs" variant="outline" onClick={() => quick(addDays(todayLocal(), 7))}>
                Next week
              </Button>
            </div>
            <Calendar
              month={month}
              selected={date ?? undefined}
              disableFuture={false}
              onSelect={(d) => {
                onChange(d, time);
                setOpen(false);
              }}
              onPrevMonth={() => setMonth((m) => shiftMonth(m, -1))}
              onNextMonth={() => setMonth((m) => shiftMonth(m, 1))}
            />
            <div className="mt-3 flex items-center gap-2 border-t border-border/60 pt-2.5">
              <Clock className="size-3.5 text-muted-foreground" />
              <input
                type="time"
                value={time ?? ""}
                onChange={(e) => onChange(date ?? todayLocal(), e.target.value || null)}
                className="h-7 flex-1 rounded-md border border-border bg-background px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
              />
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="Clear due date"
                onClick={() => quick(null)}
              >
                <CalendarX className="text-muted-foreground" />
              </Button>
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
