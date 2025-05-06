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

  if (!response.ok) {
    throw new Error("Failed to fetch teams");
  }

  const { error, data } = await response.json();

  if (error) {
    throw new Error(error.message || "Failed to fetch teams");
  }

  return data as Team[];
};

export const getTeam = async (
  slug: string,
  init?: RequestInit,
): Promise<Team> => {
  const response = await callToolFor("", "TEAMS_GET", { slug }, init);

  if (!response.ok) {
    throw new Error("Failed to fetch team");
  }

  const { error, data } = await response.json();

  if (error) {
    throw new Error(error.message || "Failed to fetch team");
  }

  return data as Team;
};
