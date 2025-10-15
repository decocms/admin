/**
 * Hook to generate mention items for Tiptap
 * Combines tools from integrations + previous workflow steps
 *
 * OPTIMIZED: Use specific dependencies instead of entire objects
 */
import { useMemo } from "react";
import { useIntegrations } from "./useIntegrations";
import { WorkflowStep } from "shared/types/workflows";
import { useCurrentWorkflow } from "@/store/workflow";

interface ToolItem {
  id: string;
  type: "tool";
  label: string;
  description?: string;
  category?: string;
  integration?: { id: string; name: string; icon?: string };
}

interface StepItem {
  id: string;
  type: "step";
  label: string;
  description?: string;
  category?: string;
}

export type MentionItem = ToolItem | StepItem;

export function useMentionItems(): MentionItem[] {
  const { data: integrations = [] } = useIntegrations();
  const workflow = useCurrentWorkflow();

  // Extract stable primitive values instead of using entire workflow object
  const workflowSteps = workflow?.steps;
  const stepsKey = useMemo(
    () => workflowSteps?.map((s) => s.def.name).join(",") || "",
    [workflowSteps],
  );

  // OPTIMIZATION: Create stable string key for integrations to prevent recalculation
  const integrationsKey = useMemo(
    () => integrations.map((i) => `${i.id}:${i.tools?.length || 0}`).join(","),
    [integrations],
  );

  return useMemo(() => {
    const items: MentionItem[] = [];

    // Add tools from integrations
    integrations.forEach((integration) => {
      integration.tools?.forEach((tool) => {
        items.push({
          id: `@${tool.name}`,
          type: "tool",
          label: tool.name,
          description: tool.description,
          category: integration.name,
          integration: {
            id: integration.id,
            name: integration.name,
            icon: integration.icon,
          },
        });
      });
    });

    // Add previous steps (if workflow provided)
    if (workflowSteps?.length) {
      workflowSteps.forEach((step: WorkflowStep) => {
        items.push({
          id: `@${step.def.name}`,
          type: "step",
          label: `${step.def.name}`,
          description: `Reference output: @${step.def.name}.output`,
          category: "Previous Steps",
        });
      });
    }

    return items;
  }, [integrationsKey, stepsKey, integrations, workflowSteps]);
}
