import { callToolFor } from "../fetcher.ts";

export interface Member {
  id: number;
  user_id: string;
  admin: boolean;
  created_at: string;
  profiles: {
    id: string;
    name: string;
    email: string;
  };
}

export interface MemberFormData {
  email: string;
}

/**
 * Fetch team members by team ID
 * @param teamId - The ID of the team to fetch members for
 * @returns List of team members
 */
export const getTeamMembers = async (
  teamId: number,
  signal?: AbortSignal,
): Promise<Member[]> => {
  const response = await callToolFor("", "TEAM_MEMBERS_GET", {
    teamId,
  }, { signal });

  if (!response.ok) {
    throw new Error("Failed to fetch team members");
  }

  const { data, error } = await response.json();

  if (error) {
    throw new Error(error.message || "Failed to fetch team members");
  }

  return data;
};

/**
 * Add a new member to a team
 * @param teamId - The ID of the team to add a member to
 * @param member - The member data to add
 * @returns The added member data
 */
export const addTeamMember = async (
  teamId: number,
  email: string,
): Promise<Member> => {
  const response = await callToolFor("", "TEAM_MEMBERS_ADD", {
    teamId,
    email,
  });

  if (!response.ok) {
    throw new Error("Failed to add team member");
  }

  const { data, error } = await response.json();

  if (error) {
    throw new Error(error.message || "Failed to add team member");
  }

  return data;
};

/**
 * Remove a member from a team
 * @param teamId - The ID of the team
 * @param memberId - The ID of the member to remove
 * @returns Success status
 */
export const removeTeamMember = async (
  teamId: number,
  memberId: number,
): Promise<{ success: boolean }> => {
  const response = await callToolFor("", "TEAM_MEMBERS_REMOVE", {
    teamId,
    memberId,
  });

  if (!response.ok) {
    throw new Error("Failed to remove team member");
  }

  const { data, error } = await response.json();

  if (error) {
    throw new Error(error.message || "Failed to remove team member");
  }

  return data;
};