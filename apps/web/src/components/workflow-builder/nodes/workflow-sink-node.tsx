import { Handle, type NodeProps, Position } from "@xyflow/react";
import { Card, CardContent } from "@deco/ui/components/card.tsx";
import { Badge } from "@deco/ui/components/badge.tsx";

export interface WorkflowSinkNodeData {
  title: string;
  description?: string;
  schema?: any;
}

/**
 * Sink node representing workflow output
 * Green circle with workflow output information
 */
export function WorkflowSinkNode(props: NodeProps) {
  const { data } = props;

  if (!data || typeof data !== "object") {
    return null;
  }

  const title = "title" in data ? data.title : "Workflow Output";
  const description = "description" in data ? data.description : undefined;
  const schema = "schema" in data ? data.schema : undefined;

  return (
    <>
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 bg-green-500 border-2 border-white"
      />

      <Card className="w-48 h-48 bg-green-50 border-green-300 shadow-md">
        <CardContent className="flex flex-col items-center justify-center h-full p-4">
          <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center mb-2">
            <span className="text-white font-bold text-lg">OUT</span>
          </div>
          <h3 className="text-sm font-semibold text-green-700 text-center mb-1">
            {title}
          </h3>
          {description && (
            <p className="text-xs text-green-600 text-center line-clamp-2">
              {description}
            </p>
          )}
          {schema && (
            <Badge
              variant="secondary"
              className="text-xs mt-1 bg-green-100 text-green-700"
            >
              {Object.keys(schema.properties || {}).length} outputs
            </Badge>
          )}
        </CardContent>
      </Card>
    </>
  );
}
