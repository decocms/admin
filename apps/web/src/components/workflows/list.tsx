import { KEYS, useSDK, useWorkflowRuns } from "@deco/sdk";
import { Badge } from "@deco/ui/components/badge.tsx";
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
import { Input } from "@deco/ui/components/input.tsx";
import { useCallback, useMemo, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigateWorkspace } from "../../hooks/use-navigate-workspace.ts";
import { formatToolName } from "../chat/utils/format-tool-name.ts";
import { TabActionButton } from "../canvas/tab-action-button.tsx";
import { EmptyState } from "../common/empty-state.tsx";
import { Table, type TableColumn } from "../common/table/index.tsx";
import type { WorkflowRun } from "./types.ts";
import type { WatchEvent } from "../../stores/resource-watch/index.ts";
import { useResourceWatch } from "../../hooks/use-resource-watch.ts";
import {
  formatStatus,
  getStatusBadgeVariant,
  sortWorkflowRuns,
} from "./utils.ts";
import {
  ResourceHeader,
  type TabItem,
} from "../resources-v2/resource-header.tsx";
import { useThread } from "../decopilot/thread-provider.tsx";
import { useSearchParams } from "react-router";

function WorkflowRunsTableView({
  runs,
  onClick,
  sortKey,
  sortDirection,
  onSort,
}: {
  runs: WorkflowRun[];
  onClick: (run: WorkflowRun) => void;
  sortKey: string;
  sortDirection: "asc" | "desc";
  onSort: (key: string) => void;
}) {
  const sortedRuns = useMemo(() => {
    return sortWorkflowRuns(runs, sortKey, sortDirection);
  }, [runs, sortKey, sortDirection]);

  const columns: TableColumn<WorkflowRun>[] = [
    {
      id: "workflowName",
      header: "Workflow Name",
      render: (run) => (
        <span className="font-semibold">
          {formatToolName(run.workflowName)}
        </span>
      ),
      sortable: true,
    },
    {
      id: "runId",
      header: "Run ID",
      render: (run) => (
        <div className="flex items-center gap-2">
          <Icon name="schedule" size={14} className="text-muted-foreground" />
          <span className="text-xs font-mono">{run.runId}</span>
        </div>
      ),
      sortable: true,
    },
    {
      id: "status",
      header: "Status",
      render: (run) => (
        <Badge variant={getStatusBadgeVariant(run.status)}>
          {formatStatus(run.status)}
        </Badge>
      ),
      sortable: true,
    },
    {
      id: "createdAt",
      header: "Started",
      render: (run) => (
        <span className="text-xs">
          {new Date(run.createdAt).toLocaleString()}
        </span>
      ),
      sortable: true,
    },
    {
      id: "updatedAt",
      header: "Updated",
      render: (run) => (
        <span className="text-xs">
          {run.updatedAt ? new Date(run.updatedAt).toLocaleString() : "-"}
        </span>
      ),
      sortable: true,
    },
  ];

  function handleSort(key: string) {
    onSort(key);
  }

  return (
    <Table
      columns={columns}
      data={sortedRuns}
      sortKey={sortKey}
      sortDirection={sortDirection}
      onSort={handleSort}
      onRowClick={onClick}
    />
  );
}

interface WorkflowRunsProps {
  searchTerm?: string;
  viewMode?: "cards" | "table";
  tabs?: TabItem[];
  activeTab?: string;
  onTabChange?: (tabId: string) => void;
  headerSlot?: ReactNode;
}

