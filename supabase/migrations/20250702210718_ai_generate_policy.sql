-- API Keys policies for listing, viewing, and managing API keys
INSERT INTO "public"."policies" ("id", "created_at", "name", "statements", "description", "team_id") VALUES 
('62', '2025-07-02 21:07:18.000000+00', 'call_ai_gateway', ARRAY[
    '{"effect":"allow","resource":"AI_GENERATE"}'::jsonb
], 'Allow users to call the AI Gateway', null)
ON CONFLICT (id) DO NOTHING;

-- Associate AI Gateway policy with all roles (1, 3, 4)
INSERT INTO "public"."role_policies" ("id", "created_at", "role_id", "policy_id") VALUES 
('325', '2025-07-02 21:07:18.000000+00', '1', '62'),
('326', '2025-07-02 21:07:18.000000+00', '3', '62'),
('327', '2025-07-02 21:07:18.000000+00', '4', '62')
ON CONFLICT (id) DO NOTHING;
