# Habit Log

A personal daily-life app: structured journal, habit tracker, gym tracker with a 2D body heatmap, and pomodoro focus timer with rich insights. Mobile-first PWA you can install on your phone. Built day-by-day with Claude Code; full progress log in [`PROGRESS.md`](./PROGRESS.md).

## What's inside

- **Journal** (`/journal/[date]`) — gratitude, identity reminders, daily metrics (energy/mood/sleep), customizable daily questions, goals/non-negotiables/secondary task lists, tomorrow's plan. Autosaves on idle. Date stepper opens a calendar popover with status-colored cells (Crazy / Great / Good / Avg / Bad).
- **Habits** (`/habits/[date]`) — tap-to-log today's habits, rolling 15-day completion grid, manage list (add/edit/archive). Past-date logging via dated URL; new-habit button locks off-today. Calendar popover mirrors the journal one.
- **Pomodoro** (`/pomodoro/[date]`) — animated focus timer (50 min = 1 pomo, 30 min = ½). Live time-span readout (e.g. `5:00 PM → 5:50 PM`), categorized sessions, post-session description prompt, manual backfill, completion chime (Web Audio synth, 4 selectable profiles), refresh-safe wall-clock persistence. Day stats card with yesterday comparison, per-category bars, 24-bar hourly strip, session list.
- **Insights** (`/insights`) — mood/energy/sleep trend chart, habit completion %, habit timeline grid, streaks, gratitude word cloud, **Focus section** (focus minutes/day bar chart, configurable category trend chart, top categories, best time-of-day histogram, monthly heatmap). Range toggle (7 / 15 / 30 / 90 days) drives every card.
- **More** (`/more`) — hub linking to Gym + Settings.
- **Gym** (`/gym`) — log workouts at a high level (muscle group + intensity), see a body heatmap that shades each muscle redder as you train it. Front + back views.
- **Settings** (`/settings`) — customize daily journal questions, manage pomodoro categories (CRUD), pick a completion sound.

## Stack

- Next.js 16 (App Router) + React 19 + TypeScript
- Tailwind v4 + shadcn/ui (`base-nova` style → `@base-ui/react`)
- Drizzle ORM + libSQL (local file in dev, Turso for prod)
- Recharts for trend / bar / area charts
- Hand-rolled service worker + `app/manifest.ts` for PWA
- Web Audio API for synthesized completion chimes (no audio assets bundled)

## Run locally

```bash
npm install
npm run db:migrate     # creates local.db with the latest schema (incl. pomodoro)
npm run dev            # http://localhost:3000
```

Open `http://localhost:3000` — you'll be redirected to today's journal entry. The pomodoro categories table is seeded with six defaults (Work, Study, Read, Exercise, Creative, Other) on first read.

## Deploy to Vercel + Turso (free tier)

1. Create a Turso DB:
   ```bash
   turso db create habit-log
   turso db show habit-log --url
   turso db tokens create habit-log
   ```
2. Push to a Git repo, import to Vercel.
3. In Vercel project settings, add env vars:
   - `TURSO_DATABASE_URL` = `libsql://habit-log-…turso.io`
   - `TURSO_AUTH_TOKEN` = `…`
4. Run migrations against prod (this applies all generated SQL files, including `0001_low_leo.sql` for identity reminders and `0002_chubby_nomad.sql` for pomodoro):
   ```bash
   TURSO_DATABASE_URL=… TURSO_AUTH_TOKEN=… npm run db:migrate
   ```
5. Deploy. Open the live URL on your phone → Add to Home Screen.

## After schema changes

```bash
npm run db:generate    # creates a new SQL file in drizzle/migrations
npm run db:migrate     # applies it
```

Commit the generated `drizzle/migrations/*.sql` files; they are the source of truth.

## PWA cache

The service worker at `public/sw.js` ships a `VERSION` constant — **bump it on every deploy**, otherwise installed phones serve a stale shell. The shell list also includes every top-level route, so update it when adding a new tab. Current version: `habit-log-v3`.

## Project conventions

See [`AGENTS.md`](./AGENTS.md) for the rules every contributor (human or AI) should follow — chiefly the local-time date convention, the `'use server'` only-async-exports rule, the `@base-ui/react` Slider quirk, and the client-vs-DB import boundary.

## Helpful scripts

```bash
node scripts/check-db.mjs      # quick "what's in the local DB" (journal entries)
node scripts/check-pomo.mjs    # pomodoro tables + seeded categories + session count
```

## Roadmap (deferred)

- 3D avatar (Z-Anatomy in Blender → R3F) replaces the 2D body heatmap
- AI weekly/monthly reflections via Claude API
- Export / backup data (JSON dump + replay import)
- Full-text search across gratitude, identity, and answers (libSQL `fts5`)
- Drag-and-drop reorder for tasks, habits, questions, pomodoro categories
- Calendar/heatmap view of the journal at the month level
