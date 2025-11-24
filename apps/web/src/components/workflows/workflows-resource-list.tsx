import { useEffect, useMemo, useState, useCallback } from "react";
import { useSearchParams } from "react-router";
import { useDecopilotOpen } from "../layout/decopilot-layout.tsx";
import { ResourcesV2List } from "../resources-v2/list.tsx";
import {
  useWorkflowRuns,
  useListTriggers,
  useActivateTrigger,
  useDeactivateTrigger,
} from "@deco/sdk";
import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { TabActionButton } from "../canvas/tab-action-button.tsx";
import { useHideLegacyFeatures } from "../../hooks/use-hide-legacy-features.ts";
import { useThread, buildTriggerUri } from "../decopilot/thread-provider.tsx";
import type { TriggerOutput } from "@deco/sdk";
import {
  adaptWorkflowRun,
  adaptTrigger,
  getWorkflowRunsColumns,
  getTriggersColumns,
  getTriggerRowActions,
} from "./workflow-list-adapters.tsx";
import { TriggerModal } from "../triggers/trigger-dialog.tsx";
import { DeleteTriggerModal } from "../triggers/delete-trigger-dialog.tsx";
import { toast } from "@deco/ui/components/sonner.tsx";
import { useQueryClient } from "@tanstack/react-query";
import { KEYS } from "@deco/sdk";
import { useSDK } from "@deco/sdk";
import type { CustomRowAction } from "../resources-v2/list.tsx";
import type { ResourceListItem } from "../resources-v2/list.tsx";

/**
 * Workflows resource list component that renders the ResourcesV2List
 * with the specific integration ID for workflows management
 */
