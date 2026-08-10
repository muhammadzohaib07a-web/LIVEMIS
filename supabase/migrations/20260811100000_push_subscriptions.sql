-- Web Push subscriptions: one row per browser/device a user has enabled
-- push notifications on (a person can have several — phone + desktop).
-- Sent to whenever the app currently sends an email notification (new
-- ticket -> MIS Head, ticket assigned -> agent, awaiting feedback -> reporter),
-- delivered via the browser's push service even if the tab/app is closed.

CREATE TABLE public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "push_sub_select_own" ON public.push_subscriptions FOR SELECT TO authenticated
USING (user_id = auth.uid());
CREATE POLICY "push_sub_insert_own" ON public.push_subscriptions FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());
CREATE POLICY "push_sub_delete_own" ON public.push_subscriptions FOR DELETE TO authenticated
USING (user_id = auth.uid());
