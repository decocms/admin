import { ToolSetSelector } from "@/web/components/tool-set-selector.tsx";
import { useConnections } from "@/web/hooks/collections/use-connection";

export interface AgentToolsTabProps {
  toolSet: Record<string, string[]>;
  onToolSetChange: (toolSet: Record<string, string[]>) => void;
}

export function AgentToolsTab({
  toolSet,
  onToolSetChange,
}: AgentToolsTabProps) {
  const connectionsResult = useConnections();
  // Handle both { data } and direct array returns
  const connections = Array.isArray(connectionsResult)
    ? connectionsResult
    : (connectionsResult?.data ?? []);

  // Filter to only active connections
  const activeConnections = connections.filter(
    (conn) => conn.status === "active",
  );

  return (
    <div className="h-full">
      <ToolSetSelector
        toolSet={toolSet}
        onToolSetChange={onToolSetChange}
        connections={activeConnections}
        isLoading={false}
      />
    </div>
  );
}
