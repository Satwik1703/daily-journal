import { redirect } from "next/navigation";
import { readSessionAndUser } from "@/lib/auth/session";
import { DoodleRecoverForm } from "./_components/doodle-recover-form";

export const dynamic = "force-dynamic";

export default async function DoodleRecoverPage({
  searchParams,
}: {
  searchParams: Promise<{ name?: string }>;
}) {
  const existing = await readSessionAndUser();
  if (existing) redirect("/journal");
  const { name } = await searchParams;
  if (!name) redirect("/auth/recover");
  return <DoodleRecoverForm name={name} />;
}
