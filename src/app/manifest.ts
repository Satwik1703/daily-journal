import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  const icons = [
    { src: "/icon", sizes: "192x192", type: "image/png", purpose: "any" as const },
    { src: "/icon", sizes: "512x512", type: "image/png", purpose: "any" as const },
    { src: "/icon", sizes: "512x512", type: "image/png", purpose: "maskable" as const },
  ];

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
  };
}
