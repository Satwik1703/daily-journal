-- Phase 9.1 — per-hand indicator for dumbbell / single-arm exercises.
ALTER TABLE `exercises` ADD `per_hand` integer DEFAULT false NOT NULL;
