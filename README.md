# Habit Log

A personal daily-life app: structured journal, habit tracker, and gym tracker with a 2D body heatmap. Mobile-first PWA you can install on your phone. Built day-by-day with Claude Code; full progress log in [`PROGRESS.md`](./PROGRESS.md).

## What's inside

- **Journal** (`/journal/[date]`) — gratitude, daily metrics (energy/mood/sleep), customizable daily questions, goals/non-negotiables/secondary task lists, tomorrow's plan. Autosaves on idle.
- **Habits** (`/habits`) — tap-to-log today's habits, 30-day completion grid, manage list (add/edit/archive).
- **Insights** (`/insights`) — mood/energy/sleep trend chart, habit completion %, streaks, gratitude word cloud. 7 / 30 / 90 day ranges.
- **Gym** (`/gym`) — log workouts at a high level (muscle group + intensity), see a body heatmap that shades each muscle redder as you train it. Front + back views.
- **Settings** (`/settings`) — customize daily journal questions.

## Stack

- Next.js 16 (App Router) + React 19 + TypeScript
- Tailwind v4 + shadcn/ui (`base-nova` style → `@base-ui/react`)
- Drizzle ORM + libSQL (local file in dev, Turso for prod)
- Recharts for trend/bar charts
- Hand-rolled service worker + `app/manifest.ts` for PWA

## Run locally

```bash
npm install
npm run db:migrate     # creates local.db with the latest schema
npm run dev            # http://localhost:3000
```

Open `http://localhost:3000` — you'll be redirected to today's journal entry.

## Deploy to Vercel (free tier)

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
4. Run migrations against prod:
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

## Project conventions

See [`AGENTS.md`](./AGENTS.md) for the rules every contributor (human or AI) should follow — chiefly the local-time date convention, the `'use server'` only-async-exports rule, and the `@base-ui/react` Slider quirk.

## Roadmap (deferred)

- 3D avatar (Z-Anatomy in Blender → R3F) replaces the 2D body heatmap
- AI weekly/monthly reflections via Claude API
- Export / backup data
