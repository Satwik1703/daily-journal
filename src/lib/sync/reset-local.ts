"use client";

/**
 * Nuke every scrap of client-side state — IndexedDB databases (all
 * `habit_log_sync*` instances across users), the localStorage UID mirror,
 * every service-worker registration, and every Cache Storage entry.
 *
 * Called from:
 *   - The `/reset` public escape-hatch route the user can type into the
 *     address bar when the app is stuck.
 *   - Settings → Sync Status → "Reset local state" button.
 *   - Anywhere else the app decides local state is unrecoverable.
 *
 * Does NOT clear the session cookie — that's HTTP-only and only the server
 * can touch it. The caller decides where to navigate afterwards; a hard
 * `location.replace('/auth/login')` is the usual choice (middleware will
 * then either bounce onwards if the session is still valid, or serve the
 * login roster).
 */
export async function resetLocalState(): Promise<void> {
  // 1. IndexedDB — enumerate every DB whose name starts with `habit_log_sync`
  //    (per-user namespacing added in Phase 12) and delete them all.
  try {
    const idb = window.indexedDB as IDBFactory & {
      databases?: () => Promise<{ name?: string; version?: number }[]>;
    };
    let names: string[] = [];
    if (typeof idb.databases === "function") {
      const list = await idb.databases();
      names = list.map((d) => d.name ?? "").filter((n) => n.startsWith("habit_log_sync"));
    } else {
      // Safari fallback — the API isn't available. Delete the pre-Phase-12
      // legacy name plus the current user's namespaced name if we can read
      // it from localStorage. Any additional per-user DBs will resolve
      // themselves next time the app opens (fresh caches, no data loss).
      names = ["habit_log_sync"];
      try {
        const uid = window.localStorage.getItem("__habit_log_uid");
        if (uid) names.push(`habit_log_sync_u${uid}`);
      } catch {
        /* localStorage blocked */
      }
    }
    await Promise.all(
      names.map(
        (name) =>
          new Promise<void>((resolve) => {
            const req = window.indexedDB.deleteDatabase(name);
            req.onsuccess = () => resolve();
            req.onerror = () => resolve();
            req.onblocked = () => resolve();
          }),
      ),
    );
  } catch {
    /* keep going */
  }

  // 2. localStorage UID mirror + any todo/sort/mode/collapse settings.
  try {
    window.localStorage.removeItem("__habit_log_uid");
  } catch {
    /* ignore */
  }

  // 3. Service-worker registrations.
  try {
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
  } catch {
    /* ignore */
  }

  // 4. Cache Storage.
  try {
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch {
    /* ignore */
  }
}
