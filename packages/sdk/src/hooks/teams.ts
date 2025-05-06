import { useSuspenseQuery } from "@tanstack/react-query";
import { getTeam, listTeams } from "../crud/teams.ts";
import { KEYS } from "./api.ts";

export const useTeams = () => {
  return useSuspenseQuery({
    queryKey: KEYS.TEAMS(),
    queryFn: ({ signal }) => listTeams({ signal }),
  });
};

export const useTeam = (slug: string) => {
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
