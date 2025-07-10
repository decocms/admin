-- Add new columns to deco_chat_assets table
ALTER TABLE public.deco_chat_assets 
ADD COLUMN IF NOT EXISTS index_name TEXT,
ADD COLUMN IF NOT EXISTS path TEXT,
ADD COLUMN IF NOT EXISTS doc_ids TEXT[],
ADD COLUMN IF NOT EXISTS filename TEXT;

-- Create index on index_name for better query performance
CREATE INDEX IF NOT EXISTS idx_deco_chat_assets_index_name ON public.deco_chat_assets(index_name);
CREATE INDEX IF NOT EXISTS idx_deco_chat_assets_workspace_index_name ON public.deco_chat_assets(workspace, index_name);
