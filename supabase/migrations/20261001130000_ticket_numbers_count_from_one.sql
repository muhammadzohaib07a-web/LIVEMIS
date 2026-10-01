-- Ticket numbers become a running count instead of a random six-digit number.
--
-- Before: T-390271, T-100238 — random, so nothing could be read from them.
-- After:  T-0001, T-0002, T-0003 ...
--
-- Nothing in the app sets ticket_no; every real insert takes the column
-- default, so changing the default is the whole change. (The T-xxxxxx strings
-- in the route files are preview-mode demo data and never reach Postgres.)
--
-- Tickets that already exist keep the number they were given. Renumbering them
-- would break the paper trail: ticket_no is written into the text of every
-- notification and every "New ticket T-xxxxxx" email already sent, and those
-- would then point at numbers that no longer mean anything.
--
-- Past 9999 the number simply gets longer — T-10000 — and stays unique.

CREATE SEQUENCE IF NOT EXISTS public.ticket_no_seq AS bigint START WITH 1;

-- The sequence is read by whoever inserts the ticket, which is the signed-in
-- employee — without this grant every new ticket fails on permission denied.
GRANT USAGE, SELECT ON SEQUENCE public.ticket_no_seq TO authenticated;
GRANT ALL ON SEQUENCE public.ticket_no_seq TO service_role;

ALTER TABLE public.tickets
  ALTER COLUMN ticket_no
  SET DEFAULT ('T-' || lpad(nextval('public.ticket_no_seq')::text, 4, '0'));

-- If the tickets table is ever emptied and the count should begin at 1 again,
-- run this on its own afterwards:
--
--   ALTER SEQUENCE public.ticket_no_seq RESTART WITH 1;

-- Check it landed: the default should read nextval('ticket_no_seq'...).
SELECT column_name, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'tickets' AND column_name = 'ticket_no';
