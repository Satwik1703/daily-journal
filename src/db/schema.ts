import { sql } from "drizzle-orm";
import {
  sqliteTable,
  text,
  integer,
  real,
  primaryKey,
  index,
  type AnySQLiteColumn,
} from "drizzle-orm/sqlite-core";

// ---------- Journal ----------

export const journalQuestions = sqliteTable(
  "journal_questions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    label: text("label").notNull(),
    type: text("type", { enum: ["text", "scale", "boolean"] }).notNull(),
    position: integer("position").notNull().default(0),
    archivedAt: integer("archived_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [index("journal_questions_user").on(t.userId)],
);

export const journalEntries = sqliteTable(
  "journal_entries",
  {
    userId: text("user_id").notNull(),
    // YYYY-MM-DD in local time. Lexicographic sort = chronological.
    date: text("date").notNull(),
  gratitude1: text("gratitude_1"),
  gratitude2: text("gratitude_2"),
  gratitude3: text("gratitude_3"),
  // "Identity Reminders" — five short affirmations about who the user wants to be.
  identity1: text("identity_1"),
  identity2: text("identity_2"),
  identity3: text("identity_3"),
  identity4: text("identity_4"),
  identity5: text("identity_5"),
  energy: integer("energy"),
  mood: integer("mood"),
  sleepQuality: integer("sleep_quality"),
  // { [questionId]: string | number | boolean }
  answers: text("answers", { mode: "json" }).$type<Record<string, unknown>>(),
    tomorrowPlan: text("tomorrow_plan"),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [primaryKey({ columns: [t.userId, t.date] })],
);

export const journalTasks = sqliteTable(
  "journal_tasks",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    date: text("date").notNull(),
    kind: text("kind", { enum: ["goal", "nonNegotiable", "secondary"] }).notNull(),
    text: text("text").notNull(),
    done: integer("done", { mode: "boolean" }).notNull().default(false),
    position: integer("position").notNull().default(0),
    // Phase 11.1: when this task is a "trace stub" left behind by moveJournalTask,
    // points at the date the task was moved TO. Null otherwise. Lets TraceRow be
    // a tappable Link without parsing the human-readable text.
    movedToDate: text("moved_to_date"),
  },
  (t) => [
    index("journal_tasks_date_kind").on(t.date, t.kind),
    index("journal_tasks_user_date").on(t.userId, t.date),
  ],
);

// ---------- Habits ----------

export const habits = sqliteTable("habits", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  emoji: text("emoji"),
  color: text("color").notNull().default("#10b981"),
  cadence: text("cadence", { enum: ["daily", "weekly"] }).notNull().default("daily"),
  targetPerWeek: integer("target_per_week"),
  // Phase 6: how this habit gets marked "done" on a given day.
  //   binary    -> habit_logs row exists for (habitId, date)
  //   number    -> SUM(habit_value_logs.value) for date >= daily_target
  //   pomodoro  -> COUNT(pomodoro_sessions) for category + date >= daily_target
  trackingKind: text("tracking_kind", { enum: ["binary", "number", "pomodoro"] })
    .notNull()
    .default("binary"),
  dailyTarget: real("daily_target"), // null for binary
  unit: text("unit"),                 // "steps" / "pages" / etc — only for number
  pomoCategoryId: text("pomo_category_id").references(
    (): AnySQLiteColumn => pomodoroCategories.id,
    { onDelete: "set null" },
  ),
  // Phase 10: 7-bit weekday mask. Bit i = JS Date.getDay() (Sun=0..Sat=6).
  // Default 127 = 0b1111111 = all days. Habit hidden on weekdays where the
  // corresponding bit is 0.
  weekdayMask: integer("weekday_mask").notNull().default(127),
  // Phase 11.1: difficulty multiplier feeding XP. 1.0 = baseline.
  difficulty: real("difficulty").notNull().default(1.0),
  position: integer("position").notNull().default(0),
  archivedAt: integer("archived_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

// Phase 6: numeric per-day deltas for `trackingKind = "number"` habits.
// Multiple rows per day are allowed and summed on read.
export const habitValueLogs = sqliteTable(
  "habit_value_logs",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    habitId: text("habit_id")
      .notNull()
      .references(() => habits.id, { onDelete: "cascade" }),
    date: text("date").notNull(),
    value: real("value").notNull(),
    note: text("note"),
    // Phase 11.1: optional link to a book row. Set when the Read habit logs
    // pages against a specific book; null for any other number-kind habit.
    bookId: text("book_id").references((): AnySQLiteColumn => books.id, {
      onDelete: "set null",
    }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    index("habit_value_logs_habit_date").on(t.habitId, t.date),
    index("habit_value_logs_book").on(t.bookId),
  ],
);

// Absence = not done. PK on (habitId, date) makes idempotent inserts trivial.
export const habitLogs = sqliteTable(
  "habit_logs",
  {
    userId: text("user_id").notNull(),
    habitId: text("habit_id")
      .notNull()
      .references(() => habits.id, { onDelete: "cascade" }),
    date: text("date").notNull(),
    loggedAt: integer("logged_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    primaryKey({ columns: [t.habitId, t.date] }),
    index("habit_logs_date").on(t.date),
  ],
);

// ---------- Gym (Phase 9 rewamp) ----------

export const splits = sqliteTable("splits", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  emoji: text("emoji"),
  color: text("color").notNull().default("#10b981"),
  position: integer("position").notNull().default(0),
  archivedAt: integer("archived_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const exercises = sqliteTable("exercises", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  emoji: text("emoji"),
  color: text("color").notNull().default("#10b981"),
  // JSON array of MuscleGroup ids (e.g. ["chest", "front_delts", "triceps"]).
  muscleGroups: text("muscle_groups", { mode: "json" })
    .$type<string[]>()
    .notNull(),
  notes: text("notes"),
  // True for single-arm/leg loads (dumbbell curl, single-arm row): weight is
  // logged per-hand and displayed with an "each" badge so future logs match.
  perHand: integer("per_hand", { mode: "boolean" }).notNull().default(false),
  position: integer("position").notNull().default(0),
  archivedAt: integer("archived_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const splitExercises = sqliteTable(
  "split_exercises",
  {
    userId: text("user_id").notNull(),
    splitId: text("split_id")
      .notNull()
      .references(() => splits.id, { onDelete: "cascade" }),
    exerciseId: text("exercise_id")
      .notNull()
      .references(() => exercises.id, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0),
  },
  (t) => [
    primaryKey({ columns: [t.splitId, t.exerciseId] }),
    index("split_exercises_split").on(t.splitId),
  ],
);

export const workouts = sqliteTable(
  "workouts",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    date: text("date").notNull(),
    splitId: text("split_id").references(() => splits.id, { onDelete: "set null" }),
    notes: text("notes"),
    durationMin: integer("duration_min"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [index("workouts_date").on(t.date)],
);

export const workoutSets = sqliteTable(
  "workout_sets",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    workoutId: text("workout_id")
      .notNull()
      .references(() => workouts.id, { onDelete: "cascade" }),
    exerciseId: text("exercise_id")
      .notNull()
      .references(() => exercises.id, { onDelete: "restrict" }),
    setNumber: integer("set_number").notNull(),
    reps: integer("reps"),
    weightKg: real("weight_kg"),
    rpe: real("rpe"),
    isWarmup: integer("is_warmup", { mode: "boolean" }).notNull().default(false),
    note: text("note"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    index("workout_sets_workout").on(t.workoutId),
    index("workout_sets_exercise").on(t.exerciseId),
    index("workout_sets_exercise_created").on(t.exerciseId, t.createdAt),
  ],
);

// Phase 9.2: optional body weight tracking for recomp visualization.
export const bodyWeightLogs = sqliteTable(
  "body_weight_logs",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    date: text("date").notNull(),
    weightKg: real("weight_kg").notNull(),
    note: text("note"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [index("body_weight_logs_date").on(t.date)],
);

// ---------- Pomodoro ----------

export const pomodoroCategories = sqliteTable("pomodoro_categories", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  emoji: text("emoji"),
  color: text("color").notNull().default("#10b981"),
  position: integer("position").notNull().default(0),
  archivedAt: integer("archived_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const pomodoroSessions = sqliteTable(
  "pomodoro_sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    date: text("date").notNull(), // YYYY-MM-DD (local-tz)
    startedAt: integer("started_at", { mode: "timestamp" }).notNull(),
    endedAt: integer("ended_at", { mode: "timestamp" }).notNull(),
    durationMin: integer("duration_min").notNull(),
    plannedMin: integer("planned_min").notNull(),
    categoryId: text("category_id").references(() => pomodoroCategories.id, {
      onDelete: "set null",
    }),
    description: text("description"),
    source: text("source", { enum: ["timer", "manual", "partial"] }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    index("pomodoro_sessions_date").on(t.date),
    index("pomodoro_sessions_category").on(t.categoryId),
  ],
);

// ---------- Goals (weekly / monthly / yearly) ----------

export const goals = sqliteTable(
  "goals",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    // Period namespace. `periodKey` is scoped to this enum:
    //   week  -> "2026-W21"     (ISO 8601 week)
    //   month -> "2026-05"
    //   year  -> "2026"
    period: text("period", { enum: ["week", "month", "year"] }).notNull(),
    periodKey: text("period_key").notNull(),
    parentId: text("parent_id").references((): AnySQLiteColumn => goals.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    emoji: text("emoji"),
    color: text("color").notNull().default("#10b981"),
    type: text("type", {
      enum: ["number", "habit", "pomodoro", "milestone"],
    }).notNull(),
    // Target for number/habit/pomodoro types. Milestone uses checklist-only.
    targetValue: real("target_value"),
    unit: text("unit"),
    // Habit-linked
    habitId: text("habit_id").references(() => habits.id, { onDelete: "set null" }),
    // Pomodoro-linked
    pomoCategoryId: text("pomo_category_id").references(
      () => pomodoroCategories.id,
      { onDelete: "set null" },
    ),
    pomoMetric: text("pomo_metric", {
      enum: ["minutes", "pomos", "sessions"],
    }),
    status: text("status", {
      enum: ["active", "achieved", "missed", "archived"],
    })
      .notNull()
      .default("active"),
    finalizedAt: integer("finalized_at", { mode: "timestamp" }),
    reflectionNote: text("reflection_note"),
    reflectionRating: integer("reflection_rating"),
    reflectionLinkedDate: text("reflection_linked_date"),
    reflectionSavedAt: integer("reflection_saved_at", { mode: "timestamp" }),
    // Phase 7: when true, surfaces in the "Important" top section on /goals.
    pinned: integer("pinned", { mode: "boolean" }).notNull().default(false),
    position: integer("position").notNull().default(0),
    archivedAt: integer("archived_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    index("goals_period_key").on(t.period, t.periodKey),
    index("goals_parent").on(t.parentId),
    index("goals_status").on(t.status),
    index("goals_pinned").on(t.pinned),
  ],
);

// Number-type increments. One row per "log progress" tap.
export const goalProgress = sqliteTable(
  "goal_progress",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    goalId: text("goal_id")
      .notNull()
      .references(() => goals.id, { onDelete: "cascade" }),
    date: text("date").notNull(),
    delta: real("delta").notNull().default(0),
    note: text("note"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [index("goal_progress_goal_date").on(t.goalId, t.date)],
);

// Milestone-type sub-tasks. Order = position; done = checked.
export const goalChecklist = sqliteTable(
  "goal_checklist",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    goalId: text("goal_id")
      .notNull()
      .references(() => goals.id, { onDelete: "cascade" }),
    text: text("text").notNull(),
    done: integer("done", { mode: "boolean" }).notNull().default(false),
    position: integer("position").notNull().default(0),
  },
  (t) => [index("goal_checklist_goal").on(t.goalId)],
);

// ---------- Settings (single-row KV) ----------

export const settings = sqliteTable(
  "settings",
  {
    userId: text("user_id").notNull(),
    key: text("key").notNull(),
    value: text("value", { mode: "json" }),
  },
  (t) => [primaryKey({ columns: [t.userId, t.key] })],
);

// ---------- Auth (Phase 12) ----------

// One row per user. Identity for floating-tile login screen + emoji-passphrase auth.
// `passhash` is SHA-256(orderedPassphraseEmojis + salt) hex. Null until the user
// completes their first login (used for auto-seeded users like the original owner,
// who set their passphrase on first sign-in). `honeypotEmoji` is a single emoji
// stored at signup; any login attempt that includes it returns "wrong combo".
// `tileGradientFrom/To`, `tileFont`, `tileBorder` drive the per-user tile look on
// the login roster. `recoveryStrokesJson` is the resampled 64-point doodle drawn
// at signup, used by the "forgot passphrase" doodle-match recovery flow.
export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    // Stored lowercased copy for unique-index enforcement (SQLite has no
    // expression indexes via Drizzle yet).
    nameLower: text("name_lower").notNull(),
    passhash: text("passhash"),
    salt: text("salt"),
    passphrasePlain: text("passphrase_plain"),
    honeypotEmoji: text("honeypot_emoji"),
    passphraseHintEmoji: text("passphrase_hint_emoji"),
    tileGradientFrom: text("tile_gradient_from").notNull().default("#4fa896"),
    tileGradientTo: text("tile_gradient_to").notNull().default("#7fc7b9"),
    tileFont: text("tile_font", {
      enum: ["lora", "fraunces", "space_grotesk", "ibm_plex_mono"],
    })
      .notNull()
      .default("lora"),
    tileBorder: text("tile_border", {
      enum: ["rounded", "square", "wax_seal", "stamped"],
    })
      .notNull()
      .default("rounded"),
    recoveryStrokesJson: text("recovery_strokes_json"),
    isOwner: integer("is_owner", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [index("users_name_lower_unique").on(t.nameLower)],
);

// One row per active session. 14-day sliding expiry — middleware bumps
// `expiresAt + lastSeenAt` on every authed request older than 24h.
export const sessions = sqliteTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    deviceNickname: text("device_nickname"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    lastSeenAt: integer("last_seen_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  },
  (t) => [
    index("sessions_user").on(t.userId),
    index("sessions_expires_at").on(t.expiresAt),
  ],
);

// Rolling-window log of login + recovery attempts per user. `kind`
// partitions throttle counts: 'login' (3-fail hint), 'recovery_doodle',
// 'recovery_code' (Part F).
export const loginAttempts = sqliteTable(
  "login_attempts",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    succeeded: integer("succeeded", { mode: "boolean" }).notNull(),
    kind: text("kind", {
      enum: ["login", "recovery_doodle", "recovery_code"],
    })
      .notNull()
      .default("login"),
    attemptedAt: integer("attempted_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    index("login_attempts_user_attempted").on(t.userId, t.attemptedAt),
  ],
);

// Owner-issued 6-digit codes for friend recovery. Only `code_hash` (SHA-256)
// is stored; plaintext is shown to the owner once at issue time.
export const recoveryCodes = sqliteTable(
  "recovery_codes",
  {
    id: text("id").primaryKey(),
    targetUserId: text("target_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    codeHash: text("code_hash").notNull(),
    issuedByUserId: text("issued_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
    usedAt: integer("used_at", { mode: "timestamp" }),
  },
  (t) => [index("recovery_codes_target_active").on(t.targetUserId, t.usedAt)],
);

// ---------- Books (Phase 11.1) ----------

// Books being read / wishlisted / finished. Per-day pages are not stored here;
// they're rows in `habit_value_logs` with this book's id in `book_id`. Progress
// is derived as SUM(habit_value_logs.value WHERE book_id = ?).
export const books = sqliteTable(
  "books",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    title: text("title").notNull(),
    author: text("author"),
    totalPages: integer("total_pages"),
    startedAt: text("started_at"),
    finishedAt: text("finished_at"),
    rating: integer("rating"),
    notes: text("notes"),
    status: text("status", {
      enum: ["reading", "finished", "dnf", "wishlist"],
    })
      .notNull()
      .default("reading"),
    color: text("color").notNull().default("#a89b6a"),
    position: integer("position").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [index("books_status").on(t.status)],
);

// ---------- Todo (Phase 13: TickTick-style task manager) ----------

// A todo list (or a folder grouping lists). `kind = 'folder'` rows are
// containers; `kind = 'list'` rows can sit inside a folder via `parentId`.
// Todos with `listId = null` live in the implicit Inbox.
export const todoLists = sqliteTable(
  "todo_lists",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    name: text("name").notNull(),
    emoji: text("emoji"),
    color: text("color").notNull().default("#3b82f6"),
    kind: text("kind", { enum: ["list", "folder"] })
      .notNull()
      .default("list"),
    // Folder this list belongs to (folder rows have parentId = null).
    parentId: text("parent_id"),
    // Saved view mode for this list (Phase 4 adds non-list modes).
    viewMode: text("view_mode", {
      enum: ["list", "kanban", "calendar", "eisenhower", "timeline"],
    })
      .notNull()
      .default("list"),
    position: integer("position").notNull().default(0),
    archivedAt: integer("archived_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [index("todo_lists_user").on(t.userId)],
);

// A todo. `parentId` (self-FK) makes it a subtask of another todo. `listId`
// null = Inbox. `repeatJson` + `sectionId` are reserved for later phases
// (added now as nullable to avoid a future table rebuild).
export const todos = sqliteTable(
  "todos",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    // List bucket (null = Inbox). FK set null so deleting a list orphans its
    // todos back to the Inbox rather than destroying them.
    listId: text("list_id").references((): AnySQLiteColumn => todoLists.id, {
      onDelete: "set null",
    }),
    // Parent todo for subtasks (null = top-level).
    parentId: text("parent_id"),
    // Section within a list (Phase 2).
    sectionId: text("section_id"),
    title: text("title").notNull(),
    note: text("note"),
    // 0 = none, 1 = low, 2 = medium, 3 = high.
    priority: integer("priority").notNull().default(0),
    status: text("status", { enum: ["active", "done", "wontDo"] })
      .notNull()
      .default("active"),
    completedAt: integer("completed_at", { mode: "timestamp" }),
    dueDate: text("due_date"),
    dueTime: text("due_time"),
    isAllDay: integer("is_all_day", { mode: "boolean" })
      .notNull()
      .default(true),
    // Recurrence rule JSON (Phase 3).
    repeatJson: text("repeat_json"),
    pinned: integer("pinned", { mode: "boolean" }).notNull().default(false),
    // Real so we can insert between two rows without renumbering.
    position: real("position").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    index("todos_user_status").on(t.userId, t.status),
    index("todos_user_list").on(t.userId, t.listId),
    index("todos_user_due").on(t.userId, t.dueDate),
    index("todos_parent").on(t.parentId),
  ],
);

// Todo tags (Phase 14 Part 2). Many-to-many with todos via todo_tag_links.
export const todoTags = sqliteTable(
  "todo_tags",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    name: text("name").notNull(),
    // Lowercased copy for case-insensitive uniqueness checks.
    nameLower: text("name_lower").notNull(),
    color: text("color").notNull().default("#64748b"),
    position: integer("position").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [index("todo_tags_user").on(t.userId, t.nameLower)],
);

export const todoTagLinks = sqliteTable(
  "todo_tag_links",
  {
    userId: text("user_id").notNull(),
    todoId: text("todo_id")
      .notNull()
      .references((): AnySQLiteColumn => todos.id, { onDelete: "cascade" }),
    tagId: text("tag_id")
      .notNull()
      .references((): AnySQLiteColumn => todoTags.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.todoId, t.tagId] }),
    index("todo_tag_links_tag").on(t.tagId),
    index("todo_tag_links_user").on(t.userId),
  ],
);

// Sections within a list (Phase 14 Part 3). todos.sectionId points here;
// deleting a section nulls out its todos' sectionId (handled in the action).
export const todoSections = sqliteTable(
  "todo_sections",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    listId: text("list_id")
      .notNull()
      .references((): AnySQLiteColumn => todoLists.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    position: integer("position").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [index("todo_sections_list").on(t.listId)],
);
