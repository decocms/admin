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
}

interface Actions {
  setCurrentStepIndex: (index: number) => void;
  updateWorkflow: (updates: Partial<Workflow>) => void;
  updateStep: (stepId: string, updates: Partial<WorkflowStep>) => void;
  updateDependencyToolCalls: () => void;
  addStep: (step: WorkflowStep) => void;
  removeStep: (stepId: string) => void;
  clearStore: () => void;
}

interface Store extends State {
  actions: Actions;
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
          actions: {
            setCurrentStepIndex: (index: number) => {
              set(() => ({
                currentStepIndex: index,
              }));
            },
            updateWorkflow: (updates: Partial<Workflow>) => {
              set(() => ({
                workflow: { ...get().workflow, ...updates },
              }));
            },
            updateStep: (stepId: string, updates: Partial<WorkflowStep>) => {
              const currentWorkflow = get().workflow;
              set({
                workflow: {
                  ...currentWorkflow,
                  steps: currentWorkflow.steps.map((step: WorkflowStep) =>
                    step.def.name === stepId ? { ...step, ...updates } : step,
                  ),
                } as Workflow,
              });
            },
            addStep: (step: WorkflowStep) => {
              set(() => ({
                workflow: {
                  ...get().workflow,
                  steps: [...get().workflow.steps, step],
                },
                currentStepIndex: get().workflow.steps.length,
              }));
            },
            removeStep: (stepId: string) => {
              const currentWorkflow = get().workflow;
              set({
                workflow: {
                  ...currentWorkflow,
                  steps: currentWorkflow.steps.filter(
                    (step: WorkflowStep) => step.def.name !== stepId,
                  ),
                } as Workflow,
                currentStepIndex: currentWorkflow.steps.length,
              });
            },
            updateDependencyToolCalls: () => {
              type DependencyEntry = { integrationId: string };
              const allToolsMap = new Map<string, DependencyEntry>();
              get().workflow.steps.forEach((step: WorkflowStep) => {
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
                ...workflow,
                dependencyToolCalls,
                updatedAt: new Date().toISOString(),
              };

              set(() => ({
                workflow: updatedWorkflow,
              }));
            },
            clearStore: () => {
              const currentWorkflow = get().workflow;
              set({
                workflow: {
                  ...currentWorkflow,
                  steps: [] as any,
                } as Workflow,
                currentStepIndex: 0,
              });
            },
          },
        }),
        {
          name: STORAGE_KEY,
          partialize: (state) => ({
            workflow: state.workflow,
            currentStepIndex: state.currentStepIndex,
          }),
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

  return (
    <WorkflowStoreProvider
      workflow={
        {
          ...defaultWorkflow,
          uri: resourceURI || "",
        } as unknown as Workflow
      }
    >
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
export const useWorkflowStepIndex = (stepName: string): number => {
  return useWorkflowStore(
    (state) =>
      state.workflow.steps?.findIndex(
        (s: WorkflowStep) => s.def.name === stepName,
      ) ?? -1,
  );
};

// REMOVED: usePreviousStepsForExecution caused infinite loops
// Components should compute this locally with useMemo instead

// ============================================================================
// ARRAY SELECTORS (Use with caution - can cause re-renders)
// ============================================================================

// Returns array - AVOID using this, prefer useWorkflowStepIds or useWorkflowStepByName
// Only use when you absolutely need the full array of steps
export const useWorkflowStepsArray = (): WorkflowStep[] => {
  return useWorkflowStore((state: Store) => state.workflow.steps || []);
};

// Helper function for deep equality check of objects
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null || b == null) return a === b;
  if (typeof a !== "object" || typeof b !== "object") return a === b;

  const keysA = Object.keys(a as object);
  const keysB = Object.keys(b as object);

  if (keysA.length !== keysB.length) return false;

  for (const key of keysA) {
    if (!keysB.includes(key) || !deepEqual((a as any)[key], (b as any)[key])) {
      return false;
    }
  }

  return true;
}

// OPTIMIZED: Selector that only subscribes to a specific step by name
// Custom equality: only re-render if the step's key properties actually changed
// Returns the full step object, not just def, so components can access output, input, etc.
export const useWorkflowStepByName = (
  stepName: string,
): WorkflowStep | undefined => {
  return (useWorkflowStore as any)(
    (state: Store) =>
      state.workflow.steps?.find((s: WorkflowStep) => s.def.name === stepName),
    (prev: WorkflowStep | undefined, next: WorkflowStep | undefined) => {
      // If both are undefined/null, they're equal
      if (!prev && !next) return true;
      // If only one is undefined/null, they're different
      if (!prev || !next) return false;

      // Quick reference check first (most common case when step didn't change at all)
      if (prev === next) return true;

      // Check if def changed
      if (prev.def !== next.def) {
        // Deep check def properties
        if (
          prev.def.name !== next.def.name ||
          prev.def.description !== next.def.description
        ) {
          return false;
        }

        // Code step properties
        if ("execute" in prev.def && "execute" in next.def) {
          if (
            prev.def.execute !== next.def.execute ||
            !deepEqual(
              "inputSchema" in prev.def ? prev.def.inputSchema : null,
              "inputSchema" in next.def ? next.def.inputSchema : null,
            ) ||
            !deepEqual(
              "outputSchema" in prev.def ? prev.def.outputSchema : null,
              "outputSchema" in next.def ? next.def.outputSchema : null,
            ) ||
            !deepEqual(
              "input" in prev.def ? prev.def.input : null,
              "input" in next.def ? next.def.input : null,
            ) ||
            !deepEqual(
              "dependencies" in prev.def ? prev.def.dependencies : null,
              "dependencies" in next.def ? next.def.dependencies : null,
            )
          ) {
            return false;
          }
        }

        // tool_call type
        if (
          "tool_name" in prev.def &&
          "tool_name" in next.def &&
          "integration" in prev.def &&
          "integration" in next.def
        ) {
          if (
            prev.def.tool_name !== next.def.tool_name ||
            prev.def.integration !== next.def.integration
          ) {
            return false;
          }
        }
      }

      // Check if output changed (important for execution results)
      if (!deepEqual((prev as any).output, (next as any).output)) {
        return false;
      }

      // Check if input changed
      if (!deepEqual((prev as any).input, (next as any).input)) {
        return false;
      }

      return true;
    },
  );
};
