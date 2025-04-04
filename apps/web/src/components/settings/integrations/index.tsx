import type { Agent, Integration } from "@deco/sdk";
import { useTools } from "@deco/sdk/hooks";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Skeleton } from "@deco/ui/components/skeleton.tsx";
import { useCallback, useMemo, useState } from "react";
import { ExpandableDescription } from "./description.tsx";
import { IntegrationHeader } from "./header.tsx";

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
  const { data: toolsData, loading, error } = useTools(
    integration.connection,
  );
  const enabledTools: string[] | undefined =
    (localAgent || agent).tools_set[integration.id] || [];

  const [isExpanded, setIsExpanded] = useState(false);

  const isAllSelected = useMemo(() => {
    if (!toolsData.tools.length) return false;
    if (!enabledTools || enabledTools.length === 0) return false;
    return toolsData.tools.every((tool) => enabledTools.includes(tool.name));
  }, [toolsData, enabledTools]);

  const setIntegrationTools = useCallback((tools: string[]) => {
    _setIntegrationTools(integration.id, tools);
  }, [integration.id, _setIntegrationTools]);

  if (loading) {
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
        tools={toolsData.tools.map((tool) => tool.name)}
        isAllSelected={isAllSelected}
        setIntegrationTools={setIntegrationTools}
        isExpanded={isExpanded}
        setIsExpanded={setIsExpanded}
      />
      {isExpanded && (
        <div className="border-t p-4 space-y-4">
          {toolsData.tools.map((tool) => (
            <div
              key={`${integration.id}-${tool.name}`}
              className="flex items-start space-x-3"
            >
              <div className="relative flex items-start pt-2">
                <input
                  type="checkbox"
                  id={`${integration.id}-${tool.name}`}
                  checked={isAllSelected || enabledTools?.includes(tool.name)}
                  onChange={(e) =>
                    onToolToggle(integration.id, tool.name, e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-2 focus:ring-primary/20 cursor-pointer"
                />
              </div>
              <div className="space-y-1 block max-w-[calc(100%-2rem)] break-all">
                <label
                  htmlFor={`${integration.id}-${tool.name}`}
                  className="text-xs font-medium leading-none cursor-pointer"
                >
                  {tool.name}
                </label>
                <ExpandableDescription description={tool.description ?? ""} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
