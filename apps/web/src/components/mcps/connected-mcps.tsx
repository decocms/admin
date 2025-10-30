import { useIntegrations } from "@deco/sdk";
import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Input } from "@deco/ui/components/input.tsx";
import { Skeleton } from "@deco/ui/components/skeleton.tsx";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@deco/ui/components/table.tsx";
import { Suspense, useDeferredValue, useMemo, useState } from "react";
import { toast } from "sonner";
import { generateMockMetrics, MetricCell, StatusBadge, VendorBadge } from "./common.tsx";
import { ConnectMCPDialog } from "./connect-mcp-dialog.tsx";
import { IntegrationAvatar } from "../common/avatar/integration.tsx";

// Toggle between real data and mocks
const USE_REAL_DATA = true;

interface VendorFilterProps {
  selected: string[];
  onToggle: (vendor: string) => void;
}

function VendorFilter({ selected, onToggle }: VendorFilterProps) {
  const vendors = ["External", "@deco", "@vtex", "@anthropic", "@openai"];

  return (
    <div className="flex gap-2 flex-wrap" role="group" aria-label="Filter by vendor">
      {vendors.map((vendor) => (
        <Button
          key={vendor}
          variant={selected.includes(vendor) ? "default" : "outline"}
          size="sm"
          onClick={() => onToggle(vendor)}
          className="h-8"
          aria-pressed={selected.includes(vendor)}
          aria-label={`Filter by ${vendor}`}
        >
          {vendor}
        </Button>
      ))}
    </div>
  );
}

