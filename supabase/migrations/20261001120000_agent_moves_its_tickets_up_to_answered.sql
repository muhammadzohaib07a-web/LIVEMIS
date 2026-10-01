-- Gives an agent back the right to move the tickets assigned to them, and
-- caps how far they can take one.
--
-- 20260929120000 removed the agent branch from the tickets UPDATE policy
-- altogether. That was too much: it was meant to stop an agent touching the
-- other departments' tickets they can now see, not the ones the MIS Head
-- handed them.
--
-- The rule now:
--   a ticket assigned to the agent   - that agent may move it, as far as
--                                      In Progress or Answered
--   any other ticket                 - read and reply in chat, nothing more
--   Awaiting Feedback / Closed /
--   Canceled                         - the MIS Head only, on every ticket
--   own ticket as reporter           - unchanged
--
-- Cancelling used to be blocked only by hiding the button; it is enforced here
-- now, along with the Awaiting Feedback cap.

-- ---------------------------------------------------------------------------
-- 1. The agent can write to their own assigned tickets again.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "tickets_update_reporter_or_head" ON public.tickets;
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
-- 2. The cap. Same function as 20260729150000 with one new check added — the
--    rest is unchanged, so the employee rules and the admin-only close behave
--    exactly as they did.
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

  -- NEW: an agent takes a ticket as far as Answered and no further.
  IF auth.uid() IS NOT NULL
     AND NEW.status IS DISTINCT FROM OLD.status
     AND public.has_role(auth.uid(), 'agent')
     AND NOT public.has_role(auth.uid(), 'admin')
     AND new_status NOT IN ('in_progress', 'answered') THEN
    RAISE EXCEPTION 'An MIS agent can only move a ticket to In Progress or Answered';
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

-- ---------------------------------------------------------------------------
-- 3. Check it landed. The UPDATE policy should mention 'agent' together with
--    assignee_id; the SELECT policies should still be the narrowed ones from
--    20260929150000 (own tickets, or any for MIS staff) — never plain "true".
-- ---------------------------------------------------------------------------
SELECT tablename, policyname, cmd, qual::text AS using_clause
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'tickets'
ORDER BY cmd, policyname;
