import { useIntegrations } from "@deco/sdk";
import { useMemo, useState } from "react";
import { ResourcesV2List } from "../resources-v2/list.tsx";
import { IntegrationIcon } from "../integrations/common.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";

type ResourceType = "documents" | "tools" | "workflows" | "views" | "agents";

const RESOURCE_TABS = [
  { id: "documents", label: "Documents", integrationId: "i:documents-management", resourceName: "document" },
  { id: "tools", label: "Tools", integrationId: "i:tools-management", resourceName: "tool" },
  { id: "workflows", label: "Workflows", integrationId: "i:workflows-management", resourceName: "workflow" },
  { id: "views", label: "Views", integrationId: "i:views-management", resourceName: "view" },
  { id: "agents", label: "Agents", integrationId: "i:agent-management", resourceName: "agent" },
];

/**
 * HOME component displays the i:self MCP with all native project resources
 * Shows the MCP instance info (icon, URL) and uses ResourceHeader tabs for resource types
 */
export default function ProjectHome() {
  const { data: integrations = [] } = useIntegrations();
  const [activeTab, setActiveTab] = useState<ResourceType>("documents");

  // Find the i:self integration
  const selfIntegration = useMemo(() => {
    return integrations.find((i) => i.id === "i:self");
  }, [integrations]);

  const activeResource = RESOURCE_TABS.find((r) => r.id === activeTab);

  return (
    <div className="flex flex-col h-full">
      {/* Header with Instance Info */}
      <div className="px-8 pt-6 pb-4">
        <div className="max-w-[1600px] mx-auto w-full">
          <div className="flex items-start gap-4">
            {selfIntegration?.icon ? (
              <IntegrationIcon
                icon={selfIntegration.icon}
                name={selfIntegration.name}
                size="lg"
              />
            ) : (
              <Icon name="home" size={48} className="shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-semibold truncate mb-1">
                {selfIntegration?.name || "Self MCP"}
              </h1>
              <p className="text-sm text-muted-foreground mb-3">
                {selfIntegration?.description || "Native project resources"}
              </p>

              {/* Instance URL */}
              {selfIntegration && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Instance:</span>
                  <div className="flex items-center gap-2 px-2 py-1 bg-muted rounded-md">
                    <Icon name="link" size={14} className="text-muted-foreground" />
                    <code className="text-xs">
                      {selfIntegration.connection?.type === "HTTP"
                        ? selfIntegration.connection.url
                        : "Unknown connection"}
                    </code>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Resource List with Tabs in Header */}
      <div className="flex-1 overflow-hidden">
        {activeResource && (
          <ResourcesV2List
            integrationId={activeResource.integrationId}
            resourceName={activeResource.resourceName}
            tabs={RESOURCE_TABS}
            activeTab={activeTab}
            onTabChange={(tabId) => setActiveTab(tabId as ResourceType)}
          />
        )}
      </div>
    </div>
  );
}

