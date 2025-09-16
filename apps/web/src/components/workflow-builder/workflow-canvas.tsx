import React, { useCallback, useMemo, useState } from "react";
import {
  applyEdgeChanges,
  applyNodeChanges,
  Background,
  type Connection,
  Controls,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  ReactFlow,
  useEdgesState,
  useNodesState,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useWorkflowBuilder } from "@deco/sdk";
import type { Workflow, WorkflowStep } from "@deco/sdk";
import {
  WorkflowStepNode,
  type WorkflowStepNodeData,
} from "./nodes/workflow-step-node.tsx";
import { StepCreator } from "./step-creator.tsx";
import { WorkflowToolbar } from "./workflow-toolbar.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import { Plus } from "lucide-react";

// Single unified node type
const nodeTypes = {
  "workflow-step": WorkflowStepNode,
};

interface WorkflowCanvasProps {
  workflow: Workflow;
}

/**
 * Main workflow canvas component using the new linear, AI-powered approach
 * All state synchronization happens in one clear place
 */
export function WorkflowCanvas({
  workflow: initialWorkflow,
}: WorkflowCanvasProps) {
  // Local workflow state - single source of truth
  const [workflow, setWorkflow] = useState<Workflow>(initialWorkflow);
  const [showStepCreator, setShowStepCreator] = useState(false);
  const [editingStep, setEditingStep] = useState<WorkflowStep | null>(null);

  const {
    convertWorkflowToFlow,
    convertFlowToWorkflow,
    handleSaveWorkflow,
    handleRunWorkflow,
    addStep,
    updateStep,
    removeStep,
    isSaving,
    isRunning,
  } = useWorkflowBuilder(workflow);

  // Convert workflow to React Flow format
  const { nodes: initialNodes, edges: initialEdges } = useMemo(
    () => convertWorkflowToFlow(workflow),
    [workflow, convertWorkflowToFlow],
  );

  // React Flow state
  const [nodes, setNodes] = useNodesState<Node>(initialNodes);
  const [edges, setEdges] = useEdgesState<Edge>(initialEdges);

  /**
   * Sync workflow state when nodes/edges change
   * All synchronization happens here - simple and debuggable
   */
  const syncWorkflowFromFlow = useCallback(
    (nextNodes: Node[], nextEdges: Edge[]) => {
      const updatedWorkflow = convertFlowToWorkflow(nextNodes, nextEdges);
      setWorkflow(updatedWorkflow);
    },
    [convertFlowToWorkflow],
  );

  // Handle node changes (position, selection, etc.)
  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const nextNodes = applyNodeChanges(changes, nodes);
      setNodes(nextNodes);

      // Only sync if there are meaningful changes (not just selection)
      const hasMeaningfulChanges = changes.some(
        (change) => change.type === "position" || change.type === "remove",
      );

      if (hasMeaningfulChanges) {
        syncWorkflowFromFlow(nextNodes, edges);
      }
    },
    [nodes, edges, setNodes, syncWorkflowFromFlow],
  );

  // Handle edge changes
  const handleEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      const nextEdges = applyEdgeChanges(changes, edges);
      setEdges(nextEdges);
      syncWorkflowFromFlow(nodes, nextEdges);
    },
    [nodes, edges, setEdges, syncWorkflowFromFlow],
  );

  // Handle new connections
  const handleConnect = useCallback(
    (connection: Connection) => {
      const newEdge: Edge = {
        id: `edge-${connection.source}-${connection.target}`,
        source: connection.source!,
        target: connection.target!,
        type: "smoothstep",
      };

      const nextEdges = [...edges, newEdge];
      setEdges(nextEdges);
      syncWorkflowFromFlow(nodes, nextEdges);
    },
    [nodes, edges, setEdges, syncWorkflowFromFlow],
  );

  /**
   * Handle creating a new step
   */
  const handleCreateStep = useCallback(
    (step: WorkflowStep) => {
      const updatedWorkflow = addStep(step);
      setWorkflow(updatedWorkflow);

      // Update React Flow
      const { nodes: newNodes, edges: newEdges } =
        convertWorkflowToFlow(updatedWorkflow);
      setNodes(newNodes);
      setEdges(newEdges);

      setShowStepCreator(false);
    },
    [addStep, convertWorkflowToFlow, setNodes, setEdges],
  );

  /**
   * Handle editing a step
   */
  const handleEditStep = useCallback(
    (stepId: string, updates: Partial<WorkflowStep>) => {
      const updatedWorkflow = updateStep(stepId, updates);
      setWorkflow(updatedWorkflow);

      // Update React Flow
      const { nodes: newNodes, edges: newEdges } =
        convertWorkflowToFlow(updatedWorkflow);
      setNodes(newNodes);
      setEdges(newEdges);

      setEditingStep(null);
    },
    [updateStep, convertWorkflowToFlow, setNodes, setEdges],
  );

  /**
   * Handle deleting a step
   */
  const handleDeleteStep = useCallback(
    (stepId: string) => {
      const updatedWorkflow = removeStep(stepId);
      setWorkflow(updatedWorkflow);

      // Update React Flow
      const { nodes: newNodes, edges: newEdges } =
        convertWorkflowToFlow(updatedWorkflow);
      setNodes(newNodes);
      setEdges(newEdges);
    },
    [removeStep, convertWorkflowToFlow, setNodes, setEdges],
  );

  /**
   * Handle saving the workflow
   */
  const handleSave = useCallback(async () => {
    try {
      await handleSaveWorkflow(workflow);
    } catch (error) {
      console.error("Failed to save workflow:", error);
    }
  }, [workflow, handleSaveWorkflow]);

  /**
   * Handle running the workflow
   */
  const handleRun = useCallback(async () => {
    try {
      // TODO: Get input from form if workflow has inputSchema
      const input = workflow.inputSchema ? {} : undefined;
      await handleRunWorkflow(workflow, input);
    } catch (error) {
      console.error("Failed to run workflow:", error);
    }
  }, [workflow, handleRunWorkflow]);

  /**
   * Handle testing a single step
   */
  const handleTestStep = useCallback(async (step: WorkflowStep) => {
    console.log("Testing step:", step);
    // TODO: Implement step testing
  }, []);

  // Enhance nodes with callbacks
  const enhancedNodes = useMemo(() => {
    return nodes.map((node) => ({
      ...node,
      data: {
        ...node.data,
        onEdit: (step: WorkflowStep) => setEditingStep(step),
        onDelete: handleDeleteStep,
        onRun: handleTestStep,
      },
    }));
  }, [nodes, handleDeleteStep, handleTestStep]);

  return (
    <div className="h-screen w-full flex flex-col">
      {/* Toolbar */}
      <WorkflowToolbar
        workflowName={workflow.name}
        isDirty={workflow.updatedAt !== initialWorkflow.updatedAt}
        onSave={handleSave}
        onRun={handleRun}
        isSaving={isSaving}
        isRunning={isRunning}
      />

      {/* Main canvas */}
      <div className="flex-1 relative">
        <ReactFlow
          nodes={enhancedNodes}
          edges={edges}
          onNodesChange={handleNodesChange}
          onEdgesChange={handleEdgesChange}
          onConnect={handleConnect}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{
            padding: 0.2,
            minZoom: 0.5,
            maxZoom: 1.5,
          }}
        >
          <Background />
          <Controls />
        </ReactFlow>

        {/* Add step button */}
        <Button
          onClick={() => setShowStepCreator(true)}
          className="absolute bottom-8 right-8 h-14 px-6 shadow-lg"
          size="lg"
        >
          <Plus className="w-5 h-5 mr-2" />
          Add Step
        </Button>
      </div>

      {/* Step Creator Modal */}
      {showStepCreator && (
        <StepCreator
          workflow={workflow}
          onStepCreated={handleCreateStep}
          onCancel={() => setShowStepCreator(false)}
        />
      )}

      {/* Step Editor Modal */}
      {editingStep && (
        <StepCreator
          workflow={workflow}
          editingStep={editingStep}
          onStepCreated={(step) => handleEditStep(editingStep.id, step)}
          onCancel={() => setEditingStep(null)}
        />
      )}
    </div>
  );
}
