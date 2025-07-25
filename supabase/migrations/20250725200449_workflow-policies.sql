-- Hosting App Workflows List Names policies for viewing workflow names
INSERT INTO "public"."policies" ("id", "created_at", "name", "statements", "description", "team_id") VALUES 
('65', '2025-01-25 20:04:49.000000+00', 'view_hosting_app_workflows_list_names', ARRAY[
    '{"effect":"allow","resource":"HOSTING_APP_WORKFLOWS_LIST_NAMES"}'::jsonb
], 'Allow users to view hosting app workflow names for listing and selection purposes', null)
ON CONFLICT (id) DO NOTHING;

-- Associate hosting app workflows list names policy with all team roles (1=owner, 3=member, 4=admin)
-- Workflow listing is a basic functionality that should be available to all workspace members
INSERT INTO "public"."role_policies" ("id", "created_at", "role_id", "policy_id") VALUES 
('345', '2025-01-25 20:04:49.000000+00', '1', '65'),
('346', '2025-01-25 20:04:49.000000+00', '3', '65'),
('347', '2025-01-25 20:04:49.000000+00', '4', '65')
ON CONFLICT (id) DO NOTHING;
