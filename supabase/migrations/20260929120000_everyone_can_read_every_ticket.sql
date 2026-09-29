-- Opens ticket READING to everyone who can sign in.
--
-- Before: an employee saw only their own tickets, an agent only the ones
--         assigned to them, and the MIS Head saw everything.
-- After:  every signed-in user can open and read every ticket — the ticket
--         itself, its whole conversation, its attachments, its read receipts
--         and reactions.
--
-- WRITING IS DELIBERATELY UNCHANGED. Nobody gains the right to post, edit,
-- assign, change status or delete anything. The INSERT/UPDATE/DELETE policies
-- are left exactly as they were, so:
--   - an employee can still only reply on their own ticket
--   - only the assigned agent and the MIS Head move a ticket's status
--   - only the MIS Head assigns, closes, cancels or deletes
-- Everyone else gets a read-only view.
--
-- WHAT THIS MEANS IN PRACTICE: every employee in the company can now read
-- every other department's support conversation, including whatever was typed
-- in chat and whatever screenshots were uploaded. If any ticket ever carries
-- something that should not be company-wide — an account problem naming a
-- person, a salary or HR issue, a screenshot with figures on it — it is now
-- readable by all staff. This is a deliberate change, not an oversight; to
-- narrow it later, put the old USING clauses back.

-- ---------------------------------------------------------------------------
-- 1. The ticket rows.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "tickets_select_by_hierarchy" ON public.tickets;
CREATE POLICY "tickets_select_all_signed_in"
ON public.tickets
FOR SELECT
TO authenticated
USING (true);

-- ---------------------------------------------------------------------------
-- 2. The conversation.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "tm_select_by_hierarchy" ON public.ticket_messages;
DROP POLICY IF EXISTS "tm_select" ON public.ticket_messages;
CREATE POLICY "tm_select_all_signed_in"
ON public.ticket_messages
FOR SELECT
TO authenticated
USING (true);

-- ---------------------------------------------------------------------------
-- 3. Read receipts and reactions.
--
--    Cosmetic, but they are fetched on every ticket open — left closed, the
--    ticks and emoji would silently vanish on someone else's ticket.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "message_reads_select_participants" ON public.message_reads;
CREATE POLICY "message_reads_select_all_signed_in"
ON public.message_reads
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "message_reactions_select_participants" ON public.message_reactions;
CREATE POLICY "message_reactions_select_all_signed_in"
ON public.message_reactions
FOR SELECT
TO authenticated
USING (true);

-- ---------------------------------------------------------------------------
-- 4. The uploaded screenshots and files.
--
--    These live in Storage, and the old policy only let you read files in the
--    folder named after your own user id (MIS staff could read all). Without
--    this the conversation would open but every image in it would break.
--
--    UPLOADING is untouched: the insert policy still pins you to your own
--    folder, so nobody can write into someone else's.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "ticket_attachment_select_participants" ON storage.objects;
CREATE POLICY "ticket_attachment_select_all_signed_in"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'ticket-attachments');

-- ---------------------------------------------------------------------------
-- 6. Agents become read-and-reply only.
--
--    An agent could previously UPDATE any ticket assigned to them, which in
--    this app means exactly one thing: moving its status. From now on the MIS
--    Head alone moves a ticket. The agent still reads every ticket and still
--    replies in chat — the ticket_messages INSERT policy is untouched and
--    already allows any MIS staff member to post.
--
--    Doing this in the database as well as in the UI matters: hiding the
--    buttons stops the buttons, not somebody calling the API directly.
--
--    The reporter keeps their own UPDATE right, which is what the awaiting-
--    feedback step relies on; only the agent branch is removed.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "tickets_update_by_hierarchy" ON public.tickets;
CREATE POLICY "tickets_update_reporter_or_head"
ON public.tickets
FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
)
WITH CHECK (
  user_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
);

-- ---------------------------------------------------------------------------
-- 7. Check it landed.
--
--    SELECT policies should read "true". The tickets UPDATE policy should no
--    longer mention 'agent'. The INSERT policy on ticket_messages should be
--    unchanged, so agents can still reply.
-- ---------------------------------------------------------------------------
SELECT tablename, policyname, cmd, qual::text AS using_clause
FROM pg_policies
WHERE (schemaname = 'public' AND tablename IN
         ('tickets', 'ticket_messages', 'message_reads', 'message_reactions'))
   OR (schemaname = 'storage' AND policyname LIKE 'ticket_attachment%')
ORDER BY tablename, cmd, policyname;
