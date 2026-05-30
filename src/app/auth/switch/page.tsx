import { redirect } from "next/navigation";
import { destroySession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function SwitchUserPage() {
  await destroySession();
  redirect("/auth/login");
}
