---
description: Run tsc + lint + build in parallel. Report clean/errors.
---

Run the three verification passes in parallel from `D:/sathw/Experiments/Habit_Log`:

1. `npx tsc --noEmit`
2. `npm run lint`
3. `npm run build`

Report:
- Each pass: clean / N errors / N warnings.
- If any errors, list file:line + one-sentence cause per error.
- Do NOT auto-fix. Just report.

Warnings expected pattern: `react-hooks/set-state-in-effect` (documented intentional exemption — do not flag unless count differs from PROGRESS.md's most recent tally).
