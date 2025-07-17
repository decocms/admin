-- Add app_id column to deco_chat_integrations table (idempotent)
ALTER TABLE public.deco_chat_integrations
ADD COLUMN IF NOT EXISTS app_id uuid;

-- Add foreign key constraint (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'deco_chat_integrations_app_id_fkey'
    AND table_name = 'deco_chat_integrations'
  ) THEN
    ALTER TABLE public.deco_chat_integrations
    ADD CONSTRAINT deco_chat_integrations_app_id_fkey
    FOREIGN KEY (app_id) REFERENCES public.deco_chat_apps_registry(id);
  END IF;
END $$;

-- Add index for better performance (idempotent)
CREATE INDEX IF NOT EXISTS idx_integrations_app_id
  ON public.deco_chat_integrations (app_id);
