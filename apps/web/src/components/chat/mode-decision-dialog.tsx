import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@deco/ui/components/dialog.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import { useAgentStore } from "../../stores/mode-store.ts";
import { WELL_KNOWN_DECOPILOT_AGENTS, type AgentId } from "@deco/sdk";

const AGENT_DESCRIPTIONS: Record<AgentId, string> = {
  design: "Create design documents and plan implementations",
  code: "Full write access for creating tools, workflows, and views",
  explore: "Test integrations via code execution",
};

export function ModeDecisionDialog() {
  const { pendingAgentChange, confirmAgentChange, rejectAgentChange } =
    useAgentStore();

  if (!pendingAgentChange) return null;

  const { agentId, reasoning, confidence } = pendingAgentChange;

  return (
    <Dialog open={!!pendingAgentChange} onOpenChange={rejectAgentChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Agent Switch Request</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            AI wants to switch to{" "}
            <strong>{WELL_KNOWN_DECOPILOT_AGENTS[agentId].name}</strong>
          </p>
          <div>
            <p className="text-sm font-medium mb-1">Description:</p>
            <p className="text-sm text-muted-foreground">
              {AGENT_DESCRIPTIONS[agentId]}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium mb-1">Reasoning:</p>
            <p className="text-sm text-muted-foreground">{reasoning}</p>
          </div>
          <div>
            <p className="text-sm font-medium mb-1">Confidence:</p>
            <p className="text-sm text-muted-foreground">
              {Math.round(confidence * 100)}%
            </p>
          </div>
          <div className="flex gap-2 justify-end pt-4">
            <Button variant="outline" onClick={rejectAgentChange}>
              Keep Current Agent
            </Button>
            <Button onClick={confirmAgentChange}>Switch Agent</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
