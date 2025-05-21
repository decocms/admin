import { MCPClient } from "../fetcher.ts";

export const getWalletAccount = async (workspace: string) => {
  const { status, data, error } = await MCPClient.forWorkspace(workspace)
    .GET_WALLET_ACCOUNT({});
  if (status !== 200 || error) {
    throw new Error(error?.message);
  }
  return data;
};

export const getThreadsUsage = async (
  workspace: string,
  range: "day" | "week" | "month",
) => {
  const { status, data, error } = await MCPClient.forWorkspace(workspace)
    .GET_THREADS_USAGE({
      range,
    });
  if (status !== 200 || error) {
    throw new Error(error?.message);
  }
  return data;
};

export const getAgentsUsage = async (
  workspace: string,
  range: "day" | "week" | "month",
) => {
  const { status, data, error } = await MCPClient.forWorkspace(workspace)
    .GET_AGENTS_USAGE({
      range,
    });
  if (status !== 200 || error) {
    throw new Error(error?.message);
  }
  return data;
};

export const createWalletCheckoutSession = async ({
  workspace,
  amountUSDCents,
  successUrl,
  cancelUrl,
}: {
  workspace: string;
  amountUSDCents: number;
  successUrl: string;
  cancelUrl: string;
}) => {
  const { status, data, error } = await MCPClient.forWorkspace(workspace)
    .CREATE_CHECKOUT_SESSION({
      amountUSDCents,
      successUrl,
      cancelUrl,
    });

  if (status !== 200 || error) {
    throw new Error(error?.message);
  }

  return { checkoutUrl: data.url };
};

export const redeemWalletVoucher = async ({
  workspace,
  voucher,
}: {
  workspace: string;
  voucher: string;
}) => {
  const { status, data, error } = await MCPClient.forWorkspace(workspace)
    .REDEEM_VOUCHER({
      voucher,
    });
  if (status !== 200 || error) {
    throw new Error(error?.message);
  }
  return data;
};

export const createWalletVoucher = async ({
  workspace,
  amount,
}: {
  workspace: string;
  amount: number;
}) => {
  const { status, data, error } = await MCPClient.forWorkspace(workspace)
    .CREATE_VOUCHER({
      amount,
    });

  if (status !== 200 || error) {
    throw new Error(error?.message);
  }

  return data;
};
