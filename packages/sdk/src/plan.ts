export const FEATURES = [
  /**
   * Invite members to workspace.
   * Personal workspaces don't have this feature.
   */
  "invite-to-workspace",
  /**
   * AI wallet for managing credits.
   * Free workspaces start with 2.00 USD, and need
   * to upgrade to a paid plan to deposit more.
   */
  "ai-wallet-deposit",
  /**
   * Marks a workspace as a trial workspace.
   */
  "trial-usage",
] as const;

export type Feature = (typeof FEATURES)[number];

export type Plan = "free" | "trial" | "pro";

export const PLANS_FEATURES: Record<Plan, Feature[]> = {
  free: [],
  trial: ["invite-to-workspace", "trial-usage"],
  pro: ["invite-to-workspace", "ai-wallet-deposit"],
} as const;
