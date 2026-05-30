"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { redeemRecoveryCode } from "@/app/actions/auth";
import { toast } from "sonner";

export function CodeRecoverForm({ name }: { name: string }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [pending, startTransition] = useTransition();

  function submit() {
    if (!/^\d{6}$/.test(code)) {
      toast.error("Code is 6 digits.");
      return;
    }
    startTransition(async () => {
      const result = await redeemRecoveryCode({ name, code });
      if (result.ok) {
        router.push("/auth/reset-passphrase");
        router.refresh();
        return;
      }
      toast.error(result.error);
      setCode("");
    });
  }

  return (
    <Card className="w-full max-w-md p-6 flex flex-col gap-5">
      <header className="text-center">
        <h1 className="font-serif text-3xl">Enter your code</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Hey {name} — type the 6-digit code the owner sent you.
        </p>
      </header>

      <div className="flex flex-col gap-2">
        <Label htmlFor="code">Code</Label>
        <Input
          id="code"
          inputMode="numeric"
          pattern="\d{6}"
          maxLength={6}
          autoFocus
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          placeholder="000000"
          className="text-center text-2xl tracking-[0.4em]"
        />
      </div>

      <Button onClick={submit} disabled={pending || code.length !== 6}>
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
          href={`/auth/recover/doodle?name=${encodeURIComponent(name)}`}
          className="text-xs text-primary hover:underline"
        >
          Use doodle instead →
        </Link>
      </div>
    </Card>
  );
}
