import type { StoreApi } from "zustand";
import type { Store } from "../../stores/workflows/store";
import { useWorkflowByUriV2 } from "@deco/sdk";
import { useRef, useEffect, type MutableRefObject } from "react";

export function useWorkflowSync(
  resourceUri: string,
  storeRef: MutableRefObject<StoreApi<Store> | null>,
) {
  const prevHashRef = useRef<string | null>(null);
  const isInitialSyncRef = useRef(true);
  const query = useWorkflowByUriV2(resourceUri);
  const serverWorkflow = query.data?.data;

  useEffect(() => {
    if (!serverWorkflow || !storeRef.current) return;

    // Create a comprehensive hash that includes step definitions and inputs
    // This ensures any change to step properties triggers a sync
    const currentHash = JSON.stringify({
      name: serverWorkflow.name,
      description: serverWorkflow.description,
      steps: serverWorkflow.steps.map((s) => ({
        name: s.def.name,
        title: s.def.title,
        description: s.def.description,
        // Hash the execute code length and first 100 chars to detect changes
        // without including huge code blocks in the hash
        executePreview: s.def.execute?.substring(0, 100),
        executeLength: s.def.execute?.length,
        // Include input/output schemas if present
        hasInputSchema: !!s.def.inputSchema,
        hasOutputSchema: !!s.def.outputSchema,
        // Include dependencies
        dependencies: s.def.dependencies?.map((d) => ({
          integrationId: d.integrationId,
          toolNames: d.toolNames,
        })),
        // Include step input mappings (e.g., "@input.name" or "@previous-step.output")
        input: s.input,
      })),
    });

    // Skip the very first sync when store is initialized with the same data
    if (isInitialSyncRef.current) {
      isInitialSyncRef.current = false;
      prevHashRef.current = currentHash;
      if (import.meta.env.DEV) {
        console.log(
          `[WF Sync] initial sync (skipped) name=${serverWorkflow.name} steps=${serverWorkflow.steps.length}`,
        );
      }
      return;
    }

    if (prevHashRef.current === currentHash) {
      if (import.meta.env.DEV) {
        console.log(
          `[WF Sync] skipped (same hash) name=${serverWorkflow.name} steps=${serverWorkflow.steps.length}`,
        );
      }
      return;
    }
    prevHashRef.current = currentHash;

    const store = storeRef.current;
    const state = store.getState();
    const beforeSteps = state.workflow.steps.length;
    const result = state.handleExternalUpdate(serverWorkflow);
    const afterSteps = store.getState().workflow.steps.length;

    if (import.meta.env.DEV) {
      console.log(
        `[WF Sync] result=${result.applied ? "applied" : "queued"} reason="${result.reason}" steps: ${beforeSteps} → ${afterSteps}`,
      );
    }
  }, [serverWorkflow, storeRef]);

  return query;
}
