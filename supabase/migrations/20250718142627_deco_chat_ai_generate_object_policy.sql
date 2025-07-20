-- AI Generate Object policies for structured object generation
INSERT INTO "public"."policies" ("id", "created_at", "name", "statements", "description", "team_id") VALUES 
('63', '2025-01-18 14:26:27.000000+00', 'use_ai_generate_object', ARRAY[
    '{"effect":"allow","resource":"AI_GENERATE_OBJECT"}'::jsonb
], 'Allow users to generate structured objects using AI models with JSON schema validation', null)
ON CONFLICT (id) DO NOTHING;

-- Associate AI generate object policy with all roles (1=owner, 3=member, 4=admin)
-- AI object generation is a core functionality that should be available to all workspace members
INSERT INTO "public"."role_policies" ("id", "created_at", "role_id", "policy_id") VALUES 
('340', '2025-01-18 14:26:27.000000+00', '1', '63'),
('341', '2025-01-18 14:26:27.000000+00', '3', '63'),
('342', '2025-01-18 14:26:27.000000+00', '4', '63')
ON CONFLICT (id) DO NOTHING;
