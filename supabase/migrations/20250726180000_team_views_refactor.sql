-- Refactor team views to a simpler schema: (id, team_id, title, icon, type, integration_id, name)
-- Keep this migration idempotent

-- Add columns if not exists
ALTER TABLE public.deco_chat_views
  ADD COLUMN IF NOT EXISTS integration_id text,
  ADD COLUMN IF NOT EXISTS name text;

-- Backfill new columns from legacy metadata where possible
UPDATE public.deco_chat_views
SET
  integration_id = COALESCE(integration_id, metadata->'integration'->>'id'),
  name = COALESCE(name, metadata->>'viewName')
WHERE type = 'custom';

-- (Indexes intentionally omitted for now; can be added later if needed)


