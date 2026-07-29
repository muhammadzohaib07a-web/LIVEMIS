-- MIS-specific issue categories.
ALTER TYPE public.ticket_category ADD VALUE IF NOT EXISTS 'server';
ALTER TYPE public.ticket_category ADD VALUE IF NOT EXISTS 'backup';
ALTER TYPE public.ticket_category ADD VALUE IF NOT EXISTS 'cctv';
ALTER TYPE public.ticket_category ADD VALUE IF NOT EXISTS 'attendance';
ALTER TYPE public.ticket_category ADD VALUE IF NOT EXISTS 'odoo';

-- Enable live chat and live ticket/notification updates in Supabase Realtime.
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.ticket_messages;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END;
$$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.tickets;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END;
$$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END;
$$;
