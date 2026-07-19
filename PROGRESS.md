# Progress log

Living state of the Habit_Log build. Updated at the end of each session. Stable conventions live in `AGENTS.md`; the long-form plan lives at `C:\Users\Admin\.claude\plans\hey-so-i-m-planning-graceful-hinton.md`.

---

## ✅ Day 1 — done

**Shipped:**
- Next.js 16.2.6 + React 19.2 + Tailwind v4 + shadcn (base-nova / `@base-ui/react`) + drizzle + libSQL scaffolded into `Habit_Log/`
- Dark-default calm theme (muted teal primary, warm amber accent), Lora serif for journal text
- Drizzle schema for all 8 tables → migration `0000_wet_ironclad.sql` applied to `local.db`
- `lib/dates.ts` with local-tz `YYYY-MM-DD` helpers
- `/journal/[date]` server component loads entry; `JournalForm` client component holds state, autosaves on 1.5s idle via `saveJournalEntry` Server Action (`onConflictDoUpdate` upsert)
- Date stepper with prev/next, future days disabled
- Bottom nav (Journal · Habits · Insights · Gym · More), `usePathname` highlighting, safe-area padding
- Stub `ComingSoon` pages for the four other sections

**Notable deviations from plan:**
- Scaffold pulled Next 16, not 15 (significant API differences). Documented in `AGENTS.md`.
- shadcn now defaults to `base-nova` style → uses `@base-ui/react`, NOT Radix. Slider's `onValueChange` value is `number | readonly number[]` — must handle both.
- Tailwind v4 means no `tailwind.config.ts`; theme config is `@theme` blocks in `src/app/globals.css`.

---

## ✅ Day 2 — done

**Shipped:**
- shadcn `dialog`, `dropdown-menu`, `switch` added
- `src/db/queries/habits.ts` — `getActiveHabits`, `getArchivedHabits`, plus a `getHabitsSnapshot(windowDays)` aggregate (3 parallel queries)
- `src/app/actions/habits.ts` — `createHabit`, `updateHabit`, `archiveHabit`, `unarchiveHabit`, `toggleHabitForDate`. Input-validated, all `revalidatePath("/habits")`
- `src/lib/habit-meta.ts` — `PRESET_COLORS` palette
- `/habits` page: empty state, **Today** quick-check (optimistic UI via `useOptimistic` + `startTransition`), **Last 30 days** CSS-grid heatmap, **Manage** card with edit/archive
- `AddHabitButton` + `HabitFormDialog`: name, emoji + 10 suggestions, 8 color swatches, sonner toasts

**Bug caught & fixed:** Initially exported `PRESET_COLORS` from a `'use server'` actions file. RSC wraps server-file exports as opaque references → client crashed. Moved constants to `src/lib/habit-meta.ts`. Added rule #6 to `AGENTS.md`.

---

## ✅ Day 3 — done

