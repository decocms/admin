import type { Agent } from "@deco/sdk";
import type { TableColumn } from "../common/table/index.tsx";
import { TimeAgoCell, UserInfo } from "../common/table/table-cells.tsx";
import type { CustomRowAction } from "../resources-v2/list.tsx";
import { buildAgentUri } from "../decopilot/thread-context-manager.tsx";
import type { PinnedTabInput } from "../../hooks/use-pinned-tabs.ts";

/**
 * Adapter to transform Agent to a format compatible with ResourcesV2List
 * Uses a new thread ID for opening agents
 */
export function adaptAgent(agent: Agent): Record<string, unknown> {
  // Generate a new thread ID for opening the agent (same pattern as AgentCard)
  const threadId = crypto.randomUUID();
  return {
    id: agent.id,
    uri: buildAgentUri(agent.id, threadId),
    // For compatibility with ResourceListItem structure
    data: {
      name: agent.name || "Untitled agent",
      description: agent.description || "",
    },
    // Add thumbnail for default card rendering
    thumbnail: agent.avatar,
    created_at: new Date().toISOString(), // Agents don't have timestamps in the type
    updated_at: new Date().toISOString(),
    // Store original agent for row actions
    _agent: agent,
  };
}

/**
 * Get columns for agents table - matches ResourcesV2List style
 */
export function getAgentsColumns(): TableColumn<Record<string, unknown>>[] {
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
      id: "description",
      header: "Description",
      accessor: (row) => {
        const item = row as Record<string, unknown>;
        const data = item.data as Record<string, unknown> | undefined;
        return (data?.description as string) || "";
      },
      cellClassName: "max-w-xl",
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

/**
 * Get custom row actions for agents (pin, duplicate, delete)
 */
export function getAgentRowActions(
  onDuplicate: (agent: Agent) => void,
  onDelete: (agent: Agent) => void,
  isPinned: (resourceUri: string) => boolean,
  togglePin: (tab: PinnedTabInput) => void,
): (item: Record<string, unknown>) => CustomRowAction[] {
  return (item: Record<string, unknown>) => {
    const agent = (item._agent as Agent) || (item as unknown as Agent);

    const actions: CustomRowAction[] = [
      {
        label: "Duplicate",
        icon: "content_copy",
        onClick: () => onDuplicate(agent),
      },
      {
        label: "Delete",
        icon: "delete",
        variant: "destructive",
        onClick: () => onDelete(agent),
      },
    ];

    return actions;
  };
}
