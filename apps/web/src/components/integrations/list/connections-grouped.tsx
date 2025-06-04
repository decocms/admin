/**
 * This file uses a concept of "App" to group connections by their source MCP.
 *
 * An "App" is a group of connections from the same source MCP.
 *
 * The "App key" is a unique identifier used to group connections by their source application.
 * Grouping by app is useful to see all connections from the same app in one place.
 *
 * `${hostname}-${appName}`
 */
import {
  type Integration,
  useIntegrations
} from "@deco/sdk";
import { Badge } from "@deco/ui/components/badge.tsx";
import { Card, CardContent } from "@deco/ui/components/card.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { useMemo, useState } from "react";
import { useNavigateWorkspace } from "../../../hooks/use-navigate-workspace.ts";
import { Avatar } from "../../common/avatar/index.tsx";
import { EmptyState } from "../../common/empty-state.tsx";
import { Table, TableColumn } from "../../common/table/index.tsx";
import { IntegrationInfo } from "../../common/table/table-cells.tsx";
import { Header, IntegrationPageLayout } from "./breadcrumb.tsx";
import { IntegrationIcon } from "./common.tsx";

interface GroupedApp {
  id: string;
  name: string;
  icon?: string;
  description: string;
  instances: number;
  usedBy: { avatarUrl: string }[];
}

const WELL_KNOWN_DECO_CHAT_APP_KEY = "deco.chat";

function AppCard({
  app,
  onConfigure,
}: {
  app: GroupedApp;
  onConfigure: (app: GroupedApp) => void;
}) {
  return (
    <Card
      className="group cursor-pointer hover:shadow-md transition-shadow rounded-xl relative border-border"
      onClick={() => onConfigure(app)}
    >
      <CardContent className="p-0">
        <div className="grid grid-cols-[min-content_1fr_min-content] gap-4 items-start p-4">
          <IntegrationIcon
            icon={app.icon}
            name={app.name}
            className="h-10 w-10"
          />

          <div className="flex flex-col gap-0 min-w-0">
            <div className="text-sm font-semibold truncate">
              {app.name}
            </div>
            <div className="text-sm text-muted-foreground line-clamp-1">
              {app.description}
            </div>
          </div>
        </div>
        <div className="px-4 py-3 border-t border-border">
          <Badge variant="secondary" className="text-xs">
            {app.instances} Instance{app.instances > 1 ? "s" : ""}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}

function CardsView(
  { apps, onConfigure }: {
    apps: GroupedApp[];
    onConfigure: (app: GroupedApp) => void;
  },
) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 peer">
      {apps.map((app) => (
        <AppCard
          key={app.id}
          app={app}
          onConfigure={onConfigure}
        />
      ))}
    </div>
  );
}

function TableView(
  { apps, onConfigure }: {
    apps: GroupedApp[];
    onConfigure: (app: GroupedApp) => void;
  },
) {
  const [sortKey, setSortKey] = useState<string>("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  function getSortValue(row: GroupedApp, key: string): string {
    if (key === "description") return row.description?.toLowerCase() || "";
    return row.name?.toLowerCase() || "";
  }

  const sortedApps = [...apps].sort((a, b) => {
    const aVal = getSortValue(a, sortKey);
    const bVal = getSortValue(b, sortKey);
    if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
    if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
    return 0;
  });

  const columns: TableColumn<GroupedApp>[] = [
    {
      id: "name",
      header: "Name",
      render: (app) => <IntegrationInfo integration={app} />,
      sortable: true,
    },
    {
      id: "instance-count",
      header: "Instances",
      render: (app) => (
        <Badge variant="secondary" className="text-xs">
          {app.instances} Instance{app.instances > 1 ? "s" : ""}
        </Badge>
      ),
    },
    {
      id: "used-by",
      header: "Agents",
      render: (app) => (
        <div className="flex items-center gap-2">
          {app.usedBy.map((agent) => (
            <Avatar
              key={agent.avatarUrl}
              url={agent.avatarUrl}
              fallback={agent.avatarUrl}
            />
          ))}
        </div>
      ),
    },
    {
      id: "people-with-access",
      header: "People with access",
      render: () => (
        <div className="flex items-center gap-2">
          <Icon name="group" size={16} />
          <span className="text-sm">Team</span>
        </div>
      ),
    },
  ];

  function handleSort(key: string) {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDirection("asc");
    }
  }

  return (
    <Table
      columns={columns}
      data={sortedApps}
      sortKey={sortKey}
      sortDirection={sortDirection}
      onSort={handleSort}
      onRowClick={onConfigure}
    />
  );
}

