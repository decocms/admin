import { MCPClient } from "../fetcher.ts";

export const listProjects = (org: string, init?: RequestInit) =>
  MCPClient.PROJECTS_LIST({ org }, init).then((res) => res.items);
