CREATE TABLE `habit_logs` (
	`habit_id` text NOT NULL,
	`date` text NOT NULL,
	`logged_at` integer DEFAULT (unixepoch()) NOT NULL,
	PRIMARY KEY(`habit_id`, `date`),
	FOREIGN KEY (`habit_id`) REFERENCES `habits`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `habit_logs_date` ON `habit_logs` (`date`);--> statement-breakpoint
CREATE TABLE `habits` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`emoji` text,
	`color` text DEFAULT '#10b981' NOT NULL,
	`cadence` text DEFAULT 'daily' NOT NULL,
	`target_per_week` integer,
	`position` integer DEFAULT 0 NOT NULL,
	`archived_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `journal_entries` (
	`date` text PRIMARY KEY NOT NULL,
	`gratitude_1` text,
	`gratitude_2` text,
	`gratitude_3` text,
	`energy` integer,
	`mood` integer,
	`sleep_quality` integer,
	`answers` text,
	`tomorrow_plan` text,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `journal_questions` (
	`id` text PRIMARY KEY NOT NULL,
	`label` text NOT NULL,
	`type` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`archived_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `journal_tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`date` text NOT NULL,
	`kind` text NOT NULL,
	`text` text NOT NULL,
	`done` integer DEFAULT false NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`date`) REFERENCES `journal_entries`(`date`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `journal_tasks_date_kind` ON `journal_tasks` (`date`,`kind`);--> statement-breakpoint
CREATE TABLE `muscle_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`workout_id` text NOT NULL,
	`muscle` text NOT NULL,
	`intensity` text NOT NULL,
	FOREIGN KEY (`workout_id`) REFERENCES `workouts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `muscle_logs_workout` ON `muscle_logs` (`workout_id`);--> statement-breakpoint
CREATE INDEX `muscle_logs_muscle` ON `muscle_logs` (`muscle`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text
);
--> statement-breakpoint
CREATE TABLE `workouts` (
	`id` text PRIMARY KEY NOT NULL,
	`date` text NOT NULL,
	`notes` text,
	`duration_min` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `workouts_date` ON `workouts` (`date`);