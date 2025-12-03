import { Icon } from "@deco/ui/components/icon.tsx";

export interface MCPApp {
  id: string;
  title: string;
  description?: string;
  created_at?: string;
  updated_at?: string;
  _meta?: {
    "mcp.mesh"?: {
      verified?: boolean;
      scopeName?: string;
      appName?: string;
    };
  };
  server?: {
    description?: string;
    icons?: Array<{
      src: string;
      mimeType: string;
    }>;
    _meta?: {
      "mcp.mesh/publisher-provided"?: {
        friendlyName?: string;
      };
    };
  };
}

interface MCPToolCardProps {
  app: MCPApp;
  onCardClick: (app: MCPApp) => void;
}

function getInitials(name: string): string {
  return name
    .split(/[\s\-_]/)
    .map((word) => word[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function getAppIcon(app: MCPApp): string | null {
  return app.server?.icons?.[0]?.src || null;
}

function getAppName(app: MCPApp): string {
  return (
    app.server?._meta?.["mcp.mesh/publisher-provided"]?.friendlyName ||
    app.title ||
    "Unknown App"
  );
}

function getAppDescription(app: MCPApp): string {
  return (
    app.server?.description || app.description || "No description available"
  );
}

export function MCPToolCard({ app }: MCPToolCardProps) {
  const name = getAppName(app);
  const icon = getAppIcon(app);
  console.log(app);
  const description = getAppDescription(app);
  const initials = getInitials(name);

  return (
    <div className="flex flex-col gap-2 p-4 bg-card rounded-2xl cursor-pointer overflow-hidden border border-border hover:shadow-md transition-shadow h-[116px]">
      <div className="grid grid-cols-[min-content_1fr] gap-4 h-full">
        {/* Icon/Avatar (10x10) */}
        <div className="h-10 w-10 rounded flex items-center justify-center bg-linear-to-br from-primary/20 to-primary/10">
          {icon ? (
            <img
              src={icon}
              alt={name}
              className="h-full w-full object-cover rounded"
            />
          ) : (
            initials
          )}
        </div>

        {/* Content */}
        <div className="grid grid-cols-1 gap-1 min-w-0">
          <div className="flex items-start gap-1">
            <span className="text-sm font-semibold truncate">{name}</span>
            <Icon
              name="info"
              size={14}
              className="text-muted-foreground shrink-0"
            />
          </div>
          <div className="text-sm text-muted-foreground line-clamp-2">
            {description}
          </div>
        </div>
      </div>
    </div>
  );
}
