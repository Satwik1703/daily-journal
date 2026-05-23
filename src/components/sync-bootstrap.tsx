"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { flushQueue } from "@/lib/sync/mutate";
import { postFlushToSW } from "@/lib/sync/sw-support";

const FLUSH_INTERVAL_MS = 30_000;

/**
 * Mounted once in the root layout. Drains the IDB mutation queue on app
 * focus, visibility change, and every 30s. Also nudges the service worker
 * to attempt its own drain (handles the case where the SW is alive but the
 * client tab woke up first).
 */
export function SyncBootstrap() {
  useEffect(() => {
    let cancelled = false;

    function safeFlush() {
      if (cancelled) return;
      void flushQueue().catch(() => {});
      void postFlushToSW();
    }

    // Initial flush on mount.
    safeFlush();

    const onFocus = () => safeFlush();
    const onVisibility = () => {
      if (document.visibilityState === "visible") safeFlush();
    };
    const onOnline = () => safeFlush();

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("online", onOnline);

    const interval = window.setInterval(safeFlush, FLUSH_INTERVAL_MS);

    let conflictChannel: BroadcastChannel | null = null;
    try {
      conflictChannel = new BroadcastChannel("sync-conflict");
      conflictChannel.onmessage = (e) => {
        const data = e.data as { kind?: string; error?: string };
        if (!data) return;
        toast.error(
          `Sync failed: ${data.error ?? "unknown"}`,
          { description: "Check Settings → Sync status to retry or discard." },
        );
      };
    } catch {
      /* ignore */
    }

    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("online", onOnline);
      window.clearInterval(interval);
      conflictChannel?.close();
    };
  }, []);

  return null;
}
