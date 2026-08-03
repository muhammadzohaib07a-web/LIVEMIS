-- Structured, module-specific reference fields captured by the guided
-- ticket wizard (Odoo document numbers, work centers, looms, etc.),
-- separate from the free-text description.
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;
