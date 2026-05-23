"use client";

import { enqueue, markDone, markFailed, markInFlight } from "./queue";
import { invalidateCache } from "./cache";

const STATUS_CHANNEL = "sync-status";
const CONFLICT_CHANNEL = "sync-conflict";

/**
 * Map mutation kinds to the cache page keys they should invalidate on
 * success. Triggers an SWR refetch on any open client.
 */
function cacheKeysFor(kind: string, args: unknown): string[] {
  const a = (args ?? {}) as {
    date?: string;
    habitId?: string;
    goalId?: string;
    period?: string;
    periodKey?: string;
  };
  const keys: string[] = [];
  if (kind.startsWith("toggle_habit") || kind === "log_habit_value" || kind === "delete_habit_value_log") {
    if (a.date) keys.push(`habits:${a.date}`);
    keys.push("habits:*");
  }
  if (kind.startsWith("create_habit") || kind.startsWith("update_habit") || kind.startsWith("archive_habit") || kind.startsWith("unarchive_habit") || kind === "reorder_habits") {
    keys.push("habits:*");
    keys.push("settings");
  }
  if (kind === "create_session" || kind === "update_session" || kind === "delete_session") {
    if (a.date) keys.push(`pomodoro:${a.date}`);
    keys.push("pomodoro:*");
    keys.push("insights");
  }
  if (kind === "save_journal_entry" || kind === "add_task" || kind === "toggle_task" || kind === "update_task_text" || kind === "delete_task" || kind === "move_task") {
    if (a.date) keys.push(`journal:${a.date}`);
    keys.push("journal:*");
  }
  if (kind.startsWith("create_goal") || kind.startsWith("update_goal_cascade") || kind.startsWith("delete_goal_cascade") || kind === "archive_goal" || kind === "unarchive_goal" || kind === "set_goal_pinned" || kind === "log_progress" || kind === "delete_progress" || kind === "add_checklist_item" || kind === "update_checklist_item" || kind === "toggle_checklist_item" || kind === "delete_checklist_item" || kind === "save_reflection") {
    if (a.period && a.periodKey) keys.push(`goals:${a.period}:${a.periodKey}`);
    keys.push("goals:*");
  }
  if (kind.includes("question")) keys.push("settings");
  if (kind.includes("category")) {
    keys.push("settings");
    keys.push("pomodoro:*");
  }
  if (kind === "set_pomo_sound") keys.push("settings");
  if (kind === "create_workout" || kind === "delete_workout") keys.push("gym");
  return keys;
}

function broadcast(channel: string, payload: unknown): void {
  if (typeof BroadcastChannel === "undefined") return;
  try {
    const ch = new BroadcastChannel(channel);
    ch.postMessage(payload);
    ch.close();
  } catch {
    /* ignore */
  }
}

async function registerBackgroundSync(): Promise<void> {
  if (typeof navigator === "undefined") return;
  if (!("serviceWorker" in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sync = (reg as ServiceWorkerRegistration & {
      sync?: { register: (tag: string) => Promise<void> };
    }).sync;
    if (sync) await sync.register("mutation-replay");
  } catch {
    /* ignore — Safari has no Background Sync */
  }
}

/**
 * Fire-and-forget mutation. Pushes the mutation onto the IDB queue, attempts
 * an immediate POST to /api/sync, and falls back to Background Sync if the
 * network is down. Caller never awaits the network.
 *
 * Optimistic UI updates are the caller's responsibility — apply them before
 * calling mutate().
 */
export async function mutate(kind: string, args: unknown): Promise<{ id: string }> {
  const id = await enqueue(kind, args);
  broadcast(STATUS_CHANNEL, { type: "enqueued", id, kind });
  void attemptSend(id, kind, args);
  return { id };
}

async function attemptSend(id: string, kind: string, args: unknown): Promise<void> {
  try {
    await markInFlight(id);
    const res = await fetch("/api/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, args }),
      keepalive: true,
    });
    if (res.ok) {
      await markDone(id);
      broadcast(STATUS_CHANNEL, { type: "done", id });
      void invalidateCache(...cacheKeysFor(kind, args));
    } else {
      const body = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      const errMsg = body?.error ?? `HTTP ${res.status}`;
      await markFailed(id, errMsg);
      broadcast(CONFLICT_CHANNEL, { id, kind, error: errMsg });
      broadcast(STATUS_CHANNEL, { type: "failed", id, error: errMsg });
      await registerBackgroundSync();
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await markFailed(id, message);
    broadcast(STATUS_CHANNEL, { type: "failed", id, error: message });
    await registerBackgroundSync();
  }
}

/**
 * Drain all pending + failed mutations. Called by sync-bootstrap on focus +
 * 30s interval + manual "Force sync" button.
 */
export async function flushQueue(): Promise<{ ok: number; failed: number }> {
  const { listPending } = await import("./queue");
  const rows = await listPending();
  let ok = 0;
  let failed = 0;
  for (const row of rows) {
    try {
      await markInFlight(row.id);
      const res = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: row.kind, args: row.args }),
      });
      if (res.ok) {
        await markDone(row.id);
        ok++;
      } else {
        const body = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        await markFailed(row.id, body?.error ?? `HTTP ${res.status}`);
        failed++;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await markFailed(row.id, message);
      failed++;
    }
  }
  broadcast(STATUS_CHANNEL, { type: "flushed", ok, failed });
  return { ok, failed };
}

export async function retryOne(id: string): Promise<boolean> {
  const { listPending } = await import("./queue");
  const rows = await listPending();
  const row = rows.find((r) => r.id === id);
  if (!row) return false;
  try {
    await markInFlight(row.id);
    const res = await fetch("/api/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: row.kind, args: row.args }),
    });
    if (res.ok) {
      await markDone(row.id);
      return true;
    }
    const body = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    await markFailed(row.id, body?.error ?? `HTTP ${res.status}`);
    return false;
  } catch (err) {
    await markFailed(row.id, err instanceof Error ? err.message : String(err));
    return false;
  }
}
