-- WALLET CONTRACTS COMMITS policy for getting contract commit history
INSERT INTO "public"."policies" ("id", "created_at", "name", "statements", "description", "team_id") VALUES 
('79', '2025-10-12 00:00:00.000000+00', 'view_contracts_commits', ARRAY[
    '{"effect":"allow","resource":"GET_CONTRACTS_COMMITS"}'::jsonb
], 'Allow users to view wallet contracts commits history', null)
ON CONFLICT (id) DO NOTHING;

-- Associate contracts commits policy with all roles (1=owner, 3=member, 4=admin)
INSERT INTO "public"."role_policies" ("id", "created_at", "role_id", "policy_id") VALUES 
('402', '2025-10-12 00:00:00.000000+00', '1', '79'),
('403', '2025-10-12 00:00:00.000000+00', '3', '79'),
('404', '2025-10-12 00:00:00.000000+00', '4', '79')
ON CONFLICT (id) DO NOTHING;

