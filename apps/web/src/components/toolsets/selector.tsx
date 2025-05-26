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
  open: boolean;
  onOpenChange: (open: boolean) => void;
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
  onSelect,
  toolsSet,
  selectedTools,
  selectedItemRef,
}: {
  integration: Integration;
  selectedIntegration: string | null;
  onSelect: (id: string) => void;
  toolsSet: ToolsMap;
  selectedTools: SelectedToolsMap;
  selectedItemRef?: React.RefObject<HTMLDivElement | null>;
}) {
  const { data: toolsData, isLoading } = useTools(integration.connection);
  const total = toolsData?.tools?.length ?? 0;
  const enabled = new Set([
    ...(toolsSet[integration.id] || []),
    ...(selectedTools[integration.id]
      ? Array.from(selectedTools[integration.id])
      : []),
  ]).size;

  return (
    <div
      key={integration.id}
      ref={selectedIntegration === integration.id ? selectedItemRef : undefined}
      onClick={() => onSelect(integration.id)}
      className={cn(
        "w-full flex flex-col gap-2 p-4 lg:px-3 lg:py-2 rounded-xl transition-colors cursor-pointer border relative",
        "hover:bg-slate-50",
        selectedIntegration === integration.id && "bg-slate-100",
      )}
    >
      <div className="absolute right-4 top-4 text-slate-400 lg:hidden">
        <Icon name="chevron_right" size={16} />
      </div>
      <div className="flex items-center gap-3">
        <IntegrationIcon
          icon={integration.icon}
          name={integration.name}
          className="h-16 w-16"
        />
        <div className="flex flex-col items-start gap-1 min-w-0">
          <span className="font-medium text-left truncate">
            {integration.name}
          </span>
          <span className="text-slate-500 text-sm">
            {isLoading
              ? (
                "Loading tools..."
              )
              : (
                <div className="flex items-center gap-1">
                  <Icon
                    name="build"
                    filled
                    size={14}
                    className="inline-block mr-1 align-text-bottom text-slate-400"
                  />
                  {`${enabled} of ${total} tools enabled`}
                </div>
              )}
          </span>
        </div>
      </div>
    </div>
  );
}

function IntegrationList({
  integrations,
  selectedIntegration,
  onSelect,
  toolsSet,
  selectedTools,
  selectedItemRef,
}: {
  integrations: Integration[];
  selectedIntegration: string | null;
  onSelect: (id: string) => void;
  toolsSet: ToolsMap;
  selectedTools: SelectedToolsMap;
  selectedItemRef?: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <div className="space-y-2">
      {integrations.map((integration) => (
        <IntegrationListItem
          key={integration.id}
          integration={integration}
          selectedIntegration={selectedIntegration}
          onSelect={onSelect}
          toolsSet={toolsSet}
          selectedTools={selectedTools}
          selectedItemRef={selectedItemRef}
        />
      ))}
    </div>
  );
}

