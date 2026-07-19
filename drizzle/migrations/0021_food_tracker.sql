-- Phase 16 — Calorie Tracker tab (HealthifyMe-lite, no AI)
-- All tables are per-user via user_id (Phase 12 data-wall pattern).
-- `foods` allows user_id NULL for global seed rows shared across all users.

CREATE TABLE `foods` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text REFERENCES `users`(`id`) ON DELETE cascade,
  `name` text NOT NULL,
  `brand` text,
  `category` text,
  `serving_unit` text NOT NULL,
  `serving_size` real NOT NULL,
  `kcal` real NOT NULL,
  `protein_g` real NOT NULL DEFAULT 0,
  `carbs_g` real NOT NULL DEFAULT 0,
  `fat_g` real NOT NULL DEFAULT 0,
  `fiber_g` real,
  `sugar_g` real,
  `sodium_mg` real,
  `source` text NOT NULL DEFAULT 'seed',
  `off_barcode` text,
  `is_favorite` integer NOT NULL DEFAULT 0,
  `archived_at` integer,
  `created_at` integer NOT NULL DEFAULT (unixepoch())
);
--> statement-breakpoint
CREATE INDEX `foods_user_name` ON `foods` (`user_id`, `name`);
--> statement-breakpoint
CREATE INDEX `foods_source` ON `foods` (`source`);
--> statement-breakpoint

CREATE TABLE `food_logs` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL REFERENCES `users`(`id`) ON DELETE cascade,
  `date` text NOT NULL,
  `meal_type` text NOT NULL,
  `food_id` text REFERENCES `foods`(`id`) ON DELETE set null,
  `food_name` text NOT NULL,
  `quantity` real NOT NULL DEFAULT 1,
  `kcal` real NOT NULL,
  `protein_g` real NOT NULL DEFAULT 0,
  `carbs_g` real NOT NULL DEFAULT 0,
  `fat_g` real NOT NULL DEFAULT 0,
  `note` text,
  `logged_at` integer NOT NULL DEFAULT (unixepoch()),
  `created_at` integer NOT NULL DEFAULT (unixepoch())
);
--> statement-breakpoint
CREATE INDEX `food_logs_user_date` ON `food_logs` (`user_id`, `date`);
--> statement-breakpoint

CREATE TABLE `water_logs` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL REFERENCES `users`(`id`) ON DELETE cascade,
  `date` text NOT NULL,
  `amount_ml` real NOT NULL,
  `logged_at` integer NOT NULL DEFAULT (unixepoch()),
  `created_at` integer NOT NULL DEFAULT (unixepoch())
);
--> statement-breakpoint
CREATE INDEX `water_logs_user_date` ON `water_logs` (`user_id`, `date`);
--> statement-breakpoint

CREATE TABLE `nutrition_profile` (
  `user_id` text PRIMARY KEY NOT NULL REFERENCES `users`(`id`) ON DELETE cascade,
  `height_cm` real,
  `age` integer,
  `sex` text,
  `activity_level` text NOT NULL DEFAULT 'moderate',
  `goal` text NOT NULL DEFAULT 'maintain',
  `rate_kg_per_week` real,
  `target_weight_kg` real,
  `target_date` text,
  `daily_kcal_target` real,
  `protein_target_g` real,
  `carbs_target_g` real,
  `fat_target_g` real,
  `water_target_ml` real NOT NULL DEFAULT 2500,
  `meal_categories_json` text NOT NULL DEFAULT '["Breakfast","Lunch","Snacks","Dinner"]',
  `updated_at` integer NOT NULL DEFAULT (unixepoch())
);
--> statement-breakpoint

CREATE TABLE `food_recipes` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL REFERENCES `users`(`id`) ON DELETE cascade,
  `name` text NOT NULL,
  `emoji` text,
  `servings` real NOT NULL DEFAULT 1,
  `total_kcal` real NOT NULL DEFAULT 0,
  `total_protein_g` real NOT NULL DEFAULT 0,
  `total_carbs_g` real NOT NULL DEFAULT 0,
  `total_fat_g` real NOT NULL DEFAULT 0,
  `archived_at` integer,
  `created_at` integer NOT NULL DEFAULT (unixepoch())
);
--> statement-breakpoint
CREATE INDEX `food_recipes_user` ON `food_recipes` (`user_id`);
--> statement-breakpoint

CREATE TABLE `food_recipe_items` (
  `id` text PRIMARY KEY NOT NULL,
  `recipe_id` text NOT NULL REFERENCES `food_recipes`(`id`) ON DELETE cascade,
  `food_id` text NOT NULL REFERENCES `foods`(`id`) ON DELETE cascade,
  `quantity` real NOT NULL DEFAULT 1,
  `unit` text
);
--> statement-breakpoint
CREATE INDEX `food_recipe_items_recipe` ON `food_recipe_items` (`recipe_id`);
