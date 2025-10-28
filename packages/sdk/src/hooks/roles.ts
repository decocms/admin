import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createTeamRole,
  deleteTeamRole,
  getTeamRole,
  updateTeamRole,
} from "../crud/roles.ts";
import type { GetTeamRoleParams, TeamRole } from "../crud/roles.ts";
import { KEYS } from "./react-query-keys.ts";

/**
 * Hook to get a specific team role
 */
export function useTeamRole(params: GetTeamRoleParams | null) {
  return useQuery({
    queryKey: params
      ? KEYS.ORG_ROLE(params.teamId, params.roleId)
      : ["roles", "null"],
    queryFn: (): Promise<TeamRole | null> =>
      params ? getTeamRole(params) : Promise.resolve(null),
    enabled: params !== null,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to create a new team role
 */
export function useCreateTeamRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createTeamRole,
    onSuccess: (data) => {
      // Invalidate and refetch team roles
      queryClient.invalidateQueries({
        queryKey: KEYS.ORG_ROLES(data.team_id || 0),
      });

      // Set the new role in cache
      queryClient.setQueryData(KEYS.ORG_ROLE(data.team_id || 0, data.id), data);
    },
  });
}

/**
 * Hook to update a team role
 */
export function useUpdateTeamRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateTeamRole,
    onSuccess: (data, variables) => {
      // Invalidate and refetch team roles
      queryClient.invalidateQueries({
        queryKey: KEYS.ORG_ROLES(variables.teamId),
      });

      // Update the specific role in cache
      queryClient.setQueryData(
        KEYS.ORG_ROLE(variables.teamId, variables.roleId),
        data,
      );
    },
  });
}

/**
 * Hook to delete a team role
 */
export function useDeleteTeamRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteTeamRole,
    onSuccess: (_, variables) => {
      // Invalidate and refetch team roles
      queryClient.invalidateQueries({
        queryKey: KEYS.ORG_ROLES(variables.teamId),
      });

      // Remove the deleted role from cache
      queryClient.removeQueries({
        queryKey: KEYS.ORG_ROLE(variables.teamId, variables.roleId),
      });
    },
  });
}