function ConnectedMCPsContent() {
  const { data: integrations } = useIntegrations();
  const [connectDialogOpen, setConnectDialogOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedVendors, setSelectedVendors] = useState<string[]>([]);
  const deferredSearch = useDeferredValue(search);

  const integrationsWithMetrics = useMemo(() => {
    if (!USE_REAL_DATA) {
      // Mock data
      return [
        {
          id: "1",
          name: "Slack",
          description: "Team communication",
          icon: "https://assets.decocache.com/mcp/slack.png",
          vendor: "@deco",
          status: "active" as const,
          connection: { type: "HTTP" as const, url: "https://api.slack.com" },
        },
        {
          id: "2",
          name: "Notion",
          description: "Knowledge base",
          icon: "https://assets.decocache.com/mcp/notion.png",
          vendor: "External",
          status: "active" as const,
          connection: { type: "HTTP" as const, url: "https://api.notion.com" },
        },
        {
          id: "3",
          name: "Google Sheets",
          description: "Spreadsheet management",
          icon: "https://assets.decocache.com/mcp/googlesheets.png",
          vendor: "@deco",
          status: "error" as const,
          connection: { type: "HTTP" as const, url: "https://sheets.googleapis.com" },
        },
        {
          id: "4",
          name: "Airtable",
          description: "Database platform",
          icon: "https://assets.decocache.com/mcp/airtable.png",
          vendor: "@deco",
          status: "active" as const,
          connection: { type: "HTTP" as const, url: "https://api.airtable.com" },
        },
      ].map((i) => ({
        ...i,
        metrics: generateMockMetrics(i.id),
      }));
    }

    // Use real integrations data
    return (integrations?.data || []).map((integration) => {
      // Determine vendor from connection type or appName
      let vendor = "External";
      if (integration.connection.type === "Deco" || integration.connection.type === "INNATE") {
        vendor = "@deco";
      } else if (integration.appName?.includes("@")) {
        vendor = integration.appName.split("/")[0];
      }

      // Determine status
      const status: "active" | "inactive" | "error" | "pending" = 
        integration.connection.type === "HTTP" ? "active" : "active";

      return {
        id: integration.id,
        name: integration.name,
        description: integration.description,
        icon: integration.icon,
        vendor,
        status,
        connection: integration.connection,
        metrics: generateMockMetrics(integration.id),
      };
    });
  }, [integrations]);

  const filteredIntegrations = useMemo(() => {
    let filtered = integrationsWithMetrics;

    // Apply vendor filter
    if (selectedVendors.length > 0) {
      filtered = filtered.filter((i) => selectedVendors.includes(i.vendor));
    }

    // Apply search filter
    if (deferredSearch) {
      const searchLower = deferredSearch.toLowerCase();
      filtered = filtered.filter(
        (i) =>
          i.name.toLowerCase().includes(searchLower) ||
          i.description?.toLowerCase().includes(searchLower)
      );
    }

    return filtered;
  }, [integrationsWithMetrics, selectedVendors, deferredSearch]);

  function handleVendorToggle(vendor: string) {
    setSelectedVendors((prev) =>
      prev.includes(vendor) ? prev.filter((v) => v !== vendor) : [...prev, vendor]
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium">
            Connected MCPs
            <span className="text-muted-foreground font-mono font-normal text-sm ml-2">
              {filteredIntegrations.length}
            </span>
          </h2>
          <p className="text-sm text-muted-foreground">
            External and managed MCP integrations
          </p>
        </div>
        <Button className="gap-2" onClick={() => setConnectDialogOpen(true)}>
          <Icon name="link" size={16} />
          Connect MCP
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-4 items-center flex-wrap">
        <div className="relative flex-1 min-w-[300px]">
          <Icon
            name="search"
            size={20}
            className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground pointer-events-none"
          />
          <Input
            placeholder="Search connections..."
            className="pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search connections"
          />
        </div>
        <VendorFilter selected={selectedVendors} onToggle={handleVendorToggle} />
      </div>

      {/* Integrations table */}
      {filteredIntegrations.length > 0 ? (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>MCP Name</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right"># Calls</TableHead>
                <TableHead className="text-right"># Errors</TableHead>
                <TableHead className="text-right">Avg Latency</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredIntegrations.map((integration) => (
                <TableRow
                  key={integration.id}
                  className="cursor-pointer"
                  onClick={() => {
                    toast.info(`Navigate to ${integration.name} detail (future)`);
                  }}
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <IntegrationAvatar
                        url={integration.icon}
                        fallback={integration.name}
                        size="sm"
                      />
                      <div className="flex flex-col">
                        <span className="font-medium">{integration.name}</span>
                        {integration.description && (
                          <span className="text-xs text-muted-foreground">
                            {integration.description}
                          </span>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <VendorBadge vendor={integration.vendor} />
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={integration.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    <MetricCell value={integration.metrics.calls.toLocaleString()} />
                  </TableCell>
                  <TableCell className="text-right">
                    <MetricCell
                      value={integration.metrics.errors}
                      className={integration.metrics.errors > 10 ? "text-red-600" : ""}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <MetricCell value={integration.metrics.latency} suffix="ms" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed p-12 flex flex-col items-center justify-center gap-3 text-center">
          <Icon name="link_off" size={48} className="text-muted-foreground" />
          <div>
            <h3 className="font-medium mb-1">
              {search || selectedVendors.length > 0
                ? "No connections match your filters"
                : "No connections yet"}
            </h3>
            <p className="text-sm text-muted-foreground">
              {search || selectedVendors.length > 0
                ? "Try adjusting your search or filters"
                : "Connect an external MCP server to get started"}
            </p>
          </div>
          {!search && selectedVendors.length === 0 && (
            <Button onClick={() => setConnectDialogOpen(true)}>
              <Icon name="link" size={16} className="mr-2" />
              Connect MCP
            </Button>
          )}
        </div>
      )}

      <ConnectMCPDialog open={connectDialogOpen} onOpenChange={setConnectDialogOpen} />
    </div>
  );
}

export function ConnectedMCPsSection() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col gap-4">
          <Skeleton className="h-8 w-48" />
          <div className="flex gap-4">
            <Skeleton className="h-10 flex-1" />
            <Skeleton className="h-10 w-32" />
          </div>
          <Skeleton className="h-64" />
        </div>
      }
    >
      <ConnectedMCPsContent />
    </Suspense>
  );
}

