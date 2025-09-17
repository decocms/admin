export interface ProjectOrgMeta {
  id: number;
  slug: string;
  avatar_url?: string | null;
}

export interface Project {
  id: string;
  title: string;
  slug: string;
  avatar_url: string | null;
  org: ProjectOrgMeta;
  last_accessed_at?: string;
}
