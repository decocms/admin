-- Prompt policies for listing, viewing, and managing prompts
INSERT INTO "public"."policies" ("id", "name", "statements", "description") VALUES 
('60', 'view_prompt', ARRAY[
    '{"effect":"allow","resource":"PROMPTS_LIST"}'::jsonb,
    '{"effect":"allow","resource":"PROMPTS_GET"}'::jsonb,
    '{"effect":"allow","resource":"PROMPTS_SEARCH"}'::jsonb
], 'Allow users to list, view, and search prompts'),
('61', 'manage_prompt', ARRAY[
    '{"effect":"allow","resource":"PROMPTS_CREATE"}'::jsonb,
    '{"effect":"allow","resource":"PROMPTS_UPDATE"}'::jsonb,
    '{"effect":"allow","resource":"PROMPTS_DELETE"}'::jsonb
], 'Allow users to create, update, and delete prompts')
ON CONFLICT (id) DO NOTHING;

-- Associate prompt view policy with all roles (1, 3, 4)
INSERT INTO "public"."role_policies" ("id", "role_id", "policy_id") VALUES 
('320', '1', '60'),
('321', '3', '60'),
('322', '4', '60')
ON CONFLICT (id) DO NOTHING;

-- Associate prompt management policy with owner (1) and admin (4)
INSERT INTO "public"."role_policies" ("id", "role_id", "policy_id") VALUES 
('323', '1', '61'),
('324', '4', '61')
ON CONFLICT (id) DO NOTHING;
