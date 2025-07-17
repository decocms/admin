-- Create OAuth codes table
CREATE TABLE IF NOT EXISTS public.deco_chat_oauth_codes (
  code text PRIMARY KEY, -- Custom primary key as requested
  claims jsonb NOT NULL, -- Claims that will be used to issue a JWT
  workspace text NOT NULL, -- For multi-tenancy following the pattern
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_oauth_codes_workspace
  ON public.deco_chat_oauth_codes (workspace);

-- Enable Row Level Security
ALTER TABLE public.deco_chat_oauth_codes ENABLE ROW LEVEL SECURITY; 