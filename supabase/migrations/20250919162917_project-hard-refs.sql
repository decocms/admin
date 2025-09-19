-- This migration script is idempotent and can be run multiple times safely.
-- It adds a nullable `project_id` UUID column to several tables,
-- referencing the `id` column in `deco_chat_projects`.

-- List of tables to be migrated
DO $$
DECLARE
    tables_to_migrate TEXT[] := ARRAY[
        'deco_chat_agents',
        'deco_chat_api_keys',
        'deco_chat_apps_registry',
        'deco_chat_assets',
        'deco_chat_channels',
        'deco_chat_hosting_apps',
        'deco_chat_integrations',
        'deco_chat_oauth_codes',
        'deco_chat_prompts',
        'deco_chat_registry_scopes',
        'deco_chat_triggers',
        'models'
    ];
    current_table TEXT;
    fk_constraint_name TEXT;
BEGIN
    FOREACH current_table IN ARRAY tables_to_migrate
    LOOP
        -- Check if the column 'project_id' already exists in the table
        IF NOT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = current_table
              AND column_name = 'project_id'
        ) THEN
            -- Add the new column as nullable
            EXECUTE format('ALTER TABLE public.%I ADD COLUMN project_id UUID NULL', current_table);
            RAISE NOTICE 'Added column project_id to table %', current_table;
        ELSE
            RAISE NOTICE 'Column project_id already exists in table %', current_table;
        END IF;

        -- Check if the foreign key constraint already exists
        fk_constraint_name := format('fk_%s_project_id', current_table);
        IF NOT EXISTS (
            SELECT 1
            FROM information_schema.table_constraints
            WHERE constraint_schema = 'public'
              AND table_name = current_table
              AND constraint_name = fk_constraint_name
              AND constraint_type = 'FOREIGN KEY'
        ) THEN
            -- Add the foreign key constraint
            EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (project_id) REFERENCES public.deco_chat_projects (id) ON DELETE SET NULL', current_table, fk_constraint_name);
            RAISE NOTICE 'Added foreign key constraint % to table %', fk_constraint_name, current_table;
        ELSE
            RAISE NOTICE 'Foreign key constraint % already exists on table %', fk_constraint_name, current_table;
        END IF;
    END LOOP;
END $$;

-- Also add org reference to deco_chat_customer

ALTER TABLE deco_chat_customer ADD COLUMN IF NOT EXISTS org_id bigint;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints WHERE table_name = 'deco_chat_customer' AND constraint_name = 'deco_chat_customer_org_id_fkey'
    ) THEN
        ALTER TABLE deco_chat_customer ADD CONSTRAINT deco_chat_customer_org_id_fkey FOREIGN KEY (org_id) REFERENCES teams(id);
    END IF;
END $$;