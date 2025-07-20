-- OAuth policies for managing OAuth codes
INSERT INTO "public"."policies" ("id", "created_at", "name", "statements", "description", "team_id") VALUES 
('58', '2025-01-17 14:03:25.000000+00', 'manage_oauth_codes', ARRAY[
    '{"effect":"allow","resource":"OAUTH_CODE_CREATE"}'::jsonb
], 'Allow users to create OAuth codes for API keys', null)
ON CONFLICT (id) DO NOTHING;

-- Associate OAuth management policy with owner (1) and admin (4) roles only
-- OAuth code creation is a sensitive operation that should be restricted
INSERT INTO "public"."role_policies" ("id", "created_at", "role_id", "policy_id") VALUES 
('336', '2025-01-17 14:03:25.000000+00', '1', '58'),
('337', '2025-01-17 14:03:25.000000+00', '4', '58')
ON CONFLICT (id) DO NOTHING;