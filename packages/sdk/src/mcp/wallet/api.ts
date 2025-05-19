import { z } from "zod";
import { AppContext, createApiHandler, getEnv } from "../context.ts";
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

const AccountStatements = {
  fetch: async (wallet: ClientOf<WalletAPI>, workspace: string, cursor?: string) => {
    const filter = [
      `type=AgentGeneration`,
      `workspace=${workspace}`,
    ].join(";");

    const statementsResponse = await wallet["GET /transactions"]({
      filter,
      ...(cursor ? { cursor } : {}),
      limit: 50,
    });

    if (!statementsResponse.ok) {
      throw new Error("Failed to fetch statements");
    }

    return statementsResponse.json();
  },
  format: (
    statements: WalletAPI["GET /transactions"]["response"],
  ) => {

    const buildTransactionInfo = ({
      type,
      description,
    }: {
      type: string;
      description?: string;
    }) => {
      switch (type) {
        case "AgentGeneration":
          return {
            title: "Agent usage",
            icon: "robot_2",
            description: description ?? "Agent usage",
          };
        default:
          return {
            title: "Transaction",
            description: description ?? "Transaction",
          };
      }
    };

    return {
      items: statements.items.map((statement) => {
        if (statement.transaction.type !== "AgentGeneration") {
          return null;
        }

        const userGenCreditsEntry = statement.entries[0];

        if (!userGenCreditsEntry) {
          return null;
        }

        const microdollar = MicroDollar.fromMicrodollarString(
          userGenCreditsEntry.amount as unknown as string,
        );
        const amount = microdollar.display();
        const amountExact = microdollar.display({
          showAllDecimals: true,
        });

        return {
          entries: statement.entries,
          timestamp: statement.timestamp,
          type: "debit",
          amount,
          amountExact,
          metadata: statement.transaction.metadata,
          ...buildTransactionInfo(statement.transaction),
        };
      }).filter(Boolean),
      nextCursor: statements.nextCursor,
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

export const getWalletStatements = createApiHandler({
  name: "GET_WALLET_STATEMENTS",
  description: "Get the statements for the current tenant's wallet",
  schema: z.object({
    cursor: z.string().optional(),
  }),
  handler: async ({ cursor }, ctx) => {
    assertHasWorkspace(ctx);
    await assertUserHasAccessToWorkspace(ctx);

    const wallet = getWalletClient(ctx);

    const statements = await AccountStatements.fetch(wallet, ctx.workspace.value, cursor);
    return AccountStatements.format(statements);
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
