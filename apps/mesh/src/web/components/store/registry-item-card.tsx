import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@deco/ui/components/tooltip.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Card } from "@deco/ui/components/card.js";

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
    publishedAt?: string;
    updatedAt?: string;
  };
  "mcp.mesh/publisher-provided"?: {
    friendlyName?: string | null;
    metadata?: Record<string, unknown> | null;
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
  const scopeName = `${item._meta?.["mcp.mesh"]?.scopeName}/${item._meta?.["mcp.mesh"]?.appName}`;

  return (
    <Card className="p-6" onClick={onClick}>
      <div className="flex flex-col gap-4 h-full relative">
        <div className="flex gap-3">
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
          <div className="flex gap-2 items-start">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold truncate">
                {name}
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
              </div>
              {scopeName && <p className="text-xs">{scopeName}</p>}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="grid grid-cols-1 gap-1 min-w-0">
          <div className="text-sm text-muted-foreground line-clamp-2">
            {description || "No description available"}
          </div>
        </div>
      </div>
    </Card>
  );
}
