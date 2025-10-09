-- Integration API Key retrieval policies
INSERT INTO "public"."policies" ("id", "created_at", "name", "statements", "description", "team_id") VALUES 
('78', '2025-10-08 18:53:30.000000+00', 'get_integration_api_key', ARRAY[
    '{"effect":"allow","resource":"INTEGRATIONS_GET_API_KEY"}'::jsonb
], 'Allow users to retrieve API keys for integrations', null)
ON CONFLICT (id) DO NOTHING;

-- Associate integration API key retrieval policy with owner (1) and admin (4) roles only
-- Integration API key retrieval is a sensitive operation that should be restricted
INSERT INTO "public"."role_policies" ("id", "created_at", "role_id", "policy_id") VALUES 
('400', '2025-10-08 18:53:30.000000+00', '1', '78'),
('401', '2025-10-08 18:53:30.000000+00', '4', '78')
ON CONFLICT (id) DO NOTHING;

