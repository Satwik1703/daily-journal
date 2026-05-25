-- Phase 11.1: difficulty multiplier on habits, moved_to_date trace pointer,
-- books table + book_id link from habit_value_logs.

ALTER TABLE `habits` ADD `difficulty` real DEFAULT 1 NOT NULL;--> statement-breakpoint

ALTER TABLE `journal_tasks` ADD `moved_to_date` text;--> statement-breakpoint

CREATE TABLE `books` (
  `id` text PRIMARY KEY NOT NULL,
  `title` text NOT NULL,
  `author` text,
  `total_pages` integer,
  `started_at` text,
  `finished_at` text,
  `rating` integer,
  `notes` text,
  `status` text DEFAULT 'reading' NOT NULL,
  `color` text DEFAULT '#a89b6a' NOT NULL,
  `position` integer DEFAULT 0 NOT NULL,
  `created_at` integer DEFAULT (unixepoch()) NOT NULL
);--> statement-breakpoint
CREATE INDEX `books_status` ON `books` (`status`);--> statement-breakpoint

ALTER TABLE `habit_value_logs` ADD `book_id` text REFERENCES `books`(`id`) ON DELETE SET NULL;--> statement-breakpoint
CREATE INDEX `habit_value_logs_book` ON `habit_value_logs` (`book_id`);
