import { MCPClient } from "../fetcher.ts";
import { Workspace } from "../locator.ts";

export const getWalletAccount = (workspace: Workspace) =>
  MCPClient.forWorkspace(workspace).GET_WALLET_ACCOUNT({});

export const getThreadsUsage = (
  workspace: Workspace,
  range: "day" | "week" | "month",
) =>
  MCPClient.forWorkspace(workspace).GET_THREADS_USAGE({
    range,
  });

export const getAgentsUsage = (
  workspace: Workspace,
  range: "day" | "week" | "month",
) =>
  MCPClient.forWorkspace(workspace).GET_AGENTS_USAGE({
    range,
  });

export const getBillingHistory = (
  workspace: Workspace,
  range: "day" | "week" | "month" | "year",
) =>
  MCPClient.forWorkspace(workspace).GET_BILLING_HISTORY({
    range,
  });

export const createWalletCheckoutSession = ({
  workspace,
  amountUSDCents,
  successUrl,
  cancelUrl,
}: {
  workspace: Workspace;
  amountUSDCents: number;
  successUrl: string;
  cancelUrl: string;
}) =>
  MCPClient.forWorkspace(workspace).CREATE_CHECKOUT_SESSION({
    amountUSDCents,
    successUrl,
    cancelUrl,
  });

export const redeemWalletVoucher = ({
  workspace,
  voucher,
}: {
  workspace: Workspace;
  voucher: string;
}) =>
  MCPClient.forWorkspace(workspace).REDEEM_VOUCHER({
    voucher,
  });

export const createWalletVoucher = ({
  workspace,
  amount,
}: {
  workspace: Workspace;
  amount: number;
}) =>
  MCPClient.forWorkspace(workspace).CREATE_VOUCHER({
    amount,
  });

export const getWorkspacePlan = async (workspace: Workspace) => {
  const plan = await MCPClient.forWorkspace(workspace).GET_WORKSPACE_PLAN({});

  return plan;
};
