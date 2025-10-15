import { createStore, StoreApi, useStore } from "zustand";
import { createContext, useContext, useState, useMemo } from "react";
import { client } from "@/lib/rpc";
import { persist } from "zustand/middleware";
import { useSearch } from "@tanstack/react-router";
import { WORKFLOW } from "./mock";

const STORAGE_KEY = "workflowz-storage";

type Workflow = NonNullable<
  Awaited<ReturnType<typeof client.READ_WORKFLOW>>
>["workflow"];
type WorkflowStep = NonNullable<Workflow>["steps"][number];

interface State {
  workflow: Workflow;
  currentStepIndex: number;
  // PERFORMANCE: Cache step index lookup to avoid repeated find() calls
  _stepIndexMap: Map<string, number>;
}

interface Actions {
  setCurrentStepIndex: (index: number) => void;
  updateWorkflow: (updates: Partial<Workflow>) => void;
  updateStep: (stepId: string, updates: Partial<WorkflowStep>) => void;
  updateStepInput: (stepId: string, fieldKey: string, value: string) => void;
  updateDependencyToolCalls: () => void;
  addStep: (step: WorkflowStep) => void;
  removeStep: (stepId: string) => void;
  clearStore: () => void;
}

interface Store extends State {
  actions: Actions;
}

// PERFORMANCE: Helper to build step index map
function buildStepIndexMap(steps: WorkflowStep[]): Map<string, number> {
  const map = new Map<string, number>();
  steps.forEach((step, index) => {
    map.set(step.def.name, index);
  });
  return map;
}

const WorkflowStoreContext = createContext<StoreApi<Store> | null>(null);

export const WorkflowStoreProvider = ({
  children,
  workflow,
}: {
  children: React.ReactNode;
  workflow: Workflow;
}) => {
  const [store] = useState(() =>
    createStore<Store>()(
      persist(
        (set, get) => ({
          workflow,
          currentStepIndex: 0,
          _stepIndexMap: buildStepIndexMap(workflow.steps),
          actions: {
            setCurrentStepIndex: (index: number) => {
              set(() => ({
                currentStepIndex: index,
              }));
            },
            updateWorkflow: (updates: Partial<Workflow>) => {
              const newWorkflow = { ...get().workflow, ...updates };
              set(() => ({
                workflow: newWorkflow,
                _stepIndexMap: buildStepIndexMap(newWorkflow.steps),
              }));
            },
            updateStep: (stepId: string, updates: Partial<WorkflowStep>) => {
              const currentState = get();
              const stepIndex = currentState._stepIndexMap.get(stepId);

              // If step not found, do nothing
              if (stepIndex === undefined) return;

              // PERFORMANCE: Create new steps array with only the changed step
              // All other steps maintain their references (crucial for React.memo)
              const newSteps = [...currentState.workflow.steps];
              newSteps[stepIndex] = { ...newSteps[stepIndex], ...updates };

              set({
                workflow: {
                  ...currentState.workflow,
                  steps: newSteps,
                } as Workflow,
                // Index map doesn't change when updating step content
                _stepIndexMap: currentState._stepIndexMap,
              });
            },
            // PERFORMANCE: Granular input field update
            // Updates ONLY a single input field without recreating the entire input object
            // This prevents unnecessary re-renders of other fields' editors
            updateStepInput: (
              stepId: string,
              fieldKey: string,
              value: string,
            ) => {
              const currentState = get();
              const stepIndex = currentState._stepIndexMap.get(stepId);

              if (stepIndex === undefined) return;

              const currentStep = currentState.workflow.steps[stepIndex];
              const currentInput = (currentStep as any).input || {};

              // CRITICAL: Skip update if value hasn't actually changed
              // This prevents unnecessary re-renders when debounce fires with same value
              if (currentInput[fieldKey] === value) return;

              // PERFORMANCE: Only create new input object if value changed
              const newInput = { ...currentInput, [fieldKey]: value };

              const newSteps = [...currentState.workflow.steps];
              newSteps[stepIndex] = { ...currentStep, input: newInput } as any;

              set({
                workflow: {
                  ...currentState.workflow,
                  steps: newSteps,
                } as Workflow,
                _stepIndexMap: currentState._stepIndexMap,
              });
            },
            addStep: (step: WorkflowStep) => {
              const currentState = get();
              const newSteps = [...currentState.workflow.steps, step];
              set({
                workflow: {
                  ...currentState.workflow,
                  steps: newSteps,
                } as Workflow,
                currentStepIndex: newSteps.length - 1,
                _stepIndexMap: buildStepIndexMap(newSteps),
              });
            },
            removeStep: (stepId: string) => {
              const currentState = get();
              const newSteps = currentState.workflow.steps.filter(
                (step: WorkflowStep) => step.def.name !== stepId,
              );
              set({
                workflow: {
                  ...currentState.workflow,
                  steps: newSteps,
                } as Workflow,
                currentStepIndex: Math.min(
                  currentState.currentStepIndex,
                  newSteps.length - 1,
                ),
                _stepIndexMap: buildStepIndexMap(newSteps),
              });
            },
            updateDependencyToolCalls: () => {
              type DependencyEntry = { integrationId: string };
              const allToolsMap = new Map<string, DependencyEntry>();
              const currentState = get();

              currentState.workflow.steps.forEach((step: WorkflowStep) => {
                if (step.type === "code" && "dependencies" in step.def) {
                  step.def.dependencies?.forEach(
                    (dependency: DependencyEntry) => {
                      const key = `${dependency.integrationId}`;
                      if (!allToolsMap.has(key)) {
                        allToolsMap.set(key, dependency);
                      }
                    },
                  );
                }
              });

              const dependencyToolCalls = Array.from(allToolsMap.values());

              console.log(
                `📦 Updated dependencyToolCalls: ${dependencyToolCalls.length} unique tools`,
              );

              const updatedWorkflow = {
                ...currentState.workflow,
                dependencyToolCalls,
                updatedAt: new Date().toISOString(),
              };

              set(() => ({
                workflow: updatedWorkflow,
                // Steps array didn't change, so index map stays the same
                _stepIndexMap: currentState._stepIndexMap,
              }));
            },
            clearStore: () => {
              const currentState = get();
              set({
                workflow: {
                  ...currentState.workflow,
                  steps: [] as any,
                } as Workflow,
                currentStepIndex: 0,
                _stepIndexMap: new Map(),
              });
            },
          },
        }),
        {
          name: STORAGE_KEY,
          // PERFORMANCE: Only persist what we need, exclude cache
          partialize: (state) => ({
            workflow: state.workflow,
            currentStepIndex: state.currentStepIndex,
            // Don't persist _stepIndexMap - rebuild on load
          }),
          // PERFORMANCE: Prevent unnecessary storage writes
          // Only update storage when workflow or currentStepIndex actually change
          version: 1,
        },
      ),
    ),
  );

  return (
    <WorkflowStoreContext.Provider value={store}>
      {children}
    </WorkflowStoreContext.Provider>
  );
};

