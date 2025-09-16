import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Card, CardContent, CardHeader } from "@deco/ui/components/card.tsx";
import { Badge } from "@deco/ui/components/badge.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";

interface ToolNodeData {
  type: "tool_call";
  name: string;
  description: string;
  tool_name: string;
  integration: string;
  options?: Record<string, unknown>;
}

export function ToolNode({ data }: NodeProps<ToolNodeData>) {
  return (
    <Card className="min-w-[200px] shadow-lg">
      <Handle type="target" position={Position.Top} />

      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Icon name="build" className="h-4 w-4 text-primary" />
          <h3 className="font-semibold text-sm">{data.name}</h3>
        </div>
        <Badge variant="secondary" className="text-xs">
          {data.integration}
        </Badge>
      </CardHeader>

      <CardContent className="pt-0">
        <p className="text-xs text-muted-foreground mb-2">{data.description}</p>
        <div className="text-xs text-muted-foreground">
          Tool: {data.tool_name}
        </div>
        {data.options && Object.keys(data.options).length > 0 && (
          <div className="mt-2">
            <Badge variant="outline" className="text-xs">
              Configured
            </Badge>
          </div>
        )}
      </CardContent>

      <Handle type="source" position={Position.Bottom} />
    </Card>
  );
}
