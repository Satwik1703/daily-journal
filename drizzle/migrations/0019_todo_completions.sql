-- Phase 14 Part 4 · Recurrence completion log. Additive only. One row per
-- completed occurrence of a recurring todo.

CREATE TABLE `todo_completions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`todo_id` text NOT NULL,
	`completed_date` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`todo_id`) REFERENCES `todos`(`id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint
CREATE INDEX `todo_completions_todo` ON `todo_completions` (`todo_id`);
