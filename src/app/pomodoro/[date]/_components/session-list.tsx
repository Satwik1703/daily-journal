"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatClock } from "@/lib/pomodoro-meta";
import type { PomodoroDay } from "@/db/queries/pomodoro";
import { deleteSession } from "@/app/actions/pomodoro";

type Session = PomodoroDay["sessions"][number];

export function SessionList({ sessions }: { sessions: Session[] }) {
  const [deleteTarget, setDeleteTarget] = useState<Session | null>(null);
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    if (!deleteTarget) return;
    const id = deleteTarget.id;
    startTransition(async () => {
      try {
        await deleteSession(id);
        toast.success("Session deleted");
        setDeleteTarget(null);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to delete");
      }
    });
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="font-serif text-lg font-normal">
          Sessions
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            {sessions.length}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {sessions.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No sessions yet on this day.
          </p>
        ) : (
          sessions.map((s) => (
            <div
              key={s.id}
              className="flex items-start gap-3 rounded-lg border border-border/60 bg-muted/20 p-3"
            >
              <div className="flex flex-col items-center pt-0.5">
                <span
                  aria-hidden
                  className="size-7 rounded-full flex items-center justify-center text-base"
                  style={{
                    backgroundColor: s.category ? `${s.category.color}22` : "var(--muted)",
                    boxShadow: s.category
                      ? `inset 0 0 0 2px ${s.category.color}`
                      : undefined,
                  }}
                >
                  {s.category?.emoji ?? "•"}
                </span>
              </div>
              <div className="min-w-0 flex-1 space-y-0.5">
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium">{s.category?.name ?? "Uncategorized"}</span>
                  <span
                    className={cn(
                      "text-[10px] uppercase tracking-wider rounded px-1.5 py-px",
                      s.source === "timer" && "bg-primary/15 text-primary",
                      s.source === "partial" && "bg-status-avg/30 text-foreground/70",
                      s.source === "manual" && "bg-muted text-muted-foreground",
                    )}
                  >
                    {s.source}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground tabular-nums">
                  {formatClock(new Date(s.startedAt))} → {formatClock(new Date(s.endedAt))} ·{" "}
                  <span className="text-foreground/80">{s.durationMin}m</span>
                </div>
                {s.description ? (
                  <p className="text-xs text-foreground/80 whitespace-pre-wrap break-words pt-1">
                    {s.description}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => setDeleteTarget(s)}
                className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                aria-label="Delete session"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ))
        )}
      </CardContent>

      <Dialog open={deleteTarget !== null} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-serif text-base">Delete session?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This removes the session from history. Cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="outline" onClick={handleDelete} disabled={pending}>
              {pending ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
