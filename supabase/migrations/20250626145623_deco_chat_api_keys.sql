CREATE TABLE IF NOT EXISTS public.deco_chat_api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  workspace text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  policies jsonb DEFAULT '{}', -- JSON metadata for request-specific policies
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz, -- for soft deletes
  CONSTRAINT unique_api_key_name_workspace UNIQUE(name, workspace)
);

-- Optional: index for fast lookup by workspace
CREATE INDEX IF NOT EXISTS idx_api_keys_workspace
  ON public.deco_chat_api_keys (workspace);

-- Optional: index for fast lookup by enabled status
CREATE INDEX IF NOT EXISTS idx_api_keys_enabled
  ON public.deco_chat_api_keys (enabled);

-- Disable Row Level Security as requested
ALTER TABLE public.deco_chat_api_keys ENABLE ROW LEVEL SECURITY;
