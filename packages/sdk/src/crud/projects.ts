import { MCPClient } from "../fetcher.ts";
import type { Project } from "../models/project.ts";

export const listProjects = (
  org: string,
  init?: RequestInit,
): Promise<Project[]> =>
  MCPClient.PROJECTS_LIST({ org }, init).then((res) => res.items as Project[]);

export const listRecentProjects = (init?: RequestInit): Promise<Project[]> =>
  MCPClient.PROJECTS_RECENT({ limit: 12 }, init).then(
    (res) => res.items as Project[],
  );
