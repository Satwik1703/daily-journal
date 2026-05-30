-- Phase 12 Part G: owner-viewable passphrases.
-- - `users.passphrase_plain` stores the passphrase in plain text (joined by
--   a single space, ordered) so the owner can view it in Settings.
-- - Friend-app threat model: owner already controls the DB; this just
--   surfaces what was always recoverable from local-storage.
-- - Existing users (pre-Part G) get NULL here until their next reset; UI
--   shows "—" for them.

ALTER TABLE `users` ADD `passphrase_plain` text;
