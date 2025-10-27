-- BROWSER RENDERING and FILE SYSTEM policies for screenshots, PDFs, and file management
INSERT INTO "public"."policies" ("id", "created_at", "name", "statements", "description", "team_id") VALUES 
('76', '2025-10-26 11:00:00.000000+00', 'use_browser_rendering', ARRAY[
    '{"effect":"allow","resource":"BROWSER_SCREENSHOT"}'::jsonb,
    '{"effect":"allow","resource":"BROWSER_PDF"}'::jsonb,
    '{"effect":"allow","resource":"BROWSER_HTML"}'::jsonb,
    '{"effect":"allow","resource":"BROWSER_SCRAPE"}'::jsonb,
    '{"effect":"allow","resource":"BROWSER_SCREENSHOTS_LIST"}'::jsonb
], 'Allow users to capture screenshots, generate PDFs, fetch HTML, and scrape websites using Cloudflare Browser Rendering API', null),
('77', '2025-10-26 11:00:00.000000+00', 'manage_browser_screenshots', ARRAY[
    '{"effect":"allow","resource":"BROWSER_SCREENSHOT_DELETE"}'::jsonb
], 'Allow users to delete screenshots', null),
('78', '2025-10-26 11:00:00.000000+00', 'use_file_system', ARRAY[
    '{"effect":"allow","resource":"FS_LIST"}'::jsonb,
    '{"effect":"allow","resource":"FS_READ"}'::jsonb,
    '{"effect":"allow","resource":"FS_WRITE"}'::jsonb,
    '{"effect":"allow","resource":"FS_READ_METADATA"}'::jsonb
], 'Allow users to list, read, write, and read metadata from file system (R2 storage)', null),
('79', '2025-10-26 11:00:00.000000+00', 'delete_files', ARRAY[
    '{"effect":"allow","resource":"FS_DELETE"}'::jsonb
], 'Allow users to delete files from file system', null)
ON CONFLICT (id) DO NOTHING;

-- Associate browser rendering usage policy with all roles (1=owner, 3=member, 4=admin)
INSERT INTO "public"."role_policies" ("id", "created_at", "role_id", "policy_id") VALUES 
('397', '2025-10-26 11:00:00.000000+00', '1', '76'),
('398', '2025-10-26 11:00:00.000000+00', '3', '76'),
('399', '2025-10-26 11:00:00.000000+00', '4', '76')
ON CONFLICT (id) DO NOTHING;

-- Associate screenshot deletion policy with owner (1) and admin (4)
-- Screenshot deletion should be restricted to prevent accidental data loss
INSERT INTO "public"."role_policies" ("id", "created_at", "role_id", "policy_id") VALUES 
('400', '2025-10-26 11:00:00.000000+00', '1', '77'),
('401', '2025-10-26 11:00:00.000000+00', '4', '77')
ON CONFLICT (id) DO NOTHING;

-- Associate file system usage policy with all roles (1=owner, 3=member, 4=admin)
-- File system operations are required for storing screenshots and other assets
INSERT INTO "public"."role_policies" ("id", "created_at", "role_id", "policy_id") VALUES 
('402', '2025-10-26 11:00:00.000000+00', '1', '78'),
('403', '2025-10-26 11:00:00.000000+00', '3', '78'),
('404', '2025-10-26 11:00:00.000000+00', '4', '78')
ON CONFLICT (id) DO NOTHING;

-- Associate file deletion policy with owner (1) and admin (4)
-- File deletion should be restricted to prevent accidental data loss
INSERT INTO "public"."role_policies" ("id", "created_at", "role_id", "policy_id") VALUES 
('405', '2025-10-26 11:00:00.000000+00', '1', '79'),
('406', '2025-10-26 11:00:00.000000+00', '4', '79')
ON CONFLICT (id) DO NOTHING;

