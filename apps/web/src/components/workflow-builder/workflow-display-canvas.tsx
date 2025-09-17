import React, { useCallback, useMemo, useState } from "react";
import {
  Background,
  type Edge,
  type Node,
  ReactFlow,
  useEdgesState,
  useNodesState,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Button } from "@deco/ui/components/button.tsx";
import { RefreshCw } from "lucide-react";
import type { WorkflowDefinition } from "@deco/sdk";
import { WorkflowSourceNode } from "./nodes/workflow-source-node.tsx";
import { WorkflowSinkNode } from "./nodes/workflow-sink-node.tsx";
import { WorkflowStepDisplayNode } from "./nodes/workflow-step-display-node.tsx";

// Extended workflow type for display (includes optional metadata)
interface DisplayWorkflow extends WorkflowDefinition {
  id?: string;
  title?: string;
  created_at?: string;
  updated_at?: string;
  createdAt?: string;
  updatedAt?: string;
  executionState?: any;
}

// Node types for the display canvas
const nodeTypes = {
  "workflow-source": WorkflowSourceNode,
  "workflow-sink": WorkflowSinkNode,
  "workflow-step": WorkflowStepDisplayNode,
};

interface WorkflowDisplayCanvasProps {
  workflow: DisplayWorkflow;
  onRefresh?: () => void;
  isLoading?: boolean;
}

/**
 * Read-only workflow display canvas that shows workflows as a horizontal flow
 * No interactions - just visual representation
 */
export function WorkflowDisplayCanvas({
  workflow,
  onRefresh,
  isLoading = false,
}: WorkflowDisplayCanvasProps) {
  // Convert workflow to React Flow format for display
  const { nodes: initialNodes, edges: initialEdges } = useMemo(
    () => convertWorkflowToDisplayFlow(workflow),
    [workflow],
  );

  // React Flow state
  const [nodes, setNodes] = useNodesState<Node>(initialNodes);
  const [edges, setEdges] = useEdgesState<Edge>(initialEdges);

  // Update nodes when workflow changes
  React.useEffect(() => {
    const { nodes: newNodes, edges: newEdges } = convertWorkflowToDisplayFlow(workflow);
    setNodes(newNodes);
    setEdges(newEdges);
  }, [workflow, setNodes, setEdges]);

  const handleRefresh = useCallback(() => {
    onRefresh?.();
  }, [onRefresh]);

  return (
    <div className="h-screen w-full flex flex-col">
      {/* Header with refresh button */}
      <div className="flex items-center justify-between p-4 border-b bg-white">
        <div>
          <h1 className="text-xl font-semibold">{workflow.name}</h1>
          <p className="text-sm text-gray-600">{workflow.description}</p>
        </div>
        <Button
          onClick={handleRefresh}
          disabled={isLoading}
          variant="outline"
          size="sm"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Main canvas */}
      <div className="flex-1 relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{
            padding: 0.1,
            minZoom: 0.3,
            maxZoom: 1.2,
          }}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          panOnDrag={true}
          zoomOnScroll={true}
          zoomOnPinch={true}
          preventScrolling={false}
        >
          <Background />
        </ReactFlow>
      </div>
    </div>
  );
}

/**
 * Convert workflow definition to React Flow nodes and edges for display
 */
function convertWorkflowToDisplayFlow(workflow: DisplayWorkflow) {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  // Create source node (workflow input)
  const sourceNode: Node = {
    id: "source",
    type: "workflow-source",
    position: { x: 50, y: 100 },
    data: {
      title: "Workflow Input",
      description: "Input parameters for the workflow",
      schema: workflow.inputSchema,
    },
  };
  nodes.push(sourceNode);

  // Create step nodes
  workflow.steps.forEach((step, index) => {
    const stepNode: Node = {
      id: `step-${index}`,
      type: "workflow-step",
      position: { x: 300 + index * 250, y: 100 },
      data: {
        step,
        index,
        integrationId: step.type === "tool_call" ? step.def.integration : undefined,
      },
    };
    nodes.push(stepNode);

    // Create edges between nodes
    const sourceId = index === 0 ? "source" : `step-${index - 1}`;
    const targetId = `step-${index}`;

    const edge: Edge = {
      id: `edge-${sourceId}-${targetId}`,
      source: sourceId,
      target: targetId,
      type: "smoothstep",
      animated: false,
    };
    edges.push(edge);
  });

  // Create sink node (workflow output)
  const sinkNode: Node = {
    id: "sink",
    type: "workflow-sink",
    position: { x: 300 + workflow.steps.length * 250, y: 100 },
    data: {
      title: "Workflow Output",
      description: "Final output of the workflow",
      schema: workflow.outputSchema,
    },
  };
  nodes.push(sinkNode);

  // Connect last step to sink
  if (workflow.steps.length > 0) {
    const lastStepId = `step-${workflow.steps.length - 1}`;
    const sinkEdge: Edge = {
      id: `edge-${lastStepId}-sink`,
      source: lastStepId,
      target: "sink",
      type: "smoothstep",
      animated: false,
    };
    edges.push(sinkEdge);
  }

  return { nodes, edges };
}
