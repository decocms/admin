import { callToolFor } from "../fetcher.ts";
import { User } from "./user.ts";

export interface Member {
  id: number;
  user_id: string;
  admin: boolean | null;
  created_at: string;
  profiles: User;
  lastActivity?: string;
}

export interface Role {
  id: number;
  name: string;
  description: string | null;
  team_id: number | null;
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
  { teamId, withActivity }: { teamId: number; withActivity?: boolean },
  signal?: AbortSignal,
): Promise<Member[]> => {
  const response = await callToolFor("", "TEAM_MEMBERS_GET", {
    teamId,
    withActivity,
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
 * Fetch team roles by team ID
 * @param teamId - The ID of the team to fetch roles for
 * @returns List of team roles
 */
export const getTeamRoles = async (
  teamId: number,
  signal?: AbortSignal,
): Promise<Role[]> => {
  const response = await callToolFor("", "TEAM_ROLES_LIST", {
    teamId,
  }, { signal });

  if (!response.ok) {
    throw new Error("Failed to fetch team roles");
  }

  const { data, error } = await response.json();

  if (error) {
    throw new Error(error.message || "Failed to fetch team roles");
  }

  return data;
};

/**
 * Invite new members to a team
 * @param teamId - The ID of the team to invite members to
 * @param invitees - Array of invitees with email and roles
 * @returns Response message from the API
 */
export const inviteTeamMembers = async (
  teamId: number,
  invitees: Array<{
    email: string;
    roles: Array<{ id: number; name: string }>;
  }>,
): Promise<{ message: string }> => {
  const response = await callToolFor("", "TEAM_MEMBERS_INVITE", {
    teamId: teamId.toString(),
    invitees,
  });

  if (!response.ok) {
    throw new Error("Failed to invite team members");
  }

  const { data, error } = await response.json();

  if (error) {
    throw new Error(error.message || "Failed to invite team members");
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

export const registerActivity = (teamId: number) => {
  callToolFor("", "TEAM_MEMBER_ACTIVITY_REGISTER", {
    teamId,
  });
};
