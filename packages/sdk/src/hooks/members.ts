import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import {
  addTeamMember,
  getTeamMembers,
  removeTeamMember,
  type MemberFormData,
} from "../crud/members.ts";
import { KEYS } from "./api.ts";
import { useSDK } from "./store.tsx";

/**
 * Hook to fetch team members
 * @param teamId - The ID of the team to fetch members for
 */
export const useTeamMembers = (teamId: number) => {
  const { workspace } = useSDK();

  return useSuspenseQuery({
    queryKey: KEYS.MEMBERS(workspace, teamId),
    queryFn: ({ signal }) => getTeamMembers(teamId, signal),
  });
};

/**
 * Hook to add a new team member
 * @returns Mutation function for adding a team member
 */
export const useAddTeamMember = () => {
  const queryClient = useQueryClient();
  const { workspace } = useSDK();

  return useMutation({
    mutationFn: ({ teamId, email }: { teamId: number; email: string }) =>
      addTeamMember(teamId, email),
    onSuccess: (_, { teamId }) => {
      // Invalidate and refetch members list
      queryClient.invalidateQueries({
        queryKey: KEYS.MEMBERS(workspace, teamId),
      });
    },
  });
};

/**
 * Hook to remove a team member
 * @returns Mutation function for removing a team member
 */
export const useRemoveTeamMember = () => {
  const queryClient = useQueryClient();
  const { workspace } = useSDK();

  return useMutation({
    mutationFn: ({ teamId, memberId }: { teamId: number; memberId: number }) =>
      removeTeamMember(teamId, memberId),
    onSuccess: (_, { teamId }) => {
      // Invalidate and refetch members list
      queryClient.invalidateQueries({
        queryKey: KEYS.MEMBERS(workspace, teamId),
      });
    },
  });
};