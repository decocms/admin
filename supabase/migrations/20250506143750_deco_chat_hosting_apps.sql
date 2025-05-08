CREATE TABLE deco_chat_hosting_apps(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL, -- the slug of the app, e.g. 'default' or custom
  workspace text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz, -- for soft deletes
  cloudflare_worker_id text, -- the Cloudflare worker identifier
  cloudflare_script_hash text, -- hash of the deployed script for versioning
  metadata jsonb, -- any extra metadata (optional)
  files jsonb, -- the files that make up the app
  UNIQUE(slug)
);

-- Optional: index for fast lookup by workspace
CREATE INDEX idx_hosting_apps_workspace
  ON deco_chat_hosting_apps (workspace);

-- Optional: index for fast lookup by slug
CREATE INDEX idx_hosting_apps_slug
  ON deco_chat_hosting_apps (slug);

-- Enable Row Level Security
ALTER TABLE deco_chat_hosting_apps ENABLE ROW LEVEL SECURITY;