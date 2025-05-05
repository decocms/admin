import { useSuspenseQuery } from "@tanstack/react-query";
import { listTeams } from "../crud/teams.ts";
import { KEYS } from "./api.ts";

export const useTeams = () => {
  return useSuspenseQuery({
    queryKey: KEYS.TEAMS(),
    queryFn: ({ signal }) => listTeams({ signal }),
  });
};
