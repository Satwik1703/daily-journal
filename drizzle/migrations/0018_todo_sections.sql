-- Phase 14 Part 3 · Sections within a list. Additive only. Folders reuse the
-- existing todo_lists.kind/parent_id columns — no schema change needed for them.

CREATE TABLE `todo_sections` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`list_id` text NOT NULL,
	`name` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`list_id`) REFERENCES `todo_lists`(`id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint
CREATE INDEX `todo_sections_list` ON `todo_sections` (`list_id`);
