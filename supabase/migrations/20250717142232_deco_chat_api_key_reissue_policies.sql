-- API Key reissue policies for managing API key reissuance
INSERT INTO "public"."policies" ("id", "created_at", "name", "statements", "description", "team_id") VALUES 
('59', '2025-01-17 14:22:32.000000+00', 'manage_api_key_reissue', ARRAY[
    '{"effect":"allow","resource":"API_KEYS_REISSUE"}'::jsonb
], 'Allow users to reissue API keys with new claims', null)
ON CONFLICT (id) DO NOTHING;

-- Associate API key reissue policy with owner (1) and admin (4) roles only
-- API key reissuance is a sensitive security operation that should be restricted
INSERT INTO "public"."role_policies" ("id", "created_at", "role_id", "policy_id") VALUES 
('338', '2025-01-17 14:22:32.000000+00', '1', '59'),
('339', '2025-01-17 14:22:32.000000+00', '4', '59')
ON CONFLICT (id) DO NOTHING;
