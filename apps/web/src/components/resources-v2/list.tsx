import {
  AI_APP_PRD_TEMPLATE,
  callTool,
  KEYS,
  useIntegration,
  useSDK,
  useTools,
} from "@deco/sdk";
import type { ResourceItem } from "@deco/sdk/mcp";
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
import { Checkbox } from "@deco/ui/components/checkbox.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@deco/ui/components/dropdown-menu.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { toast } from "@deco/ui/components/sonner.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { useViewMode } from "@deco/ui/hooks/use-view-mode.ts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  useCallback,
  useDeferredValue,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useParams } from "react-router";
import { z } from "zod";
import { useNavigateWorkspace } from "../../hooks/use-navigate-workspace.ts";
import { useResourceWatch } from "../../hooks/use-resource-watch.ts";
import { usePersistedFilters } from "@deco/ui/hooks/use-persisted-filters.ts";
import { useSortable } from "@deco/ui/hooks/use-sortable.ts";
import type { WatchEvent } from "../../stores/resource-watch/index.ts";
import { EmptyState } from "@deco/ui/components/empty-state.tsx";
import {
  Table,
  type TableColumn,
} from "@deco/ui/components/resource-table.tsx";
import { TimeAgoCell, UserInfo } from "../common/table/table-cells.tsx";
import { useThread } from "../decopilot/thread-provider.tsx";
import {
  ResourceHeader,
  type ResourceHeaderTab,
} from "@deco/ui/components/resource-header.tsx";
import { ResourceRouteProvider } from "./route-context.tsx";

// Base resource data schema that all resources extend
const BaseResourceDataSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  icon: z.string().url().optional(),
});

export type ResourceListItem = ResourceItem<typeof BaseResourceDataSchema>;

export interface CustomRowAction {
  label: string;
  icon?: string;
  onClick: (item: unknown) => void;
  variant?: "default" | "destructive";
  disabled?: boolean;
}

