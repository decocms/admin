-- Add TRIGGERS_UPSERT to the manage_triggers policy
UPDATE "public"."policies" SET "statements" = ARRAY[
    '{"effect":"allow","resource":"TRIGGERS_LIST"}'::jsonb,
    '{"effect":"allow","resource":"TRIGGERS_DEACTIVATE"}'::jsonb,
    '{"effect":"allow","resource":"TRIGGERS_ACTIVATE"}'::jsonb,
    '{"effect":"allow","resource":"TRIGGERS_GET"}'::jsonb,
    '{"effect":"allow","resource":"TRIGGERS_CREATE"}'::jsonb,
    '{"effect":"allow","resource":"TRIGGERS_CREATE_CRON"}'::jsonb,
    '{"effect":"allow","resource":"TRIGGERS_CREATE_WEBHOOK"}'::jsonb,
    '{"effect":"allow","resource":"TRIGGERS_DELETE"}'::jsonb,
    '{"effect":"allow","resource":"TRIGGERS_GET_WEBHOOK_URL"}'::jsonb,
    '{"effect":"allow","resource":"TRIGGERS_UPSERT"}'::jsonb,
    '{"effect":"allow","resource":"TRIGGERS_UPDATE"}'::jsonb
] WHERE "name" = 'manage_triggers';
