import type { Integration, MCPTool } from "@deco/sdk";
import { useTools } from "@deco/sdk";
import { Button } from "@deco/ui/components/button.tsx";
import { Checkbox } from "@deco/ui/components/checkbox.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Skeleton } from "@deco/ui/components/skeleton.tsx";
import { useCallback, useMemo, useState } from "react";
import { ExpandableDescription } from "./description.tsx";
import { IntegrationHeader } from "./header.tsx";
import { SchemaDisplay, type SchemaProperty } from "./schema-display.tsx";

interface IntegrationProps {
  integration: Integration;
  enabledTools: string[];
  setIntegrationTools: (integrationId: string, tools: string[]) => void;
}

export const getDiffCount = (
  t0: Record<string, string[]>,
  t1: Record<string, string[]>,
) => {
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
};

export function Integration({
  integration,
  enabledTools,
  setIntegrationTools,
}: IntegrationProps) {
  const { data: toolsData, error, isLoading } = useTools(
    integration.connection,
  );

  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedTool, setSelectedTool] = useState<MCPTool | null>(null);

  const isAllSelected = useMemo(() => {
    if (!toolsData?.tools?.length) return false;
    if (!enabledTools || enabledTools.length === 0) return false;
    return toolsData.tools.every((tool: MCPTool) =>
      enabledTools.includes(tool.name)
    );
  }, [toolsData, enabledTools]);

  const handleToolToggle = useCallback((toolId: string, checked: boolean) => {
    const currentTools = enabledTools;
    const updatedTools = checked
      ? [...currentTools, toolId]
      : currentTools.filter((tool) => tool !== toolId);

    setIntegrationTools(integration.id, updatedTools);
  }, [enabledTools, integration.id, setIntegrationTools]);

  const handleSelectAll = useCallback((checked: boolean) => {
    const tools = checked
      ? toolsData?.tools?.map((tool: MCPTool) => tool.name) ?? []
      : [];

    setIntegrationTools(integration.id, tools);
  }, [integration.id, setIntegrationTools, toolsData?.tools]);

  if (isLoading) {
    return (
      <div className="rounded-lg border bg-gradient-to-b from-white to-slate-50">
        <IntegrationHeader.Skeleton
          isExpanded={isExpanded}
          setIsExpanded={setIsExpanded}
        />
        <div className="border-t p-4 space-y-4">
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
      <div className="rounded-lg border border-red-300 bg-red-50">
        <IntegrationHeader.Error
          integration={integration}
          setIsExpanded={setIsExpanded}
          isExpanded={isExpanded}
        />
        {isExpanded && (
          <div className="border-t border-red-300 p-4">
            <div className="flex items-center space-x-2 text-red-400">
              <Icon name="cancel" />
              <p className="text-xs">
                Failed to load tools for{" "}
                {integration.name}. Please try again later.
              </p>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-lg border">
      <IntegrationHeader
        integration={integration}
        tools={toolsData?.tools?.map((tool: MCPTool) => tool.name) ?? []}
        enabledTools={enabledTools}
        isAllSelected={isAllSelected}
        setIntegrationTools={handleSelectAll}
        isExpanded={isExpanded}
        setIsExpanded={setIsExpanded}
      />
      {isExpanded && (
        <div className="border-t p-4 space-y-4 overflow-hidden">
          {selectedTool
            ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedTool(null)}
                    className="gap-2"
                  >
                    <Icon name="arrow_back" size={16} />
                    Back to tools
                  </Button>
                </div>
                <div className="space-y-4">
                  <SchemaDisplay
                    title="Input Schema"
                    schema={selectedTool.inputSchema as SchemaProperty}
                  />
                </div>
              </div>
            )
            : (
              <div className="space-y-4 max-w-full">
                {toolsData.tools.map((tool: MCPTool) => {
                  const id = `${integration.id}-${tool.name}`;

                  return (
                    <div
                      key={id}
                      className="flex items-start space-x-3 p-2 rounded-md hover:bg-accent/50 transition-colors cursor-pointer max-w-full"
                    >
                      <Checkbox
                        id={id}
                        className="mt-1"
                        checked={enabledTools.includes(tool.name)}
                        onCheckedChange={(checked) => {
                          handleToolToggle(tool.name, checked as boolean);
                        }}
                      />
                      <div className="space-y-1 flex-1 min-w-0 overflow-hidden">
                        <div className="flex items-center w-full gap-2 flex-wrap">
                          <label
                            htmlFor={id}
                            className="text-xs font-medium leading-none cursor-pointer truncate min-w-0 flex-1"
                          >
                            {tool.name}
                          </label>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e: React.MouseEvent) => {
                              e.stopPropagation();
                              setSelectedTool(tool);
                            }}
                            className="h-6 px-2 text-xs flex-none whitespace-nowrap"
                          >
                            View Schema
                          </Button>
                        </div>
                        <ExpandableDescription
                          description={tool.description ?? ""}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
        </div>
      )}
    </div>
  );
}
