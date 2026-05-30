import { redirect } from "next/navigation";
import { readSessionAndUser } from "@/lib/auth/session";
import { listAllUsersForLoginScreen } from "@/db/queries/users";
import { FloatingRoster, type RosterUser } from "./_components/floating-roster";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const existing = await readSessionAndUser();
  const { next } = await searchParams;
  if (existing) {
    redirect(next && next.startsWith("/") ? next : "/journal");
  }
  const rows = await listAllUsersForLoginScreen();
  const users: RosterUser[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    gradientFrom: r.tileGradientFrom,
    gradientTo: r.tileGradientTo,
    font: r.tileFont,
    border: r.tileBorder,
    lastSeenAt: r.lastSeenAt?.getTime() ?? null,
  }));
  return <FloatingRoster users={users} next={next} />;
}
