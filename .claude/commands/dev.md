---
description: Start Next dev server in background. Leaves it running across tasks.
---

Start the Habit_Log dev server in the background if not already running.

Steps:
1. Check if `npm run dev` is already running (search running background shells for `next dev` or port 3000 listener via `netstat -ano | findstr :3000`).
2. If not running, launch `npm run dev` with `run_in_background: true` from `D:/sathw/Experiments/Habit_Log`.
3. Wait ~4s, tail the last ~30 lines of output to confirm `Ready`.
4. Report the local URL (`http://localhost:3000`) and the background shell id so I can tail it later.

Standing rule: leave dev server running across the whole session. Only stop on explicit "stop dev" / "session done".
