import { useState } from "react";
import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@deco/ui/components/tabs.tsx";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@deco/ui/components/card.tsx";
import { Badge } from "@deco/ui/components/badge.tsx";
import { Input } from "@deco/ui/components/input.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import type { Tab } from "../dock/index.tsx";
import { DefaultBreadcrumb, PageLayout } from "../layout.tsx";
import { IntegrationIcon } from "../integrations/common.tsx";
import { useIntegrations, useMarketplaceIntegrations } from "@deco/sdk";
import { Spinner } from "@deco/ui/components/spinner.tsx";

function HomeTab() {
  const { data: marketplace, isLoading } = useMarketplaceIntegrations();
  const [searchQuery, setSearchQuery] = useState("");

  const filteredIntegrations = marketplace?.integrations?.filter(integration =>
    integration.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    integration.description.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Discover Apps</h1>
        <p className="text-muted-foreground">
          Explore and connect powerful integrations to enhance your agents
        </p>
      </div>

      <div className="flex items-center space-x-2">
        <div className="relative flex-1 max-w-sm">
          <Icon name="search" className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search apps..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredIntegrations.map((integration) => (
          <Card key={integration.id} className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader className="pb-3">
              <div className="flex items-center space-x-3">
                <IntegrationIcon
                  icon={integration.icon}
                  name={integration.name}
                  size="sm"
                />
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-base truncate">{integration.name}</CardTitle>
                  <div className="flex items-center space-x-2 mt-1">
                    <Badge variant="secondary" className="text-xs">
                      {integration.provider}
                    </Badge>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <CardDescription className="text-sm line-clamp-2">
                {integration.description}
              </CardDescription>
              <div className="flex items-center justify-between mt-4">
                <div className="flex items-center space-x-1 text-xs text-muted-foreground">
                  <Icon name="star" size={12} />
                  <span>Popular</span>
                </div>
                <Button size="sm" variant="outline">
                  <Icon name="add" size={16} />
                  Connect
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredIntegrations.length === 0 && (
        <div className="text-center py-12">
          <Icon name="search_off" size={48} className="mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium">No apps found</h3>
          <p className="text-muted-foreground">Try adjusting your search query</p>
        </div>
      )}
    </div>
  );
}

function AgentsTab() {
  return (
    <div className="space-y-6 p-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Agent Templates</h1>
        <p className="text-muted-foreground">
          Pre-built agent configurations for common use cases
        </p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="hover:shadow-lg transition-shadow cursor-pointer">
          <CardHeader>
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                <Icon name="support_agent" className="text-primary" />
              </div>
              <div>
                <CardTitle className="text-base">Customer Support</CardTitle>
                <Badge variant="secondary" className="text-xs mt-1">Template</Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <CardDescription>
              AI-powered customer support agent with knowledge base integration
            </CardDescription>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow cursor-pointer">
          <CardHeader>
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                <Icon name="analytics" className="text-primary" />
              </div>
              <div>
                <CardTitle className="text-base">Data Analyst</CardTitle>
                <Badge variant="secondary" className="text-xs mt-1">Template</Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <CardDescription>
              Analyze data and generate insights from various data sources
            </CardDescription>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MCPPluginTab() {
  return (
    <div className="space-y-6 p-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">MCP Plugins</h1>
        <p className="text-muted-foreground">
          Model Context Protocol plugins for extended functionality
        </p>
      </div>
      
      <div className="text-center py-12">
        <Icon name="extension" size={48} className="mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium">Coming Soon</h3>
        <p className="text-muted-foreground">MCP plugin marketplace will be available soon</p>
      </div>
    </div>
  );
}

function ModelTab() {
  return (
    <div className="space-y-6 p-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">AI Models</h1>
        <p className="text-muted-foreground">
          Available AI models and providers for your agents
        </p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                <Icon name="smart_toy" className="text-primary" />
              </div>
              <div>
                <CardTitle className="text-base">GPT-4</CardTitle>
                <Badge variant="secondary" className="text-xs mt-1">OpenAI</Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <CardDescription>
              Advanced language model for complex reasoning and generation
            </CardDescription>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                <Icon name="psychology" className="text-primary" />
              </div>
              <div>
                <CardTitle className="text-base">Claude</CardTitle>
                <Badge variant="secondary" className="text-xs mt-1">Anthropic</Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <CardDescription>
              Constitutional AI model focused on helpfulness and safety
            </CardDescription>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ChannelTab() {
  return (
    <div className="space-y-6 p-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Communication Channels</h1>
        <p className="text-muted-foreground">
          Connect your agents to various communication platforms
        </p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="hover:shadow-lg transition-shadow cursor-pointer">
          <CardHeader>
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                <Icon name="chat" className="text-primary" />
              </div>
              <div>
                <CardTitle className="text-base">Discord</CardTitle>
                <Badge variant="secondary" className="text-xs mt-1">Channel</Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <CardDescription>
              Deploy your agent as a Discord bot for community engagement
            </CardDescription>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow cursor-pointer">
          <CardHeader>
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                <Icon name="webhook" className="text-primary" />
              </div>
              <div>
                <CardTitle className="text-base">Webhook</CardTitle>
                <Badge variant="secondary" className="text-xs mt-1">Channel</Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <CardDescription>
              HTTP endpoints for custom integrations and automations
            </CardDescription>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow cursor-pointer">
          <CardHeader>
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                <Icon name="phone" className="text-primary" />
              </div>
              <div>
                <CardTitle className="text-base">WhatsApp</CardTitle>
                <Badge variant="secondary" className="text-xs mt-1">Channel</Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <CardDescription>
              Connect your agent to WhatsApp for direct messaging
            </CardDescription>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

const TABS: Record<string, Tab> = {
  home: {
    title: "Home",
    Component: HomeTab,
    initialOpen: true,
    active: true,
  },
  agents: {
    title: "Agents",
    Component: AgentsTab,
    initialOpen: true,
  },
  mcp: {
    title: "MCP Plugin",
    Component: MCPPluginTab,
    initialOpen: true,
  },
  models: {
    title: "Model",
    Component: ModelTab,
    initialOpen: true,
  },
  channels: {
    title: "Channel",
    Component: ChannelTab,
    initialOpen: true,
  },
};

export default function BrowseAppsPage() {
  return (
    <PageLayout
      tabs={TABS}
      breadcrumb={
        <DefaultBreadcrumb items={[{ label: "Browse apps", link: "/browse-apps" }]} />
      }
    />
  );
} 