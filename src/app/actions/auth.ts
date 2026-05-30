"use server";

import { and, eq, isNull } from "drizzle-orm";
import { createHash } from "node:crypto";
import { nanoid } from "nanoid";
import { db } from "@/db/client";
import { recoveryCodes, sessions, users } from "@/db/schema";
import { AuthError } from "@/lib/auth/context";
import {
  createRecoverySession,
  createSession,
  destroyRecoverySession,
  destroySession,
  readRecoverySession,
  readSessionAndUser,
} from "@/lib/auth/session";
import {
  comparePassphrase,
  generateSalt,
  hashPassphrase,
  isValidPassphrase,
} from "@/lib/auth/passphrase";
import {
  findLatestUnusedRecoveryCode,
  findUserById,
  findUserByName,
  listNonOwnerUsers,
  recentFailedCount,
  recordAttempt,
  recordLoginAttempt,
} from "@/db/queries/users";
import { seedNewUser } from "@/lib/auth/seed-new-user";
import {
  isMatch as strokeMatches,
  serializeStrokes,
  type Stroke,
} from "@/lib/auth/recovery-stroke";

export type AuthResult =
  | { ok: true; userId: string }
  | { ok: false; error: string; hintEmoji?: string };

const FAIL_WINDOW_MS = 10 * 60 * 1000;
const HINT_AFTER_FAILS = 2;

async function failWithMaybeHint(
  userId: string,
  hint: string | null,
): Promise<AuthResult> {
  const { recentFailedLoginCount } = await import("@/db/queries/users");
  const fails = await recentFailedLoginCount(userId, FAIL_WINDOW_MS);
  if (fails >= HINT_AFTER_FAILS && hint) {
    return { ok: false, error: "Wrong combo. Hint: starts with…", hintEmoji: hint };
  }
  return { ok: false, error: "Wrong combo." };
}

function validateName(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const trimmed = input.trim();
  if (trimmed.length === 0 || trimmed.length > 6) return null;
  if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) return null;
  return trimmed;
}

type TileFont = "lora" | "fraunces" | "space_grotesk" | "ibm_plex_mono";
type TileBorder = "rounded" | "square" | "wax_seal" | "stamped";
const TILE_FONTS: TileFont[] = ["lora", "fraunces", "space_grotesk", "ibm_plex_mono"];
const TILE_BORDERS: TileBorder[] = ["rounded", "square", "wax_seal", "stamped"];
function isHex(v: unknown): v is string {
  return typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v);
}

export async function signupUser(input: {
  name: string;
  passphrase: string[];
  honeypotEmoji: string;
  tileGradientFrom?: string;
  tileGradientTo?: string;
  tileFont?: TileFont;
  tileBorder?: TileBorder;
  recoveryStrokes?: Stroke[];
}): Promise<AuthResult> {
  const name = validateName(input.name);
  if (!name) return { ok: false, error: "Name must be 1-6 letters/digits/underscore." };
  if (!isValidPassphrase(input.passphrase))
    return { ok: false, error: "Pick 4 emojis." };
  if (typeof input.honeypotEmoji !== "string" || input.honeypotEmoji.length === 0)
    return { ok: false, error: "Pick a honeypot emoji." };
  if (input.passphrase.includes(input.honeypotEmoji))
    return {
      ok: false,
      error: "Honeypot emoji can't be in your passphrase.",
    };
  if (!Array.isArray(input.recoveryStrokes) || input.recoveryStrokes.length === 0) {
    return { ok: false, error: "Draw a recovery shape — it's required." };
  }

  const existing = await findUserByName(name);
  if (existing) return { ok: false, error: "That name is taken." };

  const salt = generateSalt();
  const passhash = hashPassphrase(input.passphrase, salt);
  const id = `u_${nanoid(16)}`;

  const tileGradientFrom = isHex(input.tileGradientFrom) ? input.tileGradientFrom : undefined;
  const tileGradientTo = isHex(input.tileGradientTo) ? input.tileGradientTo : undefined;
  const tileFont = input.tileFont && TILE_FONTS.includes(input.tileFont) ? input.tileFont : undefined;
  const tileBorder =
    input.tileBorder && TILE_BORDERS.includes(input.tileBorder) ? input.tileBorder : undefined;

  const recoveryStrokesJson =
    Array.isArray(input.recoveryStrokes) && input.recoveryStrokes.length > 0
      ? serializeStrokes(input.recoveryStrokes)
      : undefined;

  await db.insert(users).values({
    id,
    name,
    nameLower: name.toLowerCase(),
    passhash,
    salt,
    passphrasePlain: input.passphrase.join(" "),
    honeypotEmoji: input.honeypotEmoji,
    passphraseHintEmoji: input.passphrase[0],
    ...(recoveryStrokesJson ? { recoveryStrokesJson } : {}),
    ...(tileGradientFrom ? { tileGradientFrom } : {}),
    ...(tileGradientTo ? { tileGradientTo } : {}),
    ...(tileFont ? { tileFont } : {}),
    ...(tileBorder ? { tileBorder } : {}),
  });
  await seedNewUser(id);

  await createSession(id);
  return { ok: true, userId: id };
}

