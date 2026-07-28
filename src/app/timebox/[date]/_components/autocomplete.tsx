"use client";

import { useEffect, useMemo, useRef, useState, forwardRef } from "react";
import { cn } from "@/lib/utils";
import {
  rankLabels,
  type LabelStat,
  type RankedSuggestion,
  type TimeboxCategory,
} from "@/lib/timebox-meta";

export type AutocompleteProps = {
  value: string;
  onChange: (v: string) => void;
  onSubmit: (v: string, categoryId: string | null) => void;
  placeholder?: string;
  stats: LabelStat[];
  categories: TimeboxCategory[];
  activeCategoryId?: string | null;
  currentSlotIndex?: number;
  autoFocus?: boolean;
  onEscape?: () => void;
  className?: string;
  inputClassName?: string;
  dropdownClassName?: string;
};

/**
 * Autocomplete input purpose-built for timebox label entry.
 *
 * Ranking (implemented in rankLabels — see src/lib/timebox-meta.ts):
 *   - Recent + frequent with decayed weight
 *   - Time-of-day: labels historically used near this slot score higher
 *   - Category-scoped: matching activeCategoryId boosts
 *   - Fuzzy substring; prefix hits rank above middle hits
 *
 * Keyboard:
 *   - ArrowUp / ArrowDown / Tab / Shift-Tab — navigate suggestions
 *   - Enter — submit current input OR the highlighted suggestion
 *   - Escape — close dropdown (fires onEscape if given)
 */
export const Autocomplete = forwardRef<HTMLInputElement, AutocompleteProps>(
  function Autocomplete(props, ref) {
    const {
      value,
      onChange,
      onSubmit,
      placeholder,
      stats,
      categories,
      activeCategoryId,
      currentSlotIndex,
      autoFocus,
      onEscape,
      className,
      inputClassName,
      dropdownClassName,
    } = props;

    const [open, setOpen] = useState(false);
    const [hi, setHi] = useState(-1);
    const catById = useMemo(
      () => new Map(categories.map((c) => [c.id, c])),
      [categories],
    );

    const suggestions = useMemo<RankedSuggestion[]>(() => {
      const ranked = rankLabels(stats, {
        q: value,
        activeCategoryId: activeCategoryId ?? null,
        currentSlotIndex,
        limit: 8,
      });
      return ranked;
    }, [stats, value, activeCategoryId, currentSlotIndex]);

    useEffect(() => {
      // Reset highlight when suggestions change.
      setHi(-1);
    }, [suggestions.length, value]);

    function submitWith(text: string, categoryId: string | null) {
      const trimmed = text.trim();
      if (trimmed.length === 0) return;
      onSubmit(trimmed, categoryId);
      onChange("");
      setOpen(false);
    }

    function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
      if (e.key === "Escape") {
        setOpen(false);
        onEscape?.();
        return;
      }
      if (!open) {
        // First arrow-down opens the dropdown even with no query.
        if (e.key === "ArrowDown" && suggestions.length > 0) {
          setOpen(true);
          setHi(0);
          e.preventDefault();
        }
        if (e.key === "Enter") {
          submitWith(value, activeCategoryId ?? null);
          e.preventDefault();
        }
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHi((i) => Math.min(suggestions.length - 1, i + 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHi((i) => Math.max(-1, i - 1));
      } else if (e.key === "Tab") {
        e.preventDefault();
        if (e.shiftKey) setHi((i) => Math.max(0, i - 1));
        else setHi((i) => Math.min(suggestions.length - 1, i + 1));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (hi >= 0 && suggestions[hi]) {
          const s = suggestions[hi];
          submitWith(s.label, s.categoryId ?? activeCategoryId ?? null);
        } else {
          submitWith(value, activeCategoryId ?? null);
        }
      }
    }

    return (
      <div className={cn("relative", className)}>
        <input
          ref={ref}
          type="text"
          value={value}
          placeholder={placeholder}
          autoFocus={autoFocus}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            // Delay to let a click on a suggestion fire before we close.
            window.setTimeout(() => setOpen(false), 120);
          }}
          onKeyDown={onKeyDown}
          className={cn(
            "w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm outline-none",
            "focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-colors",
            inputClassName,
          )}
        />
        {open && suggestions.length > 0 ? (
          <div
            className={cn(
              "absolute left-0 right-0 top-full z-40 mt-1 max-h-72 overflow-y-auto",
              "rounded-md border border-border bg-popover shadow-lg",
              dropdownClassName,
            )}
          >
            <ul>
              {suggestions.map((s, i) => {
                const cat = s.categoryId ? catById.get(s.categoryId) : null;
                return (
                  <li key={s.label + i}>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() =>
                        submitWith(s.label, s.categoryId ?? activeCategoryId ?? null)
                      }
                      onMouseEnter={() => setHi(i)}
                      className={cn(
                        "flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors",
                        i === hi ? "bg-muted/70" : "hover:bg-muted/40",
                      )}
                    >
                      <span className="flex-1 truncate">{s.label}</span>
                      {cat ? (
                        <span
                          className="inline-flex items-center gap-1 rounded-full px-2 py-px text-[10px]"
                          style={{
                            background: cat.color + "22",
                            color: cat.color,
                          }}
                        >
                          {cat.emoji ? <span>{cat.emoji}</span> : null}
                          {cat.name}
                        </span>
                      ) : (
                        <span className="text-[10px] text-muted-foreground italic">
                          no category
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
      </div>
    );
  },
);
