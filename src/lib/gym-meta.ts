/**
 * Phase 9 gym rewamp — client-safe types + helpers.
 *
 * No DB imports here (rule #7 in AGENTS.md). All persisted types are
 * re-derived as plain shapes so client components can import freely.
 */

import type { MuscleGroup } from "./muscle-groups";
import { MUSCLE_GROUPS } from "./muscle-groups";
import type { JournalStatus } from "./journal-status";

// ---------- Plain row shapes (mirror schema.ts) ----------

export type Split = {
  id: string;
  name: string;
  emoji: string | null;
  color: string;
  position: number;
  archivedAt: number | null; // epoch ms (JSON-serialized timestamp)
  createdAt: number;
};

export type Exercise = {
  id: string;
  name: string;
  emoji: string | null;
  color: string;
  muscleGroups: MuscleGroup[];
  notes: string | null;
  /** Weight is logged per-hand (dumbbell, single-arm). UI shows "each" badge. */
  perHand: boolean;
  position: number;
  archivedAt: number | null;
  createdAt: number;
};

export type Workout = {
  id: string;
  date: string;
  splitId: string | null;
  notes: string | null;
  durationMin: number | null;
  createdAt: number;
};

export type WorkoutSet = {
  id: string;
  workoutId: string;
  exerciseId: string;
  setNumber: number;
  reps: number | null;
  weightKg: number | null;
  rpe: number | null;
  isWarmup: boolean;
  note: string | null;
  createdAt: number;
};

export type SplitExercise = {
  splitId: string;
  exerciseId: string;
  position: number;
};

// ---------- Insights window ranges ----------

export const GYM_RANGES = [7, 30, 90] as const;
export type GymRange = (typeof GYM_RANGES)[number];

export function clampGymRange(input: string | string[] | undefined): GymRange {
  const v = Array.isArray(input) ? input[0] : input;
  const n = Number(v);
  return (GYM_RANGES as readonly number[]).includes(n) ? (n as GymRange) : 30;
}

// ---------- Per-set helpers ----------

/** Brzycki est 1RM. Returns 0 for invalid input. */
export function est1RM(weight: number | null | undefined, reps: number | null | undefined): number {
  if (!weight || !reps || reps < 1 || reps >= 37) return weight ?? 0;
  return weight * (36 / (37 - reps));
}

/** Volume = reps × weight. Treats null reps as 1 (so "did a set with weight" still counts). */
export function setVolume(set: Pick<WorkoutSet, "reps" | "weightKg">): number {
  const reps = set.reps ?? 1;
  const weight = set.weightKg ?? 0;
  return reps * weight;
}

/** Used by 3D body in "volume" mode and by insights charts. */
export function sumVolumeByMuscle(
  sets: Pick<WorkoutSet, "reps" | "weightKg" | "exerciseId">[],
  exercises: Pick<Exercise, "id" | "muscleGroups">[],
): Record<MuscleGroup, number> {
  const byId = new Map(exercises.map((e) => [e.id, e.muscleGroups]));
  const out: Partial<Record<MuscleGroup, number>> = {};
  for (const s of sets) {
    const muscles = byId.get(s.exerciseId);
    if (!muscles) continue;
    const v = setVolume(s);
    for (const m of muscles) out[m] = (out[m] ?? 0) + v;
  }
  return out as Record<MuscleGroup, number>;
}

/** Used when sets have no weight logged (lazy mode): count sets per muscle. */
export function sumSetsByMuscle(
  sets: Pick<WorkoutSet, "exerciseId">[],
  exercises: Pick<Exercise, "id" | "muscleGroups">[],
): Record<MuscleGroup, number> {
  const byId = new Map(exercises.map((e) => [e.id, e.muscleGroups]));
  const out: Partial<Record<MuscleGroup, number>> = {};
  for (const s of sets) {
    const muscles = byId.get(s.exerciseId);
    if (!muscles) continue;
    for (const m of muscles) out[m] = (out[m] ?? 0) + 1;
  }
  return out as Record<MuscleGroup, number>;
}

// ---------- Color lerp for 3D body ----------

// Untrained = cool gray; trained = warm red. OKLCH-feel via simple RGB lerp.
const UNTRAINED_RGB = { r: 220, g: 220, b: 224 };
const TRAINED_RGB = { r: 220, g: 60, b: 50 };

function lerp(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * t);
}

export function volumeColor(normalized: number): string {
  const t = Math.max(0, Math.min(1, normalized));
  const r = lerp(UNTRAINED_RGB.r, TRAINED_RGB.r, t);
  const g = lerp(UNTRAINED_RGB.g, TRAINED_RGB.g, t);
  const b = lerp(UNTRAINED_RGB.b, TRAINED_RGB.b, t);
  return `rgb(${r}, ${g}, ${b})`;
}

