import { useWorkflows } from "@deco/sdk";
import type { Button } from "@deco/ui/components/button.tsx";
import { Card, CardContent } from "@deco/ui/components/card.tsx";
import { type Link, useSearchParams } from "react-router";
import {
  useNavigateWorkspace,
  useWorkspaceLink,
} from "../../hooks/use-navigate-workspace.ts";
import type { Tab } from "../dock/index.tsx";
import { DefaultBreadcrumb, PageLayout } from "../layout.tsx";
import { ScrollArea } from "@deco/ui/components/scroll-area.tsx";
import { ListPageHeader } from "../common/list-page-header.tsx";
import { EmptyState } from "../common/empty-state.tsx";
import { useMemo, useState } from "react";
import { Table, type TableColumn } from "../common/table/index.tsx";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@deco/ui/components/pagination.tsx";

function WorkflowsCardView(
  { workflows, onClick }: {
    workflows: any[];
    onClick: (workflow: any) => void;
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
              <div className="flex flex-col gap-0 min-w-0">
                <div className="text-sm font-semibold truncate">
                  {workflow.workflowName}
                </div>
                <div className="text-sm text-muted-foreground line-clamp-1">
                  Created: {new Date(workflow.created_on).toLocaleString()}
                </div>
              </div>
            </div>
            <div className="px-4 py-3 border-t border-border">
              <span className="text-xs text-muted-foreground">
                Modified: {new Date(workflow.modified_on).toLocaleString()}
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
    workflows: any[];
    onClick: (workflow: any) => void;
  },
) {
  const [sortKey, setSortKey] = useState<string>("workflowName");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  function getSortValue(row: any, key: string): string {
    if (key === "created_on") return row.created_on || "";
    if (key === "modified_on") return row.modified_on || "";
    return row.workflowName?.toLowerCase() || "";
  }

  const sortedWorkflows = [...workflows].sort((a, b) => {
    const aVal = getSortValue(a, sortKey);
    const bVal = getSortValue(b, sortKey);
    if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
    if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
    return 0;
  });

  const columns: TableColumn<any>[] = [
    {
      id: "workflowName",
      header: "Name",
      render: (workflow) => (
        <span className="font-semibold">{workflow.workflowName}</span>
      ),
      sortable: true,
    },
    {
      id: "created_on",
      header: "Created",
      render: (workflow) => (
        <span className="text-xs">
          {new Date(workflow.created_on).toLocaleString()}
        </span>
      ),
      sortable: true,
    },
    {
      id: "modified_on",
      header: "Modified",
      render: (workflow) => (
        <span className="text-xs">
          {new Date(workflow.modified_on).toLocaleString()}
        </span>
      ),
      sortable: true,
    },
  ];

  function handleSort(key: string) {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
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
  const [searchParams, setSearchParams] = useSearchParams();
  const [viewMode, setViewMode] = useState<"cards" | "table">("table");
  const [filter, setFilter] = useState("");
  const page = Number(searchParams.get("page") || 1);
  const per_page = Number(searchParams.get("per_page") || 10);
  const { data } = useWorkflows(page, per_page);
  const workspaceLink = useWorkspaceLink();
  const navigateWorkspace = useNavigateWorkspace();

  const filteredWorkflows = useMemo(() => {
    if (!filter) return data.workflows;
    return data.workflows.filter((w: any) =>
      w.workflowName.toLowerCase().includes(filter.toLowerCase())
    );
  }, [data.workflows, filter]);

  function handlePageChange(newPage: number) {
    setSearchParams({ page: String(newPage), per_page: String(per_page) });
  }

  function handleWorkflowClick(workflow: any) {
    navigateWorkspace(`workflows/${encodeURIComponent(workflow.workflowName)}`);
  }

  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col gap-4 h-full py-4">
        <div className="px-4 overflow-x-auto">
          <ListPageHeader
            input={{
              placeholder: "Search workflow",
              value: filter,
              onChange: (e) => setFilter(e.target.value),
            }}
            view={{ viewMode, onChange: setViewMode }}
          />
        </div>
        <div className="flex-1 min-h-0 px-4 overflow-x-auto">
          {filteredWorkflows.length === 0
            ? (
              <EmptyState
                icon="conversion_path"
                title="No workflows yet"
                description="Create and deploy a workflow to see it here."
              />
            )
            : viewMode === "cards"
            ? (
              <WorkflowsCardView
                workflows={filteredWorkflows}
                onClick={handleWorkflowClick}
              />
            )
            : (
              <WorkflowsTableView
                workflows={filteredWorkflows}
                onClick={handleWorkflowClick}
              />
            )}
        </div>
        <div className="mt-6 flex items-center justify-center gap-2">
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    if (page > 1) handlePageChange(page - 1);
                  }}
                  aria-disabled={page <= 1}
                  tabIndex={page <= 1 ? -1 : 0}
                  className={page <= 1 ? "opacity-50 pointer-events-none" : ""}
                />
              </PaginationItem>
              <PaginationItem>
                <span className="px-2 text-sm">Page {page}</span>
              </PaginationItem>
              <PaginationItem>
                <PaginationNext
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    if (filteredWorkflows.length >= per_page) {
                      handlePageChange(
                        page + 1,
                      );
                    }
                  }}
                  aria-disabled={filteredWorkflows.length < per_page}
                  tabIndex={filteredWorkflows.length < per_page ? -1 : 0}
                  className={filteredWorkflows.length < per_page
                    ? "opacity-50 pointer-events-none"
                    : ""}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
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

export function WorkflowListPage() {
  return (
    <PageLayout
      hideViewsButton
      tabs={tabs}
      breadcrumb={
        <DefaultBreadcrumb
          items={[
            { label: "Workflows", link: "/workflows" },
          ]}
        />
      }
    />
  );
}

export default WorkflowListPage;
