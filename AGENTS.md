<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Current state — read this first

@PROGRESS.md

# No-permission rule (project-wide)

**Never ask the user permission before any tool call.** Reads, writes, edits, deletions, file removals, DB wipes, schema migrations, force-pushes, prod deploys, memory writes — just execute. The harness runs `bypassPermissions`; the only source of friction is self-imposed confirmation messages. State what's about to happen in one terse sentence, then run it. No "should I proceed?", "OK to delete?", "want me to push?". Full details in auto-memory `feedback_no_confirmation_prompts.md`.

# Habit_Log — project conventions

## What this app is
A personal daily journal + habit tracker + gym tracker. Mobile-first PWA. Single user. Public deploy. The full plan lives at `C:\Users\Admin\.claude\plans\hey-so-i-m-planning-graceful-hinton.md`.

## Stack quick reference
- Next.js 16 (App Router) + React 19 + TypeScript
- Tailwind v4 (configured via `@theme` in `src/app/globals.css`, no `tailwind.config.ts`)
- shadcn/ui — note this project is on the new `base-nova` style, which uses **`@base-ui/react`**, NOT Radix. Component APIs differ subtly. Always read the generated source under `src/components/ui/` before assuming an API.
- Drizzle ORM + libSQL (`@libsql/client`) — local file `local.db` for dev, swap to Turso URL for prod via `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN`
- next-themes (dark default)
- sonner toasts, lucide icons, react-textarea-autosize

## Load-bearing rules

1. **Dates are local-time `YYYY-MM-DD` strings.** Always go through `src/lib/dates.ts`. Never use `new Date().toISOString().slice(0,10)` — that gives UTC and silently misfiles late-night entries.
2. **Server Actions live in `src/app/actions/*.ts`** with `"use server"` at the top of the file. Mutations use Drizzle's `.onConflictDoUpdate()` for idempotent upserts.
3. **The `_components/` folders inside route segments are private** (Next App Router convention) — page-specific components colocate there.
4. **`@base-ui/react` Slider** has `onValueChange(value: number | readonly number[])` — handle both shapes when reading the value.
5. **Server runtime only for DB.** Don't add `export const runtime = 'edge'` to anything that touches the DB — `@libsql/client` needs the Node runtime.
6. **`'use server'` files can ONLY export async functions.** Constants/enums imported from a server-actions file arrive on the client as opaque server references and crash with `.map is not a function` etc. Put shared constants in `src/lib/*` and import them in both places. (`PRESET_COLORS` lives in `src/lib/habit-meta.ts` for this reason.)
7. **Client components must not import runtime values from `src/db/**`.** The DB client transitively requires native Node deps (`fs`, `child_process`). Type-only imports (`import type { ... }`) are erased and safe; **mixed runtime+type imports drag the whole graph into the browser bundle and crash with `Module not found: Can't resolve 'fs'`.** Put any constant that a client component needs in `src/lib/*` (see `src/lib/task-meta.ts`, `src/lib/muscle-groups.ts`, `src/lib/habit-meta.ts`, `src/lib/pomodoro-meta.ts`). Use `import { createClient } from "@libsql/client/node"` explicitly — the default `@libsql/client` resolves to the web variant under Turbopack and rejects `file:` URLs. `next.config.ts` also lists `libsql` and `@libsql/client` in `serverExternalPackages` as a safety net.
8. **Server-side `Map` does NOT survive RSC serialization.** When a server component passes data to a client component, any `Map<…>` value lands as `{}` on the client. Flatten to `Array.from(map.values())` (or a plain object keyed by string) on the server before passing it down. Example: `src/app/insights/page.tsx` flattens `pomoWindow.daily[*].byCategory` from `Map<string, DayCategoryAgg>` → `DayCategoryAgg[]` before handing it to `FocusTrendChart`.
9. **SVG `<g>` rotation/scale needs `transform-box: fill-box` to rotate around its own center.** Default CSS `transform-origin` on an SVG sub-element resolves against the SVG viewport's (0, 0), not the element's bounding box, so `transform-origin: center` alone makes a `<g>` orbit a point far off-canvas. Always pair them: `transform-box: fill-box; transform-origin: center;` (or an explicit pixel-based origin like `transform-origin: 120px 120px`). This is baked into every `.animate-orbit-*` / `.animate-ring-wave*` / `.animate-radial-pulse` utility in `globals.css`; if you add a new SVG animation, do the same.
10. **Custom keyframe animations belong inside `@layer utilities`** in `globals.css`. Tailwind v4 only picks up utilities from CSS layers; defining `.animate-*` outside the layer makes them invisible to `cn()` ordering and risks getting overridden. See the existing `pulse-soft`, `ring-wave`, `orbit-rotate` definitions for the pattern. The four-default-classes built into `tw-animate-css` (`animate-in`, `animate-out`, etc.) are separate — don't clash with those names.

