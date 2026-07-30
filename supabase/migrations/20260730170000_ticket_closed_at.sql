-- Record exactly when a ticket was closed, independent of updated_at (which
-- would be overwritten by any later, unrelated write to the row).
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS closed_at timestamptz;

CREATE OR REPLACE FUNCTION public.set_ticket_closed_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status IN ('closed', 'resolved') AND OLD.status NOT IN ('closed', 'resolved') THEN
    NEW.closed_at := now();
  ELSIF NEW.status NOT IN ('closed', 'resolved') THEN
    NEW.closed_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_ticket_closed_at ON public.tickets;
CREATE TRIGGER set_ticket_closed_at
BEFORE UPDATE ON public.tickets
FOR EACH ROW EXECUTE FUNCTION public.set_ticket_closed_at();
