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

    const currentHash = JSON.stringify({
      name: serverWorkflow.name,
      description: serverWorkflow.description,
      stepsCount: serverWorkflow.steps.length,
      stepNames: serverWorkflow.steps.map((s) => s.def.name),
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
