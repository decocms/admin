-- Database policies for running SQL queries
INSERT INTO "public"."policies" ("id", "created_at", "name", "statements", "description", "team_id") VALUES 
('54', '2025-07-01 17:05:47.000000+00', 'run_database_sql', ARRAY[
    '{"effect":"allow","resource":"DATABASES_RUN_SQL"}'::jsonb
], 'Allow users to run SQL queries against the workspace database', null)
ON CONFLICT (id) DO NOTHING;

-- Associate database SQL policy with owner (1) and admin (4) roles only for security
INSERT INTO "public"."role_policies" ("id", "created_at", "role_id", "policy_id") VALUES 
('315', '2025-07-01 17:05:47.000000+00', '1', '54'),
('316', '2025-07-01 17:05:47.000000+00', '4', '54')
ON CONFLICT (id) DO NOTHING;
