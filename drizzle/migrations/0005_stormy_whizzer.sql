ALTER TABLE `goals` ADD `pinned` integer DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX `goals_pinned` ON `goals` (`pinned`);