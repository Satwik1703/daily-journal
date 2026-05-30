-- Phase 12 Part B: per-user data scoping.
-- - Adds nullable `user_id` to 17 simple tables (rules + indexes) and backfills
--   every existing row to the auto-seeded owner `u_satwik_seed_001`. App layer
--   treats `user_id` as required on every insert (we don't enforce NOT NULL at
--   the DB level to keep this migration cheap and reversible).
-- - Rebuilds `journal_entries` and `settings` to swap their PK to a composite
--   `(user_id, date)` / `(user_id, key)`. SQLite can't ALTER a PK in place, so
--   it's the standard rename-and-copy dance.
-- - Adds `users.passphrase_hint_emoji` (first emoji of passphrase, stored
--   unencrypted) for the 3-fail hint flow in Part E.

PRAGMA foreign_keys = OFF;--> statement-breakpoint

-- ---- users.passphrase_hint_emoji ----
ALTER TABLE `users` ADD `passphrase_hint_emoji` text;--> statement-breakpoint

-- ---- journal_questions ----
ALTER TABLE `journal_questions` ADD `user_id` text REFERENCES `users`(`id`) ON DELETE cascade;--> statement-breakpoint
UPDATE `journal_questions` SET `user_id` = 'u_satwik_seed_001';--> statement-breakpoint
CREATE INDEX `journal_questions_user` ON `journal_questions` (`user_id`);--> statement-breakpoint