export const WorkflowProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const searchParams = useSearch({ from: "/workflow" });
  const resourceURI = (searchParams as { resourceURI?: string })?.resourceURI;
  // Fetch workflow from API if resourceURI is provided
  // const {
  //   data: workflowData,
  //   isLoading: isLoadingWorkflow,
  // } = useQuery({
  //   queryKey: ["workflow", resourceURI],
  //   queryFn: async () => {
  //     if (!resourceURI) return null;
  //     return await client.READ_WORKFLOW({ uri: resourceURI });
  //   },
  //   enabled: !!resourceURI,
  // });

  //   if (!workflowData || isLoadingWorkflow || !resourceURI) {
  //     return (
  //       <div className="flex items-center justify-center h-screen text-muted-foreground">
  //         <div className="flex flex-col items-center gap-4">
  //           <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
  //           <p>Loading workflow...</p>
  //         </div>
  //       </div>
  //     );
  //   }
  // Transform steps to match expected schema (id -> name, code -> execute)
  // Memoize this to prevent recreating on every render
  type MockedStep = (typeof WORKFLOW.steps)[number];
  const transformedSteps = useMemo(
    () =>
      WORKFLOW.steps.map((step: MockedStep) => ({
        type: "code" as const,
        def: {
          name: step.id, // Use id as the unique identifier
          description: step.description || "",
          execute:
            step.code ||
            "export default async function(input, ctx) { return input; }",
          inputSchema: step.inputSchema,
          outputSchema: step.outputSchema,
          prompt: step.name, // Store the display name in prompt
        },
        // Keep input and output at step level, not under def
        input: step.input,
        output: step.output,
      })),
    [],
  );

  const defaultWorkflow = useMemo(
    () => ({
      id: WORKFLOW.id,
      name: WORKFLOW.name,
      description: WORKFLOW.description,
      inputSchema: WORKFLOW.inputSchema,
      outputSchema: WORKFLOW.outputSchema,
      steps: transformedSteps,
      createdAt: WORKFLOW.createdAt,
      updatedAt: WORKFLOW.updatedAt,
    }),
    [transformedSteps],
  );

  const finalWorkflow = useMemo(
    () =>
      ({
        ...defaultWorkflow,
        uri: resourceURI || "",
      }) as unknown as Workflow,
    [defaultWorkflow, resourceURI],
  );

  return (
    <WorkflowStoreProvider workflow={finalWorkflow}>
      {children}
    </WorkflowStoreProvider>
  );
};

function useWorkflowStore<T>(selector: (state: Store) => T): T {
  const store = useContext(WorkflowStoreContext);
  if (!store) {
    throw new Error("Missing WorkflowStoreProvider");
  }
  return useStore(store, selector);
}

