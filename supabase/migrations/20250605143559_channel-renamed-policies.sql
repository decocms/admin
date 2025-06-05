-- Update the manage_channel policy with new permissions
UPDATE "public"."policies"
SET 
    statements = ARRAY[
        '{"effect":"allow","resource":"CHANNELS_CREATE"}'::jsonb,
        '{"effect":"allow","resource":"CHANNELS_JOIN"}'::jsonb,
        '{"effect":"allow","resource":"CHANNELS_LEAVE"}'::jsonb,
        '{"effect":"allow","resource":"CHANNELS_DELETE"}'::jsonb
    ],
    description = 'Allow users to create, join, leave, and delete channels'
WHERE id = '51';