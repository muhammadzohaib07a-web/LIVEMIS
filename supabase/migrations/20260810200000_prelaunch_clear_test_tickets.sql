-- One-time pre-launch cleanup: wipe all test ticket history so the system
-- starts clean for real production use.
--
-- Deletes: tickets, their chat messages (cascades automatically), all
--          notifications, and any uploaded ticket screenshots/attachments.
-- Does NOT touch: profiles, user_roles, auth.users (so every Head/Agent/
--          Employee login stays exactly as-is), departments, issue
--          categories, or knowledge base articles.
--
-- THIS IS IRREVERSIBLE. Double-check this is really what you want, then run.

DELETE FROM public.notifications;
DELETE FROM public.tickets;              -- ticket_messages cascade-delete with their ticket
DELETE FROM storage.objects WHERE bucket_id = 'ticket-attachments';
