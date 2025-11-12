-- Create deco_chat_onboarding table for storing user onboarding answers
CREATE TABLE IF NOT EXISTS public.deco_chat_onboarding (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    company_size TEXT NOT NULL,
    use_case TEXT NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT deco_chat_onboarding_user_id_key UNIQUE (user_id)
);

-- Create index on user_id for faster lookups
CREATE INDEX IF NOT EXISTS deco_chat_onboarding_user_id_idx ON public.deco_chat_onboarding(user_id);

-- Add comment to table
COMMENT ON TABLE public.deco_chat_onboarding IS 'Stores user onboarding questionnaire answers';

