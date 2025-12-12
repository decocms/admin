import {
  Select,
  SelectItem,
  SelectContent,
  SelectTrigger,
  SelectValue,
} from "@deco/ui/components/select.tsx";
import { useConnections } from "../hooks/collections/use-connection";
import { useBindingConnections } from "../hooks/use-binding";

interface BindingSelectorProps {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  /**
   * Binding filter - can be a well-known binding name (e.g., "LLMS", "AGENTS", "MCP")
   * or a custom binding schema array for filtering connections.
   * Note: String values are case-insensitive (e.g., "llms" works the same as "LLMS").
   */
  binding?:
    | string
    | Array<{
        name: string;
        inputSchema?: Record<string, unknown>;
        outputSchema?: Record<string, unknown>;
      }>;
  /**
   * Filter connections by specific tool names (e.g., ["DATABASES_RUN_SQL", "DATABASES_LIST"]).
   * When provided, connections that have at least one of these tools will be shown.
   */
  tools?: string[];
  /**
   * Specific MCP binding type for inline installation (e.g., "@deco/database").
   * When provided and starts with "@", clicking "Create connection" will
   * attempt to install the MCP directly from the registry.
   */
  bindingType?: string;
  /** Optional className for the trigger */
  className?: string;
}

export function BindingSelector({
  value,
  onValueChange,
  placeholder = "Select a connection...",
  binding,
  tools,
  bindingType: _bindingType,
  className,
}: BindingSelectorProps) {
  // Fetch all connections from local collection
  const allConnections = useConnections();

  // Filter connections by binding (works with both well-known binding names and inline binding schemas)
  // Or by tools if provided
  const filteredConnections = (() => {
    // Priority 1: Filter by tools if provided (e.g., "DATABASES_RUN_SQL")
    // This searches connections that have these specific tools
    if (tools && tools.length > 0) {
      // Filter by tools: show connections that have at least one matching tool
      // Tools from store -> compare -> tools from connections
      return (
        allConnections?.filter((conn) => {
          if (!conn.tools || conn.tools.length === 0) return false;
          const connectionToolNames = conn.tools.map((t) => t.name);
          // Check if connection has any tool that matches the store tools
          return tools.some((toolName) =>
            connectionToolNames.includes(toolName),
          );
        }) ?? []
      );
    }

    // Priority 2: Fall back to binding filter
    return useBindingConnections({
      connections: allConnections,
      binding: binding,
    });
  })();

  // Include selected connection if not in filtered list
  const connections = (() => {
    let result = filteredConnections;

    if (value && !result.some((c) => c.id === value)) {
      const selectedConnection = allConnections?.find((c) => c.id === value);
      if (selectedConnection) {
        return [selectedConnection, ...result];
      }
    }

    return result;
  })();

  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className={className ?? "w-[200px] h-8!"}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {connections.length === 0 ? (
          <div className="px-2 py-4 text-center text-sm text-muted-foreground">
            No connections found
          </div>
        ) : (
          connections.map((connection) => (
            <SelectItem key={connection.id} value={connection.id}>
              <div className="flex items-center gap-2">
                {connection.icon ? (
                  <img
                    src={connection.icon}
                    alt={connection.title}
                    className="w-4 h-4 rounded"
                  />
                ) : (
                  <div className="w-4 h-4 rounded bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center text-xs font-semibold text-primary">
                    {connection.title.slice(0, 1).toUpperCase()}
                  </div>
                )}
                <span>{connection.title}</span>
              </div>
            </SelectItem>
          ))
        )}
      </SelectContent>
    </Select>
  );
}
