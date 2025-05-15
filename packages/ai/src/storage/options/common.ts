import type { Agent, Integration } from "@deco/sdk";
import type { Workspace } from "@deco/sdk/path";

export const agentToIntegration = (
  agent: Agent,
  workspace: Workspace,
): Integration => ({
  id: agent.id,
  name: agent.name,
  description: agent.description,
  icon: agent.avatar,
  connection: { type: "INNATE", name: agent.id, workspace },
});
