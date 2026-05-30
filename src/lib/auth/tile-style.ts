export const TILE_GRADIENT_PRESETS = [
  { id: "teal", from: "#4fa896", to: "#7fc7b9" },
  { id: "sunset", from: "#f57c4a", to: "#f3c987" },
  { id: "ocean", from: "#3b82f6", to: "#7dd3fc" },
  { id: "forest", from: "#15803d", to: "#86efac" },
  { id: "rose", from: "#e11d48", to: "#fda4af" },
  { id: "amber", from: "#f59e0b", to: "#fde68a" },
  { id: "violet", from: "#7c3aed", to: "#c4b5fd" },
  { id: "slate", from: "#475569", to: "#94a3b8" },
  { id: "candy", from: "#ec4899", to: "#f9a8d4" },
  { id: "lime", from: "#65a30d", to: "#d9f99d" },
  { id: "midnight", from: "#1e293b", to: "#475569" },
  { id: "ember", from: "#dc2626", to: "#fde68a" },
] as const;

export type TileGradient = (typeof TILE_GRADIENT_PRESETS)[number];

export const TILE_FONTS = [
  { id: "lora", label: "Serif", css: "var(--font-serif)" },
  { id: "fraunces", label: "Display", css: "'Fraunces', serif" },
  { id: "space_grotesk", label: "Modern", css: "'Space Grotesk', sans-serif" },
  { id: "ibm_plex_mono", label: "Mono", css: "'IBM Plex Mono', monospace" },
] as const;

export type TileFont = (typeof TILE_FONTS)[number]["id"];

export const TILE_BORDERS = [
  { id: "rounded", label: "Rounded" },
  { id: "square", label: "Square" },
  { id: "wax_seal", label: "Wax seal" },
  { id: "stamped", label: "Stamped" },
] as const;

export type TileBorder = (typeof TILE_BORDERS)[number]["id"];

export function borderClassFor(border: TileBorder): string {
  switch (border) {
    case "rounded":
      return "rounded-2xl";
    case "square":
      return "rounded-md";
    case "wax_seal":
      return "rounded-full";
    case "stamped":
      return "rounded-lg border-dashed";
    default:
      return "rounded-2xl";
  }
}

export function fontCssFor(font: TileFont): string {
  return TILE_FONTS.find((f) => f.id === font)?.css ?? "var(--font-serif)";
}
