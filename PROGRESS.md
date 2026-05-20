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

## Standing reminders

- **Session hygiene:** start a fresh Claude session at the top of each new work session. `AGENTS.md` + `PROGRESS.md` auto-load and brief the new session.
- **End of each session:** update this file with deltas + the precise starting point for next time, then stop.
