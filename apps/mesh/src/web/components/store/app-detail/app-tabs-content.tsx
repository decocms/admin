import { EmptyState } from "@/web/components/empty-state";
import { ReadmeViewer } from "@/web/components/store/readme-viewer";
import { ToolsList, type Tool } from "@/web/components/tools";
import { ResourceTabs } from "@deco/ui/components/resource-tabs.tsx";
import { Loader2 } from "lucide-react";
import type { AppData, TabItem } from "./types";

interface AppTabsContentProps {
  data: AppData;
  availableTabs: TabItem[];
  effectiveActiveTabId: string;
  effectiveTools: unknown[];
  isLoadingTools?: boolean;
  onTabChange: (tabId: string) => void;
}

export function AppTabsContent({
  data,
  availableTabs,
  effectiveActiveTabId,
  effectiveTools,
  isLoadingTools = false,
  onTabChange,
}: AppTabsContentProps) {
  // Convert tools to the expected format
  const tools: Tool[] = effectiveTools.map((tool) => {
    const t = tool as Record<string, unknown>;
    return {
      name: (t.name as string) || "",
      description: (t.description as string) || undefined,
    };
  });

  return (
    <div className="lg:col-span-2 flex flex-col border-l border-border">
      {/* Tabs Section */}
      {availableTabs.length > 0 && (
        <div className="px-4 py-2 border-b border-border bg-background">
          <ResourceTabs
            tabs={availableTabs}
            activeTab={effectiveActiveTabId}
            onTabChange={onTabChange}
          />
        </div>
      )}

      {/* Tools Tab Content */}
      {effectiveActiveTabId === "tools" && (
        <div className="flex flex-col flex-1">
          {isLoadingTools ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="ml-2 text-sm text-muted-foreground">
                Loading tools...
              </span>
            </div>
          ) : effectiveTools.length > 0 ? (
            <ToolsList
              tools={tools}
              showToolbar={false}
              emptyMessage="This app doesn't have any tools."
            />
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
