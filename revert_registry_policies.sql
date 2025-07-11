-- Revert registry policies migration
-- Delete role_policies first (due to foreign key constraints)
DELETE FROM "public"."role_policies" WHERE "id" IN (
    '315', '316', '317', '318', '319', '320', '321', '322', '323', '324'
);

-- Delete policies
DELETE FROM "public"."policies" WHERE "id" IN (
    '55', '56', '57', '58'
); 