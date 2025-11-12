-- Enable Row Level Security on deco_chat_onboarding and add policies

-- 1) Ensure the table exists before applying RLS (safe-guard)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'deco_chat_onboarding'
  ) THEN
    RAISE EXCEPTION 'Table public.deco_chat_onboarding does not exist';
  END IF;
END
$$;

-- 2) Enable RLS
ALTER TABLE public.deco_chat_onboarding ENABLE ROW LEVEL SECURITY;

-- 3) Drop existing policies if they exist (idempotency)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'deco_chat_onboarding'
      AND policyname = 'allow_select_own_onboarding'
  ) THEN
    DROP POLICY "allow_select_own_onboarding" ON public.deco_chat_onboarding;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'deco_chat_onboarding'
      AND policyname = 'allow_insert_own_onboarding'
  ) THEN
    DROP POLICY "allow_insert_own_onboarding" ON public.deco_chat_onboarding;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'deco_chat_onboarding'
      AND policyname = 'allow_update_own_onboarding'
  ) THEN
    DROP POLICY "allow_update_own_onboarding" ON public.deco_chat_onboarding;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'deco_chat_onboarding'
      AND policyname = 'allow_delete_own_onboarding'
  ) THEN
    DROP POLICY "allow_delete_own_onboarding" ON public.deco_chat_onboarding;
  END IF;
END
$$;

-- 4) Recreate policies
-- Select: users can read only their own onboarding record
CREATE POLICY "allow_select_own_onboarding"
ON public.deco_chat_onboarding
FOR SELECT
USING (auth.uid() = user_id);

-- Insert: users can create their own onboarding record
CREATE POLICY "allow_insert_own_onboarding"
ON public.deco_chat_onboarding
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Update: users can update only their own onboarding record
CREATE POLICY "allow_update_own_onboarding"
ON public.deco_chat_onboarding
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- (Optional) Delete: users can delete only their own onboarding record
CREATE POLICY "allow_delete_own_onboarding"
ON public.deco_chat_onboarding
FOR DELETE
USING (auth.uid() = user_id);


