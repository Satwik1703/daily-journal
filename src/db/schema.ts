import { sql } from "drizzle-orm";
import {
  sqliteTable,
  text,
  integer,
  primaryKey,
  index,
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
  position: integer("position").notNull().default(0),
  archivedAt: integer("archived_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

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

// ---------- Gym ----------

export const workouts = sqliteTable(
  "workouts",
  {
    id: text("id").primaryKey(),
    date: text("date").notNull(),
    notes: text("notes"),
    durationMin: integer("duration_min"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [index("workouts_date").on(t.date)],
);

export const muscleLogs = sqliteTable(
  "muscle_logs",
  {
    id: text("id").primaryKey(),
    workoutId: text("workout_id")
      .notNull()
      .references(() => workouts.id, { onDelete: "cascade" }),
    muscle: text("muscle").notNull(),
    intensity: text("intensity", { enum: ["light", "medium", "heavy"] }).notNull(),
  },
  (t) => [
    index("muscle_logs_workout").on(t.workoutId),
    index("muscle_logs_muscle").on(t.muscle),
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

// ---------- Settings (single-row KV) ----------

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value", { mode: "json" }),
});
