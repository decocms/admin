import { MCPClient } from "../fetcher.ts";
import type { Project } from "../models/project.ts";

export const listProjects = (
  org: string,
  init?: RequestInit,
): Promise<Project[]> =>
  MCPClient.PROJECTS_LIST({ org }, init).then((res) => res.items as Project[]);

export const listRecentProjects = (init?: RequestInit): Promise<Project[]> =>
  MCPClient.PROJECTS_RECENT({ limit: 6 }, init).then(
    (res) => res.items as Project[],
  );

export const registerProjectActivity = (
  org: string,
  project: string,
): Promise<{ success: boolean }> =>
  MCPClient.PROJECT_ACTIVITY_REGISTER({ org, project });

export interface CreateProjectInput {
  org: string;
  slug: string;
  title: string;
  description?: string;
  icon?: string;
  [key: string]: unknown;
}

export const createProject = (
  input: CreateProjectInput,
  init?: RequestInit,
): Promise<Project> =>
  MCPClient.PROJECTS_CREATE(input, init) as Promise<Project>;

export interface UpdateProjectInput {
  org: string;
  project: string;
  data: Partial<Pick<Project, "title"> & { icon?: string }>;
  [key: string]: unknown;
}

export const updateProject = (
  input: UpdateProjectInput,
  init?: RequestInit,
): Promise<Project> =>
  MCPClient.PROJECTS_UPDATE(input, init) as Promise<Project>;

export interface DeleteProjectInput {
  projectId: string;
}

export const deleteProject = (
  input: DeleteProjectInput,
  init?: RequestInit,
): Promise<{ success: boolean; error?: string }> =>
  MCPClient.PROJECTS_DELETE(input, init) as Promise<{
    success: boolean;
    error?: string;
  }>;
