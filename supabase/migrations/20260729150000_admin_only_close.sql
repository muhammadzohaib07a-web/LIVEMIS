-- Only the MIS Head/Admin may place a ticket in the final Closed state.
-- Employees can confirm the fix through chat or request more help.

CREATE OR REPLACE FUNCTION public.protect_ticket_workflow_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  old_status text := OLD.status::text;
  new_status text := NEW.status::text;
  employee_feedback_transition boolean :=
    old_status = 'awaiting_feedback'
    AND new_status = 'in_progress';
  mis_transition_allowed boolean :=
    (old_status = 'open' AND new_status IN ('in_progress', 'canceled'))
    OR (old_status = 'in_progress' AND new_status IN ('answered', 'canceled'))
    OR (old_status = 'answered' AND new_status IN ('awaiting_feedback', 'in_progress', 'canceled'))
    OR (old_status = 'awaiting_feedback' AND new_status IN ('closed', 'in_progress', 'canceled'))
    OR (old_status = 'resolved' AND new_status = 'closed');
BEGIN
  IF auth.uid() IS NOT NULL
     AND NEW.status IS DISTINCT FROM OLD.status
     AND new_status = 'closed'
     AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only the MIS Head/Admin can close a ticket';
  END IF;

  IF auth.uid() = OLD.user_id AND NOT public.is_mis_staff(auth.uid()) THEN
    IF NEW.assignee_id IS DISTINCT FROM OLD.assignee_id
       OR NEW.user_id IS DISTINCT FROM OLD.user_id
       OR NEW.parent_ticket_id IS DISTINCT FROM OLD.parent_ticket_id THEN
      RAISE EXCEPTION 'Employees cannot change ticket ownership or assignment';
    END IF;

    IF NEW.status IS DISTINCT FROM OLD.status AND NOT employee_feedback_transition THEN
      RAISE EXCEPTION 'Customer can only request more help while feedback is awaited';
    END IF;
  ELSIF public.is_mis_staff(auth.uid())
        AND NEW.status IS DISTINCT FROM OLD.status
        AND NOT mis_transition_allowed THEN
    RAISE EXCEPTION 'Invalid ticket status transition: % to %', old_status, new_status;
  END IF;

  IF NEW.assignee_id IS NOT NULL AND NOT public.is_mis_staff(NEW.assignee_id) THEN
    RAISE EXCEPTION 'Ticket assignee must be an MIS agent or administrator';
  END IF;

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
BEGIN
  SELECT * INTO target_ticket
  FROM public.tickets
  WHERE id = NEW.ticket_id;

  IF NEW.sender_id = target_ticket.user_id THEN
    IF target_ticket.assignee_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, title, body, link)
      VALUES (
        target_ticket.assignee_id,
        'New employee reply on ' || target_ticket.ticket_no,
        left(NEW.body, 180),
        '/tickets/' || target_ticket.id
      );
    ELSE
      INSERT INTO public.notifications (user_id, title, body, link)
      SELECT DISTINCT
        ur.user_id,
        'Unassigned ticket reply on ' || target_ticket.ticket_no,
        left(NEW.body, 180),
        '/tickets/' || target_ticket.id
      FROM public.user_roles ur
      WHERE ur.role = 'admin';
    END IF;

    -- While customer feedback is awaited, the MIS Head must see the reply
    -- because only the Head can perform the final close.
    IF target_ticket.status::text = 'awaiting_feedback'
       AND target_ticket.assignee_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, title, body, link)
      SELECT DISTINCT
        ur.user_id,
        'Customer feedback on ' || target_ticket.ticket_no,
        left(NEW.body, 180),
        '/tickets/' || target_ticket.id
      FROM public.user_roles ur
      WHERE ur.role = 'admin'
        AND ur.user_id <> target_ticket.assignee_id;
    END IF;
  ELSE
    INSERT INTO public.notifications (user_id, title, body, link)
    VALUES (
      target_ticket.user_id,
      'New MIS reply on ' || target_ticket.ticket_no,
      left(NEW.body, 180),
      '/tickets/' || target_ticket.id
    );
  END IF;

  RETURN NEW;
END;
$$;
