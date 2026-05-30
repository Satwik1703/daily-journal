import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { createHmac, timingSafeEqual } from "node:crypto";
import { db } from "@/db/client";
import { sessions, users } from "@/db/schema";
import {
  RECOVERY_COOKIE,
  RECOVERY_TTL_MS,
  SESSION_COOKIE,
  SESSION_TTL_MS,
  SLIDING_REFRESH_AFTER_MS,
} from "./cookie";

export { SESSION_COOKIE, SESSION_TTL_MS, RECOVERY_COOKIE, RECOVERY_TTL_MS };

export type SessionRow = typeof sessions.$inferSelect;
export type UserRow = typeof users.$inferSelect;

function cookieOpts(maxAgeSec: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeSec,
  };
}

export async function createSession(userId: string): Promise<SessionRow> {
  const id = nanoid(24);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);

  const [row] = await db
    .insert(sessions)
    .values({
      id,
      userId,
      createdAt: now,
      lastSeenAt: now,
      expiresAt,
    })
    .returning();

  const jar = await cookies();
  jar.set(SESSION_COOKIE, id, cookieOpts(Math.floor(SESSION_TTL_MS / 1000)));

  return row;
}

export async function readSessionAndUser(): Promise<
  { session: SessionRow; user: UserRow } | null
> {
  const jar = await cookies();
  const sid = jar.get(SESSION_COOKIE)?.value;
  if (!sid) return null;

  const [row] = await db
    .select({
      session: sessions,
      user: users,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(eq(sessions.id, sid))
    .limit(1);

  if (!row) return null;
  if (row.session.expiresAt.getTime() < Date.now()) {
    await db.delete(sessions).where(eq(sessions.id, sid));
    return null;
  }
  return row;
}

export async function refreshSessionIfStale(session: SessionRow): Promise<void> {
  const now = Date.now();
  const lastSeen = session.lastSeenAt.getTime();
  if (now - lastSeen < SLIDING_REFRESH_AFTER_MS) return;

  const newLastSeen = new Date(now);
  const newExpiresAt = new Date(now + SESSION_TTL_MS);

  await db
    .update(sessions)
    .set({ lastSeenAt: newLastSeen, expiresAt: newExpiresAt })
    .where(eq(sessions.id, session.id));

  const jar = await cookies();
  jar.set(SESSION_COOKIE, session.id, cookieOpts(Math.floor(SESSION_TTL_MS / 1000)));
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const sid = jar.get(SESSION_COOKIE)?.value;
  if (sid) {
    await db.delete(sessions).where(eq(sessions.id, sid));
  }
  jar.delete(SESSION_COOKIE);
}

// ---------- Recovery (short-lived, signed) ----------

function recoverySecret(): string {
  return (
    process.env.RECOVERY_SECRET ??
    process.env.SESSION_SECRET ??
    "habit-log-recovery-dev-only-fallback"
  );
}

function signRecoveryPayload(userId: string, issuedAt: number): string {
  const body = `${userId}.${issuedAt}`;
  const sig = createHmac("sha256", recoverySecret()).update(body).digest("hex");
  return `${userId}.${issuedAt}.${sig}`;
}

function verifyRecoveryToken(token: string): { userId: string; issuedAt: number } | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [userId, issuedAtStr, sig] = parts;
  const issuedAt = Number(issuedAtStr);
  if (!Number.isFinite(issuedAt)) return null;
  const expected = createHmac("sha256", recoverySecret())
    .update(`${userId}.${issuedAt}`)
    .digest("hex");
  if (sig.length !== expected.length) return null;
  const a = Buffer.from(sig, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length || a.length === 0) return null;
  if (!timingSafeEqual(a, b)) return null;
  if (Date.now() - issuedAt > RECOVERY_TTL_MS) return null;
  return { userId, issuedAt };
}

export async function createRecoverySession(userId: string): Promise<void> {
  const issuedAt = Date.now();
  const token = signRecoveryPayload(userId, issuedAt);
  const jar = await cookies();
  jar.set(RECOVERY_COOKIE, token, cookieOpts(Math.floor(RECOVERY_TTL_MS / 1000)));
}

export async function readRecoverySession(): Promise<{ userId: string } | null> {
  const jar = await cookies();
  const token = jar.get(RECOVERY_COOKIE)?.value;
  if (!token) return null;
  const v = verifyRecoveryToken(token);
  if (!v) return null;
  return { userId: v.userId };
}

export async function destroyRecoverySession(): Promise<void> {
  const jar = await cookies();
  jar.delete(RECOVERY_COOKIE);
}
