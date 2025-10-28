import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import {
  acceptInvite,
  getMyInvites,
  getTeamMembers,
  getTeamRoles,
  type Invite as _Invite,
  inviteTeamMembers,
  type Member,
  registerActivity,
  rejectInvite,
  removeTeamMember,
  type Role as _Role,
  updateMemberRole,
} from "../crud/members.ts";
import { MCPClient } from "../fetcher.ts";
import { KEYS } from "./react-query-keys.ts";
import { useOrganizations } from "./teams.ts";
import { type User, useSDK } from "../index.ts";

type TeamMembers = Awaited<ReturnType<typeof getTeamMembers>>;

export interface TeamMember {
  id: number;
  user_id: string;
  created_at: string;
  profiles: User;
  lastActivity?: string;
  roles: { id: number; name: string }[];
}

/**
 * Hook to fetch team members
 * @param teamId - The ID of the team to fetch members for
 */
export const useTeamMembers = (
  teamId: number | null,
  { withActivity }: { withActivity?: boolean } = { withActivity: false },
) => {
  return useSuspenseQuery({
    queryKey: KEYS.ORG_MEMBERS(teamId ?? -1),
    queryFn: ({ signal }): Promise<TeamMembers> => {
      if (teamId === null) {
        return Promise.resolve({ members: [], invites: [] });
      }
      return getTeamMembers({ teamId, withActivity }, signal);
    },
  });
};

/**
 * Hook to fetch team members for the current team
 * @param currentTeamSlug - The slug of the current team
 */
export const useTeamMembersBySlug = (currentTeamSlug: string | null) => {
  const { data: teams } = useOrganizations();
  const teamId = useMemo(
    () => teams?.find((t) => t.slug === currentTeamSlug)?.id ?? null,
    [teams, currentTeamSlug],
  );
  return useTeamMembers(teamId);
};

/**
 * Hook to fetch team roles
 * @param teamId - The ID of the team to fetch roles for
 */
export const useTeamRoles = (teamId: number | null) => {
  return useSuspenseQuery({
    queryKey: KEYS.ORG_ROLES(teamId ?? -1),
    queryFn: ({ signal }) =>
      typeof teamId === "number" ? getTeamRoles(teamId, signal) : [],
  });
};

/**
 * Hook to fetch user's invites
 * @returns Query with invites data
 */
export const useInvites = () => {
  return useSuspenseQuery({
    queryKey: KEYS.MY_INVITES(),
    queryFn: ({ signal }) => getMyInvites(signal),
  });
};

/**
 * Hook to accept an invite
 * @returns Mutation function for accepting an invite
 */
export const useAcceptInvite = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (inviteId: string) => acceptInvite(inviteId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KEYS.MY_INVITES() });
      queryClient.invalidateQueries({ queryKey: KEYS.ORGANIZATIONS() });
    },
  });
};

/**
 * Hook to reject an invite
 * @returns Mutation function for rejecting an invite
 */
export const useRejectInvite = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id }: { id: string; teamId?: number }) => rejectInvite(id),
    onSuccess: (_, variables) => {
      variables.teamId === undefined &&
        queryClient.invalidateQueries({ queryKey: KEYS.MY_INVITES() });

      variables.teamId !== undefined &&
        queryClient.invalidateQueries({
          queryKey: KEYS.ORG_MEMBERS(variables.teamId ?? -1),
        });
    },
  });
};

/**
 * Hook to invite team members
 * @returns Mutation function for inviting team members
 */
export const useInviteTeamMember = () => {
  const queryClient = useQueryClient();
  const { locator } = useSDK();

  return useMutation({
    mutationFn: ({
      teamId,
      invitees,
    }: {
      teamId: number;
      invitees: Array<{
        email: string;
        roles: Array<{ id: number; name: string }>;
      }>;
    }) => inviteTeamMembers(teamId, invitees, locator),
    onSuccess: (_, { teamId }) => {
      const membersKey = KEYS.ORG_MEMBERS(teamId);
      queryClient.invalidateQueries({ queryKey: membersKey });
    },
  });
};

/**
 * Hook to remove a team member
 * @returns Mutation function for removing a team member
 */
export const useRemoveTeamMember = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ teamId, memberId }: { teamId: number; memberId: number }) =>
      removeTeamMember(teamId, memberId),
    onSuccess: (_, { teamId, memberId }) => {
      const membersKey = KEYS.ORG_MEMBERS(teamId);

      queryClient.cancelQueries({ queryKey: membersKey });
      queryClient.setQueryData<{ members: Member[] }>(membersKey, (old) => ({
        ...old,
        members: old?.members?.filter((member) => member.id !== memberId) ?? [],
      }));
    },
  });
};

export const useRegisterActivity = (teamId?: number) => {
  useEffect(() => {
    if (!teamId) return;

    registerActivity(teamId);
  }, [teamId]);
};

/**
 * Hook to update a member's role in a team
 * @returns Mutation function for updating a member's role
 */
export const useUpdateMemberRole = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      teamId,
      userId,
      roleId,
      action,
    }: {
      teamId: number;
      userId: string;
      roleId: number;
      roleName: string;
      action: "grant" | "revoke";
    }) => updateMemberRole(teamId, userId, roleId, action),
    onSuccess: (_, { teamId, userId, roleId, action, roleName }) => {
      const membersKey = KEYS.ORG_MEMBERS(teamId);
      const membersData = queryClient.getQueryData<TeamMembers>(membersKey);

      if (!membersData) return;
      const { members } = membersData;

      const membersWithChangedRole = members.map((member) => {
        if (member.user_id !== userId) return member;

        const newRoles =
          action === "grant"
            ? [...member.roles, { id: roleId, name: roleName }]
            : member.roles.filter((r) => r.id !== roleId);
        return { ...member, roles: newRoles };
      });
      queryClient.setQueryData<TeamMembers>(membersKey, {
        ...membersData,
        members: membersWithChangedRole,
      });
    },
  });
};

/**
 * Hook to report an issue (bug or idea)
 * @returns Mutation function for reporting an issue
 */
export const useReportIssue = () => {
  return useMutation({
    mutationFn: ({
      orgSlug,
      projectSlug,
      type,
      content,
      url,
      path,
    }: {
      orgSlug?: string;
      projectSlug?: string;
      type: "Bug" | "Idea";
      content: string;
      url?: string;
      path?: string;
    }) =>
      MCPClient.TEAM_REPORT_ISSUE_CREATE({
        orgSlug,
        projectSlug,
        type,
        content,
        url,
        path,
      }),
  });
};
