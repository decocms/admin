import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@deco/ui/components/tooltip.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";

export { Icon };

/**
 * MCP Registry Server structure from LIST response
 */
export interface MCPRegistryServerIcon {
  src: string;
  mimeType?: string;
  sizes?: string[];
  theme?: "light" | "dark";
}

export interface MCPRegistryServerMeta {
  "mcp.mesh"?: {
    id: string;
    verified?: boolean;
    scopeName?: string;
    appName?: string;
  };
  "mcp.mesh/publisher-provided"?: {
    friendlyName?: string | null;
    tools?: Array<{
      id: string;
      name: string;
      description?: string | null;
    }>;
    models?: unknown[];
    emails?: unknown[];
    analytics?: unknown;
    cdn?: unknown;
  };
  [key: string]: unknown;
}

export interface MCPRegistryServer {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  _meta?: MCPRegistryServerMeta;
  server: {
    $schema?: string;
    _meta?: MCPRegistryServerMeta;
    name: string;
    title?: string;
    description?: string;
    icons?: MCPRegistryServerIcon[];
    remotes?: Array<{
      type: "http" | "stdio" | "sse";
      url?: string;
    }>;
    version?: string;
  };
}

/**
 * Props for RegistryItemCard - accepts any item with compatible shape.
 * This allows both MCPRegistryServer and RegistryItem types.
 */
interface RegistryItemCardProps {
  item: {
    id: string;
    title?: string;
    _meta?: MCPRegistryServerMeta;
    server?: {
      title?: string;
      description?: string;
      icons?: Array<{ src: string }>;
      _meta?: MCPRegistryServerMeta;
    };
  };
  onClick: () => void;
}

function getInitials(nameStr: string): string {
  if (!nameStr || typeof nameStr !== "string") return "?";
  return nameStr
    .split(/[\s\-_]/)
    .map((word) => word[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function RegistryItemCard({ item, onClick }: RegistryItemCardProps) {
  const name = item.title || item.server?.title || item.id || "Unnamed Item";
  const description = item.server?.description;
  const icon = item.server?.icons?.[0]?.src;
  const initials = getInitials(name);
  const isVerified = item._meta?.["mcp.mesh"]?.verified ?? false;
  const scopeName = item._meta?.["mcp.mesh"]?.scopeName;
  const toolsCount =
    item.server?._meta?.["mcp.mesh/publisher-provided"]?.tools?.length ?? 0;

  return (
    <div
      onClick={onClick}
      className="flex flex-col gap-2 p-4 bg-card rounded-2xl cursor-pointer overflow-hidden border border-border hover:shadow-md transition-shadow h-[176px] w-[259px]"
    >
      <div className="grid grid-cols-[min-content_1fr] gap-4 h-full">
        {/* Icon */}
        <div className="h-10 w-10 rounded flex items-center justify-center bg-linear-to-br from-primary/20 to-primary/10 text-sm font-semibold text-primary shrink-0 overflow-hidden">
          {icon ? (
            <img
              src={icon}
              alt={name}
              className="h-full w-full object-cover rounded"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          ) : (
            <span>{initials}</span>
          )}
        </div>

        {/* Content */}
        <div className="grid grid-cols-1 gap-1 min-w-0">
          <div className="flex items-start gap-1">
            <div className="text-sm font-semibold truncate">{name}</div>
            {isVerified && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Icon
                    name="verified"
                    size={14}
                    className="text-green-500 shrink-0"
                  />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Verified App</p>
                </TooltipContent>
              </Tooltip>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Icon
                  name="info"
                  size={14}
                  className="text-muted-foreground shrink-0"
                />
              </TooltipTrigger>
              <TooltipContent>
                <div className="text-xs space-y-1">
                  <p className="font-semibold">Registry Item</p>
                  {scopeName && <p>Scope: {scopeName}</p>}
                  {toolsCount > 0 && <p>Tools: {toolsCount}</p>}
                </div>
              </TooltipContent>
            </Tooltip>
          </div>

          <div className="text-sm text-muted-foreground line-clamp-2">
            {description || "No description available"}
          </div>
        </div>
      </div>
    </div>
  );
}