-- ---- journal_entries (rebuild for composite PK) ----
CREATE TABLE `journal_entries_new` (
  `user_id` text NOT NULL,
  `date` text NOT NULL,
  `gratitude_1` text,
  `gratitude_2` text,
  `gratitude_3` text,
  `identity_1` text,
  `identity_2` text,
  `identity_3` text,
  `identity_4` text,
  `identity_5` text,
  `energy` integer,
  `mood` integer,
  `sleep_quality` integer,
  `answers` text,
  `tomorrow_plan` text,
  `updated_at` integer DEFAULT (unixepoch()) NOT NULL,
  PRIMARY KEY(`user_id`, `date`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint
INSERT INTO `journal_entries_new` (
  `user_id`, `date`, `gratitude_1`, `gratitude_2`, `gratitude_3`,
  `identity_1`, `identity_2`, `identity_3`, `identity_4`, `identity_5`,
  `energy`, `mood`, `sleep_quality`, `answers`, `tomorrow_plan`, `updated_at`
)
SELECT 'u_satwik_seed_001', `date`, `gratitude_1`, `gratitude_2`, `gratitude_3`,
  `identity_1`, `identity_2`, `identity_3`, `identity_4`, `identity_5`,
  `energy`, `mood`, `sleep_quality`, `answers`, `tomorrow_plan`, `updated_at`
FROM `journal_entries`;--> statement-breakpoint
DROP TABLE `journal_entries`;--> statement-breakpoint
ALTER TABLE `journal_entries_new` RENAME TO `journal_entries`;--> statement-breakpoint

-- ---- journal_tasks ----
ALTER TABLE `journal_tasks` ADD `user_id` text REFERENCES `users`(`id`) ON DELETE cascade;--> statement-breakpoint
UPDATE `journal_tasks` SET `user_id` = 'u_satwik_seed_001';--> statement-breakpoint
CREATE INDEX `journal_tasks_user_date` ON `journal_tasks` (`user_id`, `date`);--> statement-breakpoint

-- ---- habits ----
ALTER TABLE `habits` ADD `user_id` text REFERENCES `users`(`id`) ON DELETE cascade;--> statement-breakpoint
UPDATE `habits` SET `user_id` = 'u_satwik_seed_001';--> statement-breakpoint
CREATE INDEX `habits_user` ON `habits` (`user_id`);--> statement-breakpoint

-- ---- habit_logs ----
ALTER TABLE `habit_logs` ADD `user_id` text REFERENCES `users`(`id`) ON DELETE cascade;--> statement-breakpoint
UPDATE `habit_logs` SET `user_id` = 'u_satwik_seed_001';--> statement-breakpoint
CREATE INDEX `habit_logs_user_date` ON `habit_logs` (`user_id`, `date`);--> statement-breakpoint

-- ---- habit_value_logs ----
ALTER TABLE `habit_value_logs` ADD `user_id` text REFERENCES `users`(`id`) ON DELETE cascade;--> statement-breakpoint
UPDATE `habit_value_logs` SET `user_id` = 'u_satwik_seed_001';--> statement-breakpoint
CREATE INDEX `habit_value_logs_user_date` ON `habit_value_logs` (`user_id`, `date`);--> statement-breakpoint

-- ---- pomodoro_categories ----
ALTER TABLE `pomodoro_categories` ADD `user_id` text REFERENCES `users`(`id`) ON DELETE cascade;--> statement-breakpoint
UPDATE `pomodoro_categories` SET `user_id` = 'u_satwik_seed_001';--> statement-breakpoint
CREATE INDEX `pomodoro_categories_user` ON `pomodoro_categories` (`user_id`);--> statement-breakpoint

-- ---- pomodoro_sessions ----
ALTER TABLE `pomodoro_sessions` ADD `user_id` text REFERENCES `users`(`id`) ON DELETE cascade;--> statement-breakpoint
UPDATE `pomodoro_sessions` SET `user_id` = 'u_satwik_seed_001';--> statement-breakpoint
CREATE INDEX `pomodoro_sessions_user_date` ON `pomodoro_sessions` (`user_id`, `date`);--> statement-breakpoint

-- ---- goals ----
ALTER TABLE `goals` ADD `user_id` text REFERENCES `users`(`id`) ON DELETE cascade;--> statement-breakpoint
UPDATE `goals` SET `user_id` = 'u_satwik_seed_001';--> statement-breakpoint
CREATE INDEX `goals_user_period` ON `goals` (`user_id`, `period`, `period_key`);--> statement-breakpoint

-- ---- goal_progress ----
ALTER TABLE `goal_progress` ADD `user_id` text REFERENCES `users`(`id`) ON DELETE cascade;--> statement-breakpoint
UPDATE `goal_progress` SET `user_id` = 'u_satwik_seed_001';--> statement-breakpoint
CREATE INDEX `goal_progress_user` ON `goal_progress` (`user_id`);--> statement-breakpoint

-- ---- goal_checklist ----
ALTER TABLE `goal_checklist` ADD `user_id` text REFERENCES `users`(`id`) ON DELETE cascade;--> statement-breakpoint
UPDATE `goal_checklist` SET `user_id` = 'u_satwik_seed_001';--> statement-breakpoint
CREATE INDEX `goal_checklist_user` ON `goal_checklist` (`user_id`);--> statement-breakpoint

-- ---- splits ----
ALTER TABLE `splits` ADD `user_id` text REFERENCES `users`(`id`) ON DELETE cascade;--> statement-breakpoint
UPDATE `splits` SET `user_id` = 'u_satwik_seed_001';--> statement-breakpoint
CREATE INDEX `splits_user` ON `splits` (`user_id`);--> statement-breakpoint

-- ---- exercises ----
ALTER TABLE `exercises` ADD `user_id` text REFERENCES `users`(`id`) ON DELETE cascade;--> statement-breakpoint
UPDATE `exercises` SET `user_id` = 'u_satwik_seed_001';--> statement-breakpoint
CREATE INDEX `exercises_user` ON `exercises` (`user_id`);--> statement-breakpoint

-- ---- split_exercises ----
ALTER TABLE `split_exercises` ADD `user_id` text REFERENCES `users`(`id`) ON DELETE cascade;--> statement-breakpoint
UPDATE `split_exercises` SET `user_id` = 'u_satwik_seed_001';--> statement-breakpoint
CREATE INDEX `split_exercises_user` ON `split_exercises` (`user_id`);--> statement-breakpoint

-- ---- workouts ----
ALTER TABLE `workouts` ADD `user_id` text REFERENCES `users`(`id`) ON DELETE cascade;--> statement-breakpoint
UPDATE `workouts` SET `user_id` = 'u_satwik_seed_001';--> statement-breakpoint
CREATE INDEX `workouts_user_date` ON `workouts` (`user_id`, `date`);--> statement-breakpoint

-- ---- workout_sets ----
ALTER TABLE `workout_sets` ADD `user_id` text REFERENCES `users`(`id`) ON DELETE cascade;--> statement-breakpoint
UPDATE `workout_sets` SET `user_id` = 'u_satwik_seed_001';--> statement-breakpoint
CREATE INDEX `workout_sets_user` ON `workout_sets` (`user_id`);--> statement-breakpoint

-- ---- body_weight_logs ----
ALTER TABLE `body_weight_logs` ADD `user_id` text REFERENCES `users`(`id`) ON DELETE cascade;--> statement-breakpoint
UPDATE `body_weight_logs` SET `user_id` = 'u_satwik_seed_001';--> statement-breakpoint
CREATE INDEX `body_weight_logs_user_date` ON `body_weight_logs` (`user_id`, `date`);--> statement-breakpoint

-- ---- books ----
ALTER TABLE `books` ADD `user_id` text REFERENCES `users`(`id`) ON DELETE cascade;--> statement-breakpoint
UPDATE `books` SET `user_id` = 'u_satwik_seed_001';--> statement-breakpoint
CREATE INDEX `books_user` ON `books` (`user_id`);--> statement-breakpoint

-- ---- settings (rebuild for composite PK) ----
CREATE TABLE `settings_new` (
  `user_id` text NOT NULL,
  `key` text NOT NULL,
  `value` text,
  PRIMARY KEY(`user_id`, `key`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint
INSERT INTO `settings_new` (`user_id`, `key`, `value`)
SELECT 'u_satwik_seed_001', `key`, `value` FROM `settings`;--> statement-breakpoint
DROP TABLE `settings`;--> statement-breakpoint
ALTER TABLE `settings_new` RENAME TO `settings`;--> statement-breakpoint

PRAGMA foreign_keys = ON;
