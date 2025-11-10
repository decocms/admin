-- Create admin email domains table for store edit mode
CREATE TABLE IF NOT EXISTS admin_email_domains_deco (
  domain TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Insert the 3 initial allowed domains
INSERT INTO admin_email_domains_deco (domain) VALUES 
  ('@deco.cx'),
  ('@decocms.com'),
  ('@carcara.tech')
ON CONFLICT (domain) DO NOTHING;

-- Add comment explaining the table purpose
COMMENT ON TABLE admin_email_domains_deco IS 'Email domains allowed to access store edit mode features';

