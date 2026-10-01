-- Drops the customer-confirmation step and lets an agent close their own work.
--
-- Before: Open -> In Progress -> Answered -> Awaiting Customer Feedback -> Closed
--         with the employee confirming, and only the MIS Head closing.
-- After:  Open -> In Progress -> Answered -> Closed
--         Canceled stays terminal and stays with the MIS Head.
--
-- Who may move what:
--   agent, on a ticket assigned to them  - In Progress, Answered, Closed
--   agent, on any other ticket           - nothing; read and reply only
--   MIS Head                             - everything, including Cancel
--   employee                             - nothing (the one exception they had
--                                          was the feedback step, which is gone)
--
-- 'awaiting_feedback' is retired. Postgres cannot drop a value from an enum, so
-- it stays in the type; this makes it unreachable and moves the rows sitting in
-- it back to Answered so the MIS side can close them the new way.
--
-- RUN THIS BEFORE DEPLOYING THE MATCHING CODE. The new UI offers Closed
-- straight from Answered and offers it to agents; the old guard rejects both,
-- so code without this migration leaves those buttons failing on every click.

-- ---------------------------------------------------------------------------
-- 1. Move the in-flight tickets off the step being removed.
--
--    Triggers are off for this one statement so it does not post a status-change
--    line into every ticket's chat, fire a notification and an email per ticket,
--    or bump updated_at.
-- ---------------------------------------------------------------------------
ALTER TABLE public.tickets DISABLE TRIGGER USER;

UPDATE public.tickets
SET status = 'answered'
WHERE status::text = 'awaiting_feedback';

ALTER TABLE public.tickets ENABLE TRIGGER USER;

-- ---------------------------------------------------------------------------
-- 2. The agent can write to the tickets assigned to them.
--    (Restated so this migration lands whether or not the earlier ones ran.)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "tickets_update_reporter_or_head" ON public.tickets;
DROP POLICY IF EXISTS "tickets_update_by_hierarchy" ON public.tickets;
DROP POLICY IF EXISTS "tickets_update_reporter_assignee_or_head" ON public.tickets;
CREATE POLICY "tickets_update_reporter_assignee_or_head"
ON public.tickets
FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
  OR (public.has_role(auth.uid(), 'agent') AND assignee_id = auth.uid())
)
WITH CHECK (
  user_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
  OR (public.has_role(auth.uid(), 'agent') AND assignee_id = auth.uid())
);

-- ---------------------------------------------------------------------------
-- 3. The workflow guard.
--
--    Changed from 20260729150000:
--      - 'answered' goes straight to 'closed'
--      - nothing moves INTO 'awaiting_feedback'
--      - an agent may close, but not cancel
--      - employees no longer change status at all
--      - 'awaiting_feedback' keeps its exits so no stray row can get stuck
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.protect_ticket_workflow_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  old_status text := OLD.status::text;
  new_status text := NEW.status::text;
  mis_transition_allowed boolean :=
    (old_status = 'open' AND new_status IN ('in_progress', 'canceled'))
    OR (old_status = 'in_progress' AND new_status IN ('answered', 'canceled'))
    OR (old_status = 'answered' AND new_status IN ('closed', 'in_progress', 'canceled'))
    OR (old_status = 'resolved' AND new_status = 'closed')
    -- Legacy exit only: nothing enters 'awaiting_feedback' any more.
    OR (old_status = 'awaiting_feedback' AND new_status IN ('answered', 'closed', 'in_progress', 'canceled'));
BEGIN
  -- Cancelling is the MIS Head's alone.
  IF auth.uid() IS NOT NULL
     AND NEW.status IS DISTINCT FROM OLD.status
     AND new_status = 'canceled'
     AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only the MIS Head/Admin can cancel a ticket';
  END IF;

  -- An agent moves only the tickets assigned to them, and only along the
  -- working path: In Progress, Answered, Closed.
  IF auth.uid() IS NOT NULL
     AND NEW.status IS DISTINCT FROM OLD.status
     AND public.has_role(auth.uid(), 'agent')
     AND NOT public.has_role(auth.uid(), 'admin') THEN
    IF OLD.assignee_id IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'An MIS agent can only change tickets assigned to them';
    END IF;
    IF new_status NOT IN ('in_progress', 'answered', 'closed') THEN
      RAISE EXCEPTION 'An MIS agent can move a ticket to In Progress, Answered or Closed';
    END IF;
  END IF;

  IF auth.uid() = OLD.user_id AND NOT public.is_mis_staff(auth.uid()) THEN
    IF NEW.assignee_id IS DISTINCT FROM OLD.assignee_id
       OR NEW.user_id IS DISTINCT FROM OLD.user_id
       OR NEW.parent_ticket_id IS DISTINCT FROM OLD.parent_ticket_id THEN
      RAISE EXCEPTION 'Employees cannot change ticket ownership or assignment';
    END IF;

    IF NEW.status IS DISTINCT FROM OLD.status THEN
      RAISE EXCEPTION 'Only MIS staff can change a ticket''s status';
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

-- ---------------------------------------------------------------------------
-- 4. Check it landed. Expect no 'awaiting_feedback' rows.
-- ---------------------------------------------------------------------------
SELECT status::text AS status, count(*) AS tickets
FROM public.tickets
GROUP BY status
ORDER BY 1;
