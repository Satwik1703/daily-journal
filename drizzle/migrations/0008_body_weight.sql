-- Phase 9.2 — body weight log (optional daily entry for recomp tracking).
CREATE TABLE `body_weight_logs` (
  `id` text PRIMARY KEY NOT NULL,
  `date` text NOT NULL,
  `weight_kg` real NOT NULL,
  `note` text,
  `created_at` integer DEFAULT (unixepoch()) NOT NULL
);--> statement-breakpoint
CREATE INDEX `body_weight_logs_date` ON `body_weight_logs` (`date`);
