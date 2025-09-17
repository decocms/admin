import { Handle, type NodeProps, Position } from "@xyflow/react";
import { Card, CardContent } from "@deco/ui/components/card.tsx";
import { Badge } from "@deco/ui/components/badge.tsx";

export interface WorkflowSourceNodeData {
  title: string;
  description?: string;
  schema?: Record<string, unknown>;
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

  const title = "title" in data ? String(data.title) : "Workflow Input";
  const description =
    "description" in data ? String(data.description) : undefined;
  const schema =
    "schema" in data ? (data.schema as Record<string, unknown>) : undefined;

  return (
    <>
      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 bg-muted-foreground border-2 border-white"
      />

      <Card className="w-48 h-48 bg-muted border-border shadow-md">
        <CardContent className="flex flex-col items-center justify-center h-full p-4">
          <div className="w-12 h-12 bg-muted-foreground rounded-full flex items-center justify-center mb-2">
            <span className="text-white font-bold text-lg">IN</span>
          </div>
          <h3 className="text-sm font-semibold text-foreground text-center mb-1">
            {title}
          </h3>
          {description && (
            <p className="text-xs text-muted-foreground text-center line-clamp-2">
              {String(description)}
            </p>
          )}
          {schema && (
            <Badge variant="secondary" className="text-xs mt-1">
              {
                Object.keys(
                  (
                    schema as Record<
                      string,
                      { properties?: Record<string, unknown> }
                    >
                  )?.properties || {},
                ).length
              }{" "}
              inputs
            </Badge>
          )}
        </CardContent>
      </Card>
    </>
  );
}
