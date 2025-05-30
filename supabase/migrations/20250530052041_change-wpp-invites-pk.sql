-- Change primary key of deco_chat_wpp_invites from (phone, trigger_id) to wpp_message_id (idempotent)

-- First, check if the current primary key exists and drop it
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'deco_chat_wpp_invites_pkey'
    AND table_name = 'deco_chat_wpp_invites'
    AND constraint_type = 'PRIMARY KEY'
  ) THEN
    -- Check if the current primary key is on (phone, trigger_id)
    IF EXISTS (
      SELECT 1 FROM information_schema.key_column_usage kcu
      JOIN information_schema.table_constraints tc ON kcu.constraint_name = tc.constraint_name
      WHERE tc.table_name = 'deco_chat_wpp_invites'
      AND tc.constraint_type = 'PRIMARY KEY'
      AND kcu.column_name IN ('phone', 'trigger_id')
    ) THEN
      ALTER TABLE deco_chat_wpp_invites DROP CONSTRAINT deco_chat_wpp_invites_pkey;
    END IF;
  END IF;
END $$;

-- Add the new primary key on wpp_message_id if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'deco_chat_wpp_invites_pkey'
    AND table_name = 'deco_chat_wpp_invites'
    AND constraint_type = 'PRIMARY KEY'
  ) THEN
    ALTER TABLE deco_chat_wpp_invites ADD PRIMARY KEY (wpp_message_id);
  END IF;
END $$;

-- Add unique constraint on (phone, trigger_id) to maintain data integrity
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'deco_chat_wpp_invites_phone_trigger_id_unique'
    AND table_name = 'deco_chat_wpp_invites'
  ) THEN
    ALTER TABLE deco_chat_wpp_invites 
    ADD CONSTRAINT deco_chat_wpp_invites_phone_trigger_id_unique 
    UNIQUE (phone, trigger_id);
  END IF;
END $$;
