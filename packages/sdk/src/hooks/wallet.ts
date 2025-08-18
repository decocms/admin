import {
  getAgentsUsage,
  getBillingHistory,
  getThreadsUsage,
  getWalletAccount,
  getWorkspacePlan,
  redeemWalletVoucher,
} from "../crud/wallet.ts";
import { KEYS } from "./api.ts";
import { useSDK } from "./store.tsx";
import { useQueryClient, useSuspenseQuery, useMutation } from "@tanstack/react-query";

export function useWorkspaceWalletBalance() {
  const { workspace } = useSDK();
  const queryClient = useQueryClient();
  const { data: account, isRefetching } = useSuspenseQuery({
    queryKey: KEYS.WALLET(workspace),
    queryFn: () => getWalletAccount(workspace),
  });

  return {
    ...account,
    refetch: () =>
      queryClient.invalidateQueries({ queryKey: KEYS.WALLET(workspace) }),
    isRefetching,
  };
}

export function useUsagePerAgent({
  range,
}: {
  range: "day" | "week" | "month";
}) {
  const { workspace } = useSDK();

  const { data: usage } = useSuspenseQuery({
    queryKey: KEYS.WALLET_USAGE_AGENTS(workspace, range),
    queryFn: () => getAgentsUsage(workspace, range),
  });

  return usage;
}

export type AgentUsage = Awaited<ReturnType<typeof useUsagePerAgent>>;
export type AgentUsageItem = AgentUsage["items"][number];

export function useUsagePerThread({
  range,
}: {
  range: "day" | "week" | "month";
}) {
  const { workspace } = useSDK();
  const { data: usage } = useSuspenseQuery({
    queryKey: KEYS.WALLET_USAGE_THREADS(workspace, range),
    queryFn: () => getThreadsUsage(workspace, range),
  });

  return usage;
}

export type ThreadUsage = Awaited<ReturnType<typeof useUsagePerThread>>;
export type ThreadUsageItem = ThreadUsage["items"][number];

export function useBillingHistory({
  range,
}: {
  range: "day" | "week" | "month" | "year";
}) {
  const { workspace } = useSDK();
  const { data: billingHistory } = useSuspenseQuery({
    queryKey: KEYS.WALLET_BILLING_HISTORY(workspace, range),
    queryFn: () => getBillingHistory(workspace, range),
  });

  return billingHistory;
}

export type BillingHistoryItem = Awaited<
  ReturnType<typeof useBillingHistory>
>["items"][number];

export function usePlan() {
  const { workspace } = useSDK();
  const { data: plan } = useSuspenseQuery({
    queryKey: KEYS.WORKSPACE_PLAN(workspace),
    queryFn: () => getWorkspacePlan(workspace),
  });

  return plan;
}

export function useClaimOnboardingBonus() {
  const { workspace } = useSDK();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async () => {
      // Use a special voucher code for onboarding bonus
      // This should be configured on the backend to add $2
      const result = await redeemWalletVoucher({
        workspace,
        voucher: "ONBOARDING_BONUS_2USD",
      });
      return result;
    },
    onSuccess: () => {
      // Invalidate wallet balance to refresh it
      queryClient.invalidateQueries({ queryKey: KEYS.WALLET(workspace) });
    },
  });
}
