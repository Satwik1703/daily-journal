# Habit Log

A personal daily-life PWA: journal, habits with XP + levels, pomodoro focus timer, goals with cascading rollups, gym tracker with body heatmap, reading log, and a full TickTick-style todo manager. Multi-user with emoji-passphrase login. Mobile-first, offline-first, installable. Built day-by-day with Claude Code; full progress log in [`PROGRESS.md`](./PROGRESS.md).

**Live:** https://daily-journal-phi-vert.vercel.app

## What's inside

- **Journal** (`/journal/[date]`) — gratitude, identity reminders, daily metrics (energy/mood/sleep), customizable questions, three task lists (non-negotiables / goals / secondary) with drag-reorder, move-to-date + trace stub with tap-to-navigate, tomorrow's plan. Autosaves on idle. Date stepper opens a calendar popover with status-colored cells (Crazy / Great / Good / Avg / Bad).
- **Habits** (`/habits/[date]`) — every tracked item lives here. Three tracking kinds:
  - **Binary** — single tap to mark done.
  - **Number** (Walk 5k, Read 5 pages) — inline "Log" button opens a mini dialog; multiple deltas per day summed; done once daily target hit.
  - **Pomodoro** — read-only session count for the linked category; tap row to jump to `/pomodoro/{date}` with the category auto-selected.
  Rolling 15-day grid with partial-fill battery cells, donut glyph per row, always-visible Lv chip → tap for XP breakdown popover. Difficulty multiplier per habit. Manage list with drag-reorder, edit, archive (mirrors goal archive).
- **Pomodoro** (`/pomodoro/[date]`) — animated focus timer (50 min = 1 pomo, 30 min = ½). Live time-span readout, categorized sessions, post-session description prompt, manual backfill (count × kind, sequential), Web Audio completion chime (4 profiles, no assets), refresh-safe wall-clock persistence, locked-phone notification via Notification Triggers API (Chromium Android). Day stats with yesterday comparison, per-category bars, 24-bar hourly strip (client-bucketed for correct local-time), session list.
- **Goals** (`/goals/[period]/[anchor]`) — weekly / monthly / yearly intentions with progress tracking. Four goal types: **number**, **habit-linked** (auto-derives days-hit from the habit), **pomodoro-linked** (minutes/pomos/sessions with optional category filter), **milestone + checklist**. SVG donut summary, period stepper, cascade rollups, history strip, 52-week year heatmap. **Forward cascade** splits a yearly target across months. **Reverse cascade** propagates a weekly target through end-of-month or end-of-year. Auto-finalizes closed periods, reflection sheet, pinned "Important" section, cross-level edit + delete cascade, extend-through-year, archived goals viewer.
- **Todo** (`/todo`) — TickTick-style task manager under `/more`. Smart lists (Today / Tomorrow / Next 7 Days / Inbox / All / Completed), custom lists grouped in folders with sections, tags with color, saved filters (AND/OR conditions). Quick-add with natural-language parsing (`!` priority, `~list`, `#tag`, `today`/`tomorrow`/`next monday`/`3pm`, `every weekday`) + live autocomplete + clickable chip preview. Priorities, due dates + times, subtasks, recurrence engine (daily/weekly-byDay/monthly/yearly with dueDate + completion modes, ends never/on/after). Five render modes per view: List (drag-reorder + swipe left = reschedule +1d / right = complete), Calendar (month grid w/ priority dots), Kanban (drag between priority columns), Eisenhower (2×2 urgency×importance), Timeline (horizontal agenda). Bulk actions with multi-select bar. Keyboard shortcuts (`/` search, `n` new, `1–5` mode switch).
- **Insights** (`/insights`) — mood/energy/sleep trend chart, habit completion %, habit timeline, streaks, gratitude word cloud, XP levels card ranking every habit, Focus section (minutes/day chart, category trend, top categories, best time-of-day, focus heatmap), Journal-at-a-glance month grid. Range toggle (7 / 15 / 30 / 90 days).
- **Gym** (`/gym`, `/gym/[date]`, `/gym/insights`) — splits with exercises, per-set reps + weight logging with debounced writes, stepper ladder for reps, per-user default gym cloned from owner on signup. Body heatmap shades each muscle group by recent training intensity (front + back).
- **Books** (`/books`) — reading log with status buckets (Reading / Wishlist / Finished / DNF), rating, total-pages progress bars derived from `habit_value_logs` linked to the active book, active-book chip in the Log-value dialog on the Read habit.
- **More** (`/more`) — hub for Insights / Gym / Books / Todo / Settings.
- **Settings** (`/settings`) — daily journal questions (drag-reorder), pomodoro categories (drag-reorder), completion sound, device list with rename, sync-status panel with per-row retry / discard, owner-only cards (all passphrases viewer + friend-recovery code issuer).
- **Auth** — multi-user with floating-tile roster on `/auth/login` (physics-based drift + cursor repel + recency aura), 4-emoji + 24-emoji-carousel passphrase, honeypot emoji, 4-step signup ritual (name → style → lock → doodle), doodle-based self-serve recovery (DTW-matched stroke), owner-issued 6-digit friend recovery codes, master recovery code for the owner. Per-user data scoping across all 17 data tables.

## Stack

