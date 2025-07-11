INSERT INTO "public"."policies" ("id", "created_at", "name", "statements", "description", "team_id") VALUES 
('55', '2025-07-09 16:12:40.000000+00', 'manage_registry_apps', ARRAY[
    '{"effect":"allow","resource":"REGISTRY_PUBLISH_APP"}'::jsonb
], 'Allow users to publish apps to registry', null),
('56', '2025-07-09 16:12:40.000000+00', 'view_registry_apps', ARRAY[
    '{"effect":"allow","resource":"REGISTRY_LIST_APPS"}'::jsonb
], 'Allow users to list registry apps', null),
('57', '2025-07-09 16:12:40.000000+00', 'view_registry_scopes', ARRAY[
    '{"effect":"allow","resource":"REGISTRY_LIST_SCOPES"}'::jsonb
], 'Allow users to list registry scopes', null)
ON CONFLICT (id) DO NOTHING;

INSERT INTO "public"."role_policies" ("id", "created_at", "role_id", "policy_id") VALUES 
('328', '2025-07-09 16:12:40.000000+00', '1', '56'),
('329', '2025-07-09 16:12:40.000000+00', '3', '56'),
('330', '2025-07-09 16:12:40.000000+00', '4', '56'),
('333', '2025-07-09 16:12:40.000000+00', '1', '57'),
('334', '2025-07-09 16:12:40.000000+00', '3', '57'),
('335', '2025-07-09 16:12:40.000000+00', '4', '57')
ON CONFLICT (id) DO NOTHING;

INSERT INTO "public"."role_policies" ("id", "created_at", "role_id", "policy_id") VALUES 
('331', '2025-07-09 16:12:40.000000+00', '1', '55'),
('332', '2025-07-09 16:12:40.000000+00', '4', '55')
ON CONFLICT (id) DO NOTHING;
