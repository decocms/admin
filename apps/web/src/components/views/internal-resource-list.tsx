import { callTool, useIntegration } from "@deco/sdk";
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
import { Button } from "@deco/ui/components/button.tsx";
import { Card, CardContent } from "@deco/ui/components/card.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@deco/ui/components/dropdown-menu.tsx";
import { EmptyState } from "@deco/ui/components/empty-state.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import {
  Table,
  type TableColumn,
} from "@deco/ui/components/resource-table.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@deco/ui/components/tooltip.tsx";
import { useViewMode } from "@deco/ui/hooks/use-view-mode.ts";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { ListPageHeader } from "../common/list-page-header.tsx";
import { useThread } from "../decopilot/thread-provider.tsx";
import { ResourceCreateDialog } from "./resource-create-dialog.tsx";

export function InternalResourceListWithIntegration({
  name,
  integrationId,
}: {
  name: string;
  integrationId: string;
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const integration = useIntegration(integrationId).data;

  // Canvas tabs management
  const { createTab } = useThread();

  const [caps, setCaps] = useState({
    hasCreate: false,
    hasDelete: false,
  });
  const q = searchParams.get("q") ?? "";
  const [items, setItems] = useState<
    Array<{
      name: string;
      uri: string;
      title?: string;
      description?: string;
      mimeType?: string;
      thumbnail?: string;
    }>
  >([]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useViewMode();
  const [deleteTarget, setDeleteTarget] = useState<{ uri: string } | null>(
    null,
  );
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  async function runSearch(term: string) {
    setLoading(true);
    try {
      const result = (await callTool(integration?.connection, {
        name: "DECO_CHAT_RESOURCES_SEARCH",
        arguments: { name, term, limit: 50 },
      })) as {
        structuredContent?: {
          items?: Array<{
            name?: string;
            uri: string;
            title?: string;
            description?: string;
            mimeType?: string;
            thumbnail?: string;
          }>;
        };
      };
      const itemsRaw = result.structuredContent?.items ?? [];
      const mapped = itemsRaw.map((r) => ({
        name: r?.name ?? name,
        uri: r.uri,
        title: r?.title,
        description: r?.description,
        mimeType: r?.mimeType,
        thumbnail: r?.thumbnail,
      }));
      setItems(mapped);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    runSearch(q);
  }, [q]);

  useEffect(() => {
    (async () => {
      try {
        const result = (await callTool(integration?.connection, {
          name: "DECO_CHAT_RESOURCES_LIST",
          arguments: {},
        })) as {
          structuredContent?: {
            resources?: Array<{
              name: string;
              hasCreate?: boolean;
              hasDelete?: boolean;
            }>;
          };
        };
        const resources = result.structuredContent?.resources ?? [];
        const res = resources.find((r) => r?.name === name);
        setCaps({
          hasCreate: Boolean(res?.hasCreate),
          hasDelete: Boolean(res?.hasDelete),
        });
      } catch {
        // ignore; default capabilities remain false
      }
    })();
  }, [integration?.connection, name]);

  async function openItem(it: { uri: string; name?: string }) {
    // Open detail view in a new tab
    const newTab = createTab({
      type: "detail" as const,
      resourceUri: it.uri,
      title: it.name || name,
      icon: integration?.icon,
    });
    if (!newTab) {
      console.warn(
        "[InternalResourceList] No active tab found - this should not happen",
      );
    }
  }

  function openCreateDialog() {
    if (!caps.hasCreate) return;
    setCreateError(null); // Clear any previous errors
    setIsCreateDialogOpen(true);
  }

  async function handleCreateResource(data: {
    resourceName: string;
    title?: string;
    description?: string;
    content: { data: string; type: "text" };
  }) {
    setIsCreating(true);
    setCreateError(null);
    try {
      const response = await callTool(integration?.connection, {
        name: "DECO_CHAT_RESOURCES_CREATE",
        arguments: {
          name,
          resourceName: data.resourceName,
          title: data.title,
          description: data.description,
          content: data.content,
        },
      });

      if (response.isError) {
        // Extract error message from response.content[0].text
        const content = response.content as Record<string, unknown>;
        const errorMessage =
          (content as unknown as Array<{ text?: string }>)?.[0]?.text ||
          "Failed to create resource";
        setCreateError(errorMessage);
        return; // Don't close dialog or refresh on error
      }

      // Success - close dialog and refresh
      setIsCreateDialogOpen(false);
      await runSearch(q);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "An unexpected error occurred";
      setCreateError(errorMessage);
    } finally {
      setIsCreating(false);
    }
  }

  function deleteItem(row: { uri: string }) {
    if (!caps.hasDelete) return;
    setDeleteTarget({ uri: row.uri });
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await callTool(integration?.connection, {
        name: "DECO_CHAT_RESOURCES_DELETE",
        arguments: { name, uri: deleteTarget.uri },
      });
      await runSearch(q);
      setDeleteTarget(null);
    } finally {
      setIsDeleting(false);
    }
  }

  function generateResourceNameFromUri(uri: string, title?: string) {
    const source =
      title ||
      (() => {
        try {
          const u = new URL(uri);
          const last = u.pathname.split("/").filter(Boolean).pop();
          return last || uri;
        } catch {
          return uri;
        }
      })();
    const base = source
      .replace(/\s+/g, "-")
      .replace(/[^a-zA-Z0-9-_]/g, "-")
      .toLowerCase();
    return `${base}-copy-${crypto.randomUUID().slice(0, 8)}`;
  }

  async function duplicateItem(it: {
    uri: string;
    title?: string;
    description?: string;
  }) {
    if (!caps.hasCreate) return;
    setIsDuplicating(true);
    try {
      const read = (await callTool(integration?.connection, {
        name: "DECO_CHAT_RESOURCES_READ",
        arguments: { name, uri: it.uri },
      })) as {
        structuredContent?: {
          data?: string;
          type?: "text" | "blob";
          mimeType?: string;
        };
      };
      const sc = read.structuredContent ?? {};
      await callTool(integration?.connection, {
        name: "DECO_CHAT_RESOURCES_CREATE",
        arguments: {
          name,
          resourceName: generateResourceNameFromUri(it.uri, it.title),
          title: `${it.title ?? it.uri} (Copy)`,
          description: it.description,
          content: {
            data: sc.data ?? "",
            type: (sc.type as "text" | "blob" | undefined) ?? "text",
            mimeType: sc.mimeType,
          },
        },
      });
      await runSearch(q);
    } finally {
      setIsDuplicating(false);
    }
  }

  function truncateUri(uri: string, max = 50) {
    if (!uri) return uri;
    return uri.length > max ? `${uri.slice(0, max)}…` : uri;
  }

  const header = (
    <ListPageHeader
      input={{
        placeholder: `Search ${name}...`,
        value: q,
        onChange: (e) =>
          setSearchParams({ q: (e.target as HTMLInputElement).value }),
        onKeyDown: (e) => {
          if (e.key === "Enter") {
            runSearch((e.target as HTMLInputElement).value);
          }
        },
      }}
      view={{ viewMode, onChange: setViewMode }}
      controlsAlign="start"
      actionsRight={
        <div className="pl-3 ml-2 border-l border-border flex items-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={() => runSearch(q)}
                  variant="outline"
                  size="icon"
                  disabled={loading}
                >
                  <Icon name="refresh" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Refresh</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          {caps.hasCreate && (
            <Button onClick={openCreateDialog} variant="default">
              <Icon name="add" />
              Create
            </Button>
          )}
        </div>
      }
    />
  );

  if (loading) {
    return (
      <div className="p-4 space-y-3 h-full">
        {header}
        <div className="flex justify-center items-center h-full py-8">
          <Spinner />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3 h-full">
      {header}
      {items.length === 0 ? (
        <EmptyState
          icon="search_off"
          title={`No ${name} found`}
          description={
            q
              ? "No resources match your search."
              : "No resources available from this integration."
          }
        />
      ) : viewMode === "cards" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 overflow-y-auto h-[calc(100%-54px)]">
          {items.map((it) => (
            <Card key={it.uri} className="cursor-pointer group relative h-fit">
              <CardContent
                className="p-3 flex flex-col gap-2"
                onClick={() => openItem(it)}
              >
                {it.thumbnail ? (
                  <img
                    src={it.thumbnail}
                    alt="thumbnail"
                    className="w-full h-32 object-cover rounded"
                  />
                ) : null}
                <div className="font-medium truncate">
                  {it.title ?? truncateUri(it.uri)}
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {it.description ?? it.mimeType ?? ""}
                </div>
                <div
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <Icon name="more_horiz" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem onClick={() => openItem(it)}>
                        Open
                      </DropdownMenuItem>
                      {caps.hasCreate ? (
                        <DropdownMenuItem
                          onClick={() => duplicateItem(it)}
                          disabled={isDuplicating}
                        >
                          {isDuplicating ? "Duplicating..." : "Duplicate"}
                        </DropdownMenuItem>
                      ) : null}
                      {caps.hasDelete ? (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => deleteItem(it)}
                          >
                            Delete
                          </DropdownMenuItem>
                        </>
                      ) : null}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Table
          columns={
            [
              {
                id: "title",
                header: "Title",
                render: (row) => row.title ?? "—",
              },
              {
                id: "uri",
                header: "URI",
                render: (row) => truncateUri(row.uri),
              },
              {
                id: "type",
                header: "Type",
                render: (row) => row.mimeType ?? "",
              },
              {
                id: "actions",
                header: "",
                render: (row) => (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                        }}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                        }}
                      >
                        <Icon name="more_horiz" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          openItem(row);
                        }}
                      >
                        Open
                      </DropdownMenuItem>
                      {caps.hasCreate ? (
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            duplicateItem(row);
                          }}
                          disabled={isDuplicating}
                        >
                          {isDuplicating ? "Duplicating..." : "Duplicate"}
                        </DropdownMenuItem>
                      ) : null}
                      {caps.hasDelete ? (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              deleteItem(row);
                            }}
                          >
                            Delete
                          </DropdownMenuItem>
                        </>
                      ) : null}
                    </DropdownMenuContent>
                  </DropdownMenu>
                ),
              },
            ] as TableColumn<{
              uri: string;
              title?: string;
              mimeType?: string;
            }>[]
          }
          data={items}
          onRowClick={(row) => openItem(row)}
        />
      )}

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete item?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The resource will be permanently
              deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                confirmDelete();
              }}
            >
              {isDeleting ? (
                <>
                  <Spinner size="xs" />
                  <span className="ml-2">Deleting...</span>
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ResourceCreateDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        resourceName={name}
        onSubmit={handleCreateResource}
        isLoading={isCreating}
        error={createError}
        onClearError={() => setCreateError(null)}
      />
    </div>
  );
}