- **Next.js 16** (App Router) + React 19 + TypeScript
- **Tailwind v4** (`@theme` in `globals.css`, no `tailwind.config.ts`) + **shadcn/ui** (`base-nova` style → `@base-ui/react`)
- **Drizzle ORM** + **libSQL** (`@libsql/client/node` — local file in dev, Turso for prod)
- **Recharts** for trend / bar / area charts
- **@dnd-kit** for drag-and-drop reorder (tasks, questions, habits, categories, kanban)
- Hand-rolled service worker + `app/manifest.ts` for PWA (dynamic per-user shortcuts)
- Web Audio API for synthesized completion chimes (no audio assets bundled)
- Canvas Confetti for login / signup celebrations
- **IndexedDB** (via `idb`) for the offline sync queue + SWR page cache
- **Notification Triggers API** for locked-phone pomo completion alerts (Chromium Android)

## Instant UI — writes and reads

Every mutation is optimistic + fire-and-forget: local state flips instantly, the mutation is queued to IDB, POSTed to `/api/sync`, and Service-Worker Background Sync retries on failure. Every hot page (`/habits/[date]`, `/goals/[period]/[anchor]`, `/pomodoro/[date]`, `/journal/[date]`, `/todo/[view]`, `/books`) is a client shell that reads from IDB via `useCachedPage(key, ...)` on mount for instant navigation on revisit + refetches in the background. See PROGRESS.md Phase 8 / 8B / 8C / 11 for the full architecture.

## Run locally

```powershell
npm install
npm run db:migrate     # creates local.db with the full schema
npm run dev            # http://localhost:3000
```

Open `http://localhost:3000` — you'll be redirected to the login roster. The owner user is auto-seeded via migration `0011` (`name = 'satwik'`) with a NULL passphrase — first login sets it. Any other user signs up via the 4-step ritual on `/auth/signup`.

## Deploy to Vercel + Turso

Setup is documented in PROGRESS.md Day 9 (Turso provisioning, Vercel env vars).

To ship an update:

```powershell
# 1. If schema changed, apply migrations to prod first
Get-Content .env.production.local | ForEach-Object {
  if ($_ -match '^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.+?)\s*$') {
    Set-Item -Path "Env:\$($matches[1])" -Value $matches[2].Trim('"')
  }
}
npm run db:migrate

# 2. Push + deploy
git push origin main
vercel --prod --yes
```

Required env vars on Vercel Production:
- `TURSO_DATABASE_URL`
- `TURSO_AUTH_TOKEN`
- `RECOVERY_SECRET` (32-byte hex, signs the recovery cookie)

## After schema changes

```powershell
npm run db:generate    # generates a new SQL file in drizzle/migrations/
npm run db:migrate     # applies it locally
```

Commit `drizzle/migrations/*.sql` files — they're the source of truth.

## PWA cache

Service worker at `public/sw.js` ships a `VERSION` constant — **bump it on every deploy that touches the shell**, otherwise installed phones serve a stale shell. The `SHELL` array lists every top-level route. On `localhost` the SW does NOT register (actively unregisters + clears caches) so Turbopack-rebuilt chunks aren't served stale during dev. Current version: check the constant in `public/sw.js`.

## Project conventions

See [`AGENTS.md`](./AGENTS.md) for the load-bearing rules — local-time date convention, `'use server'` async-only exports, Server↔Client import boundary (rule #7), Map serialization (rule #8), SVG animation transform-box (rule #9), and more.

For Claude Code sessions, `.claude/commands/` ships repeatable slash commands: `/dev`, `/check`, `/migrate-prod`, `/seed-prod`, `/deploy`, `/ship`, `/progress-update`.

## Helpful scripts

```powershell
node scripts/check-db.mjs                  # journal entries
node scripts/check-pomo.mjs                # pomodoro tables + categories + session count
node scripts/check-goals.mjs               # goal rows + checklists + progress logs
node scripts/check-seed.mjs                # read-back of seeded habit + goal stack
node scripts/test-quick-parse.ts           # todo quick-add parser (15 cases)
node scripts/test-recurrence.ts            # todo recurrence rules (12 cases)
node scripts/test-filters.ts               # todo filters AND/OR eval (13 cases)

# Canonical 16-habit + goal stack seeder
node scripts/seed-habits-goals.mjs local                                     # writes to local.db (fresh DB)
node scripts/seed-habits-goals.mjs prod                                      # destructive mirror onto Turso (env required)

# Add just the Protein + Hand-grip habits with full-year cascading goals (idempotent, additive)
node scripts/seed-protein-handgrip.mjs [prod]
```

`seed-habits-goals.mjs prod` wipes 6 goal/habit tables (`goal_progress`, `goal_checklist`, `goals`, `habit_value_logs`, `habit_logs`, `habits`), preserves journal + pomodoro data, renames any pre-existing "Creative" category to "Create", and reuses prod's existing pomodoro_categories ids.

## Roadmap (deferred)

- Pomodoro "Start focus from task" integration on todo detail
- Web push reminders (VAPID / SW push) for todos
- Eisenhower + Calendar drag-to-set
- Duration-bar Gantt (todos gain a duration field)
- 3D avatar (Z-Anatomy in Blender → R3F) replaces the 2D body heatmap
- AI weekly / monthly reflections via Claude API
- Export / backup data (JSON dump + replay import)
- Full-text search across gratitude, identity, and journal answers (libSQL `fts5`)
- Level-up toasts when a log crosses an XP threshold
- Books polish — pages-per-week chart, OpenLibrary cover fetch, reading streaks
