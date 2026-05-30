import { redirect } from "next/navigation";
import { readSessionAndUser } from "@/lib/auth/session";
import { SignupRitual } from "./_components/signup-ritual";

export const dynamic = "force-dynamic";

export default async function SignupPage() {
  const existing = await readSessionAndUser();
  if (existing) redirect("/journal");
  return <SignupRitual />;
}
