-- Three-level access model:
-- employee -> MIS Head (admin) -> assigned MIS Agent (agent)

-- Employees see their own tickets, the MIS Head sees everything,
-- and MIS agents see only tickets assigned to them.
DROP POLICY IF EXISTS "tickets_select_own_or_staff" ON public.tickets;
CREATE POLICY "tickets_select_by_hierarchy"
ON public.tickets
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
  OR (
    public.has_role(auth.uid(), 'agent')
    AND assignee_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "tickets_update_own_or_staff" ON public.tickets;
CREATE POLICY "tickets_update_by_hierarchy"
ON public.tickets
FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
  OR (
    public.has_role(auth.uid(), 'agent')
    AND assignee_id = auth.uid()
  )
)
WITH CHECK (
  user_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
  OR (
    public.has_role(auth.uid(), 'agent')
    AND assignee_id = auth.uid()
  )
);

-- Apply the same visibility to ticket chat.
DROP POLICY IF EXISTS "tm_select" ON public.ticket_messages;
CREATE POLICY "tm_select_by_hierarchy"
ON public.ticket_messages
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.tickets t
    WHERE t.id = ticket_id
      AND (
        t.user_id = auth.uid()
        OR public.has_role(auth.uid(), 'admin')
        OR (
          public.has_role(auth.uid(), 'agent')
          AND t.assignee_id = auth.uid()
        )
      )
  )
);

DROP POLICY IF EXISTS "tm_insert" ON public.ticket_messages;
CREATE POLICY "tm_insert_by_hierarchy"
ON public.ticket_messages
FOR INSERT
TO authenticated
WITH CHECK (
  sender_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.tickets t
    WHERE t.id = ticket_id
      AND (
        t.user_id = auth.uid()
        OR public.has_role(auth.uid(), 'admin')
        OR (
          public.has_role(auth.uid(), 'agent')
          AND t.assignee_id = auth.uid()
        )
      )
  )
);

-- The frontend uses this safe RPC so only the MIS Head can list assignable agents.
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
    count(t.id) FILTER (WHERE t.status IN ('open', 'in_progress')) AS assigned_count
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

REVOKE ALL ON FUNCTION public.list_mis_agents() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_mis_agents() TO authenticated;

-- New tickets alert the MIS Head, not every agent.
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
    'New ticket ' || NEW.ticket_no || ' needs assignment',
    NEW.title,
    '/tickets/' || NEW.id
  FROM public.user_roles ur
  WHERE ur.role = 'admin'
    AND ur.user_id <> NEW.user_id;

  RETURN NEW;
END;
$$;

-- Employee replies go to the assigned agent. Until assignment, they go to the Head.
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
