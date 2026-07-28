-- Phase 17 · Timebox tab — 24h × 30min slot logging.

CREATE TABLE `timebox_categories` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL REFERENCES `users`(`id`) ON DELETE cascade,
  `name` text NOT NULL,
  `emoji` text,
  `color` text NOT NULL DEFAULT '#8b5cf6',
  `position` integer NOT NULL DEFAULT 0,
  `pomo_category_id` text REFERENCES `pomodoro_categories`(`id`) ON DELETE set null,
  `archived_at` integer,
  `created_at` integer NOT NULL DEFAULT (unixepoch())
);
--> statement-breakpoint
CREATE INDEX `timebox_categories_user` ON `timebox_categories` (`user_id`);
--> statement-breakpoint

CREATE TABLE `timebox_slots` (
  `user_id` text NOT NULL REFERENCES `users`(`id`) ON DELETE cascade,
  `date` text NOT NULL,
  `slot_index` integer NOT NULL,
  `category_id` text REFERENCES `timebox_categories`(`id`) ON DELETE set null,
  `label` text,
  `note` text,
  `source` text NOT NULL DEFAULT 'manual',
  `updated_at` integer NOT NULL DEFAULT (unixepoch()),
  `created_at` integer NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (`user_id`, `date`, `slot_index`)
);
--> statement-breakpoint
CREATE INDEX `timebox_slots_user_date` ON `timebox_slots` (`user_id`, `date`);
