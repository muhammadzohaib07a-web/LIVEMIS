-- Log an automatic chat message whenever a ticket's status changes, so the
-- change is visible in the conversation for every side (employee, agent, admin)
-- without any client needing to remember to post it. Reuses ticket_messages,
-- which already fans out to a notification via notify_on_ticket_message.

CREATE OR REPLACE FUNCTION public.ticket_status_label(s public.ticket_status)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE s
    WHEN 'open' THEN 'Open'
    WHEN 'in_progress' THEN 'In Progress'
    WHEN 'answered' THEN 'Answered'
    WHEN 'awaiting_feedback' THEN 'Awaiting Customer Feedback'
    WHEN 'resolved' THEN 'Closed'
    WHEN 'closed' THEN 'Closed'
    WHEN 'canceled' THEN 'Canceled'
  END;
$$;

CREATE OR REPLACE FUNCTION public.log_ticket_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor uuid;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    actor := COALESCE(auth.uid(), NEW.assignee_id, NEW.user_id);
    INSERT INTO public.ticket_messages (ticket_id, sender_id, body)
    VALUES (
      NEW.id,
      actor,
      '🔄 Status changed from ' || public.ticket_status_label(OLD.status)
        || ' to ' || public.ticket_status_label(NEW.status)
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS log_ticket_status_change ON public.tickets;
CREATE TRIGGER log_ticket_status_change
AFTER UPDATE ON public.tickets
FOR EACH ROW EXECUTE FUNCTION public.log_ticket_status_change();
