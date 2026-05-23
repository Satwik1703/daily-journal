"use client";

import { enqueue, markDone, markFailed, markInFlight } from "./queue";

const STATUS_CHANNEL = "sync-status";
const CONFLICT_CHANNEL = "sync-conflict";

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
