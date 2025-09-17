// deno-lint-ignore-file ensure-tailwind-design-system-tokens/ensure-tailwind-design-system-tokens
import { useIntegrations } from "@deco/sdk";
import { Badge } from "@deco/ui/components/badge.tsx";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@deco/ui/components/card.tsx";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@deco/ui/components/dialog.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Handle, type NodeProps, Position } from "@xyflow/react";
import { useMemo, useState } from "react";
import { IntegrationIcon } from "../../integrations/common.tsx";

// Define the step type based on the actual workflow structure
type WorkflowStep = {
  type: "code" | "tool_call";
  def: {
    name: string;
    description: string;
    execute?: string; // For code steps
    tool_name?: string; // For tool_call steps
    integration?: string; // For tool_call steps
    options?: Record<string, unknown>; // For tool_call steps
  };
};

export interface WorkflowStepDisplayNodeData {
  step: WorkflowStep;
  index: number;
  integrationId?: string; // Just the ID, we'll fetch the full integration details
}

/**
 * Display node for workflow steps (tool_call or code)
 * Tool calls show integration icon, code show code dialog
 */
export function WorkflowStepDisplayNode(props: NodeProps) {
  const { data } = props;
  const [showCodeDialog, setShowCodeDialog] = useState(false);

  if (!data || typeof data !== "object") {
    return null;
  }

  const step =
    "step" in data ? (data.step as Record<string, unknown>) : undefined;
  const stepDef =
    step && "def" in step ? (step.def as Record<string, unknown>) : undefined;
  const index =
    "index" in data && typeof data.index === "number" ? data.index : 0;
  const integrationId =
    stepDef && "integration" in stepDef ? stepDef.integration : undefined;

  if (!step || typeof step !== "object") {
    return null;
  }

  const workflowStep = step as WorkflowStep;
  const isCode = workflowStep.type === "code";
  const isToolCall = workflowStep.type === "tool_call";

  // Fetch integrations and find the matching one
  const { data: integrations = [] } = useIntegrations();
  const integration = useMemo(() => {
    if (!integrationId || !integrations.length) return null;
    return integrations.find((integ) => integ.id === integrationId) || null;
  }, [integrationId, integrations]);

  const handleClick = () => {
    if (isCode) {
      setShowCodeDialog(true);
    }
  };

  return (
    <>
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 bg-blue-500 border-2 border-white"
      />

      <Card
        className={`
          w-48 h-48 shadow-md cursor-pointer transition-all duration-200 hover:shadow-lg p-2
          ${isCode ? "bg-purple-50 border-purple-300" : "bg-white border-gray-300"}
        `}
        onClick={handleClick}
      >
        <CardHeader className="p-0">
          <div className="flex items-start justify-between">
            <CardTitle className="text-sm font-semibold">
              {workflowStep.def.name}
            </CardTitle>
            <Badge variant="secondary" className="text-xs">
              #{index + 1}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="flex flex-col items-center justify-center h-full">
          {isToolCall && integration && (
            <div className="flex flex-col items-center gap-2">
              <IntegrationIcon
                icon={integration.icon}
                name={integration.name}
                size="xl"
              />
              <p className="text-xs text-gray-600 text-center line-clamp-2">
                {workflowStep.def.description}
              </p>
            </div>
          )}

          {isCode && (
            <div className="flex flex-col items-center gap-2">
              <div className="w-12 h-12 bg-purple-500 rounded flex items-center justify-center">
                <Icon name="code" size={32} className="text-white" />
              </div>
              <p className="text-xs text-purple-600 text-center line-clamp-2">
                {workflowStep.def.description}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 bg-blue-500 border-2 border-white"
      />

      {/* Code Dialog for Code Steps */}
      {isCode && (
        <Dialog open={showCodeDialog} onOpenChange={setShowCodeDialog}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-auto">
            <DialogHeader>
              <DialogTitle>Code: {workflowStep.def.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <h4 className="font-medium mb-2">Description:</h4>
                <p className="text-sm text-gray-600">
                  {workflowStep.def.description}
                </p>
              </div>
              <div>
                <h4 className="font-medium mb-2">Code:</h4>
                <pre className="bg-gray-100 p-4 rounded-lg text-sm overflow-auto">
                  <code>{workflowStep.def.execute}</code>
                </pre>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