// ============================================================================
// ACTIONS SELECTOR (Stable - never causes re-renders)
// ============================================================================
export const useWorkflowStoreActions = () =>
  useWorkflowStore((state) => state.actions);

// ============================================================================
// ATOMIC SELECTORS (Return primitives or use custom equality)
// ============================================================================

// Returns the full workflow data object (use sparingly!)
export const useCurrentWorkflow = () => {
  return useWorkflowStore((state) => state.workflow);
};

// Returns ONLY the length (primitive) - no re-renders on step content changes
export const useWorkflowStepsLength = () => {
  return useWorkflowStore((state) => state.workflow.steps?.length || 0);
};

// Returns ONLY the current step index (primitive)
export const useCurrentStepIndex = () => {
  return useWorkflowStore((state) => state.currentStepIndex);
};

// Returns ONLY the auth token (primitive)
export const useWorkflowAuthToken = (): string | undefined => {
  return useWorkflowStore((state) => state.workflow.authorization?.token);
};

// Returns new step prompt (primitive string)
export const useNewStepPrompt = () => {
  return useWorkflowStore((state) => {
    console.log({ workflow: state.workflow });
    const stepIndex = state.currentStepIndex - 1;
    if (stepIndex >= 0 && stepIndex < state.workflow.steps.length) {
      const step = state.workflow.steps[stepIndex];
      if (step?.type === "code" && "prompt" in step.def) {
        return step.def.prompt || "";
      }
    }
    return "";
  });
};

// ============================================================================
// COMPUTED SELECTORS (Return derived primitives)
// ============================================================================

// Returns comma-separated step IDs (primitive string, not array)
// Use this instead of full steps array when you only need IDs
export const useWorkflowStepIds = (): string => {
  return useWorkflowStore(
    (state) =>
      state.workflow.steps?.map((s: WorkflowStep) => s.def.name).join(",") ||
      "",
  );
};

// Returns the index of a step by name (primitive number)
// PERFORMANCE: Use index map for O(1) lookup instead of O(n) findIndex()
export const useWorkflowStepIndex = (stepName: string): number => {
  return useWorkflowStore((state) => state._stepIndexMap.get(stepName) ?? -1);
};

// PERFORMANCE: Instead of subscribing to previous step outputs during render,
// components should use useWorkflowStoreContext().getState() to access previous
// step data imperatively when needed (e.g., during execution)

// ============================================================================
// ARRAY SELECTORS (Use with caution - can cause re-renders)
// ============================================================================

// Returns array - AVOID using this, prefer useWorkflowStepIds or useWorkflowStepByName
// Only use when you absolutely need the full array of steps
export const useWorkflowStepsArray = (): WorkflowStep[] => {
  return useWorkflowStore((state: Store) => state.workflow.steps || []);
};

// OPTIMIZED: Selector that only subscribes to a specific step by name
// PERFORMANCE: Use index-based lookup to maintain stable references!
// Using find() creates new references every time, causing unnecessary re-renders.
// PERFORMANCE: Shallow compare two objects
function shallowEqual(objA: any, objB: any): boolean {
  if (objA === objB) return true;
  if (!objA || !objB) return false;

  const keysA = Object.keys(objA);
  const keysB = Object.keys(objB);

  if (keysA.length !== keysB.length) return false;

  for (const key of keysA) {
    if (objA[key] !== objB[key]) return false;
  }

  return true;
}

export const useWorkflowStepByName = (
  stepName: string,
): WorkflowStep | undefined => {
  return (useWorkflowStore as any)(
    (state: Store) => {
      // CRITICAL: Use index map for O(1) lookup instead of O(n) find()
      // More importantly, this returns the actual step reference from the array,
      // which stays stable when other steps change
      const stepIndex = state._stepIndexMap.get(stepName);
      if (stepIndex === undefined) return undefined;
      return state.workflow.steps[stepIndex];
    },
    (prev: WorkflowStep | undefined, next: WorkflowStep | undefined) => {
      // PERFORMANCE: Reference equality is the fastest check
      // Since we maintain stable references in the store, this works perfectly
      if (prev === next) return true;

      // If both undefined, they're equal
      if (!prev && !next) return true;

      // If only one is undefined, they're not equal
      if (!prev || !next) return false;

      // PERFORMANCE: Check critical properties

      // Check if def changed (contains schema, code, name, etc.)
      if (prev.def !== next.def) return false;

      // Check if output changed (execution results)
      if ((prev as any).output !== (next as any).output) return false;

      // CRITICAL PERFORMANCE FIX: Use shallow equality for input
      // This prevents unnecessary re-renders when only one field changes
      // Reference equality would trigger re-renders on EVERY keystroke
      // Shallow equality only triggers when fields actually change
      if (!shallowEqual((prev as any).input, (next as any).input)) return false;

      // All critical properties are the same - consider equal
      return true;
    },
  );
};
