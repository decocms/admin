INSERT INTO "public"."policies" ("id", "created_at", "name", "statements", "description", "team_id") VALUES 
('46', '2025-05-28 05:06:45.000000+00', 'view_models', ARRAY[
    '{"effect":"allow","resource":"MODELS_LIST"}'::jsonb,
    '{"effect":"allow","resource":"MODELS_GET"}'::jsonb
], 'Allow users to view and list models', null),
('47', '2025-05-28 05:06:45.000000+00', 'manage_models', ARRAY[
    '{"effect":"allow","resource":"MODELS_CREATE"}'::jsonb,
    '{"effect":"allow","resource":"MODELS_UPDATE"}'::jsonb,
    '{"effect":"allow","resource":"MODELS_DELETE"}'::jsonb
], 'Allow users to create, update and delete models', null)
ON CONFLICT (id) DO NOTHING;

-- Associate model view policy with all roles (1, 3, 4)
INSERT INTO "public"."role_policies" ("id", "created_at", "role_id", "policy_id") VALUES 
('293', '2025-05-28 05:06:45.000000+00', '1', '46'),
('294', '2025-05-28 05:06:45.000000+00', '3', '46'),
('295', '2025-05-28 05:06:45.000000+00', '4', '46')
ON CONFLICT (id) DO NOTHING;

-- Associate model management policy with owner role (1) and admin role (4)
INSERT INTO "public"."role_policies" ("id", "created_at", "role_id", "policy_id") VALUES 
('296', '2025-05-28 05:06:45.000000+00', '1', '47'),
('297', '2025-05-28 05:06:45.000000+00', '4', '47')
ON CONFLICT (id) DO NOTHING;
