-- DECONFIG policies for viewing and managing versioned configuration branches and files
INSERT INTO "public"."policies" ("id", "created_at", "name", "statements", "description", "team_id") VALUES 
('70', '2025-09-10 12:00:00.000000+00', 'view_deconfig', ARRAY[
    '{"effect":"allow","resource":"LIST_BRANCHES"}'::jsonb,
    '{"effect":"allow","resource":"READ_FILE"}'::jsonb,
    '{"effect":"allow","resource":"LIST_FILES"}'::jsonb,
    '{"effect":"allow","resource":"DIFF_BRANCH"}'::jsonb
], 'Allow users to view DECONFIG branches, files, and compare branches', null),
('71', '2025-09-10 12:00:00.000000+00', 'manage_deconfig', ARRAY[
    '{"effect":"allow","resource":"CREATE_BRANCH"}'::jsonb,
    '{"effect":"allow","resource":"DELETE_BRANCH"}'::jsonb,
    '{"effect":"allow","resource":"MERGE_BRANCH"}'::jsonb,
    '{"effect":"allow","resource":"PUT_FILE"}'::jsonb,
    '{"effect":"allow","resource":"DELETE_FILE"}'::jsonb
], 'Allow users to create, delete, and merge branches, and modify files in DECONFIG', null)
ON CONFLICT (id) DO NOTHING;

-- Associate DECONFIG view policy with all roles (1=owner, 3=member, 4=admin)
INSERT INTO "public"."role_policies" ("id", "created_at", "role_id", "policy_id") VALUES 
('381', '2025-09-10 12:00:00.000000+00', '1', '70'),
('383', '2025-09-10 12:00:00.000000+00', '3', '70'),
('384', '2025-09-10 12:00:00.000000+00', '4', '70')
ON CONFLICT (id) DO NOTHING;

-- Associate DECONFIG management policy with owner (1) and admin (4)
-- DECONFIG operations can affect configuration and deployment, requiring elevated permissions
INSERT INTO "public"."role_policies" ("id", "created_at", "role_id", "policy_id") VALUES 
('382', '2025-09-10 12:00:00.000000+00', '1', '71'),
('385', '2025-09-10 12:00:00.000000+00', '4', '71')
ON CONFLICT (id) DO NOTHING; 