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
import { Icon } from "@deco/ui/components/icon.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { useViewMode } from "@deco/ui/hooks/use-view-mode.ts";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { useNavigateWorkspace } from "../../hooks/use-navigate-workspace.ts";
import { EmptyState } from "../common/empty-state.tsx";
import { ListPageHeader } from "../common/list-page-header.tsx";
import { Table, type TableColumn } from "../common/table/index.tsx";
import { useParams } from "react-router";

export function InternalResourceList({ name }: { name: string }) {
  const { integrationId } = useParams();
  if (!integrationId) return null;
  return (
    <InternalResourceListWithIntegration
      name={name}
      integrationId={integrationId}
    />
  );
}

export function InternalResourceListWithIntegration({
  name,
  integrationId,
}: {
  name: string;
  integrationId: string;
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const integration = useIntegration(integrationId).data;
  const navigateWorkspace = useNavigateWorkspace();
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
      } catch (_) {
        // ignore; default capabilities remain false
      }
    })();
  }, [integration?.connection, name]);

  const _uri = useMemo(() => searchParams.get("uri") ?? "", [searchParams]);

  // Inline detail state removed in favor of navigation

  // Detail lookup now happens in openItem via navigate

  async function openItem(it: { uri: string }) {
    try {
      const result = (await callTool(integration?.connection, {
        name: "DECO_CHAT_VIEWS_LIST",
        arguments: {},
      })) as {
        structuredContent?: {
          views?: Array<{
            name?: string;
            url?: string;
            resourceName?: string;
          }>;
        };
      };
      const views = result.structuredContent?.views ?? [];
      const selected = views.find((v) => v.resourceName === name);
      const targetViewName = selected?.name ?? `${name.toUpperCase()}_DETAIL`;
      const targetUrl = selected?.url
        ? `${selected.url}${selected.url.includes("?") ? "&" : "?"}uri=${
          encodeURIComponent(it.uri)
        }`
        : `internal://resource/detail?name=${encodeURIComponent(name)}&uri=${
          encodeURIComponent(it.uri)
        }`;
      navigateWorkspace(
        `/views/${integrationId}/${targetViewName}?viewUrl=${
          encodeURIComponent(targetUrl)
        }`,
      );
    } catch (_) {
      // fallback: internal detail
      const targetViewName = `${name.toUpperCase()}_DETAIL`;
      const targetUrl = `internal://resource/detail?name=${
        encodeURIComponent(name)
      }&uri=${encodeURIComponent(it.uri)}`;
      navigateWorkspace(
        `/views/${integrationId}/${targetViewName}?viewUrl=${
          encodeURIComponent(targetUrl)
        }`,
      );
    }
  }

  async function createItem() {
    if (!caps.hasCreate) return;
    const resourceName = globalThis.prompt("Name (unique)") ?? "";
    if (!resourceName) return;
    const title = globalThis.prompt("Title (optional)") ?? undefined;
    const description = globalThis.prompt("Description (optional)") ??
      undefined;
    const data = globalThis.prompt("Content (text)");
    if (data == null) return;
    setLoading(true);
    try {
      await callTool(integration?.connection, {
        name: "DECO_CHAT_RESOURCES_CREATE",
        arguments: {
          name,
          resourceName,
          title,
          description,
          content: { data, type: "text" },
        },
      });
      await runSearch(q);
    } finally {
      setLoading(false);
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
    const source = title ||
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

  // Detail rendering removed – clicking an item navigates to the dedicated detail view

  // List mode
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
      actionsRight={caps.hasCreate
        ? (
          <div className="pl-3 ml-2 border-l border-border">
            <Button onClick={createItem} variant="special">
              Create
            </Button>
          </div>
        )
        : null}
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
      {items.length === 0
        ? (
          <EmptyState
            icon="search_off"
            title={`No ${name} found`}
            description={q
              ? "No resources match your search."
              : "No resources available from this integration."}
          />
        )
        : viewMode === "cards"
        ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {items.map((it) => (
              <Card key={it.uri} className="cursor-pointer group relative">
                <CardContent
                  className="p-3 flex flex-col gap-2"
                  onClick={() =>
                    openItem(it)}
                >
                  {it.thumbnail
                    ? (
                      <img
                        src={it.thumbnail}
                        alt="thumbnail"
                        className="w-full h-32 object-cover rounded"
                      />
                    )
                    : null}
                  <div className="font-medium truncate">
                    {it.title ?? truncateUri(it.uri)}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {it.description ?? it.mimeType ?? ""}
                  </div>
                  <div
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) =>
                      e.stopPropagation()}
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
                        {caps.hasCreate
                          ? (
                            <DropdownMenuItem
                              onClick={() => duplicateItem(it)}
                              disabled={isDuplicating}
                            >
                              {isDuplicating ? "Duplicating..." : "Duplicate"}
                            </DropdownMenuItem>
                          )
                          : null}
                        {caps.hasDelete
                          ? (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                variant="destructive"
                                onClick={() => deleteItem(it)}
                              >
                                Delete
                              </DropdownMenuItem>
                            </>
                          )
                          : null}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )
        : (
          <Table
            columns={[
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
                      <DropdownMenuItem onClick={() => openItem(row)}>
                        Open
                      </DropdownMenuItem>
                      {caps.hasCreate
                        ? (
                          <DropdownMenuItem
                            onClick={() => duplicateItem(row)}
                            disabled={isDuplicating}
                          >
                            {isDuplicating ? "Duplicating..." : "Duplicate"}
                          </DropdownMenuItem>
                        )
                        : null}
                      {caps.hasDelete
                        ? (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() => deleteItem(row)}
                            >
                              Delete
                            </DropdownMenuItem>
                          </>
                        )
                        : null}
                    </DropdownMenuContent>
                  </DropdownMenu>
                ),
              },
            ] as TableColumn<{
              uri: string;
              title?: string;
              mimeType?: string;
            }>[]}
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
              {isDeleting
                ? (
                  <>
                    <Spinner size="xs" />
                    <span className="ml-2">Deleting...</span>
                  </>
                )
                : (
                  "Delete"
                )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
