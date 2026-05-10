<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Current state — read this first

@PROGRESS.md

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
7. **Client components must not import runtime values from `src/db/**`.** The DB client transitively requires native Node deps (`fs`, `child_process`). Type-only imports (`import type { ... }`) are erased and safe; **mixed runtime+type imports drag the whole graph into the browser bundle and crash with `Module not found: Can't resolve 'fs'`.** Put any constant that a client component needs in `src/lib/*` (see `src/lib/task-meta.ts`, `src/lib/muscle-groups.ts`, `src/lib/habit-meta.ts`). Use `import { createClient } from "@libsql/client/node"` explicitly — the default `@libsql/client` resolves to the web variant under Turbopack and rejects `file:` URLs. `next.config.ts` also lists `libsql` and `@libsql/client` in `serverExternalPackages` as a safety net.

## Useful scripts

```bash
npm run dev           # next dev (Turbopack)
npm run db:generate   # drizzle-kit generate (after schema.ts changes)
npm run db:migrate    # apply pending migrations to TURSO_DATABASE_URL
npm run db:push       # quick dev-only sync (skips migration history)
npm run db:studio     # drizzle-kit studio UI

node scripts/check-db.mjs   # quick "what's in the local DB"
```

## Where things live
```
src/
  app/
    layout.tsx                          # theme provider, fonts, bottom nav, toaster
    page.tsx                            # client redirect → /journal/[today]
    journal/[date]/                     # daily entry — done (Day 1)
      page.tsx                          # server component, loads entry by date
      _components/{date-stepper,journal-form}.tsx
    habits/, insights/, gym/, settings/ # ComingSoon placeholders
    actions/journal.ts                  # saveJournalEntry server action
  components/
    bottom-nav.tsx                      # fixed bottom nav, highlights active route
    coming-soon.tsx                     # placeholder for unbuilt pages
    ui/                                 # shadcn primitives (base-ui-backed)
  db/{client.ts, schema.ts}             # drizzle schema (8 tables)
  lib/{dates.ts, utils.ts}              # local-tz helpers, cn()
drizzle/migrations/                     # generated SQL — commit these
public/                                 # PWA manifest + icons land here later
scripts/check-db.mjs                    # ad-hoc DB inspection
```

## Build order (per the approved plan)
- ✅ Day 1: scaffold, schema, journal page, autosave, bottom nav
- Day 2: habits CRUD + today quick-check + 30-day grid
- Day 3: settings → dynamic journal questions, goals/non-neg/secondary
- Day 4: insights (Tremor charts, streaks, gratitude words)
- Day 5: gym workouts + 2D SVG body picker
- Day 6: SVG avatar Phase 1 + PWA (manifest + service worker) + install on phone
- Day 7: polish, loading skeletons, iOS safe areas
- Later: 3D avatar (Phase 2), AI weekly reflections, export

## Things that will bite if you forget
- **Tailwind v4 has no `tailwind.config.ts`** — theme config is CSS in `globals.css` via `@theme`. shadcn knows this.
- **`cookies()` is async in Next 16** — `await cookies()` everywhere.
- **Server Actions can be invoked via direct POST** — even with no auth, validate inputs (e.g. `isValidDateString`) inside the action.
- **Slider thumb is bumped to 1.5rem in `globals.css`** for finger-friendly mobile use. Don't undo this.
- **Folder is `Habit_Log` (Title_Case)** but `package.json` `name` is `habit_log` (lowercase) — npm forbids capitals. Don't try to "fix" the package name.
