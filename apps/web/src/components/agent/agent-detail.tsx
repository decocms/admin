import { useMemo } from "react";
import AgentEdit from "./edit.tsx";

interface AgentDetailProps {
  resourceUri: string;
}

/**
 * Agent detail view component that accepts a resourceUri and extracts the agentId
 * to render the agent edit page.
 *
 * ResourceUri format: rsc://i:agent-management/agent/{agentId}
 */
export function AgentDetail({ resourceUri }: AgentDetailProps) {
  const agentId = useMemo(() => {
    // Parse resourceUri to extract agentId
    // Format: rsc://i:agent-management/agent/{agentId}
    const parts = resourceUri.split("/");
    return parts[parts.length - 1];
  }, [resourceUri]);

  // Use agentId as threadId as per the pattern in edit.tsx
  return <AgentEdit agentId={agentId} threadId={agentId} />;
}
