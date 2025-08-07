-- Contract policies for managing contract authorization and settlement
INSERT INTO "public"."policies" ("id", "created_at", "name", "statements", "description", "team_id") VALUES 
('69', '2025-01-29 12:00:00.000000+00', 'manage_contract_transactions', ARRAY[
    '{"effect":"allow","resource":"CONTRACT_AUTHORIZE"}'::jsonb,
    '{"effect":"allow","resource":"CONTRACT_SETTLE"}'::jsonb
], 'Allow users to authorize and settle contract transactions', null)
ON CONFLICT (id) DO NOTHING;

-- Associate contract transaction policy with owner and admin roles (1=owner, 4=admin)
-- Contract authorization and settlement are financial operations requiring elevated permissions
INSERT INTO "public"."role_policies" ("id", "created_at", "role_id", "policy_id") VALUES 
('355', '2025-01-29 12:00:00.000000+00', '1', '69'),
('356', '2025-01-29 12:00:00.000000+00', '4', '69')
ON CONFLICT (id) DO NOTHING;
