-- Add SANDBOX_UPSERT_WORKFLOW to the manage_sandbox policy
UPDATE "public"."policies" 
SET "statements" = array_append("statements", '{"effect":"allow","resource":"SANDBOX_UPSERT_WORKFLOW"}'::jsonb)
WHERE "id" = '73' AND "name" = 'manage_sandbox';