export async function loginUser(input: {
  name: string;
  passphrase: string[];
}): Promise<AuthResult> {
  const name = validateName(input.name);
  if (!name) return { ok: false, error: "Wrong combo." };
  if (!isValidPassphrase(input.passphrase))
    return { ok: false, error: "Wrong combo." };

  const user = await findUserByName(name);
  if (!user) return { ok: false, error: "Wrong combo." };

  if (user.passhash == null || user.salt == null) {
    const salt = generateSalt();
    const passhash = hashPassphrase(input.passphrase, salt);
    await db
      .update(users)
      .set({
        passhash,
        salt,
        passphrasePlain: input.passphrase.join(" "),
        honeypotEmoji: input.passphrase[0],
        passphraseHintEmoji: input.passphrase[0],
      })
      .where(eq(users.id, user.id));
    await recordLoginAttempt(user.id, true);
    await createSession(user.id);
    return { ok: true, userId: user.id };
  }

  if (user.honeypotEmoji && input.passphrase.includes(user.honeypotEmoji)) {
    await recordLoginAttempt(user.id, false);
    return await failWithMaybeHint(user.id, user.passphraseHintEmoji);
  }

  const matches = comparePassphrase(input.passphrase, user.salt, user.passhash);
  if (!matches) {
    await recordLoginAttempt(user.id, false);
    return await failWithMaybeHint(user.id, user.passphraseHintEmoji);
  }

  await recordLoginAttempt(user.id, true);
  await createSession(user.id);
  return { ok: true, userId: user.id };
}

export async function logoutUser(): Promise<void> {
  await destroySession();
}

export async function listMySessions(): Promise<
  {
    id: string;
    deviceNickname: string | null;
    createdAt: number;
    lastSeenAt: number;
    expiresAt: number;
    isCurrent: boolean;
  }[]
> {
  const row = await readSessionAndUser();
  if (!row) return [];
  const all = await db
    .select()
    .from(sessions)
    .where(eq(sessions.userId, row.user.id));
  return all
    .map((s) => ({
      id: s.id,
      deviceNickname: s.deviceNickname,
      createdAt: s.createdAt.getTime(),
      lastSeenAt: s.lastSeenAt.getTime(),
      expiresAt: s.expiresAt.getTime(),
      isCurrent: s.id === row.session.id,
    }))
    .sort((a, b) => b.lastSeenAt - a.lastSeenAt);
}

export async function renameSession(input: {
  sessionId: string;
  nickname: string;
}): Promise<void> {
  const row = await readSessionAndUser();
  if (!row) throw new AuthError();
  const nick = input.nickname.trim().slice(0, 40);
  await db
    .update(sessions)
    .set({ deviceNickname: nick || null })
    .where(and(eq(sessions.id, input.sessionId), eq(sessions.userId, row.user.id)));
}

export async function destroySessionById(sessionId: string): Promise<void> {
  const row = await readSessionAndUser();
  if (!row) throw new AuthError();
  await db
    .delete(sessions)
    .where(and(eq(sessions.id, sessionId), eq(sessions.userId, row.user.id)));
}

export async function setDeviceNickname(nickname: string): Promise<void> {
  const row = await readSessionAndUser();
  if (!row) throw new AuthError();
  const nick = nickname.trim().slice(0, 40);
  await db
    .update(sessions)
    .set({ deviceNickname: nick || null })
    .where(eq(sessions.id, row.session.id));
}

export async function getDeviceNicknameStatus(): Promise<{ needs: boolean }> {
  const row = await readSessionAndUser();
  if (!row) return { needs: false };
  return { needs: row.session.deviceNickname == null };
}

