export const WellKnownMcpGroups = {
  AI: "ai-generation",
  Agent: "agent-management",
  AgentSetup: "agent-setup",
  APIKeys: "api-keys-management",
  Channel: "channel-management",
  Contracts: "contracts-management",
  Databases: "databases-management",
  Deconfig: "deconfig-management",
  Email: "email-management",
  FS: "file-system",
  Hosting: "hosting",
  Integration: "integration-management",
  KnowledgeBase: "knowledge-base-",
  KnowledgeBaseManagement: "kb-management",
  Model: "model-management",
  OAuth: "oauth-management",
  Prompt: "prompt-management",
  User: "user-management",
  Registry: "registry-management",
  Sandbox: "code-sandbox",
  Team: "team-management",
  Thread: "thread-management",
  Triggers: "triggers-management",
  Wallet: "wallet-management",
  Tools: "tools-management",
  Workflows: "workflows-management",
  Self: "self",
};

// used to publish on the registry
export const WellKnownAppNames: Partial<typeof WellKnownMcpGroups> = {
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
