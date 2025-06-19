-- Add the spaces column to the agents table for storing saved tab/dock arrangements
ALTER TABLE deco_chat_agents
ADD COLUMN IF NOT EXISTS spaces JSONB DEFAULT NULL;

-- Add a comment to document the column purpose
COMMENT ON COLUMN deco_chat_agents.spaces IS 'Saved spaces (tab/dock arrangements) for this agent. Each space contains title, viewSetup, and theme configuration.';