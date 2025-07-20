-- Update the view_wallet policy to include REDEEM_VOUCHER and CREATE_CHECKOUT_SESSION permissions
-- This allows anyone with wallet view permissions to also redeem vouchers and create checkout sessions
UPDATE "public"."policies" 
SET "statements" = ARRAY[
    '{"effect":"allow","resource":"GET_WALLET_ACCOUNT"}'::jsonb,
    '{"effect":"allow","resource":"GET_THREADS_USAGE"}'::jsonb,
    '{"effect":"allow","resource":"GET_AGENTS_USAGE"}'::jsonb,
    '{"effect":"allow","resource":"GET_WORKSPACE_PLAN"}'::jsonb,
    '{"effect":"allow","resource":"REDEEM_VOUCHER"}'::jsonb,
    '{"effect":"allow","resource":"CREATE_CHECKOUT_SESSION"}'::jsonb
],
    "description" = 'Allow users to view wallet account and usage information, redeem vouchers, and create checkout sessions'
WHERE "id" = '44';

-- Update the manage_wallet policy to remove REDEEM_VOUCHER and CREATE_CHECKOUT_SESSION since they're now in view_wallet
-- This prevents duplication and keeps the manage_wallet policy focused on admin functions
UPDATE "public"."policies" 
SET "statements" = ARRAY[
    '{"effect":"allow","resource":"CREATE_VOUCHER"}'::jsonb
],
    "description" = 'Allow users to create wallet vouchers (admin function)'
WHERE "id" = '45';
