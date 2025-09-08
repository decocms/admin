-- Create projects table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.deco_chat_projects (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    slug text NOT NULL,
    title text NOT NULL,
    icon text,
    description text,
    org_id int8 NOT NULL,
    created_at timestamp DEFAULT now(),
    CONSTRAINT deco_chat_projects_pkey PRIMARY KEY (id)
);

-- Create unique constraint for slug + org_id if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'deco_chat_projects_slug_org_id_unique' 
        AND table_name = 'deco_chat_projects'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.deco_chat_projects 
        ADD CONSTRAINT deco_chat_projects_slug_org_id_unique 
        UNIQUE (slug, org_id);
    END IF;
END $$;

-- Create foreign key constraint if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'deco_chat_projects_org_id_fkey' 
        AND table_name = 'deco_chat_projects'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.deco_chat_projects 
        ADD CONSTRAINT deco_chat_projects_org_id_fkey 
        FOREIGN KEY (org_id) REFERENCES public.teams(id);
    END IF;
END $$;
