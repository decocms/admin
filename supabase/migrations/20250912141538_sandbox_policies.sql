-- SANDBOX policies for viewing and managing sandbox tools and functions
INSERT INTO "public"."policies" ("id", "created_at", "name", "statements", "description", "team_id") VALUES 
('72', '2025-09-12 14:15:38.000000+00', 'view_sandbox', ARRAY[
    '{"effect":"allow","resource":"SANDBOX_GET_TOOL"}'::jsonb,
    '{"effect":"allow","resource":"SANDBOX_LIST_TOOLS"}'::jsonb,
    '{"effect":"allow","resource":"SANDBOX_RUN_TOOL"}'::jsonb
], 'Allow users to view, list, and run sandbox tools', null),
('73', '2025-09-12 14:15:38.000000+00', 'manage_sandbox', ARRAY[
    '{"effect":"allow","resource":"SANDBOX_UPSERT_TOOL"}'::jsonb,
    '{"effect":"allow","resource":"SANDBOX_DELETE_TOOL"}'::jsonb
], 'Allow users to create, update, and delete sandbox tools', null)
ON CONFLICT (id) DO NOTHING;

-- Associate SANDBOX view policy with all roles (1=owner, 3=member, 4=admin)
INSERT INTO "public"."role_policies" ("id", "created_at", "role_id", "policy_id") VALUES 
('386', '2025-09-12 14:15:38.000000+00', '1', '72'),
('387', '2025-09-12 14:15:38.000000+00', '3', '72'),
('388', '2025-09-12 14:15:38.000000+00', '4', '72')
ON CONFLICT (id) DO NOTHING;

-- Associate SANDBOX management policy with owner (1) and admin (4)
-- SANDBOX operations can execute arbitrary code and affect system behavior, requiring elevated permissions
INSERT INTO "public"."role_policies" ("id", "created_at", "role_id", "policy_id") VALUES 
('389', '2025-09-12 14:15:38.000000+00', '1', '73'),
('390', '2025-09-12 14:15:38.000000+00', '4', '73')
ON CONFLICT (id) DO NOTHING;
