import { redirect } from "next/navigation";
import { parseViewParam } from "@/lib/todo/todo-meta";
import { TodoClient } from "../_components/todo-client";

export const dynamic = "force-dynamic";

export default async function TodoViewPage({
  params,
}: {
  params: Promise<{ view: string }>;
}) {
  const { view } = await params;
  // `list-<id>` is validated client-side against the user's lists; smart views
  // are validated here. Unknown → bounce to Today.
  if (!parseViewParam(view)) redirect("/todo/today");
  return <TodoClient view={view} />;
}
