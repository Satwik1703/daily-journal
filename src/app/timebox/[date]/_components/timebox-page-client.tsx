"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatHumanDate, todayLocal } from "@/lib/dates";
import { useCachedPage } from "@/lib/sync/cache";
import { authAwareFetch } from "@/lib/sync/auth-fetch";
import { mutate } from "@/lib/sync/mutate";
import {
  SLOTS_PER_DAY,
  formatSlotLabel,
  pomoSlotsCovered,
  slotIndexOf,
  type LabelStat,
  type TimeboxCategory,
  type TimeboxSlot,
} from "@/lib/timebox-meta";
import { TimeboxDateStepper } from "./timebox-date-stepper";
import { SlotRow, type SlotDisplay } from "./slot-row";
import { CategoryChips } from "./category-chips";
import { SlotEditorSheet } from "./slot-editor-sheet";
import { MultiSelectBar } from "./multi-select-bar";
import { Autocomplete } from "./autocomplete";

type PomoSession = {
  id: string;
  startedAt: number;
  durationMin: number;
  categoryId: string | null;
  categoryName: string | null;
  description: string | null;
};

type PageData = {
  date: string;
  slots: TimeboxSlot[];
  categories: TimeboxCategory[];
  labelStats: LabelStat[];
  pomoSessions: PomoSession[];
};