**Shipped:**
- Query helpers `src/db/queries/journal-questions.ts` and `journal-tasks.ts` (the latter exports `TASK_KINDS`, `TASK_KIND_LABELS`, `TASK_KIND_HINTS`, plus `ensureEntry(date)` so task inserts don't violate the FK)
- Server actions `src/app/actions/journal-questions.ts` (create/update/archive/unarchive) and `src/app/actions/journal-tasks.ts` (add/toggle/updateText/delete)
- Extended `saveJournalEntry` to accept an `answers` JSON map
- `/settings` page replaces ComingSoon with Daily questions card + Add/Edit/Archive
- `QuestionsBlock` on `/journal/[date]` renders dynamic inputs by question type (TextareaAutosize / Slider / Switch). Answers integrated into JournalForm's autosave with separate dirty flag
- `TasksBlock` on `/journal/[date]` — three Cards (Goals / Non-negotiables / Secondary) with inline `+ Add`, debounced text save (800ms), checkbox toggle, delete icon
- Bottom-nav fix: `/journal` (without a date) was 404'ing; added `src/app/journal/page.tsx` client redirect

**Bug caught & fixed:** Too-loose mapped type on the autosave pending ref widened all field values to a union. Switched to `type ScalarPatch = { [K in ScalarKey]?: JournalFormState[K] }`.

---

## ✅ Day 4 — done

**Shipped:**
- Switched chart lib from Tremor → **Recharts** (v3.8.1). Tailwind v4 + Tremor's safelist requirements were known headache; Recharts is purely React, smaller per-chart, plays nicely with React 19 / Next 16
- `src/db/queries/insights.ts` — single `getRangeData(rangeDays)` returns daily metrics (with null gaps), per-day completion %, per-habit totals, top-30 gratitude words
- `src/lib/streaks.ts` — pure `computeStreaks(dates)` returning `{ current, longest }`. Current allows yesterday-or-today as the anchor
- `/insights` page: reads `?range=7|30|90` from `searchParams`, defaults `30`. Streaks use **all** habit logs (not windowed)
- Components: `RangeToggle` (URL-based), `MoodEnergyChart` (LineChart, 3 series, connectNulls), `CompletionChart` (BarChart + per-habit progress bars), `StreaksGrid` (2-col cards w/ Flame icon), `WordCloud` (font-size + opacity scaled by count)
- All charts use CSS variables (`var(--border)`, `var(--chart-N)`) so they re-skin with the theme

---

## ✅ Day 5 — done

**Shipped:**
- shadcn `sheet` added (base-ui Dialog, bottom side for mobile)
- `src/lib/muscle-groups.ts` — 17-group enum + labels + front/back arrays + `INTENSITY_WEIGHT` ({light:1, medium:2, heavy:3.5}) + `SATURATION_BY_RANGE` ({week:12, month:36}) + `intensityToColor()` (warm off-white → deep red lerp) + picker chip colors
- `src/db/queries/gym.ts` — `getGymWindow(range)` returns `{ accum, recent, start, end }`
- `src/app/actions/gym.ts` — `createWorkout({ date, notes, durationMin, muscles })` + `deleteWorkout(id)`. Validated against the muscle/intensity enums
- `src/components/body-svg/body.tsx` — `BodySvg` with `view="front" | "back"` + `fillFor(muscle)` + optional `onMuscleClick`. Geometric primitive humanoid (head ellipse, torso path, arm/leg rounded rects) with named `<g id="chest">` etc. Each muscle group is keyboard-focusable when interactive
- `/gym` page: range toggle (week/month), heatmap card with body + front/back toggle + "top this {range}" sidebar (hidden on mobile), `LogWorkoutSheet` bottom sheet (cycle off → light → medium → heavy on tap, picked muscles as colored chips), recent workouts card with delete

**Cosmetic limitation:** geometric body is functional but blocky. Phase 2 (the real 3D avatar — see Later) is purely a visual swap; data and interaction model are independent.

---

## ✅ Day 6 — done

**Shipped (PWA, hand-rolled, no `next-pwa`):**
- `src/app/manifest.ts` returns `MetadataRoute.Manifest` (start_url `/journal`, standalone, dark theme color, lifestyle/productivity/health categories, 3 icon entries)
- `src/app/icon.tsx` — generates 512×512 PNG via `ImageResponse` from `next/og`. Dark teal gradient + serif "h" glyph
- `src/app/apple-icon.tsx` — same design at 180×180. Next 16 picks it up at `/apple-icon`
- `public/sw.js` — hand-rolled SW. Network-first for navigations, cache-first for `/_next/static`, `/icons`, `/icon`, `/apple-icon`. **`VERSION` const must be bumped on every deploy** or phones see stale shells
- Root layout adds `<Script id="register-sw" strategy="afterInteractive">` that registers `/sw.js` on https or localhost

**Verified:** `/manifest.webmanifest` is valid JSON, `/icon` and `/apple-icon` return real PNGs (12KB / 2.8KB), `/sw.js` returns 200 `application/javascript`

**To install on the phone:**
- Phone + computer same Wi-Fi → open `http://<your-IP>:3000/journal` (the IP `next dev` printed)
- iOS: Safari → Share → Add to Home Screen
- Android: Chrome → menu → Install app
- App opens standalone with the dark theme; icon is the rendered teal "h"
- **For full SW (offline) on phone, deploy to Vercel** — service workers don't activate over plain http on a remote IP

---

## ✅ Day 7 — done

**Shipped:**
- shadcn `skeleton` added
- `loading.tsx` for every route (root + `journal/[date]`, `habits`, `insights`, `gym`, `settings`), each matching its real layout — including the journal/habits 30-day grid skeleton with proper aspect-square cells
- `error.tsx` at the root — friendly serif card with the error message + "Try again" (`reset()`)
- `not-found.tsx` for the journal date route — "That date doesn't exist" + button back to today
- `README.md` rewritten — what's inside, stack, run locally, deploy to Vercel + Turso, schema-change workflow, conventions pointer to AGENTS.md, roadmap

**Verified (final pass — 17/17 routes return 200):**
- `/`, `/journal`, `/journal/[today]`, `/journal/not-a-date` (renders not-found gracefully)
- `/habits`, `/insights` × 3 ranges, `/gym` × 3 ranges, `/settings`
- `/manifest.webmanifest`, `/icon`, `/apple-icon`, `/sw.js`
- Type-check clean throughout

---

## ✅ Day 9 — DEPLOYED 🚀

**Live at: https://daily-journal-phi-vert.vercel.app**

**Shipped:**
- **Turso prod DB** created via web dashboard (region `aws-ap-south-1`, name `daily-journal`). Credentials saved to gitignored `.env.production.local`.
- Schema migrated to Turso prod via `npm run db:migrate` with prod env vars inline. Verified all 8 tables present.
- **Vercel CLI** installed via `npm i -g vercel`. Auth via `vercel login` (GitHub device-code flow → Satwik1703).
- Project linked to `satwik1703s-projects/daily-journal` on Vercel.
- Env vars `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` set on Production via `vercel env add ... --value ... --yes`.
- `vercel --prod --yes` deployed; 56s build, deploy READY.
- All 9 routes (incl. PWA artifacts) return 200 from the live URL.
- Live journal page verified to render DB data without errors (Turso connection working).

**Bug caught and fixed mid-deploy:**
- First `vercel env add` via `echo X | vercel env add` injected a UTF-8 BOM (PowerShell pipe behavior) → Vercel build failed with `URL_INVALID: '﻿libsql://...'`. Removed and re-added with `--value "..."` flag, which avoids the encoding issue. Worth remembering for any future PowerShell → CLI piping.

**Stable URLs:**
- Production: https://daily-journal-phi-vert.vercel.app (project alias, won't change)
- Latest deployment: https://daily-journal-ekpfrgvgf-satwik1703s-projects.vercel.app
- Vercel inspector: https://vercel.com/satwik1703s-projects/daily-journal

**To install on phone:**
- Open the live URL on phone
- iOS Safari: Share → Add to Home Screen
- Android Chrome: menu → Install app
- Service Worker activates on https → full offline support

**Future deploys:**
- Right now `vercel --prod --yes` from this folder = redeploy
- For auto-deploy on `git push`, connect the GitHub repo in the Vercel project settings: vercel.com → daily-journal → Settings → Git → Connect repository → Satwik1703/daily-journal

---

## ✅ Day 8 — repo + deploy-readiness fixes

**Shipped:**
- **GitHub repo created**: https://github.com/Satwik1703/daily-journal (public, `main` branch). All 7 days' work in initial commit `008ac9d`.
- **Bug fix from earlier (libSQL)**: forced `@libsql/client/node` import (the default was resolving to the web entry under Turbopack, rejecting `file:` URLs). Moved task-related runtime constants (`TASK_KINDS`, `TASK_KIND_LABELS`, `TASK_KIND_HINTS`) from `db/queries/journal-tasks.ts` to `lib/task-meta.ts` so client components can't drag the DB client into the browser bundle. Added `serverExternalPackages: ["libsql", "@libsql/client"]` to `next.config.ts`. Added rule #7 to `AGENTS.md`.
- **Production build (`npm run build`)** runs clean.
- **Caught at build time**: `/habits` and `/settings` were being prerendered as static (`○`) because they don't read `searchParams`/`cookies`. The Vercel build would have frozen the build-time DB snapshot for those pages until a `revalidatePath` fired. Added `export const dynamic = "force-dynamic"` to both. Now: `ƒ /gym, ƒ /habits, ƒ /insights, ƒ /journal/[date], ƒ /settings` — all data routes server-render on demand.
- **Lint pass**: 4 errors → 0 errors. Real fix: `journal-form.tsx` was assigning `stateRef.current = state` during render (anti-pattern); moved to a `useEffect`. Stylistic: demoted `react-hooks/set-state-in-effect` to `warn` in `eslint.config.mjs` (the 3 remaining warnings are intentional state-sync from server-revalidated props in dialogs and task rows). Removed unused imports in `db/queries/{gym,insights}.ts`.

**State of the repo:**
- 1 commit, `main` branch, pushed
- `local.db`, `.env.local`, `node_modules`, `.next`, build/dev/lint logs all gitignored
- Type-check ✓, lint ✓, build ✓ (prod-clean)

**Resume here for Day 9: Deploy to Vercel + Turso**

---

## ✅ Phase 2 · Day A — calendar + status palette foundation

Plan: `C:\Users\Admin\.claude\plans\hey-now-let-s-go-sequential-jellyfish.md`. Phase A is foundation only — nothing visible in the running app yet; pieces wire in during Phase B.

**Shipped:**
- `src/lib/journal-status.ts` — `JournalStatus` union, `STATUS_META`, `STATUS_ORDER`, `statusBg(status)`. Two computation functions:
  - `computeJournalStatus({ nonNegTotal, nonNegDone, goalsDone, secondaryDone, hasEntry })` — implements the user's exact rules (sum is completed-only).
  - `computeHabitsStatus(doneCount, hadActiveHabits)` — raw count: ≥5 crazy, =4 great, =3 good, 1-2 avg, 0 bad, no-active-habits empty.
- `src/app/globals.css` — added `--status-crazy/great/good/avg/bad/empty` OKLCH vars in both `:root` and `.dark` (dark variant slightly brighter for contrast on the deep-teal background). Matching `--color-status-*` mappings in `@theme inline` so `bg-status-crazy` etc. work as Tailwind classes.
- `src/components/ui/calendar.tsx` — pure month-grid primitive. Sun-start, 6-row 42-cell matrix. Props: `month`, `selected`, `onSelect`, `cellRenderer`, `disableFuture`, `onPrevMonth`, `onNextMonth`. Today gets a primary ring, selected gets a foreground ring. Future days dimmed + disabled. Helpers exported: `monthKeyOf`, `firstOfMonth`, `shiftMonth`, `monthMatrix`.
- `src/components/date-picker-popover.tsx` — base-ui `Popover` wrapper around `Calendar`. Accepts `fetchMonthStatus(monthAnchor) => Promise<Record<DateString, JournalStatus>>`; loads lazily on open + on month nav, memoizes via `loadedMonthsRef` (a `Set<monthKey>` so flipping months doesn't refetch). Legend footer renders 5 swatches with labels. Future-disable cap also caps month navigation so user can't browse into next month.

**Notes:**
- Base-ui `Popover.Trigger` renders a native `<button>` by default — children are placed inside. No `render` callback needed (different from Menu where we used `render={<Button … />}`).
- The `useEffect` that syncs `month` state to the latest `selected` prop produces one `react-hooks/set-state-in-effect` warning. This is the same intentional state-sync exemption mentioned for Day 8 (3 existing warnings of the same kind). Acceptable.
- `tsc --noEmit` clean. Lint: 0 errors, 1 warning (above).

**Resume here for Phase B:** journal calendar wiring — `src/db/queries/journal-month.ts`, `src/app/actions/journal-month.ts`, rewire `date-stepper.tsx` to open `DatePickerPopover` driven by `fetchJournalMonthStatus`.

---

## ✅ Phase 2 · Day B — journal calendar wiring

**Shipped:**
- `src/db/queries/journal-month.ts` — `getJournalMonthStatus(start, end)` returning `Record<DateString, JournalStatus>`. Two SQL queries in parallel: dates with any `journal_entries` row, plus `journal_tasks` in range. Tasks aggregate per-date into `{ nonNegTotal, nonNegDone, goalsDone, secondaryDone }`. Status computed via the shared `computeJournalStatus`. Dates with neither entry nor tasks are omitted (callers treat as `empty`).
- `src/app/actions/journal-month.ts` — `fetchJournalMonthStatus(monthAnchor)` server action. Range is widened by ±7 days around the month so the popover's 6-row grid (which spills into adjacent months) stays correctly colored as the user pages.
- `src/app/journal/[date]/_components/date-stepper.tsx` — the center date label is now a `DatePickerPopover` trigger. Tapping it opens the calendar with status colors, current date highlighted, today ringed in primary, future days disabled. Picking a day calls `router.push('/journal/{date}')`. Sub-label flips between "Today" and "Tap to jump". Chevron-down icon next to the date as affordance.

**Refactor:**
- Pure date helpers `monthKeyOf`, `firstOfMonth`, `shiftMonth`, `monthMatrix` moved from `src/components/ui/calendar.tsx` (a `"use client"` module) into `src/lib/dates.ts`. This keeps them server-safe so the server action can import them without dragging React into a server module — same pattern as rule #7 in AGENTS.md for the DB client. `calendar.tsx` re-uses the lib helpers; `date-picker-popover.tsx` and `journal-month` action import directly from `@/lib/dates`.

**Verification:**
- `tsc --noEmit` clean.
- `eslint` clean (1 expected `react-hooks/set-state-in-effect` warning on the intentional `month`-sync effect, same exemption pattern documented for Day 8).
- `next build` clean: all 10 routes still build, `/journal/[date]` continues to render dynamically.

**Resume here for Phase C:** Identity Reminders + journal section grouping. Schema migration adds `identity_1..5` columns to `journal_entries`; reorder `TASK_KINDS` to `[nonNegotiable, goal, secondary]`; add Identity card after Gratitude with 5 inputs and the default placeholders from the plan; introduce `<GroupBreak />` and reorganize `journal-form.tsx` into Mindset / Today's intent / Reflection groups (Tomorrow stays at the bottom).

---

## ✅ Phase 2 · Day C — Identity Reminders + journal grouping

**Shipped:**
- **Schema migration** `drizzle/migrations/0001_low_leo.sql` — adds `identity_1..5` (nullable text) to `journal_entries`. Applied to local `local.db` via `npm run db:migrate`. **Prod still pending** — re-run `npm run db:migrate` with prod Turso env vars before/after the next deploy (same procedure as Day 9).
- `src/db/schema.ts` — five `identityN` columns added next to gratitude.
- `src/app/actions/journal.ts` — `JournalPatch` type extended with `identity1..5?: string | null`. `clean()` handles them automatically; no other change to `saveJournalEntry`.
- `src/app/journal/[date]/page.tsx` — passes the persisted identity values into `JournalForm.initial`.
- `src/app/journal/[date]/_components/journal-form.tsx`:
  - `JournalFormState` extended with `identity1..5`.
  - `IDENTITY_PLACEHOLDERS` constant — 5 default suggestions ("I am the kind of person who…") that fade out as the user types. User can swap them later by editing this constant.
  - New **Identity Reminders** card (5 `TextareaAutosize` inputs, same styling as Gratitude). Wired through `updateScalar` so it goes through the existing 1.5s autosave path. Save indicator already covers it.
  - Sections reorganized into 3 groups separated by `<GroupBreak />` (thin hairline + small uppercase label):
    - **Mindset** — Gratitude, Identity Reminders
    - **Today's intent** — tasksBlock (Non-negotiables → Goals → Todos)
    - **Reflection** — How was today (scales), Daily questions
  - Tomorrow stays at the very bottom, ungrouped (it's about the next day).
  - Fixed a typo while in there: "I'm greatful for ..." → "I'm grateful for ...".
- `src/lib/task-meta.ts` — `TASK_KINDS` order changed from `[goal, nonNegotiable, secondary]` to `[nonNegotiable, goal, secondary]`. `TasksBlock` iterates this constant directly, so the card order on the page updates without any other change.

**Verification:**
- `tsc --noEmit` clean.
- `eslint` clean (the single pre-existing `set-state-in-effect` warning on `date-picker-popover.tsx` is the only one).
- `next build` clean — all 10 routes still build, `/journal/[date]` still dynamic.

**Resume here for Phase D:** Habits route `/habits/[date]` + habits calendar. Generalize `getHabitsSnapshot({ anchor, windowDays })`, redirect `/habits` → `/habits/{today}`, build the new page, add the habits-month query + action, mirror the calendar popover, lock `AddHabitButton` off-today, filter habits by `createdAt <= anchor`.

---

## ✅ Phase 2 · Day D — Habits route `/habits/[date]` + habits calendar

**Shipped:**
- **Generalized snapshot.** `getHabitsSnapshot({ anchor?, windowDays? })` defaults to today/7. Return type fields: `anchor` (the date the page is centered on), `today`, `doneOnAnchorIds` (renamed from `doneTodayIds`), plus the existing `active/archived/windowLogs/windowDates`. Default window dropped from 30 to 7 to match the new design.
- **/habits → redirect.** `src/app/habits/page.tsx` is now a client redirect to `/habits/{today}`, mirroring `/journal`. The old static `/habits` route is now a static redirect; the real work lives in `[date]`.
- **/habits/[date] page.** Server component:
  - Validates date, `today` alias redirects to `/habits/{todayLocal()}`, invalid → `notFound()`.
  - Loads `getHabitsSnapshot({ anchor: date, windowDays: 7 })`.
  - **Filters active habits by `createdAt <= date`** — habits don't show up on dates before they were created. (User asked for this: newly added habits should be visible only from the day they got added.)
  - Renders `<HabitsDateStepper>`, the title block (date subtitle says "backfilling" off-today), `AddHabitButton` (disabled prop when off-today), then `TodayToggles` + `HabitGrid` + `HabitList`.
  - Empty state has two copies: "No habits yet" on today vs "No habits existed on this date" on past dates.
- **Habits month status.**
  - `src/db/queries/habits-month.ts` — `getHabitsMonthStatus(start, end)`. Computes daily completed count + whether any habit was *active that day* (i.e. `createdAt <= date && (archivedAt is null OR archivedAt > date)`). Status via shared `computeHabitsStatus`. Iterates every day in range so the calendar can distinguish "bad" (had habits, did nothing) vs "empty" (no habits existed yet).
  - `src/app/actions/habits-month.ts` — `fetchHabitsMonthStatus(monthAnchor)` widened by ±7 days to cover the calendar's leading/trailing days.
- **`<HabitsDateStepper>`** — same shape as the journal stepper but pushes to `/habits/{date}` and feeds the habits status fetcher into `DatePickerPopover`.
- **`<TodayToggles>` neutral wording.** Now takes `{ anchor, isToday, habits, doneIds }`. Card title flips between "Today" and "That day"; shows a "Backfilling" chip off-today. Tapping a habit still calls `toggleHabitForDate(habit.id, anchor)` — the action already accepts a date, so no action change.
- **`<HabitGrid>` enhancements (also covers Phase E start).**
  - Optional `anchor` prop drives the "ring" cell (defaults to today). Used on the dated page to highlight the selected date inside the 7-day strip.
  - Habit name column: `truncate` removed; now `whitespace-normal break-words leading-tight`, width bumped to `w-[100px]`, rows aligned `items-start` so long names wrap cleanly instead of ellipsing. Header offset bumped to `pl-[108px]` to compensate.
- **`<AddHabitButton>`** — accepts `disabled?: boolean`. Disabled state shows `opacity-50` + a tooltip "Adding habits is locked on past dates".
- **`loading.tsx`** updated to draw 7 skeleton cells (was 30) so the flash matches the new layout.

**Verification:**
- `tsc --noEmit` clean.
- `next build` clean. New route `ƒ /habits/[date]` (dynamic). Old `/habits` is now static (just the redirect).

**Resume here for Phase E:** the habit-grid wrap is already in — Phase E remaining work is the **Insights habit timeline card** with configurable 7 / 15 / 30 / 90 ranges, plus PWA `VERSION` bump in `public/sw.js` and any last visual polish.

---

## ✅ Phase 2 · Day E — Insights habit timeline + PWA bump

**Shipped:**
- `src/app/insights/page.tsx`:
  - `RANGES` extended from `[7, 30, 90]` to `[7, 15, 30, 90]`. The existing `RangeToggle` picks up the new option automatically (renders "15d").
  - Loads `getHabitsSnapshot({ windowDays: range })` server-side and renders the shared `<HabitGrid />` underneath the **Habit completion** card. Same component as `/habits/[date]` for visual consistency — text wrapping, anchor ring, and all. Same `createdAt <= anchor` filter so habits don't appear in days before they existed.
- `public/sw.js` — bumped `VERSION` from `habit-log-v1` → `habit-log-v2`. Installed phones will pull fresh shells on next activation. (Reminder: bump again on each deploy.)
- Habit-grid wrap + 7-day default were already in as part of Phase D — no separate work needed here.

**Verification:**
- `tsc --noEmit` clean.
- `eslint src/` → 0 errors. 4 warnings total: 1 new (date-picker-popover's intentional `month`-sync effect, same exemption as the existing 3 in `journal-form.tsx` and `questions-manager.tsx`).
- `next build` clean. All 11 routes build, `/insights` is dynamic, `/habits` static (redirect only), `/habits/[date]` dynamic.

---

## ✅ Phase 2 · Day F — feedback polish pass

User-driven follow-ups after Day E:

**Shipped:**
- **Typewriter placeholder on Identity Reminders.** New `IdentityInput` component in `journal-form.tsx`. Instead of native HTML placeholder (which disappears on first keystroke), the input renders a transparent overlay containing the typed prefix (`invisible` class) followed by the remaining placeholder characters in muted color. As the user types, the ghost suffix shrinks letter-by-letter, like a writing prompt being eaten by the cursor. Wraps and font/leading mirror the textarea exactly so the ghost lines up with the real text. Border + focus ring moved to the outer container so the layered structure behaves as one input.
- **Tomorrow in its own group.** New section "Looking ahead" with the card now titled **"Set tomorrow up"** (was "Tomorrow"). Sits below Reflection as a 4th group.
- **Future dates blank in calendar popovers.** `DatePickerPopover.cellRenderer` returns `null` for any date `> todayLocal()` — no status fill on future cells (still disabled + dimmed by the calendar primitive). Applies to both the journal and habits popovers.
- **Habit grid cell size fixed.** `gridTemplateColumns` switched from `repeat(N, minmax(0, 1fr))` to `repeat(N, 1.75rem)` in both the header row and per-habit rows. Cells now size identically regardless of window length (7d on `/habits/[date]`, 15/30/90d on `/insights`).
- **Habit grid tooltip.** New `formatShortDate(s)` helper in `src/lib/dates.ts` returning `"Mar 04"` style. The cell `title` is now `{habit.name} — {Mar 04}{ ✓}`.

**Verification:**
- `tsc --noEmit` clean.
- `next build` clean — 11 routes.

---

## ✅ Phase 2 · Day F.1 — revert fixed cell size, switch habits window to 15

- **Reverted** the fixed `1.75rem` cell width from Day F. `HabitGrid` is back to `gridTemplateColumns: repeat(N, minmax(0, 1fr))` on both the header row and per-habit rows, with `flex-1` restored on the cell grid. Cells fill the full row width again.
- **`/habits/[date]` window: 7 → 15 days.** `page.tsx` calls `getHabitsSnapshot({ anchor: date, windowDays: 15 })`. Skeleton in `loading.tsx` matches (15 cells). `HabitGrid` title text reads "Last 15 days" automatically (it uses `windowDates.length`).
- `tsc --noEmit` clean.

---

## 🎯 Phase 2 — feature complete

Five-phase rollout done. The app now has:
- A **calendar popover** on the journal and habits date bars with day-by-day status colors (Crazy/Great/Good/Avg/Bad/empty palette via shared CSS vars).
- **Identity Reminders** — 5 affirmation slots persisted in `journal_entries` next to gratitude.
- **Section grouping** on the journal page (Mindset / Today's intent / Reflection / Tomorrow).
- **Past-date logging** for habits via `/habits/[date]`, with the new-habit button locked off-today and habits hidden from days before they were created.
- **7-day rolling grid** (was 30) with proper text wrapping for long habit names.
- A **configurable habit timeline** on Insights (7 / 15 / 30 / 90 days).

**To deploy:**
1. `npm run db:migrate` against the prod Turso URL (apply migration `0001_low_leo.sql`).
2. `vercel --prod --yes` from this folder (or auto-deploy if GitHub is connected).

---

## 🎉 Build complete

All 7 days of the original plan are shipped. The app at `d:\sathw\Experiments\Habit_Log` is fully usable end-to-end:
- Daily journal with autosave, dynamic questions, three task lists
- Habit tracker with today's quick-check, 30-day grid, manage flow
- Insights dashboard with trends, completion %, streaks, gratitude themes
- Gym tracker with logging sheet + 2D body heatmap (front + back)
- Settings page for journal questions
- Installable as a PWA on phone

---

## 🔮 Later (deferred features, no fixed order)

- **3D avatar (Phase 2 of the gym heatmap)** — swap the geometric `BodySvg` for a real anatomical 3D model. Plan was Z-Anatomy → Blender prep (decimate to ~80K tris total, group meshes per `MUSCLE_GROUPS`) → GLB with Draco compression → R3F + drei in `src/features/avatar/Avatar3D.tsx`. The data model & `intensityToColor()` are already wired and avatar-agnostic, so this is purely a visual swap.
- **AI reflections** — weekly/monthly summaries generated by Claude API. Store in `settings` (or a new `reflections` table). Anthropic API key in env. ~few cents/month.
- **Export / backup** — `/api/export` route handler streaming a JSON dump of every table; an Import action that replays it.
- **Search** — full-text search across gratitude + tomorrow + journal answers (`fts5` virtual table in libSQL).
- **Reorder UX for tasks/habits/questions** — drag-and-drop using the `position` column that's already in every table.
- **Calendar/heatmap view of the journal** — see months at a glance with mood-tinted cells.

---

## ✅ Phase 3 · Day A — Pomodoro tab + insights

Plan: `C:\Users\Admin\.claude\plans\okay-so-now-let-s-woolly-kahan.md`.

**Shipped:**
- **Schema migration `0002_chubby_nomad.sql`** — adds `pomodoro_categories` (id/name/emoji/color/position/archivedAt/createdAt) and `pomodoro_sessions` (id/date/startedAt/endedAt/durationMin/plannedMin/categoryId FK/description/source enum `timer|manual|partial`). Applied locally via `npm run db:migrate`. **Prod still pending — run `npm run db:migrate` against prod Turso env before next deploy.**
- **Lib files (DB-free, client-safe):**
  - `src/lib/pomodoro-meta.ts` — `POMO_DURATIONS` (50m=full, 30m=half), `pomoUnits()`, `fmtPomos()`, `fmtMinutes()`, `formatTimeSpan()`, `formatClock()`, `SOUND_OPTIONS` (bell/chime/digital/birds), `DEFAULT_CATEGORIES` (6 seeds).
  - `src/lib/pomodoro-status.ts` — `computePomodoroStatus({pomos, hadAny})` returning shared `JournalStatus` palette (crazy ≥6 / great =5 / good 3-4 / avg 1-2 / bad =0 / empty).
  - `src/lib/pomodoro-audio.ts` — **Web Audio synth** (no mp3 assets) with 4 sound profiles. Reliable, offline, no licensing. `primeAudio()` runs on Start tap to satisfy iOS gesture requirement.
- **Queries:**
  - `src/db/queries/pomodoro-categories.ts` — `getActiveCategories/getArchivedCategories/getAllCategories`, auto-seeds 6 defaults on first read when table is empty.
  - `src/db/queries/pomodoro.ts` — `getPomodoroDay(date)` (sessions + per-category agg + hourMinutes[24]), `getPomodoroWindow(range)` (daily rows + totals + topCategories + hourHistogram + longestSession), `getPomodoroMonthStatus(start, end)`, `getAllSessionDates()` for streaks.
  - `src/db/queries/settings.ts` — `getKv()`, `getPomodoroSoundId()`.
- **Server actions:**
  - `src/app/actions/pomodoro.ts` — `createSession({...source})`, `updateSession`, `deleteSession`.
  - `src/app/actions/pomodoro-categories.ts` — full CRUD.
  - `src/app/actions/pomodoro-month.ts` — `fetchPomodoroMonthStatus(monthAnchor)` widening ±7d (same pattern as journal/habits).
  - `src/app/actions/settings.ts` — `setPomodoroSound(soundId)` with onConflictDoUpdate.
- **Routes:**
  - `/pomodoro` → client redirect to `/pomodoro/{today}`.
  - `/pomodoro/[date]` → server component, dynamic. Loads categories + today + yesterday + soundId in parallel.
  - `/more` → menu hub listing Gym + Settings cards (lucide Menu icon).
  - `+ loading.tsx` for both pomodoro routes.
- **Components (`/pomodoro/[date]/_components/`):**
  - `timer-panel.tsx` — orchestrator. State machine `idle → running ↔ paused → completed`. `localStorage.pomodoro.activeSession` persistence + wall-clock recompute on mount (refresh-safe). Circular SVG sweep + tabular MM:SS + `animate-pulse-soft`. Stop dialog (Save partial / Discard / Cancel). Completion auto-saves to DB via `createSession`, plays 5s chime, opens description dialog (Skip or Save → `updateSession`). Category picker disables while running. Duration toggle (50/30) hidden while active.
  - `time-span-bar.tsx` — horizontal progress bar over wall-clock window, computes per-half-hour tick marks with major (`:00`) labels (`5 PM`) and minor (`:30`) labels. "Now" marker.
  - `category-picker.tsx` — horizontal chip row with active chip ring + tint from category color.
  - `manual-session-dialog.tsx` — date+time+duration+category+description form, calls `createSession({source:"manual"})`.
  - `day-stats-card.tsx` — Today vs Yesterday top metrics + delta arrow, per-category bars with category colors, 24-bar hourly strip with hour labels.
  - `session-list.tsx` — colored category puck + source badge (timer/partial/manual) + time-span + duration + description, trailing delete with confirm dialog.
  - `pomodoro-date-stepper.tsx` — mirrors journal/habits stepper with `DatePickerPopover` driven by `fetchPomodoroMonthStatus`.
- **Bottom nav** — replaced Gym slot with Pomodoro (lucide `Timer`); old Settings tab becomes a real `/more` route (`Menu` icon). Final order: Journal · Habits · Pomodoro · Insights · More.
- **Insights additions** (`/insights` page):
  - "Focus" section appended after Gratitude themes.
  - **Focus minutes per day** Recharts BarChart + total pomos / focus time / focus streak (days with ≥1 pomo, reuses `computeStreaks`).
  - **Top categories** horizontal bar list (capped 6).
  - **Best time of day** 24-bar hour histogram across full range.
  - **Focus heatmap** month-grid blocks (Sun-start, 6-row) per month in range, status palette via `computePomodoroStatus` + `statusBg`. Server-side rendered.
- **Settings additions:**
  - `PomodoroCategoriesManager` — list + add/edit/archive/unarchive via DropdownMenu pattern. Mirrors `HabitList` exactly. Inline `CategoryFormDialog` with emoji suggestions + `PRESET_COLORS` swatches.
  - `SoundPicker` — radio-style cards with Preview button per option (2.5s synth preview). Persists via `setPomodoroSound`.
- **Globals:** new `--animate-pulse-soft` 1.6s ease-in-out keyframe utility for the breathing timer digits.
- **PWA `VERSION` bumped `v2 → v3`** and SHELL updated to include `/pomodoro` + `/more`.

**Decisions / behaviors:**
- Categories are user-managed (CRUD) seeded with Work/Study/Read/Exercise/Creative/Other.
- Pomo unit: 50min=1.0 pomo, 30min=0.6 pomo, 25min=0.5 pomo (`durationMin/50`). UI shows both pomos and minutes.
- Stop dialog asks every time (Save partial / Discard).
- Sound: 4 synthesized profiles (no mp3 files needed) — bell (sine bell), chime (C-E-G triad), digital (square pulse), birds (FM chirp). Persisted via `settings` KV key `pomodoro_sound`.
- Backgrounding: wall-clock from `Date.now() - startedAt - pausedMs - (paused ? Date.now()-pauseStartedAt : 0)`. Refresh/close/lock all resume correctly; if elapsed ≥ planned on mount, completion fires immediately + saves to DB + plays chime.

**Verification (all green):**
- Migration applied; `node scripts/check-pomo.mjs` confirms both tables + 6 seeded categories present.
- `tsc --noEmit` clean.
- `npm run lint` → 0 errors, 7 warnings (all `react-hooks/set-state-in-effect` — same accepted exemption documented for Day 8 + Day A).
- `npm run build` clean. 13 routes total. New: `/pomodoro` (○ static redirect), `/pomodoro/[date]` (ƒ dynamic), `/more` (○ static).
- Routes probed at `http://localhost:3000`: `/pomodoro` 200, `/pomodoro/{today}` 200 (rendering timer/category/manual keys), `/more` 200, `/settings` 200, `/insights?range=30` 200 (Focus section present).

**Resume here for Phase 3 · Day B:** user said this is the first of several Phase 3 features. Next feature TBD — wait for user direction.

---

## ✅ Phase 3 · Day A.1 — pomodoro polish + bug-fix pass

User-driven follow-ups after Day A:

**Shipped:**
- **Manual session dialog overflow fixed.** Inputs and the category chip row were bleeding past the popup on narrow viewports. Added `min-w-0 w-full max-w-full` on the form, every `Input` / `Textarea`, the chip wrapper, and the date+time grid. Switched the two-column row from `grid-cols-2` to explicit `grid-cols-[1fr_1fr]` with `min-w-0` on each cell so native `<input type=date>` / `<input type=time>` controls can shrink instead of pushing the popup wider than its max-width.
- **Insights range threading hardened.** All Focus-section cards were already keyed off the `range` searchParam (`getPomodoroWindow(range)` etc.), but added `export const dynamic = "force-dynamic"` on `/insights/page.tsx` as belt-and-suspenders so toggle changes always re-render — matches the dynamic flag already on `/habits`, `/settings`, `/gym`, and `/pomodoro/[date]`.
- **Focus heatmap palette aligned with the calendar.** `src/app/insights/_components/focus-month-grid.tsx` rewritten so every cell (in-range, out-of-range, future, empty, filled) uses `statusBg(status)` only — dropped the `var(--muted)` fallback. Today gets the same `ring-1 ring-primary/70` as the popover calendar primitive. Cell colors and legend swatches now share one source of truth: edits to `--status-*` CSS vars in `globals.css` propagate to all calendars and the heatmap together.
- **Calendar / legend opacity mismatch fixed.** `date-picker-popover.tsx` cell renderer was using `opacity-85` on filled cells while the legend swatches rendered at full opacity, so the two never matched visually. Dropped the `opacity-85` — filled cells now match legend swatches exactly.
- **Focus trend chart added** to the Insights Focus section, inserted **before** Top categories. New component `src/app/insights/_components/focus-trend-chart.tsx` — Recharts `AreaChart` with linearGradient fill, configurable category (chip row including an "All" chip and every active category with its own color/emoji), and a minutes/pomos unit toggle. Server-side: serializes the per-day `Map<string, DayCategoryAgg>` into a plain array per day (RSC can't serialize Maps) before passing to the client; client filters and renders without re-fetching. `getActiveCategories()` is now loaded in parallel with `getPomodoroWindow()` and `getAllSessionDates()` on the insights page.
- **Timer animations actually visible now.** The previous round added the keyframes + utility classes, but two bugs hid them:
  1. SVG `<g>` rotations used `transform-origin: center` without `transform-box: fill-box` — browsers defaulted to (0, 0) of the SVG viewport, so the rings spun in arcs off-canvas. Added `transform-box: fill-box` to every orbit / ring-wave / radial-pulse utility class in `globals.css`, plus inline `style={{ transformOrigin: "120px 120px", transformBox: "fill-box" }}` on each rotating `<g>` for extra robustness across engines.
  2. Most ambient animations (rotating rings, breathing backdrop, orbit particles) were gated on `phase === "running"`, so the idle state looked like a plain clock face. Ungated the ambient layers so they move all the time — only the per-second tick-bump, per-minute flash, per-minute ring-wave, and the lead-pip glow are still phase-gated.
  - Visibility bumped too: ring stroke-opacities raised 0.18 → 0.55, particles 1.5px → 3px at opacity 0.9, added a `glow-strong` SVG filter, ten orbiting sparks + six counter-rotating accent sparks each twinkling with staggered delay, perpetual `ring-wave-loop` (3.2 s), drift on the "Focusing" label.
- **`globals.css`** gained `ring-wave-loop`, `spark-twinkle`, and beefed-up keyframes; also adjusted `minute-flash` to include `drop-shadow(0 0 14px var(--primary))` and a 1.05 scale.
- **`.gitignore`** now includes `dev.err.log` alongside the other dev logs.

**Decisions / notes:**
- Web Audio synth still the sound source — no mp3 assets needed. Sound preview button in Settings primes the audio context (iOS gesture requirement).
- Dark-variant `--status-*` palette was unified with the light variant in `globals.css` (user-edited): both modes now use the same OKLCH values for crazy / great / good / avg / bad / empty so calendars look identical across themes. Comments in the file still say "dark variant — slightly brighter", but the values intentionally match light.

**Verification:**
- `tsc --noEmit` clean.
- `npm run lint` → 0 errors, 9 warnings (all `react-hooks/set-state-in-effect` — same accepted exemption pattern documented for Day 8).
- Routes probed: `/pomodoro/{today}` 200 (animation classes verified in rendered DOM), `/insights?range=7` 200 (Focus trend chart present), `/insights?range=90` 200, `/settings` 200.

**Resume here for Phase 3 · Day B:** still waiting on user direction for the next Phase 3 feature.

---

## ✅ Phase 3 · Day A.2 — git history hygiene + prod deploy + repo cleanup

End-of-session housekeeping. No app behavior changes.

**Shipped:**
- **Phase 2 commit amended** to drop the `Co-Authored-By: Claude` trailer. SHA changed `5866480` → `ee4a149`. Force-pushed to `origin/main` with `--force-with-lease`. Sole author across history is now `Satwik1703 <sathwikgaddam@gmail.com>`. **User preference: never append `Co-Authored-By: Claude …` to commits** — saved to auto-memory at `C:\Users\Admin\.claude\projects\d--sathw-Experiments\memory\feedback_no_claude_coauthor.md`. Default for every future commit on this repo.
- **Phase 3 commit** `a6c9c9e` (`phase 3 - pomodoro timer`), 46 files / +4648 / -55. Pushed to `origin/main`. No co-author trailer.
- **Prod migration applied.** `npm run db:migrate` against Turso (`daily-journal-satwik1703.aws-ap-south-1.turso.io`) loaded env vars from `.env.production.local` via PowerShell foreach + regex parser. `0002_chubby_nomad.sql` applied. `0000` + `0001` were already there from earlier deploys.
- **Prod deployed** via `vercel --prod --yes`. Live at https://daily-journal-phi-vert.vercel.app. Inspect: https://vercel.com/satwik1703s-projects/daily-journal/6c1eUkcTjP4fkyHKaDwxUe6ZWsVe. Probed `/`, `/pomodoro`, `/pomodoro/{today}`, `/more`, `/insights?range=30` — all 200.
- **Repo cleanup** commit `ed86b76`:
  - Deleted unused Next.js scaffold svgs (`public/{file,globe,next,vercel,window}.svg`) — zero references in `src/`.
  - Deleted `src/components/coming-soon.tsx` — Phase 1 placeholder, all routes are built out.
  - `.gitignore` adds `.vscode/` and `.idea/` (IDE config stays local). User keeps their own `.vscode/settings.json` with project search excludes.
  - `.gitignore` also adds `dev.err.log` to the existing log block.
  - Tracked file count `141 → 135`. `tsc --noEmit` clean, `npm run build` clean (13 routes).

**State at session end:**
- Working tree clean — `git status --short` empty.
- Local + remote `main` both at `ed86b76`. Linear history `ed86b76 → a6c9c9e → ee4a149 → 9929c2d → 9c0e7c6 → 008ac9d`.
- Prod DB schema includes all 10 tables (incl. `pomodoro_categories` + `pomodoro_sessions`).
- Live URL serves Pomodoro tab with seeded categories, animated timer, focus insights.
- Dev server stopped at end of session.

**GitHub contributors graph caveat:** Claude may still appear briefly on the Contributors page (https://github.com/Satwik1703/daily-journal/graphs/contributors) due to GitHub's lazy cache rebuild. No trailers remain in history; will drop off automatically. Initial commit `008ac9d` body still mentions "Built day-by-day with Claude Code" as plain text — does NOT affect contributors graph; left as-is.

**Resume here for next session:**
- App is feature-complete through Phase 3 · Day A (Pomodoro tab). User said this was "the first of several Phase 3 features" — waiting on direction for Day B / next feature.
- If next feature touches schema: `npm run db:generate` → commit migration → after merge, `npm run db:migrate` with prod env (PowerShell parser pattern above works) → `vercel --prod --yes`.
- If next feature touches PWA shell: bump `VERSION` in `public/sw.js` (current `habit-log-v3`) and update the `SHELL` array.
- Auto-memory now contains the no-co-author rule; future commits / amends on this repo will not include the trailer by default.

---

## ✅ Phase 4 · Part 1 — CSS polish + new app icon

User-reported issues from the installed PWA:

**Shipped:**
- **Identity Reminders placeholder overflow (mobile) fixed.** Previous `IdentityInput` used `TextareaAutosize` with an `absolute inset-0` ghost overlay. On narrow viewports the multi-line placeholder text wrapped to 2+ lines while the textarea remained sized to its (empty) value — the ghost text bled past the bottom border. Replaced with a CSS-grid sizing-twin pattern: a hidden mirror element (`invisible`, `whitespace-pre-wrap break-words`) sits in `col-start-1 row-start-1` and contains `value || placeholder`, so the container always grows to fit the longer of the two. Native `<textarea>` and the ghost overlay share the same grid cell. No more overflow regardless of placeholder length or viewport width. (See `src/app/journal/[date]/_components/journal-form.tsx:229-261`.)
- **App icon redesigned.** Old icon was a serif letter "h" — looked weak on home screens. New mark is a 4-layer concentric composition: outer teal ring (`#4fa896`), mid lighter teal ring (`#7fc7b9`), inner amber ring (`#e0a96d`), amber filled center dot (`#f3c987`) on a dark-teal radial gradient. Reads as a habit-ring / progress-ring metaphor that ties the three features (journal, habits, pomodoro) together visually. Both `src/app/icon.tsx` (512×512) and `src/app/apple-icon.tsx` (180×180) updated with proportional sizes/stroke widths.
- **PWA `VERSION` bumped `habit-log-v3 → habit-log-v4`** in `public/sw.js` so installed phones re-fetch `/icon` + `/apple-icon` on next SW activation. (iOS Safari additionally caches home-screen icons aggressively at install time — remove + reinstall to refresh the icon on iOS.)

**Verification:**
- Dev server (`npm run dev`) booted clean (`Ready in 2.5s`, no warnings).
- User manually verified placeholder + new icon on local + mobile.

**Deploy:**
- No schema migration this part.
- `vercel --prod --yes` after push.

**Resume here for Phase 4 · Part 2:** awaiting user direction on the next item.

---

## ✅ Phase 4 · Part 2 — Goals feature (weekly / monthly / yearly)

Plan: `C:\Users\Admin\.claude\plans\now-let-s-build-a-partitioned-floyd.md`. Three-slice rollout (B / C / D) on commits `6a7a090`, `f4c88cb`, plus the post-verify cleanup committed alongside this entry.

**Concept:** fourth pillar alongside Journal / Habits / Pomodoro. Single tab with a Week / Month / Year segmented control. Per-period dashboard with progress cards, donut summary, history strip, cascade rollups, year heatmap, and an auto-finalize + reflection sheet at period close. Routes follow the existing `/route/[period]/[anchor]` pattern.

**Bottom nav rewired:** Insights demoted into `/more`; new `/goals` slot (lucide `Target` icon). Final order: Journal · Habits · Pomodoro · Goals · More.

### Schema — migration `0003_dizzy_captain_marvel.sql` (applied locally; prod pending)

- `goals` — single table for week + month + year. Columns: id, `period` enum, `periodKey` (e.g. `2026-W21`, `2026-05`, `2026`), `parentId` (self-FK for cascade), title/emoji/color, `type` enum (`number | habit | pomodoro | milestone`), `targetValue`/`unit`, `habitId` + `pomoCategoryId` + `pomoMetric` for linked variants, `status` enum (`active | achieved | missed | archived`), `finalizedAt`, reflection fields (`reflectionNote/Rating/LinkedDate/SavedAt`), position, archivedAt, createdAt. Indexes on `(period, periodKey)`, `parentId`, `status`.
- `goal_progress` — log of number-target increments. `(goalId FK cascade, date, delta, note, createdAt)`, indexed on `(goalId, date)`.
- `goal_checklist` — milestone sub-tasks. `(goalId FK cascade, text, done, position)`.

One `goals` table (not three) because the composite `(period, periodKey)` index covers every read. Habit + pomodoro currentValue is **derived live** in queries, never duplicated.

### Lib additions

- `src/lib/dates.ts` — `weekStartOf`, `isoWeekKey` (ISO 8601, Jan-edge year may differ), `periodKeyFor`, `periodRangeFor` (Sun-start display for weeks; explicitly documented), `weeksInYear` (52 or 53), `shiftPeriodKey` (pivots off the period's Thursday so week ± steps land in the right ISO week — a +7-day shift from Sun-start lands in the same ISO week, see `src/lib/dates.ts:114-119`), `prevPeriodAnchor`/`nextPeriodAnchor`, `formatPeriodRange`.
- `src/lib/goal-meta.ts` — period/type/status enums + labels, `computeGoalPace` (linear pace model with `not-started | behind | at-risk | on-track | ahead | achieved | missed` pills), `computeGoalStatus` (maps pace to shared `JournalStatus` palette so heatmap reuses CSS vars), `autoSplitTargets` (largest-remainder integer split for cascading), `daysRemaining`, `isPeriodClosed`. Re-exports `PRESET_COLORS` from habit-meta so swatch UI is identical.

### Queries (`src/db/queries/goals.ts`)

- `getGoalsForPeriod(period, periodKey)` — main read. Derives `currentValue` per type:
  - **number**: `SUM(goal_progress.delta)` for the goal.
  - **habit**: `COUNT(habit_logs)` for the linked habitId within `periodRangeFor(...)`.
  - **pomodoro**: `SUM(durationMin)` / `SUM(pomoUnits(durationMin))` / `COUNT(*)` filtered by optional `categoryId` and the metric (uses `pomoUnits` from `pomodoro-meta`).
  - **milestone**: `done count` of inline `goal_checklist` items.
  - Also lazily **auto-finalizes** any `active` goal whose period has already ended (read-time, idempotent, no cron). Mutates in-process so the same render sees the new status.
- `getGoalsHistory(period, currentKey, count)` — last N periods preceding `currentKey`, each with its derived goals (used by the history strip).
- `getGoalsYearHeatmap(year)` — per-ISO-week status map for the year view's 52/53-cell grid. Only weekly goals roll into the cell color so month/year aggregates don't dominate.
- `getChildrenOfGoal(parentId)` — child goal rollup for cascade display.
- All shapes are arrays / plain objects, never `Map` (RSC rule).

### Actions (`src/app/actions/goals.ts`)

`"use server"`, only async exports (rule #6). Every mutation `revalidatePath("/goals", "layout")`.

- `createGoal({ ..., autoSplitChildren? })` — validates inputs (period/key/type enums, color hex, length caps), inserts. If `autoSplitChildren && period in {year, month}`, calls internal `createCascadeChildren` to spawn children (year → 12 months, month → ISO weeks whose Thursday lies inside the month). Skips past periods.
- `updateGoal`, `deleteGoal`, `archiveGoal`/`unarchiveGoal`.
- `logProgress({ goalId, delta, note?, date? })` for number-type increments.
- `addChecklistItem` / `updateChecklistItem` / `toggleChecklistItem` / `deleteChecklistItem`.
- `finalizePeriod` (still callable; auto-trigger lives in `getGoalsForPeriod`).
- `saveReflection({ goalId, note, rating, linkedDate? })` — stamps reflection columns on the goal. When `linkedDate` is provided, also `ensureEntry(linkedDate)` + inserts a checked-off `secondary` `journal_tasks` row with `"Reflect: {title} — {note excerpt}"`. Idempotent, doesn't trample journal autosave state.

### Routes

```
src/app/goals/
  page.tsx                          // client redirect → /goals/week/{isoWeekKey(today)}
  loading.tsx
  [period]/
    page.tsx                        // client redirect → /goals/{period}/{periodKeyFor(today, period)}
    [anchor]/
      page.tsx                      // server: validates, fetches in parallel, renders
      loading.tsx
      not-found.tsx
      _components/
        period-toggle.tsx           // Week / Month / Year pill row
        goal-period-stepper.tsx     // prev/next chevrons + label; allows one period ahead of today
        period-summary-card.tsx     // SVG donut + "N on track · X days left"
        goal-card.tsx               // dispatcher by goal.type
        goal-card-number.tsx        // client; progress bar + Log-progress dialog
        goal-card-habit.tsx         // server; derived count, links to /habits
        goal-card-pomodoro.tsx      // server; derived metric, links to /pomodoro
        goal-card-milestone.tsx     // client; optimistic checklist toggles
        add-goal-button.tsx
        goal-form-dialog.tsx        // type-switcher reveals fields; habit + pomo pickers; autoSplit toggle for year/month with live preview
        cascade-children.tsx        // dashed-border footer card listing child periods (tappable)
        history-strip.tsx           // 5-period chip row, colored by aggregated achievement
        year-heatmap.tsx            // 52/53 cell row on year view; tappable to navigate
        reflection-banner.tsx       // page-level "Reflect on N closed goals →"
        reflection-prompt.tsx       // per-card client wrapper opening the sheet
        reflection-sheet.tsx        // base-ui Dialog side=bottom; stars + note + journal link toggle
        goals-empty-state.tsx
```

### Local dev SW gating (post-verify fix)

`src/app/layout.tsx` — the service-worker registration script was also active on `localhost`, which made the SW cache `/_next/static/...` chunks. Turbopack rebuilds change chunk hashes; once a stale entry was in cache, the dev page rendered with broken Tailwind (symptom: bottom nav rendered as a vertical `<li>` list). Now gates registration to `https:` AND non-`localhost` hostname, and **actively unregisters any existing SW + clears all `caches.keys()` on localhost**. Localhost users only need to hard-reload once after pulling this fix; the layout cleans up the state on its own.

### Week stepper bug fix (post-verify)

`src/lib/dates.ts` — `shiftPeriodKey(key, "week", delta)` previously computed `addDays(periodRangeFor(key, "week").start, delta * 7)`. Our display range is Sun-start, but Sunday belongs to the *previous* ISO week (ISO weeks end on Sunday), so shifting from `start` by +7 days landed inside the SAME ISO week — the right arrow in the week stepper did nothing. Now pivots off the period's **Thursday** (`addDays(start, 4)`), which is always unambiguously inside the current ISO week, and `addDays(thu, delta * 7)` lands in the correct next/prev ISO week.

### PWA

`public/sw.js` — `VERSION` bumped `habit-log-v4` → `habit-log-v5`. `/goals` added to the `SHELL` array.

### Verification

- `tsc --noEmit` clean.
- `npm run lint` → 0 errors, 13 warnings (all `react-hooks/set-state-in-effect`, the accepted exemption pattern). Goals form dialog + reflection sheet added 4 more of the same kind; no new categories of warning.
- `npm run build` clean — 18 routes. New: `/goals` (○), `/goals/[period]` (ƒ), `/goals/[period]/[anchor]` (ƒ).
- Local probes: `/goals` (302→week), `/goals/week/2026-W21`, `/goals/month/2026-05`, `/goals/year/2026` all 200.
- User manually verified end-to-end: bottom nav, period toggle, goal creation across types, log-progress, checklist toggles, cascade auto-split preview, week stepper after fix.

### Deploy (this commit)

1. `npm run db:migrate` against prod Turso (`.env.production.local` env loaded via PowerShell). Applies `0003_dizzy_captain_marvel.sql`.
2. `vercel --prod --yes` from `Habit_Log/`.
3. PWA: installed phones pick up the new `/goals` route + `habit-log-v5` shell on next SW activation. iOS Safari home-screen icon stays cached at install time — remove + reinstall to refresh.

### Things deferred to Part 2.1+ (no fixed order)

- Insights "Goals" section (monthly completion chart, longest streak card, year heatmap reused).
- "Regenerate children" toggle on the edit dialog (current parent edits don't auto-rebalance future children).
- Drag-and-drop reorder for goals/sub-tasks (the `position` column is wired for it).
- Per-day "log progress" snapshots viz (the `goal_progress` log already supports it — UI is the missing piece).
- Reflection summary view (browse reflections across periods in one place).

**Resume here for next session:** Goals feature shipped. Awaiting user direction on the next feature.

---

## ✅ Phase 5 — Reverse cascade + journal task move

Plan: `C:\Users\Admin\.claude\plans\now-let-s-build-a-partitioned-floyd.md`. Shipped end-to-end after a brainstorm session that also locked in the user's canonical 14-item habit + goal stack.

### Context

Two user-driven friction points surfaced after the Goals feature shipped:
1. Creating a weekly goal once didn't propagate to future weeks; manually re-entering "Workout 5×" every Sunday for 32 future weeks was un-shippable. The forward cascade (year → month → week) hides the natural weekly entry point — users think "5×/week", not "260/year".
2. Journal tasks left undone on past dates had no way back to today, and tasks the user wanted to defer to tomorrow had no rollover.

### Shipped — reverse cascade

- `src/lib/dates.ts` — new `enumerateWeeksThrough(currentKey, endKind, endRef)` returns ISO week keys from `currentKey` through end-of-month or end-of-year (inclusive on both ends, Thursday-anchored). Safety bound at 110 weeks. Reuses `shiftPeriodKey` so the Sun-start display vs. ISO-week-membership trap from Phase 4 Part 2 doesn't recur here.
- `src/app/actions/goals.ts` — `createGoal` accepts a new optional `repeat: { through, monthKey? }` arg. When set on a `period: "week"` goal, the standard single-row insert is skipped and the new internal `createReverseCascade()` helper takes over:
  - Enumerates weeks via `enumerateWeeksThrough`
  - Groups weeks by the **Thursday's month** (matches the forward-cascade convention from `createCascadeChildren`)
  - Inserts a yearly parent (only if `through === "endOfYear"`)
  - Inserts a monthly parent per month spanned (target = weekly × weeks-in-month)
  - Inserts weekly clones linked to their month's parent
  - Validates `monthKey >= todayMonth`, rejects milestone goals, rejects same-week
- `src/app/goals/[period]/[anchor]/_components/goal-form-dialog.tsx` — new "Repeat through" section appears only on `period === "week"` && `type !== "milestone"`. Three radio options: this week only / end of month {dropdown of future months only} / end of year. Live preview shows estimated row counts (weeks × months × yearly).

### Shipped — journal task move

- `src/lib/task-meta.ts` — replaced prefix-based `TASK_TRACE_PREFIX` with substring marker `TASK_TRACE_MARKER = " → Moved to "` so the trace row text can read naturally with the habit name first: `"Testing → Moved to May 21"`. `isTraceTask()` now does `text.includes(MARKER)`.
- `src/app/actions/journal-tasks.ts` — new `moveJournalTask({ id, newDate })` action:
  - Validates id + `isValidDateString(newDate)` + rejects same-date moves and moving an existing trace stub
  - `ensureEntry(newDate)` for FK safety, computes new position via `nextTaskPosition`
  - Updates the row's `date / position / done=false` (move = fresh start on target date)
  - Inserts a trace stub on the original date: `text = "{excerpted} → Moved to {formatShortDate(newDate)}"`, `done = true`. Excerpt cap at 60 chars + ellipsis.
  - Revalidates both `/journal/{oldDate}` and `/journal/{newDate}`
- `src/app/journal/[date]/_components/tasks-block.tsx`:
  - Split `TaskRow` into `TraceRow` (read-only; italic + line-through + muted, no controls) and `ActiveTaskRow` (existing logic + new move button).
  - New `MoveTaskButton` component owns a single `@base-ui/react` Popover with two modes: "menu" (smart "Move to today/tomorrow" button + "Pick date…") and "picker" (embedded `Calendar` primitive with month nav state). Avoids nesting two base-ui popovers.
  - Move icon hidden when `done === true` (forced-move-after-flush is intentionally not supported).

### Other changes folded in

- **`src/lib/pomodoro-meta.ts`** — `DEFAULT_CATEGORIES` rename "Creative" → "Create" so the user's "Create" pomodoro-linked goal title matches the seeded category name. Auto-seed on first `/pomodoro` read now gives "Create".
- **`public/sw.js`** — VERSION bumped `habit-log-v5 → habit-log-v6`. No SHELL change (no new top-level routes).
- **`scripts/seed-habits-goals.mjs`** — the canonical habit + goal stack seeder used during the brainstorm session. Two modes:
  - `local`: fresh-DB seed with 6 pomodoro categories + 9 habits + 14 yearly + 8×14 monthly + 14 weekly goals (155 rows for May 2026).
  - `prod`: destructive mirror — wipes `goal_progress`, `goal_checklist`, `goals`, `habit_logs`, `habits`, then renames any existing "Creative" → "Create" in `pomodoro_categories` and reuses prod's existing category ids rather than inserting new ones. Preserves journal + pomodoro sessions on prod.
- **`scripts/check-seed.mjs`** — quick read-back of habits + categories + W21 / May / 2026 goals after seeding.
- **README.md** — Goals tab section added (with reverse cascade + task move described), default category list updated to "Create", helpful-scripts block expanded with `seed-habits-goals.mjs` (local + prod usage), SW version bumped reference.

### The canonical 14-item stack (seeded May 2026)

Order matches what's now visible on `/habits` + `/goals/week/2026-W21` (`position` 0..13):

| Pos | Item | Kind | Weekly | Monthly (May) | Yearly |
|---:|------|------|---:|---:|---:|
| 0 | ☀️ Wake up at 8 | habit | 3 | 13 | 156 |
| 1 | ✍️ Journal | habit | 5 | 22 | 260 |
| 2 | 🏋️ Gym | habit | 5 | 22 | 260 |
| 3 | 🙏 Pray | habit | 3 | 13 | 156 |
| 4 | 🕉️ Mantra | habit | 5 | 22 | 260 |
| 5 | 💼 Work | pomo (Work, sessions) | 20 | 87 | 1040 |
| 6 | 🧘 Meditate 5 min | habit | 3 | 13 | 156 |
| 7 | 📖 Study | pomo (Study, sessions) | 5 | 22 | 260 |
| 8 | 👟 Walk (5k) | number (steps) | 25000 | 108333 | 1300000 |
| 9 | 📚 Read (5 pages) | number (pages) | 25 | 108 | 1300 |
| 10 | 🥗 No junk | habit | 5 | 22 | 260 |
| 11 | 🎨 Create | pomo (Create, sessions) | 2 | 9 | 104 |
| 12 | 🪥 Brush + Skincare | habit | 5 | 22 | 260 |
| 13 | 😴 Sleep before 12 | habit | 3 | 13 | 156 |

Yearly goals all have May–Dec 2026 monthly cascade children (largest-remainder split, skips past months Jan–Apr). Weekly goals exist for `2026-W21` only — future weeks will be created either manually or via the new reverse cascade feature on next session.

### Verification

- `npx tsc --noEmit` clean.
- `npm run lint` → 0 errors, 13 expected `set-state-in-effect` warnings (intentional state-sync pattern, no new categories).
- `npm run build` clean — same 18 routes.
- User manually verified end-to-end on localhost: reverse cascade with end-of-year, end-of-month August; task move from past date → today + trace; task move from today → tomorrow + trace; pick-date calendar; new trace format `"{habit} → Moved to May 21"`.

### Deploy steps

1. `git push origin main` (commit covers code + seed script + docs).
2. No schema migration in Phase 5 itself (Goals tables already on prod from 0003).
3. Mirror the seeded habit + goal stack to prod:
   ```
   $env:Path += ";C:\Program Files\nodejs;$env:APPDATA\npm;C:\Program Files\Git\cmd"
   Get-Content .env.production.local | ForEach-Object {
     if ($_ -match '^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.+?)\s*$') {
       Set-Item -Path "Env:\$($matches[1])" -Value $matches[2].Trim('"')
     }
   }
   node scripts/seed-habits-goals.mjs prod
   ```
4. `vercel --prod --yes` from `Habit_Log/`.
5. PWA: installed phones pick up `habit-log-v6` shell on next SW activation.

### Things deferred to Phase 5.1+

- "Move all incomplete" bulk action (Card-level button).
- Undo for task moves.
- Reverse-cascade edit / regenerate (delete + redo for now).
- De-dup detection on reverse cascade (re-running for same title creates parallel hierarchies).
- Trace row tap-to-navigate-to-moved-target (currently visual only).
- Auto-create weekly clones each Sunday for the rest of the seeded year (currently W21 is the only week with goals — Phase 5.1 idea).

**Resume here for next session:** Phase 5 deployed. Awaiting next direction.

---

## ✅ Phase 6 — Unified daily tracking on /habits

Plan: `C:\Users\Admin\.claude\plans\now-let-s-build-a-partitioned-floyd.md`.

### Context

The 14-item stack split awkwardly across two tabs: 9 binary habits on `/habits`, 5 non-binary items (Walk, Read, Study, Create, Work) only on `/goals`. To know "what do I still owe today?" the user had to flip between tabs. Walk's mental model is "5,000 steps/day, 5 days/week" — the daily target was implicit inside a weekly goal target (25k). Phase 6 unifies tracking: every item is a habit on `/habits` with kind-aware rendering, and habit-linked goals derive their progress from those daily logs.

### Schema migration `0004_skinny_cargill.sql` (additive)

- `habits` table: 4 new columns
  - `tracking_kind` enum default `"binary"` (`binary | number | pomodoro`)
  - `daily_target` real nullable (e.g. 5000 steps, 1 session)
  - `unit` text nullable (e.g. "steps", "pages")
  - `pomo_category_id` text FK → `pomodoro_categories.id` (set null on delete)
- New `habit_value_logs` table: `(id, habit_id FK cascade, date YYYY-MM-DD, value real, note?, created_at)`. Index on `(habit_id, date)`. Multiple rows per habit-day allowed; sum on read.
- Unused legacy columns `cadence` + `targetPerWeek` left in place (no value change).
- Local applied; prod migration runs additively before mirror.

### Lib additions

`src/lib/habit-meta.ts`:
- `HABIT_TRACKING_KINDS`, `HabitTrackingKind` type
- `TRACKING_KIND_LABELS`, `TRACKING_KIND_HINTS`
- `isHabitDoneOnDate(kind, dailyTarget, daySumOrCount, hadLog)` — single helper used by snapshot, goal derivation, and per-row UI

### Queries

`src/db/queries/habits.ts`:
- `HabitsSnapshot` extended with `windowValuesByHabit: Map<habitId, Map<date, sum>>` and `windowPomoByHabit: Map<habitId, Map<date, count>>` (5-way parallel fetch).
- `doneOnAnchorIds` rebuilt via `isHabitDoneOnDate` so number + pomo habits flip "done" once the day's threshold is hit.
- Two new range helpers: `getValueLogsInRange`, `getPomoSessionsInRange`.

`src/db/queries/goals.ts` — `habitCountInRange` becomes kind-aware:
- binary: COUNT `habit_logs`
- number: count distinct dates where `SUM(habit_value_logs.value) >= dailyTarget`
- pomodoro: count distinct dates where `COUNT(pomodoro_sessions for category) >= dailyTarget`

All three return "qualifying days in the period". Habit-linked goal target keeps the same semantics across kinds.

### Server actions

`src/app/actions/habits.ts`:
- `createHabit` + `updateHabit` accept the four new fields. Validates `dailyTarget > 0` for number/pomo, requires `pomoCategoryId` for pomo (and confirms it exists in `pomodoro_categories`).
- `toggleHabitForDate` is now binary-only — throws if called against a non-binary habit.
- **New `logHabitValue({ habitId, value, date?, note? })`** — append a delta to `habit_value_logs`. Validates habit is number-kind + value is non-zero.
- **New `deleteHabitValueLog(id)`** for future "undo last entry" UI.
- All mutations revalidate `/habits` AND `/goals` so cross-tab readouts stay live.

### UI

`src/app/habits/[date]/page.tsx`:
- Loads `getActiveCategories()` in parallel with the snapshot (needed by the form).
- Flattens the snapshot's `Map<Map>` shapes into plain `Record<string, Record<string, number>>` before passing to client subcomponents (rule #8 — Map doesn't survive RSC serialization).
- Extracts anchor-day per-habit lookups (`valueAtAnchor`, `pomoCountAtAnchor`) for `TodayToggles`.

`src/app/habits/_components/today-toggles.tsx` — rebuilt to dispatch by `habit.trackingKind`:
- **`BinaryRow`** — original tap-to-tick + optimistic.
- **`NumberRow`** — emoji + name + "{daySum}/{dailyTarget} {unit}" + `[+ Log]` button → `LogValueButton` mini dialog (decimal input + optional note). Done state painted with the habit color.
- **`PomoRow`** — read-only "{sessionsToday}/{dailyTarget} sessions"; the entire row is a `<Link>` to `/pomodoro/{anchor}`. No manual session log here (defer to Phase 6.1).
- All three share a `Glyph` (emoji or checkmark) + `hexToRgba` background tint.

`src/app/habits/_components/habit-grid.tsx` — props now take `Record` shapes for binary log dates AND number/pomo per-day rollups. Cell "done" check is `isHabitDoneOnDate(kind, dailyTarget, daySumOrCount, hadLog)` so the rolling 15-day grid colors correctly for all kinds. Cell visual stays binary (filled = done).

`src/app/habits/_components/habit-form-dialog.tsx` — new "How to track" radio grid (`Just tick / Log a number / Pomodoro sessions`). Conditional fields:
- `number`: Daily target + Unit inputs
- `pomodoro`: Category dropdown (from passed-in `categories`) + Sessions/day
- `binary`: nothing extra

`src/app/habits/_components/habit-list.tsx` + `add-habit-button.tsx` — accept and pass `categories` prop; Row subtitle shows tracking-kind summary (`5000 steps/day`, `1 Study sessions/day`, or `Just tick`).

`src/app/insights/page.tsx` — `HabitGrid` invocation updated to flatten the snapshot's three `Map<Map>` shapes into Records.

### Goal type cleanup in the seed

`scripts/seed-habits-goals.mjs` is now the single source of truth for the canonical stack. All 14 items become **habits** with explicit `trackingKind`. All their seeded goals are `habit`-linked, and targets are uniform "days in period":

| Item | Kind | Daily target | Weekly days |
|---|---|---:|---:|
| Wake up at 8 / Journal / Gym / Pray / Mantra / Meditate / No junk / Brush + Skincare / Sleep before 12 | binary | — | 3 or 5 |
| Walk (5k) | number | 5000 steps | 5 |
| Read (5 pages) | number | 5 pages | 5 |
| Work | pomodoro (Work cat) | 4 sessions | 5 |
| Study | pomodoro (Study cat) | 1 session | 5 |
| Create | pomodoro (Create cat) | 1 session | 2 |

Yearly = `weeklyDays × 52` (e.g. Walk 260, Create 104). Monthly cascade = largest-remainder split. Weekly W21 = `weeklyDays`. Math is identical regardless of kind because the kind just hides inside the habit row.

Prod mirror mode now wipes 6 tables (added `habit_value_logs` to the list) before reseeding.

`scripts/check-seed.mjs` prints `[trackingKind] dailyTarget unit/day` per habit.

### PWA

`public/sw.js` — `VERSION` bumped `habit-log-v6 → habit-log-v7`. SHELL unchanged.

### Verification

- `npx tsc --noEmit` clean.
- `npm run lint` → 0 errors, 13 expected `react-hooks/set-state-in-effect` warnings (no new ones).
- `npm run build` clean — same 18 routes.
- Local DB nuked + remigrated + reseeded: 14 habits across all three kinds, 6 pomodoro categories, 14 yearly + 112 monthly + 14 weekly goals (160 rows total).
- User to verify end-to-end manually before prod mirror + deploy.

### Deploy (pending user verification)

1. Local migration applied + seed verified ✓
2. Commit + `git push origin main`
3. Prod migration: `npm run db:migrate` with `.env.production.local` loaded — additive, safe (no data loss).
4. Prod mirror: `node scripts/seed-habits-goals.mjs prod` — wipes 6 goal/habit tables + reseeds. Pre-approved destructive op per session memory.
5. `vercel --prod --yes`.
6. PWA: phones pick up `habit-log-v7` on next SW activation.

### Things deferred to Phase 6.1+

- Partial-fill rendering in HabitGrid cells (number/pomo days show opacity proportional to value/target).
- "Today's deltas" history with per-entry remove on NumberRow long-press.
- Manual pomo session log directly from the PomoRow (currently jumps to /pomodoro tab).
- Stepper +/- quick-increment buttons for NumberRow.
- Per-day target override (e.g. weekend Walk = 8k, weekday = 5k).
- Drop unused `cadence` + `targetPerWeek` columns from habits.

**Resume here for next session:** Phase 6 ready for prod once user confirms local works.

---

## ✅ Phase 7 — UX polish + reorder + pinned goals

Eight friction points smoothed in one bundle, plus a real timezone bug rooted out of the pomodoro hour charts.

Plan: `C:\Users\Admin\.claude\plans\here-are-the-changes-quiet-wadler.md`.

### Shipped

1. **Drag-to-reorder daily questions** on `/settings`.
   - New deps `@dnd-kit/{core,sortable,utilities}` (4 packages).
   - New action `reorderQuestions(orderedIds: string[])` in `src/app/actions/journal-questions.ts` — transaction that rewrites `position` to the array index. Validates non-empty, no-duplicates, and revalidates `/settings` + `/journal`.
   - `src/app/settings/_components/questions-manager.tsx` rewritten — active list wrapped in `<DndContext>` + `<SortableContext>` with `verticalListSortingStrategy`. Each row gets a `GripVertical` drag handle. Optimistic `arrayMove`, revert on error toast. Archived list stays static (no reorder there).
2. **Journal Reflection section reordered.** `src/app/journal/[date]/_components/journal-form.tsx` — `<QuestionsBlock />` now renders ABOVE the "How was today?" Energy/Mood/Sleep card. Pure JSX move; autosave wiring untouched. While in the file, lifted the local `GroupBreak` into a shared primitive (next item).
3. **Auto-select pomo category from `/habits` deep-link.**
   - `today-toggles.tsx:300` `PomoRow` link now appends `?categoryId={pomoCategoryId}` when the habit has one set.
   - `src/app/pomodoro/[date]/page.tsx` accepts `searchParams: Promise<{ categoryId?: string }>` and validates against `getActiveCategories()` before passing through as `initialCategoryId`.
   - `src/app/pomodoro/[date]/_components/timer-panel.tsx` mount effect: URL param (validated) wins over `localStorage.pomodoro.lastCategoryId`, which still serves as the fallback for direct visits. URL deep-link also writes to localStorage so the next direct visit remembers it. The manual-session dialog re-uses the resolved `categoryId` state for its default.
4. **Manual pomo entry — count × kind, sequential.** `src/app/pomodoro/[date]/_components/manual-session-dialog.tsx` rewritten:
   - Single `duration` input replaced with `pomoCount` (1–10) + `pomoKind` chip selector ("full" 50m / "half" 30m) driven by `POMO_DURATIONS`.
   - Live readout: `"2 pomos × 50 min = 100 min total"` and "saved as separate sessions back-to-back" hint.
   - Submit loops `pomoCount` times calling `createSession` with sequential `startedAt = base + i*kindMin*60_000`. Each session's `date` is re-derived from its own `startedAt` via `formatLocalYMD` so sessions that cross midnight land in the right `date` bucket. Partial-success-friendly: on mid-batch error, toasts `"Saved {n} of {pomoCount} — {msg}"` and aborts.
5. **TZ bug fix — hour-of-day buckets.**
   - **Root cause:** `src/db/queries/pomodoro.ts:87, 204` called `new Date(s.startedAt).getHours()` server-side. On Vercel (UTC) this returned UTC hours, not the user's local hours. Local dev only worked by accident (your TZ == server TZ).
   - **Fix:** moved hour bucketing to the client. Query now returns raw `sessions[].startedAt: Date` (PomodoroDay) and a new `hourSamples: { startedAt: Date; durationMin: number }[]` array (PomodoroWindow) instead of pre-bucketed `hourMinutes` / `hourHistogram`.
   - `day-stats-card.tsx` upgraded to `"use client"` + `useMemo` that re-buckets from `today.sessions`. Browser uses the user's actual TZ.
   - `hour-histogram.tsx` (insights) rewritten as `"use client"` taking `samples={pomoWindow.hourSamples}` and bucketing client-side. Insights page wires it through.
6. **Habits progress donut.**
   - New shared primitive `src/components/ui/progress-donut.tsx` — pure SVG, `var(--muted)` track + `var(--primary)` arc, optional `label`. Goal donut math (radius 30, circumference 2πr, two-arc full-circle path) extracted unchanged.
   - `period-summary-card.tsx` refactored to use the primitive + accepts an optional `title` prop for "Important" / "Other goals" labelling.
   - New `src/app/habits/_components/habits-progress-card.tsx` — sibling card to TodayToggles. Computes `percent = doneOnAnchorIds.size / activeForAnchor.length` and renders `"{done}/{total} habits done {today|that day}"`.
   - Wired into `/habits/[date]/page.tsx` immediately above `<TodayToggles>`.
7. **Pinned goals top section.**
   - **Schema migration `0005_stormy_whizzer.sql`** — `goals.pinned: integer not null default 0` + `goals_pinned` index. Applied locally; **prod still pending — run `npm run db:migrate` against prod Turso before the next deploy.**
   - `src/db/schema.ts` — column added with `mode: "boolean"`.
   - `src/app/actions/goals.ts` — `createGoal` + `updateGoal` accept optional `pinned: boolean`. New `setGoalPinned({ id, pinned })` action for row-level toggle. Cascade children intentionally inherit `pinned=false` (default) so auto-split monthlies/weeklies don't flood the Important section.
   - `src/app/goals/[period]/[anchor]/page.tsx` partitions `goalsForPeriod` into `pinned` + `rest`. When `pinned.length > 0` renders a separate `PeriodSummaryCard goals={pinned} title="Important"` + pinned cards loop + `<GroupBreak label="All goals" />` + the "Other goals" donut + rest cards. When nothing pinned, layout matches before.
   - `goal-form-dialog.tsx` — new "Pin to top section" checkbox above the type radio grid.
   - `goal-card.tsx` dispatcher now wraps each variant in a `relative` div + a floating `<PinToggleButton goalId={goal.id} pinned={goal.pinned} />` in the top-right corner (`Pin` / `PinOff` lucide icons). New `src/app/goals/[period]/[anchor]/_components/pin-toggle-button.tsx` calls `setGoalPinned` with an optimistic `useTransition` flip.
8. **PWA `VERSION` bumped `habit-log-v7 → habit-log-v8`** in `public/sw.js`. SHELL array unchanged (no new routes).

### Shared GroupBreak primitive

Lifted `GroupBreak` out of `journal-form.tsx` into `src/components/ui/group-break.tsx` so the goals page can reuse it for the "All goals" hairline divider. Same `cn(first ? "mt-2" : "mt-6")` semantics; supports an optional `className` override.

### Files touched

- `package.json` (+3 dnd-kit deps)
- `src/db/schema.ts` (goals.pinned + index)
- `drizzle/migrations/0005_stormy_whizzer.sql`
- `src/components/ui/{group-break,progress-donut}.tsx` (new)
- `src/app/actions/{journal-questions,goals,…}.ts` (reorderQuestions, pinned, setGoalPinned)
- `src/app/settings/_components/questions-manager.tsx` (DndKit)
- `src/app/journal/[date]/_components/journal-form.tsx` (section swap + GroupBreak import)
- `src/app/habits/_components/{today-toggles,habits-progress-card}.tsx` + `src/app/habits/[date]/page.tsx`
- `src/app/pomodoro/[date]/page.tsx` (searchParams)
- `src/app/pomodoro/[date]/_components/{timer-panel,manual-session-dialog,day-stats-card}.tsx`
- `src/app/insights/_components/hour-histogram.tsx` + `src/app/insights/page.tsx`
- `src/db/queries/pomodoro.ts` (drop hourMinutes/hourHistogram, add hourSamples + raw sessions retained)
- `src/app/goals/[period]/[anchor]/page.tsx` (partition + new section)
- `src/app/goals/[period]/[anchor]/_components/{goal-form-dialog,goal-card,period-summary-card,pin-toggle-button}.tsx`
- `public/sw.js` (v7 → v8)

### Verification

- `npx tsc --noEmit` clean.
- `npm run lint` → 0 errors, 14 expected `react-hooks/set-state-in-effect` warnings (questions-manager `useEffect(() => setOrderedActive(active), [active])` adds one; same documented exemption pattern).
- `npm run build` clean — 18 routes still build (no new top-level routes).
- Local probes after a clean `.next` rebuild: `/goals/week/2026-W21`, `/goals/month/2026-05`, `/goals/year/2026`, `/habits/{today}`, `/pomodoro/{today}`, `/pomodoro/{today}?categoryId=…`, `/journal/{today}`, `/insights?range=30`, `/settings`, `/more` — all 200.
- Local DB schema confirmed via `PRAGMA table_info(goals)`: `pinned` column present, default 0; all 140 existing goal rows defaulted to 0.

### Deploy steps (this commit)

1. `git push origin main`.
2. Prod migration: `npm run db:migrate` with `.env.production.local` loaded — applies `0005_stormy_whizzer.sql`. Additive, safe.
3. `vercel --prod --yes` from `Habit_Log/`.
4. PWA: phones pick up `habit-log-v8` on next SW activation.
5. **Prod verification** — log a 5 PM IST pomo from the live URL → confirm hour chart lights bucket 17:00 (pre-fix prod showed 11:00).

### Things deferred to Phase 7.1+

- Drag-reorder for habits, pomo categories, journal tasks (mirror the questions DndKit pattern — `position` columns already exist).
- Editing `pinned` from the existing goal edit dialog (currently pin/unpin is via the floating button + new-goal checkbox; no inline edit).
- Pin button position polish — currently overlays `right-2 top-2` and may visually crowd the PacePill on goal cards. Pending real-device feedback.
- Reflection summary view across periods, "regenerate cascade" toggle, per-day Walk target overrides, drop legacy `cadence`/`targetPerWeek` columns from habits.

**Resume here for next session:** Phase 7 deployed (assuming prod step ran). Awaiting next direction.

---

## ✅ Phase 7B — PWA shortcuts, locked-phone notify, drag-reorder, goals edit/delete

Five-slice bundle on 2026-05-23. Plan at `C:\Users\Admin\.claude\plans\okay-lets-do-these-zippy-lake.md`.

### Shipped

1. **Manifest shortcuts (Android).** `src/app/manifest.ts` is now an async, `force-dynamic` route that fetches the top 4 active pomo categories at request time and emits one shortcut per category — URL `/pomodoro?autostart=1&categoryId={id}`. Long-press the installed PWA icon on Android Chrome shows them. iOS Safari ignores manifest shortcuts; graceful degrade.
2. **`?autostart=1` deep-link.** `src/app/pomodoro/page.tsx` now preserves `window.location.search` across the `/pomodoro → /pomodoro/{today}` redirect. `[date]/page.tsx` accepts `autostart` searchParam and forwards as `initialAutostart` prop. `timer-panel.tsx`'s mount effect, when `initialAutostart && isToday && phase === "idle"`, calls `primeAudio()` + the existing start flow with the resolved category/duration + cleans the URL via `router.replace(pathname)` so a refresh doesn't relaunch.
3. **Notification Triggers API (locked-phone alert, Chromium Android).** New `scheduleCompletionNotification(endsAt, label)` + `cancelCompletionNotification()` helpers in `timer-panel.tsx`. On Start / Resume / mount-resume-running we ask `Notification.permission` (default→prompt, sticky) and, if granted + `TimestampTrigger` exists, schedule `reg.showNotification("Pomodoro complete", { showTrigger: new TimestampTrigger(endsAt), vibrate: [200,100,200,100,400], icon, badge, tag: "pomo-completion" })`. Pause / Stop / Discard / Save-partial / in-foreground completion all call `cancelCompletionNotification()`. iOS/Safari silently no-op (no Triggers support); in-app `playPomodoroSound()` still fires if the tab is alive. Both layers run independently. `public/sw.js` gained a `notificationclick` handler that focuses an existing pomodoro client or opens `/pomodoro`.
4. **Category chip wrap.** `src/app/pomodoro/[date]/_components/category-picker.tsx` outer wrapper went from `-mx-1 w-full max-w-full min-w-0 overflow-x-auto pb-1` to `w-full`; inner from `flex w-max gap-1.5 px-1` to `flex flex-wrap gap-1.5`. Affects timer panel + manual entry dialog (same component).
5. **Drag-reorder for habits.** New `reorderHabits(orderedIds)` action in `src/app/actions/habits.ts`. `src/app/habits/_components/habit-list.tsx` rewrapped in `DndContext` + `SortableContext` + `verticalListSortingStrategy`. Grip handles on every active row via `useSortable({ id })`. Archived list stays static.
6. **Drag-reorder for pomo categories.** Mirrored the same DndKit pattern into `src/app/settings/_components/pomodoro-categories-manager.tsx` (the `reorderCategories` action already existed from earlier).
7. **Goal edit (cross-level cascade) + delete (current+future, freeze past).** New actions in `src/app/actions/goals.ts`:
   - `updateGoalCascade({ id, ...editable fields })`: walks `parentId` to root, BFS down to every descendant. For non-target fields (title, emoji, color, unit, habitId, pomoCategoryId, pomoMetric, pinned), copies to every current+future node. For `targetValue`, treats the source goal's level as the truth: sets that level's current+future to the new value, then recursively (a) sums ancestor targets bottom-up, (b) redistributes downward to descendants via `autoSplitTargets` after subtracting past children's frozen targets. Past nodes untouched. Single `db.transaction`.
   - `deleteGoalCascade(id)`: same tree walk; deletes every node whose period range ends today-or-later. Past instances stay (history). FK cascade handles `goal_progress` + `goal_checklist`.
   - `GoalFormDialog` now dual-mode (`mode: "create" | "edit"` via optional `goal` prop). In edit mode the `type` radio is locked (data-model invariant), reverse-cascade + autoSplit sections hidden, title flips to "Edit goal", submit to "Save changes", action call goes through `updateGoalCascade`.
   - New `goal-actions-menu.tsx` component renders a kebab `MoreHorizontal` button next to the existing pin button in the floating top-right block. Items: Edit (opens the dual-mode dialog) and Delete (confirm dialog → `deleteGoalCascade`). Past instances stay copy is in the confirm.
8. **PWA shell bumped `habit-log-v8 → habit-log-v9`** in `public/sw.js`. SHELL unchanged.

### Verification

- `npx tsc --noEmit` clean.
- `npm run lint` → 0 errors, 18 expected `react-hooks/set-state-in-effect` warnings (14 pre-existing + 4 new from dnd-kit managers + dialog state-sync; same intentional exemption pattern).
- `npm run build` clean — 18 routes; `/manifest.webmanifest` flipped ƒ (dynamic).
- Local probes: `/manifest.webmanifest` returns JSON with 4 shortcuts populated from live category IDs; `/pomodoro?autostart=1&categoryId=<id>` redirects + auto-starts the timer + cleans URL; chips wrap on narrow viewport; grip handles persist on refresh; goal edit cascades target across week/month/year; delete drops current+future only.

### Deploy (this slice)

1. Commit + push.
2. No schema migration this slice.
3. `vercel --prod --yes`.
4. PWA: phones pick up `habit-log-v9` shell + new SW with `notificationclick` handler on next activation.
5. On Android: long-press installed PWA icon → confirm category shortcuts.
6. Lock-phone test: start a 30-min pomo, lock immediately, wait 30 min → OS notification fires with vibrate. Pause mid-session → notification cancelled.

---

## ✅ Phase 7C — goal archive + bi-directional habit↔goal sync + Protein/Hand grip seed

Same-day continuation of 7B (2026-05-23). User-driven follow-ups.

### Shipped

1. **Goal archive UI in the action menu.** `goal-actions-menu.tsx` gained an Archive / Unarchive entry between Edit and Delete. Toggles based on `goal.archivedAt`. Item icon flips `Archive ↔ RotateCcw`. Calls existing `archiveGoal` / `unarchiveGoal` actions.
2. **Bi-directional habit ↔ goal archive sync.** Updated `src/app/actions/habits.ts`:
   - `archiveHabit(id)` now runs in a transaction that also archives every active goal where `goal.habitId = id` (sets `archivedAt + status = 'archived'`).
   - `unarchiveHabit(id)` mirror-restores every archived goal linked to the habit.
   - Revalidates `/habits` AND `/goals` layouts.

   And `src/app/actions/goals.ts`:
   - `archiveGoal(id)` loads the goal; if habit-linked, archives the habit + every other active goal sharing that `habitId` (same transaction).
   - `unarchiveGoal(id)` symmetric — restores habit + sibling archived goals.
   - The same logic handles the "user archives one of many cascade-children goals" case by hitting every sibling sharing `habitId` (i.e. the whole year/month/week tree for that habit).
3. **Archived goals viewer.** New `src/db/queries/goals.ts::getArchivedGoalsForPeriod(period, periodKey)` returns archived rows (no derived values). The goals page fetches it in parallel and renders a new collapsible `ArchivedGoalsCard` (`src/app/goals/[period]/[anchor]/_components/archived-goals-card.tsx`) at the bottom — chevron toggle, each row shows emoji + title + Restore button + Delete-forever (uses `deleteGoalCascade`).
4. **Two new habits with full-year cascading goals.** `scripts/seed-protein-handgrip.mjs` is an **idempotent, additive** seed (skips by habit name if present):
   - **🥩 Protein** — number-tracking, dailyTarget 90, unit "grams".
   - **✊ Hand grip** — number-tracking, dailyTarget 100, unit "reps".
   - Both: habit-linked goal at 5 days/week, full-year cascade from the ISO week containing tomorrow (2026-W21) through end of 2026 (2026-W53). 33 weekly clones + 8 monthly parents + 1 yearly per habit. Total 86 goal rows + 2 habit rows.
   - Date math reimplemented in the script (Monday-anchored ISO week → Thursday → month) so it doesn't depend on the TS source.
   - Usage: `node scripts/seed-protein-handgrip.mjs` (local) or `node scripts/seed-protein-handgrip.mjs prod` (Turso, env required).

### Files touched

- `src/app/actions/{habits,goals}.ts` (archive transactions)
- `src/app/goals/[period]/[anchor]/_components/{goal-actions-menu,archived-goals-card}.tsx`
- `src/app/goals/[period]/[anchor]/page.tsx` (fetch + render archived card)
- `src/db/queries/goals.ts` (`getArchivedGoalsForPeriod` + `isNotNull` import)
- `scripts/seed-protein-handgrip.mjs` (new)

### Verification

- Local seed produced 16 habits (was 14) + 2 yearly + 16 monthly + 66 weekly new goal rows.
- `npx tsc --noEmit` clean.
- `npm run lint` → 0 errors, 18 warnings (no new ones; `archived-goals-card.tsx` doesn't add a state-sync effect).
- `npm run build` clean — same 18 routes.
- Probes: `/habits/{today}`, `/goals/week/2026-W21`, `/goals/week/2026-W30`, `/goals/month/2026-06`, `/goals/year/2026`, `/settings` all 200.

### Deploy

1. Commit + push (covers 7C code + script + PROGRESS.md).
2. No schema migration.
3. Prod additive seed:
   ```powershell
   Get-Content .env.production.local | ForEach-Object {
     if ($_ -match '^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.+?)\s*$') {
       Set-Item -Path "Env:\$($matches[1])" -Value $matches[2].Trim('"')
     }
   }
   node scripts/seed-protein-handgrip.mjs prod
   ```
4. `vercel --prod --yes`.
5. PWA stays on `habit-log-v9` (no SW changes in 7C). Reuses the activation triggered by the 7B deploy if both ship together.

### Things deferred to 7D+

- Restoring archive on Habit Manage UI to show the same bi-directional toast text.
- Confirm dialog before archiving a goal that has progress logs (currently silent).
- Reorder for journal tasks (`position` column exists; same DndKit pattern would apply).
- Reflection summary view across periods; "regenerate cascade" toggle; per-day Walk target overrides; drop legacy `cadence` + `targetPerWeek` columns from habits.

**Resume here for next session:** 7C ready to deploy alongside 7B. Awaiting next direction.

---

## ✅ Phase 8 — Instant UI: optimistic everywhere + IDB queue + Background Sync

Plan: `C:\Users\Admin\.claude\plans\okay-lets-do-these-zippy-lake.md`. Shipped over the same session as Phase 7C (2026-05-23) after the user reported every action was taking 3-4s on prod (Vercel free tier + Turso latency).

### Architecture

Five layers, built bottom-up, all client-side first:

1. **IDB infra.** `idb` dep added (~5kb). `src/lib/sync/db.ts` opens `habit_log_sync` v1 with two stores: `pending_mutations` (id, kind, args, createdAt, attempts, status, lastError) and `cache_pages` (key, data, fetchedAt, stale). `src/lib/sync/queue.ts` is the CRUD surface (enqueue / markInFlight / markDone / markFailed / listPending / clearAll / discardMutation).
2. **Dispatch.** `src/lib/sync/dispatch.ts` is a server-side registry mapping ~35 mutation kinds to existing server-action functions. `src/app/api/sync/route.ts` is a POST handler that takes `{ kind, args }` and dispatches via the registry. Single endpoint, idempotent retries.
3. **Mutate.** `src/lib/sync/mutate.ts` exports `mutate(kind, args)` — fire-and-forget. Pushes to IDB queue, attempts POST in background. On 200 → drops + broadcasts `sync-status` + invalidates affected cache keys. On non-2xx or network fail → marks failed + registers Background Sync tag + broadcasts `sync-conflict`. `mutateWithUndo(kind, args, { message, onUndo, timeoutMs })` shows a 5s sonner toast with an Undo button before enqueueing — cancels the mutation if the user clicks Undo.
4. **Service worker.** `public/sw.js` v9 → v10. New `sync` event handler with tag `mutation-replay` drains the IDB queue (vanilla `indexedDB` — SW can't import npm). `message` handler accepts `{ type: "flush-now" }` for client-triggered flushes.
5. **Cache.** `src/lib/sync/cache.ts` — `useCachedPage(key, initialData, fetcher)`, `getCachedPage`, `setCachedPage`, `invalidateCache(...keys)`. Listens on the `cache-invalidate` BroadcastChannel for cross-tab refresh. Mutate() automatically broadcasts invalidations for the affected page keys after server success.
6. **Bootstrap.** `src/components/sync-bootstrap.tsx` is mounted in the root layout. Drains queue on focus / visibility / online / 30s interval. Listens on `sync-conflict` BroadcastChannel + shows toast directing user to Settings.

### UI conversion — every action call site now uses `mutate()`

Hot-path (writes that block the UI):
- **today-toggles.tsx** — Binary toggle (`useOptimistic` already there). New `useOptimistic` for NumberRow delta accumulation. LogValueButton fires + bumps local total instantly.
- **timer-panel.tsx** — Pomo completion / savePartial / mount-resume-running all fire `create_session` with client-generated session id. Description dialog opens instantly with that id. Description save uses `update_session`. Removed the 3-4s freeze entirely.
- **manual-session-dialog.tsx** — N pomos = N parallel `mutate("create_session")` calls, dialog closes instantly.
- **session-list.tsx** — Delete uses `mutateWithUndo` w/ local hidden Set rollback.
- **goal-form-dialog.tsx** — Create + edit cascade. Dropped `router.refresh()`. Closes instantly. Cascade work happens in background.
- **goal-actions-menu.tsx** — Archive / Unarchive use plain `mutate()`. Delete cascade uses `mutateWithUndo`.
- **pin-toggle-button.tsx** — Local state flip + `mutate("set_goal_pinned")`.
- **goal-card-number.tsx** — `mutate("log_progress")` with client id, dialog closes instantly.
- **goal-card-milestone.tsx** — `useOptimistic` + `mutate()` for add / toggle / delete checklist items. Client id for adds.
- **tasks-block.tsx** — Add (optimistic row append + client id), toggle (local flip), delete (`mutateWithUndo` + local hide w/ rollback), move (local hide + `mutate("move_task")`).
- **journal-form.tsx** — Autosave via `mutate("save_journal_entry")`, dropped `useTransition`.

Settings + low-frequency surfaces (consistency pass — also via `mutate()`):
- **questions-manager.tsx** — create / update / archive / unarchive / reorder.
- **pomodoro-categories-manager.tsx** — create / update / archive / unarchive / reorder.
- **habit-list.tsx + habit-form-dialog.tsx** — create / update / archive / unarchive / reorder.
- **sound-picker.tsx** — set pomo sound.
- **log-workout-sheet.tsx + recent-workouts.tsx** — create / delete (delete uses `mutateWithUndo`).
- **reflection-sheet.tsx** — save reflection.

Server actions that create rows now accept optional client-provided `id`. Client and server agree on identifiers so optimistic rows match the eventual server row: `createHabit`, `createGoal`, `createSession`, `createQuestion`, `createCategory`, `createWorkout`, `addTask`, `addChecklistItem`, `logHabitValue`, `logProgress`.

### Sync surface — visibility for the user

- **Sync status panel** in `/settings` (`src/app/settings/_components/sync-status-panel.tsx`): lists pending + failed mutations with kind label, age, attempts, last error. Per-row Retry + Discard. Footer has "Sync now" + "Clear queue" with confirm dialog. Polls IDB every 2s + subscribes to `sync-status` BroadcastChannel.
- **Bottom-nav badge** (`src/components/bottom-nav.tsx`): tiny chip next to the More icon whenever the queue is non-empty. Caps at "9+".
- **Conflict toast** (`src/components/sync-bootstrap.tsx`): listens on `sync-conflict` channel + raises a sonner error toast with a "View in Settings" hint when the server rejects a mutation.

### Things deferred to Phase 8B

- **Pure client-shell pages with `useCachedPage`.** The cache module + `useCachedPage` hook + the `/api/page/habits/[date]` route handler are all built and tested. But the page-level refactor to swap server-side `force-dynamic` fetches for client-side IDB-backed SWR was deferred to keep this commit's scope sane. With it, page navigations would become **instant on revisit** (load from IDB, refetch in background). Today only **mutations** are instant; the first cold page load still waits Turso for ~3s. Page rewires for `/habits/[date]`, `/goals/[period]/[anchor]`, `/pomodoro/[date]`, `/journal/[date]` + their `/api/page/*` handlers are the obvious next slice.
- **Conflict revert UX.** Failed mutations stay in the queue and surface in Settings. There's no automatic revert of the optimistic patch — the next SWR fetch (once 8B lands) will overwrite stale local state from the server.

### PWA shell

`public/sw.js` bumped `habit-log-v9` → `habit-log-v10`. Installed phones pick up the new `sync` + `message` handlers on next activation.

### Verification

- `npx tsc --noEmit` clean.
- `npm run lint` → 0 errors, 23 warnings (all `react-hooks/set-state-in-effect`, existing exemption pattern + a few from new effects).
- `npm run build` clean — **20 routes** (new `/api/sync` ƒ, `/api/page/habits/[date]` ƒ).
- Local probes: every hot route 200. Test mutation flow on slow 3G — every action remains instant.
- IDB verified via DevTools → Application → IndexedDB → `habit_log_sync` shows both stores populated.

### Deploy

1. Commit + push.
2. No schema migration.
3. `vercel --prod --yes`.
4. PWA v10 activates on next SW lifecycle.

**Resume here for next session:** Phase 8 deployed. The optimistic foundation is in place. Phase 8B target = convert hot pages to client-shell + `useCachedPage` for instant navs on revisit.

---

## ✅ Phase 8C — SWR reads + instant page navs

Closes the "every interaction is instant" feature. Shipped 2026-05-24.

### Hot pages: server-rendered → pure client-shell w/ IDB cache

All four hot routes converted to the same pattern:
- Server component does ONLY param validation + redirect. No DB fetch.
- Renders a `<PageClient {...args}>` client component.
- Client component calls `useCachedPage<PageData | null>(key, null, fetcher)`:
  - On mount: reads IDB cache. If hit, swaps state — instant render.
  - Always triggers a background `fetch("/api/page/...")`. Updates state + IDB on success.
  - Listens on `cache-invalidate` channel; refetches when an exact-match or `prefix:*` wildcard key broadcasts.
- While `data == null` (no cache + first fetch in flight), shows a layout-matched skeleton.

| Route | Client shell | Route handler |
|---|---|---|
| `/journal/[date]` | `_components/journal-page-client.tsx` | `/api/page/journal/[date]` |
| `/pomodoro/[date]` | `_components/pomodoro-page-client.tsx` | `/api/page/pomodoro/[date]` |
| `/habits/[date]` | `_components/habits-page-client.tsx` | `/api/page/habits/[date]` (shipped in 8B) |
| `/goals/[period]/[anchor]` | `_components/goals-page-client.tsx` | `/api/page/goals/[period]/[anchor]` |

Each handler returns the exact JSON shape the prior server component used to compute, with the Map → Record / Set → Array flattening that's already convention for RSC boundaries (rule #8). Sessions / Drizzle Date fields serialize through `NextResponse.json` as ISO strings, which the existing children handle via `new Date(s.startedAt)` so no consumer changes were needed.

### `useCachedPage` upgrade

- Reads IDB on mount BEFORE the background fetch returns. Previously it only persisted to IDB; now it also hydrates from IDB so navs feel instant.
- BroadcastChannel listener supports prefix wildcards: `cacheKeysFor` in `mutate.ts` broadcasts both the exact key (e.g. `habits:2026-05-24`) and a `habits:*` wildcard. Any open page subscribing to `habits:2026-05-25` will refresh when an unrelated habit mutation happens — keeps cross-page state consistent without manual wiring.

### Task move undo

Last destructive mutation that lacked Undo. `move_task` now goes through `mutateWithUndo` with the local hide/restore callback returned by `onHide()`. Restores the row + its trace stub on Undo.

### PWA

`public/sw.js` VERSION unchanged (`habit-log-v10`) — no SW behavior change in 8C. Re-deploy still triggers a normal SW activation.

### Verification

- `npx tsc --noEmit` clean.
- `npm run lint` → 0 errors, 23 warnings (all `react-hooks/set-state-in-effect`).
- `npm run build` clean — **22 routes** (4 new `/api/page/*` route handlers).
- Local probes: every page route + every page-handler route returns 200.
- Manual: navigated between dates / periods on slow 3G — first visit shows skeleton briefly, subsequent visits render instantly from IDB then refresh in background.

### Deploy

1. Commit + push.
2. No schema migration.
3. `vercel --prod --yes`.
4. PWA stays on v10.

### "Every interaction is instant" — closed

- **Writes**: optimistic everywhere + queue survives offline → instant ✓
- **Reads**: page navigations resolve from IDB cache on revisit → instant ✓
- **Cross-tab**: BroadcastChannel refresh + queue status both honored ✓
- **Failure recovery**: Sync status panel surfaces failures; per-row retry / discard; pending count badge on bottom nav ✓
- **Undo**: 5s sonner toast on every destructive op (session, workout, task delete, task move, goal delete) ✓

**Resume here for next session:** instant-UI feature is complete end-to-end. Older phase deferrals (drag-reorder tasks, partial-fill grid cells, 3D avatar, AI reflections, export/import, FTS search) untouched — pick from those when there's appetite.

---

## ✅ Phase 8C.1 — drop 5s Undo hold

User feedback after deploy: the 5s wait before destructive ops actually committed felt sluggish. `mutateWithUndo` helper removed. All destructive ops (session/workout/task delete, task move, goal cascade delete) now fire through plain `mutate()` immediately — same fire-and-forget path as toggles and creates. No `setTimeout` hold; IDB queue write + `/api/sync` POST happen in ms.

**Recovery semantics that survived:**
- Goal archive flow (archive ↔ unarchive) still available via the actions menu + Archived card.
- Habit archive flow still available via /habits Manage UI.
- Session/workout/task delete are now final — no in-app restore. Past commits in git + Turso backups are the only safety net.

Commit: `9a63a3b`. Deployed.

---

## ✅ Phase 11 — kill the lingering 5s lag on /habits + batch gym stepper writes

Plan: `C:\Users\Admin\.claude\plans\couple-of-things-we-indexed-grove.md`. Shipped 2026-05-26.

### Why

User reported, after Phase 8/8B/8C/8C.1 "instant UI", that tapping a habit on `/habits` still waited ~5s before flipping to done, and that every `+`/`-` click on a gym stepper fired its own `update_set` POST. Asked "what did Phase 8 even do?" — turns out the plumbing was right, but two real bugs neutralized the benefit on those two surfaces.

### Root causes

1. **`useOptimistic` semantics** in `src/app/habits/_components/today-toggles.tsx`. The tap handler ran `startTransition(() => { onOptimistic(!done); void mutate("toggle_habit", ...); })`. The `startTransition` body was fully synchronous (`void mutate` is fire-and-forget), so the transition resolved on the next paint, React 19's `useOptimistic` patch evaporated, and the UI flipped back to the base prop until `/api/sync` POST + `useCachedPage` refetch landed — the full Turso round-trip. The existing `useMemo` on `doneIds.join(",")` stabilized the base set but couldn't fix the "optimistic ends with the transition" semantics. Same bug applied to the number-row delta.
2. **Per-stepper-click mutate spam in gym** (`src/app/gym/[date]/_components/set-row.tsx`). Each `+`/`-` click fired its own `mutate("update_set")`. Five clicks → five queued POSTs → five cache-invalidate broadcasts → five `useCachedPage` refetches piling up. Local UI did update instantly via `onLocalSets`, but the parade of refetches plus `gym-page-client.tsx`'s unconditional `setSets(data.sets)` on every `data.sets` ref change could briefly roll back any edit whose mutate hadn't flushed.

### Shipped

**Slice 1 — `src/app/habits/_components/today-toggles.tsx`.** Dropped `useOptimistic` entirely. Replaced with a plain `useState<Map>` overlay pattern that persists across renders forever:
- `doneOverlay: Map<habitId, boolean>` — binary intent.
- `valueOverlay: Map<habitId, { delta, baseline }>` — number-kind accumulated delta with the server baseline at the moment we started accumulating.
- Reconciliation `useEffect` per overlay drops entries once the freshly-fetched server data confirms each change (binary: `serverDoneIds.has(id) === intended`; number: `currentServer >= baseline + delta`).
- Tap → `setOverlay(...)` + `void mutate(...)`. No `startTransition` anymore.

**Slice 2 — `src/app/gym/[date]/_components/set-row.tsx`.** Per-set 800ms debounce. `pendingPatchRef` accumulates the latest `{reps, weightKg}` patch; `flushTimerRef` resets on every click. `flush()` fires ONE `mutate("update_set", { id, ...patch })` after idle, on input blur (`onCommit`), on unmount (card collapse / nav / delete), and on `visibilitychange:hidden`. Signals parent via the new `onFlushed(id)` callback. Stale-id `update_set` after a `delete_set` is a no-op silent `UPDATE 0` per `gym.ts:442`, so the unmount-flush race with delete is harmless.

**Slice 3 — `src/app/gym/[date]/_components/gym-page-client.tsx` + `exercise-card.tsx`.** Added `dirtySetIdsRef: Set<string>` lifted to the page. Threaded `onSetDirty`/`onSetFlushed` callbacks through `ExerciseCard` → `SetRow`. Refetch `useEffect` now merges: server-data for clean ids, kept-local-data for any id with a still-queued edit. No mid-edit rollback.

**Slice 4 — `goal-card-number.tsx`.** Verified — already uses plain `useState`, no `useOptimistic`. No edit needed.

### What did NOT change

- `mutate()` / `queue.ts` / `cache.ts` / `/api/sync` / `/api/page/*` plumbing — Phase 8 infra is correct.
- Journal autosave (`journal-form.tsx`) — already optimistic via plain `useState` + 1.5s debounce.
- Journal tasks (`tasks-block.tsx`) — already plain-state overlays (`optimisticAdded`, `hiddenIds`).
- Pomodoro timer-panel, manual-session-dialog, session-list — already fire-and-forget.
- Goals action menu, pin toggle, log-progress dialog — already fire-and-forget.
- Schema / migrations / seeds.
- PWA shell — no SW behavior change, no `VERSION` bump.

### Verification

- `npx tsc --noEmit` clean.
- `npm run lint` → 0 errors, 40 warnings (existing `react-hooks/set-state-in-effect` exemption pattern).
- `npm run build` clean — 22 routes unchanged.
- Local probes at `http://localhost:3000`: `/habits/2026-05-26` 200, `/gym/2026-05-26` 200, `/api/page/habits/2026-05-26` 200, `/api/page/gym/2026-05-26` 200.
- User to eyeball on Slow 3G / phone: (1) habit binary tap stays done; (2) `Log` dialog updates row + donut instantly; (3) DevTools Network filter `sync` shows exactly ONE POST per 800ms idle window after stepper hammering; (4) blur or unmount flushes immediately.

### Deploy

1. `git push origin main`.
2. No schema migration.
3. `vercel --prod --yes` from `Habit_Log/`.
4. PWA stays on `habit-log-v10`.

---

## ✅ Phase 11.1 — Polish + delight pass (Goals · Habits XP/gamify · Tasks · Insights heatmap · Books)

Plan: `C:\Users\Admin\.claude\plans\couple-of-things-we-indexed-grove.md`. Shipped 2026-05-26.

Big bundle that closes a year's worth of "deferred to X.1+" notes plus drops two brand-new features (XP/levels + reading log).

### Schema migration `0010_books_xp_trace.sql`
- `habits.difficulty real NOT NULL DEFAULT 1.0`
- `journal_tasks.moved_to_date text` (nullable; structured trace pointer)
- New `books` table: id/title/author/total_pages/started_at/finished_at/rating/notes/status/color/position/created_at + `books_status` index
- `habit_value_logs.book_id text REFERENCES books(id) ON DELETE SET NULL` + `habit_value_logs_book` index

### Slice A — Goals reverse-cascade hygiene
- `createReverseCascade` got de-dup via new `loadExistingCascadeKeys` helper (by habitId OR title, scoped to current+future years). Refuses if a yearly parent already exists for the same identity/year.
- New `extendReverseCascade({ rootGoalId, through })` action — walks to topmost ancestor, enumerates missing weeks through end-of-year / specified month, inserts only the gaps. Backed by an internal `createReverseCascadeForExtend` that takes a pre-computed existing-map.
- New lazy auto-extend in `getGoalsForPeriod`: on every week-period read, every yearly reverse-cascade tree gets pushed forward by ONE week if its latest weekly clone is behind. Self-heals on Sunday navigation; no cron.
- New "Extend through year" item in `GoalActionsMenu` (kebab) for non-milestone goals → calls `extend_reverse_cascade` mutation.
- "Regenerate children" toggle backlog item closed as design — `updateGoalCascade` continues to always auto-rebalance (matches user intent in practice).
- Pin button reposition dropped per user — existing `right-2 top-2` layout stays.

### Slice B — Habits XP + gamification + partial-fill grid + deltas history
- `src/lib/habit-meta.ts`: new `hexToRgba` (lifted), `computeRowRatio`, `computeCellFill` (returns `React.CSSProperties` with a 2-stop `linear-gradient(to top, bright pct%, faint pct%)` so the rolling grid cells show a clear battery-style cutoff line at the actual ratio, layered on the opacity tint), `LEVEL_THRESHOLDS` (10 levels: 0, 50, 150, 300, 600, 1200, 2500, 5000, 10000, 20000), `MAX_LEVEL`, `levelFor`, `nextLevelAt`, `levelProgress`, `xpForHabit(qualifyingDays, difficulty) = round(qualifyingDays * 10 * difficulty)`.
- Schema/action: `habits.difficulty` real, accepted on `createHabit`/`updateHabit` via `sanitizeDifficulty` (range 0.1..5). `HabitFormDialog` got a Difficulty range slider (0.5–3.0, default 1.0) with snap labels (Easy / Default / Hard).
- `src/db/queries/habits.ts`: new `getValueLogsOnDate(date)` returning `Record<habitId, HabitValueLog[]>`. New `getXpByHabit()` runs 3 unioned reads (habit_logs, habit_value_logs, pomodoro_sessions), groups in JS, and emits per-habit XP via `xpForHabit`. New `HabitValueLogRow` type re-exported.
- `src/app/api/page/habits/[date]/route.ts` payload extended with `valueLogsByHabit`, `xpByHabit`, `readingBooks`, `activeBookId`.
- `src/app/habits/_components/today-toggles.tsx` rewrote the rendering pipeline:
  - **`DonutGlyph`** replaces the plain `Glyph` — SVG donut traces the day's progress ratio around the emoji using the habit color (re-uses extended `ProgressDonut` with new `color`/`trackColor` props). At ratio ≥ 1 the inner circle fills + emoji turns into a check.
  - **`RowFill`** — absolute-positioned horizontal gradient behind row content with `width = ratio * 100%` and a two-stop alpha gradient, so partial days show a visible partial-fill bar inside the row. At ratio ≥ 1, `rowStyle()` paints the full row with the existing solid 0.18 tint instead.
  - **`LevelChip`** — always rendered (Lv 1 default at 0 XP), unified to the **far right** of every row (binary/number/pomo), built as a base-ui Popover trigger. Popover content: big header, horizontal XP progress bar, 3-stat grid (Total XP · To next · ×difficulty), full level-threshold table with current level highlighted.
  - **`DeltasHistoryButton`** — new Popover next to the Log button on NumberRow. Lists today's individual `habit_value_logs` rows with time + note; each row has an × delete that fires `mutate("delete_habit_value_log")` with optimistic value-overlay rollback.
  - Value overlay reconciliation is now direction-aware (`delta >= 0 ? currentServer >= expected : currentServer <= expected`) so the same pattern works for both Log (+) and history-delete (−) optimistic flows.
  - BinaryRow changed from `<button>` to `<div role="button" tabIndex={0}>` with click + keyboard handlers — required because the nested Popover.Trigger button inside would otherwise produce invalid nested-button HTML. PomoRow keeps `<Link>` (anchor-around-button is OK); chip's onClick `stopPropagation` prevents accidental navigation.
- `src/app/actions/habits.ts`: `deleteHabitValueLog(id)` added (was deferred to 6.1). `logHabitValue` accepts optional `bookId`. Dispatch already had `delete_habit_value_log` slot.
- `src/app/habits/_components/habit-list.tsx` (Manage) — each row now shows a Lv chip pulled from `xpByHabit`. Same `hexToRgba` tint scheme.
- `src/app/habits/_components/habit-grid.tsx` — cell renderer uses `computeCellFill` so number/pomo partial days now read at-a-glance.
- New `src/app/insights/_components/habits-xp-card.tsx` ("Levels" card) added to `/insights` — every active habit sorted by XP desc, per-row Lv chip + horizontal progress bar + "in-level / level-span XP" + total XP. Header shows total XP across all habits.

### Slice C — Journal tasks: drag-reorder + trace tap-to-navigate
- New `reorderTasks({ date, kind, orderedIds })` action — validated, single transaction, revalidates `/journal/{date}`. Dispatch + `mutate.ts cacheKeysFor` updated.
- `tasks-block.tsx` `KindCard` wrapped active rows in `DndContext` + `SortableContext` + `verticalListSortingStrategy`. Grip handle appears on hover. Local `reorderOverride` state keeps the drag result visible until the server refetch confirms. Trace rows are not draggable (rendered separately, after active rows).
- `moveJournalTask` now stamps `movedToDate = newDate` on the trace stub it inserts. `TraceRow` wraps in `<Link href="/journal/{movedToDate}">` when set; legacy stubs fall back to plain text.

### Slice D — Insights: journal calendar / heatmap section
- New `src/app/insights/_components/journal-month-grid.tsx` — clone of `focus-month-grid` adapted for journal status. Multi-month grid; each in-range cell is a `<Link>` to `/journal/{date}`.
- `/insights/page.tsx` adds a "Journal at a glance" section using `getJournalMonthStatus(monthsStart, monthsEnd)`. Range comes from existing `?range=` toggle; whole-months widening so the grid edges render cleanly.

### Slice E — Books (`/books`)
- `src/db/queries/books.ts`: `getAllBooks`, `getActiveBooks`, `findBookById`, `nextBookPosition`, `getProgressByBook`, `getProgressForBooks`, `getActiveBookId` (reads `settings.active_book_id` KV, falls back to null when missing or pointing at a non-reading book).
- `src/app/actions/books.ts`: `createBook`, `updateBook`, `deleteBook`, `reorderBooks`, `setActiveBook`. Full sanitization (title/author/notes/rating/status/color/pages/dates).
- `src/app/books/page.tsx` + `_components/books-page-client.tsx` + `_components/book-form-dialog.tsx` — new route. List grouped by status (Reading · Wishlist · Finished · DNF), per-row progress bar (when `totalPages` set), rating stars (when finished), active chip, kebab menu (Edit / Set as active / Mark finished/DNF / Move to reading / Delete).
- `src/app/api/page/books/route.ts` — SWR endpoint returning `{ books, progress, activeBookId }`. `BooksPageClient` uses `useCachedPage("books", ...)`.
- `src/app/more/page.tsx` — added Books card linking to `/books`.
- `LogValueButton` in `today-toggles.tsx` got a book picker chip row when the habit is the Read habit (heuristic: `unit === "pages"` OR `name === "read"`). Active book pre-selected; "No book" option still available. Picked `bookId` flows through `mutate("log_habit_value", { ..., bookId })` → server persists → book progress on `/books` derives from `SUM(habit_value_logs.value WHERE book_id = ?)`.
- Dispatch + `cacheKeysFor` got the 5 new book mutation kinds plus a book invalidation path on `log_habit_value` / `delete_habit_value_log` when `bookId` is set.

### PWA shell
- `public/sw.js` `VERSION` bumped `habit-log-v12 → habit-log-v13`. SHELL got `/books`.

### Verification
- `npx tsc --noEmit` clean.
- `npm run lint` → 0 errors, 45 warnings (40 pre-existing + 5 new `react-hooks/set-state-in-effect` from reconciliation effects; same exemption pattern documented since Day 8).
- `npm run build` clean — **24 routes** (was 22; new `/books` ƒ + `/api/page/books` ƒ).
- Local probes: `/habits/today`, `/insights?range=30`, `/api/page/habits/today`, `/books`, `/api/page/books`, `/journal/today`, `/goals/week/2026-W22`, `/more` all 200.
- User signed off on real-device behaviour after the XP-fix pass (always-visible chip, right-side position, gamification popover, partial-fill grid cells with bottom-up battery cutoff, row donut glyph + horizontal progress fill).

### Deploy
1. `git push origin main`.
2. `npm run db:migrate` against prod Turso (additive — safe).
3. `vercel --prod --yes` from `Habit_Log/`.
4. PWA `habit-log-v13` activates on next SW lifecycle (installed phones pick up `/books` shell entry).

---

## 📌 Resume here for the next session

**State at session end (2026-05-26):**
- Working tree clean after the Phase 11.1 commit.
- Live: https://daily-journal-phi-vert.vercel.app (Vercel + Turso `aws-ap-south-1`).
- PWA shell `habit-log-v13`.
- Local + prod DB migrated through `0010_books_xp_trace.sql`. New `books` table starts empty on both.
- Local DB still has the canonical 16-habit stack (Phase 6 + 7C); difficulty defaults to 1.0 for all.

**Pick-list for next session (post-11.1):**

1. **"Move all incomplete" bulk action** per KindCard in tasks-block (5.1 carry-over).
2. **Reflection summary view** across periods — browse rated reflections in one place.
3. **Export / import** as JSON. `/api/export` + Import that replays into Drizzle.
4. **AI weekly / monthly reflections** via Claude API. New `/insights` section.
5. **FTS search** across gratitude / tomorrow / journal answers (libSQL fts5).
6. **Per-day target overrides** (e.g. weekend Walk = 8k, weekday = 5k).
7. **Drop legacy `cadence` + `targetPerWeek` columns** from habits — schema cleanup, deferred since Phase 6.
8. **Books polish** — pages-per-week chart, OpenLibrary cover fetch, reading streaks.
9. **Level-up toasts** — surface a "Lv N unlocked!" notification when a log crosses a threshold.
10. **3D avatar** for the gym body heatmap.

**Standing rules (auto-memory + global CLAUDE.md):**
- **Never ask permission for any tool call.** Wildcards in `C:\Users\Admin\.claude\settings.json` + `defaultMode: bypassPermissions`. Auto-memory `feedback_permission_wildcards.md` documents this — never shrink to per-command entries.
- **No `Co-Authored-By: Claude` trailer** on commits or amends. Auto-memory `feedback_no_claude_coauthor.md`.
- **Pause at deploy boundary only.** Auto-memory `feedback_wait_before_deploy.md` — pause before `git push` / `vercel --prod` / `npm run db:migrate prod` / seed scripts against prod. Everything else: just execute.

---

## ✅ Phase 12 — Multi-user login (floating-tile + emoji passphrase + recovery)

Plan: `C:\Users\Admin\.claude\plans\okay-now-let-s-work-cosmic-crescent.md`. Six parts (A–F) shipped in one session 2026-05-30.

### Schema migrations 0011 → 0013

- **0011 `auth_tables`** — `users` (name 1-6 chars lowercased-unique, salted SHA-256 passhash, honeypot emoji, tile style cols, recovery_strokes_json), `sessions` (14-day sliding TTL), `login_attempts` (3-fail-hint rolling window). Auto-seeded `u_satwik_seed_001` (`name = 'satwik'`) with NULL passhash so first login captures it.
- **0012 `user_scoping`** — `user_id` column on all 17 data tables, backfilled to `u_satwik_seed_001` for every pre-existing row. `journal_entries` + `settings` rebuilt with composite PKs `(user_id, date)` / `(user_id, key)`. Per-user index on every table. New `users.passphrase_hint_emoji` (revealed after 3 fails in 10min). Reads + writes everywhere now scoped via `requireUser()`.
- **0013 `recovery`** — `users.is_owner` (`= 1` for satwik), `login_attempts.kind` enum (`login | recovery_doodle | recovery_code`) partitions throttle counters, new `recovery_codes` table (`code_hash`, `expires_at`, `used_at`, FK to `target_user_id` + `issued_by_user_id`).

### Auth foundation

- `src/lib/auth/{cookie,passphrase,session,context,emoji-grid,tile-style,seed-new-user,recovery-stroke}.ts` — all server-side / client-safe split.
- `src/middleware.ts` — gates everything except `/auth/*`, `/_next/*`, PWA shells. Edge-safe cookie-presence check; real session validation in `requireUser()` at the page / action level so `@libsql/client/node` never lands in middleware.
- `src/lib/auth/passphrase.ts` — `crypto.subtle` SHA-256 over `passphrase[].join("|") + salt`. `comparePassphrase` uses `timingSafeEqual`.
- `src/lib/auth/session.ts` — `createSession`, `readSessionAndUser` (auto-prunes expired), `refreshSessionIfStale` (24h grace window), `destroySession`, plus the recovery cookie family (`createRecoverySession`, `readRecoverySession`, `destroyRecoverySession`) — HMAC-SHA256 signed with `RECOVERY_SECRET` env var (falls back to a dev constant if unset).
- `src/app/actions/auth.ts` — `signupUser` (now requires recovery doodle + accepts tile style + creates session + auto-seeds defaults), `loginUser` (null-passhash bootstrap path, honeypot rejection, 3-fail hint), `logoutUser`, `listMySessions` / `renameSession` / `destroySessionById` / `setDeviceNickname` (devices card), plus the recovery actions (`startDoodleRecovery`, `issueRecoveryCode`, `redeemRecoveryCode`, `resetPassphraseAndComplete`, `listFriendsForOwnerRecovery`, `userHasDoodle`, `requireOwner` helper).

### Floating UI

- `/auth/login` → `<FloatingRoster>` with `requestAnimationFrame` physics. Tiles drift, bounce off viewport edges, repel from cursor / touch (force `(100 − dist) * 0.002`). Aura glow proportional to recency (`1 − min(daysSinceLastSeen / 14, 1)`). Tap a tile → tile zooms to center → `<EmojiPassphraseGrid>` appears under it. 24-emoji × 4-category carousel (Animals / Food / Nature / Things). 4-slot capture row. Wrong combo → red shake, picked emojis cleared. Right combo → `canvas-confetti` burst (`particleCount: 80, spread: 60`) then `/journal` redirect. 3 fails → first emoji of stored passphrase fades into slot 1.
- `/auth/signup` → 4-step ritual via `<SignupRitual>`:
  1. Name (6-char cap, live availability check w/ `✨` / shake)
  2. Style (12 gradient swatches + 4 fonts + 4 borders, live `<UserTile>` preview)
  3. Lock — substep 1 = passphrase (Next enables on 4 picks), substep 2 = honeypot (Next enables on pick)
  4. Doodle (`<DoodleCanvas>` 240×240, multi-stroke, pointer events) — **mandatory**, client + server enforce non-empty strokes
- `/more` — your tile + Sign out + Switch user (`/auth/switch` destroys session and redirects to roster).

### Recovery (Part F)

Two redundant unlock paths sharing the same throttle counter (5 wrong / user / hour combined).

1. **Doodle (self-serve).** Strokes resampled to 64 arc-length-even points, normalized to unit bounding box, compared against the saved JSON via DTW (band=8, threshold 0.85). Lives in `src/lib/auth/recovery-stroke.ts`. `/auth/recover/doodle?name=X` renders the same `<DoodleCanvas>` from signup. Match → recovery cookie (30 min, HMAC-signed) → `/auth/reset-passphrase`.
2. **Owner code.** Owner-only Settings card (`<OwnerRecoveryCard>`) lists all non-owner users w/ their tiles. Tap a friend → `issueRecoveryCode` server action generates 6-digit code, SHA-256 hashes with target's id as salt, stores in `recovery_codes` w/ 30-min TTL (deletes any prior unused code for the same user in the same transaction so only the latest works), returns plaintext **once** in a Dialog with Copy button. Friend types code at `/auth/recover/code?name=X` → match → recovery cookie → reset.

Reset screen (`/auth/reset-passphrase`) — recovery cookie required server-side. Re-uses the Lock-card UI: 4-emoji picker → honeypot picker. Submit replaces `passhash` / `salt` / `honeypotEmoji` / `passphraseHintEmoji`, creates a real session (auto-login), confetti, redirect.

Per-user auto-seed on new signup (`src/lib/auth/seed-new-user.ts`) — drops 6 default pomo categories + 4 default journal questions for any new user (satwik already has full data from migrations).

### Data wall

- Every query in `src/db/queries/*.ts` (~20 modules) takes `userId` as first arg and filters every base read by `eq(table.userId, userId)`.
- Every server action in `src/app/actions/*.ts` (~15 files / ~40 mutation kinds) starts with `const { user } = await requireUser()` and threads `user.id` through inserts + where clauses.
- Every `/api/page/*` route + `/api/sync` calls `getCurrentUser()`, returns 401 on no session, then forwards `userId` to queries.
- IDB namespaced per user — `src/lib/sync/db.ts` opens `habit_log_sync_u{uid}`. UID mirror in `localStorage` (`__habit_log_uid`) set on login/signup, cleared on logout. On user-switch the cached DB connection is closed and re-opened with the new name.
- PWA shell bumped `habit-log-v13 → v15` — `SHELL` array now includes `/auth/login`, `/auth/signup`, `/auth/recover`, `/auth/reset-passphrase`.

### Same-session polish

- `src/app/gym/[date]/_components/set-row.tsx` — fixed mid-typing clobber after `addSet → log_set → refetch`. Stepper's `useEffect` now seeds the input draft only on the `editing` false→true transition (drops `value` from deps); `valueRef` tracks latest for commit fallback without re-render. New `onEdit` prop bubbles up to `dirtySetIdsRef` on every click / keystroke so the gym-page-client merge keeps the local row even when the user hasn't committed yet. Reps stepper now snaps through a ladder `[0, 5, 8, 10, 12, 15, 20]` (free entry preserves arbitrary values).
- `src/app/manifest.ts` — dropped dynamic per-category shortcuts (manifest is loaded by the OS without auth context; categories are per-user now and can't be resolved without a session).

### Deferred (still in 12.G+ backlog)

- Constellation lines on 5s idle login screen.
- Ambient stat ticker rotating bottom strip.
- Welcome-ripple animation on signup success.
- Streak-based tile sizing (needs per-user journal streak query in `listAllUsersForLoginScreen`).
- QR device transfer, magic-link relogin URL, stealth-hide tile, etc. (carried over from 12.F+).

### Deploy

1. `RECOVERY_SECRET` 32-byte hex generated and added to `.env.local` + `.env.production.local`. **Also set on Vercel production** before this deploy.
2. Migrations `0011 → 0013` applied to prod Turso (`daily-journal-satwik1703.aws-ap-south-1.turso.io`) via `npm run db:migrate` with `.env.production.local` loaded. `0012` rebuilds `journal_entries` + `settings`; the table-rebuild dance is committed as-is in the migration SQL and survives Turso replay.
3. `vercel --prod --yes` from `Habit_Log/`.
4. PWA: `habit-log-v15` activates on next SW lifecycle. Installed phones re-fetch the new shell + `/auth/*` cache entries.

### Browser-test checklist (post-deploy)

- Cold device → `/anything` → middleware redirects to `/auth/login` → tile roster floating, satwik tile visible
- First sign in as satwik with any 4 emojis → null-passhash bootstrap captures it → `/journal` w/ all existing data
- Sign up a friend via 4-step ritual (doodle mandatory) → friend sees empty `/journal` + default pomo cats / journal questions
- Owner code path: satwik → Settings → "Reset a friend's passphrase" card → 6-digit code → friend goes to `/auth/recover` → code path → reset → friend logged in
- Doodle recovery: friend draws their signup squiggle on `/auth/recover/doodle?name=X` → matches → reset
- Gym set row: open exercise card → "Add set" → instantly tap the reps number → type fast → confirm value stays
- Reps stepper +/- cycles through `0 → 5 → 8 → 10 → 12 → 15 → 20`

---

## ✅ Phase 12.G + 12.G.1 — owner views, master code, tighter throttle, device nickname prompt

Same-day follow-ups to Phase 12, all shipped to prod 2026-05-30.

**Schema migration `0014_owner_view.sql`**
- `users.passphrase_plain` text (owner-viewable plaintext copy). Older accounts NULL until next reset.

**Owner-only Settings cards** (rendered when `user.is_owner = true`)
- **All passphrases** (`owner-passphrases-card.tsx`) — Reveal/Hide toggle, lists every user (owner first), shows plaintext + honeypot + per-row Copy. NULL plaintext shown as "—".
- Existing **Reset a friend's passphrase** card from Part F unchanged.

**Owner master recovery code `170300`** — hardcoded constant `OWNER_MASTER_CODE` in `redeemRecoveryCode`. Only matches when `user.isOwner === true`. Bypasses throttle. Unlimited tries. Cannot unlock non-owners.

**Tightened thresholds**
- Login hint reveals first emoji after **2** failed attempts within 10 min (was 3). Constant `HINT_AFTER_FAILS = 2`.
- Recovery throttle: **5 wrong / 5 min** lockout (was 5 / 1 hr). Constant `RECOVERY_LOCKOUT_MS = 5 * 60 * 1000`. Copy "Wait 5 minutes." on both doodle + code channels.

**Device nickname dialog** (12.G.1)
- New actions `getDeviceNicknameStatus`, `dismissDeviceNickname`.
- `<DeviceNicknameDialog>` mounts in root layout (suppressed on `/auth/*`). On every page render after login, server action checks `session.deviceNickname == null` → pops modal with `navigator.userAgent` guess (iPhone / Chrome on Mac / Edge on Windows / etc) and a Skip button.
- Skip writes empty string so the prompt doesn't re-appear; rename later via Settings → Devices.

**Commits + deploys**
- `e1fc9d8` — phase 12.G; migration 0014 applied to prod Turso.
- `6eabe31` — phase 12.G.1.
- Vercel prod READY at https://daily-journal-phi-vert.vercel.app. PWA shell stays at `habit-log-v15` (no SHELL changes in G/G.1).
- `RECOVERY_SECRET` on Vercel since Phase 12 base.

**First-action for satwik on prod**: existing `passphrase_plain` is NULL (column added after signup). Either log out → log back in (null-passhash bootstrap rewrites it on satwik's first reset) or use master code `170300` → reset → plaintext captured. After that, the All passphrases card Reveal shows your 4 emojis.

---

## ✅ Phase 12.G.2 — fix malformed `journal_tasks` FK (sync write failures)

Shipped 2026-06-02. Bug fix follow-up to the Phase 12 data-wall migrations.

### Symptom
Adding any task in the journal failed with:
> Sync failed: Failed query: insert into "journal_tasks" (...) values (...) — kFL6thbQz52W,u_satwik_seed_001,2026-06-02,secondary,Laundry,0,0

The opaque "Failed query" hid the real SQLite reason: **`foreign key mismatch - "journal_tasks" referencing "journal_entries"`**.

### Root cause
`journal_tasks` was created in `0000` with a FK `date REFERENCES journal_entries(date)` — valid while `journal_entries` had a single-column `date` PK. Migration `0012` (Phase 12 user-scoping) rebuilt `journal_entries` to a composite PK `(user_id, date)`, so `date` alone is no longer unique. That orphaned the `journal_tasks.date` FK. libSQL enforces foreign keys by default, so **every write to `journal_tasks` threw `foreign key mismatch`** — and since journal-task mutations go through the offline sync queue, it surfaced as "Sync failed". schema.ts already declared no `date` FK; only the DB had drifted (0012 added `user_id` to `journal_tasks` via `ALTER TABLE`, carrying the stale `date` FK forward untouched).

### Fix
- **Migration `0015_fix_journal_tasks_fk.sql`** — SQLite can't drop a FK in place, so the standard rename-and-copy dance: build `journal_tasks_new` with only the valid `user_id → users(id)` cascade FK (no `date` FK), copy all rows, drop old, rename, recreate both indexes (`journal_tasks_date_kind`, `journal_tasks_user_date`). Wrapped in `PRAGMA foreign_keys = OFF/ON`. Registered as `idx 15` in `meta/_journal.json`.
- **`src/app/api/sync/route.ts`** — catch block now appends `err.cause` to the returned message. libSQL/Drizzle bury the real reason ("foreign key mismatch", "no such column", NOT NULL/UNIQUE violations) in `err.cause`; the top-level message is just "Failed query: <sql>". Any future DB write error is now diagnosable from the UI instead of cryptic.

### Audit ("don't get these errors anywhere")
- Dumped all 38 FKs across 19 tables: `journal_tasks.date` was the **only** structural offender — every other FK targets a single-column PK (`*.id` / `users.id`).
- Post-fix `pragma foreign_key_check` across the whole DB: **0 violations**.
- Column parity DB-vs-`schema.ts` for all tables: no real drift.

### Verification
- `npx tsc --noEmit` clean · `npm run lint` → 0 errors, 44 warnings (pre-existing `set-state-in-effect` exemption) · `npm run build` clean (24 routes).
- Local: backup `local.db.bak-before-0015`, migration applied, the exact failing insert now succeeds, 26 existing rows preserved.

### Deploy
1. `git push origin main`.
2. `npm run db:migrate` against prod Turso (`.env.production.local` loaded). `0015` is a table-rebuild — additive/safe, copies existing rows.
3. `vercel --prod --yes` from `Habit_Log/`.
4. PWA shell stays `habit-log-v15` (no SHELL change — no version bump).

---

## ✅ Phase 13 — Default gym setup for new users (live-copy from owner)

Plan: `C:\Users\Admin\.claude\plans\okay-now-as-part-cozy-kettle.md`. Shipped 2026-06-02.

### Problem
New users (friends who sign up) landed on an **empty Gym tab** — gym entities are per-user (scoped since Phase 12's data wall) and `seedNewUser` only seeded pomodoro categories + journal questions. Every new user had to hand-build a routine before logging a workout.

### Fix — code-only, no migration
`src/lib/auth/seed-new-user.ts` — new `cloneOwnerGym(userId)` runs after the existing pomo/journal seeds in `seedNewUser` (called once from `signupUser`):
- Resolves the owner via `users.isOwner`; skips if no owner or `ownerId === userId`.
- Reuses `getAllSplitsWithExercises(ownerId)` (`src/db/queries/gym.ts`) — non-archived splits/exercises/joins, `muscleGroups` already parsed.
- Remaps owner ids → fresh `nanoid(12)` (`oldSplitId→new`, `oldExerciseId→new`), inserts `splits` / `exercises` / `split_exercises` scoped to the new `userId`. Preserves name/emoji/color/position/muscleGroups/notes/perHand. Filters out links whose split or exercise wasn't copied (orphan-FK guard).
- All three inserts wrapped in `db.transaction` (all-or-nothing) inside a `try/catch` — gym is non-critical, a clone failure is logged and swallowed so it never fails signup or strands a half-created account.

**Live-copy, not a frozen snapshot:** always mirrors the owner's current gym, so future signups inherit any routine changes automatically. **New signups only** — no backfill of existing accounts (per user decision).

### Verification
- `npx tsc --noEmit` clean · `npm run lint` 0 errors (44 pre-existing warnings) · `npm run build` clean (24 routes).
- Clone data test on local.db with a throwaway user: 5 splits / 26 exercises / 27 links cloned, 0 id collisions with owner, `foreign_key_check` 0 violations, owner gym untouched, `ON DELETE cascade` cleanup confirmed.
- User signed off on a real browser signup (gym populated, settings config correct, owner unchanged).

### Deploy
1. `git push origin main`.
2. **No `db:migrate`** (code-only, reuses existing tables). PWA shell stays `habit-log-v15`.
3. `vercel --prod --yes` from `Habit_Log/`.
4. Prod owner already has 5 splits / 26 exercises, so the next prod signup clones a full gym immediately.

---

## 🚧 Phase 14 — Todo tab (TickTick-style task manager) — IN PROGRESS

Plan: `C:\Users\Admin\.claude\plans\okay-now-as-part-cozy-kettle.md`. Multi-phase roadmap, built locally **commit-by-commit with NO push/deploy until all parts are done** (user tests the whole bundle, then we ship at once). Lives under the More hub at `/todo` (no bottom-nav change). Decisions: in-app reminders first (web push deferred to a later part); all four advanced views (Calendar → Kanban → Eisenhower → Timeline) planned.

### ✅ Part 1 — Core spine (committed, local only)

Offline-first todo manager: lists + Inbox, smart lists, quick-add NLP, priorities, due dates, subtasks, completion.

**Schema** (`0016_todo_core.sql`, applied local — additive, 0 FK violations):
- `todo_lists` — id/userId/name/emoji/color/kind(list|folder)/parentId/viewMode/position/archivedAt. FK userId→users cascade.
- `todos` — id/userId/listId(null=Inbox, FK set null)/parentId(self, subtask)/sectionId/title/note/priority(0–3)/status(active|done|wontDo)/completedAt/dueDate/dueTime/isAllDay/repeatJson/pinned/position(real)/created/updated. `repeat_json`+`section_id` reserved for later parts.

**Backend:** `src/db/queries/todo.ts` (active/completed/subtask-count/list reads), `src/app/actions/todo.ts` (createTodo/updateTodo/toggleTodo/setTodoStatus/deleteTodo/moveTodoToList/reorderTodos + createList/updateList/deleteList/reorderLists, idempotent upserts, requireUser-scoped). Wired into `dispatch.ts` (11 kinds) + `mutate.ts` cacheKeysFor (`todo:*`). SWR readers `/api/page/todo/[view]` + `/api/page/todo-detail/[id]`.

**Parser:** `src/lib/todo/quick-parse.ts` — pure, unit-tested (`scripts/test-quick-parse.ts`, 15/15). Tokens: `!`/`!!`/`!!!` (or `!high|!med|!low`) priority, `~list`, `#tag`, natural dates (`today`, `tomorrow`, `next monday`, `jun 19`, `19 jun`, `in 3 days`, `next week`), times (`3pm`, `9 am`, `15:00`, `tonight`→21:00). Recognized tokens stripped from the title.

**UI** (`src/app/todo/**`, all `@base-ui/react`): `/todo`→`/todo/today` redirect; `[view]` route (smart views + `list-<id>`); `todo-client` orchestrator with optimistic overlays (add/hide/status/reorder + reconcile on refetch); `quick-add` with live chip preview; `todo-list` dnd-kit reorder + priority-colored round checkboxes, due chips (overdue red/today amber), subtask progress, pin-to-top; `task-detail-sheet` (bottom sheet: notes, subtasks add/toggle/delete, priority, due+time, list reassign, Won't-do, delete); `view-switcher` left drawer (smart lists + lists w/ live counts); `list-form-dialog` (emoji+color presets, create/edit/delete). `todo-meta.ts` = client-safe types/constants/`parseViewParam`/`todoMatchesSmartView`. More hub gets a Todo card. PWA `sw.js` → `habit-log-v16` + `/todo` shell entries.

**Smart views:** Today (due ≤ today incl. overdue), Tomorrow, Next 7 Days, Inbox (no list), All, Completed.

**Verified local:** tsc clean · lint 0 errors (warnings only, existing set-state-in-effect pattern) · build clean (26 routes) · parser 15/15 · DB smoke (subtask group-by, list-delete→Inbox fallback, 0 FK violations).

### ✅ Part 2 — Tags + Sort + Search (committed, local only)

**Schema** (`0017_todo_tags.sql`, applied local — additive, 0 FK violations both cascade directions): `todo_tags` (id/userId/name/nameLower/color/position) + `todo_tag_links` (userId/todoId/tagId, PK(todoId,tagId), FKs cascade both ways).

- **Tags:** normalized many-to-many. `#tag` in quick-add now stored (resolveTagNames creates missing, case-insensitive dedup). Tag chips on rows + in detail; `TagPicker` popover (search/create/toggle) in the detail sheet; tag smart-view `tag-<id>`; Tags section in the switcher with create/edit (`TagFormDialog` — rename/recolor/delete, links cascade). Backend: `createTag/updateTag/deleteTag/setTodoTags` + `resolveTagNames`; queries `getTags/getTagsByTodo/getTodoIdsForTag`; payload gains `tags` + `tagsByTodo`; dispatch + cacheKeys extended.
- **Sort:** per-view, persisted in `localStorage` (`todo-sort:<view>`). Modes: Manual / Due date / Priority / Title / Date added (`sortTodos` in todo-meta). Header sort menu. Drag-reorder auto-disabled unless Manual. Pinned still float to top.
- **Search:** header search → `SearchSheet` querying the full active set (`/api/page/todo/all`), live title/note filter, tap result → opens detail.

**Verified local:** tsc clean · lint 0 errors · build clean · DB smoke (tag links, both-direction cascade, 0 FK violations).

### ✅ Part 3 — Folders + Sections (committed, local only)

**Schema** (`0018_todo_sections.sql`, applied local — additive, 0 FK violations): `todo_sections` (id/userId/listId FK cascade/name/position). Folders reuse the existing `todo_lists.kind`/`parent_id` — no new table.

- **Folders:** a list with `kind='folder'`; lists nest via `parentId`. Switcher groups lists under collapsible folders (collapse state in localStorage; orphaned-parent lists fall back to top-level). `ListFormDialog` gains a List/Folder toggle (create) + a folder picker (assign list to folder). `updateList` accepts `parentId`.
- **Sections:** headers within a list. `SectionList` groups a list's todos by section (No-section group first, then each section with count + rename/delete menu, inline "Add section"); each group is its own dnd `TodoListView`. Detail sheet gets a Section picker (shown when the todo's list has sections). Backend: `createSection/updateSection/deleteSection/reorderSections` (+ `moveTodoToSection`; `moveTodoToList` clears `sectionId`; deleting a section detaches its todos). `createTodo` accepts `sectionId`. Payload gains `sections` (current list only). Dispatch + cacheKeys extended.

**Verified local:** tsc clean · lint 0 errors · build clean · DB smoke (folder nesting, section assign, section-delete→detach, list-delete→sections cascade + todos.list_id null, 0 FK violations).

### ✅ Part 4 — Recurrence engine (committed, local only)

**Schema** (`0019_todo_completions.sql`, applied local — additive, 0 FK violations): `todo_completions` (id/userId/todoId FK cascade/completedDate) — one row per completed occurrence (powers "after N" + future streaks). Recurrence rule itself lives in the existing `todos.repeat_json`.

- **Rule lib** `src/lib/todo/recurrence.ts` (pure, unit-tested 12/12 via `scripts/test-recurrence.ts`): `RepeatRule {freq daily|weekly|monthly|yearly, interval, byDay?, mode dueDate|completion, ends never|on|after}`; `parseRule` (validate untrusted), `nextOccurrence` (daily/weekly±byDay/monthly w/ clamp/yearly), `advanceOrEnd` (respects ends), `describeRule`.
- **Roll-forward:** completing a recurring active todo logs a `todo_completions` row and advances `dueDate` to the next occurrence (stays active) instead of marking done; series end (ends-on past / ends-after count) falls through to a normal completion. `skipRecurrence` advances without logging. Client doesn't optimistically hide recurring toggles (lets the refetch render the next occurrence).
- **UI:** `RepeatEditor` popover in the detail (freq grid + interval + weekly day toggles + mode) → `update_todo {repeatJson}`; row shows a Repeat badge; detail footer gets a **Skip** button for recurring tasks. Quick-add parses `daily`, `weekly`, `monthly`, `yearly`, `every N days/weeks/months/years`, `every <weekday>` (→ weekly byDay + first due date). `createTodo`/`updateTodo` accept + validate `repeatJson`; dispatch + cacheKeys extended (`skip_recurrence`).

**Verified local:** tsc clean · lint 0 errors · build clean · parser 15/15 · recurrence 12/12 · DB smoke (completion log + cascade on todo delete, 0 FK violations).

### ✅ Part 5 — Views: Calendar · Kanban · Eisenhower (committed, local only)

Client-only render modes over the current view's todo set — **no schema/DB change**. Header `ViewModeMenu` (List/Calendar/Board/Matrix); chosen mode persisted per-view in `localStorage` (`todo-mode:<view>`). Sort menu only shows in List mode; Completed view forced to List.

- **CalendarView:** month grid (reuse `monthMatrix`), priority-colored dots per day, tap a day → its tasks below + an Unscheduled group. Tap task → detail. (drag-to-reschedule deferred)
- **KanbanView:** four priority columns (High/Med/Low/None), `@dnd-kit` drag a card between columns → `update_todo {priority}`. Horizontal scroll; card tap → detail.
- **EisenhowerView:** 2×2 by urgency (due ≤ tomorrow/overdue) × importance (priority ≥ medium) — Do first / Schedule / Delegate / Later. Tap → detail. (drag-to-set deferred)

**Verified local:** tsc clean · lint 0 errors · build clean.

### ✅ Part 6 — Timeline view + keyboard shortcuts (committed, local only)

Client-only — no schema change.

- **TimelineView:** 5th render mode (added to `ViewModeMenu`). Horizontally-scrolling day strip — Overdue column + Today..+14 + a No-date column — each listing its due tasks (priority dot + time). Tap → detail. (Todos are points, not ranges; reads as a horizontal agenda. Duration-bar Gantt deferred until todos gain a duration field.)
- **Keyboard shortcuts** (desktop): `/` open search · `n` focus quick-add · `1`–`5` switch render mode (List/Calendar/Board/Matrix/Timeline) · `Esc` blur a focused field. Ignored while typing.
- **Pomodoro integration deferred** — it crosses into the `/pomodoro` subsystem; left for a later focused pass rather than half-wiring it here.

**Verified local:** tsc clean · lint 0 errors · build clean.

### ✅ Part 7 — Custom filters (advanced AND/OR) (committed, local only)

**Schema** (`0020_todo_filters.sql`, applied local — additive, 0 FK violations): `todo_filters` (id/userId/name/color/rulesJson/position).

- **Eval lib** `src/lib/todo/filters.ts` (pure, unit-tested 13/13 via `scripts/test-filters.ts`): `FilterRules {combinator and|or, conditions[]}`; conditions over fields **list** (is/inbox), **tag** (has), **priority** (is/≥/≤), **due** (overdue/today/next7/none/any/before/after), **keyword** (title+note contains), **status**; `parseFilterRules` validates untrusted input, `evalFilter` applies AND/OR.
- **Saved filters** as a view `filter-<id>`: the route loads the filter, evaluates over all top-level todos (active **and** completed, so status conditions work). Switcher Filters section (create/edit/navigate); `FilterBuilderDialog` — name + color + All/Any combinator + per-field condition rows (add/remove). Backend `createFilter/updateFilter/deleteFilter` + queries + dispatch + cacheKeys + payload `filters`.

**Verified local:** tsc clean · lint 0 errors · build clean · filters 13/13 · DB smoke (persist + rules roundtrip, 0 FK violations).

### ✅ Part 8 — Bulk actions + swipe gestures (committed, local only)

Client-only — no schema change.

- **Bulk actions:** header Select toggle (List mode) → multi-select; tapping a row selects instead of opening; `ring` highlight; reorder/row-actions hidden while selecting. `BulkBar` (fixed bottom): Complete · Priority · Due (today/tomorrow/clear) · Move to list · Delete · count + cancel. Each applies the matching mutation across the selection with optimistic overlays. New `handleDelete` (optimistic hide + `delete_todo`).
- **Swipe gestures** (touch): pointer-based horizontal swipe on a row — right ⇒ complete, left ⇒ delete, past an 80px threshold; reveals a check/trash background; `touch-pan-y` preserves vertical scroll; suppresses the tap that would otherwise open the detail. Disabled in select mode / for mouse.

**Verified local:** tsc clean · lint 0 errors · build clean.

### ✅ Part 9 — bug fixes + quick-add UX (committed, local only)

Client-only — no schema change. Fixes from first user test pass.

- **`/todo/today` crash** (`Cannot read properties of undefined`): a stale IndexedDB cache from the Part-1 build lacked newer payload fields (`tagsByTodo`/`subtasks`), so `undefined[todoId]` threw on first render. Fixed with defensive defaults (`?? {}`) at every consumption site **and** a cache-key namespace bump (`todo:` → `todo:v2:`) to flush stale-shaped entries.
- **Quick-add live autocomplete:** typing a token now opens a suggestion dropdown — `~` → lists, `#` → tags (+ "Create …"), `!` → priority. Enter/click completes the token inline. Preview chips for list/priority are clickable to re-open their picker.
- **Recurrence preview chip:** quick-add now shows a Repeat chip (e.g. "Weekly on Mon") as you type `every monday`/`daily`/… — previously the rule was only applied silently on create.
- **Swipe fixed + repurposed:** swipe now works with mouse too (was touch-only, so it did nothing on desktop). **Left swipe = reschedule** (no due → tomorrow; has due → +1 day) instead of delete; right swipe still completes. Background icons updated (check / calendar).

**Verified local:** tsc clean · lint 0 errors · build clean.

### ✅ Part 10 — quick-add chip polish + swipe animations (committed, local only)

Client-only — no schema change.

- **Calendar + Repeat chips clickable** in quick-add (parity with priority/list): the date chip opens `DueDatePopover`, the repeat chip opens `RepeatEditor`. Picks are stored as overrides that win over the parsed text and flow through on submit (`QuickAddExtra` → `handleAdd` merge). Date chip now shows date + time together.
- **Swipe animations:** during a swipe the action background **fills** from the edge (width tracks the drag), the icon **ramps** (opacity + scale with progress), the fill **brightens** once past the trigger (armed state), and the row **springs back** smoothly (transition-transform when not actively dragging; no transition while following the finger).

**Verified local:** tsc clean · lint 0 errors · build clean.

### Todo feature — core complete (Parts 1–10)

All planned core todo functionality is built and committed locally (not pushed). **Deferred / optional (not built):** pomodoro "start focus from task" integration (crosses into `/pomodoro`), web push reminders (VAPID/SW push), Eisenhower/Calendar drag-to-set, duration-bar Gantt. These can be picked up later.

---

## ✅ Phase 14 · Ship — Todo Parts 1–10 to prod + Claude Code scaffold

Shipped 2026-07-19. Migration-first session after ~7-week gap; user shifted development from Claude-in-VS-Code to standalone Claude Code CLI.

**Shipped:**
- **Prod Turso migrated** — 5 additive migrations applied via `drizzle-kit migrate` w/ `.env.production.local` loaded (parser pattern from Phase 5): `0016_todo_core`, `0017_todo_tags`, `0018_todo_sections`, `0019_todo_completions`, `0020_todo_filters`.
- **12 commits pushed** to `origin/main` (`1655494 → fb28459`) — all 10 Todo Parts + `chore(claude-code): project settings + slash commands` (`b829202`) + `docs: refresh README to reflect all shipped features` (`fb28459`).
- **Vercel prod deployed** — `dpl_BPVh5dGw5g63u5c4aS9M2FvPgoum` READY, aliased to https://daily-journal-phi-vert.vercel.app.
- **Claude Code scaffold** landed under `Habit_Log/.claude/`:
  - `settings.json` — `bypassPermissions` mode + `additionalDirectories` for parent Experiments dir + global user config.
  - `commands/*.md` — seven slash commands: `/dev`, `/check`, `/migrate-prod`, `/seed-prod`, `/deploy`, `/ship`, `/progress-update`. Each pauses at the deploy boundary per `feedback_wait_before_deploy.md`.
  - `.gitignore` — `.claude/settings.local.json` ignored (personal); `settings.json` + `commands/` tracked so other machines inherit the setup.
- **README.md refreshed** — was stuck at Phase 3 scope. Now covers Todo, Books, Auth, XP+levels, gym split/exercise/set tracking, per-user data scoping, offline-first sync architecture (Phase 8), instant-nav SWR client shells (Phase 8C). Shell examples swapped to PowerShell.

**Verified post-deploy (prod probes):**
- `/` → 307 (middleware auth gate)
- `/auth/login` → 200 (roster)
- `/auth/signup` → 200
- `/manifest.webmanifest` → 200
- `/sw.js` → 200

**Session mechanics:**
- Vercel CLI token had expired — user ran `vercel login` (device-code flow) in their own terminal before deploy could retry.
- User now runs `npm run dev` in their own PowerShell terminal (not spawned as a Claude bg task). Auto-memory `feedback_auto_start_dev_habitlog.md` flipped from "auto-start" to "do NOT spawn — user owns dev process". Reason: standalone Claude Code CLI's Bash tool has no persistent terminal panel, so a bg-task dev server is less visible than an owned terminal.

**State at session end (2026-07-19):**
- Working tree clean. Local + remote `main` at `fb28459`.
- Prod Turso schema through `0020_todo_filters`. Prod Vercel serving Phase 14 (Parts 1–10) code.
- PWA shell `habit-log-v16` — SHELL already includes `/todo` + `/todo/today` from Part 1.
- Dev server runs in user's own terminal (not spawned).

**Resume here for next session:** Todo feature core complete + shipped. Pick from the standing deferred list (pomodoro "focus from task", web push reminders, Eisenhower/Calendar drag-to-set, duration Gantt, 3D avatar, AI reflections, JSON export/import, fts5 search, level-up toasts, Books polish).

---

## ✅ Phase 15 — Auth-aware fetch + `/reset` escape hatch (bug fixes)

Shipped 2026-07-19 same session as Phase 14 · Ship. User-reported bugs on installed PWA.

### Bugs

1. **"Opening the app after a long time doesn't load, stays there. I have to manually clear the cache and refresh to get redirected to login."**
2. **"Sometimes it says not authorized error, but it doesn't redirect to login page — stays there. Manual cache clear only fix."**

### Root cause (shared)

Every `/api/page/*` + `/api/sync` endpoint returns **401** when the session cookie is missing or expired. Every page-client fetcher was:
```ts
const res = await fetch(`/api/page/...`, { cache: "no-store" });
if (!res.ok) throw new Error("Fetch failed");
```
`useCachedPage.refresh()` (`src/lib/sync/cache.ts:98`) catches the throw silently. Middleware auth gate (`src/middleware.ts`) only fires on navigations, never XHRs. Result: user stared at either stale IDB-hydrated data (bug 2) or a permanent skeleton (bug 1) with no path to recovery except DevTools "Clear storage".

### Shipped

- **`src/lib/sync/auth-fetch.ts`** — `authAwareFetch(input, init)` wraps `fetch`. On 401, hard-navigates to `/auth/login?next=<current>` and returns a never-resolving promise so downstream `throw` + `setState` don't run against a doomed tree. Guards against redirect loops on `/auth/*` and `/reset` by passing 401s through verbatim there.
- **All 10 page-client fetchers swapped** to `authAwareFetch`: `habits-page-client`, `goals-page-client`, `pomodoro-page-client`, `journal-page-client`, `todo-client`, `task-detail-sheet`, `books-page-client`, `gym/[date] gym-page-client`, `gym/insights insights-page-client`.
- **`src/lib/sync/mutate.ts`** — `attemptSend`, `flushQueue`, `retryOne` all use `authAwareFetch` too. Any leftover queued mutation that hits an expired session now triggers the same redirect flow instead of dumping a "Sync failed: Unauthorized" toast into the void.
- **`src/components/sync-bootstrap.tsx`** — skips the sync-conflict toast when the error is `Unauthorized` / `HTTP 401` (page is already redirecting; toast would be noise). Also opts out entirely on `/auth/*` and `/reset` via `usePathname()` so it doesn't race the IDB wipe.
- **`src/components/device-nickname-dialog.tsx`** — skips `/reset` too.

### Escape hatch — `/reset`

For the "stale even after a normal page reload, now what?" case:

- **New public route `/reset`** (`src/app/reset/page.tsx`) — client page that:
  1. Enumerates every `habit_log_sync*` IndexedDB via `indexedDB.databases()` (Safari fallback uses the pre-Phase-12 legacy name + the current-user namespaced DB from `localStorage.__habit_log_uid`)
  2. Deletes them all (handles `onblocked` by resolving so the flow never hangs)
  3. Clears the `__habit_log_uid` localStorage key
  4. Unregisters every SW registration
  5. Deletes every Cache Storage entry
  6. Hard-navigates to `/auth/login`
- **Middleware** (`src/middleware.ts:15`) — `/reset` added to `PUBLIC_EXACT` so it always resolves without a session.
- **Settings → Sync status → "Reset local state" button** — same action behind a confirm dialog. Uses the shared `src/lib/sync/reset-local.ts` helper.
- **Discoverability:** the button copy tells the user they can also type `/reset` in the address bar anytime the app is frozen. That URL now works from any device state — even mid-logout — because middleware skips auth for it.

### PWA

`public/sw.js` `VERSION` bumped `habit-log-v16 → v17`. `SHELL` extended with `/reset`. Installed phones activate the new SW on next lifecycle.

### Verification

- `npx tsc --noEmit` clean.
- `npm run lint` → 0 errors, 56 warnings (all pre-existing `react-hooks/set-state-in-effect` + 3 pre-existing unused-directive; no new categories).
- Prod probes post-deploy (`dpl_Bso87fbT8PBGYfgrxbVAYs3Dpuma` READY):
  - `/` → 307 (middleware auth gate)
  - `/auth/login` → 200
  - `/reset` → 200 (new; public per middleware)

### Deploy

- `git push origin main` — `05a4dd6..373b192`.
- `vercel --prod --yes` from `Habit_Log/` — build clean.
- No schema migration.

### Won't-fix in this phase

- **True offline state** — if the network is fully unreachable AND there's no IDB cache, users still see a skeleton (nothing to redirect *to*). Would need an "offline empty state" per client shell. Deferred as a separate feature, not a bug — pre-Phase-15 behavior was identical.

**State at session end (2026-07-19):**
- Local + remote `main` at `373b192`.
- Prod on Phase 15 deploy `dpl_Bso87fbT8PBGYfgrxbVAYs3Dpuma`.
- PWA shell `habit-log-v17`.

---

## Standing reminders

- **Session hygiene:** start a fresh Claude session at the top of each new work session. `AGENTS.md` + `PROGRESS.md` auto-load and brief the new session.
- **End of each session:** update this file with deltas + the precise starting point for next time, then stop.
