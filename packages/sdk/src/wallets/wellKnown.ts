export const WellKnownWallets = {
  build: (
    type: string,
    discriminator: string,
    category: string,
  ) => `${type}::${discriminator}@${category}`,
  unwind: (
    wallet: string,
  ) => {
    const [category, discriminatorAndCategory] = wallet.split("::");
    const [discriminator, type] = discriminatorAndCategory.split("@");
    return { type, discriminator, category };
  },
  clearing: {
    pendingWithdrawals: (
      userId: string,
    ) =>
      [
        "clearing" as const,
        `pending-withdrawals-${userId}`,
        "liability" as const,
      ] as const,
  },
  system: {
    forcedGeneration: (anonId: string) =>
      [
        "system" as const,
        `user-forced-generation-${anonId}`,
        "asset" as const,
      ] as const,
    userFreeGeneration: (
      userId: string,
    ) =>
      [
        "system" as const,
        `user-free-generation-${userId}`,
        "asset" as const,
      ] as const,
    userWithdrawableCash: (
      userId: string,
    ) =>
      [
        "system" as const,
        `user-withdrawable-cash-${userId}`,
        "asset" as const,
      ] as const,
    userIssuedCredit: (
      userId: string,
    ) =>
      [
        "system" as const,
        `user-issued-credit-${userId}`,
        "equity" as const,
      ] as const,
    userGivenCredits: (
      userId: string,
    ) =>
      [
        "system" as const,
        `user-given-credits-${userId}`,
        "asset" as const,
      ] as const,
    userCash: (
      userId: string,
    ) => ["system" as const, `user-cash-${userId}`, "asset" as const] as const,
    appRevenue: (
      appId: string,
      userId: string,
    ) =>
      [
        "system" as const,
        `app-${appId}-${userId}`,
        "revenue" as const,
      ] as const,
    mcpRevenue: (
      mcpId: string,
      userId: string,
    ) =>
      [
        "system" as const,
        `mcp-${mcpId}-${userId}`,
        "revenue" as const,
      ] as const,
    agentRevenue: (
      agentId: string,
      userId: string,
    ) =>
      WellKnownWallets.system.mcpRevenue(`deco.chat-agent-${agentId}`, userId),
    modelExpense: (
      model: string,
    ) => ["system" as const, model, "expense" as const] as const,

    modelLiability: (
      model: string,
    ) => ["system" as const, model, "liability" as const] as const,
  },
  user: {
    cash: (
      userId: string,
    ) => ["user" as const, `cash-${userId}`, "liability" as const] as const,
    appAsset: (
      appId: string,
    ) => ["user" as const, `app-${appId}`, "asset" as const] as const,
    genCredits: (
      userId: string,
    ) =>
      [
        "user" as const,
        `gen-credits-${userId}`,
        "liability" as const,
      ] as const,
    mcpAsset: (
      mcpId: string,
    ) => ["user" as const, `mcp-${mcpId}`, "asset" as const] as const,
    agentAsset: (
      agentId: string,
    ) => WellKnownWallets.user.mcpAsset(`deco.chat-agent-${agentId}`),
    preAuthorized: (
      userId: string,
      identifier: string,
    ) =>
      [
        "user" as const,
        `preauth:${userId}:${identifier}`,
        "clearing" as const,
      ] as const,
  },
} as const;

export const WellKnownTransactions = {
  freeTwoDollars: (
    userId: string,
  ) => `free-two-dollars-${userId}`,

  monthlyProCredits: (
    userId: string,
    month: number,
    year: number,
  ) => `monthly-pro-credits-${month}-${year}-${userId}`,

  freeFiftyDollars: (
    userId: string,
  ) => `free-fifty-dollars-${userId}`,
} as const;
