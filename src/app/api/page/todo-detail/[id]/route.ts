import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/context";
import { getSubtasks } from "@/db/queries/todo";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const subtasks = await getSubtasks(session.user.id, id);
  return NextResponse.json({ subtasks });
}
