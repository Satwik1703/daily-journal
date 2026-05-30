"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { logoutUser } from "@/app/actions/auth";
import { setCurrentUserId } from "@/lib/sync/db";

export function SignOutButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="outline"
      onClick={() =>
        startTransition(async () => {
          await logoutUser();
          setCurrentUserId(null);
          router.push("/auth/login");
          router.refresh();
        })
      }
      disabled={pending}
      className="w-full"
    >
      <LogOut className="size-4 mr-2" />
      {pending ? "Signing out…" : "Sign out"}
    </Button>
  );
}
