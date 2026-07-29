-- Enums
CREATE TYPE public.ticket_status AS ENUM ('open','in_progress','resolved','closed');
CREATE TYPE public.ticket_priority AS ENUM ('low','medium','high','urgent');
CREATE TYPE public.ticket_category AS ENUM ('hardware','software','network','email','access','erp','printer','other');

-- add agent role if missing
DO $$ BEGIN
  ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'agent';
EXCEPTION WHEN others THEN NULL; END $$;

-- Tickets
CREATE TABLE public.tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_no text NOT NULL UNIQUE DEFAULT ('T-' || lpad((floor(random()*900000)+100000)::text, 6, '0')),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assignee_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text NOT NULL,
  category public.ticket_category NOT NULL DEFAULT 'other',
  priority public.ticket_priority NOT NULL DEFAULT 'medium',
  status public.ticket_status NOT NULL DEFAULT 'open',
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tickets TO authenticated;
GRANT ALL ON public.tickets TO service_role;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tickets_select_own_or_staff" ON public.tickets FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'agent'));
CREATE POLICY "tickets_insert_own" ON public.tickets FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());
CREATE POLICY "tickets_update_own_or_staff" ON public.tickets FOR UPDATE TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'agent'))
WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'agent'));
CREATE POLICY "tickets_delete_staff" ON public.tickets FOR DELETE TO authenticated
USING (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER tickets_updated BEFORE UPDATE ON public.tickets
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Ticket messages
CREATE TABLE public.ticket_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ticket_messages TO authenticated;
GRANT ALL ON public.ticket_messages TO service_role;
ALTER TABLE public.ticket_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tm_select" ON public.ticket_messages FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.tickets t WHERE t.id = ticket_id
    AND (t.user_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'agent')))
);
CREATE POLICY "tm_insert" ON public.ticket_messages FOR INSERT TO authenticated
WITH CHECK (
  sender_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.tickets t WHERE t.id = ticket_id
      AND (t.user_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'agent'))
  )
);

-- Knowledge base
CREATE TABLE public.kb_articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  category public.ticket_category NOT NULL DEFAULT 'other',
  content text NOT NULL,
  published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kb_articles TO authenticated;
GRANT ALL ON public.kb_articles TO service_role;
ALTER TABLE public.kb_articles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kb_select_published" ON public.kb_articles FOR SELECT TO authenticated
USING (published OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "kb_admin_all" ON public.kb_articles FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER kb_updated BEFORE UPDATE ON public.kb_articles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Notifications
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text,
  link text,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notif_select_own" ON public.notifications FOR SELECT TO authenticated
USING (user_id = auth.uid());
CREATE POLICY "notif_update_own" ON public.notifications FOR UPDATE TO authenticated
USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "notif_insert_self_or_staff" ON public.notifications FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'agent'));

-- Seed KB
INSERT INTO public.kb_articles (slug,title,category,content) VALUES
('outlook-not-syncing','Outlook not syncing on desk PC','email','1. Close Outlook completely.\n2. Open Control Panel → Mail → Show Profiles.\n3. Remove the profile and re-add it using your Leen Textile email.\n4. Restart Outlook and let it re-sync (may take 10–15 minutes).\nIf issue persists, open a ticket with a screenshot of the error.'),
('printer-offline','Printer shows offline','printer','1. Ensure the printer is powered on and the network cable is connected.\n2. On Windows, go to Settings → Printers → select the printer → Open queue → Printer → uncheck "Use Printer Offline".\n3. Restart the Print Spooler service.\nStill offline? Report with the printer name and floor number.'),
('vpn-access','Request VPN / remote access','access','Fill in a ticket under category "Access" with your Employee ID, department head approval, and reason. MIS will provision credentials within 1 business day.'),
('erp-slow','ERP running slow','erp','Clear browser cache, close unused tabs, and try again. If several users are affected, MIS will investigate the ERP server load. Report peak hours in your ticket.'),
('wifi-drops','Office Wi-Fi keeps dropping','network','Forget the SSID and reconnect. Prefer the 5 GHz band ("Leen-5G"). If drops continue in a specific area, mention the floor and cabin number in your ticket.');