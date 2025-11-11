-- Add avatar_url field to teams table for organization logos
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Add comment to column
COMMENT ON COLUMN public.teams.avatar_url IS 'URL to the organization logo/avatar image';

