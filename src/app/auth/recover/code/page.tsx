import { redirect } from "next/navigation";
import { readSessionAndUser } from "@/lib/auth/session";
import { CodeRecoverForm } from "./_components/code-recover-form";

export const dynamic = "force-dynamic";

export default async function CodeRecoverPage({
  searchParams,
}: {
  searchParams: Promise<{ name?: string }>;
}) {
  const existing = await readSessionAndUser();
  if (existing) redirect("/journal");
  const { name } = await searchParams;
  if (!name) redirect("/auth/recover");
  return <CodeRecoverForm name={name} />;
}
