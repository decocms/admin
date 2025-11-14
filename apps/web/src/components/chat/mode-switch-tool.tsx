import { useEffect } from "react";
import { useAgentStore } from "../../stores/mode-store.ts";
import type { ToolUIPart } from "./tool-message.tsx";
import type { AgentId } from "@deco/sdk";

interface ModeSwitchToolProps {
  part: ToolUIPart;
}

export function ModeSwitchTool({ part }: ModeSwitchToolProps) {
  const { requestAgentChange } = useAgentStore();

  useEffect(() => {
    // Extract agent decision from tool output
    if (part.state === "output-available" && part.output) {
      const output = part.output as {
        agentId?: AgentId;
        reasoning?: string;
        confidence?: number;
      };

      if (output.agentId && output.reasoning !== undefined) {
        requestAgentChange({
          agentId: output.agentId,
          reasoning: output.reasoning,
          confidence: output.confidence ?? 0.8,
        });
      }
    }
  }, [part.state, part.output, requestAgentChange]);

  // This component doesn't render anything visible
  // It just triggers the agent change dialog
  return null;
}
