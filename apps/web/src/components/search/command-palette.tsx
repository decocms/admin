import {
  useAgents,
  useIntegrations,
  useIntegrationViews,
  useDocuments,
} from "@deco/sdk";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@deco/ui/components/command.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { useDeferredValue, useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { trackEvent } from "../../hooks/analytics.ts";
import { useNavigateWorkspace } from "../../hooks/use-navigate-workspace.ts";
import { IntegrationAvatar } from "../common/avatar/integration.tsx";
import { AgentAvatar } from "../common/avatar/agent.tsx";
import { AppKeys, getConnectionAppKey } from "../integrations/apps.ts";

interface SearchResult {
  id: string;
  title: string;
  description?: string;
  icon?: string;
  avatar?: string;
  type: "agent" | "app" | "view" | "document";
  href: string;
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
  // views not working properly
  const { data: views = [] } = useIntegrationViews({ enabled: true });
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

    // Add views
    for (const view of views) {
      results.push({
        id: `view-${view.name}-${view.integration?.id}`,
        title: view.title || view.name || "Untitled View",
        description: view.url,
        icon: view.icon || "visibility",
        type: "view",
        href: `/views/${view.integration?.id}/${view.name}`,
        integration: view.integration,
      });
    }

    // Add documents/prompts
    for (const document of documents) {
      const documentName = document.data?.name || "Untitled Document";
      const documentId = document.uri;
      console.log(document);
      results.push({
        id: `document-${documentId}`,
        title: documentName,
        description: document.data?.description || undefined,
        icon: "docs",
        type: "document",
        href: `/rsc/i:documents-management/document/${encodeURIComponent(documentId)}`,
      });
    }

    return results;
  }, [agents, integrations, views, documents]);

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
      agent: [],
      app: [],
      view: [],
      document: [],
    };

    for (const result of filteredResults) {
      if (groups[result.type].length < 3) {
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
    agent: "Agents",
    app: "Apps",
    view: "Views",
    document: "Documents",
  };

  const typeIcons = {
    agent: "robot_2",
    app: "grid_view",
    view: "visibility",
    document: "docs",
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Search agents, apps, views, documents..."
        value={search}
        onValueChange={setSearch}
        className="h-12"
      />

      <CommandList className="max-h-[400px]">
        <CommandEmpty className="py-8 text-center text-sm text-muted-foreground">
          No results found for "{deferredSearch}"
        </CommandEmpty>

        {Object.entries(groupedResults).map(([type, results], index) => {
          if (results.length === 0) return null;

          return (
            <CommandGroup
              key={type + index}
              heading={
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <Icon
                    name={typeIcons[type as keyof typeof typeIcons]}
                    size={14}
                  />
                  {typeLabels[type as keyof typeof typeLabels]}
                </div>
              }
            >
              {results.map((result, index) => (
                <CommandItem
                  key={result.id + index}
                  value={`${result.title} ${result.description} ${result.type} ${index}`}
                  onSelect={() => handleSelect(result)}
                  className="flex items-center gap-3 cursor-pointer"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {result.type === "agent" && (
                      <AgentAvatar
                        url={result.avatar}
                        fallback={result.title}
                        size="xs"
                      />
                    )}

                    {result.integration && (
                      <IntegrationAvatar
                        size="xs"
                        url={result.integration.icon}
                        fallback={result.integration.name}
                        className="!rounded-md flex-shrink-0"
                      />
                    )}

                    {(result.type === "document" || result.type === "view") && (
                      <Icon
                        name={result.icon || typeIcons[result.type]}
                        size={20}
                        className="text-muted-foreground flex-shrink-0"
                      />
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">
                        {result.title}
                      </div>
                      {result.description && (
                        <div className="text-xs text-muted-foreground truncate">
                          {result.description}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100">
                      ↵
                    </kbd>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          );
        })}
      </CommandList>
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
