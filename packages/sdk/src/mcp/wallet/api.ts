import type { ClientOf } from "@deco/sdk/http";
import { z } from "zod";
import { WebCache } from "../../cache/index.ts";
import { InternalServerError, UserInputError } from "../../errors.ts";
import { Markup } from "../../plan.ts";
import { isRequired } from "../../utils/fns.ts";
import {
  assertHasLocator,
  assertWorkspaceResourceAccess,
} from "../assertions.ts";
import { type AppContext, createToolGroup } from "../context.ts";
import {
  createWalletClient,
  MicroDollar,
  type WalletAPI,
  WellKnownWallets,
  WellKnownTransactions,
} from "./index.ts";
import { getPlan } from "./plans.ts";
import { createCheckoutSession as createStripeCheckoutSession } from "./stripe/checkout.ts";
import { Locator, ProjectLocator } from "../../locator.ts";

/**
 * Since we don't yet have a setup that connects to an ORGANIZATION's MCP,
 * the wallet tools use a project locator, and are served from the PROJECT mcp.
 *
 * Even though the wallet tools are served from the PROJECT mcp, they are organization scoped.
 *
 * We care only about the organization itself here, and the project slug coming from the
 * context is only used to identify (FOR NOW) the type of wallet (workpaces had different types,
 * which are /users/{userId} and /shared/{slug}.) We assume that you will connect to the project
 * mcp using a project slug called "default" for /shared wallets (most of the cases) and use a
 * project slug called "personal" for /users/{userId} wallets.
 *
 * I will soon remove this assumption probably, and migrate the wallets to use the same id ideally.
 * Otherwise i will need to always identify the type of wallet for the organization in some way,
 * storing org metadata or something like that.
 */

export const getWalletClient = (c: AppContext) => {
  if (!c.envVars.WALLET_API_KEY) {
    throw new InternalServerError("WALLET_API_KEY is not set");
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

const ThreadsUsage = {
  fetch: async (
    wallet: ClientOf<WalletAPI>,
    workspace: string,
    range: "day" | "week" | "month",
  ) => {
    const usageResponse = await wallet["GET /usage/threads"]({
      workspace: encodeURIComponent(workspace),
      range,
    });

    if (!usageResponse.ok) {
      throw new Error("Failed to fetch usage");
    }

    return usageResponse.json();
  },
  format: (usage: WalletAPI["GET /usage/threads"]["response"]) => {
    return {
      items: usage.items
        .map((thread) => ({
          ...thread,
          total: MicroDollar.fromMicrodollarString(thread.total).display({
            showAllDecimals: true,
          }),
          transactions: thread.transactions.map((transaction) => ({
            id: transaction.id,
            timestamp: transaction.timestamp,
            amount: MicroDollar.fromMicrodollarString(
              transaction.amount,
            ).toDollars(),
            agentId: transaction.agentId,
            generatedBy: transaction.generatedBy,
          })),
        }))
        .filter(isRequired),
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
        transactions: item.transactions.map((transaction) => ({
          id: transaction.id,
          timestamp: transaction.timestamp,
          amount: MicroDollar.fromMicrodollarString(
            transaction.amount,
          ).toDollars(),
          agentId: transaction.agentId,
          generatedBy: transaction.generatedBy,
        })),
      })),
    };
  },
};

const BillingHistory = {
  fetch: async (
    wallet: ClientOf<WalletAPI>,
    workspace: string,
    range: "day" | "week" | "month" | "year",
  ) => {
    const historyResponse = await wallet["GET /billing/history"]({
      workspace: encodeURIComponent(workspace),
      range,
    });

    if (!historyResponse.ok) {
      throw new Error("Failed to fetch billing history");
    }

    return historyResponse.json();
  },
  format: (history: WalletAPI["GET /billing/history"]["response"]) => {
    return {
      items: history.items.map((item) => ({
        ...item,
        amount: MicroDollar.fromMicrodollarString(item.amount).display(),
      })),
    };
  },
};

