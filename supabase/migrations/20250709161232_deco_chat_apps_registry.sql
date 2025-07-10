CREATE TABLE IF NOT EXISTS public.deco_chat_registry_scopes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_name text NOT NULL UNIQUE,
  workspace text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_registry_scopes_scope_name
  ON public.deco_chat_registry_scopes (scope_name);

CREATE INDEX IF NOT EXISTS idx_registry_scopes_workspace
  ON public.deco_chat_registry_scopes (workspace);

ALTER TABLE public.deco_chat_registry_scopes ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.deco_chat_apps_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace text NOT NULL,
  scope_id uuid NOT NULL REFERENCES public.deco_chat_registry_scopes(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  icon text,
  connection jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  unlisted boolean NOT NULL DEFAULT false,
  CONSTRAINT unique_registry_app_scope_name UNIQUE(scope_id, name)
);

CREATE INDEX IF NOT EXISTS idx_registry_apps_workspace
  ON public.deco_chat_apps_registry (workspace);

CREATE INDEX IF NOT EXISTS idx_registry_apps_scope_id
  ON public.deco_chat_apps_registry (scope_id);

CREATE INDEX IF NOT EXISTS idx_registry_apps_name
  ON public.deco_chat_apps_registry (name);

ALTER TABLE public.deco_chat_apps_registry ENABLE ROW LEVEL SECURITY;
