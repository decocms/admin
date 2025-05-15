import { MCPClient } from "../fetcher.ts";

export interface Team {
  id: number;
  name: string;
  slug: string;
  created_at: string;
}

export const listTeams = async (
  init?: RequestInit,
): Promise<Team[]> => {
  const { data, error, ok } = await MCPClient.TEAMS_LIST({}, init);
  if (!ok || !data) {
    throw new Error(error?.message || "Failed to list teams");
  }
  return data as Team[];
};

export const getTeam = async (
  slug: string,
  init?: RequestInit,
): Promise<Team> => {
  const { data, error, ok } = await MCPClient.TEAMS_GET({ slug }, init);
  if (!ok || !data) {
    throw new Error(error?.message || "Failed to get team");
  }
  return data as Team;
};

export interface CreateTeamInput {
  name: string;
  slug?: string;
  stripe_subscription_id?: string;
  [key: string]: unknown;
}

export async function createTeam(
  input: CreateTeamInput,
  init?: RequestInit,
): Promise<Team> {
  const { data, error, ok } = await MCPClient.TEAMS_CREATE(input, init);
  if (!ok || !data) throw new Error(error?.message || "Failed to create team");
  return data as Team;
}

export interface UpdateTeamInput {
  id: number;
  data: Partial<
    Pick<Team, "name" | "slug"> & { stripe_subscription_id?: string }
  >;
  [key: string]: unknown;
}

export async function updateTeam(
  input: UpdateTeamInput,
  init?: RequestInit,
): Promise<Team> {
  const { data, error, ok } = await MCPClient.TEAMS_UPDATE(input, init);
  if (!ok || !data) throw new Error(error?.message || "Failed to update team");
  return data as Team;
}

export async function deleteTeam(
  teamId: number,
  init?: RequestInit,
): Promise<{ success: boolean }> {
  const { data, error, ok } = await MCPClient.TEAMS_DELETE({ teamId }, init);
  if (!ok || !data) throw new Error(error?.message || "Failed to delete team");
  return data as { success: boolean };
}
