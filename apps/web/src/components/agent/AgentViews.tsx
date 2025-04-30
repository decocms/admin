import { useEffect } from "react";
import { useAgent } from "@deco/sdk";
import { openPreviewPanel } from "../chat/utils/preview.ts";

export default function AgentViews({ agentId }: { agentId: string }) {
  const agent = useAgent(agentId);

  useEffect(function addAgentViewsTabs() {
    agent.data.views.forEach((view) => {
      openPreviewPanel({
        id: `agent-${agentId}-view-${view.name}`,
        title: view.name,
        content: view.url,
      });
    });
  }, [agent.data?.views]);

  return null;
}
