import { useMemo, useState } from "react";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Loader2 } from "lucide-react";
import {
  Select,
  SelectItem,
  SelectContent,
  SelectTrigger,
  SelectValue,
} from "@deco/ui/components/select.tsx";
import { Skeleton } from "@deco/ui/components/skeleton.tsx";
import { useToolCall } from "@/web/hooks/use-tool-call";
import { useInstallFromRegistry } from "@/web/hooks/use-install-from-registry";
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
  binding?:
    | string
    | Array<{
        name: string;
        inputSchema?: Record<string, unknown>;
        outputSchema?: Record<string, unknown>;
      }>;
  /**
   * Specific MCP binding type for inline installation (e.g., "@deco/database").
   * When provided and starts with "@", clicking "Create connection" will
   * attempt to install the MCP directly from the registry.
   */
  bindingType?: string;
  /** Callback when "Create connection" is clicked (fallback when no bindingType) */
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
  bindingType,
  onAddNew,
  className,
}: BindingSelectorProps) {
  const toolCaller = useMemo(() => createToolCaller(), []);
  const [isLocalInstalling, setIsLocalInstalling] = useState(false);
  // Store newly installed connection locally (since it won't appear in filtered list until tools are discovered)
  const [installedConnection, setInstalledConnection] =
    useState<ConnectionEntity | null>(null);
  const { installByBinding, isInstalling: isGlobalInstalling } =
    useInstallFromRegistry();

  const isInstalling = isLocalInstalling || isGlobalInstalling;

  const { data, isLoading } = useToolCall<
    { binding?: typeof binding },
    ConnectionListResult
  >({
    toolCaller,
    toolName: "COLLECTION_CONNECTIONS_LIST",
    // @ts-ignore
    toolInputParams: binding ? { inlineBinding: binding } : {},
    enabled: true,
  });

  // Parse bindingType to get scope and appName (e.g., "@deco/database" -> { scope: "deco", appName: "database" })
  const parsedBindingType = useMemo(() => {
    if (!bindingType?.startsWith("@")) return null;
    const [scope, appName] = bindingType.replace("@", "").split("/");
    return scope && appName ? { scope, appName } : null;
  }, [bindingType]);

  // Combine server connections with locally installed connection
  const connections = useMemo(() => {
    let serverConnections = data?.items ?? [];

    // If we have a specific binding type (@scope/appName), filter connections that match
    if (parsedBindingType) {
      serverConnections = serverConnections.filter((conn) => {
        const connAppName = conn.app_name;
        const connScopeName = (conn.metadata as Record<string, unknown> | null)
          ?.scopeName as string | undefined;

        // Match by app_name and scopeName
        return (
          connAppName === parsedBindingType.appName &&
          connScopeName === parsedBindingType.scope
        );
      });
    }

    if (
      installedConnection &&
      !serverConnections.some((c) => c.id === installedConnection.id)
    ) {
      return [installedConnection, ...serverConnections];
    }
    return serverConnections;
  }, [data?.items, installedConnection, parsedBindingType]);

  // Check if we can do inline installation (bindingType starts with @)
  const canInstallInline = bindingType?.startsWith("@");

  const handleCreateConnection = async () => {
    // If we have a specific binding type that starts with @, try inline installation
    if (canInstallInline && bindingType) {
      setIsLocalInstalling(true);
      try {
        const result = await installByBinding(bindingType);
        if (result) {
          // Store the connection locally so it appears in the list immediately
          setInstalledConnection(result.connection);
          // Automatically select the newly installed connection
          onValueChange(result.id);
        }
      } finally {
        setIsLocalInstalling(false);
      }
      return;
    }

    // Fallback to onAddNew navigation
    onAddNew?.();
  };

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
        {(onAddNew || canInstallInline) && (
          <div className="border-t border-border">
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleCreateConnection();
              }}
              disabled={isInstalling}
              className="w-full flex items-center gap-2 px-2 py-2 hover:bg-muted rounded-md text-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isInstalling ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Installing...</span>
                </>
              ) : (
                <>
                  <Icon name="add" size={16} />
                  <span>{canInstallInline ? "Install MCP" : "Create connection"}</span>
                </>
              )}
            </button>
          </div>
        )}
      </SelectContent>
    </Select>
  );
}
