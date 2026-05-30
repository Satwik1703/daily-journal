"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import confetti from "canvas-confetti";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { EMOJI_CATEGORIES } from "@/lib/auth/emoji-grid";
import { loginUser } from "@/app/actions/auth";
import { setCurrentUserId } from "@/lib/sync/db";

type Props = {
  name: string;
  next?: string;
  onCancel: () => void;
};

const REQUIRED = 4;

export function EmojiPassphraseGrid({ name, next, onCancel }: Props) {
  const router = useRouter();
  const [picked, setPicked] = useState<string[]>([]);
  const [tab, setTab] = useState(0);
  const [shake, setShake] = useState(false);
  const [hintEmoji, setHintEmoji] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const submittingRef = useRef(false);

  const category = EMOJI_CATEGORIES[tab];

  useEffect(() => {
    if (picked.length !== REQUIRED) return;
    if (submittingRef.current) return;
    submittingRef.current = true;
    startTransition(async () => {
      const result = await loginUser({ name, passphrase: picked });
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
        router.push(next && next.startsWith("/") ? next : "/journal");
        router.refresh();
      } else {
        if (result.hintEmoji) setHintEmoji(result.hintEmoji);
        setShake(true);
        window.setTimeout(() => {
          setShake(false);
          setPicked([]);
          submittingRef.current = false;
        }, 450);
        toast.error(result.error);
      }
    });
  }, [picked, name, next, router]);

  function tap(emoji: string) {
    if (pending || submittingRef.current) return;
    setPicked((p) => (p.length >= REQUIRED ? p : [...p, emoji]));
  }

  function backspace() {
    setPicked((p) => p.slice(0, -1));
  }

  return (
    <div className="w-full flex flex-col gap-4">
      <div className="flex gap-2 justify-center">
        {Array.from({ length: REQUIRED }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "size-14 rounded-lg border border-border bg-muted/40 grid place-items-center text-2xl transition-transform",
              shake && "animate-shake border-destructive",
              picked[i] && "scale-105",
            )}
          >
            {picked[i] ?? (i === 0 && hintEmoji ? (
              <span className="opacity-30">{hintEmoji}</span>
            ) : "")}
          </div>
        ))}
      </div>
      <div className="flex gap-1.5 justify-center">
        {EMOJI_CATEGORIES.map((c, i) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setTab(i)}
            className={cn(
              "px-3 py-1 rounded-full text-xs transition-colors",
              i === tab
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80",
            )}
          >
            {c.label}
          </button>
        ))}
      </div>
      <div
        className={cn(
          "grid grid-cols-6 gap-1.5",
          shake && "animate-shake",
        )}
      >
        {category.emojis.map((e, i) => (
          <button
            key={`${category.id}-${i}-${e}`}
            type="button"
            onClick={() => tap(e)}
            disabled={pending}
            className="aspect-square rounded-md border border-border bg-card text-2xl hover:bg-accent transition-colors active:scale-95"
          >
            {e}
          </button>
        ))}
      </div>
      <div className="flex justify-between items-center">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onCancel}
          disabled={pending}
        >
          ← Back
        </Button>
        <Link
          href={`/auth/recover?name=${encodeURIComponent(name)}`}
          className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
        >
          Forgot?
        </Link>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={backspace}
          disabled={pending || picked.length === 0}
        >
          Erase
        </Button>
      </div>
    </div>
  );
}
