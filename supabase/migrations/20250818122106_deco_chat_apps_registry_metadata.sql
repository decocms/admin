-- Add metadata column to deco_chat_apps_registry table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'deco_chat_apps_registry' 
        AND column_name = 'metadata'
    ) THEN
        ALTER TABLE public.deco_chat_apps_registry 
        ADD COLUMN metadata jsonb;
    END IF;
END $$;
