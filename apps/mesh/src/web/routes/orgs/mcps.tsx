import { useDeferredValue, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { fetcher } from "@/tools/client";
import { Card } from "@deco/ui/components/card.tsx";
import { Badge } from "@deco/ui/components/badge.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import { Plus, MoreVertical, Search } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@deco/ui/components/dropdown-menu.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@deco/ui/components/dialog.tsx";
import { Input } from "@deco/ui/components/input.tsx";
import { Label } from "@deco/ui/components/label.tsx";
import { Textarea } from "@deco/ui/components/textarea.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@deco/ui/components/select.tsx";
import { EmptyState } from "@deco/ui/components/empty-state.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import {
  Table as ResourceTable,
  type TableColumn,
} from "@deco/ui/components/resource-table.tsx";
import { ResourceHeader } from "@deco/ui/components/resource-header.tsx";
import { useViewMode } from "@deco/ui/hooks/use-view-mode.ts";
import { usePersistedFilters } from "@deco/ui/hooks/use-persisted-filters.ts";
import { useSortable } from "@deco/ui/hooks/use-sortable.ts";
import { KEYS } from "@/web/lib/query-keys";
import type { MCPConnection } from "@/storage/types";
import { useProjectContext } from "@/web/providers/project-context-provider";

const useConnections = () => {
  const { locator } = useProjectContext();
  return useQuery({
    queryKey: KEYS.connections(locator),
    queryFn: () => fetcher.CONNECTION_LIST({}),
  });
};

function getStatusBadgeVariant(status: string) {
  switch (status) {
    case "active":
      return "default";
    case "inactive":
      return "secondary";
    case "error":
      return "destructive";
    default:
      return "outline";
  }
}

