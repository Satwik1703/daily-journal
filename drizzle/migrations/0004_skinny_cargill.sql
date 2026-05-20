CREATE TABLE `habit_value_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`habit_id` text NOT NULL,
	`date` text NOT NULL,
	`value` real NOT NULL,
	`note` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`habit_id`) REFERENCES `habits`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `habit_value_logs_habit_date` ON `habit_value_logs` (`habit_id`,`date`);--> statement-breakpoint
ALTER TABLE `habits` ADD `tracking_kind` text DEFAULT 'binary' NOT NULL;--> statement-breakpoint
ALTER TABLE `habits` ADD `daily_target` real;--> statement-breakpoint
ALTER TABLE `habits` ADD `unit` text;--> statement-breakpoint
ALTER TABLE `habits` ADD `pomo_category_id` text REFERENCES pomodoro_categories(id);