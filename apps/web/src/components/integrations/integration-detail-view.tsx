import { useTools } from "@deco/sdk";
import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Card, CardContent } from "@deco/ui/components/card.tsx";
import { Badge } from "@deco/ui/components/badge.tsx";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbSeparator } from "@deco/ui/components/breadcrumb.tsx";
import { ScrollArea } from "@deco/ui/components/scroll-area.tsx";
import type { MarketplaceIntegration } from "./marketplace.tsx";
import { IntegrationIcon } from "./common.tsx";

interface IntegrationDetailViewProps {
  integration: MarketplaceIntegration;
  onBack: () => void;
  onInstall: (integration: MarketplaceIntegration) => void;
}

export function IntegrationDetailView({ integration, onBack, onInstall }: IntegrationDetailViewProps) {
  const { data: toolsData, isLoading: isLoadingTools } = useTools(
    // Create a mock connection for the marketplace integration to fetch tools
    { type: "HTTP", url: `https://example.com/${integration.id}` }
  );

  const tools = toolsData?.tools || [];

  return (
    <div className="flex flex-col h-full">
      {/* Breadcrumb */}
      <div className="mb-4">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink 
                onClick={onBack}
                className="cursor-pointer hover:text-foreground"
              >
                Integrations
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <span className="font-medium">{integration.friendlyName || integration.name}</span>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      {/* Integration Header */}
      <div className="mb-6">
        <div className="flex items-start gap-4">
          <IntegrationIcon
            icon={integration.icon}
            name={integration.friendlyName || integration.name}
            className="h-16 w-16"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <h2 className="text-2xl font-semibold truncate">
                {integration.friendlyName || integration.name}
              </h2>
              {integration.verified && (
                <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-200">
                  <Icon name="verified" size={14} className="mr-1" />
                  Verified
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground mb-4 leading-relaxed">
              {integration.description}
            </p>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Icon name="business" size={16} />
                <span>Provider: {integration.provider}</span>
              </div>
              {tools.length > 0 && (
                <div className="flex items-center gap-1">
                  <Icon name="build" size={16} />
                  <span>{tools.length} tools available</span>
                </div>
              )}
            </div>
          </div>
          <Button 
            onClick={() => onInstall(integration)}
            variant="special"
            size="lg"
            className="shrink-0"
          >
            <Icon name="add" size={16} className="mr-2" />
            Add Integration
          </Button>
        </div>
      </div>

      {/* Tools Section */}
      <div className="flex-1 overflow-hidden">
        <div className="mb-4">
          <h3 className="text-lg font-semibold mb-2">Available Tools</h3>
          <p className="text-muted-foreground text-sm">
            These tools will be available to your agents once you add this integration.
          </p>
        </div>

        <ScrollArea className="h-full">
          {isLoadingTools ? (
            <div className="flex items-center justify-center py-8">
              <Icon name="hourglass_empty" size={24} className="animate-spin" />
              <span className="ml-2 text-muted-foreground">Loading tools...</span>
            </div>
          ) : tools.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Icon name="build" size={48} className="text-muted-foreground mb-4" />
              <h4 className="font-medium text-lg mb-2">No tools information available</h4>
              <p className="text-muted-foreground text-sm max-w-md">
                Tool details will be available after adding this integration to your workspace.
              </p>
            </div>
          ) : (
            <div className="grid gap-3">
              {tools.map((tool, index) => (
                <Card key={tool.name || index} className="hover:shadow-sm transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="bg-blue-50 p-2 rounded-lg shrink-0">
                        <Icon name="build" size={16} className="text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-sm mb-1 truncate">
                          {tool.name?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Unnamed Tool'}
                        </h4>
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {tool.description || 'No description available'}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  );
} 