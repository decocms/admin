DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'teams' AND column_name = 'theme'
  ) THEN
    alter table teams add column theme jsonb;
  END IF;
END $$;