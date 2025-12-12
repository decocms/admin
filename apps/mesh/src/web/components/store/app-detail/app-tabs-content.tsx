import { CollectionSearch } from "@/web/components/collections/collection-search";
import { CollectionTableWrapper } from "@/web/components/collections/collection-table-wrapper";
import { EmptyState } from "@/web/components/empty-state";
import { ReadmeViewer } from "@/web/components/store/readme-viewer";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import type { AppData, TabItem } from "./types";

/** Component for rendering tools table */
function ToolsTable({
  tools,
  search,
  sortKey,
  sortDirection,
  onSort,
}: {
  tools: Array<Record<string, unknown>>;
  search: string;
  sortKey: string | undefined;
  sortDirection: "asc" | "desc" | null;
  onSort: (key: string) => void;
}) {
  // Filter tools
  const filteredTools = !search.trim()
    ? tools
    : (() => {
        const searchLower = search.toLowerCase();
        return tools.filter((tool) => {
          const name = (tool.name as string) || "";
          const desc = (tool.description as string) || "";
          return (
            name.toLowerCase().includes(searchLower) ||
            desc.toLowerCase().includes(searchLower)
          );
        });
      })();

  // Sort tools
  const sortedTools =
    !sortKey || !sortDirection
      ? filteredTools
      : [...filteredTools].sort((a, b) => {
          const aVal = (a[sortKey] as string) || "";
          const bVal = (b[sortKey] as string) || "";
          const comparison = String(aVal).localeCompare(String(bVal));
          return sortDirection === "asc" ? comparison : -comparison;
        });

  const columns = [
    {
      id: "name",
      header: "Name",
      render: (tool: Record<string, unknown>) => (
        <span className="text-sm font-medium font-mono text-foreground">
          {(tool.name as string) || "—"}
        </span>
      ),
      sortable: true,
    },
    {
      id: "description",
      header: "Description",
      render: (tool: Record<string, unknown>) => (
        <span className="text-sm text-foreground">
          {(tool.description as string) || "—"}
        </span>
      ),
      cellClassName: "flex-1",
      sortable: true,
    },
  ];

  return (
    <CollectionTableWrapper
      columns={columns}
      data={sortedTools}
      isLoading={false}
      sortKey={sortKey}
      sortDirection={sortDirection}
      onSort={onSort}
      emptyState={
        <EmptyState
          image={null}
          title={search ? "No tools found" : "No tools available"}
          description={
            search
              ? "Try adjusting your search terms"
              : "This app doesn't have any tools."
          }
        />
      }
    />
  );
}

interface AppTabsContentProps {
  data: AppData;
  availableTabs: TabItem[];
  effectiveActiveTabId: string;
  effectiveTools: unknown[];
  isLoadingRemoteTools: boolean;
  remoteToolsError?: Error | null;
  onTabChange: (tabId: string) => void;
}

export function AppTabsContent({
  data,
  availableTabs,
  effectiveActiveTabId,
  effectiveTools,
  isLoadingRemoteTools,
  remoteToolsError,
  onTabChange,
}: AppTabsContentProps) {
  // Track search and sorting for tools
  const [search, setSearch] = useState<string>("");
  const [sortKey, setSortKey] = useState<string | undefined>("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc" | null>(
    "asc",
  );

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDirection((prev) =>
        prev === "asc" ? "desc" : prev === "desc" ? null : "asc",
      );
      if (sortDirection === "desc") setSortKey(undefined);
    } else {
      setSortKey(key);
      setSortDirection("asc");
    }
  };

  return (
    <div className="lg:col-span-2 flex flex-col border-l border-border">
      {/* Tabs Section */}
      {availableTabs.length > 0 && (
        <div className="flex items-center gap-2 p-4 border-b border-border bg-background">
          {availableTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`inline-flex items-center justify-center whitespace-nowrap text-sm font-medium px-3 py-1.5 h-8 rounded-lg border transition-colors ${
                effectiveActiveTabId === tab.id
                  ? "bg-muted border-input text-foreground"
                  : "bg-transparent border-transparent text-muted-foreground hover:bg-muted"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* Tools Tab Content */}
      {effectiveActiveTabId === "tools" && (
        <div className="flex flex-col">
          {isLoadingRemoteTools ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="ml-2 text-sm text-muted-foreground">
                Loading tools...
              </span>
            </div>
          ) : remoteToolsError && effectiveTools.length === 0 ? (
            <EmptyState
              image={null}
              title="Failed to load tools"
              description={remoteToolsError.message || "Unable to fetch tools from the remote server. Please try again later."}
            />
          ) : effectiveTools.length > 0 ? (
            <>
              {/* Search Section */}
              <div className="border-b border-border bg-background">
                <CollectionSearch
                  value={search}
                  onChange={setSearch}
                  placeholder="Search for tools..."
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      setSearch("");
                      (e.target as HTMLInputElement).blur();
                    }
                  }}
                />
              </div>

              {/* Table Section */}
              <div className="bg-background overflow-hidden">
                <ToolsTable
                  tools={effectiveTools as Array<Record<string, unknown>>}
                  search={search}
                  sortKey={sortKey}
                  sortDirection={sortDirection}
                  onSort={handleSort}
                />
              </div>
            </>
          ) : (
            <EmptyState
              image={null}
              title="No tools available"
              description="This app doesn't have any tools."
            />
          )}
        </div>
      )}

      {/* Overview Tab Content */}
      {effectiveActiveTabId === "overview" && (
        <div className="p-4 bg-background">
          <p className="text-muted-foreground leading-relaxed">
            {data.description || "No overview available"}
          </p>
        </div>
      )}

      {/* Models Tab Content */}
      {effectiveActiveTabId === "models" && data.models && (
        <div className="p-4 bg-background text-muted-foreground">
          <p>Models information</p>
        </div>
      )}

      {/* Emails Tab Content */}
      {effectiveActiveTabId === "emails" && data.emails && (
        <div className="p-4 bg-background text-muted-foreground">
          <p>Email configuration available</p>
        </div>
      )}

      {/* Analytics Tab Content */}
      {effectiveActiveTabId === "analytics" &&
        (data.analytics as unknown) != null && (
          <div className="p-4 bg-background text-muted-foreground">
            <p>Analytics configuration available</p>
          </div>
        )}

      {/* CDN Tab Content */}
      {effectiveActiveTabId === "cdn" && (data.cdn as unknown) != null && (
        <div className="p-4 bg-background text-muted-foreground">
          <p>CDN configuration available</p>
        </div>
      )}

      {/* README Tab Content */}
      {effectiveActiveTabId === "readme" && (
        <div className="flex-1 overflow-y-auto bg-background">
          <ReadmeViewer repository={data?.repository} />
        </div>
      )}
    </div>
  );
}

