import type { TriggerOutput } from "@deco/sdk";
import { Badge } from "@deco/ui/components/badge.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import type { TableColumn } from "@deco/ui/components/resource-table.tsx";
import { TimeAgoCell, UserInfo } from "../common/table/table-cells.tsx";
import type { CustomRowAction } from "../resources-v2/list.tsx";
import { buildTriggerUri } from "../decopilot/thread-provider.tsx";
import { formatToolName } from "../chat/utils/format-tool-name.ts";
import { formatStatus, getStatusBadgeVariant } from "./utils.ts";
import type { WorkflowRun } from "./types.ts";

/**
 * Adapter to transform WorkflowRun to a format compatible with ResourcesV2List
 */
export function adaptWorkflowRun(run: WorkflowRun): Record<string, unknown> {
  return {
    id: run.runId,
    uri: `legacy-workflow-run://${run.workflowName}/${run.runId}`,
    workflowName: run.workflowName,
    runId: run.runId,
    status: run.status,
    createdAt: run.createdAt,
    updatedAt: run.updatedAt,
    // For compatibility with ResourceListItem structure
    data: {
      name: formatToolName(run.workflowName),
      description: `Run ID: ${run.runId}`,
    },
    created_at: new Date(run.createdAt).toISOString(),
    updated_at: run.updatedAt
      ? new Date(run.updatedAt).toISOString()
      : new Date(run.createdAt).toISOString(),
  };
}

/**
 * Adapter to transform TriggerOutput to a format compatible with ResourcesV2List
 */
export function adaptTrigger(trigger: TriggerOutput): Record<string, unknown> {
  const isActive = trigger.active ?? false;
  const statusText = isActive ? "(active)" : "(disabled)";
  const baseDescription = trigger.data.description || "";
  const descriptionWithStatus = baseDescription
    ? `${baseDescription} ${statusText}`
    : statusText;

  return {
    id: trigger.id,
    uri: buildTriggerUri(trigger.id),
    triggerId: trigger.id,
    title: trigger.data.title,
    type: trigger.data.type,
    active: trigger.active ?? false,
    createdAt: trigger.createdAt,
    user: trigger.user,
    // For compatibility with ResourceListItem structure
    data: {
      name: trigger.data.title || "Untitled Trigger",
      description: descriptionWithStatus,
    },
    created_at: trigger.createdAt,
    updated_at: trigger.updatedAt || trigger.createdAt,
    created_by: trigger.user?.id,
    updated_by: trigger.user?.id,
    // Store original trigger for row actions
    _trigger: trigger,
  };
}

/**
 * Get columns for workflow runs table
 */
export function getWorkflowRunsColumns(): TableColumn<
  Record<string, unknown>
>[] {
  return [
    {
      id: "workflowName",
      header: "Workflow Name",
      render: (row) => (
        <span className="font-semibold">
          {formatToolName(String(row.workflowName || ""))}
        </span>
      ),
      sortable: true,
    },
    {
      id: "runId",
      header: "Run ID",
      render: (row) => (
        <div className="flex items-center gap-2">
          <Icon name="schedule" size={14} className="text-muted-foreground" />
          <span className="text-xs font-mono">{String(row.runId || "")}</span>
        </div>
      ),
      sortable: true,
    },
    {
      id: "status",
      header: "Status",
      render: (row) => (
        <Badge variant={getStatusBadgeVariant(String(row.status || ""))}>
          {formatStatus(String(row.status || ""))}
        </Badge>
      ),
      sortable: true,
    },
    {
      id: "createdAt",
      header: "Started",
      render: (row) => (
        <span className="text-xs">
          {row.createdAt
            ? new Date(Number(row.createdAt)).toLocaleString()
            : "-"}
        </span>
      ),
      sortable: true,
    },
    {
      id: "updatedAt",
      header: "Updated",
      render: (row) => (
        <span className="text-xs">
          {row.updatedAt
            ? new Date(Number(row.updatedAt)).toLocaleString()
            : "-"}
        </span>
      ),
      sortable: true,
    },
  ];
}

/**
 * Get columns for triggers table - matches ResourcesV2List style
 */
export function getTriggersColumns(): TableColumn<Record<string, unknown>>[] {
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
 * Get custom row actions for triggers (activate/deactivate, edit, delete)
 * Activate/deactivate is the first action in the more_horiz menu
 */
export function getTriggerRowActions(
  onToggle: (trigger: TriggerOutput) => void,
  onEdit?: (trigger: TriggerOutput) => void,
  onDelete?: (trigger: TriggerOutput) => void,
): (item: Record<string, unknown>) => CustomRowAction[] {
  return (item: Record<string, unknown>) => {
    // Get the original trigger from the adapted item
    // The adaptTrigger function stores the original trigger in _trigger
    const trigger = item._trigger as TriggerOutput | undefined;

    // If trigger is not available, return empty actions
    if (!trigger) {
      return [];
    }

    const isActive = trigger.active ?? false;

    const actions: CustomRowAction[] = [
      {
        label: isActive ? "Deactivate" : "Activate",
        icon: isActive ? "toggle_off" : "toggle_on",
        onClick: () => onToggle(trigger),
      },
    ];

    if (onEdit) {
      actions.push({
        label: "Edit",
        icon: "edit",
        onClick: () => onEdit(trigger),
      });
    }

    if (onDelete) {
      actions.push({
        label: "Delete",
        icon: "delete",
        variant: "destructive",
        onClick: () => onDelete(trigger),
      });
    }

    return actions;
  };
}

/**
 * Render trigger card - removed, using default ResourcesV2List card instead
 */
