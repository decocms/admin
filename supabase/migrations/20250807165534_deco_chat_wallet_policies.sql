-- Wallet Pre-Authorization policies for managing pre-authorized amounts
INSERT INTO "public"."policies" ("id", "created_at", "name", "statements", "description", "team_id") VALUES 
('68', '2025-01-29 12:00:00.000000+00', 'manage_wallet_pre_auth', ARRAY[
    '{"effect":"allow","resource":"PRE_AUTHORIZE_AMOUNT"}'::jsonb,
    '{"effect":"allow","resource":"COMMIT_PRE_AUTHORIZED_AMOUNT"}'::jsonb
], 'Allow users to create and commit pre-authorized wallet amounts for transactions', null)
ON CONFLICT (id) DO NOTHING;

-- Associate wallet pre-authorization policy with owner and admin roles (1=owner, 4=admin)
-- Pre-authorization is a financial operation that requires elevated permissions
INSERT INTO "public"."role_policies" ("id", "created_at", "role_id", "policy_id") VALUES 
('353', '2025-01-29 12:00:00.000000+00', '1', '68'),
('354', '2025-01-29 12:00:00.000000+00', '4', '68')
ON CONFLICT (id) DO NOTHING; 