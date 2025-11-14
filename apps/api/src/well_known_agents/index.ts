import type { AgentId } from "@deco/sdk";
import { codeAgent } from "./code.ts";
import { designAgent } from "./design.ts";
import { exploreAgent } from "./explore.ts";
import type { Agent } from "./types.ts";

/**
 * Map of well-known agent IDs to their configurations
 */
export const WELL_KNOWN_AGENTS = {
  [designAgent.id]: designAgent,
  [codeAgent.id]: codeAgent,
  [exploreAgent.id]: exploreAgent,
} as Record<AgentId, Agent>;

export type { Agent };
