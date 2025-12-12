import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Icon } from "@deco/ui/components/icon.tsx";
import {
  Select,
  SelectItem,
  SelectContent,
  SelectTrigger,
  SelectValue,
} from "@deco/ui/components/select.tsx";
import { useInstallFromRegistry } from "@/web/hooks/use-install-from-registry";
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
   * Specific MCP binding type for inline installation (e.g., "@deco/database").
   * When provided and starts with "@", clicking "Create connection" will
   * attempt to install the MCP directly from the registry.
   */
  bindingType?: string;
  /** Callback when "Create connection" is clicked (fallback when no bindingType) */
  onAddNew?: () => void;
  /** Callback to open MCP select modal */
  onOpenMcpSelectModal?: () => void;
  /** Optional className for the trigger */
  className?: string;
}

export function BindingSelector({
  value,
  onValueChange,
  placeholder = "Select a connection...",
  binding,
  bindingType: _bindingType,
  onAddNew,
  onOpenMcpSelectModal,
  className,
}: BindingSelectorProps) {
  const [isLocalInstalling, setIsLocalInstalling] = useState(false);
  const {
    installByBinding: _installByBinding,
    isInstalling: isGlobalInstalling,
  } = useInstallFromRegistry();

  const isInstalling = isLocalInstalling || isGlobalInstalling;

  // Fetch all connections from local collection
  const allConnections = useConnections();

  // Filter connections by binding (works with both well-known binding names and inline binding schemas)
  const connections = useBindingConnections({
    connections: allConnections,
    binding: binding,
  });

  const handleCreateConnection = async () => {
    setIsLocalInstalling(true);

    // Se a função de abrir o modal foi passada, chama ela
    if (onOpenMcpSelectModal) {
      setIsLocalInstalling(false);
      onOpenMcpSelectModal();
      return;
    }

    // Caso contrário, mantém o comportamento original
    setIsLocalInstalling(false);
  };

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
                  <span>Install MCP</span>
                </>
              )}
            </button>
          </div>
        )}
      </SelectContent>
    </Select>
  );
}
