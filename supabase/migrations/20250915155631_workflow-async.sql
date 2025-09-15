-- SANDBOX WORKFLOW async execution policies - add missing async workflow tools to existing policies
-- Add async workflow execution tools to the existing view_sandbox_workflows policy
UPDATE "public"."policies" 
SET "statements" = array_append("statements", '{"effect":"allow","resource":"SANDBOX_START_WORKFLOW"}'::jsonb)
WHERE "id" = '74' AND "name" = 'view_sandbox_workflows';

UPDATE "public"."policies" 
SET "statements" = array_append("statements", '{"effect":"allow","resource":"SANDBOX_GET_WORKFLOW_STATUS"}'::jsonb)
WHERE "id" = '74' AND "name" = 'view_sandbox_workflows';

UPDATE "public"."policies" 
SET "statements" = array_append("statements", '{"effect":"allow","resource":"SANDBOX_REPLAY_WORKFLOW_FROM_STEP"}'::jsonb)
WHERE "id" = '74' AND "name" = 'view_sandbox_workflows';