export function WorkflowsResourceList({
  resourceName = "workflow",
}: {
  resourceName?: "workflow" | "workflow_run";
} = {}) {
  const [searchParams] = useSearchParams();
  const { setOpen: setDecopilotOpen } = useDecopilotOpen();
  const { showLegacyFeature } = useHideLegacyFeatures();

  // State-based tab management
  const [activeTab, setActiveTab] = useState<string>("workflows");

  // Build tabs array
  const tabs = useMemo(() => {
    const allTabs = [
      {
        id: "workflows",
        label: "Workflows",
        onClick: () => setActiveTab("workflows"),
      },
      {
        id: "runs",
        label: "Runs",
        onClick: () => setActiveTab("runs"),
      },
    ];

    if (showLegacyFeature("showLegacyWorkflowRuns")) {
      allTabs.push({
        id: "runs-legacy",
        label: "Runs (legacy)",
        onClick: () => setActiveTab("runs-legacy"),
      });
    }

    allTabs.push({
      id: "triggers",
      label: "Triggers",
      onClick: () => setActiveTab("triggers"),
    });

    return allTabs;
  }, [showLegacyFeature]);

  // Automatically open Decopilot if openDecopilot query param is present
  useEffect(() => {
    const openDecopilot = searchParams.get("openDecopilot") === "true";
    if (openDecopilot) {
      setDecopilotOpen(true);
    }
  }, [searchParams, setDecopilotOpen]);

  // Determine the correct resourceName based on active tab
  // MUST be called before any conditional returns to follow Rules of Hooks
  const effectiveResourceName = useMemo(() => {
    if (activeTab === "runs") {
      return "workflow_run";
    }
    return resourceName;
  }, [activeTab, resourceName]);

  // Fetch workflow runs data for runs-legacy tab
  const { data: workflowRunsData, refetch: refetchWorkflowRuns } =
    useWorkflowRuns("", 1, 25);

  // Fetch triggers data for triggers tab
  const { data: triggersData } = useListTriggers();
  const { locator } = useSDK();
  const queryClient = useQueryClient();
  const { createTab, addTab } = useThread();
  const { mutate: activateTrigger } = useActivateTrigger();
  const { mutate: deactivateTrigger } = useDeactivateTrigger();
  const [isCreateTriggerModalOpen, setIsCreateTriggerModalOpen] =
    useState(false);
  const [editingTrigger, setEditingTrigger] = useState<TriggerOutput | null>(
    null,
  );
  const [deletingTrigger, setDeletingTrigger] = useState<TriggerOutput | null>(
    null,
  );

  // Handle workflow run click
  const handleWorkflowRunClick = useCallback(
    (item: Record<string, unknown>) => {
      const uri = String(item.uri || "");
      const title = String(item.workflowName || "");
      createTab({
        type: "detail",
        resourceUri: uri,
        title: title,
        icon: "flowchart",
      });
    },
    [createTab],
  );

  // Handle trigger click
  const handleTriggerClick = useCallback(
    (item: Record<string, unknown>) => {
      const trigger = item as unknown as TriggerOutput;
      if (addTab) {
        addTab({
          type: "detail",
          resourceUri: buildTriggerUri(trigger.id),
          title: trigger.data.title || "Trigger",
          icon: "cable",
        });
      }
    },
    [addTab],
  );

  // Handle trigger toggle
  const handleTriggerToggle = useCallback(
    (trigger: TriggerOutput) => {
      const isActive = trigger.active ?? false;
      if (!isActive) {
        activateTrigger(trigger.id, {
          onSuccess: () => {
            toast.success("Trigger activated");
            queryClient.invalidateQueries({
              queryKey: KEYS.TRIGGERS(locator),
            });
          },
          onError: () => {
            toast.error("Failed to activate trigger");
          },
        });
      } else {
        deactivateTrigger(trigger.id, {
          onSuccess: () => {
            toast.success("Trigger deactivated");
            queryClient.invalidateQueries({
              queryKey: KEYS.TRIGGERS(locator),
            });
          },
          onError: () => {
            toast.error("Failed to deactivate trigger");
          },
        });
      }
    },
    [activateTrigger, deactivateTrigger, queryClient, locator],
  );

  // Handle trigger edit
  const handleTriggerEdit = useCallback((trigger: TriggerOutput) => {
    setEditingTrigger(trigger);
  }, []);

  // Handle trigger delete
  const handleTriggerDelete = useCallback((trigger: TriggerOutput) => {
    setDeletingTrigger(trigger);
  }, []);

  // Prepare workflow runs data
  const workflowRunsItems = useMemo(() => {
    if (activeTab !== "runs-legacy" || !workflowRunsData?.runs) return [];
    return workflowRunsData.runs.map(adaptWorkflowRun);
  }, [activeTab, workflowRunsData]);

  // Prepare triggers data
  const triggersItems = useMemo(() => {
    if (activeTab !== "triggers" || !triggersData?.triggers) return [];
    return (triggersData.triggers as TriggerOutput[]).map(adaptTrigger);
  }, [activeTab, triggersData]);

  // Create default row actions for workflows (empty for now)
  // MUST be called before any conditional returns to follow Rules of Hooks
  const workflowRowActions = useCallback(
    (_item: ResourceListItem | Record<string, unknown>): CustomRowAction[] => {
      // No row actions for workflows
      return [];
    },
    [],
  );

  // Render workflow runs (legacy) using ResourcesV2List
  if (activeTab === "runs-legacy") {
    return (
      <>
        <TabActionButton>
          <Button
            variant="ghost"
            size="xs"
            onClick={() => refetchWorkflowRuns()}
            className="size-6 p-0"
          >
            <Icon name="refresh" className="text-muted-foreground" />
          </Button>
        </TabActionButton>
        <ResourcesV2List
          integrationId="i:workflows-management"
          resourceName="workflow"
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={(tabId) => setActiveTab(tabId)}
          customData={workflowRunsItems}
          customColumns={getWorkflowRunsColumns()}
          onItemClick={handleWorkflowRunClick}
          customEmptyState={{
            icon: "flowchart",
            title: "No workflow runs found",
            description: "No workflow runs match your search criteria.",
          }}
        />
      </>
    );
  }

  // Render triggers using ResourcesV2List
  if (activeTab === "triggers") {
    const newTriggerButton = (
      <Button
        variant="default"
        size="sm"
        onClick={() => setIsCreateTriggerModalOpen(true)}
      >
        <Icon name="add" />
        New trigger
      </Button>
    );

    return (
      <>
        {isCreateTriggerModalOpen && (
          <TriggerModal
            isOpen={isCreateTriggerModalOpen}
            onOpenChange={setIsCreateTriggerModalOpen}
          />
        )}

        {editingTrigger && (
          <TriggerModal
            trigger={editingTrigger}
            isOpen={!!editingTrigger}
            onOpenChange={(open) => {
              if (!open) setEditingTrigger(null);
            }}
          />
        )}

        {deletingTrigger && (
          <DeleteTriggerModal
            trigger={deletingTrigger}
            open={!!deletingTrigger}
            onOpenChange={(open) => {
              if (!open) setDeletingTrigger(null);
            }}
          />
        )}

        <ResourcesV2List
          integrationId="i:workflows-management"
          resourceName="workflow"
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={(tabId) => setActiveTab(tabId)}
          customData={triggersItems}
          customColumns={getTriggersColumns()}
          customRowActions={getTriggerRowActions(
            handleTriggerToggle,
            handleTriggerEdit,
            handleTriggerDelete,
          )}
          onItemClick={handleTriggerClick}
          customCtaButton={newTriggerButton}
          customEmptyState={{
            icon: "cable",
            title: "No triggers yet",
            description:
              "Create your first trigger to automate your agent workflows and respond to events automatically.",
          }}
        />
      </>
    );
  }

  // Render workflows using ResourcesV2List (default MCP resources)
  return (
    <ResourcesV2List
      integrationId="i:workflows-management"
      resourceName={effectiveResourceName}
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={(tabId) => setActiveTab(tabId)}
      customRowActions={workflowRowActions}
    />
  );
}
