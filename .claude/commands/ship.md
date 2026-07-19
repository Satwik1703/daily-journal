---
description: Full deploy — migrate → seed (if needed) → push → vercel. Pauses at each boundary.
---

Full deploy sequence: DB → git → Vercel.

**Steps (each pauses for "go" before executing):**

1. **Migrate prod** (only if unapplied migrations exist) — see `/migrate-prod`.
2. **Seed prod** (only if the current phase requires it — check PROGRESS.md's "Deploy steps" section for the shipped phase) — see `/seed-prod`.
3. **Push + Vercel** — see `/deploy`.

**Between each step:**
- Report what just happened.
- Confirm next step.
- Wait for explicit "go" / "ship it".

**Post-full-deploy:**
- Bump PWA `VERSION` reminder if shell / routes changed.
- Update PROGRESS.md "State at session end".
