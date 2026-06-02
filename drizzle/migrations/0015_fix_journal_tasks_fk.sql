-- Phase 13 · Fix malformed FK on `journal_tasks`.
--
-- Background:
-- `journal_tasks` was created back in 0000 with a foreign key
-- `date REFERENCES journal_entries(date)`, valid while `journal_entries`
-- had a single-column `date` primary key. Migration 0012 rebuilt
-- `journal_entries` to a composite PK `(user_id, date)`, so `date` alone is
-- no longer unique. That orphaned the `journal_tasks.date` FK: SQLite now
-- raises `foreign key mismatch - "journal_tasks" referencing "journal_entries"`
-- on EVERY write to the table (libSQL enforces foreign keys by default), which
-- surfaced as the "Sync failed: Failed query: insert into journal_tasks ..."
-- error in the UI.
--
-- schema.ts already declares no `date` FK, so the DB had simply drifted.
-- SQLite can't drop a FK in place, so this is the standard rename-and-copy
-- dance. We keep the valid `user_id` FK (cascade on user delete) and both
-- indexes, and drop only the malformed `date` FK.

PRAGMA foreign_keys = OFF;--> statement-breakpoint

CREATE TABLE `journal_tasks_new` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`date` text NOT NULL,
	`kind` text NOT NULL,
	`text` text NOT NULL,
	`done` integer DEFAULT false NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`moved_to_date` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint

INSERT INTO `journal_tasks_new` (
	`id`, `user_id`, `date`, `kind`, `text`, `done`, `position`, `moved_to_date`
)
SELECT
	`id`, `user_id`, `date`, `kind`, `text`, `done`, `position`, `moved_to_date`
FROM `journal_tasks`;--> statement-breakpoint

DROP TABLE `journal_tasks`;--> statement-breakpoint
ALTER TABLE `journal_tasks_new` RENAME TO `journal_tasks`;--> statement-breakpoint

CREATE INDEX `journal_tasks_date_kind` ON `journal_tasks` (`date`, `kind`);--> statement-breakpoint
CREATE INDEX `journal_tasks_user_date` ON `journal_tasks` (`user_id`, `date`);--> statement-breakpoint

PRAGMA foreign_keys = ON;
