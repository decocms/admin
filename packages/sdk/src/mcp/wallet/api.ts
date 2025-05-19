import { z } from "zod";
import { AppContext, createApiHandler } from "../context.ts";
import {
  createWalletClient,
  MicroDollar,
  WalletAPI,
  WellKnownWallets,
} from "@deco/sdk/wallet";
import { ClientOf } from "@deco/sdk/http";
import {
  assertHasWorkspace,
  assertUserHasAccessToWorkspace,
} from "../assertions.ts";
import { createCheckoutSession as createStripeCheckoutSession } from "./stripe/checkout.ts";
import { MCPError } from "../errors.ts";

const getWalletClient = (c: AppContext) => {
  if (!c.envVars.WALLET_API_KEY) {
    throw new MCPError("WALLET_API_KEY is not set");
  }
  return createWalletClient(c.envVars.WALLET_API_KEY, c.walletBinding);
};

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

const isNotNull = <T>(value: T | null): value is T => Boolean(value);

const ThreadsUsage = {
  fetch: async (
    wallet: ClientOf<WalletAPI>,
    workspace: string,
    range: "day" | "week" | "month",
  ) => {
    const usageResponse = await wallet["GET /usage/threads"]({
      workspace,
      range,
    });

    if (!usageResponse.ok) {
      throw new Error("Failed to fetch usage");
    }

    return usageResponse.json();
  },
  format: (
    usage: WalletAPI["GET /usage/threads"]["response"],
  ) => {
    return {
      items: usage.items.map((thread) => ({
        ...thread,
        total: MicroDollar.fromMicrodollarString(thread.total).display({
          showAllDecimals: true,
        }),
      })).filter(isNotNull),
    };
  },
};

const AgentsUsage = {
  fetch: async (
    wallet: ClientOf<WalletAPI>,
    workspace: string,
    range: "day" | "week" | "month",
  ) => {
    const usageResponse = await wallet["GET /usage/agents"]({
      workspace,
      range,
    });

    if (!usageResponse.ok) {
      throw new Error("Failed to fetch usage");
    }

    return usageResponse.json();
  },
  format: (usage: WalletAPI["GET /usage/agents"]["response"]) => {
    return {
      total: MicroDollar.fromMicrodollarString(usage.total).display(),
      items: usage.items.map((item) => ({
        id: item.id,
        label: item.label,
        total: MicroDollar.fromMicrodollarString(item.total).toDollars(),
      })),
    };
  },
};

export const getWalletAccount = createApiHandler({
  name: "GET_WALLET_ACCOUNT",
  description: "Get the wallet account for the current tenant",
  schema: z.object({}),
  handler: async (_, c) => {
    assertHasWorkspace(c);
    await assertUserHasAccessToWorkspace(c);

    const wallet = getWalletClient(c);

    const workspaceWalletId = WellKnownWallets.build(
      ...WellKnownWallets.workspace.genCredits(c.workspace.value),
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

export const getThreadsUsage = createApiHandler({
  name: "GET_THREADS_USAGE",
  description: "Get the threads usage for the current tenant's wallet",
  schema: z.object({
    range: z.enum(["day", "week", "month"]),
  }),
  handler: async ({ range }, ctx) => {
    assertHasWorkspace(ctx);
    await assertUserHasAccessToWorkspace(ctx);

    const wallet = getWalletClient(ctx);

    const usage = await ThreadsUsage.fetch(
      wallet,
      ctx.workspace.value,
      range,
    );
    return ThreadsUsage.format(usage);
  },
});

export const getAgentsUsage = createApiHandler({
  name: "GET_AGENTS_USAGE",
  description: "Get the agents usage for the current tenant's wallet",
  schema: z.object({
    range: z.enum(["day", "week", "month"]),
  }),
  handler: async ({ range }, ctx) => {
    assertHasWorkspace(ctx);
    await assertUserHasAccessToWorkspace(ctx);

    const wallet = getWalletClient(ctx);

    const usage = await AgentsUsage.fetch(
      wallet,
      ctx.workspace.value,
      range,
    );
    return AgentsUsage.format(usage);
  },
});

export const createCheckoutSession = createApiHandler({
  name: "CREATE_CHECKOUT_SESSION",
  description: "Create a checkout session for the current tenant's wallet",
  schema: z.object({
    amountUSDCents: z.number(),
    successUrl: z.string(),
    cancelUrl: z.string(),
  }),
  handler: async ({ amountUSDCents, successUrl, cancelUrl }, ctx) => {
    assertHasWorkspace(ctx);
    await assertUserHasAccessToWorkspace(ctx);

    const session = await createStripeCheckoutSession({
      successUrl,
      cancelUrl,
      product: {
        id: "WorkspaceWalletDeposit",
        amountUSD: amountUSDCents,
      },
      ctx,
      metadata: {
        created_by_user_id: ctx.user.id,
        created_by_user_email: ctx.user.email || "",
      },
    });

    return {
      url: session.url,
    };
  },
});
