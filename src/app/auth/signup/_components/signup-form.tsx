"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { PART_A_EMOJI_GRID } from "@/lib/auth/emoji-grid";
import { signupUser } from "@/app/actions/auth";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { setCurrentUserId } from "@/lib/sync/db";

type Stage = "pass" | "honey";

export function SignupForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [passphrase, setPassphrase] = useState<string[]>([]);
  const [honeypotEmoji, setHoneypotEmoji] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>("pass");
  const [pending, startTransition] = useTransition();

  function tapEmoji(e: string) {
    if (pending) return;
    if (stage === "pass") {
      if (passphrase.length >= 4) return;
      setPassphrase((p) => [...p, e]);
    } else {
      if (passphrase.includes(e)) {
        toast.error("Honeypot can't be in your passphrase.");
        return;
      }
      setHoneypotEmoji(e);
    }
  }

  function backspace() {
    if (pending) return;
    if (stage === "pass") setPassphrase((p) => p.slice(0, -1));
    else setHoneypotEmoji(null);
  }

  function nextStage() {
    if (passphrase.length !== 4) {
      toast.error("Pick 4 emojis for your passphrase.");
      return;
    }
    setStage("honey");
  }

  function submit() {
    if (pending) return;
    if (!name.trim()) {
      toast.error("Pick a name.");
      return;
    }
    if (passphrase.length !== 4) {
      toast.error("Pick 4 emojis.");
      return;
    }
    if (!honeypotEmoji) {
      toast.error("Pick a honeypot emoji.");
      return;
    }
    startTransition(async () => {
      const result = await signupUser({
        name: name.trim(),
        passphrase,
        honeypotEmoji,
      });
      if (result.ok) {
        setCurrentUserId(result.userId);
        toast.success("Welcome aboard.");
        router.push("/journal");
        router.refresh();
        return;
      }
      toast.error(result.error);
    });
  }

  const heading = stage === "pass" ? "Pick 4 emojis (in order)" : "Trap one emoji";
  const subheading =
    stage === "pass"
      ? "This is your passphrase. Remember the order."
      : "If anyone taps this on a login attempt, it'll fail. Pick something obvious you'd never use.";

  return (
    <Card className="w-full max-w-md p-6 flex flex-col gap-5">
      <header className="text-center">
        <h1 className="font-serif text-3xl">Make an account</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Pick a name + 4-emoji passphrase + 1 honeypot.
        </p>
      </header>

      <div className="flex flex-col gap-2">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) =>
            setName(e.target.value.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 6))
          }
          maxLength={6}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder="letters/digits/_ — 6 max"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label>{heading}</Label>
        <p className="text-xs text-muted-foreground">{subheading}</p>

        <div className="flex gap-2 justify-center mt-1">
          {stage === "pass"
            ? Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="size-14 rounded-lg border border-border bg-muted/40 grid place-items-center text-2xl"
                >
                  {passphrase[i] ?? ""}
                </div>
              ))
            : (
              <div className="size-14 rounded-lg border border-destructive/60 bg-destructive/10 grid place-items-center text-2xl">
                {honeypotEmoji ?? "?"}
              </div>
            )}
        </div>

        <div className="grid grid-cols-6 gap-2 mt-2">
          {PART_A_EMOJI_GRID.map((e) => {
            const usedInPass = stage === "honey" && passphrase.includes(e);
            return (
              <button
                key={e}
                type="button"
                onClick={() => tapEmoji(e)}
                disabled={pending || usedInPass}
                className={cn(
                  "aspect-square rounded-md border border-border bg-card text-2xl hover:bg-accent transition-colors active:scale-95",
                  usedInPass && "opacity-30 pointer-events-none",
                )}
              >
                {e}
              </button>
            );
          })}
        </div>

        <div className="flex gap-2 justify-between mt-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={backspace}
            disabled={
              pending ||
              (stage === "pass" ? passphrase.length === 0 : honeypotEmoji == null)
            }
          >
            Backspace
          </Button>
          {stage === "pass" ? (
            <Button
              type="button"
              size="sm"
              onClick={nextStage}
              disabled={passphrase.length !== 4 || pending}
            >
              Next →
            </Button>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setStage("pass")}
              disabled={pending}
            >
              ← Back
            </Button>
          )}
        </div>
      </div>

      <Button
        onClick={submit}
        disabled={pending || stage === "pass" || !honeypotEmoji}
        className="w-full"
      >
        {pending ? "Creating…" : "Create account"}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Have an account?{" "}
        <Link href="/auth/login" className="text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </Card>
  );
}
