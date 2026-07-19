---
description: Run a seed script against prod Turso. Destructive — pauses before executing.
---

Run a seed script against production Turso.

**Args:** the seed script filename (e.g. `seed-habits-goals.mjs`, `seed-protein-handgrip.mjs`).

**Pre-flight:**
1. Read the script; identify whether it's destructive (wipes tables) or additive (skip-if-present).
2. If destructive, list every table it wipes.
3. STOP and wait for explicit "go" / "ship it" (per `feedback_wait_before_deploy.md`).

**Run:**
```powershell
Get-Content .env.production.local | ForEach-Object {
  if ($_ -match '^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.+?)\s*$') {
    Set-Item -Path "Env:\$($matches[1])" -Value $matches[2].Trim('"')
  }
}
node scripts/<SCRIPT_FILENAME> prod
```

**Post-run:**
- Report row counts inserted / deleted.
- Update PROGRESS.md's "State at session end" if the seeded state is now the canonical prod state.
