"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  listMySessions,
  renameSession,
  destroySessionById,
} from "@/app/actions/auth";
import { toast } from "sonner";

type Row = {
  id: string;
  deviceNickname: string | null;
  createdAt: number;
  lastSeenAt: number;
  expiresAt: number;
  isCurrent: boolean;
};

function fmt(ms: number): string {
  // eslint-disable-next-line react-hooks/purity
  const diff = Date.now() - ms;
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function daysUntil(ms: number): number {
  // eslint-disable-next-line react-hooks/purity
  return Math.max(0, Math.floor((ms - Date.now()) / 86_400_000));
}

export function DevicesCard() {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [pending, startTransition] = useTransition();

  async function reload() {
    const r = await listMySessions();
    setRows(r);
  }
  useEffect(() => {
    void reload();
  }, []);

  function startRename(r: Row) {
    setEditing(r.id);
    setDraft(r.deviceNickname ?? "");
  }
  function saveRename() {
    if (!editing) return;
    const id = editing;
    const nick = draft;
    setEditing(null);
    startTransition(async () => {
      await renameSession({ sessionId: id, nickname: nick });
      await reload();
    });
  }
  function remove(r: Row) {
    startTransition(async () => {
      await destroySessionById(r.id);
      if (r.isCurrent) {
        router.push("/auth/login");
        router.refresh();
        return;
      }
      await reload();
      toast.success("Device signed out.");
    });
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="font-serif text-lg font-normal">Your devices</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No active sessions.</p>
        ) : (
          rows.map((r) => (
            <div
              key={r.id}
              className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2"
            >
              <div className="flex-1 min-w-0">
                {editing === r.id ? (
                  <Input
                    autoFocus
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onBlur={saveRename}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveRename();
                      if (e.key === "Escape") setEditing(null);
                    }}
                    placeholder="Device name"
                    className="h-7"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => startRename(r)}
                    className="text-sm font-medium text-left truncate w-full"
                  >
                    {r.deviceNickname || "Unnamed device"}
                    {r.isCurrent ? (
                      <span className="ml-1 text-[10px] uppercase text-primary">
                        · this device
                      </span>
                    ) : null}
                  </button>
                )}
                <div className="text-[11px] text-muted-foreground">
                  active {fmt(r.lastSeenAt)} · expires in {daysUntil(r.expiresAt)}d
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => remove(r)}
                disabled={pending}
                aria-label="Sign out device"
              >
                <Trash2 className="size-4 text-destructive" />
              </Button>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
