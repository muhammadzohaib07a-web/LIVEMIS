-- Fixes notifications leaking to every agent when they should only go to
-- the MIS Head (admin):
-- 1) notify_mis_on_new_ticket previously notified agent+admin on every new
--    ticket; now admin only.
-- 2) notify_on_ticket_message's "unassigned ticket" branch previously
--    broadcast to every agent+admin; now admin only, matching the rule
--    that unassigned/unrouted activity is the Head's job to triage, not
--    something every agent should see.
-- Safe to run even if an earlier notification migration already applied —
-- CREATE OR REPLACE just overwrites with this final version.

CREATE OR REPLACE FUNCTION public.notify_mis_on_new_ticket()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  reporter_name text;
BEGIN
  SELECT COALESCE(full_name, email, 'An employee') INTO reporter_name
  FROM public.profiles WHERE id = NEW.user_id;

  INSERT INTO public.notifications (user_id, title, body, link)
  SELECT DISTINCT
    ur.user_id,
    CASE
      WHEN NEW.parent_ticket_id IS NOT NULL
        THEN 'Follow-up ' || NEW.ticket_no || ' from ' || reporter_name
      ELSE 'New ticket ' || NEW.ticket_no || ' from ' || reporter_name
    END,
    COALESCE(NEW.follow_up_reason, NEW.title),
    '/tickets/' || NEW.id
  FROM public.user_roles ur
  WHERE ur.role = 'admin'
    AND ur.user_id <> NEW.user_id;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_on_ticket_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_ticket public.tickets%ROWTYPE;
  sender_name text;
BEGIN
  SELECT * INTO target_ticket
  FROM public.tickets
  WHERE id = NEW.ticket_id;

  SELECT COALESCE(full_name, email, 'Someone') INTO sender_name
  FROM public.profiles WHERE id = NEW.sender_id;

  IF NEW.sender_id = target_ticket.user_id THEN
    IF target_ticket.assignee_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, title, body, link)
      VALUES (
        target_ticket.assignee_id,
        sender_name || ' replied on ' || target_ticket.ticket_no,
        left(NEW.body, 180),
        '/tickets/' || target_ticket.id
      );
      INSERT INTO public.notifications (user_id, title, body, link)
      SELECT DISTINCT
        ur.user_id,
        sender_name || ' replied on ' || target_ticket.ticket_no,
        left(NEW.body, 180),
        '/tickets/' || target_ticket.id
      FROM public.user_roles ur
      WHERE ur.role = 'admin' AND ur.user_id <> NEW.sender_id;
    ELSE
      INSERT INTO public.notifications (user_id, title, body, link)
      SELECT DISTINCT
        ur.user_id,
        sender_name || ' replied on ' || target_ticket.ticket_no,
        left(NEW.body, 180),
        '/tickets/' || target_ticket.id
      FROM public.user_roles ur
      WHERE ur.role = 'admin'
        AND ur.user_id <> NEW.sender_id;
    END IF;
  ELSE
    INSERT INTO public.notifications (user_id, title, body, link)
    VALUES (
      target_ticket.user_id,
      sender_name || ' replied on ' || target_ticket.ticket_no,
      left(NEW.body, 180),
      '/tickets/' || target_ticket.id
    );
    INSERT INTO public.notifications (user_id, title, body, link)
    SELECT DISTINCT
      ur.user_id,
      sender_name || ' replied on ' || target_ticket.ticket_no,
      left(NEW.body, 180),
      '/tickets/' || target_ticket.id
    FROM public.user_roles ur
    WHERE ur.role = 'admin' AND ur.user_id <> NEW.sender_id;
  END IF;

  IF NEW.body ILIKE '%@everyone%' OR NEW.body ILIKE '%@team%' THEN
    INSERT INTO public.notifications (user_id, title, body, link)
    SELECT DISTINCT recipients.uid,
      sender_name || ' mentioned you on ' || target_ticket.ticket_no,
      left(NEW.body, 180),
      '/tickets/' || target_ticket.id
    FROM (
      SELECT target_ticket.user_id AS uid
      UNION
      SELECT target_ticket.assignee_id WHERE target_ticket.assignee_id IS NOT NULL
      UNION
      SELECT ur.user_id FROM public.user_roles ur WHERE ur.role = 'admin'
    ) recipients
    WHERE recipients.uid <> NEW.sender_id;
  END IF;

  IF NEW.body ILIKE '%@admin%' THEN
    INSERT INTO public.notifications (user_id, title, body, link)
    SELECT DISTINCT ur.user_id,
      sender_name || ' mentioned you on ' || target_ticket.ticket_no,
      left(NEW.body, 180),
      '/tickets/' || target_ticket.id
    FROM public.user_roles ur
    WHERE ur.role = 'admin' AND ur.user_id <> NEW.sender_id;
  END IF;

  IF NEW.body ILIKE '%@employee%' AND target_ticket.user_id <> NEW.sender_id THEN
    INSERT INTO public.notifications (user_id, title, body, link)
    VALUES (
      target_ticket.user_id,
      sender_name || ' mentioned you on ' || target_ticket.ticket_no,
      left(NEW.body, 180),
      '/tickets/' || target_ticket.id
    );
  END IF;

  RETURN NEW;
END;
$$;
