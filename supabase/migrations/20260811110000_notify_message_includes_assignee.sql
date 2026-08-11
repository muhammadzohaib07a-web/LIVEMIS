-- Fixes a gap in notify_on_ticket_message: when the MIS Head (admin) sent a
-- chat reply or changed a ticket's status (which auto-posts a status-change
-- message), the old logic only notified the reporter — the assigned agent
-- never got a bell notification for the Head's own activity on their ticket.
--
-- New rule: notify everyone in the ticket's circle (reporter + assignee +
-- every admin) except whoever just acted. This also fixes status-change
-- notifications, since log_ticket_status_change reuses this same trigger.

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

  INSERT INTO public.notifications (user_id, title, body, link)
  SELECT DISTINCT recipients.uid,
    sender_name || ' replied on ' || target_ticket.ticket_no,
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
