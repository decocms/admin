-- Create the ENUM type for visibility
CREATE TYPE visibility_type AS ENUM ('PUBLIC', 'WORKSPACE', 'PRIVATE');

-- Add the visibility column to the projects table
ALTER TABLE deco_chat_agents
ADD COLUMN visibility visibility_type NOT NULL DEFAULT 'WORKSPACE';