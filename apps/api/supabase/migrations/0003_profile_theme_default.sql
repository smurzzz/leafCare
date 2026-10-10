-- Light is the shipped default theme (screen 22 still offers Light / System / Dark).
--
-- The app also defaults to Light locally, so a profile created before this
-- migration keeps whatever it stored: `system` on an existing row may be a
-- deliberate choice, and there is no way to tell it apart from the old default.
-- Rewriting it would silently flip someone's app back to Light.
--
-- New rows get `light`; a user who picks System or Dark has that value written on
-- PATCH /api/me and it is never overridden.

alter table profiles alter column theme set default 'light';
