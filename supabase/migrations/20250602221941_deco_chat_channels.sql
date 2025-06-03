CREATE TABLE IF NOT EXISTS deco_chat_channels(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  discriminator TEXT NOT NULL,
  agent_id uuid,
  integration_id uuid NOT NULL,
  workspace TEXT NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz, -- for soft deletes
  active boolean NOT NULL DEFAULT true,
  name text NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_channels_workspace
  ON deco_chat_channels (workspace);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'deco_chat_channels_agent_id_fkey'
    AND table_name = 'deco_chat_channels'
  ) THEN
    ALTER TABLE deco_chat_channels
    ADD CONSTRAINT deco_chat_channels_agent_id_fkey
    FOREIGN KEY (agent_id) REFERENCES deco_chat_agents(id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'deco_chat_channels_integration_id_fkey'
    AND table_name = 'deco_chat_channels'
  ) THEN
    ALTER TABLE deco_chat_channels
    ADD CONSTRAINT deco_chat_channels_integration_id_fkey
    FOREIGN KEY (integration_id) REFERENCES deco_chat_integrations(id);
  END IF;
END $$;

ALTER TABLE deco_chat_channels ENABLE ROW LEVEL SECURITY;

ALTER TABLE deco_chat_channels
ADD CONSTRAINT unique_discriminator_integration UNIQUE (discriminator, integration_id);