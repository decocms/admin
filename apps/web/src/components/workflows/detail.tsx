import { useParams, useSearchParams } from "react-router";
import { useWorkflowInstances } from "@deco/sdk";
import { Card, CardContent } from "@deco/ui/components/card.tsx";
import { DefaultBreadcrumb, PageLayout } from "../layout.tsx";
import type { Tab } from "../dock/index.tsx";
import { ScrollArea } from "@deco/ui/components/scroll-area.tsx";
import { useMemo, useState } from "react";
import { Table, type TableColumn } from "../common/table/index.tsx";
import { ListPageHeader } from "../common/list-page-header.tsx";
import { EmptyState } from "../common/empty-state.tsx";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@deco/ui/components/pagination.tsx";
import { useNavigateWorkspace } from "../../hooks/use-navigate-workspace.ts";

function InstancesCardView(
  { instances, onClick }: {
    instances: any[];
    onClick: (instance: any) => void;
  },
) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 peer">
      {instances.map((instance) => (
        <Card
          key={instance.instanceId}
          className="group cursor-pointer hover:shadow-md transition-shadow rounded-xl relative border-border"
          onClick={() => onClick(instance)}
        >
          <CardContent className="p-0">
            <div className="grid grid-cols-[1fr_min-content] gap-4 items-start p-4">
              <div className="flex flex-col gap-0 min-w-0">
                <div className="text-sm font-semibold truncate">
                  Instance ID: {instance.instanceId}
                </div>
                <div className="text-sm text-muted-foreground line-clamp-1">
                  Status: {instance.status}
                </div>
                <div className="text-xs text-muted-foreground line-clamp-1">
                  Created: {new Date(instance.created_on).toLocaleString()}
                </div>
                {instance.ended_on && (
                  <div className="text-xs text-muted-foreground line-clamp-1">
                    Ended: {new Date(instance.ended_on).toLocaleString()}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function InstancesTableView(
  { instances, onClick }: {
    instances: any[];
    onClick: (instance: any) => void;
  },
) {
  const [sortKey, setSortKey] = useState<string>("created_on");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  function getSortValue(row: any, key: string): string {
    if (key === "created_on") return row.created_on || "";
    if (key === "ended_on") return row.ended_on || "";
    if (key === "status") return row.status || "";
    return row.instanceId?.toLowerCase() || "";
  }

  const sortedInstances = [...instances].sort((a, b) => {
    const aVal = getSortValue(a, sortKey);
    const bVal = getSortValue(b, sortKey);
    if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
    if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
    return 0;
  });

  const columns: TableColumn<any>[] = [
    {
      id: "instanceId",
      header: "Instance ID",
      render: (instance) => (
        <span className="font-semibold">{instance.instanceId}</span>
      ),
      sortable: true,
    },
    {
      id: "status",
      header: "Status",
      render: (instance) => <span className="text-xs">{instance.status}</span>,
      sortable: true,
    },
    {
      id: "created_on",
      header: "Created",
      render: (instance) => (
        <span className="text-xs">
          {new Date(instance.created_on).toLocaleString()}
        </span>
      ),
      sortable: true,
    },
    {
      id: "ended_on",
      header: "Ended",
      render: (instance) => (
        <span className="text-xs">
          {instance.ended_on
            ? new Date(instance.ended_on).toLocaleString()
            : "-"}
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
      data={sortedInstances}
      sortKey={sortKey}
      sortDirection={sortDirection}
      onSort={handleSort}
      onRowClick={onClick}
    />
  );
}

function InstancesTab() {
  const { workflowName = "" } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [viewMode, setViewMode] = useState<"cards" | "table">("table");
  const [filter, setFilter] = useState("");
  const page = Number(searchParams.get("page") || 1);
  const per_page = Number(searchParams.get("per_page") || 10);
  const { data } = useWorkflowInstances(workflowName, page, per_page);
  const navigateWorkspace = useNavigateWorkspace();

  const filteredInstances = useMemo(() => {
    if (!filter) return data.instances;
    return data.instances.filter((i: any) =>
      i.instanceId.toLowerCase().includes(filter.toLowerCase())
    );
  }, [data.instances, filter]);

  function handlePageChange(newPage: number) {
    setSearchParams({ page: String(newPage), per_page: String(per_page) });
  }

  function handleInstanceClick(instance: any) {
    navigateWorkspace(
      `workflows/${encodeURIComponent(workflowName)}/instances/${
        encodeURIComponent(instance.instanceId)
      }`,
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col gap-4 h-full py-4">
        <div className="px-4 overflow-x-auto">
          <ListPageHeader
            input={{
              placeholder: "Search instance",
              value: filter,
              onChange: (e) => setFilter(e.target.value),
            }}
            view={{ viewMode, onChange: setViewMode }}
          />
        </div>
        <div className="flex-1 min-h-0 px-4 overflow-x-auto">
          {filteredInstances.length === 0
            ? (
              <EmptyState
                icon="conversion_path"
                title="No instances yet"
                description="No workflow instances found."
              />
            )
            : viewMode === "cards"
            ? (
              <InstancesCardView
                instances={filteredInstances}
                onClick={handleInstanceClick}
              />
            )
            : (
              <InstancesTableView
                instances={filteredInstances}
                onClick={handleInstanceClick}
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
                    if (filteredInstances.length >= per_page) {
                      handlePageChange(
                        page + 1,
                      );
                    }
                  }}
                  aria-disabled={filteredInstances.length < per_page}
                  tabIndex={filteredInstances.length < per_page ? -1 : 0}
                  className={filteredInstances.length < per_page
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
  instances: {
    Component: InstancesTab,
    title: "Instances",
    active: true,
    initialOpen: true,
  },
};

export function WorkflowDetailPage() {
  const { workflowName = "" } = useParams();
  return (
    <PageLayout
      hideViewsButton
      tabs={tabs}
      breadcrumb={
        <DefaultBreadcrumb
          items={[
            { label: "Workflows", link: "/workflows" },
            { label: workflowName },
          ]}
        />
      }
    />
  );
}

export default WorkflowDetailPage;
