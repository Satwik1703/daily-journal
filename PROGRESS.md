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
- **Per-user timezone setting** — currently uses the server's local time for `todayLocal()`. Single-user app so usually fine, but if you travel the day boundary will shift on you.

---

## Standing reminders

- **Session hygiene:** start a fresh Claude session at the top of each new work session. `AGENTS.md` + `PROGRESS.md` auto-load and brief the new session.
- **End of each session:** update this file with deltas + the precise starting point for next time, then stop.
