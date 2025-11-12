-- Add domain field to teams table for auto-join functionality
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS domain TEXT;

-- Create index on domain for faster lookups
CREATE INDEX IF NOT EXISTS teams_domain_idx ON public.teams(domain) WHERE domain IS NOT NULL;

-- Add comment to column
COMMENT ON COLUMN public.teams.domain IS 'Email domain for auto-join (e.g., "acme.com"). Only set for non-well-known email domains to enable users with matching email domains to auto-join the organization.';

