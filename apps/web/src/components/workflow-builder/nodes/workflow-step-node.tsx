import { Handle, type NodeProps, Position } from "@xyflow/react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@deco/ui/components/card.tsx";
import { Badge } from "@deco/ui/components/badge.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import { Code, Play, Settings, Trash2 } from "lucide-react";
import type { WorkflowStep } from "@deco/sdk";

export interface WorkflowStepNodeData {
  step: WorkflowStep;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  onEdit?: (step: WorkflowStep) => void;
  onDelete?: (stepId: string) => void;
  onRun?: (step: WorkflowStep) => void;
}

/**
 * Unified node component for workflow steps
 * Every step is autonomous code that can fetch data and execute logic
 * NodeProps already provides the correct typing for data
 */
export function WorkflowStepNode(props: NodeProps) {
  const { data, selected } = props;

  // Type guard to ensure data has the expected shape
  if (!data || typeof data !== "object") {
    return null;
  }

  // Extract properties with type checking
  const step = "step" in data ? data.step : undefined;
  const index =
    "index" in data && typeof data.index === "number" ? data.index : 0;
  const isFirst =
    "isFirst" in data && typeof data.isFirst === "boolean"
      ? data.isFirst
      : false;
  const isLast =
    "isLast" in data && typeof data.isLast === "boolean" ? data.isLast : false;
  const onEdit =
    "onEdit" in data && typeof data.onEdit === "function"
      ? data.onEdit
      : undefined;
  const onDelete =
    "onDelete" in data && typeof data.onDelete === "function"
      ? data.onDelete
      : undefined;
  const onRun =
    "onRun" in data && typeof data.onRun === "function"
      ? data.onRun
      : undefined;

  if (!step || typeof step !== "object") {
    return null;
  }

  // Now we can safely use the step data
  const workflowStep = step as WorkflowStep;

  // Extract tool references for display
  const toolCount = workflowStep.usedTools?.length || 0;
  const hasInput = !!workflowStep.inputSchema;
  const hasOutput = !!workflowStep.outputSchema;

  return (
    <>
      {/* Input handle - except for first node */}
      {!isFirst && (
        <Handle
          type="target"
          position={Position.Left}
          className="w-3 h-3 bg-blue-500 border-2 border-white"
        />
      )}

      <Card
        className={`
        min-w-[320px] max-w-[400px] 
        ${selected ? "ring-2 ring-blue-500 shadow-lg" : "shadow-md"}
        transition-all duration-200 hover:shadow-lg
      `}
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <CardTitle className="text-lg font-semibold">
                {workflowStep.title || `Step ${index + 1}`}
              </CardTitle>
              {workflowStep.description && (
                <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                  {workflowStep.description}
                </p>
              )}
            </div>

            {/* Step number badge */}
            <Badge variant="secondary" className="shrink-0">
              #{index + 1}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          {/* Prompt preview */}
          {workflowStep.prompt && (
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-sm text-gray-700 line-clamp-3">
                "{workflowStep.prompt}"
              </p>
            </div>
          )}

          {/* Metadata badges */}
          <div className="flex flex-wrap gap-2">
            {toolCount > 0 && (
              <Badge variant="outline" className="text-xs">
                🔧 {toolCount} tool{toolCount !== 1 ? "s" : ""}
              </Badge>
            )}
            {hasInput && (
              <Badge variant="outline" className="text-xs">
                📥 Has input
              </Badge>
            )}
            {hasOutput && (
              <Badge variant="outline" className="text-xs">
                📤 Has output
              </Badge>
            )}
            {workflowStep.code && (
              <Badge variant="outline" className="text-xs">
                <Code className="w-3 h-3 mr-1" />
                Code ready
              </Badge>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 pt-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => onEdit?.(workflowStep)}
              className="flex-1"
            >
              <Settings className="w-3 h-3 mr-1" />
              Edit
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={() => onRun?.(workflowStep)}
              className="flex-1"
            >
              <Play className="w-3 h-3 mr-1" />
              Test
            </Button>

            {!isFirst && !isLast && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onDelete?.(workflowStep.id)}
                className="text-red-600 hover:bg-red-50"
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            )}
          </div>

          {/* Execution result preview if available */}
          {/* TODO: Get execution state from workflow.executionState[step.id] */}
        </CardContent>
      </Card>

      {/* Output handle - except for last node */}
      {!isLast && (
        <Handle
          type="source"
          position={Position.Right}
          className="w-3 h-3 bg-green-500 border-2 border-white"
        />
      )}
    </>
  );
}