export default function OrgMcps() {
  const { locator, org } = useProjectContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data, isLoading, isError, error } = useConnections();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingConnection, setEditingConnection] = useState<
    (typeof connections)[number] | null
  >(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    type: "HTTP" as "HTTP" | "SSE" | "Websocket",
    url: "",
    token: "",
  });

  const connections = (data?.connections ?? []) as MCPConnection[];
  const [localSearch, setLocalSearch] = useState("");
  const deferredSearch = useDeferredValue(localSearch);
  const filterPersistKey = `${org}-mcp-connections`;
  const [filters, setFilters] = usePersistedFilters(filterPersistKey);
  const filterBarVisibilityKey = `mesh-connections-filter-visible-${org}`;
  const [filterBarVisible, setFilterBarVisible] = useState(() => {
    const stored = globalThis.localStorage?.getItem(filterBarVisibilityKey);
    return stored === "true";
  });
  const [viewMode, setViewMode] = useViewMode(
    `mesh-connections-${org}`,
    "table",
  );
  const { sortKey, sortDirection, handleSort } = useSortable("title");
  const errorMessage = isError
    ? error instanceof Error
      ? error.message
      : "Failed to load connections."
    : null;

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      type: "HTTP",
      url: "",
      token: "",
    });
    setEditingConnection(null);
  };

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return fetcher.CONNECTION_CREATE({
        name: data.name,
        description: data.description || undefined,
        connection: {
          type: data.type,
          url: data.url,
          token: data.token || undefined,
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KEYS.connections(locator) });
      setIsDialogOpen(false);
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      return fetcher.CONNECTION_UPDATE({
        id,
        name: data.name,
        description: data.description || undefined,
        connection: {
          type: data.type,
          url: data.url,
          token: data.token || undefined,
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KEYS.connections(locator) });
      setIsDialogOpen(false);
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return fetcher.CONNECTION_DELETE({ id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KEYS.connections(locator) });
    },
  });

  const handleEdit = (connection: MCPConnection) => {
    setEditingConnection(connection);
    setFormData({
      name: connection.name,
      description: connection.description || "",
      type: connection.connectionType,
      url: connection.connectionUrl,
      token: "",
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this connection?")) {
      deleteMutation.mutate(id);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingConnection) {
      updateMutation.mutate({ id: editingConnection.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDialogClose = (open: boolean) => {
    setIsDialogOpen(open);
    if (!open) {
      resetForm();
    }
  };

  const filteredConnections = useMemo(() => {
    let result = connections;
    const searchTerm = deferredSearch.trim().toLowerCase();
    if (searchTerm) {
      result = result.filter((connection) => {
        const name = connection.name?.toLowerCase() ?? "";
        const description = connection.description?.toLowerCase() ?? "";
        return name.includes(searchTerm) || description.includes(searchTerm);
      });
    }

    if (filters.length === 0) {
      return result;
    }

    return result.filter((connection) => {
      return filters.every((filter) => {
        if (filter.column === "name") {
          const value = connection.name?.toLowerCase() ?? "";
          const filterValue = filter.value.toLowerCase();
          switch (filter.operator) {
            case "contains":
              return value.includes(filterValue);
            case "does_not_contain":
              return !value.includes(filterValue);
            case "is":
              return value === filterValue;
            case "is_not":
              return value !== filterValue;
            default:
              return true;
          }
        }

        if (filter.column === "description") {
          const value = connection.description?.toLowerCase() ?? "";
          const filterValue = filter.value.toLowerCase();
          switch (filter.operator) {
            case "contains":
              return value.includes(filterValue);
            case "does_not_contain":
              return !value.includes(filterValue);
            case "is":
              return value === filterValue;
            case "is_not":
              return value !== filterValue;
            default:
              return true;
          }
        }

        return true;
      });
    });
  }, [connections, deferredSearch, filters]);

  const sortedConnections = useMemo(() => {
    if (!sortKey || !sortDirection) {
      return filteredConnections;
    }

    const compareStrings = (a: string, b: string) => {
      if (a < b) return sortDirection === "asc" ? -1 : 1;
      if (a > b) return sortDirection === "asc" ? 1 : -1;
      return 0;
    };

    return [...filteredConnections].sort((a, b) => {
      switch (sortKey) {
        case "title":
          return compareStrings(
            (a.name ?? "").toLowerCase(),
            (b.name ?? "").toLowerCase(),
          );
        case "description":
          return compareStrings(
            (a.description ?? "").toLowerCase(),
            (b.description ?? "").toLowerCase(),
          );
        case "status":
          return compareStrings(
            (a.status ?? "").toLowerCase(),
            (b.status ?? "").toLowerCase(),
          );
        case "connectionType":
          return compareStrings(
            (a.connectionType ?? "").toLowerCase(),
            (b.connectionType ?? "").toLowerCase(),
          );
        default:
          return 0;
      }
    });
  }, [filteredConnections, sortKey, sortDirection]);

  const columns: TableColumn<MCPConnection>[] = [
    {
      id: "title",
      header: "Name",
      render: (connection) => (
        <div>
          <div className="font-medium">{connection.name}</div>
          {connection.description && (
            <div className="text-sm text-muted-foreground">
              {connection.description}
            </div>
          )}
        </div>
      ),
      cellClassName: "max-w-md",
      sortable: true,
    },
    {
      id: "connectionType",
      header: "Type",
      accessor: (connection) => (
        <span className="text-sm font-medium">{connection.connectionType}</span>
      ),
      cellClassName: "w-[120px]",
      sortable: true,
    },
    {
      id: "connectionUrl",
      header: "URL",
      render: (connection) => (
        <span className="text-sm text-muted-foreground block truncate max-w-sm">
          {connection.connectionUrl}
        </span>
      ),
      wrap: true,
      cellClassName: "max-w-sm",
    },
    {
      id: "status",
      header: "Status",
      render: (connection) => (
        <Badge variant={getStatusBadgeVariant(connection.status)}>
          {connection.status}
        </Badge>
      ),
      cellClassName: "w-[120px]",
      sortable: true,
    },
    {
      id: "actions",
      header: "",
      render: (connection) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={(event) => event.stopPropagation()}
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={(event) => {
                event.stopPropagation();
                navigate({
                  to: `/${org}/mcps/${connection.id}/inspector`,
                });
              }}
            >
              <Search className="mr-2 h-4 w-4" />
              Inspect
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={(event) => {
                event.stopPropagation();
                handleEdit(connection);
              }}
            >
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive"
              onClick={(event) => {
                event.stopPropagation();
                handleDelete(connection.id);
              }}
            >
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
      cellClassName: "w-[80px]",
    },
  ];

  const ctaButton = (
    <Button
      onClick={() => setIsDialogOpen(true)}
      size="sm"
      className="rounded-xl"
    >
      <Plus className="mr-2 h-4 w-4" />
      New Connection
    </Button>
  );

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <Dialog open={isDialogOpen} onOpenChange={handleDialogClose}>
        <DialogContent className="sm:max-w-[525px]">
          <DialogHeader>
            <DialogTitle>
              {editingConnection ? "Edit Connection" : "Create New Connection"}
            </DialogTitle>
            <DialogDescription>
              {editingConnection
                ? "Update the connection details below."
                : "Add a new connection to your organization. Fill in the details below."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  required
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="My Connection"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="A brief description of this connection"
                  rows={3}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="type">Type *</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value) =>
                    setFormData({
                      ...formData,
                      type: value as "HTTP" | "SSE" | "Websocket",
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="HTTP">HTTP</SelectItem>
                    <SelectItem value="SSE">SSE</SelectItem>
                    <SelectItem value="Websocket">Websocket</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="url">URL *</Label>
                <Input
                  id="url"
                  type="url"
                  required
                  value={formData.url}
                  onChange={(e) =>
                    setFormData({ ...formData, url: e.target.value })
                  }
                  placeholder="https://example.com/mcp"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="token">Token (optional)</Label>
                <Input
                  id="token"
                  type="password"
                  value={formData.token}
                  onChange={(e) =>
                    setFormData({ ...formData, token: e.target.value })
                  }
                  placeholder="Bearer token or API key"
                />
              </div>

              {(createMutation.isError || updateMutation.isError) && (
                <div className="text-sm text-destructive">
                  Error:{" "}
                  {createMutation.error?.message ||
                    updateMutation.error?.message ||
                    `Failed to ${editingConnection ? "update" : "create"} connection`}
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleDialogClose(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {createMutation.isPending || updateMutation.isPending
                  ? editingConnection
                    ? "Updating..."
                    : "Creating..."
                  : editingConnection
                    ? "Update Connection"
                    : "Create Connection"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <div className="shrink-0 bg-background">
        <div className="px-8 py-6">
          <div className="max-w-6xl mx-auto space-y-6">
            <div className="space-y-1">
              <h1 className="text-3xl font-bold tracking-tight">Connections</h1>
              <p className="text-muted-foreground">
                Manage your organization connections
              </p>
            </div>
            <ResourceHeader
              tabs={[{ id: "all", label: "All" }]}
              activeTab="all"
              searchValue={localSearch}
              onSearchChange={setLocalSearch}
              onSearchKeyDown={(event) => {
                if (event.key === "Escape") {
                  setLocalSearch("");
                  (event.target as HTMLInputElement).blur();
                }
              }}
              onRefresh={() =>
                queryClient.invalidateQueries({
                  queryKey: KEYS.connections(locator),
                })
              }
              onFilterClick={() => {
                const newValue = !filterBarVisible;
                setFilterBarVisible(newValue);
                globalThis.localStorage?.setItem(
                  filterBarVisibilityKey,
                  String(newValue),
                );
              }}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              sortKey={sortKey}
              sortDirection={sortDirection}
              onSort={handleSort}
              filterBarVisible={filterBarVisible}
              filters={filters}
              onFiltersChange={setFilters}
              availableUsers={[]}
              ctaButton={ctaButton}
            />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="px-8 py-2">
          <div className="max-w-6xl mx-auto space-y-6">
            {errorMessage ? (
              <Card className="border-destructive/30 bg-destructive/10">
                <div className="p-4 text-sm text-destructive">
                  {errorMessage}
                </div>
              </Card>
            ) : isLoading ? (
              <div className="flex justify-center items-center py-12">
                <Spinner />
              </div>
            ) : sortedConnections.length === 0 ? (
              <EmptyState
                icon="cable"
                title="No connections found"
                description="Create a connection to get started."
                buttonProps={{
                  onClick: () => setIsDialogOpen(true),
                  children: "New Connection",
                }}
              />
            ) : viewMode === "cards" ? (
              <div
                className="grid gap-4"
                style={{
                  gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
                }}
              >
                {sortedConnections.map((connection) => (
                  <Card
                    key={connection.id}
                    className="p-4 rounded-xl border-border transition-colors hover:border-primary cursor-pointer"
                    onClick={() =>
                      navigate({
                        to: `/${org}/mcps/${connection.id}/inspector`,
                      })
                    }
                  >
                    <div className="flex flex-col gap-3 h-full">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-foreground">
                            {connection.name}
                          </div>
                          {connection.description && (
                            <div className="text-xs text-muted-foreground mt-1">
                              {connection.description}
                            </div>
                          )}
                        </div>
                        <Badge
                          variant={getStatusBadgeVariant(connection.status)}
                        >
                          {connection.status}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground break-words">
                        {connection.connectionUrl}
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium uppercase text-muted-foreground">
                          {connection.connectionType}
                        </span>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(event) => {
                              event.stopPropagation();
                              navigate({
                                to: `/${org}/mcps/${connection.id}/inspector`,
                              });
                            }}
                          >
                            Inspect
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={(event) => event.stopPropagation()}
                              >
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={(event) => {
                                  event.stopPropagation();
                                  handleEdit(connection);
                                }}
                              >
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={(event) => event.stopPropagation()}
                              >
                                Test Connection
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  handleDelete(connection.id);
                                }}
                              >
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <ResourceTable
                columns={columns}
                data={sortedConnections}
                sortKey={sortKey}
                sortDirection={sortDirection}
                onSort={handleSort}
                onRowClick={(connection) =>
                  navigate({
                    to: `/${org}/mcps/${connection.id}/inspector`,
                  })
                }
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
