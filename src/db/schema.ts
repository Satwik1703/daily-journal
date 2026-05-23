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

export const journalQuestions = sqliteTable("journal_questions", {
  id: text("id").primaryKey(),
  label: text("label").notNull(),
  type: text("type", { enum: ["text", "scale", "boolean"] }).notNull(),
  position: integer("position").notNull().default(0),
  archivedAt: integer("archived_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const journalEntries = sqliteTable("journal_entries", {
  // YYYY-MM-DD in local time. Lexicographic sort = chronological.
  date: text("date").primaryKey(),
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
});

export const journalTasks = sqliteTable(
  "journal_tasks",
  {
    id: text("id").primaryKey(),
    date: text("date")
      .notNull()
      .references(() => journalEntries.date, { onDelete: "cascade" }),
    kind: text("kind", { enum: ["goal", "nonNegotiable", "secondary"] }).notNull(),
    text: text("text").notNull(),
    done: integer("done", { mode: "boolean" }).notNull().default(false),
    position: integer("position").notNull().default(0),
  },
  (t) => [index("journal_tasks_date_kind").on(t.date, t.kind)],
);

// ---------- Habits ----------

export const habits = sqliteTable("habits", {
  id: text("id").primaryKey(),
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
    habitId: text("habit_id")
      .notNull()
      .references(() => habits.id, { onDelete: "cascade" }),
    date: text("date").notNull(),
    value: real("value").notNull(),
    note: text("note"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [index("habit_value_logs_habit_date").on(t.habitId, t.date)],
);

// Absence = not done. PK on (habitId, date) makes idempotent inserts trivial.
export const habitLogs = sqliteTable(
  "habit_logs",
  {
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

// ---------- Pomodoro ----------

export const pomodoroCategories = sqliteTable("pomodoro_categories", {
  id: text("id").primaryKey(),
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

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value", { mode: "json" }),
});
