---
description: Apply pending Drizzle migrations to prod Turso. Pauses before executing.
---

Apply pending migrations to production Turso.

**Pre-flight (must confirm before running):**
1. Report which migration files under `drizzle/migrations/` are new since the last prod deploy (grep PROGRESS.md for the highest migration mentioned as "applied to prod").
2. Summarize what each pending migration does (read the SQL).
3. STOP and wait for explicit "go" / "ship it" (per `feedback_wait_before_deploy.md`).

**Run:**
```powershell
Get-Content .env.production.local | ForEach-Object {
  if ($_ -match '^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.+?)\s*$') {
    Set-Item -Path "Env:\$($matches[1])" -Value $matches[2].Trim('"')
  }
}
npm run db:migrate
```

**Post-run:**
- Confirm each migration id is now in prod's `__drizzle_migrations` table.
- Update PROGRESS.md's "State at session end" with the new highest applied migration.
