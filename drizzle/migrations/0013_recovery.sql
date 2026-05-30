-- Phase 12 Part F: recovery infrastructure.
-- - `users.is_owner` flags the recovery-issuing owner (seeded `satwik`).
-- - `login_attempts.kind` partitions throttle counters between login + the two
--   recovery channels (doodle + owner code).
-- - `recovery_codes` stores hashed 6-digit codes issued by the owner with a
--   30-minute TTL; only the latest unused one per user is honored.

ALTER TABLE `users` ADD `is_owner` integer NOT NULL DEFAULT 0;--> statement-breakpoint
UPDATE `users` SET `is_owner` = 1 WHERE `id` = 'u_satwik_seed_001';--> statement-breakpoint

ALTER TABLE `login_attempts` ADD `kind` text NOT NULL DEFAULT 'login';--> statement-breakpoint

CREATE TABLE `recovery_codes` (
  `id` text PRIMARY KEY NOT NULL,
  `target_user_id` text NOT NULL,
  `code_hash` text NOT NULL,
  `issued_by_user_id` text NOT NULL,
  `created_at` integer DEFAULT (unixepoch()) NOT NULL,
  `expires_at` integer NOT NULL,
  `used_at` integer,
  FOREIGN KEY (`target_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`issued_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint
CREATE INDEX `recovery_codes_target_active` ON `recovery_codes` (`target_user_id`,`used_at`);
