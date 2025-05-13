import { Table, TableColumn } from "../common/Table.tsx";
import { AgentInfo, DateTimeCell, UserInfo } from "../common/TableCells.tsx";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@deco/ui/components/tooltip.tsx";

interface AuditTableProps {
  threads: Array<{
    id: string;
    resourceId: string;
    title: string;
    metadata: { agentId: string };
    createdAt: string;
    updatedAt: string;
  }>;
  sort: string;
  onSortChange: (sort: string) => void;
  onRowClick?: (threadId: string) => void;
}

function getSortKeyAndDirection(
  sort: string,
): { key: string; direction: "asc" | "desc" } {
  if (sort.endsWith("_asc")) {
    return { key: sort.replace(/_asc$/, ""), direction: "asc" };
  }
  return { key: sort.replace(/_desc$/, ""), direction: "desc" };
}

export function AuditTable(
  { threads, sort, onSortChange, onRowClick }: AuditTableProps,
) {
  const { key: sortKey, direction: sortDirection } = getSortKeyAndDirection(
    sort,
  );

  const columns: TableColumn<(typeof threads)[number]>[] = [
    {
      id: "updatedAt",
      header: "Last updated",
      accessor: (row) => <DateTimeCell value={row.updatedAt} />,
      sortable: true,
    },
    {
      id: "createdAt",
      header: "Created at",
      accessor: (row) => <DateTimeCell value={row.createdAt} />,
      sortable: true,
    },
    {
      id: "agent",
      header: "Agent",
      accessor: (row) => <AgentInfo agentId={row.metadata.agentId} />,
    },
    {
      id: "user",
      header: "Used by",
      accessor: (row) => <UserInfo userId={row.resourceId} />,
    },
    {
      id: "title",
      header: "Thread name",
      render: (row) => (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="truncate block max-w-xs">{row.title}</span>
          </TooltipTrigger>
          <TooltipContent className="whitespace-pre-line break-words max-w-xs">
            {row.title}
          </TooltipContent>
        </Tooltip>
      ),
    },
  ];

  function handleSort(colId: string) {
    if (colId === "updatedAt") {
      onSortChange(
        sort === "updatedAt_desc" ? "updatedAt_asc" : "updatedAt_desc",
      );
    } else if (colId === "createdAt") {
      onSortChange(
        sort === "createdAt_desc" ? "createdAt_asc" : "createdAt_desc",
      );
    }
  }

  return (
    <Table
      columns={columns}
      data={threads}
      sortKey={sortKey}
      sortDirection={sortDirection}
      onSort={handleSort}
      onRowClick={onRowClick ? (row) => onRowClick(row.id) : undefined}
    />
  );
}
