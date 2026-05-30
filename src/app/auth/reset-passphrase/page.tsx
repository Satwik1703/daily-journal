import { redirect } from "next/navigation";
import {
  readRecoverySession,
  readSessionAndUser,
} from "@/lib/auth/session";
import { findUserById } from "@/db/queries/users";
import { ResetPassphraseForm } from "./_components/reset-form";

export const dynamic = "force-dynamic";

export default async function ResetPassphrasePage() {
  const existing = await readSessionAndUser();
  if (existing) redirect("/journal");
  const rec = await readRecoverySession();
  if (!rec) redirect("/auth/recover");
  const user = await findUserById(rec.userId);
  if (!user) redirect("/auth/recover");
  return <ResetPassphraseForm name={user.name} />;
}
