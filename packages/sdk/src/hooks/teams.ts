import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import {
  createTeam,
  CreateTeamInput,
  deleteTeam,
  getTeam,
  listTeams,
  updateTeam,
  UpdateTeamInput,
} from "../crud/teams.ts";
import { KEYS } from "./api.ts";

export const useTeams = () => {
  return useSuspenseQuery({
    queryKey: KEYS.TEAMS(),
    queryFn: ({ signal }) => listTeams({ signal }),
  });
};

export const useTeam = (slug: string = "") => {
  return useSuspenseQuery({
    queryKey: KEYS.TEAM(slug),
    queryFn: ({ signal }) => {
      if (!slug.length) {
        return null;
      }
      return getTeam(slug, { signal });
    },
  });
};

export function useCreateTeam() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTeamInput) => createTeam(input),
    onSuccess: (result) => {
      client.invalidateQueries({ queryKey: KEYS.TEAMS() });
      client.setQueryData(["team", result.slug], result);
    },
  });
}

export function useUpdateTeam() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateTeamInput) => updateTeam(input),
    onSuccess: (result) => {
      client.invalidateQueries({ queryKey: KEYS.TEAMS() });
      client.setQueryData(["team", result.slug], result);
    },
  });
}

export function useDeleteTeam() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (teamId: number) => deleteTeam(teamId),
    onSuccess: (_, teamId) => {
      client.invalidateQueries({ queryKey: KEYS.TEAMS() });
      // Remove all team caches (by id or slug if needed)
    },
  });
}
