-- Phase 13 · Todo tab (TickTick-style) — core tables.
--
-- `todo_lists`: lists + folders (kind). Folders group lists via parent_id.
-- `todos`: tasks. list_id null = Inbox; parent_id self-FK = subtask. repeat_json
-- + section_id columns are reserved for later phases (nullable now to avoid a
-- future table rebuild). position is REAL for insert-between reordering.
-- Additive only — no existing table touched.

CREATE TABLE `todo_lists` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`emoji` text,
	`color` text DEFAULT '#3b82f6' NOT NULL,
	`kind` text DEFAULT 'list' NOT NULL,
	`parent_id` text,
	`view_mode` text DEFAULT 'list' NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`archived_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint
CREATE INDEX `todo_lists_user` ON `todo_lists` (`user_id`);--> statement-breakpoint

CREATE TABLE `todos` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`list_id` text,
	`parent_id` text,
	`section_id` text,
	`title` text NOT NULL,
	`note` text,
	`priority` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`completed_at` integer,
	`due_date` text,
	`due_time` text,
	`is_all_day` integer DEFAULT true NOT NULL,
	`repeat_json` text,
	`pinned` integer DEFAULT false NOT NULL,
	`position` real DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`list_id`) REFERENCES `todo_lists`(`id`) ON UPDATE no action ON DELETE set null
);--> statement-breakpoint
CREATE INDEX `todos_user_status` ON `todos` (`user_id`,`status`);--> statement-breakpoint
CREATE INDEX `todos_user_list` ON `todos` (`user_id`,`list_id`);--> statement-breakpoint
CREATE INDEX `todos_user_due` ON `todos` (`user_id`,`due_date`);--> statement-breakpoint
CREATE INDEX `todos_parent` ON `todos` (`parent_id`);