function getConnectionAppKey(integration: Integration) {
  if (integration.connection.type === "HTTP") {
    const url = new URL(integration.connection.url);

    if (url.hostname.includes("mcp.deco.site")) {
      // https://mcp.deco.site/apps/{appName}...
      const appName = url.pathname.split("/")[2];
      return `mcp.deco.site-${decodeURIComponent(appName)}`;
    }

    if (url.hostname.includes("mcp.wppagent.com")) {
      return `mcp.wppagent.com-WhatsApp`;
    }

    return null;
  }

  if (integration.connection.type === "SSE") {
    const url = new URL(integration.connection.url);

    if (url.hostname.includes("mcp.composio.dev")) {
      // https://mcp.composio.dev/{appName}...
      const appName = url.pathname.split("/")[1];
      return `mcp.composio.dev-${appName}`;
    }

    return null;
  }

  if (integration.connection.type === "INNATE") {
    return WELL_KNOWN_DECO_CHAT_APP_KEY;
  }

  return null;
}

function groupConnections(integrations: Integration[]) {
  const grouped: Record<string, Integration[]> = {};

  for (const integration of integrations) {
    const key = getConnectionAppKey(integration);

    if (key) {
      if (!grouped[key]) {
        grouped[key] = [];
      }

      grouped[key].push(integration);
    } else {
      grouped[`${integration.id}-${integration.name}`] = [integration];
    }
  }

  return grouped;
}

function useConnectionListOptions() {
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
  const [filter, setFilter] = useState<string>("");
  const navigateWorkspace = useNavigateWorkspace();

  const handleConfigure = (app: GroupedApp) => {
    navigateWorkspace(`/integration/${app.id}`);
  };

  return {
    filter,
    setFilter,
    setViewMode,
    viewMode,
    handleConfigure,
  };
}

function ConnectionsGroupedTab() {
  const { data: installedIntegrations } = useIntegrations();
  const navigateWorkspace = useNavigateWorkspace();

  const {
    filter,
    viewMode,
    setFilter,
    setViewMode,
    handleConfigure,
  } = useConnectionListOptions();

  const groupedApps: GroupedApp[] = useMemo(() => {
    const filteredIntegrations = installedIntegrations?.filter((integration) =>
      integration.name.toLowerCase().includes(filter.toLowerCase()) &&
      integration.connection.type !== "INNATE"
    ) ?? [];

    const grouped = groupConnections(filteredIntegrations);

    return Object.entries(grouped).map(([key, integrations]) => {
      if (key === "deco.chat") {
        return {
          id: key,
          name: "Deco Chat",
          icon: "https://assets.webdraw.app/uploads/deco-avocado-light.png",
          description: "Native deco.chat tools.",
          instances: 1,
          usedBy: [],
        };
      }

      return {
        id: key,
        name: key.split("-").at(-1) ?? "Unknown",
        icon: integrations[0].icon,
        description: "description",
        instances: integrations.length,
        usedBy: [],
      };
    });
  }, [installedIntegrations, filter]);

  return (
    <div className="flex flex-col gap-4 h-full py-4">
      <div className="px-4 overflow-x-auto">
        <Header
          query={filter}
          setQuery={setFilter}
          viewMode={viewMode}
          setViewMode={setViewMode}
        />
      </div>

      <div className="flex-1 min-h-0 px-4 overflow-x-auto">
        {!installedIntegrations
          ? (
            <div className="flex h-48 items-center justify-center">
              <Spinner size="lg" />
            </div>
          )
          : installedIntegrations.length === 0
          ? (
            <EmptyState
              icon="conversion_path"
              title="No connected integrations yet"
              description="Connect services to expand what your agents can do."
              buttonProps={{
                children: "Connect an integration",
                onClick: () => navigateWorkspace("/integrations/marketplace"),
              }}
            />
          )
          : (
            viewMode === "cards"
              ? (
                <CardsView
                  apps={groupedApps}
                  onConfigure={handleConfigure}
                />
              )
              : (
                <TableView
                  apps={groupedApps}
                  onConfigure={handleConfigure}
                />
              )
          )}
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <IntegrationPageLayout
      tabs={{
        connections: {
          title: "Connections",
          Component: ConnectionsGroupedTab,
          initialOpen: true,
        },
      }}
    />
  );
}
