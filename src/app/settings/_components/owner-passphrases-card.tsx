"use client";

import { useEffect, useState } from "react";
import { Copy, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  listAllPassphrasesForOwner,
  type OwnerPassphraseRow,
} from "@/app/actions/auth";
import { toast } from "sonner";

export function OwnerPassphrasesCard() {
  const [rows, setRows] = useState<OwnerPassphraseRow[]>([]);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const r = await listAllPassphrasesForOwner();
        setRows(r);
      } catch {
        // Non-owner → server throws AuthError → render nothing.
      }
    })();
  }, []);

  function copy(text: string) {
    navigator.clipboard
      .writeText(text)
      .then(() => toast.success("Copied."))
      .catch(() => toast.error("Couldn't copy."));
  }

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="font-serif text-lg font-normal">
          All passphrases
        </CardTitle>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setRevealed((v) => !v)}
          aria-label={revealed ? "Hide passphrases" : "Reveal passphrases"}
        >
          {revealed ? (
            <>
              <EyeOff className="size-4 mr-1" /> Hide
            </>
          ) : (
            <>
              <Eye className="size-4 mr-1" /> Reveal
            </>
          )}
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <p className="text-[11px] text-muted-foreground">
          Owner-only. Use it when a friend forgets and the recovery code path isn&apos;t
          enough. Older accounts may show &quot;—&quot; until next reset.
        </p>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No users yet.</p>
        ) : (
          rows.map((r) => (
            <div
              key={r.id}
              className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2"
            >
              <div className="flex-1 min-w-0">
                <div className="font-medium leading-tight text-sm flex items-center gap-1">
                  {r.name}
                  {r.isOwner ? (
                    <span className="text-[9px] uppercase rounded-full bg-primary/15 text-primary px-1.5 py-0">
                      owner
                    </span>
                  ) : null}
                </div>
                <div className="text-[11px] text-muted-foreground font-mono">
                  {r.passphrase
                    ? revealed
                      ? r.passphrase
                      : "•".repeat(7) + " " + "•".repeat(3)
                    : "—"}
                  {r.honeypotEmoji && revealed ? (
                    <span className="ml-2 text-destructive/80">
                      trap {r.honeypotEmoji}
                    </span>
                  ) : null}
                </div>
              </div>
              {r.passphrase ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => copy(r.passphrase!)}
                  aria-label={`Copy ${r.name}'s passphrase`}
                  disabled={!revealed}
                >
                  <Copy className="size-4" />
                </Button>
              ) : null}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
