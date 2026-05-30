"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  TILE_BORDERS,
  TILE_FONTS,
  TILE_GRADIENT_PRESETS,
  type TileBorder,
  type TileFont,
  type TileGradient,
} from "@/lib/auth/tile-style";
import { UserTile } from "@/components/user-tile";
import { EMOJI_CATEGORIES } from "@/lib/auth/emoji-grid";
import { checkNameAvailable, signupUser } from "@/app/actions/auth";
import { setCurrentUserId } from "@/lib/sync/db";
import { DoodleCanvas } from "./doodle-canvas";
import type { Stroke } from "@/lib/auth/recovery-stroke";

type Step = "name" | "style" | "lock" | "doodle";

export function SignupRitual() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("name");
  const [name, setName] = useState("");
  const [nameStatus, setNameStatus] = useState<"idle" | "checking" | "ok" | "taken" | "invalid">(
    "idle",
  );
  const [gradient, setGradient] = useState<TileGradient>(TILE_GRADIENT_PRESETS[0]);
  const [font, setFont] = useState<TileFont>("lora");
  const [border, setBorder] = useState<TileBorder>("rounded");
  const [passphrase, setPassphrase] = useState<string[]>([]);
  const [honeypot, setHoneypot] = useState<string | null>(null);
  const [doodle, setDoodle] = useState<Stroke[]>([]);
  const [tab, setTab] = useState(0);
  const [pending, startTransition] = useTransition();
  const [lockSubstep, setLockSubstep] = useState<"pass" | "honey">("pass");

  function handleNameChange(v: string) {
    const cleaned = v.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 6);
    setName(cleaned);
    if (!cleaned) {
      setNameStatus("idle");
      return;
    }
    setNameStatus("checking");
    const snapshot = cleaned;
    window.setTimeout(async () => {
      if (snapshot !== cleaned) return;
      const res = await checkNameAvailable(cleaned);
      if (snapshot !== cleaned) return;
      setNameStatus(res.available ? "ok" : "taken");
    }, 250);
  }

  function tapEmoji(e: string) {
    if (pending) return;
    if (lockSubstep === "pass") {
      if (passphrase.length >= 4) return;
      setPassphrase((p) => [...p, e]);
      return;
    }
    if (passphrase.includes(e)) {
      toast.error("Honeypot can't be in your passphrase.");
      return;
    }
    setHoneypot(e);
  }

  function eraseLast() {
    if (lockSubstep === "pass") setPassphrase((p) => p.slice(0, -1));
    else setHoneypot(null);
  }

  function submit() {
    if (pending) return;
    if (!name) {
      toast.error("Pick a name.");
      return;
    }
    if (passphrase.length !== 4) {
      toast.error("Pick 4 emojis.");
      return;
    }
    if (!honeypot) {
      toast.error("Pick a honeypot emoji.");
      return;
    }
    startTransition(async () => {
      const result = await signupUser({
        name,
        passphrase,
        honeypotEmoji: honeypot,
        tileGradientFrom: gradient.from,
        tileGradientTo: gradient.to,
        tileFont: font,
        tileBorder: border,
        recoveryStrokes: doodle.length > 0 ? doodle : undefined,
      });
      if (result.ok) {
        setCurrentUserId(result.userId);
        toast.success("Welcome.");
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
        <h1 className="font-serif text-3xl">Become part of this</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Pick a name, dress your tile, lock it with emojis.
        </p>
      </header>

      <div className="flex justify-center">
        <UserTile
          name={name || "you"}
          gradientFrom={gradient.from}
          gradientTo={gradient.to}
          font={font}
          border={border}
          size={80}
          glow={0.5}
          className={cn(
            nameStatus === "taken" && "animate-shake",
            nameStatus === "ok" && "ring-2 ring-status-great",
          )}
        />
      </div>

      {step === "name" ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor="name">Your name</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="6 chars max"
            maxLength={6}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
          <p className="text-xs text-muted-foreground">
            {nameStatus === "checking" && "Checking…"}
            {nameStatus === "ok" && "✨ Free to take."}
            {nameStatus === "taken" && "Already taken."}
            {nameStatus === "invalid" && "Letters / digits / underscore only."}
          </p>
          <Button
            type="button"
            onClick={() => setStep("style")}
            disabled={nameStatus !== "ok"}
            className="mt-2"
          >
            Style your tile <ArrowRight className="size-4 ml-1" />
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Have an account?{" "}
            <Link href="/auth/login" className="text-primary hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      ) : null}

      {step === "style" ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              Gradient
            </Label>
            <div className="grid grid-cols-6 gap-1.5">
              {TILE_GRADIENT_PRESETS.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setGradient(g)}
                  className={cn(
                    "aspect-square rounded-md border",
                    gradient.id === g.id
                      ? "border-foreground"
                      : "border-border",
                  )}
                  style={{
                    background: `linear-gradient(135deg, ${g.from}, ${g.to})`,
                  }}
                  aria-label={g.id}
                />
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              Font
            </Label>
            <div className="grid grid-cols-2 gap-1.5">
              {TILE_FONTS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFont(f.id)}
                  className={cn(
                    "py-2 rounded-md border text-sm",
                    font === f.id ? "border-foreground bg-accent" : "border-border",
                  )}
                  style={{ fontFamily: f.css }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              Border
            </Label>
            <div className="grid grid-cols-2 gap-1.5">
              {TILE_BORDERS.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setBorder(b.id)}
                  className={cn(
                    "py-2 rounded-md border text-sm",
                    border === b.id ? "border-foreground bg-accent" : "border-border",
                  )}
                >
                  {b.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex justify-between">
            <Button type="button" variant="ghost" onClick={() => setStep("name")}>
              <ArrowLeft className="size-4 mr-1" /> Back
            </Button>
            <Button type="button" onClick={() => setStep("lock")}>
              Lock it <ArrowRight className="size-4 ml-1" />
            </Button>
          </div>
        </div>
      ) : null}

      {step === "lock" ? (
        <div className="flex flex-col gap-3">
          <div className="flex gap-2 justify-center text-xs">
            <button
              type="button"
              onClick={() => setLockSubstep("pass")}
              className={cn(
                "px-3 py-1 rounded-full transition-colors",
                lockSubstep === "pass"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted",
              )}
            >
              1. Passphrase ({passphrase.length}/4)
            </button>
            <button
              type="button"
              onClick={() =>
                passphrase.length === 4 ? setLockSubstep("honey") : null
              }
              className={cn(
                "px-3 py-1 rounded-full transition-colors",
                lockSubstep === "honey"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted",
                passphrase.length !== 4 && "opacity-40",
              )}
            >
              2. Trap one
            </button>
          </div>

          <p className="text-xs text-muted-foreground text-center">
            {lockSubstep === "pass"
              ? "Tap 4 emojis in order. This is your passphrase."
              : "Pick a trap. If anyone taps this on login, it auto-fails."}
          </p>

          <div className="flex gap-2 justify-center">
            {lockSubstep === "pass"
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
              const isInPass = lockSubstep === "honey" && passphrase.includes(e);
              return (
                <button
                  key={`${category.id}-${i}-${e}`}
                  type="button"
                  onClick={() => tapEmoji(e)}
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

          <div className="flex justify-between">
            <Button type="button" variant="ghost" onClick={() => setStep("style")}>
              <ArrowLeft className="size-4 mr-1" /> Back
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={eraseLast} disabled={pending}>
                Erase
              </Button>
              <Button
                type="button"
                onClick={() => {
                  if (lockSubstep === "pass") {
                    if (passphrase.length !== 4) return;
                    setLockSubstep("honey");
                    return;
                  }
                  if (!honeypot) return;
                  setStep("doodle");
                }}
                disabled={
                  pending ||
                  (lockSubstep === "pass" ? passphrase.length !== 4 : !honeypot)
                }
              >
                Next <ArrowRight className="size-4 ml-1" />
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {step === "doodle" ? (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-muted-foreground text-center">
            Draw a shape only you remember. Use it later if you forget your
            passphrase. Anything — squiggle, initial, smiley.
          </p>
          <DoodleCanvas onChange={setDoodle} />
          <div className="flex justify-between">
            <Button type="button" variant="ghost" onClick={() => setStep("lock")}>
              <ArrowLeft className="size-4 mr-1" /> Back
            </Button>
            <Button
              type="button"
              onClick={submit}
              disabled={
                pending ||
                passphrase.length !== 4 ||
                !honeypot ||
                doodle.length === 0
              }
            >
              {pending ? "Creating…" : "Create"}
            </Button>
          </div>
        </div>
      ) : null}
    </Card>
  );
}
