-- Narrows the open read from 20260929120000: reading every ticket is for MIS
-- staff, not for everyone.
--
-- That migration made every ticket readable by any signed-in user. It went too
-- far — it meant every employee in every department could read every other
-- department's support conversation. This puts employees back where they were
-- and keeps the part that was actually wanted.
--
-- After this:
--   employee  - own tickets only, exactly as before any of this
--   agent     - every ticket, not just the ones assigned to them (this is the
--               new capability, and the only one that was asked for)
--   MIS Head  - everything, unchanged
--
-- Writing stays as it is: an employee replies only on their own ticket, MIS
-- staff reply anywhere, and only the MIS Head moves a ticket's status. The
-- tickets UPDATE policy from 20260929120000 is deliberately left alone — that
-- is what keeps agents read-and-reply only.
--
-- RUN THIS BEFORE DEPLOYING THE MATCHING CODE. It is the tightening half, so
-- running it first closes the over-broad read immediately. The currently
-- deployed UI will simply show an employee their own tickets under a heading
-- that says "All Tickets" until the code catches up — wrong wording for a few
-- minutes, nothing broken.

-- ---------------------------------------------------------------------------
-- 1. The ticket rows.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "tickets_select_all_signed_in" ON public.tickets;
CREATE POLICY "tickets_select_own_or_mis_staff"
ON public.tickets
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'agent')
);

-- ---------------------------------------------------------------------------
-- 2. The conversation.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "tm_select_all_signed_in" ON public.ticket_messages;
CREATE POLICY "tm_select_own_or_mis_staff"
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
        OR public.has_role(auth.uid(), 'agent')
      )
  )
);

-- ---------------------------------------------------------------------------
-- 3. Read receipts and reactions.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "message_reads_select_all_signed_in" ON public.message_reads;
CREATE POLICY "message_reads_select_own_or_mis_staff"
ON public.message_reads
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
        OR public.has_role(auth.uid(), 'agent')
      )
  )
);

DROP POLICY IF EXISTS "message_reactions_select_all_signed_in" ON public.message_reactions;
CREATE POLICY "message_reactions_select_own_or_mis_staff"
ON public.message_reactions
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
        OR public.has_role(auth.uid(), 'agent')
      )
  )
);

-- ---------------------------------------------------------------------------
-- 4. The uploaded screenshots and files.
--
--    Back to the original rule: your own folder, or any of them if you are MIS
--    staff. is_mis_staff() already covers admin and agent, so agents keep the
--    access they need to work a ticket they did not raise.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "ticket_attachment_select_all_signed_in" ON storage.objects;
CREATE POLICY "ticket_attachment_select_participants"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'ticket-attachments'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.is_mis_staff(auth.uid())
  )
);

-- ---------------------------------------------------------------------------
-- 5. Check it landed.
--
--    Every SELECT policy below should mention auth.uid() again — none of them
--    should read plain "true". The tickets UPDATE policy should still be
--    tickets_update_reporter_or_head with no mention of 'agent'.
-- ---------------------------------------------------------------------------
SELECT tablename, policyname, cmd, qual::text AS using_clause
FROM pg_policies
WHERE (schemaname = 'public' AND tablename IN
         ('tickets', 'ticket_messages', 'message_reads', 'message_reactions'))
   OR (schemaname = 'storage' AND policyname LIKE 'ticket_attachment%')
ORDER BY tablename, cmd, policyname;
