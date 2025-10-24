import { useVirtualizer } from "@tanstack/react-virtual";
import { useWorkflowStepNames } from "../../../stores/workflows/hooks.ts";
import { Store } from "../../../stores/workflows/store.ts";
import { WorkflowStoreContext } from "../../../stores/workflows/provider.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import {
  memo,
  useDeferredValue,
  useRef,
  useContext,
  useLayoutEffect,
  Suspense,
} from "react";
import { WorkflowDefinitionStepCard } from "./card";

export const WorkflowStepsList = memo(function WorkflowStepsList() {
  const stepNames = useWorkflowStepNames();
  const deferredStepNames = useDeferredValue(stepNames);
  const parentRef = useRef<HTMLDivElement>(null);
  const store = useContext(WorkflowStoreContext);

  const virtualizer = useVirtualizer({
    count: deferredStepNames.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 380,
    overscan: 2,
  });

  // Auto-scroll when steps are added
  useLayoutEffect(() => {
    if (!store || !parentRef.current) return;

    let previousCount = store.getState().workflow.steps.length;

    const unsubscribe = store.subscribe((state: Store) => {
      const currentCount = state.workflow.steps.length;

      if (currentCount > previousCount && currentCount > 0) {
        const lastStepIndex = currentCount - 1;

        // Wait for virtualizer to measure the new item
        // Using more RAF frames to ensure measurement is complete
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              // Use 'auto' behavior instead of 'smooth' for dynamic sizing
              virtualizer.scrollToIndex(lastStepIndex, {
                align: "end",
                behavior: "auto", // ✅ Changed from "smooth" to "auto"
              });
            });
          });
        });
      }

      previousCount = currentCount;
    });

    return unsubscribe;
  }, [store, virtualizer]);

  if (!deferredStepNames || deferredStepNames.length === 0) {
    return (
      <div className="text-sm text-muted-foreground italic py-4">
        No steps available yet
      </div>
    );
  }

  return (
    <div
      ref={parentRef}
      className="h-full w-full overflow-auto"
      style={{
        contain: "strict",
      }}
    >
      <div className="flex justify-center">
        <div className="w-full max-w-[700px]">
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              width: "100%",
              position: "relative",
            }}
          >
            {virtualizer.getVirtualItems().map((virtualItem) => {
              const stepName = deferredStepNames[virtualItem.index];
              return (
                <div
                  key={stepName}
                  data-index={virtualItem.index}
                  ref={virtualizer.measureElement}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    transform: `translateY(${virtualItem.start}px)`,
                  }}
                  className="pb-8"
                >
                  <Suspense fallback={<Spinner />}>
                    <WorkflowDefinitionStepCard stepName={stepName} />
                  </Suspense>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
});
