"use client";

import { useEffect, useState, useTransition } from "react";
import { RefreshCcw, Trash2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { listPending, clearAll, discardMutation } from "@/lib/sync/queue";
import { flushQueue, retryOne } from "@/lib/sync/mutate";
import { resetLocalState } from "@/lib/sync/reset-local";
import type { PendingMutation } from "@/lib/sync/db";

const POLL_MS = 2000;

const KIND_LABELS: Record<string, string> = {
  toggle_habit: "Toggle habit",
  log_habit_value: "Log habit value",
  save_journal_entry: "Save journal entry",
  add_task: "Add task",
  toggle_task: "Toggle task",
  update_task_text: "Update task text",
  delete_task: "Delete task",
  move_task: "Move task",
  create_session: "Create pomo session",
  update_session: "Update pomo session",
  delete_session: "Delete pomo session",
  log_progress: "Log goal progress",
  add_checklist_item: "Add checklist item",
  toggle_checklist_item: "Toggle checklist item",
  delete_checklist_item: "Delete checklist item",
  set_goal_pinned: "Pin/unpin goal",
  create_goal: "Create goal",
  update_goal_cascade: "Edit goal",
  delete_goal_cascade: "Delete goal",
  archive_goal: "Archive goal",
  unarchive_goal: "Unarchive goal",
  save_reflection: "Save reflection",
  create_workout: "Log workout",
  delete_workout: "Delete workout",
};

function labelOf(kind: string): string {
  return KIND_LABELS[kind] ?? kind;
}

function ageOf(createdAt: number): string {
  const diff = Math.max(0, Date.now() - createdAt);
  if (diff < 60_000) return `${Math.round(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.round(diff / 60_000)}m ago`;
  return `${Math.round(diff / 3_600_000)}h ago`;
}

export function SyncStatusPanel() {
  const [rows, setRows] = useState<PendingMutation[]>([]);
  const [, setNow] = useState(0);
  const [pending, startTransition] = useTransition();
  const [confirmClear, setConfirmClear] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [lastSync, setLastSync] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      try {
        const next = await listPending();
        if (!cancelled) setRows(next);
      } catch {
        /* IDB not ready yet */
      }
    }

    refresh();
    const interval = window.setInterval(() => {
      refresh();
      setNow(Date.now()); // re-render age strings
    }, POLL_MS);

    let ch: BroadcastChannel | null = null;
    try {
      ch = new BroadcastChannel("sync-status");
      ch.onmessage = (e) => {
        if (e.data?.type === "done" || e.data?.type === "flushed") {
          setLastSync(Date.now());
        }
        refresh();
      };
    } catch {
      /* ignore */
    }

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      ch?.close();
    };
  }, []);

  const failedCount = rows.filter((r) => r.status === "failed").length;
  const pendingCount = rows.length - failedCount;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between font-serif text-lg font-normal">
          <span>Sync status</span>
          <span className="text-xs font-sans text-muted-foreground">
            {pendingCount} pending
            {failedCount > 0 ? ` · ${failedCount} failed` : ""}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.length === 0 ? (
          <p className="rounded-md border border-dashed border-border bg-muted/20 px-3 py-4 text-center text-sm text-muted-foreground">
            All changes synced. ✓
          </p>
        ) : (
          rows.map((r) => (
            <div
              key={r.id}
              className="flex items-start gap-2 rounded-md border border-border/60 bg-muted/20 px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium">{labelOf(r.kind)}</span>
                  <span
                    className={
                      "rounded px-1.5 py-px text-[10px] uppercase tracking-wider " +
                      (r.status === "failed"
                        ? "bg-destructive/15 text-destructive"
                        : r.status === "in_flight"
                          ? "bg-primary/15 text-primary"
                          : "bg-muted text-muted-foreground")
                    }
                  >
                    {r.status}
                  </span>
                </div>
                <div className="text-[11px] text-muted-foreground tabular-nums">
                  {ageOf(r.createdAt)}
                  {r.attempts > 0 ? ` · ${r.attempts} ${r.attempts === 1 ? "attempt" : "attempts"}` : ""}
                </div>
                {r.lastError ? (
                  <div className="mt-1 flex items-start gap-1 text-[11px] text-destructive">
                    <AlertCircle className="size-3 shrink-0 mt-0.5" />
                    <span className="break-words">{r.lastError}</span>
                  </div>
                ) : null}
              </div>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="Retry now"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const ok = await retryOne(r.id);
                    if (ok) {
                      toast.success("Synced");
                      setLastSync(Date.now());
                    } else {
                      toast.error("Still failing");
                    }
                  })
                }
              >
                <RefreshCcw className="size-3.5" />
              </Button>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="Discard mutation"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    await discardMutation(r.id);
                    toast.info("Discarded");
                  })
                }
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          ))
        )}

        <div className="flex items-center justify-between pt-2 text-[11px] text-muted-foreground">
          <span>
            {lastSync != null
              ? `Last sync: ${new Date(lastSync).toLocaleTimeString()}`
              : "No sync yet this session"}
          </span>
          <div className="flex gap-1.5">
            <Button
              size="sm"
              variant="outline"
              disabled={pending || rows.length === 0}
              onClick={() =>
                startTransition(async () => {
                  const res = await flushQueue();
                  if (res.ok > 0) toast.success(`Synced ${res.ok}`);
                  if (res.failed > 0) toast.error(`${res.failed} still failing`);
                  setLastSync(Date.now());
                })
              }
            >
              Sync now
            </Button>
            {rows.length > 0 ? (
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive hover:bg-destructive/10"
                onClick={() => setConfirmClear(true)}
              >
                Clear queue
              </Button>
            ) : null}
          </div>
        </div>

        <div className="mt-2 rounded-md border border-border/60 bg-muted/10 px-3 py-2">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">Stuck showing stale data?</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Reset local state — clears the offline cache, service worker, and stored
                preferences, then returns you to login. You can also type <code>/reset</code>
                in the address bar anytime the app is frozen.
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="shrink-0 text-destructive hover:bg-destructive/10"
              onClick={() => setConfirmReset(true)}
            >
              Reset
            </Button>
          </div>
        </div>
      </CardContent>

      <Dialog open={confirmReset} onOpenChange={setConfirmReset}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-serif text-base">Reset local state?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This wipes every scrap of client-side state — the offline cache (IndexedDB), service
            worker, and stored preferences — then reloads to the login screen. No server data is
            touched. Any pending mutations still queued will be lost.
          </p>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="ghost" />}>Cancel</DialogClose>
            <Button
              variant="destructive"
              onClick={async () => {
                await resetLocalState();
                window.location.replace("/auth/login");
              }}
            >
              Reset and log out
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmClear} onOpenChange={setConfirmClear}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-serif text-base">Clear pending queue?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Discards {rows.length} pending {rows.length === 1 ? "mutation" : "mutations"}. Optimistic
            UI updates already shown on screen will not be reverted, but the server will not be told
            about them. Use this only when something is stuck.
          </p>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="ghost" />}>Cancel</DialogClose>
            <Button
              variant="destructive"
              onClick={async () => {
                await clearAll();
                setConfirmClear(false);
                toast.info("Queue cleared");
              }}
            >
              Clear
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
