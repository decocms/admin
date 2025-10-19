import { useRecentWorkflowRuns, useWorkflowRuns, useSDK } from "@deco/sdk";
import { Badge } from "@deco/ui/components/badge.tsx";
import { Card, CardContent } from "@deco/ui/components/card.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigateWorkspace } from "../../hooks/use-navigate-workspace.ts";
import { formatToolName } from "../chat/utils/format-tool-name.ts";
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

function WorkflowRunsTableView({
  runs,
  onClick,
}: {
  runs: WorkflowRun[];
  onClick: (run: WorkflowRun) => void;
}) {
  const [sortKey, setSortKey] = useState<string>("createdAt");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

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
    if (sortKey === key) {
      setSortDirection((prev: "asc" | "desc") =>
        prev === "asc" ? "desc" : "asc",
      );
    } else {
      setSortKey(key);
      setSortDirection("asc");
    }
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
}

function WorkflowRunsContent({
  searchTerm = "",
  viewMode = "cards",
}: WorkflowRunsProps) {
  const [_searchParams, _setSearchParams] = useSearchParams();
  const [selectedWorkflow, _setSelectedWorkflow] = useState<string>("all");
  const navigateWorkspace = useNavigateWorkspace();
  const { locator } = useSDK();
  const queryClient = useQueryClient();

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
          queryKey: ["workflow-runs", locator],
        });
        queryClient.invalidateQueries({
          queryKey: ["recent-workflow-runs", locator],
        });
      },
      [locator, queryClient],
    ),
  });

  // Get workflow runs - either filtered by workflow name or all recent runs
  const {
    data,
    refetch: _refetch,
    isRefetching: _isRefetching,
  } = selectedWorkflow !== "all"
    ? useWorkflowRuns(selectedWorkflow, 1, 25)
    : useRecentWorkflowRuns(1, 25);

  const runs = data?.runs || [];

  const filteredRuns = useMemo(() => {
    if (!searchTerm) return runs;
    return runs.filter(
      (run) =>
        run.workflowName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        run.runId.toLowerCase().includes(searchTerm.toLowerCase()),
    );
  }, [runs, searchTerm]);

  // Sort runs by default (Created At, newest first) for card view consistency
  const sortedAndFilteredRuns = useMemo(() => {
    return sortWorkflowRuns(filteredRuns, "createdAt", "desc");
  }, [filteredRuns]);

  function handleRunClick(run: WorkflowRun) {
    navigateWorkspace(
      `/workflow-runs/${encodeURIComponent(run.workflowName)}/instances/${encodeURIComponent(
        run.runId,
      )}`,
    );
  }

  return (
    <>
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
          />
        </div>
      )}
    </>
  );
}

export default function WorkflowRuns(props: WorkflowRunsProps) {
  return <WorkflowRunsContent {...props} />;
}
