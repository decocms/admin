/**
 * Hook to generate mention items for Tiptap
 * Combines tools from integrations + previous workflow steps
 */
import { useMemo } from "react";
import { useIntegrations } from "./useIntegrations";
import type { Workflow } from "../types/workflow";
import type { WorkflowStep } from "shared/types/workflows";

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

export function useMentionItems(workflow?: Workflow): MentionItem[] {
  const { data: integrations = [] } = useIntegrations();

  return useMemo(() => {
    const items: MentionItem[] = [];
    // Add tools from integrations
    integrations.forEach((integration: { id: string; name: string; tools?: Array<{ id: string; name: string; description?: string; integration: string }> }) => {
      integration.tools?.forEach((tool: { id: string; name: string; description?: string; integration: string }) => {
        items.push({
          id: `@${tool.name}`,
          type: "tool",
          label: tool.name,
          description: tool.description,
          category: integration.name,
          integration: {
            id: integration.id,
            name: integration.name,
            icon: undefined,
          },
        });
      });
    });

    // Add previous steps (if workflow provided)
    if (workflow) {
      workflow.steps?.forEach((step: WorkflowStep, index: number) => {
        if (!workflow.steps) return;
        if (index < workflow.steps?.length) {
          // Add the step reference without property suffix - user can type it
          items.push({
            id: `@${step.id}`,
            type: "step",
            label: `${step.title}`,
            description: `Reference output: @${step.id}.output`,
            category: "Previous Steps",
          });
        }
      });
    }

    return items;
  }, [integrations, workflow]);
}
