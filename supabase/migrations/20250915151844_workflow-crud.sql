-- SANDBOX WORKFLOW policies for viewing and managing workflow tools
INSERT INTO "public"."policies" ("id", "created_at", "name", "statements", "description", "team_id") VALUES 
('74', '2025-09-15 15:18:44.000000+00', 'view_sandbox_workflows', ARRAY[
    '{"effect":"allow","resource":"SANDBOX_GET_WORKFLOW"}'::jsonb,
    '{"effect":"allow","resource":"SANDBOX_LIST_WORKFLOWS"}'::jsonb,
    '{"effect":"allow","resource":"SANDBOX_RUN_WORKFLOW"}'::jsonb
], 'Allow users to view, list, and run sandbox workflows', null),
('75', '2025-09-15 15:18:44.000000+00', 'manage_sandbox_workflows', ARRAY[
    '{"effect":"allow","resource":"SANDBOX_UPSERT_WORKFLOW"}'::jsonb,
    '{"effect":"allow","resource":"SANDBOX_DELETE_WORKFLOW"}'::jsonb
], 'Allow users to create, update, and delete sandbox workflows', null)
ON CONFLICT (id) DO NOTHING;

-- Associate SANDBOX WORKFLOW view policy with all roles (1=owner, 3=member, 4=admin)
INSERT INTO "public"."role_policies" ("id", "created_at", "role_id", "policy_id") VALUES 
('391', '2025-09-15 15:18:44.000000+00', '1', '74'),
('392', '2025-09-15 15:18:44.000000+00', '3', '74'),
('393', '2025-09-15 15:18:44.000000+00', '4', '74')
ON CONFLICT (id) DO NOTHING;

-- Associate SANDBOX WORKFLOW management policy with owner (1) and admin (4)
-- SANDBOX WORKFLOW operations can execute arbitrary code and affect system behavior, requiring elevated permissions
INSERT INTO "public"."role_policies" ("id", "created_at", "role_id", "policy_id") VALUES 
('394', '2025-09-15 15:18:44.000000+00', '1', '75'),
('395', '2025-09-15 15:18:44.000000+00', '4', '75')
ON CONFLICT (id) DO NOTHING;
