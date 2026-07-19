"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { toast } from "sonner";
import { flushQueue } from "@/lib/sync/mutate";
import { postFlushToSW } from "@/lib/sync/sw-support";

const FLUSH_INTERVAL_MS = 30_000;

/**
 * Mounted once in the root layout. Drains the IDB mutation queue on app
 * focus, visibility change, and every 30s. Also nudges the service worker
 * to attempt its own drain (handles the case where the SW is alive but the
 * client tab woke up first).
 *
 * No-op on public routes (/auth/*, /reset) — nothing meaningful to sync
 * without a session, and racing against /reset's IDB wipe would leak an
 * open connection that blocks the delete.
 */
export function SyncBootstrap() {
  const pathname = usePathname();
  const skip =
    pathname === "/reset" ||
    pathname === "/auth/login" ||
    pathname?.startsWith("/auth/") === true;

  useEffect(() => {
    if (skip) return;
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
        // Skip the toast on session-expiration failures — the page is
        // hard-navigating to /auth/login via authAwareFetch, and a
        // "Sync failed: Unauthorized" toast on the login screen is
        // just confusing noise.
        const err = data.error ?? "";
        if (/unauthori[sz]ed/i.test(err) || err.startsWith("HTTP 401")) return;
        toast.error(
          `Sync failed: ${err || "unknown"}`,
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
  }, [skip]);

  return null;
}
