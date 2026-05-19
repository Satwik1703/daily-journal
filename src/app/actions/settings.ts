"use server";

import { db } from "@/db/client";
import { settings } from "@/db/schema";
import { revalidatePath } from "next/cache";
import { SOUND_OPTIONS } from "@/lib/pomodoro-meta";

export async function setPomodoroSound(soundId: string): Promise<void> {
  if (!SOUND_OPTIONS.some((s) => s.id === soundId)) {
    throw new Error(`Unknown sound id: ${soundId}`);
  }
  await db
    .insert(settings)
    .values({ key: "pomodoro_sound", value: soundId })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value: soundId },
    });
  revalidatePath("/settings");
  revalidatePath("/pomodoro", "layout");
}