export async function dismissDeviceNickname(): Promise<void> {
  const row = await readSessionAndUser();
  if (!row) throw new AuthError();
  await db
    .update(sessions)
    .set({ deviceNickname: "" })
    .where(eq(sessions.id, row.session.id));
}

export async function checkNameAvailable(name: string): Promise<{ available: boolean }> {
  const valid = validateName(name);
  if (!valid) return { available: false };
  const existing = await findUserByName(valid);
  return { available: existing == null };
}

export async function getCurrentSessionInfo(): Promise<{
  userId: string | null;
  name: string | null;
}> {
  const row = await readSessionAndUser();
  if (!row) return { userId: null, name: null };
  return { userId: row.user.id, name: row.user.name };
}

// ---------- Part F: recovery ----------

const RECOVERY_LOCKOUT_MS = 5 * 60 * 1000;
const RECOVERY_LOCKOUT_THRESHOLD = 5;
const GENERIC_FAIL = "Wrong combo.";

const OWNER_MASTER_CODE = "170300";

async function requireOwner() {
  const row = await readSessionAndUser();
  if (!row) throw new AuthError();
  if (!row.user.isOwner) throw new AuthError("Owner-only.");
  return row;
}

function hashCode(code: string, salt: string): string {
  return createHash("sha256").update(code + "|" + salt, "utf8").digest("hex");
}

async function isLockedOut(userId: string): Promise<boolean> {
  const fails = await recentFailedCount(
    userId,
    ["recovery_doodle", "recovery_code"],
    RECOVERY_LOCKOUT_MS,
  );
  return fails >= RECOVERY_LOCKOUT_THRESHOLD;
}

