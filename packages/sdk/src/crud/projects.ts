import { MCPClient } from "../fetcher.ts";

export const listProjects = (org: string, init?: RequestInit) =>
  MCPClient.PROJECTS_LIST({ org }, init).then((res) => res.items);

export const listRecentProjects = (init?: RequestInit) =>
  MCPClient.PROJECTS_RECENT({ limit: 6 }, init).then((res) => res.items);