const ContractsCommits = {
  fetch: async (
    wallet: ClientOf<WalletAPI>,
    workspace: string,
    range: "day" | "week" | "month" | "year",
  ) => {
    const historyResponse = await wallet["GET /contracts/commits"]({
      workspace: encodeURIComponent(workspace),
      range,
    });

    if (!historyResponse.ok) {
      throw new Error("Failed to fetch billing history");
    }

    return historyResponse.json();
  },
  format: (history: WalletAPI["GET /contracts/commits"]["response"]) => {
    return {
      items: history.items.map((item) => {
        return {
          ...item,
          amount: item.amount,
        };
      }),
    };
  },
};

const createTool = createToolGroup("Wallet", {
  name: "Wallet & Billing",
  description: "Handle payments and subscriptions.",
  icon: "https://assets.decocache.com/mcp/c179a1cd-4933-40ac-a9c1-18f24e19e592/Wallet--Billing.png",
});

// Cache for tracking if wallets have received their welcome credit rewards
const userCreditsRewardsCache = new WebCache<boolean>(
  "wallet_user_credits_rewards",
  WebCache.MAX_SAFE_TTL,
);

/**
 * Ensures that the workspace receives their $2 welcome credit reward
 * Uses idempotent PUT with well-known transaction ID to prevent duplicates
 */
async function ensureCreditRewards(
  wallet: ClientOf<WalletAPI>,
  workspace: string,
) {
  const operation = {
    type: "WorkspaceGenCreditReward" as const,
    amount: "2_000000", // $2 in microdollars
    workspace,
    transactionId: WellKnownTransactions.freeTwoDollars(
      encodeURIComponent(workspace),
    ),
  };

  let retries = 3;
  while (retries > 0) {
    const response = await wallet["PUT /transactions/:id"](
      { id: operation.transactionId },
      { body: operation },
    );

    response?.body?.cancel().catch(() => {});

    if (response.ok || response.status === 304) {
      // Success or already exists (304 Not Modified)
      return;
    }

    // Retry on conflict
    if (response.status === 409) {
      retries--;
      if (retries > 0) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        continue;
      }
    }

    throw new Error(
      `Failed to ensure credit rewards: ${JSON.stringify(operation)}`,
    );
  }
}

/**
 * Checks cache and ensures credit rewards are given if needed
 */
async function rewardFreeCreditsIfNeeded(
  wallet: ClientOf<WalletAPI>,
  workspace: string,
) {
  const wasRewarded = await userCreditsRewardsCache.get(workspace);

  if (wasRewarded) {
    // User was already rewarded, skip
    return;
  }

  try {
    await ensureCreditRewards(wallet, workspace);
    // Mark as rewarded in cache
    await userCreditsRewardsCache.set(workspace, true);
  } catch (error) {
    console.error("Failed to ensure credit rewards", error);
    // Don't throw - we still want to return the balance even if rewards failed
  }
}

export const organizationWalletWorkspace = (
  locator: ProjectLocator,
  userId?: unknown,
) => {
  return Locator.adaptToRootSlug(locator, userId ? String(userId) : undefined);
};

export const organizationWalletId = (
  locator: ProjectLocator,
  userId?: unknown,
) => {
  const workspace = organizationWalletWorkspace(locator, userId);
  return WellKnownWallets.build(
    ...WellKnownWallets.workspace.genCredits(workspace),
  );
};

