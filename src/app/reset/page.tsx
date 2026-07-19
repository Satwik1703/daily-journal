"use client";

import { useEffect, useState } from "react";
import { resetLocalState } from "@/lib/sync/reset-local";

/**
 * Public escape hatch. Users type `/reset` into the address bar when the
 * app is stuck showing stale data even after a normal page reload.
 *
 * Wipes every scrap of client-side state (IDB / SW / caches / localStorage)
 * then hard-navigates to /auth/login. Middleware treats `/reset` as public
 * (no session cookie required) so this always works even mid-logout.
 */
export default function ResetPage() {
  const [status, setStatus] = useState<"working" | "done" | "error">("working");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await resetLocalState();
        if (cancelled) return;
        setStatus("done");
        // Small delay so the "done" state is visible before the redirect.
        window.setTimeout(() => {
          window.location.replace("/auth/login");
        }, 400);
      } catch {
        if (cancelled) return;
        setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-dvh flex items-center justify-center px-6">
      <div className="max-w-sm text-center space-y-3">
        <h1 className="font-serif text-2xl">
          {status === "working" && "Resetting local state…"}
          {status === "done" && "Done. Redirecting to login."}
          {status === "error" && "Reset failed."}
        </h1>
        <p className="text-sm text-muted-foreground">
          {status === "working" &&
            "Clearing offline cache, service worker, and stored preferences."}
          {status === "done" && "One moment."}
          {status === "error" && (
            <>
              Try closing the app fully (swipe away in the app switcher) and reopening.
              If that also fails, uninstall and reinstall the PWA from the browser.
            </>
          )}
        </p>
        {status === "error" && (
          <a
            href="/auth/login"
            className="inline-block rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"
          >
            Go to login
          </a>
        )}
      </div>
    </div>
  );
}
