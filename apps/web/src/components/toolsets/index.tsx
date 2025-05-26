import { useMemo } from "react";
import type { Integration, MCPTool } from "@deco/sdk";
import { useTools } from "@deco/sdk";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Skeleton } from "@deco/ui/components/skeleton.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@deco/ui/components/collapsible.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@deco/ui/components/dropdown-menu.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import { IntegrationHeader } from "./header.tsx";
import { IntegrationIcon } from "./icon.tsx";
import { ToolList, useToolSelection } from "./selector.tsx";

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
                  {tool.name}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

type IntegrationToolName = string;
interface ToolsMap {
  [integrationId: string]: IntegrationToolName[];
}

export function IntegrationRow(
  { data: integration, className, toolsSet, onSelectTools }: {
    data: Integration;
    className?: string;
    toolsSet: ToolsMap;
    onSelectTools: (tools: string[]) => void;
  },
) {
  const { data: toolsData } = useTools(
    integration.connection,
  );
  const selected = useMemo(
    () => ({ [integration.id]: new Set(toolsSet[integration.id]) }),
    [
      toolsSet[integration.id],
      integration.id,
    ],
  );

  const enabledToolsCount = toolsData?.tools?.length || 0;

  const handleRemove = () => {
    // TODO: Implement remove functionality
    console.log("Remove integration:", integration.id);
  };

  const handleSetup = () => {
    // TODO: Implement setup functionality
    console.log("Setup integration:", integration.id);
  };

  return (
    <Collapsible asChild>
      <div className={cn("w-full", className)}>
        <CollapsibleTrigger asChild>
          <div className="w-full grid grid-cols-[32px_2fr_1fr_auto] gap-2 p-2 hover:bg-slate-50 group transition-colors">
            {/* Column 1: Chevron Icon (68px) */}
            <span className="flex items-center w-8">
              <Icon
                name="chevron_right"
                className="text-slate-400 transition-transform group-data-[state=open]:rotate-90"
                size={20}
              />
            </span>

            {/* Column 2: Integration Info (2/3 of remaining space) */}
            <div className="flex items-center gap-3 min-w-0 cursor-pointer">
              <IntegrationIcon
                icon={integration.icon}
                name={integration.name}
                className="h-8 w-8 shrink-0"
              />
              <span className="font-medium text-slate-900 truncate">
                {integration.name}
              </span>
            </div>

            {/* Column 3: Tools Count (1/3 of remaining space) */}
            <div className="flex items-center justify-end text-sm text-slate-500 cursor-pointer">
              <span>
                {toolsSet[integration.id]?.length} of {enabledToolsCount}{" "}
                tools selected
              </span>
            </div>

            {/* Column 4: More Actions Dropdown */}
            <div className="flex items-center justify-center">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-slate-400 hover:text-slate-600"
                  >
                    <Icon name="more_horiz" size={20} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-32">
                  <DropdownMenuItem onClick={handleSetup}>
                    <Icon name="settings" size={16} className="mr-2" />
                    Setup
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={handleRemove}
                    className="text-red-600"
                  >
                    <Icon name="delete" size={16} className="mr-2" />
                    Remove
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="grid grid-cols-[32px_2fr_1fr_auto] gap-2 p-2 w-full border-t border-slate-100">
            <div className="col-span-2 col-start-2">
              <ToolList
                integration={integration}
                selectedTools={selected}
                toolsSet={toolsSet}
                onToggle={(_, toolName, checked) => {
                  const newTools = checked
                    ? [...toolsSet[integration.id], toolName]
                    : toolsSet[integration.id].filter((tName) =>
                      tName !== toolName
                    );
                  onSelectTools(newTools);
                }}
                variant="body-only"
              />
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