export async function startDoodleRecovery(input: {
  name: string;
  strokes: Stroke[];
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const name = validateName(input.name);
  if (!name) return { ok: false, error: GENERIC_FAIL };
  const user = await findUserByName(name);
  if (!user) return { ok: false, error: GENERIC_FAIL };
  if (await isLockedOut(user.id)) {
    return { ok: false, error: "Too many tries. Wait 5 minutes." };
  }
  if (!user.recoveryStrokesJson) {
    await recordAttempt(user.id, "recovery_doodle", false);
    return {
      ok: false,
      error: "No recovery doodle on file. Ask the owner for a code.",
    };
  }
  if (!Array.isArray(input.strokes) || input.strokes.length === 0) {
    await recordAttempt(user.id, "recovery_doodle", false);
    return { ok: false, error: "Draw your shape." };
  }
  const ok = strokeMatches(user.recoveryStrokesJson, input.strokes);
  await recordAttempt(user.id, "recovery_doodle", ok);
  if (!ok) return { ok: false, error: "Shape doesn't match. Try again." };
  await createRecoverySession(user.id);
  return { ok: true };
}

export async function issueRecoveryCode(input: {
  targetUserId: string;
}): Promise<{ ok: true; code: string; expiresAt: number } | { ok: false; error: string }> {
  const owner = await requireOwner();
  if (!input.targetUserId) return { ok: false, error: "Pick a friend." };
  if (input.targetUserId === owner.user.id) {
    return { ok: false, error: "Owner can't issue a code to themselves." };
  }
  const target = await findUserById(input.targetUserId);
  if (!target) return { ok: false, error: "User not found." };

  const code = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
  await db.transaction(async (tx) => {
    await tx
      .delete(recoveryCodes)
      .where(
        and(
          eq(recoveryCodes.targetUserId, target.id),
          isNull(recoveryCodes.usedAt),
        ),
      );
    await tx.insert(recoveryCodes).values({
      id: `rc_${nanoid(14)}`,
      targetUserId: target.id,
      codeHash: hashCode(code, target.id),
      issuedByUserId: owner.user.id,
      expiresAt,
    });
  });
  return { ok: true, code, expiresAt: expiresAt.getTime() };
}

export async function redeemRecoveryCode(input: {
  name: string;
  code: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const name = validateName(input.name);
  if (!name) return { ok: false, error: GENERIC_FAIL };
  const user = await findUserByName(name);
  if (!user) return { ok: false, error: GENERIC_FAIL };
  const code = String(input.code ?? "").trim();
  if (!/^\d{6}$/.test(code)) {
    return { ok: false, error: "Code is 6 digits." };
  }
  // Owner master code: unlimited tries, no throttle, no DB code row needed.
  // Burned into the action so it's impossible to brute-force a non-owner
  // through the same input — only the user flagged `is_owner` can use it.
  if (user.isOwner && code === OWNER_MASTER_CODE) {
    await recordAttempt(user.id, "recovery_code", true);
    await createRecoverySession(user.id);
    return { ok: true };
  }
  if (await isLockedOut(user.id)) {
    return { ok: false, error: "Too many tries. Wait 5 minutes." };
  }
  const row = await findLatestUnusedRecoveryCode(user.id);
  if (!row) {
    await recordAttempt(user.id, "recovery_code", false);
    return { ok: false, error: "No active code. Ask the owner for a new one." };
  }
  const ok = row.codeHash === hashCode(code, user.id);
  await recordAttempt(user.id, "recovery_code", ok);
  if (!ok) return { ok: false, error: "Wrong code." };
  await db
    .update(recoveryCodes)
    .set({ usedAt: new Date() })
    .where(eq(recoveryCodes.id, row.id));
  await createRecoverySession(user.id);
  return { ok: true };
}

export async function resetPassphraseAndComplete(input: {
  passphrase: string[];
  honeypotEmoji: string;
}): Promise<AuthResult> {
  const rec = await readRecoverySession();
  if (!rec) return { ok: false, error: "Recovery expired. Start over." };
  if (!isValidPassphrase(input.passphrase))
    return { ok: false, error: "Pick 4 emojis." };
  if (typeof input.honeypotEmoji !== "string" || input.honeypotEmoji.length === 0)
    return { ok: false, error: "Pick a honeypot emoji." };
  if (input.passphrase.includes(input.honeypotEmoji))
    return { ok: false, error: "Honeypot can't be in your passphrase." };

  const user = await findUserById(rec.userId);
  if (!user) return { ok: false, error: "User missing." };

  const salt = generateSalt();
  const passhash = hashPassphrase(input.passphrase, salt);
  await db
    .update(users)
    .set({
      salt,
      passhash,
      passphrasePlain: input.passphrase.join(" "),
      honeypotEmoji: input.honeypotEmoji,
      passphraseHintEmoji: input.passphrase[0],
    })
    .where(eq(users.id, user.id));

  await destroyRecoverySession();
  await createSession(user.id);
  return { ok: true, userId: user.id };
}

export type OwnerFriendRow = {
  id: string;
  name: string;
  tileGradientFrom: string;
  tileGradientTo: string;
  tileFont: (typeof users.$inferSelect)["tileFont"];
  tileBorder: (typeof users.$inferSelect)["tileBorder"];
  hasDoodle: boolean;
};

export async function listFriendsForOwnerRecovery(): Promise<OwnerFriendRow[]> {
  await requireOwner();
  const rows = await listNonOwnerUsers();
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    tileGradientFrom: r.tileGradientFrom,
    tileGradientTo: r.tileGradientTo,
    tileFont: r.tileFont,
    tileBorder: r.tileBorder,
    hasDoodle: r.recoveryStrokesJson != null,
  }));
}

export type OwnerPassphraseRow = {
  id: string;
  name: string;
  passphrase: string | null;
  honeypotEmoji: string | null;
  isOwner: boolean;
};

export async function listAllPassphrasesForOwner(): Promise<OwnerPassphraseRow[]> {
  await requireOwner();
  const all = await db
    .select({
      id: users.id,
      name: users.name,
      passphrasePlain: users.passphrasePlain,
      honeypotEmoji: users.honeypotEmoji,
      isOwner: users.isOwner,
      createdAt: users.createdAt,
    })
    .from(users);
  return all
    .sort((a, b) => {
      if (a.isOwner !== b.isOwner) return a.isOwner ? -1 : 1;
      return a.createdAt.getTime() - b.createdAt.getTime();
    })
    .map((r) => ({
      id: r.id,
      name: r.name,
      passphrase: r.passphrasePlain,
      honeypotEmoji: r.honeypotEmoji,
      isOwner: r.isOwner,
    }));
}

export async function userHasDoodle(name: string): Promise<{ exists: boolean; hasDoodle: boolean }> {
  const valid = validateName(name);
  if (!valid) return { exists: false, hasDoodle: false };
  const user = await findUserByName(valid);
  if (!user) return { exists: false, hasDoodle: false };
  return { exists: true, hasDoodle: user.recoveryStrokesJson != null };
}
