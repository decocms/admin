import {
  forwardRef,
  useImperativeHandle,
  useMemo,
  useCallback,
  useRef,
  useEffect,
} from "react";
import ReactFlow, {
  ReactFlowProvider,
  useReactFlow,
  type Node,
  type Edge,
  Background,
} from "reactflow";
import { StepNode, NewStepNode, PlusButtonNode } from "./nodes";
import {
  useWorkflowStoreActions,
  useCurrentStepIndex,
  useWorkflowSteps,
  useWorkflowStepsLength,
} from "@/store/workflow";
import type { WorkflowStep } from "shared/types/workflows";

export interface WorkflowCanvasRef {
  centerOnStep: (index: number) => void;
  centerOnNext: () => void;
  centerOnPrev: () => void;
}

const CARD_WIDTH = 640;
const CARD_GAP = 200;

// Move nodeTypes outside component to prevent recreation on every render
const nodeTypes = {
  step: StepNode,
  newStep: NewStepNode,
  plusButton: PlusButtonNode,
};

const Inner = forwardRef<WorkflowCanvasRef>(function Inner(_, ref) {
  const rf = useReactFlow();
  const steps = useWorkflowSteps();
  const stepsLength = useWorkflowStepsLength();
  const currentStepIndex = useCurrentStepIndex();
  const { setCurrentStepIndex } = useWorkflowStoreActions();

  const isCenteringRef = useRef<boolean>(false);
  const lastScrollTimeRef = useRef<number>(0);
  const lastCenteredStepRef = useRef<number>(-1);

  // Initial mount flag to trigger centering on first render
  const isInitialMountRef = useRef(true);

  // Calculate a rough initial viewport to prevent initial jump
  const initialViewport = useMemo(() => {
    // Start with a basic X offset to roughly center the current step
    const stepX = currentStepIndex * (CARD_WIDTH + CARD_GAP);
    const estimatedViewportWidth = window.innerWidth;
    const centeredX = estimatedViewportWidth / 2 - (stepX + CARD_WIDTH / 2);

    // Y will be adjusted by the centering effect shortly after mount
    return { x: centeredX, y: 0, zoom: 1 };
  }, []); // Only calculate once on mount

  // OPTIMIZED: Center the viewport without expensive DOM queries
  const centerViewport = useCallback(
    (stepIndex: number, animated = true) => {
      if (!steps) return;

      isCenteringRef.current = true;

      // Calculate the X position for the current step
      const stepX = stepIndex * (CARD_WIDTH + CARD_GAP);
      const targetX = stepX + CARD_WIDTH / 2;

      // Use fixed estimated height instead of DOM measurement
      // Most nodes are ~200-400px, center at 250px is a good compromise
      const estimatedNodeHeight = 250;
      const targetY = estimatedNodeHeight / 2;
      const toolbarOffset = 80; // Account for toolbar at bottom
      const adjustedY = Math.max(0, targetY - toolbarOffset / 2);

      rf.setCenter(targetX, adjustedY, {
        zoom: 1,
        duration: animated ? 300 : 0,
      });

      // Allow movement after centering animation completes
      const delay = animated ? 350 : 50;
      setTimeout(() => {
        isCenteringRef.current = false;
      }, delay);
    },
    [steps, rf],
  );

  // Center viewport when current step changes - only if step actually changed
  // OPTIMIZED: Single centering effect, removed duplicate output-change effect
  useEffect(() => {
    const isInitial = isInitialMountRef.current;

    if (lastCenteredStepRef.current === currentStepIndex && !isInitial) {
      return; // Already centered on this step
    }

    lastCenteredStepRef.current = currentStepIndex;
    isInitialMountRef.current = false;

    // Small delay to ensure nodes are rendered
    const delay = isInitial ? 100 : 50;
    const timer = setTimeout(() => {
      centerViewport(currentStepIndex, !isInitial);
    }, delay);

    return () => clearTimeout(timer);
  }, [currentStepIndex, centerViewport]);

  // OPTIMIZED: Use primitive values instead of complex objects for dependencies
  const stepIds = useMemo(
    () => steps?.map((s: WorkflowStep) => s.name).join(",") || "",
    [steps],
  );

  // Memoize the plus button onClick to prevent React Flow warnings
  const handlePlusClick = useCallback(() => {
    setCurrentStepIndex(stepsLength);
  }, [stepsLength, setCurrentStepIndex]);

  // Memoize the data object for plus button to maintain stable reference
  const plusButtonData = useMemo(
    () => ({ onClick: handlePlusClick }),
    [handlePlusClick],
  );

  const nodes = useMemo(() => {
    if (!steps) return [];

    const result: Node[] = [];
    const Y_POSITION = 0; // All nodes at same Y level for proper centering

    // Case 1: No steps yet - show new step node
    if (stepsLength === 0) {
      result.push({
        id: "new",
        type: "newStep",
        position: { x: 0, y: Y_POSITION },
        data: {},
        draggable: false,
      });
      return result;
    }

    // Case 2: Create step nodes horizontally aligned
    steps?.forEach((step: WorkflowStep, index: number) => {
      const stepX = index * (CARD_WIDTH + CARD_GAP);

      result.push({
        id: step.name,
        type: "step",
        position: { x: stepX, y: Y_POSITION },
        data: { stepId: step.name },
        draggable: false,
      });
    });

    // Case 3: Add appropriate node at the end
    const nextX = stepsLength * (CARD_WIDTH + CARD_GAP);

    if (currentStepIndex === stepsLength) {
      // User is on the "new step" screen - show new step node
      result.push({
        id: "new",
        type: "newStep",
        position: { x: nextX, y: Y_POSITION },
        data: {},
        draggable: false,
      });
    } else {
      // User is viewing a step - show plus button
      result.push({
        id: "plus-end",
        type: "plusButton",
        position: {
          x: (stepsLength - 1) * (CARD_WIDTH + CARD_GAP) + CARD_WIDTH + 80,
          y: Y_POSITION, // Aligned with step nodes
        },
        data: plusButtonData,
        draggable: false,
      });
    }

    return result;
  }, [stepIds, stepsLength, steps, currentStepIndex, plusButtonData]);

  // OPTIMIZED: Simplified dependencies
  const edges = useMemo<Edge[]>(() => {
    if (!steps || stepsLength === 0) return [];

    const result: Edge[] = [];

    // Connect all consecutive step nodes
    for (let i = 0; i < stepsLength - 1; i++) {
      result.push({
        id: `${steps[i].name}-${steps[i + 1].name}`,
        source: steps[i].name,
        target: steps[i + 1].name,
        animated: true,
      });
    }

    // Connect last step to new step node when on "new step" screen
    if (currentStepIndex === stepsLength) {
      result.push({
        id: `${steps[stepsLength - 1].name}-new`,
        source: steps[stepsLength - 1].name,
        target: "new",
        animated: true,
      });
    }

    return result;
  }, [stepIds, stepsLength, steps, currentStepIndex]);

  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      if (!steps || node.type === "plusButton") return;

      if (node.id === "new") {
        if (currentStepIndex !== stepsLength) {
          setCurrentStepIndex(stepsLength);
        }
        return;
      }

      const stepIndex = steps?.findIndex(
        (s: WorkflowStep) => s.name === node.id,
      );
      if (stepIndex !== -1 && stepIndex !== currentStepIndex) {
        setCurrentStepIndex(stepIndex || 0);
      }
    },
    [steps, stepsLength, currentStepIndex, setCurrentStepIndex],
  );

  // Lock canvas - prevent any panning
  const handleMove = useCallback(() => {
    // Don't prevent centering animation from completing
    // We rely on panOnDrag={false} and other ReactFlow props to prevent manual panning
    return;
  }, []);

  // OPTIMIZED: Handle horizontal scroll to navigate between steps with minimal DOM traversal
  const handleWheel = useCallback(
    (event: React.WheelEvent) => {
      if (!steps || isCenteringRef.current) return;

      // OPTIMIZED: Quick check using closest() - much faster than manual traversal
      const target = event.target as HTMLElement;

      // If target is inside a scrollable container, allow native scrolling
      // Mark scrollable containers with data-scrollable="true" attribute
      if (target.closest('[data-scrollable="true"]')) {
        return;
      }

      // Detect horizontal scroll
      const isHorizontalScroll =
        Math.abs(event.deltaX) > Math.abs(event.deltaY);

      if (isHorizontalScroll) {
        event.preventDefault();
        event.stopPropagation();

        const now = Date.now();
        const timeSinceLastScroll = now - lastScrollTimeRef.current;

        // Debounce: only trigger navigation if 600ms have passed
        if (timeSinceLastScroll < 600) return;

        const scrollAmount = event.deltaX;
        const maxSteps = stepsLength;

        // Threshold to trigger navigation
        if (Math.abs(scrollAmount) > 10) {
          lastScrollTimeRef.current = now;

          if (scrollAmount > 0) {
            // Scroll right -> next step
            const nextIndex = Math.min(currentStepIndex + 1, maxSteps);
            if (nextIndex !== currentStepIndex) {
              setCurrentStepIndex(nextIndex);
            }
          } else {
            // Scroll left -> previous step
            const prevIndex = Math.max(currentStepIndex - 1, 0);
            if (prevIndex !== currentStepIndex) {
              setCurrentStepIndex(prevIndex);
            }
          }
        }
      }
    },
    [steps, stepsLength, currentStepIndex, setCurrentStepIndex],
  );

  useImperativeHandle(
    ref,
    () => ({
      centerOnStep: (index: number) => {
        if (steps) {
          setCurrentStepIndex(index);
        }
      },
      centerOnNext: () => {
        if (steps) {
          const nextIndex = Math.min(currentStepIndex + 1, stepsLength);
          setCurrentStepIndex(nextIndex);
        }
      },
      centerOnPrev: () => {
        if (steps) {
          const prevIndex = Math.max(currentStepIndex - 1, 0);
          setCurrentStepIndex(prevIndex);
        }
      },
    }),
    [steps, stepsLength, currentStepIndex, setCurrentStepIndex],
  );

  return (
    <div onWheel={handleWheel} className="h-full w-full overflow-hidden">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodeClick={onNodeClick}
        onMove={handleMove}
        nodeTypes={nodeTypes}
        fitView={false}
        fitViewOptions={{ maxZoom: 1, minZoom: 1 }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable
        panOnDrag={false}
        panOnScroll={false}
        zoomOnScroll={false}
        zoomOnPinch={false}
        zoomOnDoubleClick={false}
        preventScrolling={false}
        minZoom={1}
        maxZoom={1}
        defaultViewport={initialViewport}
        className="h-full w-full bg-background [&_.react-flow__pane]:!cursor-default [&_.react-flow__renderer]:cursor-default"
        proOptions={{ hideAttribution: true }}
        nodeOrigin={[0, 0]}
      >
        <Background color="hsl(var(--border))" gap={16} />
      </ReactFlow>
    </div>
  );
});

const WorkflowCanvas = forwardRef<WorkflowCanvasRef>(
  function WorkflowCanvas(_props, ref) {
    return (
      <ReactFlowProvider>
        <Inner ref={ref} />
      </ReactFlowProvider>
    );
  },
);

export default WorkflowCanvas;
