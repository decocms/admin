import z from "zod";
import { assertHasWorkspace, assertWorkspaceResourceAccess, ForbiddenError } from "../index.ts";
import { createToolGroup } from "../context.ts";
import { } from "../wallet/api.ts";
const createContractTool = createToolGroup("Contracts", {
  name: "Contracts",
  description: "Manage smart contracts",
  icon: "https://assets.decocache.com/mcp/390f7756-ec01-47e4-bb31-9e7b18f6f56f/database.png",
});

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

type ContractState = z.infer<typeof ContractStateSchema>;

export const contractAuthorize = createContractTool({
  name: "CONTRACT_AUTHORIZE",
  description: "Authorize a charge for a contract clause. Creates a single authorization with transactionId.",
  inputSchema: z.object({
    clauses: z.array(z.object({
      clauseId: z.string(),
      amount: z.number().min(1), // Number of units to charge (multiplied by clause price)
    }))
  }),
  outputSchema: z.object({
    transactionId: z.string(),
    totalAmount: z.number(),
    totalCalculatedPrice: z.number(),
    timestamp: z.number(),
    success: z.boolean(),
    message: z.string(),
    clauseDetails: z.array(z.object({
      clauseId: z.string(),
      amount: z.number(),
      unitPrice: z.number(),
      calculatedPrice: z.number(),
      found: z.boolean(),
    })),
  }),
  handler: async (context, c) => {
    assertHasWorkspace(c);
    await assertWorkspaceResourceAccess(c);

    if (!("state" in c.user) || typeof c.user.state !== "object") {
      throw new ForbiddenError("User state not found");
    }

    const state = c.user.state as ContractState;

    let totalCalculatedPrice = 0;
    let totalAmount = 0;
    const clauseDetails: Array<{
      clauseId: string;
      amount: number;
      unitPrice: number;
      calculatedPrice: number;
      found: boolean;
    }> = [];
    let allClausesFound = true;

    // Process each clause
    for (const requestedClause of context.clauses) {
      const clause = state.clauses.find((c) => c.id === requestedClause.clauseId);

      if (!clause) {
        allClausesFound = false;
        clauseDetails.push({
          clauseId: requestedClause.clauseId,
          amount: requestedClause.amount,
          unitPrice: 0,
          calculatedPrice: 0,
          found: false,
        });
      } else {
        const calculatedPrice = clause.price * requestedClause.amount;
        totalCalculatedPrice += calculatedPrice;
        totalAmount += requestedClause.amount;

        clauseDetails.push({
          clauseId: requestedClause.clauseId,
          amount: requestedClause.amount,
          unitPrice: clause.price,
          calculatedPrice,
          found: true,
        });
      }
    }

    if (!allClausesFound) {
      const missingClauses = clauseDetails
        .filter(c => !c.found)
        .map(c => c.clauseId)
        .join(', ');

      return {
        transactionId: "",
        totalAmount: 0,
        totalCalculatedPrice: 0,
        timestamp: Date.now(),
        success: false,
        message: `Clauses not found in contract: ${missingClauses}`,
        clauseDetails,
      };
    }


    // TODO: Call wallet API here when available
    // await env.WALLET_API.authorize({
    //   transactionId,
    //   amount: totalCalculatedPrice,
    // });

    return {
      transactionId,
      totalAmount,
      totalCalculatedPrice,
      timestamp: Date.now(),
      success: true,
      message: `Successfully authorized ${context.clauses.length} clause(s) for total amount: ${totalCalculatedPrice}`,
      clauseDetails,
    };
  },
});


export const contractSettle = createContractTool({
  name: "CONTRACT_SETTLE",
  description: "Settle the current authorized charge. Processes the payment for the current authorization.",
  inputSchema: z.object({
    transactionId: z.string(),
    amount: z.number(),
  }),
  outputSchema: z.object({
    transactionId: z.string(),
    success: z.boolean(),
    message: z.string(),
  }),
  handler: (context) => {
    // TODO: Call wallet API here when available
    // const result = await env.WALLET_API.settle({
    //   transactionId: context.transactionId,
    // });

    return {
      transactionId: context.transactionId,
      success: true,
      message: `Successfully settled transaction ${context.transactionId}`,
    };
  }
})