export function TimeboxPageClient({ date }: { date: string }) {
  const data = useCachedPage<PageData | null>(
    `timebox:${date}`,
    null,
    async () => {
      const res = await authAwareFetch(`/api/page/timebox/${date}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Fetch failed");
      return (await res.json()) as PageData;
    },
  );

  // ---------- Now-slot tick ----------
  const isToday = date === todayLocal();
  const [nowSlot, setNowSlot] = useState<number>(() =>
    isToday ? slotIndexOf(new Date()) : -1,
  );
  useEffect(() => {
    if (!isToday) {
      setNowSlot(-1);
      return;
    }
    const iv = window.setInterval(() => {
      setNowSlot(slotIndexOf(new Date()));
    }, 30_000);
    return () => window.clearInterval(iv);
  }, [isToday]);

  // ---------- Local optimistic overlay ----------
  // On any mutate the parent SWR cache refetches, but that round-trip has
  // latency. Keep an in-memory Map<slotIndex, TimeboxSlot | null> where
  // `null` means "cleared", missing means "use server value".
  const [overlay, setOverlay] = useState<Map<number, TimeboxSlot | null>>(
    () => new Map(),
  );
  // When the server data arrives, drop overlay entries whose server value
  // now matches — prevents stale overrides from lingering forever.
  useEffect(() => {
    if (!data) return;
    setOverlay((prev) => {
      if (prev.size === 0) return prev;
      const next = new Map(prev);
      const serverMap = new Map(data.slots.map((s) => [s.slotIndex, s]));
      for (const [idx, local] of prev) {
        const server = serverMap.get(idx);
        if (local == null) {
          if (!server) next.delete(idx);
        } else if (
          server &&
          server.label === local.label &&
          server.categoryId === local.categoryId &&
          server.note === local.note
        ) {
          next.delete(idx);
        }
      }
      return next;
    });
  }, [data]);

  // ---------- Selected slots (multi-select) ----------
  const [selected, setSelected] = useState<Set<number>>(new Set());

  // ---------- Slot editor sheet ----------
  const [editingSlot, setEditingSlot] = useState<number | null>(null);

  // ---------- BigBar state ----------
  const [bigBarLabel, setBigBarLabel] = useState("");
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const bigBarRef = useRef<HTMLInputElement>(null);

  // Merge server slots + optimistic overlay.
  const slotById = useMemo(() => {
    const m = new Map<number, TimeboxSlot | null>();
    if (data) for (const s of data.slots) m.set(s.slotIndex, s);
    for (const [k, v] of overlay) m.set(k, v);
    return m;
  }, [data, overlay]);

  // Compute pomo ghost overlays for the day (client-side snap+expand).
  const ghosts = useMemo(() => {
    const m = new Map<number, { label: string; categoryId: string | null }>();
    if (!data) return m;
    // Map pomo cat id → timebox category id (name match).
    const timeboxCatByPomo = new Map<string, string>();
    for (const c of data.categories) {
      if (c.pomoCategoryId) timeboxCatByPomo.set(c.pomoCategoryId, c.id);
    }
    // Also allow name-based fallback matching (case-insensitive).
    const timeboxCatByName = new Map<string, TimeboxCategory>();
    for (const c of data.categories) timeboxCatByName.set(c.name.toLowerCase(), c);
    for (const p of data.pomoSessions) {
      const slots = pomoSlotsCovered(new Date(p.startedAt), p.durationMin);
      let tbxCatId: string | null = null;
      if (p.categoryId && timeboxCatByPomo.has(p.categoryId)) {
        tbxCatId = timeboxCatByPomo.get(p.categoryId) ?? null;
      } else if (p.categoryName) {
        // Fallback: name-match against timebox categories (case-insensitive).
        const match = timeboxCatByName.get(p.categoryName.toLowerCase());
        if (match) tbxCatId = match.id;
      }
      const label = p.description?.trim() || p.categoryName || "Focus session";
      for (const idx of slots) {
        if (m.has(idx)) continue;
        m.set(idx, { label, categoryId: tbxCatId });
      }
    }
    return m;
  }, [data]);

  const displays = useMemo<SlotDisplay[]>(() => {
    const out: SlotDisplay[] = [];
    for (let i = 0; i < SLOTS_PER_DAY; i++) {
      const manual = slotById.get(i) ?? null;
      const ghost = ghosts.get(i) ?? null;
      out.push({
        slotIndex: i,
        manual,
        ghost,
        isNow: i === nowSlot,
        isPast: nowSlot >= 0 && i < nowSlot,
      });
    }
    return out;
  }, [slotById, ghosts, nowSlot]);

  const categoryMap = useMemo(
    () => new Map((data?.categories ?? []).map((c) => [c.id, c])),
    [data?.categories],
  );

  // ---------- Actions ----------

  const applySlot = useCallback(
    (slotIndex: number, patch: Partial<TimeboxSlot>) => {
      const cur = slotById.get(slotIndex) ?? null;
      const next: TimeboxSlot = {
        slotIndex,
        categoryId: patch.categoryId ?? cur?.categoryId ?? null,
        label: patch.label ?? cur?.label ?? null,
        note: patch.note ?? cur?.note ?? null,
        source: "manual",
      };
      setOverlay((m) => new Map(m).set(slotIndex, next));
      void mutate("upsert_timebox_slot", {
        date,
        slotIndex,
        categoryId: next.categoryId,
        label: next.label,
        note: next.note,
        source: "manual",
      });
    },
    [date, slotById],
  );

  const clearSlot = useCallback(
    (slotIndex: number) => {
      setOverlay((m) => new Map(m).set(slotIndex, null));
      void mutate("clear_timebox_slot", { date, slotIndex });
    },
    [date],
  );

  // BigBar → apply to current live slot (or the first empty slot after last
  // filled if no "now" — used on past dates).
  const targetSlot = useMemo<number>(() => {
    if (nowSlot >= 0) return nowSlot;
    // Past date fallback: last filled + 1, else 0.
    let last = -1;
    for (const [k, v] of slotById) if (v && k > last) last = k;
    return Math.min(SLOTS_PER_DAY - 1, last + 1);
  }, [nowSlot, slotById]);

  function bigBarSubmit(label: string, catId: string | null) {
    applySlot(targetSlot, { label, categoryId: catId ?? activeCategoryId ?? null });
    setBigBarLabel("");
    // Keep focus for chained entry.
    bigBarRef.current?.focus();
  }

  function chipTap(c: TimeboxCategory) {
    // Toggle active category. Applies to current live slot with category
    // name as default label if none typed.
    setActiveCategoryId((cur) => (cur === c.id ? null : c.id));
    if (nowSlot >= 0) {
      applySlot(targetSlot, {
        categoryId: c.id,
        label: bigBarLabel.trim() || c.name,
      });
    }
  }

  function chipLongPress(c: TimeboxCategory) {
    // Fill every empty slot from lastFilled+1 through targetSlot inclusive.
    let lastFilled = -1;
    for (const [k, v] of slotById) if (v && k <= targetSlot && k > lastFilled) lastFilled = k;
    const start = lastFilled + 1;
    const end = targetSlot;
    if (end < start) return;
    const idxs: number[] = [];
    for (let i = start; i <= end; i++) {
      if (!slotById.get(i)) idxs.push(i);
    }
    if (idxs.length === 0) return;
    // Apply optimistically.
    setOverlay((m) => {
      const nn = new Map(m);
      for (const i of idxs) {
        nn.set(i, {
          slotIndex: i,
          categoryId: c.id,
          label: c.name,
          note: null,
          source: "manual",
        });
      }
      return nn;
    });
    void mutate("upsert_timebox_slots_bulk", {
      date,
      slotIndices: idxs,
      categoryId: c.id,
      label: c.name,
    });
  }

  function slotTap(idx: number) {
    if (selected.size > 0) {
      // In multi-select mode, tapping toggles selection.
      setSelected((s) => {
        const nn = new Set(s);
        if (nn.has(idx)) nn.delete(idx);
        else nn.add(idx);
        return nn;
      });
      return;
    }
    // Otherwise open editor.
    setEditingSlot(idx);
  }

  function slotLongPress(idx: number) {
    setSelected((s) => {
      const nn = new Set(s);
      if (nn.has(idx)) nn.delete(idx);
      else nn.add(idx);
      return nn;
    });
  }

  function ghostPromote(idx: number) {
    const g = ghosts.get(idx);
    if (!g) return;
    applySlot(idx, { label: g.label, categoryId: g.categoryId });
  }

  const filledCount = useMemo(() => {
    let n = 0;
    for (const v of slotById.values()) if (v) n++;
    return n;
  }, [slotById]);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pt-4 pb-40">
      <TimeboxDateStepper date={date} />

      <div className="mb-3 flex items-baseline justify-between">
        <div>
          <h1 className="font-serif text-2xl font-normal leading-tight">Timebox</h1>
          <p className="text-xs text-muted-foreground">
            {formatHumanDate(date)}
            {" · "}
            <span className="tabular-nums">{filledCount}</span> / 48 slots logged
          </p>
        </div>
        {nowSlot >= 0 ? (
          <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-medium text-primary tabular-nums">
            Now · {formatSlotLabel(nowSlot)}
          </span>
        ) : null}
      </div>

      {/* Big bar — primary friction-free entry */}
      {data ? (
        <div className="mb-4 rounded-lg border border-primary/30 bg-primary/5 p-2 shadow-sm">
          <div className="mb-1 flex items-center justify-between px-1">
            <p className="text-[10px] uppercase tracking-wider text-primary/80">
              Filling {formatSlotLabel(targetSlot)}
            </p>
            {activeCategoryId ? (
              <button
                type="button"
                onClick={() => setActiveCategoryId(null)}
                className="text-[10px] text-muted-foreground hover:text-foreground"
              >
                Clear category
              </button>
            ) : (
              <span className="text-[10px] text-muted-foreground italic">
                No category (pick a chip below)
              </span>
            )}
          </div>
          <Autocomplete
            ref={bigBarRef}
            value={bigBarLabel}
            onChange={setBigBarLabel}
            onSubmit={bigBarSubmit}
            placeholder={
              nowSlot >= 0
                ? "What are you doing right now? (Enter to log)"
                : "What did you do? (Enter to log)"
            }
            stats={data.labelStats}
            categories={data.categories}
            activeCategoryId={activeCategoryId}
            currentSlotIndex={targetSlot}
          />
        </div>
      ) : null}

      {/* Slots list */}
      {data == null ? (
        <div className="space-y-1">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="h-8 animate-pulse rounded-md bg-muted/30" />
          ))}
        </div>
      ) : (
        <div className="space-y-0.5">
          {displays.map((d) => (
            <SlotRow
              key={d.slotIndex}
              display={d}
              categories={categoryMap}
              selected={selected.has(d.slotIndex)}
              multiSelectActive={selected.size > 0}
              onTap={slotTap}
              onLongPress={slotLongPress}
              onGhostPromote={ghostPromote}
            />
          ))}
        </div>
      )}

      {/* Sticky category chips */}
      {data ? (
        <CategoryChips
          categories={data.categories}
          activeCategoryId={activeCategoryId}
          onTap={chipTap}
          onLongPress={chipLongPress}
        />
      ) : null}

      {/* Multi-select bar (replaces category chips when active) */}
      {selected.size > 0 && data ? (
        <MultiSelectBar
          date={date}
          selected={[...selected]}
          categories={data.categories}
          stats={data.labelStats}
          onClose={() => setSelected(new Set())}
          onApplied={() => setSelected(new Set())}
        />
      ) : null}

      {/* Slot editor sheet */}
      {editingSlot != null && data ? (
        <SlotEditorSheet
          date={date}
          slotIndex={editingSlot}
          slot={slotById.get(editingSlot) ?? null}
          categories={data.categories}
          stats={data.labelStats}
          onClose={() => setEditingSlot(null)}
        />
      ) : null}
    </div>
  );
}
