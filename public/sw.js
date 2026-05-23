// Habit Log service worker.
// Bump VERSION on every deploy or you'll see stale shells on phones.
const VERSION = "habit-log-v9";
const SHELL = ["/", "/journal", "/habits", "/pomodoro", "/goals", "/insights", "/gym", "/more", "/settings", "/manifest.webmanifest"];

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
