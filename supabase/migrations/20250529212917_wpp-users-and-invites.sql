-- Create permanent WhatsApp invites table (idempotent)
CREATE TABLE IF NOT EXISTS deco_chat_wpp_invites (
  accept_message TEXT NOT NULL,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  phone TEXT NOT NULL,
  trigger_id UUID NOT NULL,
  updated_at TIMESTAMPTZ,
  user_id UUID,
  wpp_message_id TEXT NOT NULL,
  
  -- Add primary key (assuming phone + trigger_id is unique)
  PRIMARY KEY (phone, trigger_id)
);

-- Create permanent WhatsApp users table (idempotent)
CREATE TABLE IF NOT EXISTS deco_chat_wpp_users (
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  phone TEXT NOT NULL PRIMARY KEY,
  trigger_id UUID,
  trigger_url TEXT NOT NULL,
  triggers TEXT[] NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ
);

-- Add foreign key constraints (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'deco_chat_wpp_invites_trigger_id_fkey'
    AND table_name = 'deco_chat_wpp_invites'
  ) THEN
    ALTER TABLE deco_chat_wpp_invites
    ADD CONSTRAINT deco_chat_wpp_invites_trigger_id_fkey
    FOREIGN KEY (trigger_id) REFERENCES deco_chat_triggers(id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'deco_chat_wpp_invites_user_id_fkey'
    AND table_name = 'deco_chat_wpp_invites'
  ) THEN
    ALTER TABLE deco_chat_wpp_invites
    ADD CONSTRAINT deco_chat_wpp_invites_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES profiles(user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'deco_chat_wpp_users_trigger_id_fkey'
    AND table_name = 'deco_chat_wpp_users'
  ) THEN
    ALTER TABLE deco_chat_wpp_users
    ADD CONSTRAINT deco_chat_wpp_users_trigger_id_fkey
    FOREIGN KEY (trigger_id) REFERENCES deco_chat_triggers(id);
  END IF;
END $$;

-- Add indexes for better performance (idempotent)
CREATE INDEX IF NOT EXISTS idx_deco_chat_wpp_invites_trigger_id ON deco_chat_wpp_invites(trigger_id);
CREATE INDEX IF NOT EXISTS idx_deco_chat_wpp_invites_user_id ON deco_chat_wpp_invites(user_id);
CREATE INDEX IF NOT EXISTS idx_deco_chat_wpp_invites_phone ON deco_chat_wpp_invites(phone);
CREATE INDEX IF NOT EXISTS idx_deco_chat_wpp_users_trigger_id ON deco_chat_wpp_users(trigger_id);
CREATE INDEX IF NOT EXISTS idx_deco_chat_wpp_users_phone ON deco_chat_wpp_users(phone); 