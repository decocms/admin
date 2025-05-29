-- Create WhatsApp policies
INSERT INTO "public"."policies" ("id", "created_at", "name", "statements", "description", "team_id") VALUES 
('48', '2025-05-29 23:44:48.000000+00', 'view_whatsapp_users', ARRAY[
    '{"effect":"allow","resource":"WHATSAPP_GET_USER"}'::jsonb
], 'Allow users to view WhatsApp user information', null),
('49', '2025-05-29 23:44:48.000000+00', 'manage_whatsapp_users', ARRAY[
    '{"effect":"allow","resource":"WHATSAPP_SEND_TEMPLATE_MESSAGE"}'::jsonb,
    '{"effect":"allow","resource":"WHATSAPP_CREATE_INVITE"}'::jsonb,
    '{"effect":"allow","resource":"WHATSAPP_UPSERT_USER"}'::jsonb
], 'Allow users to manage WhatsApp messages and users', null)
ON CONFLICT (id) DO NOTHING;

-- Associate WhatsApp view policy with all roles (1, 3, 4)
INSERT INTO "public"."role_policies" ("id", "created_at", "role_id", "policy_id") VALUES 
('300', '2025-05-29 23:44:48.000000+00', '1', '48'),
('301', '2025-05-29 23:44:48.000000+00', '3', '48'),
('302', '2025-05-29 23:44:48.000000+00', '4', '48')
ON CONFLICT (id) DO NOTHING;

-- Associate WhatsApp management policy with owner role (1) only
INSERT INTO "public"."role_policies" ("id", "created_at", "role_id", "policy_id") VALUES 
('303', '2025-05-29 23:44:48.000000+00', '1', '49'),
('304', '2025-05-29 23:44:48.000000+00', '4', '49')
ON CONFLICT (id) DO NOTHING;
