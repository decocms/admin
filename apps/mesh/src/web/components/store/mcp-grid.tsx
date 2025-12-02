import type { ConnectionEntity } from "@/tools/connection/schema";
import { MCPCard } from "./mcp-card";

interface MCPGridProps {
  connections: ConnectionEntity[];
  onCardClick: (connection: ConnectionEntity) => void;
  title?: string;
  subtitle?: string;
}

export function MCPGrid({
  connections,
  onCardClick,
  title,
  subtitle,
}: MCPGridProps) {
  if (connections.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-4">
      {title && (
        <div>
          <h2 className="text-lg font-medium">{title}</h2>
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        </div>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {connections.map((connection) => (
          <MCPCard
            key={connection.id}
            connection={connection}
            onCardClick={onCardClick}
          />
        ))}
      </div>
    </div>
  );
}


