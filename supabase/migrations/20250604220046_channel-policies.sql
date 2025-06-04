-- Channel policies for listing, viewing, and managing channels
INSERT INTO "public"."policies" ("id", "created_at", "name", "statements", "description", "team_id") VALUES 
('50', '2025-06-04 22:00:46.000000+00', 'view_channel', ARRAY[
    '{"effect":"allow","resource":"CHANNELS_LIST"}'::jsonb,
    '{"effect":"allow","resource":"CHANNELS_GET"}'::jsonb
], 'Allow users to list and view channels', null),
('51', '2025-06-04 22:00:46.000000+00', 'manage_channel', ARRAY[
    '{"effect":"allow","resource":"CHANNELS_CREATE"}'::jsonb,
    '{"effect":"allow","resource":"CHANNELS_LINK"}'::jsonb,
    '{"effect":"allow","resource":"CHANNELS_UNLINK"}'::jsonb,
    '{"effect":"allow","resource":"CHANNELS_ACTIVATE"}'::jsonb,
    '{"effect":"allow","resource":"CHANNELS_DEACTIVATE"}'::jsonb,
    '{"effect":"allow","resource":"CHANNELS_DELETE"}'::jsonb
], 'Allow users to create, link, unlink, activate, deactivate, and delete channels', null)
ON CONFLICT (id) DO NOTHING;

-- Associate channel view policy with all roles (1, 3, 4)
INSERT INTO "public"."role_policies" ("id", "created_at", "role_id", "policy_id") VALUES 
('305', '2025-06-04 22:00:46.000000+00', '1', '50'),
('306', '2025-06-04 22:00:46.000000+00', '3', '50'),
('307', '2025-06-04 22:00:46.000000+00', '4', '50')
ON CONFLICT (id) DO NOTHING;

-- Associate channel management policy with owner (1) and admin (4)
INSERT INTO "public"."role_policies" ("id", "created_at", "role_id", "policy_id") VALUES 
('308', '2025-06-04 22:00:46.000000+00', '1', '51'),
('309', '2025-06-04 22:00:46.000000+00', '4', '51')
ON CONFLICT (id) DO NOTHING;
