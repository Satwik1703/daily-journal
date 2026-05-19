import { db } from "@/db/client";
import { settings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { DEFAULT_SOUND_ID, SOUND_OPTIONS } from "@/lib/pomodoro-meta";

export async function getKv<T = unknown>(key: string): Promise<T | null> {
  const rows = await db
    .select({ value: settings.value })
    .from(settings)
    .where(eq(settings.key, key))
    .limit(1);
  return (rows[0]?.value as T) ?? null;
}

export async function getPomodoroSoundId(): Promise<string> {
  const v = await getKv<string>("pomodoro_sound");
  if (v && SOUND_OPTIONS.some((s) => s.id === v)) return v;
  return DEFAULT_SOUND_ID;
}
