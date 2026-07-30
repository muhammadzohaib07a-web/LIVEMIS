-- Chat attachments: let ticket_messages carry files (images + common documents),
-- reusing the existing private ticket-attachments bucket and its RLS policies.
ALTER TABLE public.ticket_messages
  ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]'::jsonb;

UPDATE storage.buckets
SET
  file_size_limit = 10485760, -- 10MB
  allowed_mime_types = ARRAY[
    'image/png', 'image/jpeg', 'image/webp', 'image/gif',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'application/zip'
  ]
WHERE id = 'ticket-attachments';

-- @mentions: role-based tags typed into the chat (@Everyone, @Admin, @Employee,
-- @Team) fan out to an extra "you were mentioned" notification, on top of the
-- normal reply notification below. Tags are inserted by the UI as literal text,
-- so a case-insensitive substring match is enough (no free-form user search).
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

  IF NEW.body ILIKE '%@everyone%' OR NEW.body ILIKE '%@team%' THEN
    INSERT INTO public.notifications (user_id, title, body, link)
    SELECT DISTINCT recipients.uid,
      'You were mentioned on ' || target_ticket.ticket_no,
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
      'You were mentioned on ' || target_ticket.ticket_no,
      left(NEW.body, 180),
      '/tickets/' || target_ticket.id
    FROM public.user_roles ur
    WHERE ur.role = 'admin' AND ur.user_id <> NEW.sender_id;
  END IF;

  IF NEW.body ILIKE '%@employee%' AND target_ticket.user_id <> NEW.sender_id THEN
    INSERT INTO public.notifications (user_id, title, body, link)
    VALUES (
      target_ticket.user_id,
      'You were mentioned on ' || target_ticket.ticket_no,
      left(NEW.body, 180),
      '/tickets/' || target_ticket.id
    );
  END IF;

  RETURN NEW;
END;
$$;
