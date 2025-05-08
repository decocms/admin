import { callToolFor } from "../fetcher.ts";

export interface Team {
  id: number;
  name: string;
  slug: string;
  created_at: string;
}

export const listTeams = async (
  init?: RequestInit,
): Promise<Team[]> => {
  const response = await callToolFor("", "TEAMS_LIST", {}, init);
  const { error, data } = await response.json();
  if (error) {
    throw error;
  }
  return data as Team[];
};

export const getTeam = async (
  slug: string,
  init?: RequestInit,
): Promise<Team> => {
  const response = await callToolFor("", "TEAMS_GET", { slug }, init);
  const { error, data } = await response.json();
  if (error) {
    throw error;
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
  const response = await callToolFor("", "TEAMS_CREATE", input, init);
  const { error, data } = await response.json();
  if (error) throw error;
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
  const response = await callToolFor("", "TEAMS_UPDATE", input, init);
  const { error, data } = await response.json();
  if (error) throw error;
  return data as Team;
}

export async function deleteTeam(
  teamId: number,
  init?: RequestInit,
): Promise<{ success: boolean }> {
  const response = await callToolFor("", "TEAMS_DELETE", { teamId }, init);
  const { error, data } = await response.json();
  if (error) throw error;
  return data as { success: boolean };
}
