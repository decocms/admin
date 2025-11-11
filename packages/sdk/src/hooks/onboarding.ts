import { useMutation, useQuery } from "@tanstack/react-query";
import { MCPClient } from "../fetcher.ts";
import { KEYS } from "./react-query-keys.ts";
import type { OnboardingAnswers } from "../mcp/onboarding/api.ts";

/**
 * Hook to get onboarding status
 */
export function useOnboardingAnswers() {
  return useQuery({
    queryKey: KEYS.ONBOARDING_STATUS(),
    queryFn: async () => {
      return await MCPClient.ONBOARDING_GET_STATUS({});
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to save onboarding answers
 */
export function useSaveOnboardingAnswers() {
  return useMutation({
    mutationFn: async (answers: OnboardingAnswers) => {
      return await MCPClient.ONBOARDING_SAVE_ANSWERS(answers);
    },
  });
}

/**
 * Hook to auto-join a team by domain
 */
export function useAutoJoinTeam() {
  return useMutation({
    mutationFn: async (domain: string) => {
      return await MCPClient.TEAM_AUTO_JOIN({ domain });
    },
  });
}
