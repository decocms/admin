import z from "zod";
import { WellKnownMcpGroups } from "../../crud/groups.ts";
import { AppContext, createToolFactory } from "../context.ts";
import {
  assertHasWorkspace,
  assertWorkspaceResourceAccess,
  ForbiddenError,
  fromWorkspaceString,
  WithTool,
} from "../index.ts";
import {
  commitPreAuthorizedAmount,
  preAuthorizeAmount,
} from "../wallet/api.ts";

const createContractTool = createToolFactory<WithTool<AppContext>>(
  (c) => {
    if (!("aud" in c.user) || typeof c.user.aud !== "string") {
      throw new ForbiddenError("User not found");
    }
    return {
      ...(c as unknown as WithTool<AppContext>),
      workspace: fromWorkspaceString(c.user.aud!),
    };
  },
  WellKnownMcpGroups.Contracts,
  {
    name: "Contracts",
    description: "Manage smart contracts",
    icon: "https://assets.decocache.com/mcp/5e6930c3-86f6-4913-8de3-0c1fefdf02e3/API-key.png",
  },
);

// Contract clause schema
const ClauseSchema = z.object({
  id: z.string(),
  price: z.number().min(0), // Price in cents/smallest currency unit
  description: z.string(),
  usedByTools: z.array(z.string()).optional(), // Array of tool names that use this clause
});

// Contract state schema extending the default StateSchema
const ContractStateSchema = z.object({
  // Contract terms set during installation
  clauses: z.array(ClauseSchema).default([]),
});
const ContractClauseExerciseSchema = z.object({
  clauseId: z.string(),
  amount: z.number().min(1), // Number of units to charge (multiplied by clause price)
});
type ContractClauseExercise = z.infer<typeof ContractClauseExerciseSchema>;

type ContractState = z.infer<typeof ContractStateSchema>;

const totalAmount = (
  clauses: ContractState["clauses"],
  exercises: ContractClauseExercise[],
) => {
  const prices: Record<string, number> = {};

  for (const clause of clauses) {
    prices[clause.id] = clause.price;
  }

  return exercises.reduce(
    (acc, clause) => acc + prices[clause.clauseId] * clause.amount,
    0,
  );
};

export const oauthStart = createContractTool({
  name: "DECO_CHAT_OAUTH_START",
  description:
    "Start the OAuth flow for the contract app.",
  inputSchema: z.object({
    returnUrl: z.string(),
  }),
  outputSchema: z.object({
    stateSchema: z.any(),
    scopes: z.array(z.string()).optional(),
  }),
  handler: (_, c) => {
    c.resourceAccess.grant();
    return {
      stateSchema: ContractStateSchema,
      scopes: ["PRE_AUTHORIZE_AMOUNT", "COMMIT_PRE_AUTHORIZED_AMOUNT"],
    };
  },
});

export const contractAuthorize = createContractTool({
  name: "CONTRACT_AUTHORIZE",
  description:
    "Authorize a charge for a contract clause. Creates a single authorization with transactionId.",
  inputSchema: z.object({
    clauses: z.array(
      z.object({
        clauseId: z.string(),
        amount: z.number().min(1), // Number of units to charge (multiplied by clause price)
      }),
    ),
  }),
  outputSchema: z.object({
    transactionId: z.string(),
    totalAmount: z.number(),
    timestamp: z.number(),
  }),
  handler: async (context, c) => {
    assertHasWorkspace(c);
    await assertWorkspaceResourceAccess(c);

    if (!("state" in c.user) || typeof c.user.state !== "object") {
      throw new ForbiddenError("User state not found");
    }
    if (
      !("integrationId" in c.user) ||
      typeof c.user.integrationId !== "string"
    ) {
      throw new ForbiddenError("Integration ID not found");
    }

    const state = c.user.state as ContractState;
    const contractId = c.user.integrationId;

    const clauseAmount = totalAmount(state.clauses, context.clauses);

    const { id: transactionId } = await preAuthorizeAmount.handler({
      amount: clauseAmount,
      metadata: {
        contractId,
        clauses: context.clauses,
      },
    });

    return {
      transactionId,
      totalAmount: clauseAmount,
      timestamp: Date.now(),
    };
  },
});

export const contractSettle = createContractTool({
  name: "CONTRACT_SETTLE",
  description:
    "Settle the current authorized charge. Processes the payment for the current authorization.",
  inputSchema: z.union([
    z.object({
      transactionId: z.string(),
      amount: z.number(),
    }),
    z.object({
      transactionId: z.string(),
      clauses: z.array(ContractClauseExerciseSchema),
    }),
  ]),
  outputSchema: z.object({
    transactionId: z.string(),
  }),
  handler: async (context, c) => {
    if (!("appVendor" in c.user) || typeof c.user.appVendor !== "string") {
      throw new ForbiddenError("App vendor not found");
    }

    if (!("state" in c.user) || typeof c.user.state !== "object") {
      throw new ForbiddenError("User state not found");
    }
    if (
      !("integrationId" in c.user) ||
      typeof c.user.integrationId !== "string"
    ) {
      throw new ForbiddenError("Integration ID not found");
    }

    const state = c.user.state as ContractState;
    const contractId = c.user.integrationId;

    await commitPreAuthorizedAmount.handler({
      contractId,
      identifier: context.transactionId,
      amount:
        "amount" in context
          ? context.amount
          : totalAmount(state.clauses, context.clauses),
      vendorId: c.user.appVendor,
    });

    return {
      transactionId: context.transactionId,
    };
  },
});
