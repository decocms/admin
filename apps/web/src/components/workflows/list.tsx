import { useWorkspaceWorkflows } from "@deco/sdk";
import { Badge } from "@deco/ui/components/badge.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import { Card, CardContent } from "@deco/ui/components/card.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { ScrollArea } from "@deco/ui/components/scroll-area.tsx";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@deco/ui/components/tooltip.tsx";
import { useViewMode } from "@deco/ui/hooks/use-view-mode.ts";
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { useNavigateWorkspace } from "../../hooks/use-navigate-workspace.ts";
import { EmptyState } from "../common/empty-state.tsx";
import { ListPageHeader } from "../common/list-page-header.tsx";
import { Table, type TableColumn } from "../common/table/index.tsx";
import type { Tab } from "../dock/index.tsx";
import { DefaultBreadcrumb, PageLayout } from "../layout.tsx";
import type { Workflow } from "./types.ts";
import { formatStatus, getStatusBadgeVariant, sortWorkflows } from "./utils.ts";
import { formatToolName } from "../chat/utils/format-tool-name.ts";

function WorkflowsCardView(
  { workflows, onClick }: {
    workflows: Workflow[];
    onClick: (workflow: Workflow) => void;
  },
) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 peer">
      {workflows.map((workflow) => (
        <Card
          key={workflow.workflowName}
          className="group cursor-pointer hover:shadow-md transition-shadow rounded-xl relative border-border"
          onClick={() => onClick(workflow)}
        >
          <CardContent className="p-0">
            <div className="grid grid-cols-[1fr_min-content] gap-4 items-start p-4">
              <div className="flex flex-col gap-2 min-w-0">
                <div className="text-sm font-semibold truncate">
                  {workflow.workflowName}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Icon name="play_circle" size={12} />
                  <span>{workflow.runCount} runs</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={getStatusBadgeVariant(workflow.lastRunStatus)}
                    className="text-xs"
                  >
                    {formatStatus(workflow.lastRunStatus)}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    Last run
                  </span>
                </div>
              </div>
            </div>
            <div className="px-4 py-3 border-t border-border">
              <span className="text-xs text-muted-foreground">
                Last run: {new Date(workflow.lastRunTimestamp).toLocaleString()}
              </span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function WorkflowsTableView(
  { workflows, onClick }: {
    workflows: Workflow[];
    onClick: (workflow: Workflow) => void;
  },
) {
  const [sortKey, setSortKey] = useState<string>("lastRun");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const sortedWorkflows = useMemo(() => {
    return sortWorkflows(workflows, sortKey, sortDirection);
  }, [workflows, sortKey, sortDirection]);

  const columns: TableColumn<Workflow>[] = [
    {
      id: "name",
      header: "Workflow Name",
      render: (workflow) => (
        <span className="font-semibold">
          {formatToolName(workflow.workflowName)}
        </span>
      ),
      sortable: true,
    },
    {
      id: "totalRuns",
      header: "Total Runs",
      render: (workflow) => (
        <div className="flex items-center gap-2">
          <Icon
            name="play_circle"
            size={14}
            className="text-muted-foreground"
          />
          <span className="text-sm">{workflow.runCount}</span>
        </div>
      ),
      sortable: true,
    },
    {
      id: "lastStatus",
      header: "Last Status",
      render: (workflow) => (
        <Badge variant={getStatusBadgeVariant(workflow.lastRunStatus)}>
          {formatStatus(workflow.lastRunStatus)}
        </Badge>
      ),
      sortable: true,
    },
    {
      id: "lastRun",
      header: "Last Run",
      render: (workflow) => (
        <span className="text-xs">
          {new Date(workflow.lastRunTimestamp).toLocaleString()}
        </span>
      ),
      sortable: true,
    },
  ];

  function handleSort(key: string) {
    if (sortKey === key) {
      setSortDirection((
        prev: "asc" | "desc",
      ) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDirection("asc");
    }
  }

  return (
    <Table
      columns={columns}
      data={sortedWorkflows}
      sortKey={sortKey}
      sortDirection={sortDirection}
      onSort={handleSort}
      onRowClick={onClick}
    />
  );
}

function WorkflowsTab() {
  const [_searchParams, _setSearchParams] = useSearchParams();
  const [viewMode, setViewMode] = useViewMode("workflows-list");
  const [filter, setFilter] = useState("");
  const { data, refetch, isRefetching } = useWorkspaceWorkflows();
  const navigateWorkspace = useNavigateWorkspace();

  const workflows = data.workflows;

  const filteredWorkflows = useMemo(() => {
    if (!filter) return workflows;
    return workflows.filter((w) =>
      w.workflowName.toLowerCase().includes(filter.toLowerCase())
    );
  }, [workflows, filter]);

  // Sort workflows by default (Last Run, newest first) for card view consistency
  const sortedAndFilteredWorkflows = useMemo(() => {
    return sortWorkflows(filteredWorkflows, "lastRun", "desc");
  }, [filteredWorkflows]);

  function handleWorkflowClick(workflow: Workflow) {
    navigateWorkspace(
      `/workflows/${encodeURIComponent(workflow.workflowName)}`,
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col gap-4 h-full py-4">
        <div className="px-4 overflow-x-auto">
          <div className="flex items-center gap-2 mb-4">
            <ListPageHeader
              input={{
                placeholder: "Search workflows",
                value: filter,
                onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
                  setFilter(e.target.value),
              }}
              view={{ viewMode, onChange: setViewMode }}
            />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => refetch()}
                  disabled={isRefetching}
                  className="h-10 w-10"
                >
                  <Icon
                    name="refresh"
                    size={16}
                    className={isRefetching ? "animate-spin" : ""}
                  />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                Refresh
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
        <div className="flex-1 min-h-0 px-4 overflow-x-auto">
          {sortedAndFilteredWorkflows.length === 0
            ? (
              <div className="flex flex-1 min-h-[700px] items-center justify-center">
                <EmptyState
                  icon="work"
                  title="No workflows found"
                  description={filter
                    ? "No workflows match your search criteria."
                    : "No workflows have been created yet."}
                />
              </div>
            )
            : (
              viewMode === "cards"
                ? (
                  <WorkflowsCardView
                    workflows={sortedAndFilteredWorkflows}
                    onClick={handleWorkflowClick}
                  />
                )
                : (
                  <WorkflowsTableView
                    workflows={sortedAndFilteredWorkflows}
                    onClick={handleWorkflowClick}
                  />
                )
            )}
        </div>
      </div>
    </ScrollArea>
  );
}

const tabs: Record<string, Tab> = {
  workflows: {
    Component: WorkflowsTab,
    title: "Workflows",
    active: true,
    initialOpen: true,
  },
};

function WorkflowListPage() {
  return (
    <PageLayout
      hideViewsButton
      tabs={tabs}
      breadcrumb={<DefaultBreadcrumb items={[{ label: "Workflows" }]} />}
    />
  );
}

export default WorkflowListPage;
