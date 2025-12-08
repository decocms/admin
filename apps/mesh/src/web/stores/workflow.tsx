import { createStore, StoreApi } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { useStoreWithEqualityFn } from "zustand/traditional";
import { shallow } from "zustand/vanilla/shallow";
import {
  DEFAULT_CODE_STEP,
  DEFAULT_SLEEP_STEP,
  DEFAULT_TOOL_STEP,
  DEFAULT_WAIT_FOR_SIGNAL_STEP,
  DEFAULT_WORKFLOW_STEPS,
  Workflow,
} from "@decocms/bindings/workflow";
import { Step, ToolCallAction } from "@decocms/bindings/workflow";
import { createContext, useContext, useState } from "react";

type ActiveTab = "input" | "output" | "action";
type StepType = "tool" | "code" | "sleep" | "wait_for_signal";

interface State {
  originalWorkflow: Workflow;
  workflow: Workflow;
  trackingExecutionId: string | undefined;
  activeTab: ActiveTab;
  currentStepName: string | undefined;
}

interface Actions {
  setToolAction: (toolAction: ToolCallAction) => void;
  appendStep: ({ step, type }: { step?: Step; type: StepType }) => void;
  addStepAtIndex: (
    index: number,
    { step, type }: { step?: Step; type: StepType },
  ) => void;
  deleteStep: (stepName: string) => void;
  setCurrentStepName: (stepName: string) => void;
  updateStep: (stepName: string, updates: Partial<Step>) => void;
  setTrackingExecutionId: (executionId: string | undefined) => void;
  setActiveTab: (activeTab: ActiveTab) => void;
  setDefaultSteps: () => void;
  resetToOriginalWorkflow: () => void;
}

interface Store extends State {
  actions: Actions;
}

function createDefaultStep(type: StepType, index: number): Step {
  switch (type) {
    case "tool":
      return { ...DEFAULT_TOOL_STEP, name: `Step ${index + 1}` };
    case "code":
      return { ...DEFAULT_CODE_STEP, name: `Step ${index + 1}` };
    case "sleep":
      return { ...DEFAULT_SLEEP_STEP, name: `Step ${index + 1}` };
    case "wait_for_signal":
      return { ...DEFAULT_WAIT_FOR_SIGNAL_STEP, name: `Step ${index + 1}` };
    default:
      throw new Error(`Invalid step type: ${type}`);
  }
}

