-- Add temperature column to deco_chat_agents table
ALTER TABLE deco_chat_agents
ADD COLUMN IF NOT EXISTS temperature DECIMAL(3,2) DEFAULT NULL CHECK (temperature >= 0.0 AND temperature <= 1.0);
