INSERT INTO "public"."policies" ("id", "created_at", "name", "statements", "description", "team_id") VALUES 
('44', '2025-05-26 16:35:07.000000+00', 'view_wallet', ARRAY[
    '{"effect":"allow","resource":"GET_WALLET_ACCOUNT"}'::jsonb,
    '{"effect":"allow","resource":"GET_THREADS_USAGE"}'::jsonb,
    '{"effect":"allow","resource":"GET_AGENTS_USAGE"}'::jsonb,
    '{"effect":"allow","resource":"GET_WORKSPACE_PLAN"}'::jsonb
], 'Allow users to view wallet account and usage information', null),
('45', '2025-05-26 16:35:07.000000+00', 'manage_wallet', ARRAY[
    '{"effect":"allow","resource":"CREATE_CHECKOUT_SESSION"}'::jsonb,
    '{"effect":"allow","resource":"REDEEM_WALLET_VOUCHER"}'::jsonb,
    '{"effect":"allow","resource":"CREATE_WALLET_VOUCHER"}'::jsonb
], 'Allow users to manage wallet transactions and vouchers', null)
ON CONFLICT (id) DO NOTHING;
-- Associate wallet view policy with all roles (1, 3, 4)
INSERT INTO "public"."role_policies" ("id", "created_at", "role_id", "policy_id") VALUES 
('289', '2025-05-26 16:35:07.000000+00', '1', '44'),
('290', '2025-05-26 16:35:07.000000+00', '3', '44'),
('291', '2025-05-26 16:35:07.000000+00', '4', '44')
ON CONFLICT (id) DO NOTHING;
-- Associate wallet management policy with owner role (1) only
INSERT INTO "public"."role_policies" ("id", "created_at", "role_id", "policy_id") VALUES 
('292', '2025-05-26 16:35:07.000000+00', '1', '45')
ON CONFLICT (id) DO NOTHING;
