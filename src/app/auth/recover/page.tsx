import { redirect } from "next/navigation";
import { readSessionAndUser } from "@/lib/auth/session";
import { RecoverLanding } from "./_components/recover-landing";

export const dynamic = "force-dynamic";

export default async function RecoverPage({
  searchParams,
}: {
  searchParams: Promise<{ name?: string }>;
}) {
  const existing = await readSessionAndUser();
  if (existing) redirect("/journal");
  const { name } = await searchParams;
  return <RecoverLanding initialName={name ?? ""} />;
}
