"use client";

import { useEffect, useState } from "react";
import { openSyncDB, type CachedPage } from "./db";

const INVALIDATE_CHANNEL = "cache-invalidate";

export async function getCachedPage<T>(key: string): Promise<T | null> {
  try {
    const db = await openSyncDB();
    const row = await db.get("cache_pages", key);
    return (row?.data as T) ?? null;
  } catch {
    return null;
  }
}

export async function setCachedPage<T>(key: string, data: T): Promise<void> {
  try {
    const db = await openSyncDB();
    const row: CachedPage = { key, data, fetchedAt: Date.now() };
    await db.put("cache_pages", row);
  } catch {
    /* ignore */
  }
}

export async function invalidateCache(...keys: string[]): Promise<void> {
  for (const key of keys) {
    try {
      const db = await openSyncDB();
      const row = await db.get("cache_pages", key);
      if (row) {
        await db.put("cache_pages", { ...row, stale: true });
      }
    } catch {
      /* ignore */
    }
  }
  if (typeof BroadcastChannel !== "undefined") {
    try {
      const ch = new BroadcastChannel(INVALIDATE_CHANNEL);
      for (const key of keys) ch.postMessage({ key });
      ch.close();
    } catch {
      /* ignore */
    }
  }
}

/**
 * SWR-style hook backed by IndexedDB.
 *
 *   - First render returns `initialServerData` (the value the server
 *     component baked into HTML).
 *   - On mount: writes initialServerData to IDB so next session has it.
 *   - On mount + on `cache-invalidate` broadcast for this key: triggers
 *     `fetcher()` in background and swaps state when the response arrives.
 *
 * The hook never blocks the UI. If the network is down the UI keeps showing
 * whatever it had.
 */
export function useCachedPage<T>(
  key: string,
  initialServerData: T,
  fetcher: () => Promise<T>,
): T {
  const [data, setData] = useState<T>(initialServerData);

  useEffect(() => {
    let cancelled = false;

    // Persist initial server snapshot.
    void setCachedPage(key, initialServerData);

    async function refresh() {
      try {
        const fresh = await fetcher();
        if (cancelled) return;
        setData(fresh);
        await setCachedPage(key, fresh);
      } catch {
        /* ignore */
      }
    }

    void refresh();

    let ch: BroadcastChannel | null = null;
    try {
      ch = new BroadcastChannel(INVALIDATE_CHANNEL);
      ch.onmessage = (e) => {
        if (e.data?.key === key) void refresh();
      };
    } catch {
      /* ignore */
    }

    return () => {
      cancelled = true;
      ch?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return data;
}
