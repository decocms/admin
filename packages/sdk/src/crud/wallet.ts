import { MCPClient } from "../fetcher.ts";
import { ProjectLocator } from "../locator.ts";

export const getWalletAccount = (
  locator: ProjectLocator,
): Promise<{
  balance: string;
  balanceExact?: string;
  refetch?: () => Promise<void>;
  isRefetching?: boolean;
}> =>
  MCPClient.forLocator(locator).GET_WALLET_ACCOUNT({}) as Promise<{
    balance: string;
    balanceExact?: string;
    refetch?: () => Promise<void>;
    isRefetching?: boolean;
  }>;

export const getThreadsUsage = (
  locator: ProjectLocator,
  range: "day" | "week" | "month",
): Promise<{
  items: Array<{
    id: string;
    agentId: string;
    generatedBy: string;
    total: string | number;
    tokens?: {
      totalTokens?: number;
      promptTokens?: number;
      completionTokens?: number;
    };
    [key: string]: unknown;
  }>;
}> =>
  MCPClient.forLocator(locator).GET_THREADS_USAGE({
    range,
  }) as Promise<{
    items: Array<{
      id: string;
      agentId: string;
      generatedBy: string;
      total: string | number;
      tokens?: {
        totalTokens?: number;
        promptTokens?: number;
        completionTokens?: number;
      };
      [key: string]: unknown;
    }>;
  }>;

export const getAgentsUsage = (
  locator: ProjectLocator,
  range: "day" | "week" | "month",
): Promise<{
  items: Array<{
    id: string;
    label?: string;
    total: number;
    transactions?: unknown[];
    [key: string]: unknown;
  }>;
}> =>
  MCPClient.forLocator(locator).GET_AGENTS_USAGE({
    range,
  }) as Promise<{
    items: Array<{
      id: string;
      label?: string;
      total: number;
      transactions?: unknown[];
      [key: string]: unknown;
    }>;
  }>;

export const getBillingHistory = (
  locator: ProjectLocator,
  range: "day" | "week" | "month" | "year",
): Promise<{
  items: Array<{
    type: string;
    amount: string;
    timestamp?: string;
    callerApp?: string;
    id?: string;
    [key: string]: unknown;
  }>;
}> =>
  MCPClient.forLocator(locator).GET_BILLING_HISTORY({
    range,
  }) as Promise<{
    items: Array<{
      type: string;
      amount: string;
      timestamp?: string;
      callerApp?: string;
      id?: string;
      [key: string]: unknown;
    }>;
  }>;

export const getContractsCommits = (
  locator: ProjectLocator,
  range: "day" | "week" | "month" | "year",
): Promise<{
  items: Array<{
    contractId?: string;
    amount?: number;
    clauses?: Array<{
      clauseId: string;
      amount: number;
      [key: string]: unknown;
    }>;
    callerApp?: string;
    updatedAt?: string;
    [key: string]: unknown;
  }>;
}> =>
  MCPClient.forLocator(locator).GET_CONTRACTS_COMMITS({
    range,
  }) as Promise<{
    items: Array<{
      contractId?: string;
      amount?: number;
      clauses?: Array<{
        clauseId: string;
        amount: number;
        [key: string]: unknown;
      }>;
      callerApp?: string;
      updatedAt?: string;
      [key: string]: unknown;
    }>;
  }>;

export const createWalletCheckoutSession = ({
  locator,
  amountUSDCents,
  successUrl,
  cancelUrl,
}: {
  locator: ProjectLocator;
  amountUSDCents: number;
  successUrl: string;
  cancelUrl: string;
}): Promise<{ url: string }> =>
  MCPClient.forLocator(locator).CREATE_CHECKOUT_SESSION({
    amountUSDCents,
    successUrl,
    cancelUrl,
  }) as Promise<{ url: string }>;

export const redeemWalletVoucher = ({
  locator,
  voucher,
}: {
  locator: ProjectLocator;
  voucher: string;
}) =>
  MCPClient.forLocator(locator).REDEEM_VOUCHER({
    voucher,
  });

export const createWalletVoucher = ({
  locator,
  amount,
}: {
  locator: ProjectLocator;
  amount: number;
}) =>
  MCPClient.forLocator(locator).CREATE_VOUCHER({
    amount,
  });

export const getWorkspacePlan = async (
  locator: ProjectLocator,
): Promise<{
  id: string;
  title: string;
  user_seats: number;
  remainingSeats: number;
  isAtSeatLimit: boolean;
  created_at: string;
  monthly_credit_in_dollars: number;
  markup: number;
}> => {
  const plan = (await MCPClient.forLocator(locator).GET_WORKSPACE_PLAN({})) as {
    id: string;
    title: string;
    user_seats: number;
    remainingSeats: number;
    isAtSeatLimit: boolean;
    created_at: string;
    monthly_credit_in_dollars: number;
    markup: number;
  };

  return plan;
};
