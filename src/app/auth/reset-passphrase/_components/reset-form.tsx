"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import confetti from "canvas-confetti";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { EMOJI_CATEGORIES } from "@/lib/auth/emoji-grid";
import { resetPassphraseAndComplete } from "@/app/actions/auth";
import { setCurrentUserId } from "@/lib/sync/db";

export function ResetPassphraseForm({ name }: { name: string }) {
  const router = useRouter();
  const [passphrase, setPassphrase] = useState<string[]>([]);
  const [honeypot, setHoneypot] = useState<string | null>(null);
  const [stage, setStage] = useState<"pass" | "honey">("pass");
  const [tab, setTab] = useState(0);
  const [pending, startTransition] = useTransition();

  function tap(e: string) {
    if (pending) return;
    if (stage === "pass") {
      if (passphrase.length >= 4) return;
      setPassphrase((p) => [...p, e]);
    } else {
      if (passphrase.includes(e)) {
        toast.error("Honeypot can't be in your passphrase.");
        return;
      }
      setHoneypot(e);
    }
  }
  function backspace() {
    if (stage === "pass") setPassphrase((p) => p.slice(0, -1));
    else setHoneypot(null);
  }

  function submit() {
    if (passphrase.length !== 4 || !honeypot) {
      toast.error("Pick 4 passphrase emojis + 1 honeypot.");
      return;
    }
    startTransition(async () => {
      const result = await resetPassphraseAndComplete({
        passphrase,
        honeypotEmoji: honeypot,
      });
      if (result.ok) {
        setCurrentUserId(result.userId);
        confetti({
          particleCount: 80,
          spread: 60,
          startVelocity: 38,
          origin: { y: 0.5 },
          ticks: 80,
        });
        await new Promise((r) => window.setTimeout(r, 400));
        router.push("/journal");
        router.refresh();
        return;
      }
      toast.error(result.error);
    });
  }

  const category = EMOJI_CATEGORIES[tab];

  return (
    <Card className="w-full max-w-md p-6 flex flex-col gap-5">
      <header className="text-center">
        <h1 className="font-serif text-3xl">New passphrase, {name}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Pick 4 emojis + 1 honeypot. Old combo retires.
        </p>
      </header>

      <div className="flex gap-2 justify-center text-xs">
        <button
          type="button"
          onClick={() => setStage("pass")}
          className={cn(
            "px-3 py-1 rounded-full transition-colors",
            stage === "pass" ? "bg-primary text-primary-foreground" : "bg-muted",
          )}
        >
          1. Passphrase ({passphrase.length}/4)
        </button>
        <button
          type="button"
          onClick={() => (passphrase.length === 4 ? setStage("honey") : null)}
          className={cn(
            "px-3 py-1 rounded-full transition-colors",
            stage === "honey" ? "bg-primary text-primary-foreground" : "bg-muted",
            passphrase.length !== 4 && "opacity-40",
          )}
        >
          2. Trap one
        </button>
      </div>

      <Label className="text-xs uppercase tracking-wider text-muted-foreground text-center">
        {stage === "pass" ? "Tap 4 emojis in order" : "Pick a trap emoji"}
      </Label>

      <div className="flex gap-2 justify-center">
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
              {honeypot ?? "?"}
            </div>
          )}
      </div>

      <div className="flex gap-1.5 justify-center">
        {EMOJI_CATEGORIES.map((c, i) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setTab(i)}
            className={cn(
              "px-2.5 py-0.5 rounded-full text-xs transition-colors",
              i === tab
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80",
            )}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-6 gap-1.5">
        {category.emojis.map((e, i) => {
          const isInPass = stage === "honey" && passphrase.includes(e);
          return (
            <button
              key={`${category.id}-${i}-${e}`}
              type="button"
              onClick={() => tap(e)}
              disabled={pending || isInPass}
              className={cn(
                "aspect-square rounded-md border border-border bg-card text-2xl hover:bg-accent transition-colors active:scale-95",
                isInPass && "opacity-30 pointer-events-none",
              )}
            >
              {e}
            </button>
          );
        })}
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={backspace} disabled={pending}>
          Erase
        </Button>
        <Button
          type="button"
          onClick={submit}
          disabled={pending || passphrase.length !== 4 || !honeypot}
        >
          {pending ? "Saving…" : "Sign in"}
        </Button>
      </div>
    </Card>
  );
}
