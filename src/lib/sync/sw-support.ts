"use client";

export function hasBackgroundSync(): boolean {
  if (typeof navigator === "undefined") return false;
  if (!("serviceWorker" in navigator)) return false;
  return "SyncManager" in window;
}

export async function postFlushToSW(): Promise<void> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    reg.active?.postMessage({ type: "flush-now" });
  } catch {
    /* ignore */
  }
}
