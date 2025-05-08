import {
  useRegisterActivity as useSDKRegistryActivity,
  useTeam,
} from "@deco/sdk";

export const useRegistryActivity = (teamSlug?: string) => {
  const { data: team } = useTeam(teamSlug);
  useSDKRegistryActivity(team?.id);
};
