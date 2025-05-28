WITH current AS (
  SELECT id, statements
  FROM public.policies
  -- manage_member policy id
  WHERE id = 2
),
to_add AS (
  SELECT unnest(ARRAY[
    '{"effect":"allow","resource":"TEAM_MEMBERS_UPDATE_ROLE"}'::jsonb
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

