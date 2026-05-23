import { getActiveQuestions, getArchivedQuestions } from "@/db/queries/journal-questions";
import {
  getActiveCategories,
  getArchivedCategories,
} from "@/db/queries/pomodoro-categories";
import { getPomodoroSoundId } from "@/db/queries/settings";
import {
  getSplits,
  getExercises,
  getSplitExercises,
} from "@/db/queries/gym";

export const dynamic = "force-dynamic";

import { QuestionsManager } from "./_components/questions-manager";
import { PomodoroCategoriesManager } from "./_components/pomodoro-categories-manager";
import { SoundPicker } from "./_components/sound-picker";
import { SyncStatusPanel } from "./_components/sync-status-panel";
import { SplitsManager } from "./_components/splits-manager";
import { ExercisesManager } from "./_components/exercises-manager";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

export default async function SettingsPage() {
  const [
    active,
    archived,
    pomoActive,
    pomoArchived,
    soundId,
    splits,
    exercises,
    joins,
  ] = await Promise.all([
    getActiveQuestions(),
    getArchivedQuestions(),
    getActiveCategories(),
    getArchivedCategories(),
    getPomodoroSoundId(),
    getSplits(true),
    getExercises(true),
    getSplitExercises(),
  ]);
  return (
    <div className="mx-auto w-full max-w-2xl px-4 pt-4 pb-8 space-y-5">
      <div>
        <h1 className="font-serif text-2xl font-normal leading-tight">Settings</h1>
        <p className="text-xs text-muted-foreground">Customize what you track each day.</p>
      </div>

      <SyncStatusPanel />

      <QuestionsManager active={active} archived={archived} />

      <PomodoroCategoriesManager active={pomoActive} archived={pomoArchived} />

      <SplitsManager splits={splits} exercises={exercises} joins={joins} />

      <ExercisesManager exercises={exercises} />

      <SoundPicker currentSoundId={soundId} />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="font-serif text-lg font-normal">Habits</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Manage your habits on the{" "}
          <Link href="/habits" className="text-primary underline-offset-2 hover:underline">
            Habits page
          </Link>
          .
        </CardContent>
      </Card>
    </div>
  );
}
