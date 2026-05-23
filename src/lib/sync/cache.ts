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

/**
 * Broadcast invalidations on the cache-invalidate channel. Keys ending in
 * `:*` are treated as prefix wildcards by useCachedPage's listener.
 */
export async function invalidateCache(...keys: string[]): Promise<void> {
  if (typeof BroadcastChannel === "undefined") return;
  try {
    const ch = new BroadcastChannel(INVALIDATE_CHANNEL);
    for (const key of keys) ch.postMessage({ key });
    ch.close();
  } catch {
    /* ignore */
  }
}

function matchesKey(incoming: string, ownKey: string): boolean {
  if (incoming === ownKey) return true;
  if (incoming.endsWith(":*")) {
    const prefix = incoming.slice(0, -1); // strips trailing *
    return ownKey.startsWith(prefix);
  }
  return false;
}

/**
 * SWR-style hook backed by IndexedDB.
 *
 *   - First render returns `initialServerData` (often `null` for client-shell
 *     pages that don't server-fetch).
 *   - On mount: reads IDB cache → if present, immediately swaps state. This
 *     is what makes page navigation feel instant on revisit.
 *   - Always triggers `fetcher()` in background and writes the fresh result
 *     to both state and IDB.
 *   - Listens on `cache-invalidate` BroadcastChannel for cross-tab refresh.
 *     Matches its own key exactly OR a `prefix:*` wildcard.
 */
export function useCachedPage<T>(
  key: string,
  initialServerData: T,
  fetcher: () => Promise<T>,
): T {
  const [data, setData] = useState<T>(initialServerData);

  useEffect(() => {
    let cancelled = false;

    async function loadFromIDB() {
      const cached = await getCachedPage<T>(key);
      if (cancelled || cached == null) return;
      setData(cached);
    }

    async function refresh() {
      try {
        const fresh = await fetcher();
        if (cancelled) return;
        setData(fresh);
        await setCachedPage(key, fresh);
      } catch {
        /* keep current */
      }
    }

    void loadFromIDB();
    void refresh();

    let ch: BroadcastChannel | null = null;
    try {
      ch = new BroadcastChannel(INVALIDATE_CHANNEL);
      ch.onmessage = (e) => {
        const incoming = e.data?.key;
        if (typeof incoming !== "string") return;
        if (matchesKey(incoming, key)) void refresh();
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
