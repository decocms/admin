import { createStore, StoreApi } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { useStoreWithEqualityFn } from "zustand/traditional";
import { shallow } from "zustand/vanilla/shallow";
import {
  Workflow,
  DEFAULT_TOOL_STEP,
  DEFAULT_CODE_STEP,
  DEFAULT_SLEEP_STEP,
  DEFAULT_WAIT_FOR_SIGNAL_STEP,
} from "@decocms/bindings/workflow";
import { Step, ToolCallAction } from "@decocms/bindings/workflow";
import { createContext, useContext, useState } from "react";

type ActiveTab = "input" | "output" | "action";
export type StepType = "tool" | "code" | "sleep" | "wait_for_signal";

interface State {
  originalWorkflow: Workflow;
  draftStep: Step | null;
  isAddingStep: boolean;
  workflow: Workflow;
  trackingExecutionId: string | undefined;
  activeTab: ActiveTab;
  currentStepName: string | undefined;
}

interface Actions {
  setToolAction: (toolAction: ToolCallAction) => void;
  appendStep: ({ step, type }: { step?: Step; type: StepType }) => void;
  setDraftStep: (draftStep: Step | null) => void;
  setIsAddingStep: (isAddingStep: boolean) => void;
  deleteStep: (stepName: string) => void;
  setCurrentStepName: (stepName: string) => void;
  updateStep: (stepName: string, updates: Partial<Step>) => void;
  setTrackingExecutionId: (executionId: string | undefined) => void;
  setActiveTab: (activeTab: ActiveTab) => void;
  resetToOriginalWorkflow: () => void;
  /** Start the add step flow - user selects type first */
  startAddingStep: (type: StepType) => void;
  /** Cancel the add step flow */
  cancelAddingStep: () => void;
  /** Complete add step by selecting parent step */
  completeAddingStep: () => void;
  addDependencyToDraftStep: (stepName: string) => void;
  setOriginalWorkflow: (workflow: Workflow) => void;
}

interface Store extends State {
  actions: Actions;
}

function generateUniqueName(baseName: string, existingSteps: Step[]): string {
  const trimmedName = baseName.trim();
  const exists = existingSteps.some(
    (s) => s.name.toLowerCase() === trimmedName.toLowerCase(),
  );
  if (!exists) return trimmedName;
  return `${trimmedName}_${Math.random().toString(36).substring(2, 6)}`;
}

function createDefaultStep(type: StepType, index: number): Step {
  switch (type) {
    case "tool":
      return { ...DEFAULT_TOOL_STEP, name: `Step_${index + 1}` };
    case "code":
      return { ...DEFAULT_CODE_STEP, name: `Step_${index + 1}` };
    case "sleep":
      return { ...DEFAULT_SLEEP_STEP, name: `Step_${index + 1}` };
    case "wait_for_signal":
      return { ...DEFAULT_WAIT_FOR_SIGNAL_STEP, name: `Step_${index + 1}` };
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
          setIsAddingStep: (isAddingStep) =>
            set((state) => ({
              ...state,
              isAddingStep: isAddingStep,
            })),
          setDraftStep: (draftStep) =>
            set((state) => ({
              ...state,
              draftStep: draftStep,
            })),
          setActiveTab: (activeTab) =>
            set((state) => ({
              ...state,
              activeTab: activeTab,
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
          startAddingStep: (type: StepType) =>
            set((state) => ({
              ...state,
              isAddingStep: true,
              draftStep: createDefaultStep(
                type,
                Number((Math.random() * 1000000).toFixed(0)),
              ),
            })),
          cancelAddingStep: () =>
            set((state) => ({
              ...state,
              draftStep: null,
              isAddingStep: false,
            })),
          addDependencyToDraftStep: (stepName: string) =>
            set((state) => {
              const draftStep = state.draftStep;
              const step = state.workflow.steps.find(
                (s) => s.name === stepName,
              );
              if (!draftStep || !step) return state;
              return {
                ...state,
                draftStep: {
                  ...draftStep,
                  input: {
                    ...draftStep.input,
                    _dependsOn: `@${stepName}`,
                  },
                },
              };
            }),
          completeAddingStep: () =>
            set((state) => {
              const draftStep = state.draftStep;
              if (!draftStep) return state;
              const newName = generateUniqueName(
                draftStep.name,
                state.workflow.steps,
              );
              return {
                ...state,
                draftStep: null,
                isAddingStep: false,
                workflow: {
                  ...state.workflow,
                  steps: [
                    ...state.workflow.steps,
                    { ...draftStep, name: newName },
                  ],
                },
                currentStepName: newName,
              };
            }),
          setOriginalWorkflow: (workflow) =>
            set((state) => ({
              ...state,
              originalWorkflow: workflow,
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
          draftStep: state.draftStep,
          activeTab: state.activeTab,
          originalWorkflow: state.originalWorkflow,
          isAddingStep: state.isAddingStep,
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
      isAddingStep: false,
      currentStepName: undefined,
      trackingExecutionId: undefined,
      activeTab: "input",
      draftStep: null,
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
  const draftStep = useDraftStep();
  const exact = workflow.steps.find((step) => step.name === currentStepName);
  if (exact) return exact;
  if (draftStep) return draftStep;
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
  const draftStep = useDraftStep();
  const allSteps = (() => {
    return [...workflow.steps, draftStep].filter((step) => step !== null);
  })();
  return allSteps;
}

export function useIsDirty() {
  const workflow = useWorkflow();
  const originalWorkflow = useWorkflowStore((state) => state.originalWorkflow);
  return JSON.stringify(workflow) !== JSON.stringify(originalWorkflow);
}

export function useTrackingExecutionId() {
  return useWorkflowStore((state) => state.trackingExecutionId);
}

export function useIsAddingStep() {
  return useWorkflowStore((state) => state.isAddingStep);
}

export function useDraftStep() {
  return useWorkflowStore((state) => state.draftStep);
}

export function useIsDraftStep(stepName: string) {
  return useWorkflowStore((state) => state.draftStep?.name === stepName);
}
