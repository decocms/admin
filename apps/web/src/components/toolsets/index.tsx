import type { Integration, MCPTool } from "@deco/sdk";
import { useTools } from "@deco/sdk";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Skeleton } from "@deco/ui/components/skeleton.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import { formatToolName } from "../chat/utils/formatToolName.ts";
import { IntegrationHeader } from "./header.tsx";

/**
 * Returns the count of differences between two toolsets.
 */
export function getDiffCount(
  t0: Record<string, string[]>,
  t1: Record<string, string[]>,
) {
  let count = 0;
  for (const [i0, t0Tools] of Object.entries(t0)) {
    const t1Tools = t1[i0] ?? [];
    count += t0Tools.filter((tool) => !t1Tools.includes(tool)).length;
  }
  for (const [i1, t1Tools] of Object.entries(t1)) {
    const t0Tools = t0[i1] ?? [];
    count += t1Tools.filter((tool) => !t0Tools.includes(tool)).length;
  }
  return count;
}

interface IntegrationProps {
  integration: Integration;
  enabledTools: string[];
  setIntegrationTools: (integrationId: string, tools: string[]) => void;
  onIntegrationClick?: (integration: Integration) => void;
}

export function Integration({
  integration,
  enabledTools,
  onIntegrationClick,
}: IntegrationProps) {
  const { data: toolsData, error, isLoading } = useTools(
    integration.connection,
  );

  if (isLoading) {
    return (
      <div className="bg-gradient-to-b from-white to-slate-50">
        <IntegrationHeader.Skeleton />
        <div className="p-4 space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-start space-x-3">
              <Skeleton className="h-4 w-4" />
              <div className="space-y-1 flex-1">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="group rounded-lg">
        <IntegrationHeader
          variant="error"
          integration={integration}
          tools={[]}
          enabledTools={[]}
        />
      </div>
    );
  }

  if (toolsData?.tools && enabledTools.length === 0) {
    return (
      <div className="group bg-gradient-to-b from-white to-slate-50">
        <IntegrationHeader
          integration={integration}
          tools={toolsData.tools.map((tool: MCPTool) => tool.name)}
          enabledTools={enabledTools}
        />
        <div className="p-4 flex items-center space-x-2 text-slate-400">
          <Icon name="info" />
          <p className="text-xs">
            No tools enabled for this integration.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={() => onIntegrationClick?.(integration)}
      className="cursor-pointer group hover:bg-slate-50 transition-colors rounded-lg"
    >
      <IntegrationHeader
        integration={integration}
        tools={toolsData?.tools?.map((tool: MCPTool) => tool.name) ?? []}
        enabledTools={enabledTools}
      />
      {toolsData?.tools && (
        <div className="max-w-full p-2 pt-0 space-y-2">
          {toolsData.tools.map((tool) => {
            const isEnabled = enabledTools.includes(tool.name);
            if (!isEnabled) return null;

            return (
              <div
                key={`${integration.id}-${tool.name}`}
                className={cn(
                  "flex items-center gap-2 pl-2 rounded-lg max-w-full relative h-10 border border-border/40",
                  isEnabled && "bg-accent/10",
                )}
              >
                <Icon
                  name="build"
                  filled
                  size={16}
                  className="text-muted-foreground"
                />
                <span className="text-xs truncate flex-1 min-w-0">
                  {formatToolName(tool.name)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
