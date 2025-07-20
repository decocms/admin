-- Add GET_BILLING_HISTORY to the view_wallet policy
-- This allows users with wallet view permissions to also access billing history
UPDATE "public"."policies" 
SET "statements" = ARRAY[
    '{"effect":"allow","resource":"GET_WALLET_ACCOUNT"}'::jsonb,
    '{"effect":"allow","resource":"GET_THREADS_USAGE"}'::jsonb,
    '{"effect":"allow","resource":"GET_AGENTS_USAGE"}'::jsonb,
    '{"effect":"allow","resource":"GET_WORKSPACE_PLAN"}'::jsonb,
    '{"effect":"allow","resource":"REDEEM_VOUCHER"}'::jsonb,
    '{"effect":"allow","resource":"CREATE_CHECKOUT_SESSION"}'::jsonb,
    '{"effect":"allow","resource":"GET_BILLING_HISTORY"}'::jsonb
],
    "description" = 'Allow users to view wallet account and usage information, redeem vouchers, create checkout sessions, and access billing history'
WHERE "id" = '44';
