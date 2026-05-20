CREATE TABLE `goal_checklist` (
	`id` text PRIMARY KEY NOT NULL,
	`goal_id` text NOT NULL,
	`text` text NOT NULL,
	`done` integer DEFAULT false NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`goal_id`) REFERENCES `goals`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `goal_checklist_goal` ON `goal_checklist` (`goal_id`);--> statement-breakpoint
CREATE TABLE `goal_progress` (
	`id` text PRIMARY KEY NOT NULL,
	`goal_id` text NOT NULL,
	`date` text NOT NULL,
	`delta` real DEFAULT 0 NOT NULL,
	`note` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`goal_id`) REFERENCES `goals`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `goal_progress_goal_date` ON `goal_progress` (`goal_id`,`date`);--> statement-breakpoint
CREATE TABLE `goals` (
	`id` text PRIMARY KEY NOT NULL,
	`period` text NOT NULL,
	`period_key` text NOT NULL,
	`parent_id` text,
	`title` text NOT NULL,
	`emoji` text,
	`color` text DEFAULT '#10b981' NOT NULL,
	`type` text NOT NULL,
	`target_value` real,
	`unit` text,
	`habit_id` text,
	`pomo_category_id` text,
	`pomo_metric` text,
	`status` text DEFAULT 'active' NOT NULL,
	`finalized_at` integer,
	`reflection_note` text,
	`reflection_rating` integer,
	`reflection_linked_date` text,
	`reflection_saved_at` integer,
	`position` integer DEFAULT 0 NOT NULL,
	`archived_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`parent_id`) REFERENCES `goals`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`habit_id`) REFERENCES `habits`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`pomo_category_id`) REFERENCES `pomodoro_categories`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `goals_period_key` ON `goals` (`period`,`period_key`);--> statement-breakpoint
CREATE INDEX `goals_parent` ON `goals` (`parent_id`);--> statement-breakpoint
CREATE INDEX `goals_status` ON `goals` (`status`);