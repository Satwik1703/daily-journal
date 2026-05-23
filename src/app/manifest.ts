import type { MetadataRoute } from "next";
import { getActiveCategories } from "@/db/queries/pomodoro-categories";

export const dynamic = "force-dynamic";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const icons = [
    { src: "/icon", sizes: "192x192", type: "image/png", purpose: "any" as const },
    { src: "/icon", sizes: "512x512", type: "image/png", purpose: "any" as const },
    { src: "/icon", sizes: "512x512", type: "image/png", purpose: "maskable" as const },
  ];

  let shortcuts: MetadataRoute.Manifest["shortcuts"] = [];
  try {
    const cats = await getActiveCategories();
    shortcuts = cats.slice(0, 4).map((c) => ({
      name: `Start ${c.name} pomo`,
      short_name: c.name,
      description: `Auto-start a Pomodoro timer for ${c.name}`,
      url: `/pomodoro?autostart=1&categoryId=${encodeURIComponent(c.id)}`,
      icons: [{ src: "/icon", sizes: "192x192", type: "image/png" }],
    }));
  } catch {
    shortcuts = [];
  }

  return {
    name: "Habit Log",
    short_name: "Habit Log",
    description: "Daily journal, habits, and gym tracker",
    start_url: "/journal",
    display: "standalone",
    orientation: "portrait",
    background_color: "#1a1f1f",
    theme_color: "#1a1f1f",
    categories: ["lifestyle", "productivity", "health"],
    icons,
    shortcuts,
  };
}
