-- API Keys policies for listing, viewing, and managing API keys
INSERT INTO "public"."policies" ("id", "created_at", "name", "statements", "description", "team_id") VALUES 
('52', '2025-06-26 15:10:35.000000+00', 'view_api_keys', ARRAY[
    '{"effect":"allow","resource":"API_KEYS_LIST"}'::jsonb,
    '{"effect":"allow","resource":"API_KEYS_GET"}'::jsonb,
    '{"effect":"allow","resource":"API_KEYS_VALIDATE"}'::jsonb
], 'Allow users to list, view, and validate API keys', null),
('53', '2025-06-26 15:10:35.000000+00', 'manage_api_keys', ARRAY[
    '{"effect":"allow","resource":"API_KEYS_CREATE"}'::jsonb,
    '{"effect":"allow","resource":"API_KEYS_UPDATE"}'::jsonb,
    '{"effect":"allow","resource":"API_KEYS_DELETE"}'::jsonb,
    '{"effect":"allow","resource":"API_KEYS_ENABLE"}'::jsonb,
    '{"effect":"allow","resource":"API_KEYS_DISABLE"}'::jsonb
], 'Allow users to create, update, delete, enable, and disable API keys', null)
ON CONFLICT (id) DO NOTHING;

-- Associate API keys view policy with all roles (1, 3, 4)
INSERT INTO "public"."role_policies" ("id", "created_at", "role_id", "policy_id") VALUES 
('310', '2025-06-26 15:10:35.000000+00', '1', '52'),
('311', '2025-06-26 15:10:35.000000+00', '3', '52'),
('312', '2025-06-26 15:10:35.000000+00', '4', '52')
ON CONFLICT (id) DO NOTHING;

-- Associate API keys management policy with owner (1) and admin (4)
INSERT INTO "public"."role_policies" ("id", "created_at", "role_id", "policy_id") VALUES 
('313', '2025-06-26 15:10:35.000000+00', '1', '53'),
('314', '2025-06-26 15:10:35.000000+00', '4', '53')
ON CONFLICT (id) DO NOTHING;
