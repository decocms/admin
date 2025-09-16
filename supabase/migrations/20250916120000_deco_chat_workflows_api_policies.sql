-- Workflow API policies for managing workflow creation, execution, and monitoring
INSERT INTO "public"."policies" ("id", "created_at", "name", "statements", "description", "team_id") VALUES 
('76', '2025-09-16 12:00:00.000000+00', 'view_workflows_api', ARRAY[
    '{"effect":"allow","resource":"WORKFLOWS_GET"}'::jsonb,
    '{"effect":"allow","resource":"WORKFLOWS_LIST"}'::jsonb,
    '{"effect":"allow","resource":"WORKFLOWS_GET_STATUS"}'::jsonb
], 'Allow users to view workflow definitions and execution status', null),
('77', '2025-09-16 12:00:00.000000+00', 'manage_workflows_api', ARRAY[
    '{"effect":"allow","resource":"WORKFLOWS_UPSERT"}'::jsonb,
    '{"effect":"allow","resource":"WORKFLOWS_START"}'::jsonb,
    '{"effect":"allow","resource":"WORKFLOWS_DELETE"}'::jsonb,
    '{"effect":"allow","resource":"WORKFLOWS_REPLAY_FROM_STEP"}'::jsonb
], 'Allow users to create, execute, delete, and replay workflows', null)
ON CONFLICT (id) DO NOTHING;

-- Associate workflow view policy with all roles (1=owner, 3=member, 4=admin)
INSERT INTO "public"."role_policies" ("id", "created_at", "role_id", "policy_id") VALUES 
('396', '2025-09-16 12:00:00.000000+00', '1', '76'),
('397', '2025-09-16 12:00:00.000000+00', '3', '76'),
('398', '2025-09-16 12:00:00.000000+00', '4', '76')
ON CONFLICT (id) DO NOTHING;

-- Associate workflow management policy with owner (1) and admin (4)
-- Workflow creation and execution are powerful operations requiring elevated permissions
INSERT INTO "public"."role_policies" ("id", "created_at", "role_id", "policy_id") VALUES 
('399', '2025-09-16 12:00:00.000000+00', '1', '77'),
('400', '2025-09-16 12:00:00.000000+00', '4', '77')
ON CONFLICT (id) DO NOTHING; 