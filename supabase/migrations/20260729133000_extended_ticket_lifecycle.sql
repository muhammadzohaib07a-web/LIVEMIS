-- Extended support lifecycle:
-- Open -> In Progress -> Answered -> Awaiting Customer Feedback -> Closed
-- Canceled is a separate terminal state.

ALTER TYPE public.ticket_status ADD VALUE IF NOT EXISTS 'answered';
ALTER TYPE public.ticket_status ADD VALUE IF NOT EXISTS 'awaiting_feedback';
ALTER TYPE public.ticket_status ADD VALUE IF NOT EXISTS 'canceled';

ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS parent_ticket_id uuid
    REFERENCES public.tickets(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS follow_up_reason text;

CREATE INDEX IF NOT EXISTS tickets_parent_ticket_id_idx
  ON public.tickets(parent_ticket_id);

-- Resolved was previously displayed as Closed. Keep the enum value for compatibility,
-- but normalize existing data into the new explicit terminal state.
UPDATE public.tickets
SET status = 'closed'
WHERE status = 'resolved';

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
    AND new_status IN ('closed', 'in_progress');
  mis_transition_allowed boolean :=
    (old_status = 'open' AND new_status IN ('in_progress', 'canceled'))
    OR (old_status = 'in_progress' AND new_status IN ('answered', 'canceled'))
    OR (old_status = 'answered' AND new_status IN ('awaiting_feedback', 'in_progress', 'canceled'))
    OR (old_status = 'awaiting_feedback' AND new_status IN ('closed', 'in_progress', 'canceled'))
    OR (old_status = 'resolved' AND new_status = 'closed');
BEGIN
  IF auth.uid() = OLD.user_id AND NOT public.is_mis_staff(auth.uid()) THEN
    IF NEW.assignee_id IS DISTINCT FROM OLD.assignee_id
       OR NEW.user_id IS DISTINCT FROM OLD.user_id
       OR NEW.parent_ticket_id IS DISTINCT FROM OLD.parent_ticket_id THEN
      RAISE EXCEPTION 'Employees cannot change ticket ownership or assignment';
    END IF;

    IF NEW.status IS DISTINCT FROM OLD.status AND NOT employee_feedback_transition THEN
      RAISE EXCEPTION 'Customer can only close or request more help while feedback is awaited';
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
    CASE
      WHEN NEW.parent_ticket_id IS NOT NULL
        THEN 'Follow-up ' || NEW.ticket_no || ' needs assignment'
      ELSE 'New ticket ' || NEW.ticket_no || ' needs assignment'
    END,
    COALESCE(NEW.follow_up_reason, NEW.title),
    '/tickets/' || NEW.id
  FROM public.user_roles ur
  WHERE ur.role = 'admin'
    AND ur.user_id <> NEW.user_id;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_employee_on_ticket_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  readable_status text;
BEGIN
  readable_status := CASE NEW.status::text
    WHEN 'awaiting_feedback' THEN 'awaiting customer feedback'
    ELSE replace(NEW.status::text, '_', ' ')
  END;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF auth.uid() = NEW.user_id THEN
      IF NEW.assignee_id IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, title, body, link)
        VALUES (
          NEW.assignee_id,
          'Customer feedback on ' || NEW.ticket_no,
          CASE
            WHEN NEW.status::text = 'closed' THEN 'Customer confirmed the issue is fixed'
            ELSE 'Customer requested more help'
          END,
          '/tickets/' || NEW.id
        );
      ELSE
        INSERT INTO public.notifications (user_id, title, body, link)
        SELECT DISTINCT
          ur.user_id,
          'Customer feedback on ' || NEW.ticket_no,
          'Customer requested more help',
          '/tickets/' || NEW.id
        FROM public.user_roles ur
        WHERE ur.role = 'admin';
      END IF;
    ELSE
      INSERT INTO public.notifications (user_id, title, body, link)
      VALUES (
        NEW.user_id,
        'Ticket ' || NEW.ticket_no || ' updated',
        'MIS changed status to ' || readable_status,
        '/tickets/' || NEW.id
      );
    END IF;
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

CREATE OR REPLACE FUNCTION public.list_mis_agents()
RETURNS TABLE (
  id uuid,
  full_name text,
  email text,
  assigned_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only the MIS Head can list MIS agents';
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.full_name,
    p.email,
    count(t.id) FILTER (
      WHERE t.status::text IN ('open', 'in_progress', 'answered', 'awaiting_feedback')
    ) AS assigned_count
  FROM public.profiles p
  INNER JOIN public.user_roles ur
    ON ur.user_id = p.id
   AND ur.role = 'agent'
  LEFT JOIN public.tickets t
    ON t.assignee_id = p.id
  GROUP BY p.id, p.full_name, p.email
  ORDER BY assigned_count, p.full_name NULLS LAST, p.email;
END;
$$;
