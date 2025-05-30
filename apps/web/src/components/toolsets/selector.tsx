import { type Integration, MCPTool, useTools } from "@deco/sdk";
import { Badge } from "@deco/ui/components/badge.tsx";
import { Checkbox } from "@deco/ui/components/checkbox.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import { useState } from "react";
import { useNavigateWorkspace } from "../../hooks/use-navigate-workspace.ts";
import { IntegrationIcon } from "../integrations/list/common.tsx";
import { ExpandableDescription } from "./description.tsx";

interface ToolsMap {
  [integrationId: string]: string[];
}

function IntegrationListItem({
  integration,
  toolsSet,
  setIntegrationTools,
}: {
  integration: Integration;
  toolsSet: ToolsMap;
  setIntegrationTools: (integrationId: string, tools: string[]) => void;
}) {
  const [openTools, setOpenTools] = useState(false);
  const { data: toolsData, isLoading } = useTools(integration.connection);
  const navigateWorkspace = useNavigateWorkspace();

  const total = toolsData?.tools?.length ?? 0;
  const enabled = new Set([
    ...(toolsSet[integration.id] || []),
  ]).size;

  const allTools = toolsData?.tools || [];
  const enabledCount =
    allTools.filter((tool) => toolsSet[integration.id]?.includes(tool.name))
      .length;
  const isAll = enabledCount > 0;
  const isEmpty = !isLoading && allTools.length === 0;

  function handleAll(checked: boolean) {
    setIntegrationTools(
      integration.id,
      checked ? allTools.map((tool) => tool.name) : [],
    );
  }

  return (
    <div
      key={integration.id}
      className={cn(
        "w-full flex flex-col rounded-xl transition-colors border relative",
        isEmpty && "order-last",
      )}
    >
      <label
        htmlFor={`select-all-${integration.id}`}
        className={cn(
          "flex gap-4 px-4 py-4 rounded-t-xl",
          !isEmpty && "hover:bg-muted cursor-pointer",
        )}
      >
        {!isEmpty && (
          <div>
            <Checkbox
              id={`select-all-${integration.id}`}
              className="cursor-pointer"
              checked={isAll}
              onCheckedChange={handleAll}
            />
          </div>
        )}
        <div className="flex flex-col gap-2">
          <div className="flex gap-2 items-center">
            <IntegrationIcon
              icon={integration.icon}
              name={integration.name}
              className="h-6 w-6 p-1 rounded-sm"
            />
            <span className="text-sm font-medium text-left truncate">
              {integration.name}
            </span>
          </div>
          {integration.description && (
            <p className="text-sm">{integration.description}</p>
          )}
        </div>
      </label>
      <div className="absolute right-4 top-4 text-muted-foreground lg:hidden">
        <Icon name="chevron_right" size={16} />
      </div>
      {isEmpty && (
        <div
          onClick={(e) => {
            e.preventDefault();
            navigateWorkspace(`/integration/${integration.id}`);
          }}
          className={cn(
            "flex gap-2 items-center justify-between px-4 py-4 border-t border-border cursor-pointer",
            "hover:bg-muted rounded-b-xl",
          )}
        >
          <div className="flex gap-2 items-center">
            <Icon name="settings" size={16} />
            <span className="text-xs font-medium">Setup Integration</span>
          </div>
          <Badge variant="destructive">
            <Icon name="error" size={10} />
            Error
          </Badge>
        </div>
      )}
      {!isEmpty && (
        <div
          className={cn(
            "flex flex-col items-start gap-1 min-w-0 px-4 border-t border-border cursor-pointer",
            !openTools && "hover:bg-muted rounded-b-xl",
          )}
        >
          <span
            onClick={() => setOpenTools(!openTools)}
            className="text-muted-foreground text-sm py-4 w-full"
          >
            {isLoading
              ? (
                "Loading tools..."
              )
              : (
                <div className="flex items-center gap-4">
                  <Icon
                    name="chevron_right"
                    filled
                    size={14}
                    className={cn(
                      "inline-block mr-1 align-text-bottom text-muted-foreground",
                      openTools && "rotate-90",
                    )}
                  />
                  {`${enabled} of ${total} tools enabled`}
                </div>
              )}
          </span>
          {openTools && (
            <ToolList
              integration={integration}
              toolsSet={toolsSet}
              isLoading={isLoading}
              allTools={allTools}
              setIntegrationTools={setIntegrationTools}
            />
          )}
        </div>
      )}
    </div>
  );
}

export function IntegrationList({
  integrations,
  toolsSet,
  setIntegrationTools,
}: {
  integrations: Integration[];
  toolsSet: ToolsMap;
  setIntegrationTools: (integrationId: string, tools: string[]) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      {integrations.map((integration) => (
        <IntegrationListItem
          key={integration.id}
          integration={integration}
          toolsSet={toolsSet}
          setIntegrationTools={setIntegrationTools}
        />
      ))}
    </div>
  );
}

function beautifyToolName(text: string) {
  return text
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function ToolList({
  integration,
  toolsSet,
  isLoading,
  allTools,
  setIntegrationTools,
}: {
  integration: Integration;
  toolsSet: ToolsMap;
  isLoading: boolean;
  allTools: MCPTool[];
  setIntegrationTools: (integrationId: string, tools: string[]) => void;
}) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-6 bg-muted animate-pulse rounded" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4 pt-2">
      <div className="space-y-2">
        {allTools?.map((tool) => {
          const enabled = toolsSet[integration.id]?.includes(tool.name) ??
            false;

          const handleCheckboxChange = (checked: boolean) => {
            const withoutTool = toolsSet[integration.id]?.filter((t) =>
              t !== tool.name
            );
            const withTool = [...(toolsSet[integration.id] || []), tool.name];
            const toolsToUpdate = checked ? withTool : withoutTool;
            setIntegrationTools(integration.id, toolsToUpdate);
          };

          return (
            <label
              key={tool.name}
              className="flex items-start gap-3 py-2 px-3 hover:bg-muted rounded-xl cursor-pointer"
              htmlFor={`${integration.id}-${tool.name}`}
            >
              <Checkbox
                checked={enabled}
                className="cursor-pointer"
                id={`${integration.id}-${tool.name}`}
                onCheckedChange={handleCheckboxChange}
              />
              <div className="flex flex-col min-w-0">
                <span
                  className={cn(
                    "text-sm truncate cursor-pointer text-foreground",
                    enabled && !enabled && "text-muted-foreground",
                  )}
                >
                  {beautifyToolName(tool.name)}
                </span>
                {tool.description && (
                  <ExpandableDescription description={tool.description} />
                )}
              </div>
            </label>
          );
        })}
      </div>
    </div>
  );
}
