INSERT INTO "public"."policies" ("id", "created_at", "name", "statements", "description", "team_id") VALUES 
('43', '2025-05-21 12:41:43.637203+00', 'view_knowledge', ARRAY[
    '{"effect":"allow","resource":"KNOWLEDGE_BASE_LIST"}'::jsonb,
    '{"effect":"allow","resource":"KNOWLEDGE_BASE_DELETE"}'::jsonb,
    '{"effect":"allow","resource":"KNOWLEDGE_BASE_CREATE"}'::jsonb,
    '{"effect":"allow","resource":"KNOWLEDGE_BASE_FORGET"}'::jsonb,
    '{"effect":"allow","resource":"KNOWLEDGE_BASE_REMEMBER"}'::jsonb,
    '{"effect":"allow","resource":"KNOWLEDGE_BASE_SEARCH"}'::jsonb
], 'Allow to read, search, create, delete, list knowledge base', null),
('42', '2025-05-20 18:23:58.316193+00', 'manage_file', ARRAY[
    '{"effect":"allow","resource":"FS_READ"}'::jsonb,
    '{"effect":"allow","resource":"FS_LIST"}'::jsonb,
    '{"effect":"allow","resource":"FS_WRITE"}'::jsonb,
    '{"effect":"allow","resource":"FS_READ_METADATA"}'::jsonb,
    '{"effect":"allow","resource":"FS_DELETE"}'::jsonb
], 'Allow users to list, read, write, delete files.', null),
('40', '2025-05-20 14:46:29.253631+00', 'view_member', ARRAY[
    '{"effect":"allow","resource":"TEAM_MEMBERS_GET"}'::jsonb,
    '{"effect":"allow","resource":"TEAM_MEMBER_ACTIVITY_REGISTER"}'::jsonb,
    '{"effect":"allow","resource":"TEAM_ROLES_LIST"}'::jsonb
], 'Allow members view members.', null),
('39', '2025-05-20 14:15:47.224844+00', 'manage_triggers', ARRAY[
    '{"effect":"allow","resource":"TRIGGERS_LIST"}'::jsonb,
    '{"effect":"allow","resource":"TRIGGERS_DEACTIVATE"}'::jsonb,
    '{"effect":"allow","resource":"TRIGGERS_ACTIVATE"}'::jsonb,
    '{"effect":"allow","resource":"TRIGGERS_GET"}'::jsonb,
    '{"effect":"allow","resource":"TRIGGERS_CREATE"}'::jsonb,
    '{"effect":"allow","resource":"TRIGGERS_CREATE_CRON"}'::jsonb,
    '{"effect":"allow","resource":"TRIGGERS_CREATE_WEBHOOK"}'::jsonb,
    '{"effect":"allow","resource":"TRIGGERS_DELETE"}'::jsonb,
    '{"effect":"allow","resource":"TRIGGERS_GET_WEBHOOK_URL"}'::jsonb
], 'Allow manage triggers list, create, edit, delete, activate and desactivate.', null),
('38', '2025-05-20 13:56:10.68372+00', 'view_thread', ARRAY[
    '{"effect":"allow","resource":"THREADS_LIST"}'::jsonb,
    '{"effect":"allow","resource":"THREADS_GET"}'::jsonb,
    '{"effect":"allow","resource":"THREADS_GET_TOOLS"}'::jsonb,
    '{"effect":"allow","resource":"THREADS_GET_MESSAGES"}'::jsonb,
    '{"effect":"allow","resource":"THREADS_UPDATE_METADATA"}'::jsonb,
    '{"effect":"allow","resource":"THREADS_UPDATE_TITLE"}'::jsonb
], 'Allow members view threads', null),
('37', '2025-05-20 12:54:32.480764+00', 'manage_host_app', ARRAY[
    '{"effect":"allow","resource":"HOSTING_APP_DEPLOY"}'::jsonb,
    '{"effect":"allow","resource":"HOSTING_APP_DELETE"}'::jsonb
], 'Allow members manage host apps', null),
('36', '2025-05-20 12:51:59.529503+00', 'view_host_app', ARRAY[
    '{"effect":"allow","resource":"HOSTING_APPS_LIST"}'::jsonb,
    '{"effect":"allow","resource":"HOSTING_APP_INFO"}'::jsonb
], 'Allow members to view hosted app', null),
('35', '2025-05-20 12:17:38.023926+00', 'manage_integration', ARRAY[
    '{"effect":"allow","resource":"INTEGRATIONS_CREATE"}'::jsonb,
    '{"effect":"allow","resource":"INTEGRATIONS_UPDATE"}'::jsonb,
    '{"effect":"allow","resource":"INTEGRATIONS_DELETE"}'::jsonb
], 'Allow members to manage integrations, like create, update and delete.', null),
('34', '2025-05-20 12:04:38.594968+00', 'view_integration', ARRAY[
    '{"effect":"allow","resource":"INTEGRATIONS_LIST"}'::jsonb,
    '{"effect":"allow","resource":"INTEGRATIONS_GET"}'::jsonb,
    '{"effect":"allow","resource":"INTEGRATIONS_LIST_TOOLS"}'::jsonb
], 'Allow members to view integrations', null),
('33', '2025-05-20 11:35:15.595661+00', 'manage_agent', ARRAY[
    '{"effect":"allow","resource":"AGENTS_CREATE"}'::jsonb,
    '{"effect":"allow","resource":"AGENTS_DELETE"}'::jsonb,
    '{"effect":"allow","resource":"AGENTS_UPDATE"}'::jsonb
], 'Allows actions related to agents management, including creating, updating, deleting agents.', null),
('32', '2025-05-19 16:41:02.523411+00', 'view_agent', ARRAY[
    '{"effect":"allow","resource":"AGENTS_GET"}'::jsonb,
    '{"effect":"allow","resource":"AGENTS_LIST"}'::jsonb
], 'Allows access to view agents information.', null)
ON CONFLICT (id) DO NOTHING;
WITH current AS (
  SELECT id, statements
  FROM public.policies
  WHERE id = 3
),
to_add AS (
  SELECT unnest(ARRAY[
    '{"effect":"allow","resource":"TEAMS_DELETE"}'::jsonb,
    '{"effect":"allow","resource":"TEAMS_UPDATE"}'::jsonb
  ]) AS new_statement
),
missing AS (
  SELECT current.id, current.statements, array_agg(to_add.new_statement) AS new_statements
  FROM current
  JOIN to_add
    ON NOT EXISTS (
      SELECT 1
      FROM unnest(current.statements) AS stmt
      WHERE stmt = to_add.new_statement
    )
  GROUP BY current.id, current.statements
)
UPDATE public.policies
SET statements = array_cat(missing.statements, missing.new_statements)
FROM missing
WHERE public.policies.id = missing.id;
WITH current AS (
  SELECT id, statements
  FROM public.policies
  WHERE id = 2
),
to_add AS (
  SELECT unnest(ARRAY[
    '{"effect":"allow","resource":"TEAM_MEMBERS_UPDATE"}'::jsonb,
    '{"effect":"allow","resource":"TEAM_MEMBERS_REMOVE"}'::jsonb,
    '{"effect":"allow","resource":"TEAM_MEMBERS_INVITE"}'::jsonb
  ]) AS new_statement
),
missing AS (
  SELECT current.id, current.statements, array_agg(to_add.new_statement) AS new_statements
  FROM current
  JOIN to_add
    ON NOT EXISTS (
      SELECT 1
      FROM unnest(current.statements) AS stmt
      WHERE stmt = to_add.new_statement
    )
  GROUP BY current.id, current.statements
)
UPDATE public.policies
SET statements = array_cat(missing.statements, missing.new_statements)
FROM missing
WHERE public.policies.id = missing.id;
WITH current AS (
  SELECT id, statements
  FROM public.policies
  WHERE id = 4
),
to_add AS (
  SELECT unnest(ARRAY[
    '{"effect":"allow","resource":"TEAMS_GET"}'::jsonb
  ]) AS new_statement
),
missing AS (
  SELECT current.id, current.statements, array_agg(to_add.new_statement) AS new_statements
  FROM current
  JOIN to_add
    ON NOT EXISTS (
      SELECT 1
      FROM unnest(current.statements) AS stmt
      WHERE stmt = to_add.new_statement
    )
  GROUP BY current.id, current.statements
)
UPDATE public.policies
SET statements = array_cat(missing.statements, missing.new_statements)
FROM missing
WHERE public.policies.id = missing.id;
INSERT INTO "public"."role_policies" ("id", "created_at", "role_id", "policy_id") VALUES 
('288', '2025-05-21 12:42:16.393913+00', '4', '43'), 
('287', '2025-05-21 12:42:11.460812+00', '3', '43'),
('286', '2025-05-21 12:42:05.273088+00', '1', '43'), 
('285', '2025-05-20 18:29:51.82997+00', '4', '42'), 
('284', '2025-05-20 18:24:26.66141+00', '3', '42'), 
('283', '2025-05-20 18:24:21.06582+00', '1', '42'), 
('282', '2025-05-20 17:47:21.091672+00', '1', '39'), 
('281', '2025-05-20 17:47:15.290431+00', '1', '37'), 
('280', '2025-05-20 17:47:11.630102+00', '1', '35'), 
('279', '2025-05-20 17:47:08.187533+00', '1', '33'), 
('278', '2025-05-20 17:47:02.128172+00', '1', '40'), 
('277', '2025-05-20 17:46:56.433943+00', '1', '38'), 
('276', '2025-05-20 17:46:53.778456+00', '1', '36'), 
('275', '2025-05-20 17:46:48.153478+00', '1', '34'), 
('274', '2025-05-20 17:46:45.524147+00', '1', '32'), 
('273', '2025-05-20 17:46:34.820436+00', '4', '39'), 
('272', '2025-05-20 17:46:31.220853+00', '4', '37'), 
('271', '2025-05-20 17:46:28.928679+00', '4', '35'), 
('270', '2025-05-20 17:46:25.877881+00', '4', '33'), 
('269', '2025-05-20 17:46:19.415288+00', '4', '40'), 
('268', '2025-05-20 17:46:14.421393+00', '4', '38'), 
('267', '2025-05-20 17:46:03.914266+00', '4', '36'), 
('266', '2025-05-20 17:46:00.563232+00', '4', '34'), 
('265', '2025-05-20 17:45:57.816371+00', '4', '32'), 
('264', '2025-05-20 17:01:38.53666+00', '3', '40'), 
('263', '2025-05-20 17:01:29.660136+00', '3', '38'), 
('262', '2025-05-20 17:00:59.335316+00', '3', '36'), 
('261', '2025-05-20 17:00:27.837796+00', '3', '34'), 
('260', '2025-05-20 16:59:58.749059+00', '3', '32')
ON CONFLICT (id) DO NOTHING;