function WorkflowRunsContent({
  searchTerm = "",
  viewMode: initialViewMode = "cards",
  tabs,
  activeTab,
  onTabChange,
  headerSlot,
}: WorkflowRunsProps) {
  const navigateWorkspace = useNavigateWorkspace();
  const { locator } = useSDK();
  const queryClient = useQueryClient();
  const { createTab } = useThread();
  const [searchParams, setSearchParams] = useSearchParams();
  const [viewMode, setViewMode] = useState<"cards" | "table">(initialViewMode);
  const [sortKey, setSortKey] = useState<string>("createdAt");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const q = searchParams.get("q") ?? "";

  function handleSort(key: string) {
    if (sortKey === key) {
      setSortDirection((prev: "asc" | "desc") =>
        prev === "asc" ? "desc" : "asc",
      );
    } else {
      setSortKey(key);
      setSortDirection("desc");
    }
  }

  useResourceWatch({
    resourceUri: "workflow-runs://all",
    pathFilter: "/src/workflows/",
    enabled: true,
    skipHistorical: true,
    onNewEvent: useCallback(
      (event: WatchEvent) => {
        if (!locator) return;
        console.log(
          "[WorkflowRuns] Workflow definition changed, refreshing runs list",
          event,
        );

        queryClient.invalidateQueries({
          queryKey: KEYS.WORKFLOW_RUNS_ALL(locator),
        });
        queryClient.invalidateQueries({
          queryKey: KEYS.RECENT_WORKFLOW_RUNS_ALL(locator),
        });
      },
      [locator, queryClient],
    ),
  });

  // Get workflow runs - either filtered by workflow name or all recent runs
  const {
    data,
    refetch,
    isRefetching: _isRefetching,
  } = useWorkflowRuns("", 1, 25);

  const runs = data?.runs || [];

  const filteredRuns = useMemo(() => {
    if (!searchTerm) return runs;
    return runs.filter(
      (run) =>
        run.workflowName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        run.runId.toLowerCase().includes(searchTerm.toLowerCase()),
    );
  }, [runs, searchTerm]);

  // Sort runs based on current sort state
  const sortedAndFilteredRuns = useMemo(() => {
    return sortWorkflowRuns(filteredRuns, sortKey, sortDirection);
  }, [filteredRuns, sortKey, sortDirection]);

  function handleRunClick(run: WorkflowRun) {
    const newTab = createTab({
      type: "detail",
      resourceUri: `legacy-workflow-run://${run.workflowName}/${run.runId}`,
      title: formatToolName(run.workflowName),
      icon: "flowchart",
    });
    if (!newTab) {
      console.warn("[LegacyWorkflowRunsList] No active tab found");
      navigateWorkspace(
        `/workflow-runs/${encodeURIComponent(run.workflowName)}/instances/${encodeURIComponent(
          run.runId,
        )}`,
      );
    }
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Action buttons rendered in canvas header via portal */}
      <TabActionButton>
        {/* Refresh Button */}
        <Button
          variant="ghost"
          size="xs"
          onClick={() => refetch()}
          className="size-6 p-0"
        >
          <Icon name="refresh" className="text-muted-foreground" />
        </Button>

        {/* Search Input - Always Visible */}
        <div className="flex items-center gap-1">
          <Icon name="search" className="text-muted-foreground" size={16} />
          <Input
            value={q}
            onChange={(e) => {
              setSearchParams((prev) => {
                const next = new URLSearchParams(prev);
                if (e.target.value) next.set("q", e.target.value);
                else next.delete("q");
                return next;
              });
            }}
            onBlur={() => {
              setSearchParams((prev) => {
                const next = new URLSearchParams(prev);
                next.delete("q");
                return next;
              });
            }}
            onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
              if (e.key === "Escape") {
                setSearchParams((prev) => {
                  const next = new URLSearchParams(prev);
                  next.delete("q");
                  return next;
                });
                (e.target as HTMLInputElement).blur();
              }
            }}
            placeholder="Search..."
            className="h-6 w-32 border-0 shadow-none focus-visible:ring-0 px-2"
          />
        </div>

        {/* Menu Button */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="xs" className="size-6 p-0">
              <Icon name="more_horiz" className="text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 p-1">
            {/* View Mode Toggle */}
            <div className="flex items-center p-1">
              <div className="flex gap-1 w-full">
                <Button
                  variant={viewMode === "cards" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("cards")}
                  className="flex-1 h-10"
                >
                  <Icon
                    name="grid_view"
                    size={20}
                    className="text-muted-foreground"
                  />
                </Button>
                <Button
                  variant={viewMode === "table" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("table")}
                  className="flex-1 h-10"
                >
                  <Icon
                    name="view_list"
                    size={20}
                    className="text-muted-foreground"
                  />
                </Button>
              </div>
            </div>

            <DropdownMenuSeparator className="my-1" />

            {/* Sort By Section */}
            <div className="p-2">
              <p className="text-xs text-muted-foreground uppercase font-mono">
                Sort by
              </p>
            </div>

            <DropdownMenuItem
              onClick={() => handleSort("workflowName")}
              className="cursor-pointer"
            >
              {sortKey === "workflowName" && (
                <Icon name="check" size={16} className="mr-2 text-foreground" />
              )}
              {sortKey !== "workflowName" && <span className="w-4 mr-2" />}
              <span className="flex-1">Workflow Name</span>
              {sortKey === "workflowName" && sortDirection && (
                <Icon
                  name={
                    sortDirection === "asc" ? "arrow_upward" : "arrow_downward"
                  }
                  size={16}
                  className="ml-2 text-muted-foreground"
                />
              )}
            </DropdownMenuItem>

            <DropdownMenuItem
              onClick={() => handleSort("runId")}
              className="cursor-pointer"
            >
              {sortKey === "runId" && (
                <Icon name="check" size={16} className="mr-2 text-foreground" />
              )}
              {sortKey !== "runId" && <span className="w-4 mr-2" />}
              <span className="flex-1">Run ID</span>
              {sortKey === "runId" && sortDirection && (
                <Icon
                  name={
                    sortDirection === "asc" ? "arrow_upward" : "arrow_downward"
                  }
                  size={16}
                  className="ml-2 text-muted-foreground"
                />
              )}
            </DropdownMenuItem>

            <DropdownMenuItem
              onClick={() => handleSort("status")}
              className="cursor-pointer"
            >
              {sortKey === "status" && (
                <Icon name="check" size={16} className="mr-2 text-foreground" />
              )}
              {sortKey !== "status" && <span className="w-4 mr-2" />}
              <span className="flex-1">Status</span>
              {sortKey === "status" && sortDirection && (
                <Icon
                  name={
                    sortDirection === "asc" ? "arrow_upward" : "arrow_downward"
                  }
                  size={16}
                  className="ml-2 text-muted-foreground"
                />
              )}
            </DropdownMenuItem>

            <DropdownMenuItem
              onClick={() => handleSort("createdAt")}
              className="cursor-pointer"
            >
              {sortKey === "createdAt" && (
                <Icon name="check" size={16} className="mr-2 text-foreground" />
              )}
              {sortKey !== "createdAt" && <span className="w-4 mr-2" />}
              <span className="flex-1">Started</span>
              {sortKey === "createdAt" && sortDirection && (
                <Icon
                  name={
                    sortDirection === "asc" ? "arrow_upward" : "arrow_downward"
                  }
                  size={16}
                  className="ml-2 text-muted-foreground"
                />
              )}
            </DropdownMenuItem>

            <DropdownMenuItem
              onClick={() => handleSort("updatedAt")}
              className="cursor-pointer"
            >
              {sortKey === "updatedAt" && (
                <Icon name="check" size={16} className="mr-2 text-foreground" />
              )}
              {sortKey !== "updatedAt" && <span className="w-4 mr-2" />}
              <span className="flex-1">Updated</span>
              {sortKey === "updatedAt" && sortDirection && (
                <Icon
                  name={
                    sortDirection === "asc" ? "arrow_upward" : "arrow_downward"
                  }
                  size={16}
                  className="ml-2 text-muted-foreground"
                />
              )}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TabActionButton>

      <div className="flex-1 overflow-auto">
        <div className="sticky">
          <div className="px-8">
            <div className="max-w-[1600px] mx-auto w-full space-y-4 md:space-y-6 lg:space-y-8">
              {headerSlot}
              {tabs && (
                <ResourceHeader
                  tabs={tabs}
                  activeTab={activeTab ?? "runs-legacy"}
                  onTabChange={onTabChange}
                  hideActions={true}
                />
              )}
            </div>
          </div>
        </div>

        <div className="px-8">
          <div className="max-w-[1600px] mx-auto w-full space-y-4 md:space-y-6 lg:space-y-8 pb-8">
            {sortedAndFilteredRuns.length === 0 ? (
              <EmptyState
                icon="flowchart"
                title="No workflow runs found"
                description="No workflow runs match your search criteria."
              />
            ) : viewMode === "cards" ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {sortedAndFilteredRuns.map((run) => (
                  <Card
                    key={run.runId}
                    className="group cursor-pointer hover:shadow-md transition-shadow rounded-xl relative border-border"
                    onClick={() => handleRunClick(run)}
                  >
                    <CardContent className="p-0">
                      <div className="grid grid-cols-[1fr_min-content] gap-4 items-start p-4">
                        <div className="flex flex-col gap-2 min-w-0">
                          <div className="text-sm font-semibold truncate">
                            {formatToolName(run.workflowName)}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Icon name="schedule" size={12} />
                            <span>{run.runId}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge
                              variant={getStatusBadgeVariant(run.status)}
                              className="text-xs"
                            >
                              {formatStatus(run.status)}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <div className="px-4 py-3 border-t border-border">
                        <span className="text-xs text-muted-foreground">
                          Started: {new Date(run.createdAt).toLocaleString()}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="w-fit min-w-full">
                <WorkflowRunsTableView
                  runs={sortedAndFilteredRuns}
                  onClick={handleRunClick}
                  sortKey={sortKey}
                  sortDirection={sortDirection}
                  onSort={handleSort}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function WorkflowRuns(props: WorkflowRunsProps) {
  return <WorkflowRunsContent {...props} />;
}
