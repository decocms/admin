-- Hosting App Deployments List policies for viewing app deployments
INSERT INTO "public"."policies" ("id", "created_at", "name", "statements", "description", "team_id") VALUES 
('66', '2025-01-28 16:25:24.000000+00', 'view_hosting_app_deployments_list', ARRAY[
    '{"effect":"allow","resource":"HOSTING_APP_DEPLOYMENTS_LIST"}'::jsonb
], 'Allow users to view hosting app deployments for listing and management purposes', null)
ON CONFLICT (id) DO NOTHING;

-- Associate hosting app deployments list policy with all team roles (1=owner, 3=member, 4=admin)
-- Deployment listing is a basic functionality that should be available to all workspace members
INSERT INTO "public"."role_policies" ("id", "created_at", "role_id", "policy_id") VALUES 
('348', '2025-01-28 16:25:24.000000+00', '1', '66'),
('349', '2025-01-28 16:25:24.000000+00', '3', '66'),
('350', '2025-01-28 16:25:24.000000+00', '4', '66')
ON CONFLICT (id) DO NOTHING;
