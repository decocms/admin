import { ConnectionEntitySchema } from "@/tools/connection/schema";
import {
  useConnections,
  type ConnectionEntity,
} from "@/web/hooks/use-connections";
import { useListState } from "@/web/hooks/use-list-state";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@deco/ui/components/dialog.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@deco/ui/components/dropdown-menu.tsx";
import { EmptyState } from "@deco/ui/components/empty-state.tsx";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@deco/ui/components/form.tsx";
import { Input } from "@deco/ui/components/input.tsx";
import { ResourceHeader } from "@deco/ui/components/resource-header.tsx";
import {
  Table as ResourceTable,
  type TableColumn,
} from "@deco/ui/components/resource-table.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@deco/ui/components/select.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { Textarea } from "@deco/ui/components/textarea.tsx";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "@tanstack/react-router";
import { MoreVertical, Plus, Search } from "lucide-react";
import { useEffect, useReducer } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod/v3";
import { useConnectionsCollection } from "../../hooks/use-connections";

// Form validation schema derived from ConnectionEntitySchema
// Pick the relevant fields and adapt for form use
const connectionFormSchema = ConnectionEntitySchema.pick({
  title: true,
  description: true,
  connectionType: true,
  connectionUrl: true,
  connectionToken: true,
}).partial({
  // These are optional for form input
  description: true,
  connectionToken: true,
});

type ConnectionFormData = z.infer<typeof connectionFormSchema>;

type DialogState =
  | { mode: "idle" }
  | { mode: "creating" }
  | { mode: "editing"; connection: ConnectionEntity }
  | { mode: "deleting"; connection: ConnectionEntity };

type DialogAction =
  | { type: "create" }
  | { type: "edit"; connection: ConnectionEntity }
  | { type: "delete"; connection: ConnectionEntity }
  | { type: "close" };

function dialogReducer(_state: DialogState, action: DialogAction): DialogState {
  switch (action.type) {
    case "create":
      return { mode: "creating" };
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

  // Consolidated list UI state (search, filters, sorting, view mode)
  const listState = useListState<ConnectionEntity>({
    namespace: org,
    resource: "connections",
  });

  // Fetch connections with filtering and sorting applied
  const collection = useConnectionsCollection();
  const { data: connections, isLoading, isError } = useConnections(listState);

  const [dialogState, dispatch] = useReducer(dialogReducer, { mode: "idle" });

  // React Hook Form setup
  const form = useForm<ConnectionFormData>({
    resolver: zodResolver(connectionFormSchema),
    defaultValues: {
      title: "",
      description: null,
      connectionType: "HTTP",
      connectionUrl: "",
      connectionToken: null,
    },
  });

  // Reset form when editing connection changes
  const editingConnection =
    dialogState.mode === "editing" ? dialogState.connection : null;

  useEffect(() => {
    if (editingConnection) {
      form.reset({
        title: editingConnection.title,
        description: editingConnection.description,
        connectionType: editingConnection.connectionType,
        connectionUrl: editingConnection.connectionUrl,
        connectionToken: null, // Don't pre-fill token for security
      });
    } else {
      form.reset({
        title: "",
        description: null,
        connectionType: "HTTP",
        connectionUrl: "",
        connectionToken: null,
      });
    }
  }, [editingConnection, form]);

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

  const onSubmit = async (data: ConnectionFormData) => {
    try {
      dispatch({ type: "close" });
      form.reset();

      if (editingConnection) {
        // Update existing connection
        const tx = collection.update(editingConnection.id, (draft) => {
          draft.title = data.title;
          draft.description = data.description || null;
          draft.connectionType = data.connectionType;
          draft.connectionUrl = data.connectionUrl;
          if (data.connectionToken) {
            draft.connectionToken = data.connectionToken;
          }
        });
        await tx.isPersisted.promise;
      } else {
        // Create new connection - cast through unknown because the insert API
        // accepts ConnectionCreateInput but the collection is typed as ConnectionEntity
        const tx = collection.insert({
          id: crypto.randomUUID(),
          title: data.title,
          description: data.description || null,
          connectionType: data.connectionType,
          connectionUrl: data.connectionUrl,
          connectionToken: data.connectionToken || undefined,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          status: "inactive",
          organizationId: org,
        });
        await tx.isPersisted.promise;
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save connection",
      );
    }
  };

  const handleDialogClose = (open: boolean) => {
    if (!open) {
      dispatch({ type: "close" });
      form.reset();
    }
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
    <Button
      onClick={() => dispatch({ type: "create" })}
      size="sm"
      className="rounded-xl"
    >
      <Plus className="mr-2 h-4 w-4" />
      New Connection
    </Button>
  );

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <Dialog
        open={dialogState.mode === "creating" || dialogState.mode === "editing"}
        onOpenChange={handleDialogClose}
      >
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
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
              <div className="grid gap-4 py-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="My Connection" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="A brief description of this connection"
                          rows={3}
                          {...field}
                          value={field.value ?? ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="connectionType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Type *</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="HTTP">HTTP</SelectItem>
                          <SelectItem value="SSE">SSE</SelectItem>
                          <SelectItem value="Websocket">Websocket</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="connectionUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>URL *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="https://example.com/mcp"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="connectionToken"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Token (optional)</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="Bearer token or API key"
                          {...field}
                          value={field.value ?? ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleDialogClose(false)}
                >
                  Cancel
                </Button>
                <Button type="submit">
                  {editingConnection
                    ? "Update Connection"
                    : "Create Connection"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

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
              onRefresh={() =>
                (collection.utils as { refetch?: () => void }).refetch?.()
              }
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
            ) : isLoading ? (
              <div className="flex justify-center items-center py-12">
                <Spinner />
              </div>
            ) : connections.length === 0 ? (
              <EmptyState
                icon="cable"
                title="No connections found"
                description="Create a connection to get started."
                buttonProps={{
                  onClick: () => dispatch({ type: "create" }),
                  children: "New Connection",
                }}
              />
            ) : listState.viewMode === "cards" ? (
              <div
                className="grid gap-4"
                style={{
                  gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
                }}
              >
                {connections.map((connection) => (
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
                ))}
              </div>
            ) : (
              <ResourceTable
                columns={columns}
                data={connections}
                sortKey={listState.sortKey}
                sortDirection={listState.sortDirection}
                onSort={listState.handleSort}
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
