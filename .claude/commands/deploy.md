---
description: Push + vercel prod deploy. Pauses at deploy boundary per project rule.
---

Ship the current branch to production.

**Pre-flight:**
1. `git status --short` — working tree must be clean.
2. `git log origin/main..HEAD --oneline` — show what's about to ship.
3. Verify no schema migration is pending on prod (if there is, run `/migrate-prod` FIRST).
4. Verify PWA `VERSION` in `public/sw.js` was bumped if this deploy touches shell / adds a route.
5. STOP and wait for explicit "ship it" (per `feedback_wait_before_deploy.md`).

**Deploy sequence:**
```bash
git push origin main
vercel --prod --yes
```

**Post-deploy:**
- Report the deployment URL from Vercel output.
- Probe a couple of routes (`/`, `/journal/{today}`) for 200.
- Update PROGRESS.md's "State at session end" section with the deploy timestamp + SHA.

**NEVER:**
- Force-push to main.
- Skip hooks (`--no-verify`).
- Add `Co-Authored-By: Claude` trailer to any commit / amend (per `feedback_no_claude_coauthor.md`).
