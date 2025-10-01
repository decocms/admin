export const WellKnownMcpGroups = {
  AI: "ai-gateway",
  Agent: "agents",
  AgentSetup: "agent-crud",
  APIKeys: "api-keys",
  Channel: "channels",
  Contracts: "contracts",
  Databases: "database",
  Deconfig: "deconfig",
  Email: "email-admin",
  FS: "file-system",
  Hosting: "hosting",
  Integration: "integrations",
  KnowledgeBaseManagement: "knowledge-base",
  Model: "ai-models",
  OAuth: "oauth-management",
  Prompt: "prompts",
  User: "users",
  Registry: "registry",
  Sandbox: "code-sandbox",
  Team: "teams",
  Thread: "threads",
  Triggers: "triggers",
  Wallet: "wallet",
  Tools: "tools",
  Workflows: "workflows",
  Self: "self",
};

export type WellKnownMcpGroup = keyof typeof WellKnownMcpGroups;

export const WellKnownMcpGroupIds = Object.values(WellKnownMcpGroups).map(
  (group) => `i:${group}`,
);

/**
 * Utility function to format well-known group names as integration IDs
 * Adds the 'i:' prefix to group names to create proper integration IDs
 */
export function formatIntegrationId(wellKnownGroup: string): string {
  return `i:${wellKnownGroup}`;
}
