import type { ConnectionEntity } from "@/tools/connection/schema";
import { CollectionsList } from "@/web/components/collections/collections-list.tsx";
import {
  ConnectMCPModal,
  type EditingConnection,
} from "@/web/components/connect-mcp-modal";
import {
  useConnections,
  useConnectionsCollection,
} from "@/web/hooks/collections/use-connection";
import { useListState } from "@/web/hooks/use-list-state";
import { authClient } from "@/web/lib/auth-client";
import { useProjectContext } from "@/web/providers/project-context-provider";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@deco/ui/components/alert-dialog.tsx";
import { Badge } from "@deco/ui/components/badge.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import { Card } from "@deco/ui/components/card.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@deco/ui/components/dropdown-menu.tsx";
import { EmptyState } from "@deco/ui/components/empty-state.tsx";
import { ResourceHeader } from "@deco/ui/components/resource-header.tsx";
import { type TableColumn } from "@deco/ui/components/resource-table.tsx";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { MoreVertical, Plus, Search } from "lucide-react";
import { useReducer } from "react";
import { toast } from "sonner";

type DialogState =
  | { mode: "idle" }
  | { mode: "editing"; connection: ConnectionEntity }
  | { mode: "deleting"; connection: ConnectionEntity };

export type DialogAction =
  | { type: "edit"; connection: ConnectionEntity }
  | { type: "delete"; connection: ConnectionEntity }
  | { type: "close" };

function dialogReducer(_state: DialogState, action: DialogAction): DialogState {
  switch (action.type) {
    case "edit":
      return { mode: "editing", connection: action.connection };
    case "delete":
      return { mode: "deleting", connection: action.connection };
    case "close":
      return { mode: "idle" };
  }
}

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
  const { org } = useProjectContext();
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as {
    action?: "create" | "select";
  };
  const { data: session } = authClient.useSession();

  // Consolidated list UI state (search, filters, sorting, view mode)
  const listState = useListState<ConnectionEntity>({
    namespace: org,
    resource: "connections",
  });

  // Fetch connections with filtering and sorting applied
  const collection = useConnectionsCollection();
  const { data: connections, isLoading, isError } = useConnections(listState);

  const [dialogState, dispatch] = useReducer(dialogReducer, { mode: "idle" });

  // Create dialog state is derived from search params
  const isCreating = search.action === "create";

  const openCreateDialog = () => {
    navigate({
      to: "/$org/mcps",
      params: { org },
      search: { action: "create" },
    });
  };

  const closeDialog = () => {
    navigate({ to: "/$org/mcps", params: { org }, search: {} });
  };

  const handleConnectMCPOpenChange = (open: boolean) => {
    if (!open) {
      if (isCreating) {
        closeDialog();
      } else {
        dispatch({ type: "close" });
      }
    }
  };

  // Reset form when editing connection changes
  const editingConnection: EditingConnection =
    dialogState.mode === "editing" ? dialogState.connection : null;

  const errorMessage = isError ? "Failed to load connections." : null;

  const handleEdit = (connection: ConnectionEntity) => {
    dispatch({ type: "edit", connection });
  };

  const handleDelete = (connection: ConnectionEntity) => {
    dispatch({ type: "delete", connection });
  };

  const confirmDelete = () => {
    if (dialogState.mode !== "deleting") return;

    const id = dialogState.connection.id;
    dispatch({ type: "close" });

    collection.delete(id).isPersisted.promise.catch((error) => {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete connection",
      );
    });
  };

  const columns: TableColumn<ConnectionEntity>[] = [
    {
      id: "title",
      header: "Name",
      render: (connection) => (
        <div>
          <div className="font-medium">{connection.title}</div>
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
      id: "connection_type",
      header: "Type",
      accessor: (connection) => (
        <span className="text-sm font-medium">
          {connection.connection_type}
        </span>
      ),
      cellClassName: "w-[120px]",
      sortable: true,
    },
    {
      id: "connection_url",
      header: "URL",
      render: (connection) => (
        <span className="text-sm text-muted-foreground block truncate max-w-sm">
          {connection.connection_url}
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
                  to: "/$org/mcps/$connectionId",
                  params: { org, connectionId: connection.id },
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
                handleDelete(connection);
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
    <Button onClick={openCreateDialog} size="sm" className="rounded-xl">
      <Plus className="mr-2 h-4 w-4" />
      New Connection
    </Button>
  );

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <ConnectMCPModal
        open={isCreating || dialogState.mode === "editing"}
        onOpenChange={handleConnectMCPOpenChange}
        editingConnection={editingConnection}
        org={org}
        collection={collection}
        session={session}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={dialogState.mode === "deleting"}
        onOpenChange={(open) => !open && dispatch({ type: "close" })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Connection?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete{" "}
              <span className="font-medium text-foreground">
                {dialogState.mode === "deleting" &&
                  dialogState.connection.title}
              </span>
              .
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
              searchValue={listState.search}
              onSearchChange={listState.setSearch}
              onSearchKeyDown={(event) => {
                if (event.key === "Escape") {
                  listState.setSearch("");
                  (event.target as HTMLInputElement).blur();
                }
              }}
              onFilterClick={listState.toggleFilterBar}
              viewMode={listState.viewMode}
              onViewModeChange={listState.setViewMode}
              sortKey={listState.sortKey}
              sortDirection={listState.sortDirection}
              onSort={listState.handleSort}
              filterBarVisible={listState.filterBarVisible}
              filters={listState.filters}
              onFiltersChange={listState.setFilters}
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
            ) : (
              <CollectionsList
                data={connections}
                viewMode={listState.viewMode}
                onViewModeChange={listState.setViewMode}
                search={listState.search}
                onSearchChange={listState.setSearch}
                columns={columns}
                isLoading={isLoading}
                sortKey={listState.sortKey}
                sortDirection={listState.sortDirection}
                onSort={listState.handleSort}
                onItemClick={(connection) =>
                  navigate({
                    to: "/$org/mcps/$connectionId",
                    params: { org, connectionId: connection.id },
                  })
                }
                emptyState={
                  <EmptyState
                    icon="cable"
                    title="No connections found"
                    description="Create a connection to get started."
                    buttonProps={{
                      onClick: openCreateDialog,
                      children: "New Connection",
                    }}
                  />
                }
                renderCard={(connection) => (
                  <Card className="p-4 rounded-xl border-border transition-colors hover:border-primary cursor-pointer h-full">
                    <div className="flex flex-col gap-3 h-full">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-foreground">
                            {connection.title}
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
                      <div className="text-xs text-muted-foreground wrap-break-word">
                        {connection.connection_url}
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-auto">
                        <span className="text-xs font-medium uppercase text-muted-foreground">
                          {connection.connection_type}
                        </span>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(event) => {
                              event.stopPropagation();
                              navigate({
                                to: "/$org/mcps/$connectionId",
                                params: { org, connectionId: connection.id },
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
                                  handleDelete(connection);
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
                )}
                hideToolbar={true}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
