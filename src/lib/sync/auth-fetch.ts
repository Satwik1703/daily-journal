"use client";

/**
 * Session-expiration-aware fetch wrapper.
 *
 * All /api/page/* and /api/sync endpoints return 401 when the session cookie
 * is missing / expired. Without this wrapper the caller sees a generic
 * "Fetch failed" throw, useCachedPage's refresh silently swallows it, and
 * the user stares at stale IDB-hydrated data or a permanent skeleton with
 * no path to recovery. Middleware can't help — it only fires on
 * navigations, not XHR.
 *
 * On 401, this wrapper hard-navigates to /auth/login (preserving the
 * intended `next=` return path) and never resolves — so the caller's
 * `if (!res.ok) throw` and the surrounding React state updates don't run
 * against a page that's already unmounting.
 *
 * On every other status (including non-401 errors), returns the response
 * verbatim — callers keep their existing error handling.
 */
export async function authAwareFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const res = await fetch(input, init);
  if (res.status === 401 && typeof window !== "undefined") {
    const path = window.location.pathname;
    // Already on a public route — nothing to redirect to. Return the 401
    // verbatim; caller handles it (mutate.ts marks the mutation failed).
    // Prevents an infinite reload loop when a leftover queued mutation
    // POSTs against /api/sync from the login screen.
    if (
      path === "/auth/login" ||
      path.startsWith("/auth/") ||
      path === "/reset"
    ) {
      return res;
    }
    const next = path + window.location.search;
    const url = `/auth/login?next=${encodeURIComponent(next)}`;
    window.location.replace(url);
    // Never resolve — the page is navigating away. Prevents downstream
    // `if (!res.ok) throw` + setState calls from firing on a doomed tree.
    await new Promise<void>(() => {});
  }
  return res;
}