/** Normalize raw per-muscle accumulation into a 0..1 fillFor map. */
export function buildVolumeFillFor(
  perMuscle: Partial<Record<MuscleGroup, number>>,
): (m: MuscleGroup) => string {
  const max = Math.max(0, ...Object.values(perMuscle).map((v) => v ?? 0));
  if (max <= 0) return () => volumeColor(0);
  return (m) => volumeColor((perMuscle[m] ?? 0) / max);
}

// ---------- Recovery mode ----------

export type RecoveryState = "fresh" | "recent" | "recovering" | "ready" | "never";

const RECOVERY_COLOR: Record<RecoveryState, string> = {
  fresh: "#dc2626",      // worked < 24h ago → don't hit
  recent: "#f59e0b",     // 24-48h
  recovering: "#facc15", // 48-72h
  ready: "#22c55e",      // > 72h, ready
  never: "#94a3b8",      // never trained in scope
};

/** Hours since last hit → state bucket. Negative / null → "never". */
export function recoveryStateFor(hoursSince: number | null): RecoveryState {
  if (hoursSince == null) return "never";
  if (hoursSince < 24) return "fresh";
  if (hoursSince < 48) return "recent";
  if (hoursSince < 72) return "recovering";
  return "ready";
}

export function recoveryColor(hoursSince: number | null): string {
  return RECOVERY_COLOR[recoveryStateFor(hoursSince)];
}

export function buildRecoveryFillFor(
  hoursByMuscle: Partial<Record<MuscleGroup, number | null>>,
): (m: MuscleGroup) => string {
  return (m) => recoveryColor(hoursByMuscle[m] ?? null);
}

// ---------- Per-set prefill ----------

export type SetPrefill = { reps: number | null; weightKg: number | null };

/** Reads the most-recent set values from a list of sets within one exercise (sorted any order). */
export function latestSetPrefill(sets: WorkoutSet[]): SetPrefill {
  if (sets.length === 0) return { reps: null, weightKg: null };
  const sorted = [...sets].sort((a, b) => b.createdAt - a.createdAt);
  return { reps: sorted[0].reps, weightKg: sorted[0].weightKg };
}

// ---------- Group ordering ----------

export function sortByPosition<T extends { position: number }>(arr: T[]): T[] {
  return [...arr].sort((a, b) => a.position - b.position);
}

export function isAllMuscleGroups(arr: unknown): arr is MuscleGroup[] {
  return Array.isArray(arr) && arr.every((m) => (MUSCLE_GROUPS as readonly string[]).includes(m as string));
}

// ---------- PR detection ----------

/** Did `candidate` set a new heaviest-weight PR vs prior sets for the same exercise? */
export function isWeightPR(
  candidate: Pick<WorkoutSet, "weightKg" | "reps">,
  priorSets: Pick<WorkoutSet, "weightKg" | "reps">[],
): boolean {
  if (!candidate.weightKg || (candidate.reps ?? 0) < 1) return false;
  const priorMax = priorSets
    .filter((s) => (s.reps ?? 0) >= 1 && s.weightKg != null)
    .reduce((m, s) => Math.max(m, s.weightKg ?? 0), 0);
  return candidate.weightKg > priorMax;
}

// ---------- Calendar day status (5-bucket palette by volume) ----------

/**
 * Map a day's gym output to the shared 5-color status palette so the date
 * picker shows meaningful intensity bands instead of a binary green dot.
 *
 *   - empty: zero sets logged
 *   - bad / avg / good / great / crazy: volume bands relative to refMaxVolume
 *
 * Lazy-day fallback: when sets exist but no weight logged anywhere on the day,
 * bucket by set count (12+ = great, 8+ = good, 4+ = avg, else bad).
 *
 * `refMaxVolume` is typically the user's max single-day volume over the
 * trailing 90d — keeps the scale stable across the calendar.
 */
export function computeGymDayStatus(
  volume: number,
  setCount: number,
  refMaxVolume: number,
): JournalStatus {
  if (setCount === 0) return "empty";
  if (volume === 0) {
    if (setCount >= 12) return "great";
    if (setCount >= 8) return "good";
    if (setCount >= 4) return "avg";
    return "bad";
  }
  if (refMaxVolume <= 0) return "good";
  const r = volume / refMaxVolume;
  if (r >= 0.9) return "crazy";
  if (r >= 0.7) return "great";
  if (r >= 0.45) return "good";
  if (r >= 0.2) return "avg";
  return "bad";
}

/** Did `candidate` set a new est-1RM PR? */
export function is1RMPR(
  candidate: Pick<WorkoutSet, "weightKg" | "reps">,
  priorSets: Pick<WorkoutSet, "weightKg" | "reps">[],
): boolean {
  const cand1rm = est1RM(candidate.weightKg, candidate.reps);
  if (cand1rm <= 0) return false;
  const priorMax = priorSets.reduce((m, s) => Math.max(m, est1RM(s.weightKg, s.reps)), 0);
  return cand1rm > priorMax;
}
