import { useMemo, useCallback, useState } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  Panel,
  type NodeTypes,
  type DefaultEdgeOptions,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  Plus,
  BellIcon,
  ClockIcon,
  CodeXml,
  Wrench,
  X,
  Check,
} from "lucide-react";
import { cn } from "@deco/ui/lib/utils.js";
import {
  useWorkflowSteps,
  useWorkflowActions,
  type StepType,
  useIsAddingStep,
} from "@/web/stores/workflow";
import { useWorkflowFlow } from "./use-workflow-flow";
import { StepNode, TriggerNode } from "./nodes";
import { AddFirstStepButton } from "./new-step-button";

// ============================================
// Node Types Configuration
// ============================================

const nodeTypes: NodeTypes = {
  step: StepNode,
  trigger: TriggerNode,
};

const defaultEdgeOptions: DefaultEdgeOptions = {
  style: {
    strokeWidth: 1.5,
    // stroke: "hsl(var(--border))",
  },
  animated: false,
  type: "smoothstep",
};

// ============================================
// Empty State
// ============================================

function EmptyState() {
  const { appendStep } = useWorkflowActions();

  const handleAdd = useCallback(
    (type: StepType) => {
      appendStep({ type });
    },
    [appendStep],
  );

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center py-8 text-center z-10">
      <p className="text-sm text-muted-foreground mb-4">
        No steps yet. Add your first step to get started.
      </p>
      <AddFirstStepButton onAdd={handleAdd} />
    </div>
  );
}

// ============================================
// Floating Add Step Button
// ============================================

function FloatingAddStepButton() {
  const [isExpanded, setIsExpanded] = useState(false);
  const { startAddingStep, cancelAddingStep, completeAddingStep } =
    useWorkflowActions();
  const isAddingStep = useIsAddingStep();
  const { setActiveTab } = useWorkflowActions();
  const handleSelectType = useCallback(
    (type: StepType) => {
      startAddingStep(type);
      setActiveTab("action");
      setIsExpanded(false);
    },
    [startAddingStep, setActiveTab],
  );

  const handleCancel = useCallback(() => {
    cancelAddingStep();
    setIsExpanded(false);
  }, [cancelAddingStep]);

  const handleComplete = useCallback(() => {
    completeAddingStep();
    setIsExpanded(false);
  }, [completeAddingStep]);

  // If we're in "adding step" mode, show cancel button
  if (isAddingStep) {
    return (
      <div className="flex flex-col items-center gap-2">
        <div className="text-xs text-muted-foreground bg-background/80 px-2 py-1 rounded-md backdrop-blur-sm">
          Click a step to insert after
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCancel}
            className={cn(
              "w-8 h-8 rounded-full border-2 border-destructive bg-background",
              "flex items-center justify-center cursor-pointer",
              "hover:bg-destructive/10 transition-colors",
              "shadow-lg",
            )}
          >
            <X className="w-4 h-4 text-destructive" />
          </button>
          <button
            type="button"
            onClick={handleComplete}
            className={cn(
              "w-8 h-8 rounded-full border-2 border-success bg-background",
              "flex items-center justify-center cursor-pointer",
              "hover:bg-success/10 transition-colors",
              "shadow-lg",
            )}
          >
            <Check className="w-4 h-4 text-success" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "w-8 h-8 rounded-full border-2 border-primary bg-background transition-all ease-in-out cursor-pointer",
        "hover:bg-primary/20",
      )}
    >
      <div className="w-full h-full flex items-center justify-center">
        <div className="transition-all duration-200 ease-in-out flex items-center justify-center w-full h-full">
          {/* Plus button (collapsed state) */}
          <div
            className={cn(
              "absolute transition-all duration-200 ease-in-out flex items-center justify-center w-full h-full",
              isExpanded && "scale-0 opacity-0 pointer-events-none",
            )}
          >
            <button
              type="button"
              onClick={() => setIsExpanded(true)}
              className="bg-transparent rounded-full flex items-center justify-center cursor-pointer transition-all ease-in-out"
            >
              <Plus className="w-5 h-5 text-primary-foreground transition-all ease-in-out" />
            </button>
          </div>

          {/* Menu (expanded state) - floating overlay */}
          <div
            className={cn(
              "absolute transition-all duration-200 ease-in-out",
              !isExpanded && "scale-0 opacity-0 pointer-events-none",
            )}
          >
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleSelectType("code")}
                className="w-5 h-5 p-0.5 bg-background rounded-lg flex items-center justify-center hover:bg-primary/40 transition-all ease-in-out cursor-pointer"
                title="Code"
              >
                <CodeXml className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleSelectType("tool")}
                className="w-5 h-5 p-0.5 bg-background rounded-lg flex items-center justify-center hover:bg-primary/40 transition-all ease-in-out cursor-pointer"
                title="Tool"
              >
                <Wrench className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setIsExpanded(false)}
                className="w-5 h-5 p-px rounded-full bg-transparent transition-all ease-in-out cursor-pointer flex items-center justify-center"
              >
                <X className="w-4 h-4 text-primary-foreground transition-all ease-in-out" />
              </button>
              <button
                onClick={() => handleSelectType("sleep")}
                className="w-5 h-5 p-0.5 bg-background rounded-lg flex items-center justify-center hover:bg-primary/40 transition-all ease-in-out cursor-pointer"
                title="Sleep"
              >
                <ClockIcon className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleSelectType("wait_for_signal")}
                className="w-5 h-5 p-0.5 bg-background rounded-lg flex items-center justify-center hover:bg-primary/40 transition-all ease-in-out cursor-pointer"
                title="Signal"
              >
                <BellIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Workflow Canvas
// ============================================

export function WorkflowCanvas() {
  const steps = useWorkflowSteps();
  const { nodes, edges, onNodesChange, onEdgesChange, onNodeClick } =
    useWorkflowFlow();

  // Check if workflow has actual steps (excluding Manual trigger)
  const hasSteps = useMemo(() => {
    return steps.some((s) => s.name !== "Manual");
  }, [steps]);

  return (
    <div
      className="w-full h-full min-h-[400px] relative"
      style={{ height: "100%" }}
    >
      {!hasSteps && <EmptyState />}

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        nodeTypes={nodeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        fitView
        fitViewOptions={{
          padding: 0.3,
          maxZoom: 1.5,
        }}
        minZoom={0.3}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
        nodesDraggable={true}
        nodesConnectable={true}
        elementsSelectable={true}
        panOnDrag={true}
        zoomOnScroll={true}
        zoomOnPinch={true}
        zoomOnDoubleClick={false}
        selectNodesOnDrag={false}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          className="bg-background!"
        />
        <Controls
          showZoom={true}
          showFitView={true}
          showInteractive={false}
          position="bottom-right"
          className="bg-card! border-border! shadow-sm!"
        />

        {/* Floating Add Step Button */}
        {hasSteps && (
          <Panel position="bottom-center" className="mb-4">
            <FloatingAddStepButton />
          </Panel>
        )}
      </ReactFlow>
    </div>
  );
}

export default WorkflowCanvas;
