"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  dismissDeviceNickname,
  getDeviceNicknameStatus,
  setDeviceNickname,
} from "@/app/actions/auth";

function guessNickname(): string {
  if (typeof navigator === "undefined") return "";
  const ua = navigator.userAgent;
  if (/iPhone/i.test(ua)) return "iPhone";
  if (/iPad/i.test(ua)) return "iPad";
  if (/Android/i.test(ua)) {
    if (/Tablet/i.test(ua)) return "Android tablet";
    return "Android phone";
  }
  if (/Macintosh|Mac OS X/i.test(ua)) {
    if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) return "Safari on Mac";
    if (/Chrome/i.test(ua)) return "Chrome on Mac";
    if (/Firefox/i.test(ua)) return "Firefox on Mac";
    return "Mac";
  }
  if (/Windows/i.test(ua)) {
    if (/Edg\//i.test(ua)) return "Edge on Windows";
    if (/Chrome/i.test(ua)) return "Chrome on Windows";
    if (/Firefox/i.test(ua)) return "Firefox on Windows";
    return "Windows PC";
  }
  if (/Linux/i.test(ua)) return "Linux";
  return "This device";
}

export function DeviceNicknameDialog() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [nick, setNick] = useState("");
  const [pending, startTransition] = useTransition();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (checked) return;
    if (pathname.startsWith("/auth")) return;
    let cancelled = false;
    void (async () => {
      try {
        const r = await getDeviceNicknameStatus();
        if (cancelled) return;
        if (r.needs) {
          setNick(guessNickname());
          setOpen(true);
        }
        setChecked(true);
      } catch {
        setChecked(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pathname, checked]);

  function save() {
    if (pending) return;
    const value = nick.trim();
    if (!value) {
      skip();
      return;
    }
    startTransition(async () => {
      await setDeviceNickname(value);
      setOpen(false);
    });
  }

  function skip() {
    if (pending) return;
    startTransition(async () => {
      await dismissDeviceNickname();
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && skip()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Name this device?</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3 py-2">
          <p className="text-sm text-muted-foreground">
            Helps you spot it later in Settings → Your devices when signing out
            from one place.
          </p>
          <Input
            autoFocus
            value={nick}
            onChange={(e) => setNick(e.target.value.slice(0, 40))}
            placeholder="iPhone, Work laptop, Tablet, …"
            onKeyDown={(e) => {
              if (e.key === "Enter") save();
            }}
          />
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={skip} disabled={pending}>
              Skip
            </Button>
            <Button onClick={save} disabled={pending || nick.trim().length === 0}>
              {pending ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