function ToolList({
  integration,
  selectedTools,
  toolsSet,
  onToggle,
}: {
  integration: Integration;
  selectedTools: SelectedToolsMap;
  toolsSet: ToolsMap;
  onToggle: (integrationId: string, toolName: string, checked: boolean) => void;
}) {
  const { data: toolsData, isLoading } = useTools(integration.connection);
  const allTools = toolsData?.tools || [];
  const enabledCount =
    allTools.filter((tool) =>
      selectedTools[integration.id]?.has(tool.name) ??
        toolsSet[integration.id]?.includes(tool.name)
    ).length;
  const isAll = enabledCount === allTools.length && allTools.length > 0;
  const isPartial = enabledCount > 0 && !isAll;

  function handleAll(checked: boolean) {
    allTools.forEach((tool) => onToggle(integration.id, tool.name, checked));
  }

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
    <div className="space-y-4">
      {allTools.length > 0 && (
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-2">
            <Checkbox
              id="select-all"
              checked={isAll}
              data-state={isPartial ? "indeterminate" : undefined}
              onCheckedChange={handleAll}
            />
            <label
              htmlFor="select-all"
              className="text-sm font-medium cursor-pointer text-slate-700"
            >
              {isAll ? "Deselect all" : "Select all"}
            </label>
          </div>
          <span className="text-sm text-slate-500">
            {enabledCount} of {allTools.length} tools selected
          </span>
        </div>
      )}
      <div className="space-y-2">
        {allTools.map((tool) => {
          const enabled = toolsSet[integration.id]?.includes(tool.name) ??
            false;
          const selected = selectedTools[integration.id]?.has(tool.name) ??
            enabled;
          return (
            <div
              key={tool.name}
              role="button"
              className="flex items-start gap-3 py-2 px-3 hover:bg-slate-50 border border-slate-200 rounded-lg cursor-pointer"
              onClick={() => onToggle(integration.id, tool.name, !selected)}
            >
              <Checkbox
                id={`${integration.id}-${tool.name}`}
                checked={selected}
                className="mt-1"
              />
              <div className="flex flex-col min-w-0">
                <label
                  className={cn(
                    "text-sm truncate cursor-pointer text-slate-700",
                    enabled && !selected && "text-slate-400",
                  )}
                >
                  {formatToolName(tool.name)}
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

export function ToolsetSelector({
  open,
  onOpenChange,
  installedIntegrations,
  toolsSet,
  setIntegrationTools,
  initialSelectedIntegration,
}: ToolsetSelectorProps) {
  const [search, setSearch] = useState("");
  const [selectedIntegration, setSelectedIntegration] = useState<string | null>(
    null,
  );
  const selectedItemRef = useRef<HTMLDivElement | null>(null);
  const { selected, toggle } = useToolSelection(toolsSet, open);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (!open) {
      setSelectedIntegration(null);
      setSearch("");
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (initialSelectedIntegration) {
      setSelectedIntegration(initialSelectedIntegration);
      setTimeout(() => {
        selectedItemRef.current?.scrollIntoView({ block: "center" });
      }, 100);
    } else if (!isMobile && installedIntegrations.length > 0) {
      setSelectedIntegration(installedIntegrations[0].id);
    } else {
      setSelectedIntegration(null);
    }
  }, [open, initialSelectedIntegration, installedIntegrations, isMobile]);

  function handleUpdate() {
    Object.entries(selected).forEach(([id, set]) => {
      setIntegrationTools(id, Array.from(set));
    });
    onOpenChange(false);
  }

  const filtered = installedIntegrations.filter((i) =>
    i.name.toLowerCase().includes(search.toLowerCase())
  );
  const selectedData = installedIntegrations.find((i) =>
    i.id === selectedIntegration
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-full max-w-full md:h-auto md:max-w-[900px] w-full p-0 gap-0 flex flex-col border-none rounded-none md:rounded-lg [&>button]:hidden">
        <div className="flex flex-col">
          <DialogHeader>
            <div className="md:hidden relative flex items-center justify-between p-4 border-slate-200 text-base text-slate-700">
              <span>Add tools</span>
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-4 h-8 w-8"
                aria-label="Close"
                onClick={() => onOpenChange(false)}
              >
                <Icon name="close" size={16} />
              </Button>
            </div>
          </DialogHeader>
          <div
            className={cn(
              "p-2 border-b border-slate-200",
              isMobile ? (selectedIntegration ? "hidden" : "block") : "block",
            )}
          >
            <div className="bg-slate-100 rounded-lg px-4 py-2 text-slate-700 font-normal text-sm inline-block">
              Available Tools
            </div>
          </div>
          <div
            className={cn(
              "flex flex-col md:hidden",
              selectedIntegration ? "hidden" : "block",
            )}
          >
            <div className="border-b border-slate-200">
              <div className="flex items-center h-14 px-4 gap-2">
                <Icon name="search" size={20} className="text-slate-400" />
                <Input
                  placeholder="Search integrations..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="flex-1 h-full border-none focus-visible:ring-0 placeholder:text-slate-500 bg-transparent px-2"
                />
              </div>
            </div>
            <ScrollArea className="h-[calc(100vh-10rem)]">
              <div className="p-4">
                <IntegrationList
                  integrations={filtered}
                  selectedIntegration={selectedIntegration}
                  onSelect={setSelectedIntegration}
                  toolsSet={toolsSet}
                  selectedTools={selected}
                />
              </div>
            </ScrollArea>
          </div>
          <div
            className={cn(
              "flex flex-col md:hidden",
              selectedIntegration ? "block" : "hidden",
            )}
          >
            <div className="flex items-center gap-2 px-4 py-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSelectedIntegration(null)}
              >
                <Icon name="arrow_back" size={20} />
              </Button>
              <span className="text-slate-700">Back</span>
            </div>
            <ScrollArea className="h-[calc(100vh-10rem)]">
              {selectedData && (
                <div className="p-4">
                  <ToolList
                    integration={selectedData}
                    selectedTools={selected}
                    toolsSet={toolsSet}
                    onToggle={toggle}
                  />
                </div>
              )}
            </ScrollArea>
          </div>
          <div className="hidden md:block border-b border-slate-200">
            <Input
              placeholder="Search integrations..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="rounded-none border-none focus-visible:ring-0 placeholder:text-slate-500"
            />
          </div>
          <div className="hidden md:flex gap-6 p-4 h-[400px] overflow-hidden">
            <div className="w-[365px] flex-shrink-0 truncate h-full">
              <ScrollArea className="h-full">
                <IntegrationList
                  integrations={filtered}
                  selectedIntegration={selectedIntegration}
                  onSelect={setSelectedIntegration}
                  toolsSet={toolsSet}
                  selectedTools={selected}
                  selectedItemRef={selectedItemRef}
                />
              </ScrollArea>
            </div>
            <div className="flex-1 min-w-0">
              <ScrollArea className="h-full">
                {selectedData && (
                  <ToolList
                    integration={selectedData}
                    selectedTools={selected}
                    toolsSet={toolsSet}
                    onToggle={toggle}
                  />
                )}
              </ScrollArea>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t mt-auto">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleUpdate}
            className="bg-slate-700 hover:bg-slate-600 rounded-lg font-normal"
            disabled={Object.keys(selected).length === 0}
          >
            Update tools
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