function ResourcesV2ListTab({
  integrationId,
  resourceName,
  headerSlot,
  tabs,
  activeTab,
  onTabChange,
  // Custom data props
  customData,
  customColumns,
  customRowActions,
  onItemClick,
  customCtaButton,
  customEmptyState,
}: {
  integrationId?: string;
  resourceName?: string;
  headerSlot?: ReactNode;
  tabs?: ResourceHeaderTab[];
  activeTab?: string;
  onTabChange?: (tabId: string) => void;
  // Custom data props
  customData?: Array<ResourceListItem | Record<string, unknown>>;
  customColumns?: TableColumn<ResourceListItem | Record<string, unknown>>[];
  customRowActions?: (
    item: ResourceListItem | Record<string, unknown>,
  ) => CustomRowAction[];
  onItemClick?: (item: ResourceListItem | Record<string, unknown>) => void;
  customCtaButton?: ReactNode;
  customEmptyState?: { icon?: string; title?: string; description?: string };
}) {
  const { locator } = useSDK();
  const integration = useIntegration(integrationId ?? "").data;
  const navigateWorkspace = useNavigateWorkspace();
  const queryClient = useQueryClient();

  // Canvas tabs management
  const { addTab, createTab, tabs: canvasTabs, setActiveTab } = useThread();
  const [mutating, setMutating] = useState(false);
  const [viewMode, setViewMode] = useViewMode();
  const [deleteUri, setDeleteUri] = useState<string | null>(null);
  const [dontAskAgain, setDontAskAgain] = useState(false);
  const { sortKey, sortDirection, handleSort } = useSortable("updated_at");

  // Session storage key for skip confirmation preference
  const skipConfirmationKey = `skip-delete-confirmation-${integrationId}-${resourceName}`;

  // Check if user has set "don't ask again" in this session
  const shouldSkipConfirmation = () => {
    return sessionStorage.getItem(skipConfirmationKey) === "true";
  };

  // Use persisted filters with a unique key based on integration and resource
  const filterKey = `${integrationId}-${resourceName}`;
  const [filters, setFilters] = usePersistedFilters(filterKey);

  // Persist filter bar visibility
  const filterBarVisibilityKey = `deco-filter-bar-visible-${filterKey}`;
  const [filterBarVisible, setFilterBarVisible] = useState(() => {
    const stored = globalThis.localStorage?.getItem(filterBarVisibilityKey);
    return stored === "true";
  });

  // Local state for instant search, deferred for server queries
  const [localSearch, setLocalSearch] = useState("");
  const deferredSearch = useDeferredValue(localSearch);
  const clientSearchValue = localSearch;
  const serverSearchValue = deferredSearch;

  const connection = integration?.connection;
  const toolsQuery = useTools(connection!, false);
  const capabilities = useMemo(() => {
    const tools: Array<{ name: string }> = toolsQuery?.data?.tools ?? [];
    const has = (suffix: string) =>
      resourceName
        ? tools.some(
            (t) =>
              t.name ===
              `DECO_RESOURCE_${resourceName.toUpperCase()}_${suffix}`,
          )
        : false;
    return {
      hasCreate: has("CREATE"),
      hasUpdate: has("UPDATE"),
      hasDelete: has("DELETE"),
    };
  }, [toolsQuery?.data?.tools, resourceName]);

  // Use refs to store handler functions so they can be accessed in the columns useMemo
  const handleDuplicateRef = useRef<
    ((item: ResourceListItem) => Promise<void>) | null
  >(null);
  const onDeleteClickRef = useRef<((uri: string) => void) | null>(null);

  const columns: TableColumn<ResourceListItem | Record<string, unknown>>[] =
    useMemo(() => {
      // Define the actions column renderer inline
      // It will access handleDuplicate and onDeleteClick via refs when executed
      const actionsColumnRenderer = (
        row: ResourceListItem | Record<string, unknown>,
      ) => {
        // Use custom row actions if provided
        if (customRowActions) {
          const customActions = customRowActions(row);
          const allActions: CustomRowAction[] = [...customActions];

          // Get the resource item and URI for default actions
          const resourceItem = row as ResourceListItem;
          const itemRecord = row as Record<string, unknown>;
          const itemUri = resourceItem.uri || (itemRecord.uri as string) || "";

          // Add default MCP actions if URI is available and not already in custom actions
          if (itemUri) {
            const hasDuplicate = customActions.some(
              (a) => a.label === "Duplicate",
            );
            const hasOpen = customActions.some((a) => a.label === "Open");
            const hasDelete = customActions.some((a) => a.label === "Delete");

            if (!hasDuplicate && handleDuplicateRef.current) {
              allActions.push({
                label: "Duplicate",
                icon: "content_copy",
                onClick: () => {
                  handleDuplicateRef.current?.(resourceItem);
                },
              });
            }

            if (!hasOpen) {
              allActions.push({
                label: "Open",
                icon: "open_in_new",
                onClick: () => {
                  navigateWorkspace(
                    `rsc/${integrationId}/${resourceName}/${encodeURIComponent(itemUri)}`,
                  );
                },
              });
            }

            if (
              capabilities.hasDelete &&
              !hasDelete &&
              onDeleteClickRef.current
            ) {
              allActions.push({
                label: "Delete",
                icon: "delete",
                variant: "destructive",
                onClick: () => {
                  onDeleteClickRef.current?.(itemUri);
                },
              });
            }
          }

          if (allActions.length === 0) return null;

          return (
            <div className="flex items-center justify-end">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                    }}
                    className="text-muted-foreground"
                  >
                    <Icon name="more_horiz" className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {allActions.map((action, index) => (
                    <DropdownMenuItem
                      key={index}
                      onClick={(e) => {
                        e.stopPropagation();
                        action.onClick(row);
                      }}
                      disabled={action.disabled}
                      className={
                        action.variant === "destructive"
                          ? "text-destructive focus:text-destructive"
                          : ""
                      }
                    >
                      {action.icon && (
                        <Icon name={action.icon} className="w-4 h-4 mr-2" />
                      )}
                      {action.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        }

        // Default actions for MCP resources (when customRowActions is not provided)
        const resourceItem = row as ResourceListItem;
        const itemRecord = row as Record<string, unknown>;
        const itemUri = resourceItem.uri || (itemRecord.uri as string) || "";

        if (!itemUri) return null;

        const defaultActions: CustomRowAction[] = [];

        // Add other default actions if available
        if (handleDuplicateRef.current) {
          defaultActions.push({
            label: "Duplicate",
            icon: "content_copy",
            onClick: () => {
              handleDuplicateRef.current?.(resourceItem);
            },
          });
        }

        defaultActions.push({
          label: "Open",
          icon: "open_in_new",
          onClick: () => {
            navigateWorkspace(
              `rsc/${integrationId}/${resourceName}/${encodeURIComponent(itemUri)}`,
            );
          },
        });

        if (capabilities.hasDelete && onDeleteClickRef.current) {
          defaultActions.push({
            label: "Delete",
            icon: "delete",
            variant: "destructive",
            onClick: () => {
              onDeleteClickRef.current?.(itemUri);
            },
          });
        }

        if (defaultActions.length === 0) return null;

        return (
          <div className="flex items-center justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation();
                  }}
                  className="text-muted-foreground"
                >
                  <Icon name="more_horiz" className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {defaultActions.map((action, index) => (
                  <DropdownMenuItem
                    key={index}
                    onClick={(e) => {
                      e.stopPropagation();
                      action.onClick(row);
                    }}
                    disabled={action.disabled}
                    className={
                      action.variant === "destructive"
                        ? "text-destructive focus:text-destructive"
                        : ""
                    }
                  >
                    {action.icon && (
                      <Icon name={action.icon} className="w-4 h-4 mr-2" />
                    )}
                    {action.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      };

      // Use custom columns if provided
      if (customColumns) {
        // Check if customColumns already has an actions column
        const hasActionsColumn = customColumns.some(
          (col) => col.id === "actions",
        );

        // If customRowActions is provided and no actions column exists, append it
        if (customRowActions && !hasActionsColumn) {
          return [
            ...customColumns,
            {
              id: "actions",
              header: "",
              render: actionsColumnRenderer,
              cellClassName: "w-[5%]",
            },
          ];
        }

        return customColumns;
      }

      // Default columns for MCP resources
      return [
        {
          id: "title",
          header: "Name",
          accessor: (row) => {
            const item = row as ResourceListItem;
            return item.data?.name || "";
          },
          cellClassName: "max-w-3xs font-medium",
          sortable: true,
        },
        {
          id: "description",
          header: "Description",
          accessor: (row) => {
            const item = row as ResourceListItem;
            return item.data?.description || "";
          },
          cellClassName: "max-w-xl",
          sortable: true,
        },
        {
          id: "updated_at",
          header: "Updated",
          render: (row) => {
            const item = row as ResourceListItem;
            return <TimeAgoCell value={item.updated_at} />;
          },
          cellClassName: "whitespace-nowrap min-w-30",
          sortable: true,
        },
        {
          id: "updated_by",
          header: "Updated by",
          render: (row) => {
            const item = row as ResourceListItem;
            return (
              <UserInfo userId={item.updated_by} showEmail={false} size="sm" />
            );
          },
          cellClassName: "max-w-3xs",
          sortable: true,
        },
        {
          id: "actions",
          header: "",
          render: actionsColumnRenderer,
          cellClassName: "w-[5%]",
        },
      ];
    }, [
      customColumns,
      customRowActions,
      capabilities,
      integrationId,
      resourceName,
      navigateWorkspace,
    ]);

  // Only use MCP query if customData is not provided
  const listQuery = useQuery({
    queryKey: KEYS.RESOURCES_LIST(
      locator,
      integrationId!,
      resourceName!,
      serverSearchValue,
      sortKey ?? undefined,
      sortDirection ?? undefined,
    ),
    enabled: Boolean(integration && resourceName && !customData),
    staleTime: 0, // Always consider data stale so it refetches when invalidated
    refetchOnMount: "always", // Always refetch when component mounts
    queryFn: async () => {
      const result = (await callTool(integration!.connection, {
        name: `DECO_RESOURCE_${resourceName!.toUpperCase()}_SEARCH`,
        arguments: {
          term: serverSearchValue,
          page: 1,
          pageSize: 50,
          sortBy: sortKey ?? undefined,
          sortOrder: sortDirection ?? undefined,
        },
      })) as {
        structuredContent?: {
          items?: Array<ResourceListItem>;
        };
      };
      return result?.structuredContent?.items ?? [];
    },
  });

  // Watch for file changes to auto-refresh the list
  // Map resource names to their deconfig paths
  const resourcePathMap: Record<string, string> = {
    workflow: "/src/workflows/",
    tool: "/src/tools/",
    document: "/src/documents/",
    view: "/src/views/",
  };

  const pathFilter = resourceName ? resourcePathMap[resourceName] : undefined;

  // Build a per-integration, URL-safe resource key for the watch store and watcher-id
  const watchResourceUri =
    integrationId && resourceName
      ? `${integrationId}-${resourceName}-list-all`.replace(
          /[^a-zA-Z0-9-_]/g,
          "-",
        )
      : "";

  useResourceWatch({
    resourceUri: watchResourceUri,
    pathFilter,
    enabled: Boolean(pathFilter && integrationId && watchResourceUri),
    skipHistorical: true,
    onNewEvent: useCallback(
      (_event: WatchEvent) => {
        queryClient.invalidateQueries({
          queryKey: KEYS.RESOURCES_LIST(locator, integrationId!, resourceName!),
        });
      },
      [locator, integrationId, resourceName, queryClient],
    ),
  });

  // Use custom data if provided, otherwise use MCP query data
  const items = customData ?? listQuery.data ?? [];
  // Only show loading spinner on initial load, not during mutations or background refetches
  // Mutations show loading on the button itself, not full-page
  // No loading when using custom data
  const loading = customData ? false : listQuery.isLoading;
  const error = listQuery.isError ? (listQuery.error as Error).message : null;

  const handleDuplicate = async (item: ResourceListItem) => {
    if (!integration) return;
    try {
      setMutating(true);

      // fetch the full resource first
      const readResult = await callTool(integration.connection, {
        name: `DECO_RESOURCE_${(resourceName ?? "").toUpperCase()}_READ`,
        arguments: { uri: item.uri },
      });

      const fullResourceData = (
        readResult as { structuredContent?: { data?: Record<string, unknown> } }
      )?.structuredContent?.data;

      if (!fullResourceData || typeof fullResourceData !== "object") {
        throw new Error("Could not fetch full resource data");
      }

      const originalName =
        (fullResourceData.name as string) || item.data?.name || "Untitled";
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

      // Build the duplicated data with required fields guaranteed
      const duplicatedData: Record<string, unknown> = {
        ...fullResourceData,
        name: `${originalName} (Copy ${timestamp})`,
        // Ensure description always has a default value (common required field)
        description: fullResourceData.description ?? "",
      };

      const createResult = await callTool(integration.connection, {
        name: `DECO_RESOURCE_${(resourceName ?? "").toUpperCase()}_CREATE`,
        arguments: { data: duplicatedData },
      });

      const newUri = (createResult as { structuredContent?: { uri?: string } })
        ?.structuredContent?.uri;

      if (!newUri) {
        throw new Error("No URI returned from create operation");
      }

      toast.success(`${resourceName || "Resource"} duplicated successfully`);

      queryClient.invalidateQueries({
        queryKey: KEYS.RESOURCES_LIST(locator, integrationId!, resourceName!),
      });

      navigateWorkspace(
        `rsc/${integrationId}/${resourceName}/${encodeURIComponent(newUri)}`,
      );
    } catch (error) {
      console.error(`Failed to duplicate ${resourceName}:`, error);
      toast.error(`Failed to duplicate ${resourceName}. Please try again.`);
    } finally {
      setMutating(false);
    }
  };

  // Delete handler
  const handleDelete = async (uri: string) => {
    if (!integration) return;
    try {
      setMutating(true);
      await callTool(integration.connection, {
        name: `DECO_RESOURCE_${(resourceName ?? "").toUpperCase()}_DELETE`,
        arguments: { uri },
      });
      toast.success(`${resourceName || "Resource"} deleted successfully`);
      await listQuery.refetch();
    } catch (error) {
      console.error(`Failed to delete ${resourceName}:`, error);
      toast.error(`Failed to delete ${resourceName}. Please try again.`);
    } finally {
      setMutating(false);
    }
  };

  // Handle delete button click
  const onDeleteClick = (uri: string) => {
    if (shouldSkipConfirmation()) {
      handleDelete(uri);
    } else {
      setDeleteUri(uri);
    }
  };

  // Update refs with the latest functions
  handleDuplicateRef.current = handleDuplicate;
  onDeleteClickRef.current = onDeleteClick;

  // Get unique users from the items for filter dropdown
  const availableUsers = useMemo(() => {
    const userIds = new Set<string>();
    items.forEach((item) => {
      const resourceItem = item as ResourceListItem;
      if (resourceItem.created_by) userIds.add(resourceItem.created_by);
      if (resourceItem.updated_by) userIds.add(resourceItem.updated_by);
    });
    return Array.from(userIds).map((id) => ({ id, name: id }));
  }, [items]);

  const filteredItems = useMemo(() => {
    let result = items;

    // Client-side search for custom data (MCP resources filtered server-side)
    if (customData && clientSearchValue) {
      const searchTerm = clientSearchValue.toLowerCase().trim();
      result = result.filter((item) => {
        const resourceItem = item as ResourceListItem;
        const itemRecord = item as Record<string, unknown>;
        const itemData =
          resourceItem.data ||
          (itemRecord.data as Record<string, unknown> | undefined);
        const name = String(itemData?.name || "").toLowerCase();
        const description = String(itemData?.description || "").toLowerCase();
        return name.includes(searchTerm) || description.includes(searchTerm);
      });
    }

    // Apply advanced filters (only for MCP resources, skip for custom data)
    if (filters.length === 0 || customData) return result;

    return result.filter((item) => {
      const resourceItem = item as ResourceListItem;
      return filters.every((filter) => {
        const { column, operator, value } = filter;

        // Text filters (name, description)
        if (column === "name" || column === "description") {
          const fieldValue = String(
            resourceItem.data?.[column] || "",
          ).toLowerCase();
          const filterValue = String(value || "").toLowerCase();

          switch (operator) {
            case "contains":
              return fieldValue.includes(filterValue);
            case "does_not_contain":
              return !fieldValue.includes(filterValue);
            case "is":
              return fieldValue === filterValue;
            case "is_not":
              return fieldValue !== filterValue;
            default:
              return true;
          }
        }

        // User filters (created_by, updated_by)
        if (column === "created_by" || column === "updated_by") {
          const fieldValue = resourceItem[column];
          return fieldValue === value;
        }

        // Date filters (created_at, updated_at)
        if (column === "created_at" || column === "updated_at") {
          const fieldValue = resourceItem[column];
          if (!fieldValue) return false;

          const itemDate = new Date(String(fieldValue));
          const now = new Date();

          if (operator === "in_last") {
            let daysAgo = 0;
            switch (value) {
              case "7d":
                daysAgo = 7;
                break;
              case "30d":
                daysAgo = 30;
                break;
              case "3m":
                daysAgo = 90;
                break;
              case "all":
                return true;
              default:
                return true;
            }
            const cutoff = new Date(
              now.getTime() - daysAgo * 24 * 60 * 60 * 1000,
            );
            return itemDate >= cutoff;
          }
        }

        return true;
      });
    });
  }, [items, filters, customData, clientSearchValue]);

  // Sort the items based on current sort state
  // For custom data, sorting should be handled by the custom columns' sortable property
  const sortedItems = useMemo(() => {
    if (!sortKey || !sortDirection) return filteredItems;
    // If using custom columns, let the Table component handle sorting
    if (customColumns) return filteredItems;

    return [...filteredItems].sort((a, b) => {
      const resourceItemA = a as ResourceListItem;
      const resourceItemB = b as ResourceListItem;
      let aValue: string | number;
      let bValue: string | number;

      // Get values based on column
      switch (sortKey) {
        case "title":
          aValue = String(resourceItemA.data?.name || "").toLowerCase();
          bValue = String(resourceItemB.data?.name || "").toLowerCase();
          break;
        case "description":
          aValue = String(resourceItemA.data?.description || "").toLowerCase();
          bValue = String(resourceItemB.data?.description || "").toLowerCase();
          break;
        case "updated_at":
          aValue = resourceItemA.updated_at
            ? new Date(String(resourceItemA.updated_at)).getTime()
            : 0;
          bValue = resourceItemB.updated_at
            ? new Date(String(resourceItemB.updated_at)).getTime()
            : 0;
          break;
        case "updated_by":
          aValue = String(resourceItemA.updated_by || "").toLowerCase();
          bValue = String(resourceItemB.updated_by || "").toLowerCase();
          break;
        default:
          return 0;
      }

      // Compare values
      if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
      if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
  }, [filteredItems, sortKey, sortDirection, customColumns]);

  // Removed effects in favor of TanStack Query hooks

  // Only require integrationId/resourceName if not using custom data
  if (!customData && (!integrationId || !resourceName)) {
    return (
      <EmptyState
        icon="report"
        title="Missing parameters"
        description="integrationId or resourceName not provided."
      />
    );
  }

  // Always ensure there's at least an "All" tab
  const finalTabs = useMemo(() => {
    if (!tabs || tabs.length === 0) {
      return [{ id: "all", label: "All" }];
    }
    return tabs;
  }, [tabs]);

  // Handler for creating a blank document
  const createBlankDocument = async () => {
    if (!integration) return;
    try {
      setMutating(true);

      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const data = {
        name: `Untitled-${timestamp}`,
        description: "",
        content: "",
      };

      const result = await callTool(integration.connection, {
        name: "DECO_RESOURCE_DOCUMENT_CREATE",
        arguments: { data },
      });

      const uri =
        (result as { uri?: string })?.uri ||
        (result as { data?: { uri?: string } })?.data?.uri ||
        (
          result as {
            structuredContent?: { uri?: string };
          }
        )?.structuredContent?.uri ||
        (
          result as {
            content?: Array<{ text?: string }>;
          }
        )?.content?.[0]?.text;

      if (!uri) {
        console.error("Create result:", result);
        throw new Error("No URI returned from create operation");
      }

      queryClient.invalidateQueries({
        queryKey: KEYS.RESOURCES_LIST(locator, integrationId!, resourceName!),
      });

      // Open the newly created resource in a fresh canvas tab
      const newTab = createTab({
        type: "detail",
        resourceUri: uri,
        title: data.name || "Untitled",
        icon: integration?.icon,
      });
      if (!newTab) {
        console.warn(
          "[ResourcesV2List] Failed to open new document tab after creation",
        );
      }
    } catch (error) {
      console.error("Failed to create document:", error);
      toast.error("Failed to create document. Please try again.");
      setMutating(false);
    }
  };

  // Create CTA button - use custom if provided
  // If customCtaButton is explicitly null, don't show any CTA button
  const ctaButton =
    customCtaButton !== undefined ? (
      customCtaButton
    ) : capabilities.hasCreate ? (
      resourceName === "document" ? (
        // Split button for documents with dropdown options
        <div className="w-full md:w-auto flex items-stretch rounded-xl overflow-hidden">
          <Button
            onClick={createBlankDocument}
            variant="default"
            size="sm"
            className="flex-1 rounded-none rounded-l-xl"
            disabled={mutating}
          >
            {mutating ? (
              <div className="w-4 h-4">
                <Spinner />
              </div>
            ) : (
              <Icon name="add" />
            )}
            New document
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="default"
                size="sm"
                className="rounded-none rounded-r-xl border-l border-white/20"
                disabled={mutating}
              >
                <Icon name="expand_more" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuItem
                className="cursor-pointer"
                onSelect={createBlankDocument}
              >
                <Icon name="insert_drive_file" className="w-4 h-4 mr-2" />
                Blank document
              </DropdownMenuItem>
              <DropdownMenuItem
                className="cursor-pointer"
                onSelect={async () => {
                  if (!integration) return;
                  try {
                    setMutating(true);

                    const result = await callTool(integration.connection, {
                      name: "DECO_RESOURCE_DOCUMENT_CREATE",
                      arguments: {
                        data: {
                          name: "AI App PRD",
                          description:
                            "A template for designing AI applications with Tools, Agents, Workflows, and Views",
                          content: AI_APP_PRD_TEMPLATE,
                          tags: ["template", "prd", "ai"],
                        },
                      },
                    });

                    const uri =
                      (result as { uri?: string })?.uri ||
                      (result as { data?: { uri?: string } })?.data?.uri ||
                      (
                        result as {
                          structuredContent?: { uri?: string };
                        }
                      )?.structuredContent?.uri ||
                      (
                        result as {
                          content?: Array<{ text?: string }>;
                        }
                      )?.content?.[0]?.text;

                    if (!uri) {
                      console.error("Create result:", result);
                      throw new Error("No URI returned from create operation");
                    }

                    queryClient.invalidateQueries({
                      queryKey: KEYS.RESOURCES_LIST(
                        locator,
                        integrationId!,
                        resourceName!,
                      ),
                    });

                    // Open the newly created resource in a fresh canvas tab
                    const newTab = createTab({
                      type: "detail",
                      resourceUri: uri,
                      title: "AI App PRD",
                      icon: integration?.icon,
                    });
                    if (!newTab) {
                      console.warn(
                        "[ResourcesV2List] Failed to open AI App PRD tab after creation",
                      );
                    }
                  } catch (error) {
                    console.error("Failed to create document:", error);
                    toast.error("Failed to create document. Please try again.");
                    setMutating(false);
                  }
                }}
              >
                <Icon name="auto_awesome" className="w-4 h-4 mr-2" />
                From AI PRD template
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ) : (
        // Regular button for other resources
        <Button
          onClick={async () => {
            if (!integration) return;
            try {
              setMutating(true);

              // Generate unique name with timestamp
              const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
              const uniqueName = `Untitled-${timestamp}`;

              // Build data payload based on resource type
              const data: Record<string, unknown> = {
                name: uniqueName,
                description: "",
              };

              // Add resource-specific required fields
              if (resourceName === "workflow") {
                data.inputSchema = {};
                data.outputSchema = {};
                data.steps = [
                  {
                    def: {
                      name: "Start",
                      description: "Initial step",
                      execute:
                        "export default async function(input, ctx) { return {}; }",
                      inputSchema: {},
                      outputSchema: {},
                    },
                  },
                ];
              } else if (resourceName === "tool") {
                data.inputSchema = {};
                data.outputSchema = {};
                data.execute =
                  "// Add your tool code here\nexport default function(input) {\n  return {};\n}";
              }

              const result = await callTool(integration.connection, {
                name: `DECO_RESOURCE_${(resourceName ?? "").toUpperCase()}_CREATE`,
                arguments: { data },
              });

              // Extract URI from response (can be at different levels)
              const uri =
                (result as { uri?: string })?.uri ||
                (result as { data?: { uri?: string } })?.data?.uri ||
                (
                  result as {
                    structuredContent?: { uri?: string };
                  }
                )?.structuredContent?.uri ||
                (
                  result as {
                    content?: Array<{ text?: string }>;
                  }
                )?.content?.[0]?.text;

              if (!uri) {
                console.error("Create result:", result);
                throw new Error("No URI returned from create operation");
              }

              // Invalidate list query so it refreshes when user navigates back
              queryClient.invalidateQueries({
                queryKey: KEYS.RESOURCES_LIST(
                  locator,
                  integrationId!,
                  resourceName!,
                ),
              });

              // Open the newly created resource in a fresh canvas tab
              const newTab = createTab({
                type: "detail",
                resourceUri: uri,
                title: uniqueName || "Untitled",
                icon: integration?.icon,
              });
              if (!newTab) {
                console.warn(
                  "[ResourcesV2List] Failed to open new resource tab after creation",
                );
              }
            } catch (error) {
              console.error(
                `Failed to create ${resourceName || "resource"}:`,
                error,
              );
              toast.error(
                `Failed to create ${resourceName || "resource"}. Please try again.`,
              );
              setMutating(false);
            }
          }}
          variant="default"
          size="sm"
          className="rounded-xl w-full md:w-auto"
          disabled={mutating}
        >
          {mutating ? (
            <div className="w-4 h-4">
              <Spinner />
            </div>
          ) : (
            <Icon name="add" />
          )}
          New {resourceName}
        </Button>
      )
    ) : null;

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header Section - fixed, doesn't scroll with content */}
      <div className="shrink-0">
        <div className="px-8">
          <div className="max-w-[1600px] mx-auto w-full space-y-4 md:space-y-6 lg:space-y-8">
            {headerSlot}
            <ResourceHeader
              tabs={finalTabs}
              activeTab={activeTab || "all"}
              onTabChange={onTabChange}
              searchValue={clientSearchValue}
              onSearchChange={setLocalSearch}
              onSearchKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                if (e.key === "Escape") {
                  setLocalSearch("");
                  (e.target as HTMLInputElement).blur();
                }
              }}
              onRefresh={() => listQuery.refetch()}
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
              availableUsers={availableUsers}
              renderUserItem={(user) => (
                <UserInfo
                  userId={user.id}
                  showEmail={false}
                  noTooltip
                  size="sm"
                />
              )}
              ctaButton={ctaButton}
            />
          </div>
        </div>
      </div>

      {/* Content Section - scrollable */}
      <div className="flex-1 overflow-auto">
        <div className="px-8">
          <div className="max-w-[1600px] mx-auto w-full space-y-4 md:space-y-6 lg:space-y-8 pb-8">
            {error && (
              <Card>
                <CardContent className="p-4 text-destructive text-sm">
                  {error}
                </CardContent>
              </Card>
            )}

            {loading ? (
              <div className="flex justify-center items-center h-full py-8">
                <Spinner />
              </div>
            ) : sortedItems.length === 0 ? (
              <EmptyState
                icon={customEmptyState?.icon || "list"}
                title={customEmptyState?.title || "No resources found"}
                description={
                  customEmptyState?.description ||
                  `No ${resourceName} found for this integration.`
                }
              />
            ) : viewMode === "cards" ? (
              <div
                className="grid gap-4"
                style={{
                  gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
                }}
              >
                {sortedItems.map((it) => {
                  // Default card rendering for MCP resources
                  const item = it as ResourceListItem | Record<string, unknown>;
                  const resourceItem = item as ResourceListItem;
                  const itemRecord = item as Record<string, unknown>;
                  const thumbnail = itemRecord.thumbnail as string | undefined;
                  const itemData =
                    resourceItem.data ||
                    (itemRecord.data as Record<string, unknown> | undefined);
                  const itemUri =
                    resourceItem.uri || (itemRecord.uri as string) || "";
                  const itemName = (itemData?.name as string) || "";
                  const itemDescription =
                    (itemData?.description as string) || "";
                  const itemUpdatedAt =
                    resourceItem.updated_at ||
                    (itemRecord.updated_at as string | undefined);
                  const itemUpdatedBy =
                    resourceItem.updated_by ||
                    (itemRecord.updated_by as string | undefined);

                  return (
                    <Card
                      key={itemUri || JSON.stringify(item)}
                      className="h-full group cursor-pointer transition-shadow overflow-hidden bg-card min-h-48"
                      onClick={() => {
                        if (onItemClick) {
                          onItemClick(item);
                          return;
                        }

                        if (!itemUri) {
                          return;
                        }

                        // Check if a tab with this resourceUri already exists
                        const existingTab = canvasTabs.find(
                          (tab) =>
                            tab.type === "detail" &&
                            tab.resourceUri === itemUri,
                        );

                        if (existingTab) {
                          // Switch to existing tab instead of creating a new one
                          setActiveTab(existingTab.id);
                        } else {
                          // Create new tab if it doesn't exist
                          const newTab = {
                            type: "detail" as const,
                            resourceUri: itemUri,
                            title: itemName || "Resource",
                            icon: integration?.icon,
                          };
                          addTab(newTab);
                        }
                      }}
                    >
                      <div className="flex flex-col h-full">
                        {/* Content Section */}
                        <div className="p-5 flex flex-col gap-3 flex-1">
                          {/* Thumbnail + Title + Dropdown Row */}
                          <div className="flex items-start gap-3 relative">
                            {/* Thumbnail on the left */}
                            {thumbnail && (
                              <div className="w-16 h-16 shrink-0 overflow-hidden bg-muted rounded">
                                {thumbnail.startsWith("icon://") ? (
                                  <div className="w-full h-full flex items-center justify-center bg-muted">
                                    <Icon
                                      name={thumbnail.replace("icon://", "")}
                                      size={32}
                                      className="text-muted-foreground"
                                    />
                                  </div>
                                ) : (
                                  <img
                                    src={thumbnail}
                                    alt={itemName || "Thumbnail"}
                                    className="w-full h-full object-contain"
                                  />
                                )}
                              </div>
                            )}

                            {/* Title + Dropdown on the right */}
                            <div className="flex-1 min-w-0 flex items-start justify-between gap-2">
                              <h3 className="text-base font-medium text-foreground truncate flex-1">
                                {itemName}
                              </h3>
                              {/* Dropdown menu */}
                              {customRowActions &&
                                (() => {
                                  const customActions = customRowActions(item);
                                  const allActions: CustomRowAction[] = [
                                    ...customActions,
                                  ];

                                  // Add default MCP actions if URI is available and not already in custom actions
                                  if (itemUri) {
                                    const hasDuplicate = customActions.some(
                                      (a) => a.label === "Duplicate",
                                    );
                                    const hasOpen = customActions.some(
                                      (a) => a.label === "Open",
                                    );
                                    const hasDelete = customActions.some(
                                      (a) => a.label === "Delete",
                                    );

                                    if (!hasDuplicate) {
                                      allActions.push({
                                        label: "Duplicate",
                                        icon: "content_copy",
                                        onClick: () => {
                                          handleDuplicate(resourceItem);
                                        },
                                      });
                                    }

                                    if (!hasOpen) {
                                      allActions.push({
                                        label: "Open",
                                        icon: "open_in_new",
                                        onClick: () => {
                                          navigateWorkspace(
                                            `rsc/${integrationId}/${resourceName}/${encodeURIComponent(itemUri)}`,
                                          );
                                        },
                                      });
                                    }

                                    if (capabilities.hasDelete && !hasDelete) {
                                      allActions.push({
                                        label: "Delete",
                                        icon: "delete",
                                        variant: "destructive",
                                        onClick: () => {
                                          onDeleteClick(itemUri);
                                        },
                                      });
                                    }
                                  }

                                  if (allActions.length === 0) return null;

                                  return (
                                    <div className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                      <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                            }}
                                            className="text-muted-foreground h-8 w-8"
                                          >
                                            <Icon
                                              name="more_horiz"
                                              className="w-4 h-4"
                                            />
                                          </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                          {allActions.map((action, index) => (
                                            <DropdownMenuItem
                                              key={index}
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                action.onClick(item);
                                              }}
                                              disabled={action.disabled}
                                              className={
                                                action.variant === "destructive"
                                                  ? "text-destructive focus:text-destructive"
                                                  : ""
                                              }
                                            >
                                              {action.icon && (
                                                <Icon
                                                  name={action.icon}
                                                  className="w-4 h-4 mr-2"
                                                />
                                              )}
                                              {action.label}
                                            </DropdownMenuItem>
                                          ))}
                                        </DropdownMenuContent>
                                      </DropdownMenu>
                                    </div>
                                  );
                                })()}
                              {!customRowActions &&
                                itemUri &&
                                (() => {
                                  const defaultActions: CustomRowAction[] = [];

                                  // Add default actions
                                  defaultActions.push({
                                    label: "Duplicate",
                                    icon: "content_copy",
                                    onClick: () => {
                                      handleDuplicate(resourceItem);
                                    },
                                  });

                                  defaultActions.push({
                                    label: "Open",
                                    icon: "open_in_new",
                                    onClick: () => {
                                      navigateWorkspace(
                                        `rsc/${integrationId}/${resourceName}/${encodeURIComponent(itemUri)}`,
                                      );
                                    },
                                  });

                                  if (capabilities.hasDelete) {
                                    defaultActions.push({
                                      label: "Delete",
                                      icon: "delete",
                                      variant: "destructive",
                                      onClick: () => {
                                        onDeleteClick(itemUri);
                                      },
                                    });
                                  }

                                  if (defaultActions.length === 0) return null;

                                  return (
                                    <div className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                      <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                            }}
                                            className="text-muted-foreground h-8 w-8"
                                          >
                                            <Icon
                                              name="more_horiz"
                                              className="w-4 h-4"
                                            />
                                          </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                          {defaultActions.map(
                                            (action, index) => (
                                              <DropdownMenuItem
                                                key={index}
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  action.onClick(item);
                                                }}
                                                disabled={action.disabled}
                                                className={
                                                  action.variant ===
                                                  "destructive"
                                                    ? "text-destructive focus:text-destructive"
                                                    : ""
                                                }
                                              >
                                                {action.icon && (
                                                  <Icon
                                                    name={action.icon}
                                                    className="w-4 h-4 mr-2"
                                                  />
                                                )}
                                                {action.label}
                                              </DropdownMenuItem>
                                            ),
                                          )}
                                        </DropdownMenuContent>
                                      </DropdownMenu>
                                    </div>
                                  );
                                })()}
                            </div>
                          </div>

                          {/* Description below */}
                          <p className="text-sm text-muted-foreground line-clamp-2 leading-normal">
                            {itemDescription || "No description"}
                          </p>
                        </div>

                        {/* Footer Section */}
                        <div className="border-t border-border px-5 py-3 flex items-center justify-between text-sm flex-wrap gap-x-4 gap-y-1">
                          <div className="flex items-center gap-1">
                            <span className="text-muted-foreground">
                              Updated
                            </span>
                            <span className="text-foreground">
                              <TimeAgoCell value={itemUpdatedAt} />
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-muted-foreground">by</span>
                            <UserInfo
                              userId={itemUpdatedBy}
                              size="xs"
                              showEmail={false}
                              noTooltip
                            />
                          </div>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            ) : null}
            {viewMode === "table" && !loading && sortedItems.length > 0 && (
              <div className="w-fit min-w-full">
                <Table
                  columns={columns}
                  data={sortedItems}
                  sortKey={sortKey}
                  sortDirection={sortDirection}
                  onSort={handleSort}
                  onRowClick={(row) => {
                    const item = row as ResourceListItem;

                    if (onItemClick) {
                      onItemClick(row);
                      return;
                    }
                    // Default behavior for MCP resources
                    // Add new tab with detail view
                    if (!item.uri) {
                      return;
                    }

                    // Check if a tab with this resourceUri already exists
                    const existingTab = canvasTabs.find(
                      (tab) =>
                        tab.type === "detail" && tab.resourceUri === item.uri,
                    );

                    if (existingTab) {
                      // Switch to existing tab instead of creating a new one
                      setActiveTab(existingTab.id);
                    } else {
                      // Create new tab if it doesn't exist
                      const newTab = {
                        type: "detail" as const,
                        resourceUri: item.uri,
                        title: item.data?.name || "Resource",
                        icon: integration?.icon,
                      };
                      addTab(newTab);
                    }
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!deleteUri}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteUri(null);
            setDontAskAgain(false);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {resourceName}?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete this{" "}
              {resourceName || "resource"}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex items-center space-x-2 px-6 py-2">
            <Checkbox
              id="dont-ask-again"
              checked={dontAskAgain}
              onCheckedChange={(checked) => setDontAskAgain(checked === true)}
            />
            <label
              htmlFor="dont-ask-again"
              className="text-sm text-muted-foreground cursor-pointer select-none"
            >
              Don't ask again for this session
            </label>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!deleteUri) return;

                const uriToDelete = deleteUri;

                // Save preference to sessionStorage (persists across navigations)
                if (dontAskAgain) {
                  sessionStorage.setItem(skipConfirmationKey, "true");
                }

                // Close modal
                setDeleteUri(null);
                setDontAskAgain(false);

                // Perform delete after state updates
                setTimeout(() => {
                  handleDelete(uriToDelete);
                }, 0);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export function ResourcesV2List({
  integrationId,
  resourceName,
  headerSlot,
  tabs,
  activeTab,
  onTabChange,
  // Custom data props
  customData,
  customColumns,
  customRowActions,
  onItemClick,
  customCtaButton,
  customEmptyState,
}: {
  integrationId?: string;
  resourceName?: string;
  headerSlot?: ReactNode;
  tabs?: ResourceHeaderTab[];
  activeTab?: string;
  onTabChange?: (tabId: string) => void;
  // Custom data props
  customData?: Array<ResourceListItem | Record<string, unknown>>;
  customColumns?: TableColumn<ResourceListItem | Record<string, unknown>>[];
  customRowActions?: (
    item: ResourceListItem | Record<string, unknown>,
  ) => CustomRowAction[];
  onItemClick?: (item: ResourceListItem | Record<string, unknown>) => void;
  customCtaButton?: ReactNode;
  customEmptyState?: { icon?: string; title?: string; description?: string };
}) {
  return (
    <ResourceRouteProvider
      integrationId={integrationId}
      resourceName={resourceName}
    >
      <ResourcesV2ListTab
        integrationId={integrationId}
        resourceName={resourceName}
        headerSlot={headerSlot}
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={onTabChange}
        customData={customData}
        customColumns={customColumns}
        customRowActions={customRowActions}
        onItemClick={onItemClick}
        customCtaButton={customCtaButton}
        customEmptyState={customEmptyState}
      />
    </ResourceRouteProvider>
  );
}

/** Component to connect route params to the component */
export default function ResourcesV2ListPage() {
  const { integrationId, resourceName } = useParams();

  return (
    <ResourcesV2List
      integrationId={integrationId}
      resourceName={resourceName}
    />
  );
}