export const getWalletAccount = createTool({
  name: "GET_WALLET_ACCOUNT",
  description: "Get the wallet account for the current tenant",
  inputSchema: z.lazy(() => z.object({})),
  outputSchema: z.lazy(() =>
    z.object({
      balance: z.string(),
      balanceExact: z.string(),
    }),
  ),
  handler: async (_, c) => {
    assertHasLocator(c);

    await assertWorkspaceResourceAccess(c);

    const wallet = getWalletClient(c);
    const workspace = organizationWalletWorkspace(c.locator.value, c.user.id);

    // Ensure the workspace receives their $2 welcome credit reward on first access
    await rewardFreeCreditsIfNeeded(wallet, workspace);

    const walletId = organizationWalletId(c.locator.value, c.user.id);
    const data = await Account.fetch(wallet, walletId);

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

export const getThreadsUsage = createTool({
  name: "GET_THREADS_USAGE",
  description: "Get the threads usage for the current tenant's wallet",
  inputSchema: z.lazy(() =>
    z.object({
      range: z.enum(["day", "week", "month"]),
    }),
  ),
  handler: async ({ range }, c) => {
    assertHasLocator(c);

    await assertWorkspaceResourceAccess(c);

    const wallet = getWalletClient(c);

    const usage = await ThreadsUsage.fetch(
      wallet,
      organizationWalletWorkspace(c.locator.value, c.user.id),
      range,
    );
    return ThreadsUsage.format(usage);
  },
});

export const getAgentsUsage = createTool({
  name: "GET_AGENTS_USAGE",
  description: "Get the agents usage for the current tenant's wallet",
  inputSchema: z.lazy(() =>
    z.object({
      range: z.enum(["day", "week", "month"]),
    }),
  ),
  outputSchema: z.lazy(() =>
    z.object({
      total: z.string(),
      items: z.array(
        z.object({
          id: z.string(),
          label: z.string().nullish(),
          total: z.number(),
          transactions: z.array(
            z.object({
              id: z.string(),
              timestamp: z.string(),
              amount: z.number(),
              agentId: z.string().nullish(),
              generatedBy: z.string().nullish(),
            }),
          ),
        }),
      ),
    }),
  ),
  handler: async ({ range }, c) => {
    assertHasLocator(c);

    await assertWorkspaceResourceAccess(c);

    const wallet = getWalletClient(c);

    const usage = await AgentsUsage.fetch(
      wallet,
      organizationWalletWorkspace(c.locator.value, c.user.id),
      range,
    );
    return AgentsUsage.format(usage);
  },
});

export const getBillingHistory = createTool({
  name: "GET_BILLING_HISTORY",
  description: "Get the billing history for the current tenant's wallet",
  inputSchema: z.lazy(() =>
    z.object({
      range: z.enum(["day", "week", "month", "year"]),
    }),
  ),
  outputSchema: z.lazy(() =>
    z.object({
      items: z.array(
        z.object({
          id: z.string(),
          amount: z.string(),
          timestamp: z.string(),
          type: z.string(),
          contractId: z.string().nullish(),
          callerApp: z.string().nullish(),
        }),
      ),
    }),
  ),
  handler: async ({ range }, c) => {
    assertHasLocator(c);

    await assertWorkspaceResourceAccess(c);

    const wallet = getWalletClient(c);

    const history = await BillingHistory.fetch(
      wallet,
      organizationWalletWorkspace(c.locator.value, c.user.id),
      range,
    );
    return BillingHistory.format(history);
  },
});

export const getContractsCommits = createTool({
  name: "GET_CONTRACTS_COMMITS",
  description: "Get the contracts commits for the current tenant's wallet",
  inputSchema: z.lazy(() =>
    z.object({
      range: z.enum(["day", "week", "month", "year"]),
    }),
  ),
  outputSchema: z.lazy(() =>
    z.object({
      items: z.array(
        z.object({
          id: z.string(),
          amount: z.number(),
          contractId: z.string(),
          callerApp: z.string().nullish(),
          clauses: z.array(
            z.object({
              clauseId: z.string(),
              amount: z.number(),
            }),
          ),
          timestamp: z.string(),
          type: z.string(),
        }),
      ),
    }),
  ),
  handler: async ({ range }, c) => {
    assertHasLocator(c);

    await assertWorkspaceResourceAccess(c);

    const wallet = getWalletClient(c);

    const history = await ContractsCommits.fetch(
      wallet,
      organizationWalletWorkspace(c.locator.value, c.user.id),
      range,
    );

    const formatted = ContractsCommits.format(history);
    return formatted;
  },
});

export const createCheckoutSession = createTool({
  name: "CREATE_CHECKOUT_SESSION",
  description: "Create a checkout session for the current tenant's wallet",
  inputSchema: z.lazy(() =>
    z.object({
      amountUSDCents: z.number(),
      successUrl: z.string(),
      cancelUrl: z.string(),
    }),
  ),
  outputSchema: z.lazy(() =>
    z.object({
      url: z.string(),
    }),
  ),
  handler: async ({ amountUSDCents, successUrl, cancelUrl }, ctx) => {
    assertHasLocator(ctx);
    await assertWorkspaceResourceAccess(ctx);
    const plan = await getPlan(ctx);
    const amount = Markup.add({
      usdCents: amountUSDCents,
      markupPercentage: plan.markup,
    });

    const session = await createStripeCheckoutSession({
      successUrl,
      cancelUrl,
      product: {
        id: "WorkspaceWalletDeposit",
        amountUSD: amount,
      },
      ctx,
      metadata: {
        created_by_user_id: ctx.user.id as string,
        created_by_user_email: (ctx.user.email || "") as string,
      },
    });

    return {
      url: session.url,
    };
  },
});

export const createWalletVoucher = createTool({
  name: "CREATE_VOUCHER",
  description: "Create a voucher with money from the current tenant's wallet",
  inputSchema: z.lazy(() =>
    z.object({
      amount: z
        .number()
        .describe(
          "The amount of money to add to the voucher. Specified in USD dollars.",
        ),
    }),
  ),
  outputSchema: z.lazy(() =>
    z.object({
      id: z.string(),
    }),
  ),
  handler: async ({ amount }, c) => {
    assertHasLocator(c);

    await assertWorkspaceResourceAccess(c);

    const wallet = getWalletClient(c);
    const id = crypto.randomUUID();
    const amountMicroDollars = MicroDollar.fromDollars(amount);
    const claimableId = `${id}-${amountMicroDollars.toMicrodollarString()}`;

    if (amountMicroDollars.isZero() || amountMicroDollars.isNegative()) {
      throw new UserInputError("Amount must be positive");
    }

    const operation = {
      type: "WorkspaceCreateVoucher" as const,
      amount: amountMicroDollars.toMicrodollarString(),
      voucherId: id,
      workspace: organizationWalletWorkspace(c.locator.value, c.user.id),
    } as const;

    const response = await wallet["POST /transactions"](
      {},
      {
        body: operation,
      },
    );

    if (!response.ok) {
      throw new Error("Failed to create voucher");
    }

    return {
      id: claimableId,
    };
  },
});

export const redeemWalletVoucher = createTool({
  name: "REDEEM_VOUCHER",
  description: "Redeem a voucher for the current tenant's wallet",
  inputSchema: z.lazy(() =>
    z.object({
      voucher: z
        .string()
        .regex(/^[a-f0-9-]+-\d+_?\d*$/, "Invalid voucher format"),
    }),
  ),
  outputSchema: z.lazy(() =>
    z.object({
      voucherId: z.string(),
    }),
  ),
  handler: async ({ voucher }, c) => {
    assertHasLocator(c);

    await assertWorkspaceResourceAccess(c);

    const wallet = getWalletClient(c);

    const parts = voucher.split("-");
    const voucherId = parts.slice(0, -1).join("-");
    const amountHintMicroDollars = parts.at(-1);

    if (!amountHintMicroDollars) {
      throw new UserInputError("Invalid voucher ID");
    }

    const amountMicroDollars = MicroDollar.fromMicrodollarString(
      amountHintMicroDollars,
    );

    if (amountMicroDollars.isZero() || amountMicroDollars.isNegative()) {
      throw new UserInputError("Invalid voucher ID");
    }

    const operation = {
      type: "WorkspaceRedeemVoucher" as const,
      amount: amountMicroDollars.toMicrodollarString(),
      voucherId,
      workspace: organizationWalletWorkspace(c.locator.value, c.user.id),
    } as const;

    const response = await wallet["POST /transactions"](
      {},
      {
        body: operation,
      },
    );

    if (!response.ok) {
      throw new Error("Failed to redeem voucher");
    }

    return {
      voucherId,
    };
  },
});

export const getWorkspacePlan = createTool({
  name: "GET_WORKSPACE_PLAN",
  description: "Get the plan for the current tenant's workspace",
  inputSchema: z.lazy(() => z.object({})),
  handler: async (_, c) => {
    assertHasLocator(c);
    await assertWorkspaceResourceAccess(c);

    return await getPlan(c);
  },
});

export const preAuthorizeAmount = createTool({
  name: "PRE_AUTHORIZE_AMOUNT",
  description:
    "Pre-authorize an amount of money for the current tenant's wallet",
  inputSchema: z.lazy(() =>
    z.object({
      amount: z
        .union([z.string(), z.number()])
        .describe(
          "The amount (in microdollars) of money to pre-authorize. Specified in USD dollars.",
        ),
      metadata: z.record(z.string(), z.unknown()).optional(),
    }),
  ),
  outputSchema: z.lazy(() =>
    z.object({
      id: z.string(),
    }),
  ),
  handler: async ({ amount, metadata }, c) => {
    assertHasLocator(c);
    await assertWorkspaceResourceAccess(c);

    const wallet = getWalletClient(c);
    const id = crypto.randomUUID();
    const amountMicroDollars = MicroDollar.from(amount);

    if (amountMicroDollars.isZero() || amountMicroDollars.isNegative()) {
      throw new UserInputError("Amount must be positive");
    }

    const operation = {
      type: "PreAuthorization" as const,
      amount: amountMicroDollars.toMicrodollarString(),
      identifier: id,
      payer: {
        type: "wallet",
        id: organizationWalletWorkspace(c.locator.value, c.user.id),
      },
      metadata: {
        ...metadata,
        workspace: organizationWalletWorkspace(c.locator.value, c.user.id),
      },
    } as const;

    const response = await wallet["POST /transactions"](
      {},
      {
        body: operation,
      },
    );

    if (!response.ok) {
      throw new Error("Failed to pre-authorize amount");
    }

    const data = await response.json();

    return {
      id: data.id,
    };
  },
});

export const commitPreAuthorizedAmount = createTool({
  name: "COMMIT_PRE_AUTHORIZED_AMOUNT",
  description:
    "Commit a pre-authorized amount of money for the current tenant's wallet",
  inputSchema: z.lazy(() =>
    z.object({
      identifier: z.string().optional(),
      contractId: z.string(),
      vendorId: z.string(),
      amount: z
        .union([z.string(), z.number()])
        .describe(
          "The amount (in microdollars) of money to commit. Specified in USD dollars.",
        ),
      metadata: z.record(z.string(), z.unknown()).optional(),
    }),
  ),
  outputSchema: z.lazy(() =>
    z.object({
      id: z.string(),
    }),
  ),
  handler: async (
    { amount, metadata, contractId, vendorId, identifier },
    c,
  ) => {
    assertHasLocator(c);

    await assertWorkspaceResourceAccess(c);

    const wallet = getWalletClient(c);
    const amountMicroDollars = MicroDollar.from(amount);

    if (amountMicroDollars.isZero() || amountMicroDollars.isNegative()) {
      throw new UserInputError("Amount must be positive");
    }

    identifier ??= crypto.randomUUID();

    const operation = {
      type: "CommitPreAuthorized" as const,
      amount: amountMicroDollars.toMicrodollarString(),
      identifier,
      contractId,
      vendor: {
        type: "vendor",
        id: vendorId,
      },
      metadata: {
        ...metadata,
        workspace: organizationWalletWorkspace(c.locator.value, c.user.id),
      },
    } as const;

    const response = await wallet["POST /transactions/:id/commit"](
      {
        id: identifier,
      },
      {
        body: operation,
      },
    );

    if (!response.ok) {
      throw new Error(
        `Failed to commit pre-authorized amount. Error: ${response.statusText}`,
      );
    }

    const data = await response.json();

    return {
      id: data.id,
    };
  },
});
