import type { AgentId } from "@deco/sdk";

export interface Agent {
  id: AgentId;
  systemPrompt: string;
  tools: string[];
}
