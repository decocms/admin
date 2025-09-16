import { useCallback } from "react";
import type { Node, Edge } from "@xyflow/react";
import {
  useUpsertSandboxWorkflow,
  useStartSandboxWorkflow,
} from "./sandbox-workflows.ts";
import type { WorkflowDefinition } from "../mcp/sandbox/workflow-schemas.ts";

export function useWorkflowBuilder(workflow: WorkflowDefinition) {
  const convertWorkflowToFlow = useCallback((workflow: WorkflowDefinition) => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];

    // Convert workflow steps to nodes
    workflow.steps.forEach((step, index) => {
      const nodeId = `node-${index}`;
      const node: Node = {
        id: nodeId,
        type: step.type === "tool_call" ? "tool" : "mapper",
        position: { x: index * 200, y: 100 },
        data: {
          type: step.type,
          name: step.def.name,
          description: step.def.description,
          ...(step.type === "tool_call"
            ? {
                tool_name: (step.def as any).tool_name,
                integration: (step.def as any).integration,
                options: (step.def as any).options,
              }
            : {
                execute: (step.def as any).execute,
                outputSchema: {},
              }),
        },
      };
      nodes.push(node);

      // Create edges between consecutive steps
      if (index > 0) {
        const prevNodeId = `node-${index - 1}`;
        edges.push({
          id: `edge-${prevNodeId}-${nodeId}`,
          source: prevNodeId,
          target: nodeId,
          type: "smoothstep",
        });
      }
    });

    return { nodes, edges };
  }, []);

  const convertFlowToWorkflow = useCallback(
    (nodes: Node[], edges: Edge[]): WorkflowDefinition => {
      // Sort nodes by position to maintain order
      const sortedNodes = [...nodes].sort(
        (a, b) => a.position.x - b.position.x,
      );

      const steps = sortedNodes
        .map((node) => {
          if (node.data.type === "tool_call") {
            return {
              type: "tool_call" as const,
              def: {
                name: node.data.name,
                description: node.data.description,
                options: (node.data as any).options,
                tool_name: (node.data as any).tool_name,
                integration: (node.data as any).integration,
              },
            };
          } else if (node.data.type === "mapping") {
            return {
              type: "mapping" as const,
              def: {
                name: node.data.name,
                description: node.data.description,
                execute: (node.data as any).execute,
              },
            };
          }
          return null;
        })
        .filter(Boolean);

      return {
        name: workflow.name,
        description: workflow.description,
        inputSchema: workflow.inputSchema,
        outputSchema: workflow.outputSchema,
        steps: steps as any[],
      };
    },
    [workflow],
  );

  const upsertWorkflow = useUpsertSandboxWorkflow();
  const startWorkflow = useStartSandboxWorkflow();

  const handleGenerateWorkflow = useCallback(
    async (workflowDefinition: WorkflowDefinition) => {
      try {
        await upsertWorkflow.mutateAsync(workflowDefinition);
        console.log("Workflow saved successfully:", workflowDefinition);
      } catch (error) {
        console.error("Failed to generate workflow:", error);
        throw error;
      }
    },
    [upsertWorkflow],
  );

  const handleRunWorkflow = useCallback(
    async (
      workflowDefinition: WorkflowDefinition,
      input?: Record<string, any>,
    ) => {
      try {
        // Use the SDK hook for workflow execution
        const result = await startWorkflow.mutateAsync({
          name: workflowDefinition.name,
          input: input || {},
        });

        console.log("Workflow started successfully:", result);
        return result;
      } catch (error) {
        console.error("Failed to run workflow:", error);
        throw error;
      }
    },
    [startWorkflow],
  );

  return {
    convertWorkflowToFlow,
    convertFlowToWorkflow,
    handleGenerateWorkflow,
    handleRunWorkflow,
  };
}
