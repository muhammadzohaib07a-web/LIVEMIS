-- One-time pre-launch cleanup: wipe all test ticket history so the system
-- starts clean for real production use.
--
-- Deletes: tickets, their chat messages (cascades automatically), and all
--          notifications.
-- Does NOT touch: profiles, user_roles, auth.users (so every Head/Agent/
--          Employee login stays exactly as-is), departments, issue
--          categories, or knowledge base articles.
--
-- Uploaded ticket screenshots/attachments live in Storage, not a regular
-- table — Supabase blocks direct SQL DELETE on storage.objects (a
-- protect_delete() trigger), so clear the "ticket-attachments" bucket
-- separately from Dashboard > Storage (see project notes / chat).
--
-- THIS IS IRREVERSIBLE. Double-check this is really what you want, then run.
-- Safe to re-run: if a table's already empty, these are simply no-ops.

DELETE FROM public.notifications;
DELETE FROM public.tickets;              -- ticket_messages cascade-delete with their ticket
