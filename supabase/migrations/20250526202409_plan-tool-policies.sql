UPDATE "public"."policies" SET "statements" = ARRAY[
    '{"effect":"allow","resource":"GET_WALLET_ACCOUNT"}'::jsonb,
    '{"effect":"allow","resource":"GET_THREADS_USAGE"}'::jsonb,
    '{"effect":"allow","resource":"GET_AGENTS_USAGE"}'::jsonb,
    '{"effect":"allow","resource":"GET_WORKSPACE_PLAN"}'::jsonb
-- view_wallet
] WHERE "id" = '44';
