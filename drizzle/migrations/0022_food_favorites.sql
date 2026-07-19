-- Phase 16 · deferred item — per-user food favorites join table.
-- Lets users favorite global seed rows (which have user_id NULL and
-- therefore can't carry a per-user is_favorite flag on the row itself).

CREATE TABLE `food_favorites` (
  `user_id` text NOT NULL REFERENCES `users`(`id`) ON DELETE cascade,
  `food_id` text NOT NULL REFERENCES `foods`(`id`) ON DELETE cascade,
  `created_at` integer NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (`user_id`, `food_id`)
);
--> statement-breakpoint
CREATE INDEX `food_favorites_food` ON `food_favorites` (`food_id`);
