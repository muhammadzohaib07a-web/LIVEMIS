-- Admin (MIS Head) previously only got notified about brand-new tickets and
-- employee feedback on *unassigned* tickets. Once a ticket had an agent, the
-- admin stopped hearing about it entirely — no notification on status
-- changes, replies, or assignments the admin didn't personally make. This
-- makes admin a notification recipient on every ticket event, in addition
-- to whoever already got notified, without double-notifying the same admin
-- twice for one event or notifying an admin about their own action.

CREATE OR REPLACE FUNCTION public.notify_employee_on_ticket_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  readable_status text;
  actor_name text;
  assignee_name text;
BEGIN
  readable_status := CASE NEW.status::text
    WHEN 'awaiting_feedback' THEN 'awaiting customer feedback'
    ELSE replace(NEW.status::text, '_', ' ')
  END;

  SELECT COALESCE(full_name, email) INTO actor_name
  FROM public.profiles WHERE id = auth.uid();

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF auth.uid() = NEW.user_id THEN
      IF NEW.assignee_id IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, title, body, link)
        VALUES (
          NEW.assignee_id,
          COALESCE(actor_name, 'Customer') || ' responded on ' || NEW.ticket_no,
          CASE
            WHEN NEW.status::text = 'closed' THEN 'Confirmed the issue is fixed'
            ELSE 'Requested more help'
          END,
          '/tickets/' || NEW.id
        );
        INSERT INTO public.notifications (user_id, title, body, link)
        SELECT DISTINCT
          ur.user_id,
          COALESCE(actor_name, 'Customer') || ' responded on ' || NEW.ticket_no,
          CASE
            WHEN NEW.status::text = 'closed' THEN 'Confirmed the issue is fixed'
            ELSE 'Requested more help'
          END,
          '/tickets/' || NEW.id
        FROM public.user_roles ur
        WHERE ur.role = 'admin' AND ur.user_id <> auth.uid();
      ELSE
        INSERT INTO public.notifications (user_id, title, body, link)
        SELECT DISTINCT
          ur.user_id,
          COALESCE(actor_name, 'Customer') || ' responded on ' || NEW.ticket_no,
          'Customer requested more help',
          '/tickets/' || NEW.id
        FROM public.user_roles ur
        WHERE ur.role = 'admin';
      END IF;
    ELSE
      INSERT INTO public.notifications (user_id, title, body, link)
      VALUES (
        NEW.user_id,
        COALESCE(actor_name, 'MIS') || ' updated ' || NEW.ticket_no,
        'Status changed to ' || readable_status,
        '/tickets/' || NEW.id
      );
      INSERT INTO public.notifications (user_id, title, body, link)
      SELECT DISTINCT
        ur.user_id,
        COALESCE(actor_name, 'MIS') || ' updated ' || NEW.ticket_no,
        'Status changed to ' || readable_status,
        '/tickets/' || NEW.id
      FROM public.user_roles ur
      WHERE ur.role = 'admin' AND ur.user_id <> auth.uid();
    END IF;
  END IF;

  IF NEW.assignee_id IS DISTINCT FROM OLD.assignee_id AND NEW.assignee_id IS NOT NULL THEN
    SELECT COALESCE(full_name, email, 'an MIS agent') INTO assignee_name
    FROM public.profiles WHERE id = NEW.assignee_id;

    INSERT INTO public.notifications (user_id, title, body, link)
    VALUES (
      NEW.assignee_id,
      COALESCE(actor_name, 'MIS Head') || ' assigned you ' || NEW.ticket_no,
      NEW.title,
      '/tickets/' || NEW.id
    );
    INSERT INTO public.notifications (user_id, title, body, link)
    SELECT DISTINCT
      ur.user_id,
      COALESCE(actor_name, 'MIS Head') || ' assigned ' || NEW.ticket_no,
      'Assigned to ' || assignee_name,
      '/tickets/' || NEW.id
    FROM public.user_roles ur
    WHERE ur.role = 'admin' AND ur.user_id <> auth.uid();
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
      WHERE ur.role IN ('agent', 'admin')
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
