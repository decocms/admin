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
  user: {
    genCredits: (
      userId: string,
    ) =>
      [
        "user" as const,
        `gen-credits-${userId}`,
        "liability" as const,
      ] as const,
  },
} as const;

export const WellKnownTransactions = {
  freeTwoDollars: (
    userId: string,
  ) => `free-two-dollars-${userId}`,
} as const;
