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

  // Calculate initial viewport position to center the current step
  const initialViewport = useMemo(() => {
    if (!workflow) return { x: 0, y: 0, zoom: 1 };

    // Get container dimensions (approximate if not available yet)
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Calculate the X position for the current step
    const stepX = currentStepIndex * (CARD_WIDTH + CARD_GAP);

    // Center the step horizontally
    const centeredX = viewportWidth / 2 - (stepX + CARD_WIDTH / 2);

    // Use approximate node height for vertical centering
    const nodeHeight = 400; // Approximate height
    const centeredY = viewportHeight / 2 - nodeHeight / 2;

    return { x: centeredX, y: centeredY, zoom: 1 };
  }, []); // Only calculate once on mount

  // Center the viewport on the current step
  const centerViewport = useCallback(
    (stepIndex: number, animated = true) => {
      if (!workflow) return;

      isCenteringRef.current = true;

      // Wait for next frame to ensure ReactFlow is fully rendered
      requestAnimationFrame(() => {
        const container = document.querySelector(".react-flow");
        if (!container) {
          isCenteringRef.current = false;
          return;
        }

        const viewportWidth = container.clientWidth;
        const viewportHeight = container.clientHeight;

        // Calculate the X position for the current step
        const stepX = stepIndex * (CARD_WIDTH + CARD_GAP);

        // Center the step horizontally
        const centeredX = viewportWidth / 2 - (stepX + CARD_WIDTH / 2);

        // Get the actual node to calculate its height for proper vertical centering
        const nodeId =
          stepIndex === workflow.steps?.length
            ? "new"
            : workflow.steps?.[stepIndex]?.name;
        const node = document.querySelector(`[data-id="${nodeId}"]`);
        const nodeHeight = node?.clientHeight || 200; // fallback to 200px if node not found

        // Center vertically - account for node height
        // We want the center of the node to be at the center of the viewport
        const centeredY = viewportHeight / 2 - nodeHeight / 2;

        rf.setViewport(
          { x: centeredX, y: centeredY, zoom: 1 },
          { duration: animated ? 300 : 0 },
        );

        // Allow movement after centering animation completes
        const delay = animated ? 350 : 50;
        setTimeout(() => {
          isCenteringRef.current = false;
        }, delay);
      });
    },
    [workflow, rf],
  );

  // Center viewport when current step changes - only if step actually changed
  useEffect(() => {
    if (lastCenteredStepRef.current === currentStepIndex) {
      return; // Already centered on this step
    }

    lastCenteredStepRef.current = currentStepIndex;

    // Small delay to ensure nodes are rendered
    const timer = setTimeout(() => {
      centerViewport(currentStepIndex);
    }, 50);

    return () => clearTimeout(timer);
  }, [currentStepIndex, centerViewport]);

  const stepIds = useMemo(
    () => workflow?.steps?.map((s: WorkflowStep) => s.name).join(",") || "",
    [workflow?.steps],
  );

  const nodes = useMemo(() => {
    if (!workflow) return [];

    const result: Node[] = [];
    const Y_POSITION = 0; // All nodes at same Y level for proper centering

    // Case 1: No steps yet - show new step node
    if (workflow.steps?.length === 0) {
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
    const nextX = workflow.steps?.length
      ? workflow.steps.length * (CARD_WIDTH + CARD_GAP)
      : 0;

    if (currentStepIndex === workflow.steps?.length) {
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
          x:
            (workflow.steps?.length ? workflow.steps.length - 1 : 0) *
              (CARD_WIDTH + CARD_GAP) +
            CARD_WIDTH +
            80,
          y: Y_POSITION, // Aligned with step nodes
        },
        data: {
          onClick: () => {
            if (workflow) {
              setCurrentStepIndex(workflow.steps?.length || 0);
            }
          },
        },
        draggable: false,
      });
    }

    return result;
  }, [stepIds, workflow, currentStepIndex, setCurrentStepIndex]);

  const edges = useMemo<Edge[]>(() => {
    if (!workflow || !workflow.steps) return [];

    const result: Edge[] = [];

    // Connect all consecutive step nodes
    for (let i = 0; i < workflow.steps?.length - 1; i++) {
      result.push({
        id: `${workflow.steps[i].name}-${workflow.steps[i + 1].name}`,
        source: workflow.steps[i].name,
        target: workflow.steps[i + 1].name,
        animated: true,
      });
    }

    // Connect last step to new step node when on "new step" screen
    if (
      workflow.steps.length > 0 &&
      currentStepIndex === workflow.steps.length
    ) {
      result.push({
        id: `${workflow.steps[workflow.steps.length - 1].name}-new`,
        source: workflow.steps[workflow.steps.length - 1].name,
        target: "new",
        animated: true,
      });
    }

    return result;
  }, [stepIds, workflow, currentStepIndex]);

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
  const handleWheel = useCallback(
    (event: React.WheelEvent) => {
      if (!workflow || isCenteringRef.current) return;

      // Detect horizontal scroll
      const isHorizontalScroll =
        Math.abs(event.deltaX) > Math.abs(event.deltaY);

      if (isHorizontalScroll) {
        // Prevent default scroll behavior
        event.preventDefault();
        event.stopPropagation();

        const now = Date.now();
        const timeSinceLastScroll = now - lastScrollTimeRef.current;

        // Debounce: only trigger navigation if 600ms have passed since last scroll
        if (timeSinceLastScroll < 600) return;

        const scrollAmount = event.deltaX;

        // Threshold to trigger navigation
        if (Math.abs(scrollAmount) > 10) {
          lastScrollTimeRef.current = now;

          if (scrollAmount > 0) {
            // Scroll right -> next step
            const nextIndex = Math.min(
              currentStepIndex + 1,
              workflow.steps?.length || 0,
            );
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
        preventScrolling
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
