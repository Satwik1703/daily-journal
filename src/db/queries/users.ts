import { and, count, desc, eq, gt, inArray, isNull, or } from "drizzle-orm";
import { db } from "@/db/client";
import { loginAttempts, recoveryCodes, sessions, users } from "@/db/schema";

export type AttemptKind = "login" | "recovery_doodle" | "recovery_code";

export type UserRow = typeof users.$inferSelect;

export async function findUserByName(name: string): Promise<UserRow | null> {
  const lower = name.trim().toLowerCase();
  if (!lower) return null;
  const [row] = await db
    .select()
    .from(users)
    .where(eq(users.nameLower, lower))
    .limit(1);
  return row ?? null;
}

export async function findUserById(id: string): Promise<UserRow | null> {
  const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return row ?? null;
}

export type LoginScreenUser = {
  id: string;
  name: string;
  tileGradientFrom: string;
  tileGradientTo: string;
  tileFont: UserRow["tileFont"];
  tileBorder: UserRow["tileBorder"];
  lastSeenAt: Date | null;
};

export async function listAllUsersForLoginScreen(): Promise<LoginScreenUser[]> {
  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      tileGradientFrom: users.tileGradientFrom,
      tileGradientTo: users.tileGradientTo,
      tileFont: users.tileFont,
      tileBorder: users.tileBorder,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(desc(users.createdAt));

  if (rows.length === 0) return [];

  const sessionMax = await db
    .select({
      userId: sessions.userId,
      lastSeenAt: sessions.lastSeenAt,
    })
    .from(sessions);

  const maxByUser = new Map<string, Date>();
  for (const s of sessionMax) {
    const prev = maxByUser.get(s.userId);
    if (!prev || prev.getTime() < s.lastSeenAt.getTime()) {
      maxByUser.set(s.userId, s.lastSeenAt);
    }
  }

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    tileGradientFrom: r.tileGradientFrom,
    tileGradientTo: r.tileGradientTo,
    tileFont: r.tileFont,
    tileBorder: r.tileBorder,
    lastSeenAt: maxByUser.get(r.id) ?? null,
  }));
}

export async function recordAttempt(
  userId: string,
  kind: AttemptKind,
  succeeded: boolean,
): Promise<void> {
  await db.insert(loginAttempts).values({
    id: `la_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    userId,
    kind,
    succeeded,
  });
}

export async function recordLoginAttempt(
  userId: string,
  succeeded: boolean,
): Promise<void> {
  await recordAttempt(userId, "login", succeeded);
}

export async function recentFailedLoginCount(
  userId: string,
  withinMs: number,
): Promise<number> {
  return recentFailedCount(userId, ["login"], withinMs);
}

export async function recentFailedCount(
  userId: string,
  kinds: AttemptKind[],
  withinMs: number,
): Promise<number> {
  if (kinds.length === 0) return 0;
  const since = new Date(Date.now() - withinMs);
  const [row] = await db
    .select({ c: count() })
    .from(loginAttempts)
    .where(
      and(
        eq(loginAttempts.userId, userId),
        eq(loginAttempts.succeeded, false),
        gt(loginAttempts.attemptedAt, since),
        inArray(loginAttempts.kind, kinds),
      ),
    );
  return row?.c ?? 0;
}

export async function listNonOwnerUsers(): Promise<UserRow[]> {
  return db
    .select()
    .from(users)
    .where(eq(users.isOwner, false))
    .orderBy(desc(users.createdAt));
}

export async function findLatestUnusedRecoveryCode(
  targetUserId: string,
): Promise<typeof recoveryCodes.$inferSelect | null> {
  const now = new Date();
  const [row] = await db
    .select()
    .from(recoveryCodes)
    .where(
      and(
        eq(recoveryCodes.targetUserId, targetUserId),
        isNull(recoveryCodes.usedAt),
        gt(recoveryCodes.expiresAt, now),
      ),
    )
    .orderBy(desc(recoveryCodes.createdAt))
    .limit(1);
  return row ?? null;
}

void or;
