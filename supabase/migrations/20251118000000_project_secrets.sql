-- Create project_secrets table
create table if not exists public.project_secrets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  value_encrypted text not null,
  description text,
  project_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_secrets_project_id_fkey foreign key (project_id) references deco_chat_projects (id) on delete cascade,
  constraint project_secrets_name_project_id_unique unique (name, project_id)
);

-- Create index for faster lookups
create index if not exists idx_project_secrets_project_id on public.project_secrets (project_id);

-- Create project_secrets_audit_log table
create table if not exists public.project_secrets_audit_log (
  id uuid primary key default gen_random_uuid(),
  secret_id uuid,
  secret_name text not null,
  project_id uuid not null,
  accessed_by uuid,
  accessed_at timestamptz not null default now(),
  access_type text not null,
  tool_name text,
  agent_id uuid,
  constraint project_secrets_audit_log_secret_id_fkey foreign key (secret_id) references project_secrets (id) on delete set null,
  constraint project_secrets_audit_log_project_id_fkey foreign key (project_id) references deco_chat_projects (id) on delete cascade
);

-- Create index for efficient querying of audit logs
create index if not exists idx_project_secrets_audit_log_project_id_accessed_at on public.project_secrets_audit_log (project_id, accessed_at desc);
create index if not exists idx_project_secrets_audit_log_secret_id on public.project_secrets_audit_log (secret_id);

