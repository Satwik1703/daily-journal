"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DoodleCanvas } from "@/app/auth/signup/_components/doodle-canvas";
import { startDoodleRecovery } from "@/app/actions/auth";
import { toast } from "sonner";
import type { Stroke } from "@/lib/auth/recovery-stroke";

export function DoodleRecoverForm({ name }: { name: string }) {
  const router = useRouter();
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [pending, startTransition] = useTransition();

  function submit() {
    if (strokes.length === 0) {
      toast.error("Draw your shape first.");
      return;
    }
    startTransition(async () => {
      const result = await startDoodleRecovery({ name, strokes });
      if (result.ok) {
        router.push("/auth/reset-passphrase");
        router.refresh();
        return;
      }
      toast.error(result.error);
    });
  }

  return (
    <Card className="w-full max-w-md p-6 flex flex-col gap-5">
      <header className="text-center">
        <h1 className="font-serif text-3xl">Redraw your shape</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {name}, draw the doodle you saved at signup. Close enough counts.
        </p>
      </header>
      <DoodleCanvas onChange={setStrokes} />
      <Button onClick={submit} disabled={pending || strokes.length === 0}>
        {pending ? "Checking…" : "Unlock"}
      </Button>
      <div className="flex justify-between">
        <Link
          href={`/auth/recover?name=${encodeURIComponent(name)}`}
          className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center"
        >
          <ArrowLeft className="size-3 mr-1" /> Back
        </Link>
        <Link
          href={`/auth/recover/code?name=${encodeURIComponent(name)}`}
          className="text-xs text-primary hover:underline"
        >
          Use a code instead →
        </Link>
      </div>
    </Card>
  );
}
