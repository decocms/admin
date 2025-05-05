import { callToolFor } from "../fetcher.ts";

export interface Team {
  id: number;
  name: string;
  slug: null | string;
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
