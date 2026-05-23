-- Phase 9 gym rewamp: drop intensity-only model, replace with splits + exercises + workout sets.
-- Existing `workouts` + `muscle_logs` data is throwaway placeholder (per plan).

DROP TABLE IF EXISTS `muscle_logs`;--> statement-breakpoint
DROP TABLE IF EXISTS `workouts`;--> statement-breakpoint

CREATE TABLE `splits` (
  `id` text PRIMARY KEY NOT NULL,
  `name` text NOT NULL,
  `emoji` text,
  `color` text DEFAULT '#10b981' NOT NULL,
  `position` integer DEFAULT 0 NOT NULL,
  `archived_at` integer,
  `created_at` integer DEFAULT (unixepoch()) NOT NULL
);--> statement-breakpoint

CREATE TABLE `exercises` (
  `id` text PRIMARY KEY NOT NULL,
  `name` text NOT NULL,
  `emoji` text,
  `color` text DEFAULT '#10b981' NOT NULL,
  `muscle_groups` text NOT NULL,
  `notes` text,
  `position` integer DEFAULT 0 NOT NULL,
  `archived_at` integer,
  `created_at` integer DEFAULT (unixepoch()) NOT NULL
);--> statement-breakpoint

CREATE TABLE `split_exercises` (
  `split_id` text NOT NULL,
  `exercise_id` text NOT NULL,
  `position` integer DEFAULT 0 NOT NULL,
  PRIMARY KEY(`split_id`, `exercise_id`),
  FOREIGN KEY (`split_id`) REFERENCES `splits`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`exercise_id`) REFERENCES `exercises`(`id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint
CREATE INDEX `split_exercises_split` ON `split_exercises` (`split_id`);--> statement-breakpoint

CREATE TABLE `workouts` (
  `id` text PRIMARY KEY NOT NULL,
  `date` text NOT NULL,
  `split_id` text,
  `notes` text,
  `duration_min` integer,
  `created_at` integer DEFAULT (unixepoch()) NOT NULL,
  FOREIGN KEY (`split_id`) REFERENCES `splits`(`id`) ON UPDATE no action ON DELETE set null
);--> statement-breakpoint
CREATE INDEX `workouts_date` ON `workouts` (`date`);--> statement-breakpoint

CREATE TABLE `workout_sets` (
  `id` text PRIMARY KEY NOT NULL,
  `workout_id` text NOT NULL,
  `exercise_id` text NOT NULL,
  `set_number` integer NOT NULL,
  `reps` integer,
  `weight_kg` real,
  `rpe` real,
  `is_warmup` integer DEFAULT false NOT NULL,
  `note` text,
  `created_at` integer DEFAULT (unixepoch()) NOT NULL,
  FOREIGN KEY (`workout_id`) REFERENCES `workouts`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`exercise_id`) REFERENCES `exercises`(`id`) ON UPDATE no action ON DELETE restrict
);--> statement-breakpoint
CREATE INDEX `workout_sets_workout` ON `workout_sets` (`workout_id`);--> statement-breakpoint
CREATE INDEX `workout_sets_exercise` ON `workout_sets` (`exercise_id`);--> statement-breakpoint
CREATE INDEX `workout_sets_exercise_created` ON `workout_sets` (`exercise_id`, `created_at`);
