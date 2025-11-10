import type { TableColumn } from "../common/table/index.tsx";
import {
  AgentInfo,
  TimeAgoCell,
  UserInfo,
} from "../common/table/table-cells.tsx";
import { buildThreadUri } from "../decopilot/thread-provider.tsx";

/**
 * Adapter to transform Thread (from audit events) to a format compatible with ResourcesV2List
 */
export function adaptThread(thread: {
  id: string;
  title?: string | null;
  resourceId?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  user?: { id: string; name?: string; email?: string } | null;
}): Record<string, unknown> {
  // Extract agentId from metadata or resourceId
  const agentId =
    (thread.metadata?.agentId as string) ||
    (thread.resourceId as string) ||
    undefined;

  return {
    id: thread.id,
    uri: buildThreadUri(thread.id),
    // For compatibility with ResourceListItem structure
    data: {
      name: thread.title || "Untitled thread",
      description: "",
    },
    created_at: thread.createdAt || new Date().toISOString(),
    updated_at:
      thread.updatedAt || thread.createdAt || new Date().toISOString(),
    created_by: thread.user?.id,
    updated_by: thread.user?.id,
    // Store agentId for custom column rendering
    agentId,
    // Store original thread for row actions
    _thread: thread,
  };
}

/**
 * Get columns for threads table - matches ResourcesV2List style
 */
export function getThreadsColumns(): TableColumn<Record<string, unknown>>[] {
  return [
    {
      id: "title",
      header: "Name",
      accessor: (row) => {
        const item = row as Record<string, unknown>;
        const data = item.data as Record<string, unknown> | undefined;
        return (data?.name as string) || "";
      },
      cellClassName: "max-w-3xs font-medium",
      sortable: true,
    },
    {
      id: "agent",
      header: "Agent",
      render: (row) => {
        const item = row as Record<string, unknown>;
        const agentId = item.agentId as string | undefined;
        return <AgentInfo agentId={agentId} />;
      },
      accessor: (row) => {
        const item = row as Record<string, unknown>;
        return (item.agentId as string) || "";
      },
      cellClassName: "max-w-3xs",
      sortable: true,
    },
    {
      id: "updated_at",
      header: "Updated",
      render: (row) => {
        const item = row as Record<string, unknown>;
        return <TimeAgoCell value={item.updated_at as string} />;
      },
      cellClassName: "whitespace-nowrap min-w-30",
      sortable: true,
    },
    {
      id: "updated_by",
      header: "Updated by",
      render: (row) => {
        const item = row as Record<string, unknown>;
        return (
          <UserInfo
            userId={item.updated_by as string}
            showEmail={false}
            size="sm"
          />
        );
      },
      cellClassName: "max-w-3xs",
      sortable: true,
    },
  ];
}
