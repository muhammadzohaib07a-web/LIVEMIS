-- Central textile-mill helpdesk workflow:
-- Accounts, Inventory, Quality, Production and Warehouse submit to one MIS queue.

CREATE OR REPLACE FUNCTION public.is_mis_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'admin')
      OR public.has_role(_user_id, 'agent');
$$;

GRANT EXECUTE ON FUNCTION public.is_mis_staff(uuid) TO authenticated;

-- Employees may update their ticket text, but MIS-only workflow fields are protected.
CREATE OR REPLACE FUNCTION public.protect_ticket_workflow_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() = OLD.user_id AND NOT public.is_mis_staff(auth.uid()) THEN
    IF NEW.status IS DISTINCT FROM OLD.status
       OR NEW.assignee_id IS DISTINCT FROM OLD.assignee_id
       OR NEW.user_id IS DISTINCT FROM OLD.user_id THEN
      RAISE EXCEPTION 'Only MIS staff can assign tickets or change ticket status';
    END IF;
  END IF;

  IF NEW.assignee_id IS NOT NULL AND NOT public.is_mis_staff(NEW.assignee_id) THEN
    RAISE EXCEPTION 'Ticket assignee must be an MIS agent or administrator';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_ticket_workflow_fields ON public.tickets;
CREATE TRIGGER protect_ticket_workflow_fields
BEFORE UPDATE ON public.tickets
FOR EACH ROW EXECUTE FUNCTION public.protect_ticket_workflow_fields();

-- A new employee ticket appears in every MIS staff member's notification inbox.
CREATE OR REPLACE FUNCTION public.notify_mis_on_new_ticket()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, title, body, link)
  SELECT DISTINCT
    ur.user_id,
    'New ticket ' || NEW.ticket_no,
    NEW.title,
    '/tickets/' || NEW.id
  FROM public.user_roles ur
  WHERE ur.role IN ('agent', 'admin')
    AND ur.user_id <> NEW.user_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_mis_on_new_ticket ON public.tickets;
CREATE TRIGGER notify_mis_on_new_ticket
AFTER INSERT ON public.tickets
FOR EACH ROW EXECUTE FUNCTION public.notify_mis_on_new_ticket();

-- Status changes are pushed back to the employee.
CREATE OR REPLACE FUNCTION public.notify_employee_on_ticket_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.notifications (user_id, title, body, link)
    VALUES (
      NEW.user_id,
      'Ticket ' || NEW.ticket_no || ' updated',
      'MIS changed status to ' || replace(NEW.status::text, '_', ' '),
      '/tickets/' || NEW.id
    );
  END IF;

  IF NEW.assignee_id IS DISTINCT FROM OLD.assignee_id AND NEW.assignee_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, body, link)
    VALUES (
      NEW.assignee_id,
      'Ticket ' || NEW.ticket_no || ' assigned to you',
      NEW.title,
      '/tickets/' || NEW.id
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_employee_on_ticket_update ON public.tickets;
CREATE TRIGGER notify_employee_on_ticket_update
AFTER UPDATE ON public.tickets
FOR EACH ROW EXECUTE FUNCTION public.notify_employee_on_ticket_update();

-- Chat notification goes to the other side of the conversation.
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
        'New employee reply on ' || target_ticket.ticket_no,
        left(NEW.body, 180),
        '/tickets/' || target_ticket.id
      FROM public.user_roles ur
      WHERE ur.role IN ('agent', 'admin')
        AND ur.user_id <> NEW.sender_id;
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

DROP TRIGGER IF EXISTS notify_on_ticket_message ON public.ticket_messages;
CREATE TRIGGER notify_on_ticket_message
AFTER INSERT ON public.ticket_messages
FOR EACH ROW EXECUTE FUNCTION public.notify_on_ticket_message();
