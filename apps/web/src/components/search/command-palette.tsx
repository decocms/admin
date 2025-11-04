import { useAgents, useDocuments, useIntegrations } from "@deco/sdk";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@deco/ui/components/command.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { trackEvent } from "../../hooks/analytics.ts";
import { useNavigateWorkspace } from "../../hooks/use-navigate-workspace.ts";
import { AgentAvatar } from "../common/avatar/agent.tsx";
import { IntegrationAvatar } from "../common/avatar/integration.tsx";
import { AppKeys, getConnectionAppKey } from "../integrations/apps.ts";

interface SearchResult {
  id: string;
  title: string;
  description?: string;
  icon?: string;
  avatar?: string;
  type: "action" | "agent" | "app" | "document";
  href: string;
  shortcut?: string;
  integration?: {
    id: string;
    name: string;
    icon?: string;
  };
}

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const navigate = useNavigate();
  const navigateWorkspace = useNavigateWorkspace();

  // Data fetching with proper error handling
  const { data: agents = [] } = useAgents();
  const { data: integrations = [] } = useIntegrations();
  const { data: documents = [] } = useDocuments();

  // Combine all data into search results
  const searchResults = useMemo(() => {
    const results: SearchResult[] = [];

    // Add agents
    for (const agent of agents) {
      results.push({
        id: `agent-${agent.id}`,
        title: agent.name,
        description: agent.description,
        icon: "robot_2",
        avatar: agent.avatar,
        type: "agent",
        href: `/agent/${agent.id}/${crypto.randomUUID()}`,
      });
    }

    // Add apps/integrations
    for (const integration of integrations) {
      if (integration.id.startsWith("a:")) continue;
      const key = getConnectionAppKey(integration);
      const appKey = AppKeys.build(key);
      results.push({
        id: `app-${integration.id}`,
        title: integration.name,
        description: integration.description,
        icon: "grid_view",
        type: "app",
        href: `/apps/${appKey}`,
        integration: {
          id: integration.id,
          name: integration.name,
          icon: integration.icon,
        },
      });
    }

    // Add documents/prompts
    for (const document of documents) {
      const documentName = document.data?.name || "Untitled Document";
      const documentId = document.uri;
      results.push({
        id: `document-${documentId}`,
        title: documentName,
        description: document.data?.description || undefined,
        icon: "description",
        type: "document",
        href: `/rsc/i:documents-management/document/${encodeURIComponent(documentId)}`,
      });
    }

    return results;
  }, [agents, integrations, documents]);

  // Filter results based on search
  const filteredResults = useMemo(() => {
    const query = deferredSearch.toLowerCase();
    return searchResults.filter((result) => {
      const titleMatch = result.title.toLowerCase().includes(query);
      const descriptionMatch = result.description
        ?.toLowerCase()
        .includes(query);
      const typeMatch = result.type.toLowerCase().includes(query);
      return titleMatch || descriptionMatch || typeMatch;
    }); // Limit search results
  }, [searchResults, deferredSearch]);

  // Group results by type
  const groupedResults = useMemo(() => {
    const groups: Record<string, SearchResult[]> = {
      action: [],
      agent: [],
      app: [],
      document: [],
    };

    for (const result of filteredResults) {
      if (result.type === "action") {
        groups.action.push(result);
      } else if (groups[result.type].length < 3) {
        groups[result.type].push(result);
      }
    }

    return groups;
  }, [filteredResults]);

  // Handle result selection
  const handleSelect = (result: SearchResult) => {
    trackEvent("command_palette_selection", {
      type: result.type,
      title: result.title,
    });

    if (result.href.startsWith("/")) {
      navigateWorkspace(result.href);
    } else {
      navigate(result.href);
    }

    onOpenChange(false);
    setSearch("");
  };

  // Reset search when dialog closes
  useEffect(() => {
    if (!open) {
      setSearch("");
    }
  }, [open]);

  const typeLabels = {
    action: "Actions",
    agent: "Agents",
    app: "Apps",
    document: "Documents",
  };

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      className="sm:max-w-[750px] top-[15vh]! translate-y-0!"
    >
      <CommandInput
        placeholder="Type a command or search"
        value={search}
        onValueChange={setSearch}
        className="h-[54px] text-base px-3 py-2"
      />

      <CommandList className="max-h-[450px] pb-0">
        <CommandEmpty className="py-8 text-center text-sm text-muted-foreground">
          No results found for "{deferredSearch}"
        </CommandEmpty>

        <div className="pt-1 px-1.5 pb-0 flex flex-col gap-[2px]">
          {Object.entries(groupedResults).map(([type, results]) => {
            if (results.length === 0) return null;

            return (
              <CommandGroup
                key={type}
                heading={
                  <div className="flex items-center h-[30px] px-3 py-2 text-xs font-mono uppercase text-muted-foreground">
                    {typeLabels[type as keyof typeof typeLabels]}
                  </div>
                }
                className="p-0! **:[[cmdk-group-heading]]:px-0! **:[[cmdk-group-heading]]:py-0! **:[[cmdk-group-heading]]:m-0!"
              >
                {results.map((result, _idx) => (
                  <CommandItem
                    key={result.id}
                    value={`${result.title} ${result.description} ${result.type}`}
                    onSelect={() => handleSelect(result)}
                    className="flex items-center gap-2 h-[46px] px-3 py-0 rounded-xl cursor-pointer data-[selected=true]:bg-accent group"
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {result.type === "agent" && result.avatar && (
                        <AgentAvatar
                          url={result.avatar}
                          fallback={result.title}
                          size="xs"
                        />
                      )}

                      {result.type === "action" && (
                        <Icon
                          name={result.icon || "bolt"}
                          size={20}
                          className="text-muted-foreground shrink-0"
                        />
                      )}

                      {result.integration && (
                        <IntegrationAvatar
                          size="xs"
                          url={result.integration.icon}
                          fallback={result.integration.name}
                          className="rounded-md! shrink-0"
                        />
                      )}

                      {result.type === "document" && !result.integration && (
                        <Icon
                          name={result.icon || "description"}
                          size={20}
                          className="text-muted-foreground shrink-0"
                        />
                      )}

                      <div className="flex-1 min-w-0">
                        <div className="font-normal text-sm truncate text-foreground">
                          {result.title}
                        </div>
                      </div>
                    </div>

                    <kbd className="pointer-events-none hidden group-data-[selected=true]:inline-flex select-none items-center justify-center rounded-md border border-border bg-transparent size-5 p-0.5">
                      <Icon
                        name="subdirectory_arrow_left"
                        size={14}
                        className="text-muted-foreground"
                      />
                    </kbd>
                  </CommandItem>
                ))}
              </CommandGroup>
            );
          })}
        </div>
      </CommandList>

      <div className="border-t border-border h-10 flex items-center px-1">
        <div className="flex items-center gap-4 px-2 text-xs text-muted-foreground flex-1">
          <div className="flex items-center gap-1.5">
            <div className="flex items-center gap-0.5">
              <kbd className="inline-flex items-center justify-center border border-border rounded-md size-[18px] p-0.5">
                <Icon
                  name="arrow_upward"
                  size={14}
                  className="text-muted-foreground"
                />
              </kbd>
              <kbd className="inline-flex items-center justify-center border border-border rounded-md size-[18px] p-0.5">
                <Icon
                  name="arrow_downward"
                  size={14}
                  className="text-muted-foreground"
                />
              </kbd>
            </div>
            <span>Navigate</span>
          </div>

          <div className="flex items-center gap-1.5">
            <kbd className="inline-flex items-center justify-center border border-border rounded-md size-[18px] p-0.5">
              <Icon
                name="subdirectory_arrow_left"
                size={14}
                className="text-muted-foreground"
              />
            </kbd>
            <span>Select</span>
          </div>

          <div className="flex items-center gap-1.5">
            <kbd className="inline-flex items-center justify-center border border-border rounded-md h-[18px] px-1.5 font-normal text-[10px]">
              esc
            </kbd>
            <span>Close</span>
          </div>
        </div>
      </div>
    </CommandDialog>
  );
}

// Hook for global keyboard shortcut
export function useCommandPalette() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  return {
    open,
    setOpen,
    onOpenChange: setOpen,
  };
}
