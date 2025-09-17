import { Handle, type NodeProps, Position } from "@xyflow/react";
import { Card, CardContent } from "@deco/ui/components/card.tsx";
import { Badge } from "@deco/ui/components/badge.tsx";

export interface WorkflowSourceNodeData {
  title: string;
  description?: string;
  schema?: any;
}

/**
 * Source node representing workflow input
 * Gray circle with workflow input information
 */
export function WorkflowSourceNode(props: NodeProps) {
  const { data } = props;

  if (!data || typeof data !== "object") {
    return null;
  }

  const title = "title" in data ? data.title : "Workflow Input";
  const description = "description" in data ? data.description : undefined;
  const schema = "schema" in data ? data.schema : undefined;

  return (
    <>
      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 bg-gray-500 border-2 border-white"
      />

      <Card className="w-48 h-48 bg-gray-100 border-gray-300 shadow-md">
        <CardContent className="flex flex-col items-center justify-center h-full p-4">
          <div className="w-12 h-12 bg-gray-400 rounded-full flex items-center justify-center mb-2">
            <span className="text-white font-bold text-lg">IN</span>
          </div>
          <h3 className="text-sm font-semibold text-gray-700 text-center mb-1">
            {title}
          </h3>
          {description && (
            <p className="text-xs text-gray-600 text-center line-clamp-2">
              {description}
            </p>
          )}
          {schema && (
            <Badge variant="secondary" className="text-xs mt-1">
              {Object.keys(schema.properties || {}).length} inputs
            </Badge>
          )}
        </CardContent>
      </Card>
    </>
  );
}
