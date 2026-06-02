-- Phase 14 Part 2 · Todo tags. Many-to-many with todos. Additive only.

CREATE TABLE `todo_tags` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`name_lower` text NOT NULL,
	`color` text DEFAULT '#64748b' NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint
CREATE INDEX `todo_tags_user` ON `todo_tags` (`user_id`,`name_lower`);--> statement-breakpoint

CREATE TABLE `todo_tag_links` (
	`user_id` text NOT NULL,
	`todo_id` text NOT NULL,
	`tag_id` text NOT NULL,
	PRIMARY KEY(`todo_id`, `tag_id`),
	FOREIGN KEY (`todo_id`) REFERENCES `todos`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `todo_tags`(`id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint
CREATE INDEX `todo_tag_links_tag` ON `todo_tag_links` (`tag_id`);--> statement-breakpoint
CREATE INDEX `todo_tag_links_user` ON `todo_tag_links` (`user_id`);
