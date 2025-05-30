import { Badge } from "@deco/ui/components/badge.tsx";

interface ToolCallResultProps {
  response: {
    status: "ok" | "error";
    data: unknown;
    latency: number;
  };
}

export function ToolCallResult({ response }: ToolCallResultProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-lg font-semibold">Response</div>
        <div className="flex items-center gap-2">
          <Badge variant={response.status === "ok" ? "default" : "destructive"}>
            {response.status.toUpperCase()}
          </Badge>
          <Badge variant="outline">{response.latency.toFixed(2)}ms</Badge>
        </div>
      </div>

      <div>
        <div className="text-sm font-medium mb-2">Data</div>
        <pre className="p-4 rounded-lg bg-muted text-sm overflow-auto">
          {JSON.stringify(response.data, null, 2)}
        </pre>
      </div>
    </div>
  );
}
