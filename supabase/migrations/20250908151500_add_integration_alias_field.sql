-- Add alias column to integrations table for custom user-defined names
-- This allows users to give custom display names to integration instances
-- to help distinguish between multiple instances of the same app

-- Add alias column (idempotent)
ALTER TABLE public.deco_chat_integrations
ADD COLUMN IF NOT EXISTS alias text;

-- Add comment to document the purpose of the alias field
COMMENT ON COLUMN public.deco_chat_integrations.alias IS 'Custom user-defined display name for the integration instance';

-- Create index for better performance when filtering/searching by alias (optional)
CREATE INDEX IF NOT EXISTS idx_integrations_alias
  ON public.deco_chat_integrations (alias)
  WHERE alias IS NOT NULL;