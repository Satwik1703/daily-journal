import { NextResponse } from "next/server";
import { clampGymRange } from "@/lib/gym-meta";
import { getGymInsightsWindow } from "@/db/queries/gym";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ range: string }> },
) {
  const { range } = await ctx.params;
  const r = clampGymRange(range);
  const window = await getGymInsightsWindow(r);
  return NextResponse.json(window);
}
