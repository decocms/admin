--- Project Secrets policies for viewing and managing encrypted secrets
INSERT INTO "public"."policies" ("id", "created_at", "name", "statements", "description", "team_id") VALUES 
('80', '2025-11-18 00:00:01.000000+00', 'view_secrets', ARRAY[
    '{"effect":"allow","resource":"SECRETS_LIST"}'::jsonb,
    '{"effect":"allow","resource":"SECRETS_READ"}'::jsonb
], 'Allow users to view and read project secrets', null),
('81', '2025-11-18 00:00:01.000000+00', 'manage_secrets', ARRAY[
    '{"effect":"allow","resource":"SECRETS_CREATE"}'::jsonb,
    '{"effect":"allow","resource":"SECRETS_UPDATE"}'::jsonb,
    '{"effect":"allow","resource":"SECRETS_DELETE"}'::jsonb
], 'Allow users to create, update and delete project secrets', null)
ON CONFLICT (id) DO NOTHING;

--- Associate secrets view policy with all roles (1=owner, 3=member, 4=admin)
--- All team members should be able to view secrets (metadata) and read secret values
INSERT INTO "public"."role_policies" ("id", "created_at", "role_id", "policy_id") VALUES 
('404', '2025-11-18 00:00:01.000000+00', '1', '80'),
('405', '2025-11-18 00:00:01.000000+00', '3', '80'),
('406', '2025-11-18 00:00:01.000000+00', '4', '80')
ON CONFLICT (id) DO NOTHING;

--- Associate secrets management policy with owner (1) and admin (4) roles only
--- Creating, updating, and deleting secrets are sensitive operations requiring elevated permissions
INSERT INTO "public"."role_policies" ("id", "created_at", "role_id", "policy_id") VALUES 
('407', '2025-11-18 00:00:01.000000+00', '1', '81'),
('408', '2025-11-18 00:00:01.000000+00', '4', '81')
ON CONFLICT (id) DO NOTHING;

