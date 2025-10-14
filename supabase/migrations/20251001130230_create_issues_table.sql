CREATE TABLE IF NOT EXISTS deco_chat_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id bigint REFERENCES teams(id) ON DELETE CASCADE,
  project_id uuid REFERENCES deco_chat_projects(id) ON DELETE SET NULL,
  reporter_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL,
  content text NOT NULL,
  url text,
  path text,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_deco_chat_issues_org_id ON deco_chat_issues(org_id);
CREATE INDEX IF NOT EXISTS idx_deco_chat_issues_reporter_user_id ON deco_chat_issues(reporter_user_id);
CREATE INDEX IF NOT EXISTS idx_deco_chat_issues_created_at ON deco_chat_issues(created_at DESC);

ALTER TABLE deco_chat_issues ENABLE ROW LEVEL SECURITY;
