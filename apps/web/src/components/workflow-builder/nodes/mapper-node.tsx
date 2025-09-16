import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Card, CardContent, CardHeader } from "@deco/ui/components/card.tsx";
import { Badge } from "@deco/ui/components/badge.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";

interface MapperNodeData {
  type: "mapping";
  name: string;
  description: string;
  execute: string;
  outputSchema: Record<string, unknown>;
}

export function MapperNode({ data }: NodeProps<MapperNodeData>) {
  const isIdentityFunction = data.execute.includes(
    "return input; // Identity transformation",
  );

  return (
    <Card className="min-w-[200px] shadow-lg">
      <Handle type="target" position={Position.Top} />

      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Icon name="transform" className="h-4 w-4 text-success" />
          <h3 className="font-semibold text-sm">{data.name}</h3>
        </div>
        <Badge
          variant={isIdentityFunction ? "secondary" : "default"}
          className="text-xs"
        >
          {isIdentityFunction ? "Identity" : "Transform"}
        </Badge>
      </CardHeader>

      <CardContent className="pt-0">
        <p className="text-xs text-muted-foreground mb-2">{data.description}</p>
        <div className="text-xs text-muted-foreground">
          {isIdentityFunction
            ? "Passes data through unchanged"
            : "Transforms data between steps"}
        </div>
      </CardContent>

      <Handle type="source" position={Position.Bottom} />
    </Card>
  );
}
