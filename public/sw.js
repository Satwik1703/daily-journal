// Habit Log service worker.
// Bump VERSION on every deploy or you'll see stale shells on phones.
const VERSION = "habit-log-v11";
const SHELL = ["/", "/journal", "/habits", "/pomodoro", "/goals", "/insights", "/gym", "/gym/insights", "/more", "/settings", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(VERSION).then((c) => c.addAll(SHELL).catch(() => {})),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))),
    ),
  );
  self.clients.claim();
});

// ---------- Background Sync: mutation queue replay ----------
// Opens the same IDB the client uses (`habit_log_sync`) and POSTs each
// pending mutation to /api/sync. Idempotent — already-done rows are gone.

function openSyncIDB() {
  return new Promise(function (resolve, reject) {
    const req = indexedDB.open("habit_log_sync", 1);
    req.onsuccess = function () { resolve(req.result); };
    req.onerror = function () { reject(req.error); };
    req.onupgradeneeded = function () {
      const db = req.result;
      if (!db.objectStoreNames.contains("pending_mutations")) {
        const store = db.createObjectStore("pending_mutations", { keyPath: "id" });
        store.createIndex("createdAt", "createdAt");
      }
      if (!db.objectStoreNames.contains("cache_pages")) {
        db.createObjectStore("cache_pages", { keyPath: "key" });
      }
    };
  });
}

function idbListPending(db) {
  return new Promise(function (resolve, reject) {
    const tx = db.transaction("pending_mutations", "readonly");
    const store = tx.objectStore("pending_mutations").index("createdAt");
    const req = store.getAll();
    req.onsuccess = function () { resolve(req.result || []); };
    req.onerror = function () { reject(req.error); };
  });
}

function idbDelete(db, id) {
  return new Promise(function (resolve, reject) {
    const tx = db.transaction("pending_mutations", "readwrite");
    tx.objectStore("pending_mutations").delete(id);
    tx.oncomplete = resolve;
    tx.onerror = function () { reject(tx.error); };
  });
}

function idbMarkFailed(db, row, error) {
  return new Promise(function (resolve, reject) {
    row.status = "failed";
    row.lastError = error;
    row.attempts = (row.attempts || 0) + 1;
    const tx = db.transaction("pending_mutations", "readwrite");
    tx.objectStore("pending_mutations").put(row);
    tx.oncomplete = resolve;
    tx.onerror = function () { reject(tx.error); };
  });
}

async function drainQueue() {
  let db;
  try { db = await openSyncIDB(); } catch (e) { return; }
  let rows;
  try { rows = await idbListPending(db); } catch (e) { return; }
  for (const row of rows) {
    try {
      const res = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: row.kind, args: row.args }),
      });
      if (res.ok) {
        await idbDelete(db, row.id);
      } else {
        let err = "HTTP " + res.status;
        try { const body = await res.json(); if (body && body.error) err = body.error; } catch (e) {}
        await idbMarkFailed(db, row, err);
      }
    } catch (e) {
      await idbMarkFailed(db, row, e && e.message ? e.message : String(e));
    }
  }
}

self.addEventListener("sync", (event) => {
  if (event.tag === "mutation-replay") {
    event.waitUntil(drainQueue());
  }
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "flush-now") {
    event.waitUntil(drainQueue());
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const c of clients) {
        if (c.url.includes("/pomodoro") && "focus" in c) return c.focus();
      }
      if (clients.length > 0 && "focus" in clients[0]) {
        try {
          await clients[0].navigate("/pomodoro");
          return clients[0].focus();
        } catch (_) {
          /* fall through to openWindow */
        }
      }
      return self.clients.openWindow("/pomodoro");
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return; // never cache mutations
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  // Network-first for navigations (HTML)
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(() =>
        caches.match(req).then((r) => r || caches.match("/journal")),
      ),
    );
    return;
  }

  // Cache-first for static + icons
  if (url.pathname.startsWith("/_next/static") || url.pathname.startsWith("/icons") || url.pathname === "/icon" || url.pathname === "/apple-icon") {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req).then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(VERSION).then((c) => c.put(req, clone));
          }
          return res;
        });
      }),
    );
  }
});
