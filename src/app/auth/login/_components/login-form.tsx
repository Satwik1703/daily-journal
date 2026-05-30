"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { PART_A_EMOJI_GRID } from "@/lib/auth/emoji-grid";
import { loginUser } from "@/app/actions/auth";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { setCurrentUserId } from "@/lib/sync/db";

export function LoginForm({ next }: { next?: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [passphrase, setPassphrase] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();
  const [shake, setShake] = useState(false);

  function tapEmoji(e: string) {
    if (pending) return;
    if (passphrase.length >= 4) return;
    setPassphrase((p) => [...p, e]);
  }

  function backspace() {
    if (pending) return;
    setPassphrase((p) => p.slice(0, -1));
  }

  function submit() {
    if (pending) return;
    if (!name.trim()) {
      toast.error("Enter your name.");
      return;
    }
    if (passphrase.length !== 4) {
      toast.error("Pick 4 emojis.");
      return;
    }
    startTransition(async () => {
      const result = await loginUser({ name: name.trim(), passphrase });
      if (result.ok) {
        setCurrentUserId(result.userId);
        router.push(next && next.startsWith("/") ? next : "/journal");
        router.refresh();
        return;
      }
      setShake(true);
      setPassphrase([]);
      window.setTimeout(() => setShake(false), 450);
      toast.error(result.error);
    });
  }

  return (
    <Card className="w-full max-w-md p-6 flex flex-col gap-5">
      <header className="text-center">
        <h1 className="font-serif text-3xl">Welcome back</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Type your name, tap your 4-emoji passphrase.
        </p>
      </header>

      <div className="flex flex-col gap-2">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={6}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder="6 chars max"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label>Passphrase</Label>
        <div className="flex gap-2 justify-center">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "size-14 rounded-lg border border-border bg-muted/40 grid place-items-center text-2xl",
                shake && "animate-shake border-destructive",
              )}
            >
              {passphrase[i] ?? ""}
            </div>
          ))}
        </div>
        <div
          className={cn(
            "grid grid-cols-6 gap-2 mt-2",
            shake && "animate-shake",
          )}
        >
          {PART_A_EMOJI_GRID.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => tapEmoji(e)}
              className="aspect-square rounded-md border border-border bg-card text-2xl hover:bg-accent transition-colors active:scale-95"
              disabled={pending}
            >
              {e}
            </button>
          ))}
        </div>
        <div className="flex gap-2 justify-end mt-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={backspace}
            disabled={pending || passphrase.length === 0}
          >
            Backspace
          </Button>
        </div>
      </div>

      <Button onClick={submit} disabled={pending} className="w-full">
        {pending ? "Checking…" : "Sign in"}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        New here?{" "}
        <Link href="/auth/signup" className="text-primary hover:underline">
          Create an account
        </Link>
      </p>
    </Card>
  );
}
