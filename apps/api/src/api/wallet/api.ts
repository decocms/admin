import { z } from "zod";
import { AppContext, createApiHandler, getEnv } from "../../utils/context.ts";
import {
  createWalletClient,
  MicroDollar,
  WalletAPI,
  WellKnownWallets,
} from "@deco/sdk/wallet";
import { ClientOf } from "@deco/sdk/http";

function getWorkspace(c: AppContext) {
  const root = c.req.param("root");
  const wksSlug = c.req.param("slug");
  const workspace = `${root}/${wksSlug}`;
  return { root, wksSlug, workspace };
}

const Account = {
  fetch: async (wallet: ClientOf<WalletAPI>, id: string) => {
    const accountResponse = await wallet["GET /accounts/:id"]({
      id: encodeURIComponent(id),
    });

    if (accountResponse.status === 404) {
      return null;
    }

    if (!accountResponse.ok) {
      throw new Error("Failed to fetch account");
    }

    return accountResponse.json();
  },
  format: (account: WalletAPI["GET /accounts/:id"]["response"]) => {
    return {
      balance: MicroDollar.fromMicrodollarString(account.balance).display(),
      balanceExact: MicroDollar.fromMicrodollarString(account.balance).display({
        showAllDecimals: true,
      }),
    };
  },
};

export const getWalletAccount = createApiHandler({
  name: "GET_WALLET_ACCOUNT",
  description: "Get the wallet account for the current tenant",
  schema: z.object({}),
  handler: async (_, c) => {
    const { workspace } = getWorkspace(c);
    const envVars = getEnv(c);
    // @ts-expect-error todo: type the worker binding
    const wallet = createWalletClient(envVars.WALLET_API_KEY, c.var?.WALLET);

    const workspaceWalletId = WellKnownWallets.build(
      ...WellKnownWallets.workspace(workspace),
    );
    const data = await Account.fetch(wallet, workspaceWalletId);

    if (!data) {
      return {
        balance: MicroDollar.ZERO.display(),
        balanceExact: MicroDollar.ZERO.display({
          showAllDecimals: true,
        }),
      };
    }

    return Account.format(data);
  },
});

export const createCheckoutSession = createApiHandler({
  name: "CREATE_CHECKOUT_SESSION",
  description: "Create a checkout session for the current tenant's wallet",
  schema: z.object({}),
  handler: async (_, c) => {
    const { workspace } = getWorkspace(c);
    const envVars = getEnv(c);
  },
});
