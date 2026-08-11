-- WhatsApp-style read receipts (single/double/blue tick) and emoji
-- reactions on ticket chat messages.
--
-- message_reads: one row per (message, reader) once that person has opened
-- the ticket and seen the message. Used client-side to compute tick state:
-- 0 other readers = sent (1 tick), some but not all = delivered (2 gray
-- ticks), everyone else in the ticket's circle = seen (2 blue ticks).
--
-- message_reactions: one row per (message, user) — a user's current emoji
-- reaction on a message; picking a new emoji replaces their old one.
--
-- Both carry a denormalized ticket_id (not just message_id) so RLS and
-- realtime subscriptions can filter directly without joining through
-- ticket_messages every time.

CREATE TABLE public.message_reads (
  message_id uuid NOT NULL REFERENCES public.ticket_messages(id) ON DELETE CASCADE,
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, user_id)
);
GRANT SELECT, INSERT ON public.message_reads TO authenticated;
GRANT ALL ON public.message_reads TO service_role;
ALTER TABLE public.message_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "message_reads_select_participants" ON public.message_reads FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.tickets t
    WHERE t.id = ticket_id
      AND (
        t.user_id = auth.uid()
        OR public.has_role(auth.uid(), 'admin')
        OR (public.has_role(auth.uid(), 'agent') AND t.assignee_id = auth.uid())
      )
  )
);
CREATE POLICY "message_reads_insert_own" ON public.message_reads FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.tickets t
    WHERE t.id = ticket_id
      AND (
        t.user_id = auth.uid()
        OR public.has_role(auth.uid(), 'admin')
        OR (public.has_role(auth.uid(), 'agent') AND t.assignee_id = auth.uid())
      )
  )
);

CREATE TABLE public.message_reactions (
  message_id uuid NOT NULL REFERENCES public.ticket_messages(id) ON DELETE CASCADE,
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.message_reactions TO authenticated;
GRANT ALL ON public.message_reactions TO service_role;
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "message_reactions_select_participants" ON public.message_reactions FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.tickets t
    WHERE t.id = ticket_id
      AND (
        t.user_id = auth.uid()
        OR public.has_role(auth.uid(), 'admin')
        OR (public.has_role(auth.uid(), 'agent') AND t.assignee_id = auth.uid())
      )
  )
);
CREATE POLICY "message_reactions_insert_own" ON public.message_reactions FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.tickets t
    WHERE t.id = ticket_id
      AND (
        t.user_id = auth.uid()
        OR public.has_role(auth.uid(), 'admin')
        OR (public.has_role(auth.uid(), 'agent') AND t.assignee_id = auth.uid())
      )
  )
);
CREATE POLICY "message_reactions_update_own" ON public.message_reactions FOR UPDATE TO authenticated
USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "message_reactions_delete_own" ON public.message_reactions FOR DELETE TO authenticated
USING (user_id = auth.uid());

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reads;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END;
$$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reactions;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END;
$$;
