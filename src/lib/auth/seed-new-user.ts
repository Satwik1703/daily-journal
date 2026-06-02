import { nanoid } from "nanoid";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import {
  journalQuestions,
  pomodoroCategories,
  users,
  splits,
  exercises,
  splitExercises,
} from "@/db/schema";
import { DEFAULT_CATEGORIES } from "@/lib/pomodoro-meta";
import { getAllSplitsWithExercises } from "@/db/queries/gym";

const DEFAULT_JOURNAL_QUESTIONS: { label: string; type: "text" | "scale" | "boolean" }[] = [
  { label: "What went well today?", type: "text" },
  { label: "What could have gone better?", type: "text" },
  { label: "Learning of the day", type: "text" },
  { label: "Notes", type: "text" },
];

export async function seedNewUser(userId: string): Promise<void> {
  const catRows = DEFAULT_CATEGORIES.map((c, i) => ({
    id: nanoid(12),
    userId,
    name: c.name,
    emoji: c.emoji,
    color: c.color,
    position: i,
  }));
  await db.insert(pomodoroCategories).values(catRows);

  const qRows = DEFAULT_JOURNAL_QUESTIONS.map((q, i) => ({
    id: nanoid(12),
    userId,
    label: q.label,
    type: q.type,
    position: i,
  }));
  await db.insert(journalQuestions).values(qRows);

  await cloneOwnerGym(userId);
}

// Copy the owner's active gym configuration (splits + exercises + their links)
// into the new user's account so they land on a populated Gym tab instead of an
// empty one. Live-copy (not a frozen snapshot) — always mirrors the owner's
// latest setup. Best-effort: gym is non-critical, so any failure here is logged
// and swallowed rather than failing signup or stranding a half-seeded account.
async function cloneOwnerGym(userId: string): Promise<void> {
  try {
    const ownerRow = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.isOwner, true))
      .limit(1);
    const ownerId = ownerRow[0]?.id;
    if (!ownerId || ownerId === userId) return;

    const { splits: oSplits, exercises: oExercises, joins } =
      await getAllSplitsWithExercises(ownerId);
    if (oSplits.length === 0 && oExercises.length === 0) return;

    // Remap owner ids -> fresh ids for the new user.
    const splitIdMap = new Map<string, string>();
    const exerciseIdMap = new Map<string, string>();
    for (const s of oSplits) splitIdMap.set(s.id, nanoid(12));
    for (const e of oExercises) exerciseIdMap.set(e.id, nanoid(12));

    const splitRows = oSplits.map((s) => ({
      id: splitIdMap.get(s.id)!,
      userId,
      name: s.name,
      emoji: s.emoji,
      color: s.color,
      position: s.position,
    }));
    const exerciseRows = oExercises.map((e) => ({
      id: exerciseIdMap.get(e.id)!,
      userId,
      name: e.name,
      emoji: e.emoji,
      color: e.color,
      muscleGroups: e.muscleGroups,
      notes: e.notes,
      perHand: e.perHand,
      position: e.position,
    }));
    // Drop links whose split or exercise wasn't copied (e.g. archived exercise
    // excluded by getAllSplitsWithExercises) to avoid orphan FK inserts.
    const joinRows = joins
      .filter((j) => splitIdMap.has(j.splitId) && exerciseIdMap.has(j.exerciseId))
      .map((j) => ({
        userId,
        splitId: splitIdMap.get(j.splitId)!,
        exerciseId: exerciseIdMap.get(j.exerciseId)!,
        position: j.position,
      }));

    await db.transaction(async (tx) => {
      if (splitRows.length) await tx.insert(splits).values(splitRows);
      if (exerciseRows.length) await tx.insert(exercises).values(exerciseRows);
      if (joinRows.length) await tx.insert(splitExercises).values(joinRows);
    });
  } catch (err) {
    console.error("[seedNewUser] gym clone failed (non-fatal):", err);
  }
}
