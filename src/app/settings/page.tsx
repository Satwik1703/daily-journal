import { getActiveQuestions, getArchivedQuestions } from "@/db/queries/journal-questions";

export const dynamic = "force-dynamic";

import { QuestionsManager } from "./_components/questions-manager";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

export default async function SettingsPage() {
  const [active, archived] = await Promise.all([getActiveQuestions(), getArchivedQuestions()]);
  return (
    <div className="mx-auto w-full max-w-2xl px-4 pt-4 pb-8 space-y-5">
      <div>
        <h1 className="font-serif text-2xl font-normal leading-tight">Settings</h1>
        <p className="text-xs text-muted-foreground">Customize what you track each day.</p>
      </div>

      <QuestionsManager active={active} archived={archived} />

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
