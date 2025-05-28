-- Create the ENUM type for visibility
-- this is "CREATE IF NOT EXISTS" for TYPE
DO $$ BEGIN
    CREATE TYPE visibility_type AS ENUM ('PUBLIC', 'WORKSPACE', 'PRIVATE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
-- Add the visibility column to the projects table
ALTER TABLE deco_chat_agents
ADD COLUMN IF NOT EXISTS visibility visibility_type NOT NULL DEFAULT 'WORKSPACE';
