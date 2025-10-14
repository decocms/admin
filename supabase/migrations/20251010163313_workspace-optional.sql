-- PR #2: Make Workspace Column Optional
-- This migration makes the workspace column nullable across all tables
-- to support project-scoped entities that don't need a workspace value

-- ============================================================================
-- TABLES WITH SIMPLE WORKSPACE COLUMN (no constraints to worry about)
-- ============================================================================

-- 1. deco_chat_agents
ALTER TABLE public.deco_chat_agents 
  ALTER COLUMN workspace DROP NOT NULL;

-- 2. deco_chat_oauth_codes
ALTER TABLE public.deco_chat_oauth_codes 
  ALTER COLUMN workspace DROP NOT NULL;

-- 3. deco_chat_channels
ALTER TABLE public.deco_chat_channels 
  ALTER COLUMN workspace DROP NOT NULL;

-- 4. deco_chat_hosting_apps
ALTER TABLE public.deco_chat_hosting_apps 
  ALTER COLUMN workspace DROP NOT NULL;

-- 5. deco_chat_integrations
ALTER TABLE public.deco_chat_integrations 
  ALTER COLUMN workspace DROP NOT NULL;

-- 6. deco_chat_registry_scopes
ALTER TABLE public.deco_chat_registry_scopes 
  ALTER COLUMN workspace DROP NOT NULL;

-- 7. deco_chat_apps_registry
ALTER TABLE public.deco_chat_apps_registry 
  ALTER COLUMN workspace DROP NOT NULL;

-- 8. deco_chat_triggers
ALTER TABLE public.deco_chat_triggers 
  ALTER COLUMN workspace DROP NOT NULL;

-- 9. deco_chat_prompts
ALTER TABLE public.deco_chat_prompts 
  ALTER COLUMN workspace DROP NOT NULL;

-- 10. models
ALTER TABLE public.models 
  ALTER COLUMN workspace DROP NOT NULL;

-- ============================================================================
-- TABLES WITH CONSTRAINTS INVOLVING WORKSPACE
-- ============================================================================

-- 11. deco_chat_api_keys
-- Has composite UNIQUE constraint: UNIQUE(name, workspace)
-- During transition, we need to support both workspace-scoped and project-scoped API keys
ALTER TABLE public.deco_chat_api_keys 
  DROP CONSTRAINT IF EXISTS unique_api_key_name_workspace;

ALTER TABLE public.deco_chat_api_keys 
  ALTER COLUMN workspace DROP NOT NULL;

-- Strategy: Maintain uniqueness on BOTH dimensions during migration
-- This ensures API key names remain unique within their scope

-- 1. Workspace-scoped uniqueness (for legacy/workspace-level API keys)
--    Allows (name, NULL) when transitioning to project-scoped
CREATE UNIQUE INDEX IF NOT EXISTS unique_api_key_name_workspace 
  ON public.deco_chat_api_keys (name, workspace) 
  WHERE workspace IS NOT NULL;

-- 2. Project-scoped uniqueness (for new project-level API keys)
--    Allows (name, NULL) when project_id is not yet populated
CREATE UNIQUE INDEX IF NOT EXISTS unique_api_key_name_project 
  ON public.deco_chat_api_keys (name, project_id) 
  WHERE project_id IS NOT NULL;

-- Note: During transition, entities with both workspace=NULL and project_id=NULL
-- will not be constrained. This is acceptable temporarily as PR #3 will populate
-- project_id for all rows. After PR #3, we can enforce that at least one is NOT NULL.

-- 12. deco_chat_customer
-- Has UNIQUE constraint on workspace alone
-- Billing should transition from workspace-scoped to org-scoped
ALTER TABLE public.deco_chat_customer 
  DROP CONSTRAINT IF EXISTS deco_chat_customer_workspace_key;

ALTER TABLE public.deco_chat_customer 
  ALTER COLUMN workspace DROP NOT NULL;

-- Strategy: Maintain uniqueness on BOTH dimensions during migration
-- One Stripe customer per workspace (legacy) OR one per org (new model)

-- 1. Workspace-scoped uniqueness (for legacy billing)
--    One Stripe customer per workspace when workspace is set
CREATE UNIQUE INDEX IF NOT EXISTS deco_chat_customer_workspace_key 
  ON public.deco_chat_customer (workspace) 
  WHERE workspace IS NOT NULL;

-- 2. Org-scoped uniqueness (for new billing model)
--    One Stripe customer per organization
CREATE UNIQUE INDEX IF NOT EXISTS deco_chat_customer_org_id_key 
  ON public.deco_chat_customer (org_id) 
  WHERE org_id IS NOT NULL;

-- Note: During transition, entities with both workspace=NULL and org_id=NULL
-- will not be constrained. After PR #3, we can enforce that at least one is NOT NULL.

-- 13. deco_chat_assets
-- CRITICAL: workspace is part of composite PRIMARY KEY (file_url, workspace)
-- We cannot simply drop NOT NULL without changing the primary key structure
-- For now, keep this table as-is and handle in PR #3 with data migration
-- Uncomment the following when ready to handle this table:
-- 
-- ALTER TABLE public.deco_chat_assets 
--   DROP CONSTRAINT deco_chat_assets_pkey;
-- 
-- ALTER TABLE public.deco_chat_assets 
--   ALTER COLUMN workspace DROP NOT NULL;
-- 
-- -- Option 1: Add a surrogate primary key
-- -- ALTER TABLE public.deco_chat_assets ADD COLUMN id uuid DEFAULT gen_random_uuid();
-- -- ALTER TABLE public.deco_chat_assets ADD PRIMARY KEY (id);
-- -- CREATE UNIQUE INDEX idx_assets_file_url_workspace ON public.deco_chat_assets (file_url, workspace);
-- 
-- -- Option 2: Keep composite PK but allow NULL (PostgreSQL allows NULL in PK components)
-- ALTER TABLE public.deco_chat_assets 
--   ADD CONSTRAINT deco_chat_assets_pkey PRIMARY KEY (file_url, workspace);

-- ============================================================================
-- NOTES
-- ============================================================================

-- Testing checklist:
-- 1. Verify all columns accept NULL values
-- 2. Test creating entities with workspace = NULL
-- 3. Verify unique constraints work correctly with NULL values
-- 4. Check that indexes on workspace columns still function
-- 5. Verify foreign key relationships still work
-- 6. Test CRUD operations with mixed workspace/project data
--
-- Rollback: All changes can be reversed by running ALTER COLUMN workspace SET NOT NULL
-- and recreating original constraints if needed.

