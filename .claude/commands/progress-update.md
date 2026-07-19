---
description: Append a new phase / part entry to PROGRESS.md following the established format.
---

Append a new phase entry to `PROGRESS.md`.

**Read the last 3 phase entries first** to match the exact format (headers, section ordering, verification block, deploy block).

**Required sections in the new entry:**
- `## ✅ Phase N — <short title>` (or `🚧` if in-progress)
- **Context / Why** — problem this solves
- **Shipped** — bullet list of concrete changes (files touched, actions added, schema)
- **Verification** — tsc / lint / build / probe results
- **Deploy** — step-by-step, or "local only" if not shipped

**Also update:**
- The `📌 Resume here for the next session` block at the bottom — new state at session end.
- Any deferred items list if this phase closes one.

Do NOT create a new file. Edit `PROGRESS.md` in place.
