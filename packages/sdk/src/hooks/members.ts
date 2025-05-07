import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import {
  addTeamMember,
  getTeamMembers,
  type Member,
  removeTeamMember,
} from "../crud/members.ts";
import { KEYS } from "./api.ts";

/**
 * Hook to fetch team members
 * @param teamId - The ID of the team to fetch members for
 */
export const useTeamMembers = (
  teamId: number | null,
  { withActivity }: { withActivity?: boolean } = { withActivity: false },
) => {
  return useSuspenseQuery({
    queryKey: KEYS.TEAM_MEMBERS(teamId ?? -1),
    queryFn: ({ signal }) =>
      typeof teamId === "number"
        ? getTeamMembers({ teamId, withActivity }, signal)
        : [],
  });
};

/**
 * Hook to add a new team member
 * @returns Mutation function for adding a team member
 */
export const useAddTeamMember = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ teamId, email }: { teamId: number; email: string }) =>
      addTeamMember(teamId, email),
    onSuccess: (newMember, { teamId }) => {
      const membersKey = KEYS.TEAM_MEMBERS(teamId);

      queryClient.cancelQueries({ queryKey: membersKey });
      queryClient.setQueryData<Member[]>(
        membersKey,
        (old) => [newMember, ...(old ?? [])],
      );
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
      const membersKey = KEYS.TEAM_MEMBERS(teamId);

      queryClient.cancelQueries({ queryKey: membersKey });
      queryClient.setQueryData<Member[]>(
        membersKey,
        (old) => old?.filter((member) => member.id !== memberId) ?? [],
      );
    },
  });
};