## Useful scripts

```bash
npm run dev           # next dev (Turbopack)
npm run db:generate   # drizzle-kit generate (after schema.ts changes)
npm run db:migrate    # apply pending migrations to TURSO_DATABASE_URL
npm run db:push       # quick dev-only sync (skips migration history)
npm run db:studio     # drizzle-kit studio UI

node scripts/check-db.mjs     # quick "what's in the local DB" (journal entries)
node scripts/check-pomo.mjs   # pomodoro tables + seeded categories + session count
```

## Where things live
```
src/
  app/
    layout.tsx                          # theme provider, fonts, bottom nav, toaster
    page.tsx                            # client redirect → /journal/[today]
    actions/                            # all "use server" mutation actions
    journal/[date]/                     # daily entry
    habits/[date]/                      # rolling 15-day grid + past-date logging
    pomodoro/[date]/                    # focus timer + day stats + session list
    insights/                           # configurable trends (7/15/30/90)
    gym/                                # workout log + body heatmap
    settings/                           # journal questions, pomo categories, sound
    more/                               # hub linking to Gym + Settings
  components/
    bottom-nav.tsx                      # fixed bottom nav (5 tabs: Journal/Habits/Pomodoro/Insights/More)
    date-picker-popover.tsx             # status-colored calendar popover (used by all date steppers)
    body-svg/                           # 2D anatomical front+back body
    ui/                                 # shadcn primitives (base-ui-backed)
  db/{client.ts, schema.ts}             # drizzle schema (10 tables)
  db/queries/                           # all reads
  lib/                                  # DB-free helpers + client-safe constants
    dates.ts                            # local-tz YYYY-MM-DD helpers + month-matrix
    journal-status.ts                   # JournalStatus union + STATUS_META + statusBg()
    pomodoro-status.ts                  # computePomodoroStatus() reusing the same palette
    pomodoro-meta.ts                    # durations, sound options, default categories
    pomodoro-audio.ts                   # Web Audio synth (4 sound profiles, no mp3 assets)
    habit-meta.ts, task-meta.ts, muscle-groups.ts
drizzle/migrations/                     # generated SQL — commit these
public/                                 # PWA manifest + icons + service worker
scripts/check-db.mjs, check-pomo.mjs    # ad-hoc DB inspection
```

## Build order (shipped)
- ✅ Day 1-9 (Phase 1): scaffold → journal → habits → settings → insights → gym → PWA → polish → deploy
- ✅ Phase 2 · Days A-F.1: calendar popover, identity reminders, dated `/habits/[date]`, insights habit timeline, polish
- ✅ Phase 3 · Day A + A.1: pomodoro tab + insights focus section + animations + polish
- Later: 3D avatar (Phase 2 of gym), AI weekly reflections, export/import, FTS search

## Things that will bite if you forget
- **Tailwind v4 has no `tailwind.config.ts`** — theme config is CSS in `globals.css` via `@theme`. shadcn knows this.
- **`cookies()` is async in Next 16** — `await cookies()` everywhere.
- **Server Actions can be invoked via direct POST** — even with no auth, validate inputs (e.g. `isValidDateString`) inside the action.
- **Slider thumb is bumped to 1.5rem in `globals.css`** for finger-friendly mobile use. Don't undo this.
- **Folder is `Habit_Log` (Title_Case)** but `package.json` `name` is `habit_log` (lowercase) — npm forbids capitals. Don't try to "fix" the package name.
- **Status palette CSS variables** (`--status-crazy/great/good/avg/bad/empty`) are the single source of truth for all calendars and the focus heatmap. Don't hardcode fallbacks like `var(--muted)` — they'll drift from the legend. Use `statusBg(status)` (from `src/lib/journal-status.ts`) consistently.
- **PWA cache** — bump `VERSION` in `public/sw.js` on every deploy or installed phones get a stale shell. Update the SHELL array when you add a new top-level route. Current: `habit-log-v3`.
- **`react-hooks/set-state-in-effect` is demoted to warn** in `eslint.config.mjs` — there's an intentional state-sync exemption used in several dialogs and the date-picker popover. Don't try to "fix" those warnings; they are deliberate.
