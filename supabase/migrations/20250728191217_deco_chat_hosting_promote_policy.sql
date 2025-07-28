-- Hosting App Promote policies for promoting deployments to route patterns
INSERT INTO "public"."policies" ("id", "created_at", "name", "statements", "description", "team_id") VALUES 
('67', '2025-01-28 19:12:17.000000+00', 'manage_hosting_app_promote', ARRAY[
    '{"effect":"allow","resource":"HOSTING_APPS_PROMOTE"}'::jsonb
], 'Allow users to promote hosting app deployments to route patterns', null)
ON CONFLICT (id) DO NOTHING;

-- Associate hosting app promote policy with owner and admin roles (1=owner, 4=admin)
-- Promotion is a deployment management action that requires elevated permissions
INSERT INTO "public"."role_policies" ("id", "created_at", "role_id", "policy_id") VALUES 
('351', '2025-01-28 19:12:17.000000+00', '1', '67'),
('352', '2025-01-28 19:12:17.000000+00', '4', '67')
ON CONFLICT (id) DO NOTHING;
