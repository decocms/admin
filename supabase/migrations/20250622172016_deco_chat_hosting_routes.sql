CREATE TABLE IF NOT EXISTS deco_chat_hosting_routes(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hosting_app_id uuid NOT NULL,
  route_pattern text NOT NULL,
  custom_domain boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz, -- for soft deletes
  CONSTRAINT fk_hosting_app FOREIGN KEY (hosting_app_id) REFERENCES deco_chat_hosting_apps (id) ON DELETE CASCADE
);
-- Optional: index for fast lookup by hosting app
CREATE INDEX IF NOT EXISTS idx_hosting_routes_hosting_app_id ON deco_chat_hosting_routes (hosting_app_id);
-- Optional: index for fast lookup by route pattern
CREATE INDEX IF NOT EXISTS idx_hosting_routes_route_pattern ON deco_chat_hosting_routes (route_pattern);
-- Add partial unique index for custom domains
CREATE UNIQUE INDEX IF NOT EXISTS unique_custom_domain_route_pattern ON deco_chat_hosting_routes (route_pattern, custom_domain)
WHERE
  custom_domain;
-- Enable Row Level Security
ALTER TABLE deco_chat_hosting_routes ENABLE ROW LEVEL SECURITY;
