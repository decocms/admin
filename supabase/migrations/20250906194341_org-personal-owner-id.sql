alter table teams add column if not exists personal_owner_id uuid null;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_type = 'FOREIGN KEY'
          AND table_name = 'teams'
          AND constraint_name = 'teams_personal_owner_id_fkey'
    ) THEN
        ALTER TABLE teams
        ADD CONSTRAINT teams_personal_owner_id_fkey
        FOREIGN KEY (personal_owner_id)
        REFERENCES profiles (user_id);
    END IF;
END
$$;