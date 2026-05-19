CREATE TABLE `pomodoro_categories` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`emoji` text,
	`color` text DEFAULT '#10b981' NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`archived_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `pomodoro_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`date` text NOT NULL,
	`started_at` integer NOT NULL,
	`ended_at` integer NOT NULL,
	`duration_min` integer NOT NULL,
	`planned_min` integer NOT NULL,
	`category_id` text,
	`description` text,
	`source` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `pomodoro_categories`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `pomodoro_sessions_date` ON `pomodoro_sessions` (`date`);--> statement-breakpoint
CREATE INDEX `pomodoro_sessions_category` ON `pomodoro_sessions` (`category_id`);