-- Phase 12 Part A: auth foundation — users / sessions / login_attempts tables.
-- No data scoping yet (Part B adds userId columns to every existing table).
-- Auto-seeds the original owner as user `satwik` with a NULL passhash; their
-- first /auth/login captures the passphrase + honeypot + tile style.

CREATE TABLE `users` (
  `id` text PRIMARY KEY NOT NULL,
  `name` text NOT NULL,
  `name_lower` text NOT NULL,
  `passhash` text,
  `salt` text,
  `honeypot_emoji` text,
  `tile_gradient_from` text DEFAULT '#4fa896' NOT NULL,
  `tile_gradient_to` text DEFAULT '#7fc7b9' NOT NULL,
  `tile_font` text DEFAULT 'lora' NOT NULL,
  `tile_border` text DEFAULT 'rounded' NOT NULL,
  `recovery_strokes_json` text,
  `created_at` integer DEFAULT (unixepoch()) NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX `users_name_lower_unique` ON `users` (`name_lower`);--> statement-breakpoint

CREATE TABLE `sessions` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `device_nickname` text,
  `created_at` integer DEFAULT (unixepoch()) NOT NULL,
  `last_seen_at` integer DEFAULT (unixepoch()) NOT NULL,
  `expires_at` integer NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint
CREATE INDEX `sessions_user` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `sessions_expires_at` ON `sessions` (`expires_at`);--> statement-breakpoint

CREATE TABLE `login_attempts` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `succeeded` integer NOT NULL,
  `attempted_at` integer DEFAULT (unixepoch()) NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint
CREATE INDEX `login_attempts_user_attempted` ON `login_attempts` (`user_id`,`attempted_at`);--> statement-breakpoint

-- Auto-seed the original owner. NULL passhash => first login sets passphrase + honeypot.
INSERT INTO `users` (`id`, `name`, `name_lower`)
VALUES ('u_satwik_seed_001', 'satwik', 'satwik');
