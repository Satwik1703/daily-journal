export const PRESET_COLORS = [
  "#10b981", "#0ea5e9", "#a855f7", "#f43f5e",
  "#f59e0b", "#84cc16", "#ec4899", "#64748b",
] as const;

export type PresetColor = (typeof PRESET_COLORS)[number];
