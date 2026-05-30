"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Brush, KeyRound, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { userHasDoodle } from "@/app/actions/auth";
import { toast } from "sonner";

type Stage = "ask-name" | "pick-path";

export function RecoverLanding({ initialName }: { initialName: string }) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [stage, setStage] = useState<Stage>(initialName ? "pick-path" : "ask-name");
  const [hasDoodle, setHasDoodle] = useState<boolean | null>(null);
  const [pending, startTransition] = useTransition();

  function lookup() {
    const cleaned = name.trim();
    if (!cleaned) {
      toast.error("Enter your name.");
      return;
    }
    startTransition(async () => {
      const res = await userHasDoodle(cleaned);
      if (!res.exists) {
        toast.error("No user found.");
        return;
      }
      setHasDoodle(res.hasDoodle);
      setStage("pick-path");
    });
  }

  return (
    <Card className="w-full max-w-md p-6 flex flex-col gap-5">
      <header className="text-center">
        <h1 className="font-serif text-3xl">Forgot your combo?</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Two ways back in. Pick what works.
        </p>
      </header>

      {stage === "ask-name" ? (
        <div className="flex flex-col gap-3">
          <Label htmlFor="name">What name are you?</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) =>
              setName(e.target.value.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 6))
            }
            placeholder="your name"
            maxLength={6}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
          <Button onClick={lookup} disabled={pending || !name.trim()} className="w-full">
            {pending ? "Finding…" : "Continue"} <ArrowRight className="size-4 ml-1" />
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Remembered it?{" "}
            <Link href="/auth/login" className="text-primary hover:underline">
              Back to sign in
            </Link>
          </p>
        </div>
      ) : null}

      {stage === "pick-path" ? (
        <div className="flex flex-col gap-3">
          <p className="text-center text-sm">
            Hey <span className="font-medium">{name}</span> — pick a path.
          </p>

          <button
            type="button"
            onClick={() =>
              hasDoodle && router.push(`/auth/recover/doodle?name=${encodeURIComponent(name)}`)
            }
            disabled={!hasDoodle}
            className={cn(
              "rounded-xl border border-border bg-card text-left p-4 flex items-start gap-3 transition-colors",
              hasDoodle ? "hover:bg-accent active:scale-[0.99]" : "opacity-50 cursor-not-allowed",
            )}
          >
            <Brush className="size-5 mt-0.5 text-primary" />
            <div>
              <div className="font-medium">Redraw your shape</div>
              <div className="text-xs text-muted-foreground">
                {hasDoodle
                  ? "Reproduce the doodle you drew at signup."
                  : "No doodle on file. Ask the owner for a code instead."}
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => router.push(`/auth/recover/code?name=${encodeURIComponent(name)}`)}
            className="rounded-xl border border-border bg-card text-left p-4 flex items-start gap-3 transition-colors hover:bg-accent active:scale-[0.99]"
          >
            <KeyRound className="size-5 mt-0.5 text-primary" />
            <div>
              <div className="font-medium">I have a code from the owner</div>
              <div className="text-xs text-muted-foreground">
                6-digit code sent to you on WhatsApp. Expires in 30 min.
              </div>
            </div>
          </button>

          <div className="flex justify-between pt-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setStage("ask-name");
                setHasDoodle(null);
              }}
            >
              ← Different name
            </Button>
            <Link
              href="/auth/login"
              className="text-xs text-muted-foreground hover:text-foreground self-center"
            >
              Back to sign in
            </Link>
          </div>
        </div>
      ) : null}
    </Card>
  );
}
