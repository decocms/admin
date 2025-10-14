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
  useCurrentWorkflow,
  useWorkflowStoreActions,
  useCurrentStepIndex,
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
  const workflow = useCurrentWorkflow();
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

  // Center the viewport on the current step
  const centerViewport = useCallback(
    (stepIndex: number, animated = true) => {
      if (!workflow) return;

      isCenteringRef.current = true;

      // Wait for next frame and a bit longer to ensure dynamic content (like StepOutput) is rendered
      requestAnimationFrame(() => {
        setTimeout(() => {
          const container = document.querySelector(".react-flow");
          if (!container) {
            isCenteringRef.current = false;
            return;
          }

          // Calculate the X position for the current step
          const stepX = stepIndex * (CARD_WIDTH + CARD_GAP);

          // Get the actual node to calculate its height for proper vertical centering
          const nodeId =
            stepIndex === workflow.steps?.length
              ? "new"
              : workflow.steps?.[stepIndex]?.name;
          const node = document.querySelector(`[data-id="${nodeId}"]`);
          const nodeHeight = node?.clientHeight || 200; // fallback to 200px if node not found

          // Use setCenter for accurate centering regardless of container size
          const targetX = stepX + CARD_WIDTH / 2;
          const targetY = nodeHeight / 2;
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
        }, 100); // Wait 100ms for dynamic content to render
      });
    },
    [workflow, rf],
  );

  // Center viewport when current step changes - only if step actually changed
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

  // Track the current step's output to detect when execution completes
  const currentStepOutput = useMemo(() => {
    if (!workflow?.steps || currentStepIndex >= workflow.steps.length) {
      return null;
    }
    return workflow.steps[currentStepIndex]?.output;
  }, [workflow?.steps, currentStepIndex]);

  // Re-center when current step's output changes (execution completes)
  useEffect(() => {
    if (!currentStepOutput) {
      return; // No output yet
    }

    // Wait for the DOM to update with the new output content, then re-center
    const timer = setTimeout(() => {
      centerViewport(currentStepIndex, true);
    }, 150);

    return () => clearTimeout(timer);
  }, [currentStepOutput, currentStepIndex, centerViewport]);

  // OPTIMIZED: Use primitive values instead of complex objects for dependencies
  const stepsLength = workflow?.steps?.length || 0;
  const stepIds = useMemo(
    () => workflow?.steps?.map((s: WorkflowStep) => s.name).join(",") || "",
    [workflow?.steps],
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
    if (!workflow) return [];

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
    workflow.steps?.forEach((step: WorkflowStep, index: number) => {
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
  }, [stepIds, stepsLength, workflow, currentStepIndex, plusButtonData]);

  // OPTIMIZED: Simplified dependencies
  const edges = useMemo<Edge[]>(() => {
    if (!workflow?.steps || stepsLength === 0) return [];

    const result: Edge[] = [];

    // Connect all consecutive step nodes
    for (let i = 0; i < stepsLength - 1; i++) {
      result.push({
        id: `${workflow.steps[i].name}-${workflow.steps[i + 1].name}`,
        source: workflow.steps[i].name,
        target: workflow.steps[i + 1].name,
        animated: true,
      });
    }

    // Connect last step to new step node when on "new step" screen
    if (currentStepIndex === stepsLength) {
      result.push({
        id: `${workflow.steps[stepsLength - 1].name}-new`,
        source: workflow.steps[stepsLength - 1].name,
        target: "new",
        animated: true,
      });
    }

    return result;
  }, [stepIds, stepsLength, workflow?.steps, currentStepIndex]);

  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      if (!workflow || node.type === "plusButton") return;

      if (node.id === "new") {
        if (currentStepIndex !== workflow.steps?.length) {
          setCurrentStepIndex(workflow.steps?.length || 0);
        }
        return;
      }

      const stepIndex = workflow.steps?.findIndex(
        (s: WorkflowStep) => s.name === node.id,
      );
      if (stepIndex !== -1 && stepIndex !== currentStepIndex) {
        setCurrentStepIndex(stepIndex || 0);
      }
    },
    [workflow, currentStepIndex, setCurrentStepIndex],
  );

  // Lock canvas - prevent any panning
  const handleMove = useCallback(() => {
    // Don't prevent centering animation from completing
    // We rely on panOnDrag={false} and other ReactFlow props to prevent manual panning
    return;
  }, []);

  // Handle horizontal scroll to navigate between steps
  // OPTIMIZED: Reduced DOM traversal and better memoization
  const handleWheel = useCallback(
    (event: React.WheelEvent) => {
      if (!workflow || isCenteringRef.current) return;

      // Quick check: if inside a scrollable element, let it scroll
      const target = event.target as HTMLElement;

      // Check only closest scrollable parents (max 5 levels) instead of traversing entire tree
      let element: HTMLElement | null = target;
      let depth = 0;
      const MAX_DEPTH = 5;

      while (element && element !== event.currentTarget && depth < MAX_DEPTH) {
        // Use cached styles check - getComputedStyle is expensive
        const hasScrollableY = element.scrollHeight > element.clientHeight;
        const hasScrollableX = element.scrollWidth > element.clientWidth;

        if (hasScrollableY || hasScrollableX) {
          const computedStyle = window.getComputedStyle(element);
          const overflowY = computedStyle.overflowY;
          const overflowX = computedStyle.overflowX;

          if (
            ((overflowY === "auto" || overflowY === "scroll") &&
              hasScrollableY) ||
            ((overflowX === "auto" || overflowX === "scroll") && hasScrollableX)
          ) {
            return; // Allow native scrolling
          }
        }

        element = element.parentElement;
        depth++;
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
        const maxSteps = workflow.steps?.length || 0;

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
    [workflow, currentStepIndex, setCurrentStepIndex],
  );

  useImperativeHandle(
    ref,
    () => ({
      centerOnStep: (index: number) => {
        if (workflow) {
          setCurrentStepIndex(index);
        }
      },
      centerOnNext: () => {
        if (workflow) {
          const nextIndex = Math.min(
            currentStepIndex + 1,
            workflow.steps?.length || 0,
          );
          setCurrentStepIndex(nextIndex);
        }
      },
      centerOnPrev: () => {
        if (workflow) {
          const prevIndex = Math.max(currentStepIndex - 1, 0);
          setCurrentStepIndex(prevIndex);
        }
      },
    }),
    [workflow, currentStepIndex, setCurrentStepIndex],
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
