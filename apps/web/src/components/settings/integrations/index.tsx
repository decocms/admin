import type { Agent, Integration, MCPTool } from "@deco/sdk";
import { useTools } from "@deco/sdk";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Skeleton } from "@deco/ui/components/skeleton.tsx";
import { useCallback, useMemo, useState } from "react";
import { ExpandableDescription } from "./description.tsx";
import { IntegrationHeader } from "./header.tsx";
import { SchemaDisplay, type SchemaProperty } from "./schema-display.tsx";
import { Button } from "@deco/ui/components/button.tsx";

interface IntegrationProps {
  integration: Integration;
  onToolToggle: (
    integrationId: string,
    toolId: string,
    checked: boolean,
  ) => void;
  setIntegrationTools: (
    integrationId: string,
    tools: string[],
  ) => void;
  agent: Agent;
  localAgent?: Agent;
}

export function Integration(
  {
    integration,
    onToolToggle,
    setIntegrationTools: _setIntegrationTools,
    agent,
    localAgent,
  }: IntegrationProps,
) {
  const { data: toolsData, error, isLoading } = useTools(
    integration.connection,
  );
  const enabledTools: string[] | undefined =
    (localAgent || agent).tools_set[integration.id] || [];

  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedTool, setSelectedTool] = useState<MCPTool | null>(null);

  const isAllSelected = useMemo(() => {
    if (!toolsData?.tools.length) return false;
    if (!enabledTools || enabledTools.length === 0) return false;
    return toolsData.tools.every((tool: MCPTool) =>
      enabledTools.includes(tool.name)
    );
  }, [toolsData, enabledTools]);

  const setIntegrationTools = useCallback((tools: string[]) => {
    _setIntegrationTools(integration.id, tools);
  }, [integration.id, _setIntegrationTools]);

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
        tools={toolsData.tools.map((tool: MCPTool) => tool.name)}
        isAllSelected={isAllSelected}
        setIntegrationTools={setIntegrationTools}
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
                {toolsData.tools.map((tool: MCPTool) => (
                  <div
                    key={`${integration.id}-${tool.name}`}
                    className="flex items-start space-x-3 p-2 rounded-md hover:bg-accent/50 transition-colors cursor-pointer max-w-full"
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest("button")) {
                        return;
                      }
                      onToolToggle(
                        integration.id,
                        tool.name,
                        !(isAllSelected || enabledTools?.includes(tool.name)),
                      );
                    }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onToolToggle(
                          integration.id,
                          tool.name,
                          !(isAllSelected || enabledTools?.includes(tool.name)),
                        );
                      }
                    }}
                  >
                    <div className="relative flex items-start flex-none">
                      <input
                        type="checkbox"
                        id={`${integration.id}-${tool.name}`}
                        checked={isAllSelected ||
                          enabledTools?.includes(tool.name)}
                        onChange={(e) => {
                          e.stopPropagation();
                          onToolToggle(
                            integration.id,
                            tool.name,
                            e.target.checked,
                          );
                        }}
                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-2 focus:ring-primary/20 cursor-pointer mt-1"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                    <div className="space-y-1 flex-1 min-w-0 overflow-hidden">
                      <div className="flex items-center w-full gap-2 flex-wrap">
                        <span className="text-xs font-medium leading-none cursor-pointer truncate min-w-0 flex-1">
                          {tool.name}
                        </span>
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
                ))}
              </div>
            )}
        </div>
      )}
    </div>
  );
}
