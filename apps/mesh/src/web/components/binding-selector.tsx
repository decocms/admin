import { useMemo } from "react";
import { Icon } from "@deco/ui/components/icon.tsx";
import {
  Select,
  SelectItem,
  SelectContent,
  SelectTrigger,
  SelectValue,
} from "@deco/ui/components/select.tsx";
import { Skeleton } from "@deco/ui/components/skeleton.tsx";
import { useToolCall } from "@/web/hooks/use-tool-call";
import { createToolCaller } from "@/tools/client";
import type { ConnectionEntity } from "@/tools/connection/schema";

interface BindingSelectorProps {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  /**
   * Binding filter - can be a well-known binding name (e.g., "LLM", "AGENTS")
   * or a custom binding schema array for filtering connections
   */
  binding?: string | Array<{
    name: string;
    inputSchema?: Record<string, unknown>;
    outputSchema?: Record<string, unknown>;
  }>;
  /** Callback when "Create connection" is clicked */
  onAddNew?: () => void;
  /** Optional className for the trigger */
  className?: string;
}

interface ConnectionListResult {
  items: ConnectionEntity[];
  totalCount: number;
  hasMore: boolean;
}

export function BindingSelector({
  value,
  onValueChange,
  placeholder = "Select a connection...",
  binding,
  onAddNew,
  className,
}: BindingSelectorProps) {
  const toolCaller = useMemo(() => createToolCaller(), []);

  const { data, isLoading, error } = useToolCall<
    { binding?: typeof binding },
    ConnectionListResult
  >({
    toolCaller,
    toolName: "COLLECTION_CONNECTIONS_LIST",
    // @ts-ignore
    toolInputParams: binding ? { inlineBinding: binding } : {},
    enabled: true,
  });

  const connections = data?.items ?? [];

  if (isLoading) {
    return <Skeleton className={className ?? "w-[200px] h-8"} />;
  }

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
        {onAddNew && (
          <div className="border-t border-border">
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onAddNew();
              }}
              className="w-full flex items-center gap-2 px-2 py-2 hover:bg-muted rounded-md text-sm cursor-pointer"
            >
              <Icon name="add" size={16} />
              <span>Create connection</span>
            </button>
          </div>
        )}
      </SelectContent>
    </Select>
  );
}