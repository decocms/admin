-- Create deco_chat_views table
CREATE TABLE IF NOT EXISTS public.deco_chat_views (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    icon TEXT NOT NULL,
    type TEXT NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add foreign key constraint to teams table
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'deco_chat_views_team_id_fkey'
    ) THEN
        ALTER TABLE public.deco_chat_views 
        ADD CONSTRAINT deco_chat_views_team_id_fkey 
        FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_deco_chat_views_team_id ON public.deco_chat_views(team_id);

-- Enable RLS
ALTER TABLE public.deco_chat_views ENABLE ROW LEVEL SECURITY;

-- Team views policies for managing team views
INSERT INTO "public"."policies" ("id", "created_at", "name", "statements", "description", "team_id") VALUES 
('64', '2025-01-23 12:28:12.000000+00', 'manage_team_views', ARRAY[
    '{"effect":"allow","resource":"TEAMS_ADD_VIEW"}'::jsonb,
    '{"effect":"allow","resource":"TEAMS_REMOVE_VIEW"}'::jsonb
], 'Allow users to add and remove custom views for teams', null)
ON CONFLICT (id) DO NOTHING;

-- Associate team views management policy with owner (1) and admin (4) roles only
-- Team views management is a sensitive operation that should be restricted
INSERT INTO "public"."role_policies" ("id", "created_at", "role_id", "policy_id") VALUES 
('343', '2025-01-23 12:28:12.000000+00', '1', '64'),
('344', '2025-01-23 12:28:12.000000+00', '4', '64')
ON CONFLICT (id) DO NOTHING;
