"use client";

import { useEffect, useState, useTransition } from "react";
import { Copy, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { UserTile } from "@/components/user-tile";
import {
  issueRecoveryCode,
  listFriendsForOwnerRecovery,
  type OwnerFriendRow,
} from "@/app/actions/auth";

export function OwnerRecoveryCard() {
  const [friends, setFriends] = useState<OwnerFriendRow[]>([]);
  const [pending, startTransition] = useTransition();
  const [issued, setIssued] = useState<{
    code: string;
    name: string;
    expiresAt: number;
  } | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const r = await listFriendsForOwnerRecovery();
        setFriends(r);
      } catch {
        // Non-owner → server throws AuthError → we just render nothing.
      }
    })();
  }, []);

  function generate(friend: OwnerFriendRow) {
    startTransition(async () => {
      const r = await issueRecoveryCode({ targetUserId: friend.id });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      setIssued({ code: r.code, name: friend.name, expiresAt: r.expiresAt });
    });
  }

  function copy() {
    if (!issued) return;
    navigator.clipboard
      .writeText(issued.code)
      .then(() => toast.success("Copied."))
      .catch(() => toast.error("Couldn't copy. Long-press to select."));
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="font-serif text-lg font-normal">
            Reset a friend&apos;s passphrase
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {friends.length === 0 ? (
            <p className="text-sm text-muted-foreground">No friends yet.</p>
          ) : (
            friends.map((f) => (
              <div
                key={f.id}
                className="flex items-center gap-3 rounded-md border border-border bg-card px-3 py-2"
              >
                <UserTile
                  name={f.name}
                  gradientFrom={f.tileGradientFrom}
                  gradientTo={f.tileGradientTo}
                  font={f.tileFont}
                  border={f.tileBorder}
                  size={36}
                />
                <div className="flex-1 min-w-0">
                  <div className="font-medium leading-tight">{f.name}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {f.hasDoodle ? "Has doodle backup" : "No doodle — code is only path"}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => generate(f)}
                  disabled={pending}
                >
                  <KeyRound className="size-4 mr-1" />
                  Code
                </Button>
              </div>
            ))
          )}
          <p className="text-[11px] text-muted-foreground pt-1">
            Generated codes expire in 30 minutes. Sending a new code invalidates the prior one.
          </p>
        </CardContent>
      </Card>

      <Dialog open={issued !== null} onOpenChange={(o) => !o && setIssued(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Code for {issued?.name}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-3 py-3">
            <div className="font-mono text-4xl tracking-[0.4em] tabular-nums">
              {issued?.code}
            </div>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              Send this to {issued?.name} on WhatsApp. They&apos;ll go to{" "}
              <span className="font-medium">/auth/recover</span> and pick &quot;I have a
              code&quot;. Expires in 30 minutes.
            </p>
            <Button onClick={copy} variant="default" className="w-full">
              <Copy className="size-4 mr-2" />
              Copy code
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
