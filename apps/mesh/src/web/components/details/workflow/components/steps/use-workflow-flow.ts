import type { Node, Edge, OnNodesChange, OnEdgesChange } from "@xyflow/react";
import {
  buildDagEdges,
  computeStepLevels,
  type Step,
} from "@decocms/bindings/workflow";
import { useWorkflowSteps } from "@/web/components/details/workflow/stores/workflow";

// ============================================
// Types
// ============================================

export type StepStyle =
  | "success"
  | "error"
  | "pending"
  | "waiting_for_signal"
  | "creating"
  | "default"
  | undefined;

export interface StepResult {
  step_id: string;
  input?: unknown;
  output?: unknown;
  error?: unknown;
  created_at?: string;
  completed_at_epoch_ms?: number | null;
}

export interface StepNodeData extends Record<string, unknown> {
  step: Step;
  stepResult: StepResult | null;
  isFetching: boolean;
}

export interface TriggerNodeData extends Record<string, unknown> {
  step: Step | null;
  isFetched: boolean;
  isRunning: boolean;
  isPending: boolean;
}

export type WorkflowNode = Node<StepNodeData | TriggerNodeData>;
export type WorkflowEdge = Edge;

// ============================================
// Layout Constants
// ============================================

const NODE_WIDTH = 180;
const NODE_HEIGHT = 48;
const HORIZONTAL_GAP = 100;
const VERTICAL_GAP = 80;
const TRIGGER_NODE_ID = "__trigger__";

// ============================================
// Layout Computation
// ============================================

function computeNodePositions(
  steps: Step[],
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  const levels = computeStepLevels(steps);

  // Group steps by level
  const stepsByLevel = new Map<number, Step[]>();
  for (const step of steps) {
    const level = levels.get(step.name) ?? 0;
    if (!stepsByLevel.has(level)) {
      stepsByLevel.set(level, []);
    }
    stepsByLevel.get(level)!.push(step);
  }

  // Trigger node at level -1
  positions.set(TRIGGER_NODE_ID, { x: 0, y: 0 });

  // Position each level
  const maxLevel = Math.max(...Array.from(levels.values()), -1);
  for (let level = 0; level <= maxLevel; level++) {
    const stepsAtLevel = stepsByLevel.get(level) ?? [];
    const levelWidth =
      stepsAtLevel.length * NODE_WIDTH +
      (stepsAtLevel.length - 1) * HORIZONTAL_GAP;
    const startX = -levelWidth / 2 + NODE_WIDTH / 2;

    stepsAtLevel.forEach((step, index) => {
      positions.set(step.name, {
        x: startX + index * (NODE_WIDTH + HORIZONTAL_GAP),
        y: (level + 1) * VERTICAL_GAP + NODE_HEIGHT,
      });
    });
  }

  return positions;
}

// ============================================
// Hooks
// ============================================

/**
 * Hook to get React Flow nodes from workflow steps
 * React Compiler handles memoization automatically
 */
export function useWorkflowNodes(): WorkflowNode[] {
  const steps = useWorkflowSteps();
  const positions = computeNodePositions(steps);

  // Find manual trigger step
  const manualTriggerStep = steps.find((step) => step.name === "Manual");

  // Create trigger node
  const triggerNode: WorkflowNode = {
    id: TRIGGER_NODE_ID,
    type: "trigger",
    position: positions.get(TRIGGER_NODE_ID) ?? { x: 0, y: 0 },
    data: {
      step: manualTriggerStep ?? null,
      isFetched: false,
      isRunning: false,
      isPending: false,
    } as TriggerNodeData,
    draggable: false,
  };

  // Create step nodes
  const stepNodes: WorkflowNode[] = steps
    .filter((step) => !!step && step.name !== "Manual")
    .map((step) => {
      return {
        id: step.name,
        type: "step",
        position: positions.get(step.name) ?? { x: 0, y: 0 },
        data: {
          step,
          isFetching: false,
        } as StepNodeData,
        draggable: true,
      };
    });

  return [triggerNode, ...stepNodes];
}

/**
 * Hook to get React Flow edges from workflow steps
 * React Compiler handles memoization automatically
 */
export function useWorkflowEdges(): WorkflowEdge[] {
  const steps = useWorkflowSteps();
  const dagEdges = buildDagEdges(steps);

  // Find root steps (no dependencies) and connect them to trigger
  const stepsWithDeps = new Set(dagEdges.map(([, to]) => to));
  const rootSteps = steps.filter(
    (s) => s.name !== "Manual" && !stepsWithDeps.has(s.name),
  );

  const edges: WorkflowEdge[] = [];

  // Connect trigger to root steps
  for (const step of rootSteps) {
    edges.push({
      id: `${TRIGGER_NODE_ID}-${step.name}`,
      source: TRIGGER_NODE_ID,
      target: step.name,
      type: "default",
      animated: false,
    });
  }

  // Add DAG edges
  for (const [from, to] of dagEdges) {
    if (from === "Manual") continue;
    edges.push({
      id: `${from}-${to}`,
      source: from,
      target: to,
      type: "default",
      animated: false,
    });
  }

  return edges;
}

/**
 * Hook to handle node selection
 * React Compiler handles memoization automatically
 */
export function useNodeSelection() {
  const onNodeClick = (_: React.MouseEvent, _node: Node) => {};

  return { onNodeClick };
}

// Stable no-op handlers defined outside component to avoid recreating on each render
const noopNodesChange: OnNodesChange = () => {
  // No-op: positions are derived from step levels
};

const noopEdgesChange: OnEdgesChange = () => {
  // No-op: edges are derived from step dependencies
};

/**
 * Combined hook for all React Flow state
 * Optimized for performance with stable references
 */
export function useWorkflowFlow() {
  const nodes = useWorkflowNodes();
  const edges = useWorkflowEdges();
  const { onNodeClick } = useNodeSelection();

  return {
    nodes,
    edges,
    onNodesChange: noopNodesChange,
    onEdgesChange: noopEdgesChange,
    onNodeClick,
  };
}

export { TRIGGER_NODE_ID };
