"use client";

import { customAlphabet } from "nanoid";
import { openSyncDB, type PendingMutation } from "./db";

const localId = customAlphabet(
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",
  12,
);

export async function enqueue(kind: string, args: unknown): Promise<string> {
  const db = await openSyncDB();
  const id = localId();
  const row: PendingMutation = {
    id,
    kind,
    args,
    createdAt: Date.now(),
    attempts: 0,
    status: "pending",
  };
  await db.put("pending_mutations", row);
  return id;
}

export async function markInFlight(id: string): Promise<void> {
  const db = await openSyncDB();
  const row = await db.get("pending_mutations", id);
  if (!row) return;
  row.status = "in_flight";
  row.attempts += 1;
  await db.put("pending_mutations", row);
}

export async function markDone(id: string): Promise<void> {
  const db = await openSyncDB();
  await db.delete("pending_mutations", id);
}

export async function markFailed(id: string, error: string): Promise<void> {
  const db = await openSyncDB();
  const row = await db.get("pending_mutations", id);
  if (!row) return;
  row.status = "failed";
  row.lastError = error;
  await db.put("pending_mutations", row);
}

export async function listPending(): Promise<PendingMutation[]> {
  const db = await openSyncDB();
  const rows = await db.getAllFromIndex("pending_mutations", "createdAt");
  return rows;
}

export async function clearAll(): Promise<void> {
  const db = await openSyncDB();
  await db.clear("pending_mutations");
}

export async function discardMutation(id: string): Promise<void> {
  const db = await openSyncDB();
  await db.delete("pending_mutations", id);
}
