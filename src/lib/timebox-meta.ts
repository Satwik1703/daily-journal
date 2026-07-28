// Client-safe constants + pure helpers for the Timebox tab. No DB imports.

export const SLOTS_PER_DAY = 48;
export const MINUTES_PER_SLOT = 30;

export type TimeboxCategory = {
  id: string;
  name: string;
  emoji: string | null;
  color: string;
  position: number;
  pomoCategoryId: string | null;
};

export type TimeboxSlot = {
  slotIndex: number;
  categoryId: string | null;
  label: string | null;
  note: string | null;
  source: "manual" | "auto-pomo";
};

// Preload for autocomplete. Every distinct label the user has ever used +
// its usage stats. Kept small (≤200 rows) so client filtering per keystroke
// stays fast without needing a network round-trip.
export type LabelStat = {
  label: string;
  count: number;
  lastUsedTs: number;
  // Category id most-frequently paired with this label.
  mostCommonCategoryId: string | null;
  // Slot index (0..47) most-frequently associated with this label — powers
  // the time-of-day-weighted ranking.
  mostCommonSlotIndex: number;
};

export const DEFAULT_TIMEBOX_CATEGORIES: Array<{
  name: string;
  emoji: string;
  color: string;
}> = [
  { name: "Work", emoji: "💼", color: "#2563eb" },
  { name: "Study", emoji: "📖", color: "#7c3aed" },
  { name: "Create", emoji: "🎨", color: "#db2777" },
  { name: "Exercise", emoji: "🏋️", color: "#059669" },
  { name: "Meal", emoji: "🍽️", color: "#f59e0b" },
  { name: "Sleep", emoji: "😴", color: "#4b5563" },
  { name: "Break", emoji: "☕", color: "#78716c" },
  { name: "Self-care", emoji: "🧴", color: "#0ea5e9" },
];

// ---------- Slot ↔ time helpers ----------

export function slotStartMinutes(slotIndex: number): number {
  return slotIndex * MINUTES_PER_SLOT;
}

/** "12:00 AM", "12:30 AM", ..., "11:30 PM" */
export function formatSlotLabel(slotIndex: number): string {
  const mins = slotStartMinutes(slotIndex);
  const h24 = Math.floor(mins / 60);
  const m = mins % 60;
  const h12 = h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24;
  const ampm = h24 < 12 ? "AM" : "PM";
  return `${h12}:${m.toString().padStart(2, "0")} ${ampm}`;
}

/** Local-clock slot index for a Date. Slot 0 = 00:00 local time. */
export function slotIndexOf(d: Date): number {
  const mins = d.getHours() * 60 + d.getMinutes();
  return Math.min(SLOTS_PER_DAY - 1, Math.floor(mins / MINUTES_PER_SLOT));
}

/** Pomo auto-fill snapping. A pomo of length `durationMin` starting at
 *  `startedAt` snaps DOWN to the containing 30-min slot boundary, then
 *  extends up to a minimum of 60 minutes (2 slots). Longer pomos scale
 *  up proportionally, rounded up to full slots. */
export function pomoSlotsCovered(
  startedAt: Date,
  durationMin: number,
): number[] {
  const startSlot = slotIndexOf(startedAt);
  const rounded = Math.max(60, durationMin);
  const slotCount = Math.ceil(rounded / MINUTES_PER_SLOT);
  const out: number[] = [];
  for (let i = 0; i < slotCount; i++) {
    const idx = startSlot + i;
    if (idx >= SLOTS_PER_DAY) break;
    out.push(idx);
  }
  return out;
}

// ---------- Autocomplete ranker ----------

/**
 * Rank label suggestions given the user's stats + current input.
 *
 * Scoring:
 *   base       = decayed frequency (count × recency_weight)
 *   +40        if label matches typed query as a prefix
 *   +20        if it matches as a substring (non-prefix)
 *   +25        if `activeCategoryId` matches its most-common category
 *   +15        if current slot is within ±4 slots of its most-common
 *   +Infinity  hard exclude if `q` is non-empty and no substring match
 */
export type RankedSuggestion = {
  label: string;
  categoryId: string | null;
  score: number;
  reason: string;
};

const RECENCY_HALFLIFE_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

export function rankLabels(
  stats: LabelStat[],
  opts: {
    q?: string;
    activeCategoryId?: string | null;
    currentSlotIndex?: number;
    now?: number;
    limit?: number;
    excludeLabels?: string[];
  } = {},
): RankedSuggestion[] {
  const q = (opts.q ?? "").trim().toLowerCase();
  const now = opts.now ?? Date.now();
  const excluded = new Set((opts.excludeLabels ?? []).map((s) => s.toLowerCase()));
  const out: RankedSuggestion[] = [];

  for (const s of stats) {
    const lower = s.label.toLowerCase();
    if (excluded.has(lower)) continue;
    let score = 0;

    // Substring match gate.
    if (q.length > 0) {
      const idx = lower.indexOf(q);
      if (idx < 0) continue;
      if (idx === 0) score += 40;
      else score += 20;
    }

    // Decayed frequency.
    const ageMs = Math.max(0, now - s.lastUsedTs);
    const decay = Math.pow(0.5, ageMs / RECENCY_HALFLIFE_MS);
    score += s.count * (0.5 + decay * 0.5);

    // Category scope.
    if (opts.activeCategoryId && s.mostCommonCategoryId === opts.activeCategoryId) {
      score += 25;
    }

    // Time-of-day.
    if (opts.currentSlotIndex != null) {
      const dist = Math.abs(opts.currentSlotIndex - s.mostCommonSlotIndex);
      if (dist <= 4) score += 15 * (1 - dist / 4);
    }

    const reason =
      q.length === 0
        ? decay > 0.8
          ? "recent"
          : "frequent"
        : lower.startsWith(q)
          ? "prefix"
          : "match";

    out.push({
      label: s.label,
      categoryId: s.mostCommonCategoryId,
      score,
      reason,
    });
  }

  out.sort((a, b) => b.score - a.score);
  return out.slice(0, opts.limit ?? 8);
}
