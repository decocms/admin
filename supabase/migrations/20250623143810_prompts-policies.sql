-- Prompt policies for listing, viewing, and managing prompts
INSERT INTO "public"."policies" ("id", "created_at", "name", "statements", "description", "team_id") VALUES 
('60', '2025-06-23 14:38:10.000000+00', 'view_prompt', ARRAY[
    '{"effect":"allow","resource":"PROMPTS_LIST"}'::jsonb,
    '{"effect":"allow","resource":"PROMPTS_GET"}'::jsonb,
    '{"effect":"allow","resource":"PROMPTS_SEARCH"}'::jsonb
], 'Allow users to list, view, and search prompts', null),
('61', '2025-06-23 14:38:10.000000+00', 'manage_prompt', ARRAY[
    '{"effect":"allow","resource":"PROMPTS_CREATE"}'::jsonb,
    '{"effect":"allow","resource":"PROMPTS_UPDATE"}'::jsonb,
    '{"effect":"allow","resource":"PROMPTS_DELETE"}'::jsonb
], 'Allow users to create, update, and delete prompts', null)
ON CONFLICT (id) DO NOTHING;

-- Associate prompt view policy with all roles (1, 3, 4)
INSERT INTO "public"."role_policies" ("id", "created_at", "role_id", "policy_id") VALUES 
('320', '2025-06-23 14:38:10.000000+00', '1', '60'),
('321', '2025-06-23 14:38:10.000000+00', '3', '60'),
('322', '2025-06-23 14:38:10.000000+00', '4', '60')
ON CONFLICT (id) DO NOTHING;

-- Associate prompt management policy with owner (1) and admin (4)
INSERT INTO "public"."role_policies" ("id", "created_at", "role_id", "policy_id") VALUES 
('323', '2025-06-23 14:38:10.000000+00', '1', '61'),
('324', '2025-06-23 14:38:10.000000+00', '4', '61')
ON CONFLICT (id) DO NOTHING;
