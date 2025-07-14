-- Add status column to track asset processing state
-- Values:
-- - processing: Job currently being executed or will execute
-- - completed: Job finished successfully with results stored  
-- - failed: Job failed
ALTER TABLE "public"."deco_chat_assets" 
ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'completed' 
CHECK ("status" IN ('processing', 'completed', 'failed'));

-- Add comment to the column for documentation
COMMENT ON COLUMN "public"."deco_chat_assets"."status" IS 
'Asset processing status: processing (job executing/queued), completed (successful), failed (error occurred)';