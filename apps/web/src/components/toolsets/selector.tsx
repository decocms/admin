import { type Integration, useTools } from "@deco/sdk";
import { Button } from "@deco/ui/components/button.tsx";
import { Checkbox } from "@deco/ui/components/checkbox.tsx";
import {
  Dialog,
  DialogContent,
  DialogHeader,
} from "@deco/ui/components/dialog.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Input } from "@deco/ui/components/input.tsx";
import { ScrollArea } from "@deco/ui/components/scroll-area.tsx";
import { useIsMobile } from "@deco/ui/hooks/use-mobile.ts";
import { cn } from "@deco/ui/lib/utils.ts";
import { useEffect, useRef, useState } from "react";
import { formatToolName } from "../chat/utils/format-tool-name.ts";
import { IntegrationIcon } from "../integrations/list/common.tsx";
import { ExpandableDescription } from "./description.tsx";

interface ToolsMap {
  [integrationId: string]: string[];
}

interface SelectedToolsMap {
  [integrationId: string]: Set<string>;
}

interface ToolsetSelectorProps {
  installedIntegrations: Integration[];
  toolsSet: ToolsMap;
  setIntegrationTools: (integrationId: string, tools: string[]) => void;
  initialSelectedIntegration?: string | null;
}

function useToolSelection(toolsSet: ToolsMap, open: boolean) {
  const [selected, setSelected] = useState<SelectedToolsMap>({});

  useEffect(() => {
    if (!open) {
      setSelected({});
      return;
    }
    const initial: SelectedToolsMap = {};
    Object.entries(toolsSet).forEach(([id, tools]) => {
      initial[id] = new Set(tools);
    });
    setSelected(initial);
  }, [open, toolsSet]);

  function toggle(integrationId: string, toolName: string, checked: boolean) {
    console.log("toggle", integrationId, toolName, checked);
    setSelected((prev) => {
      const next = { ...prev };
      if (!next[integrationId]) {
        next[integrationId] = new Set(toolsSet[integrationId] || []);
      }
      checked
        ? next[integrationId].add(toolName)
        : next[integrationId].delete(toolName);
      return next;
    });
  }

  return { selected, toggle };
}

function IntegrationListItem({
  integration,
  selectedIntegration,
  toolsSet,
  selectedTools,
  selectedItemRef,
  setIntegrationTools,
}: {
  integration: Integration;
  selectedIntegration: string | null;
  toolsSet: ToolsMap;
  selectedTools: SelectedToolsMap;
  selectedItemRef?: React.RefObject<HTMLDivElement | null>;
  setIntegrationTools: (integrationId: string, tools: string[]) => void;
}) {
  const [openTools, setOpenTools] = useState();
  const { data: toolsData, isLoading } = useTools(integration.connection);

  const total = toolsData?.tools?.length ?? 0;
  const enabled = new Set([
    ...(toolsSet[integration.id] || []),
    ...(selectedTools[integration.id]
      ? Array.from(selectedTools[integration.id])
      : []),
  ]).size;

  const allTools = toolsData?.tools || [];
  const enabledCount =
    allTools.filter((tool) =>
      selectedTools[integration.id]?.has(tool.name) ??
        toolsSet[integration.id]?.includes(tool.name)
    ).length;
  const isAll = enabledCount === allTools.length && allTools.length > 0;
  const isEmpty = allTools.length === 0;

  function handleAll(checked: boolean) {
    setIntegrationTools(
      integration.id,
      checked ? allTools.map((tool) => tool.name) : [],
    );
  }

  if (isEmpty) {
    return <></>;
  }

  return (
    <div
      key={integration.id}
      ref={selectedIntegration === integration.id ? selectedItemRef : undefined}
      className={cn(
        "w-full flex flex-col rounded-xl transition-colors border relative",
      )}
    >
      <div className="flex gap-4 px-4 py-4">
        <div>
          <Checkbox
            id="select-all"
            className="cursor-pointer"
            checked={isAll}
            data-state={undefined}
            onCheckedChange={handleAll}
          />
        </div>
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
          <p className="text-sm">{integration.description}</p>
        </div>
      </div>
      <div className="absolute right-4 top-4 text-slate-400 lg:hidden">
        <Icon name="chevron_right" size={16} />
      </div>
      <div
        onClick={() => setOpenTools(!openTools)}
        className={cn(
          "flex flex-col items-start gap-1 min-w-0 px-4 py-4 border-t border-slate-200",
          !openTools && "hover:bg-slate-50",
        )}
      >
        <span className="text-slate-500 text-sm">
          {isLoading
            ? (
              "Loading tools..."
            )
            : (
              <div className="flex items-center gap-4">
                <Icon
                  name={"chevron_right"}
                  filled
                  size={14}
                  className={cn(
                    "inline-block mr-1 align-text-bottom text-slate-400",
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
    </div>
  );
}

export function IntegrationList({
  integrations,
  selectedIntegration,
  toolsSet,
  selectedTools,
  selectedItemRef,
  setIntegrationTools,
}: {
  integrations: Integration[];
  selectedIntegration: string | null;
  toolsSet: ToolsMap;
  selectedTools: SelectedToolsMap;
  selectedItemRef?: React.RefObject<HTMLDivElement | null>;
  setIntegrationTools: (integrationId: string, tools: string[]) => void;
}) {
  return (
    <div className="space-y-2">
      {integrations.map((integration) => (
        <IntegrationListItem
          key={integration.id}
          integration={integration}
          selectedIntegration={selectedIntegration}
          toolsSet={toolsSet}
          selectedTools={selectedTools}
          selectedItemRef={selectedItemRef}
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
  allTools: Tool[];
  setIntegrationTools: (integrationId: string, tools: string[]) => void;
}) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-6 bg-slate-100 animate-pulse rounded" />
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

          const toolsToUpdate = enabled
            ? toolsSet[integration.id].filter((t) => t !== tool.name)
            : [...(toolsSet[integration.id] || []), tool.name];
          return (
            <div
              key={tool.name}
              role="button"
              className="flex items-start gap-3 py-2 px-3 hover:bg-slate-50 rounded-lg cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                setIntegrationTools(integration.id, toolsToUpdate);
              }}
            >
              <div className="flex flex-col min-w-0">
                <label
                  className={cn(
                    "text-sm truncate cursor-pointer text-slate-700",
                    enabled && !enabled && "text-slate-400",
                  )}
                >
                  {beautifyToolName(tool.name)}
                </label>
                {tool.description && (
                  <ExpandableDescription description={tool.description} />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
