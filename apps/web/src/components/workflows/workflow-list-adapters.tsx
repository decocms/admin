import type { TriggerOutput } from "@deco/sdk";
import { Badge } from "@deco/ui/components/badge.tsx";
import { Card, CardContent } from "@deco/ui/components/card.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import type { ReactNode } from "react";
import type { TableColumn } from "../common/table/index.tsx";
import { TimeAgoCell, UserInfo } from "../common/table/table-cells.tsx";
import type { CustomRowAction } from "../resources-v2/list.tsx";
import { buildTriggerUri } from "../decopilot/thread-context-manager.tsx";
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

/**
 * Render workflow run card
 */
export function renderWorkflowRunCard(
  item: Record<string, unknown>,
  onClick: (item: Record<string, unknown>) => void,
): ReactNode {
  const run = item as unknown as WorkflowRun;

  return (
    <Card
      key={run.runId}
      className="group cursor-pointer hover:shadow-md transition-shadow rounded-xl relative border-border"
      onClick={() => onClick(item)}
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
  );
}