export const WorkflowStoreContext = createContext<StoreApi<Store> | null>(null);
export const createWorkflowStore = (initialState: State) => {
  return createStore<Store>()(
    persist(
      (set) => ({
        ...initialState,
        actions: {
          setActiveTab: (activeTab) =>
            set((state) => ({
              ...state,
              activeTab: activeTab,
            })),
          setDefaultSteps: () =>
            set((state) => ({
              workflow: {
                ...state.workflow,
                steps: DEFAULT_WORKFLOW_STEPS,
              },
              currentStepName: DEFAULT_WORKFLOW_STEPS[0]?.name ?? undefined,
            })),
          setToolAction: (toolAction) =>
            set((state) => ({
              workflow: {
                ...state.workflow,
                steps: state.workflow.steps.map((step) =>
                  "toolName" in step.action &&
                  step.action.toolName !== toolAction.toolName
                    ? { ...step, action: toolAction }
                    : step,
                ),
              },
            })),
          appendStep: ({ step, type }) =>
            set((state) => {
              const newStep =
                step ?? createDefaultStep(type, state.workflow.steps.length);
              const existingName = state.workflow.steps.find(
                (s) => s.name === newStep.name,
              );
              const newName = existingName
                ? `${newStep.name} ${
                    parseInt(
                      existingName.name.split(" ").pop() ??
                        Math.random().toString(36).substring(2, 15),
                    ) + 1
                  }`
                : newStep.name;
              return {
                workflow: {
                  ...state.workflow,
                  steps: [
                    ...state.workflow.steps,
                    { ...newStep, name: newName },
                  ],
                },
              };
            }),
          addStepAtIndex: (index, { step, type }) =>
            set((state) => {
              const newStep = step ?? createDefaultStep(type, index);
              console.log("newStep", newStep);
              const existingName = state.workflow.steps.find(
                (s) =>
                  s.name.toLowerCase().trim() ===
                  newStep.name.toLowerCase().trim(),
              );
              console.log("existingName", existingName);
              console.log("newStep.name", newStep.name);
              console.log("steps", state.workflow.steps);
              const newName = existingName
                ? `${newStep.name.trim()} ${Math.random().toString(36).substring(2, 6)}`
                : newStep.name;
              return {
                ...state,
                workflow: {
                  ...state.workflow,
                  steps: [
                    ...state.workflow.steps.slice(0, index),
                    { ...newStep, name: newName },
                    ...state.workflow.steps.slice(index),
                  ],
                },
                currentStepName: newName,
              };
            }),
          deleteStep: (stepName) =>
            set((state) => ({
              workflow: {
                ...state.workflow,
                steps: state.workflow.steps.filter(
                  (step) => step.name !== stepName,
                ),
              },
            })),
          setCurrentStepName: (stepName) =>
            set((state) => ({
              ...state,
              currentStepName: stepName,
            })),
          updateStep: (stepName, updates) =>
            set((state) => ({
              ...state,
              workflow: {
                ...state.workflow,
                steps: state.workflow.steps.map((step) =>
                  step.name === stepName ? { ...step, ...updates } : step,
                ),
              },
            })),
          setTrackingExecutionId: (executionId) =>
            set((state) => ({
              ...state,
              trackingExecutionId: executionId,
            })),
          resetToOriginalWorkflow: () =>
            set((state) => ({
              ...state,
              workflow: state.originalWorkflow,
            })),
        },
      }),
      {
        name: `workflow-store-${encodeURIComponent(
          initialState.workflow.id,
        ).slice(0, 200)}`,
        storage: createJSONStorage(() => localStorage),
        partialize: (state) => ({
          workflow: state.workflow,
          trackingExecutionId: state.trackingExecutionId,
          currentStepName: state.currentStepName,
        }),
      },
    ),
  );
};

export function WorkflowStoreProvider({
  children,
  workflow,
}: {
  children: React.ReactNode;
  workflow: Workflow;
}) {
  const [store] = useState(() =>
    createWorkflowStore({
      originalWorkflow: workflow,
      workflow,
      currentStepName: workflow.steps[0]?.name ?? undefined,
      trackingExecutionId: undefined,
      activeTab: "input",
    }),
  );

  return (
    <WorkflowStoreContext.Provider value={store}>
      {children}
    </WorkflowStoreContext.Provider>
  );
}
function useWorkflowStore<T>(
  selector: (state: Store) => T,
  equalityFn?: (a: T, b: T) => boolean,
): T {
  const store = useContext(WorkflowStoreContext);
  if (!store) {
    throw new Error(
      "Missing WorkflowStoreProvider - refresh the page. If the error persists, please contact support.",
    );
  }
  return useStoreWithEqualityFn(store, selector, equalityFn ?? shallow);
}

export function useWorkflow() {
  return useWorkflowStore((state) => state.workflow);
}

export function useWorkflowActions() {
  return useWorkflowStore((state) => state.actions);
}

export function useCurrentStepName() {
  return useWorkflowStore((state) => state.currentStepName);
}

export function useCurrentStep() {
  const currentStepName = useCurrentStepName();
  const workflow = useWorkflowStore((state) => state.workflow);
  const exact = workflow.steps.find((step) => step.name === currentStepName);
  if (exact) {
    return exact;
  }
  // Check for iteration match "stepName[index]"
  if (currentStepName && currentStepName.includes("[")) {
    const match = currentStepName.match(/^(.+)\[(\d+)\]$/);
    if (match) {
      const parentName = match[1];
      const parentStep = workflow.steps.find((s) => s.name === parentName);
      if (parentStep) {
        return {
          ...parentStep,
          name: currentStepName,
          description: `Iteration ${match[2]} of ${parentName}`,
          config: { ...parentStep.config, forEach: undefined }, // Treat as single execution
        };
      }
    }
  }
  return undefined;
}

export function useActiveTab() {
  return useWorkflowStore((state) => state.activeTab);
}

export function useWorkflowSteps() {
  const workflow = useWorkflowStore((state) => state.workflow);
  return workflow.steps;
}

export function useTrackingExecutionId() {
  return useWorkflowStore((state) => state.trackingExecutionId);
}
