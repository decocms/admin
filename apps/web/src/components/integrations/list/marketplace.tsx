import {
  type Integration,
  useInstallFromMarketplace,
  useMarketplaceIntegrations,
  useUpdateThreadMessages,
} from "@deco/sdk";
import { Button } from "@deco/ui/components/button.tsx";
import { Card, CardContent } from "@deco/ui/components/card.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@deco/ui/components/dialog.tsx";
import { ScrollArea } from "@deco/ui/components/scroll-area.tsx";
import { useMemo, useState } from "react";
import { trackEvent } from "../../../hooks/analytics.ts";
import { useNavigateWorkspace } from "../../../hooks/useNavigateWorkspace.ts";
import { Breadcrumb, IntegrationPageLayout } from "./breadcrumb.tsx";
import { IntegrationIcon } from "./common.tsx";
import {
  ViewModeSwitcher,
  ViewModeSwitcherProps,
} from "../../common/ViewModeSwitcher.tsx";
import { IntegrationInfo } from "../../common/TableCells.tsx";
import { Table, TableColumn } from "../../common/Table.tsx";

// Marketplace Integration type that matches the structure from the API
interface MarketplaceIntegration extends Integration {
  provider: string;
}

// Connection Modal Component
interface ConnectIntegrationModalProps {
  open: boolean;
  integration: MarketplaceIntegration | null;
  createdIntegrationId: string | null;
  loading: boolean;
  onConnect: () => void;
  onEdit: () => void;
  onClose: () => void;
}
function ConnectIntegrationModal({
  open,
  integration,
  createdIntegrationId,
  loading,
  onConnect,
  onEdit,
  onClose,
}: ConnectIntegrationModalProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Connect to {integration?.name}
          </DialogTitle>
          <DialogDescription>
            <div className="mt-4">
              <div className="grid grid-cols-[80px_1fr] items-start gap-4">
                <IntegrationIcon
                  icon={integration?.icon}
                  name={integration?.name || ""}
                />
                <div>
                  <div className="text-sm text-muted-foreground">
                    {integration?.description}
                  </div>
                  {createdIntegrationId && (
                    <div className="font-bold mt-4">
                      The integration has been installed successfully. Click the
                      button below to configure it.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          {loading
            ? (
              <Button disabled={loading}>
                Connecting...
              </Button>
            )
            : createdIntegrationId
            ? (
              <div className="flex gap-3">
                <Button onClick={onEdit}>
                  Configure
                </Button>
              </div>
            )
            : (
              <Button onClick={onConnect}>
                Connect
              </Button>
            )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Available Integration Card Component
function AvailableIntegrationCard({
  integration,
  onClick,
}: { integration: MarketplaceIntegration; onClick: () => void }) {
  return (
    <Card
      className="group hover:shadow-md transition-shadow rounded-2xl cursor-pointer"
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="grid grid-cols-[min-content_1fr] gap-4">
          <IntegrationIcon
            icon={integration.icon}
            name={integration.name}
            className="h-16 w-16"
          />

          <div className="grid grid-cols-1 gap-1">
            <div className="text-base font-semibold truncate">
              {integration.name}
            </div>
            <div className="text-sm text-muted-foreground line-clamp-2">
              {integration.description}
            </div>
          </div>
        </div>

        <div className="mt-4">
          <span className="text-xs px-2 py-1 bg-secondary rounded-full">
            {integration.provider}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function CardsView(
  { integrations, onCardClick }: {
    integrations: MarketplaceIntegration[];
    onCardClick: (integration: MarketplaceIntegration) => void;
  },
) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
      {integrations.map((integration) => (
        <AvailableIntegrationCard
          key={integration.id}
          integration={integration}
          onClick={() => onCardClick(integration)}
        />
      ))}
    </div>
  );
}

function TableView({
  integrations,
  onRowClick,
}: {
  integrations: MarketplaceIntegration[];
  onRowClick: (integration: MarketplaceIntegration) => void;
}) {
  const [sortKey, setSortKey] = useState<string>("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  function getSortValue(row: MarketplaceIntegration, key: string): string {
    if (key === "provider") return row.provider?.toLowerCase() || "";
    if (key === "description") return row.description?.toLowerCase() || "";
    return row.name?.toLowerCase() || "";
  }
  const sortedIntegrations = [...integrations].sort((a, b) => {
    const aVal = getSortValue(a, sortKey);
    const bVal = getSortValue(b, sortKey);
    if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
    if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
    return 0;
  });

  const columns: TableColumn<MarketplaceIntegration>[] = [
    {
      id: "name",
      header: "Name",
      render: (integration) => <IntegrationInfo integration={integration} />,
      sortable: true,
    },
    {
      id: "description",
      header: "Description",
      accessor: (integration) => integration.description,
      sortable: true,
    },
    {
      id: "provider",
      header: "Provider",
      accessor: (integration) => integration.provider,
      sortable: true,
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
      data={sortedIntegrations}
      sortKey={sortKey}
      sortDirection={sortDirection}
      onSort={handleSort}
      onRowClick={onRowClick}
    />
  );
}

function MarketplaceTab() {
  const [registryFilter, setRegistryFilter] = useState("");
  const [viewMode, setViewMode] = useState<ViewModeSwitcherProps["viewMode"]>(
    "cards",
  );
  // Modal state for both views
  const [showModal, setShowModal] = useState(false);
  const [selectedIntegration, setSelectedIntegration] = useState<
    MarketplaceIntegration | null
  >(null);
  const [createdIntegrationId, setCreatedIntegrationId] = useState<
    string | null
  >(null);
  const { mutate: installIntegration, isPending: isInstalling } =
    useInstallFromMarketplace();
  const navigateWorkspace = useNavigateWorkspace();
  const updateThreadMessages = useUpdateThreadMessages();

  // Use the marketplace integrations hook instead of static registry
  const { data: marketplace } = useMarketplaceIntegrations();

  // Filter marketplace integrations by name, description, and provider
  const filteredRegistryIntegrations = useMemo(() => {
    const searchTerm = registryFilter.toLowerCase();
    return registryFilter
      ? marketplace.integrations.filter((integration: MarketplaceIntegration) =>
        integration.name.toLowerCase().includes(searchTerm) ||
        (integration.description?.toLowerCase() ?? "").includes(searchTerm) ||
        integration.provider.toLowerCase().includes(searchTerm)
      )
      : marketplace.integrations;
  }, [marketplace, registryFilter]);

  // Modal logic (shared)
  function handleInstall() {
    if (!selectedIntegration) return;
    installIntegration(selectedIntegration.id, {
      onSuccess: (data) => {
        if (typeof data.id !== "string") return;
        setCreatedIntegrationId(data.id);
      },
      onError: () => {
        setCreatedIntegrationId(null);
      },
    });
  }
  function handleEditIntegration() {
    if (!createdIntegrationId) return;
    updateThreadMessages(createdIntegrationId);
    navigateWorkspace(`/integration/${createdIntegrationId}`);
  }
  function handleCloseModal() {
    setShowModal(false);
    setSelectedIntegration(null);
    setCreatedIntegrationId(null);
  }

  return (
    <div className="flex flex-col gap-4 h-full py-4">
      <div className="px-4">
        <Breadcrumb
          value={registryFilter}
          setValue={(value) => setRegistryFilter(value)}
        />
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 px-4">
          {filteredRegistryIntegrations.map((
            integration: MarketplaceIntegration,
          ) => (
            <AvailableIntegrationCard
              key={integration.id}
              integration={integration}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

export default function Page() {
  return (
    <IntegrationPageLayout
      tabs={{
        marketplace: {
          title: "Marketplace",
          Component: MarketplaceTab,
          initialOpen: true,
        },
      }}
    />
  );
}
