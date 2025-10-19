import {
  memo,
  startTransition,
  Suspense,
  useCallback,
  useContext,
  useDeferredValue,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  useIsFirstStep,
  useWorkflowActions,
  useWorkflowFirstStepInput,
  useWorkflowStepDefinition,
  useWorkflowStepInput,
  useWorkflowStepNames,
  useWorkflowStepOutputs,
  useWorkflowUri,
  type Store,
} from "../../stores/workflows";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useResourceRoute } from "../resources-v2/route-context";
import { callTool, useSDK } from "@deco/sdk";
import { JSONSchema7 } from "json-schema";
import { useWorkflowAvailableRefs } from "../../hooks/use-workflow-available-refs";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { useForm } from "react-hook-form";
import { Form } from "@deco/ui/components/form.tsx";
import { toast } from "@deco/ui/components/sonner.tsx";
import { WorkflowStepCard } from "../workflows/workflow-step-card";
import { resolveAtRefsInInput, unwrapMCPResponse } from "./utils";
import { NestedObjectField, WorkflowStepField } from "./workflow-step-field";
import { WorkflowStoreContext } from "../../stores/workflows/provider";

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

  useLayoutEffect(() => {
    if (!store || !parentRef.current) return;

    let previousCount = store.getState().workflow.steps.length;

    const unsubscribe = store.subscribe((state: Store) => {
      const currentCount = state.workflow.steps.length;

      if (currentCount > previousCount && currentCount > 0) {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            if (!parentRef.current) return;

            parentRef.current.scrollTo({
              top: parentRef.current.scrollHeight,
              behavior: "smooth",
            });
          });
        });
      }

      previousCount = currentCount;
    });

    return unsubscribe;
  }, [store]);

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
                    <WorkflowStepCard stepName={stepName} type="definition" />
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

export const WorkflowStepInput = memo(
  function StepInput({ stepName }: { stepName: string }) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { connection } = useResourceRoute();
    const actions = useWorkflowActions();
    const workflowUri = useWorkflowUri();
    const { locator } = useSDK();
    const stepOutputs = useWorkflowStepOutputs();
    const currentStepInput = useWorkflowStepInput(stepName);
    const stepDefinition = useWorkflowStepDefinition(stepName);
    const firstStepInput = useWorkflowFirstStepInput();
    const isFirstStep = useIsFirstStep(stepName);

    const stepInputSchema = useMemo(() => {
      return stepDefinition?.inputSchema as JSONSchema7 | undefined;
    }, [stepDefinition]);

    const availableRefs = useWorkflowAvailableRefs(stepName);

    const initialValues = useMemo<Record<string, unknown>>(() => {
      const input = currentStepInput || {};
      const cleaned: Record<string, unknown> = {};

      if (isFirstStep) {
        for (const [key, value] of Object.entries(
          input as Record<string, unknown>,
        )) {
          if (typeof value === "string" && value.startsWith("@")) {
            continue;
          }
          cleaned[key] = value ?? "";
        }
      } else {
        for (const [key, value] of Object.entries(
          input as Record<string, unknown>,
        )) {
          cleaned[key] = value ?? "";
        }
      }

      return cleaned;
    }, [stepName]);

    const form = useForm<Record<string, unknown>>({
      defaultValues: initialValues,
      mode: "onBlur",
    });

    const handleBlur = useCallback(() => {
      startTransition(() => {
        const currentData = form.getValues();
        if (currentData && Object.keys(currentData).length > 0) {
          actions.setStepInput(stepName, currentData);
        }
      });
    }, [form, stepName, actions]);

    const handleFormSubmit = useCallback(
      async (data: Record<string, unknown>) => {
        if (!connection || !workflowUri) return;

        try {
          setIsSubmitting(true);
          actions.setStepExecutionStart(stepName);

          const { resolved, errors } = resolveAtRefsInInput(
            data,
            stepOutputs,
            firstStepInput,
          );

          if (errors && errors.length > 0) {
            const errorMessages = errors
              .map((e) => `${e.ref}: ${e.error}`)
              .join("\n");
            throw new Error(`Failed to resolve references:\n${errorMessages}`);
          }

          actions.setStepInput(stepName, data);

          const result = await callTool(
            connection,
            {
              name: "DECO_WORKFLOW_RUN_STEP",
              arguments: {
                tool: stepDefinition,
                input: resolved,
              },
            },
            locator,
          );

          if (result.error) {
            throw new Error(
              `Tool execution failed: ${typeof result.error === "string" ? result.error : JSON.stringify(result.error)}`,
            );
          }

          if (result.isError) {
            const errorMessage =
              (Array.isArray(result.content) && result.content[0]?.text) ||
              "Unknown error";
            throw new Error(`Tool execution failed: ${errorMessage}`);
          }

          const stepOutput = unwrapMCPResponse(result.structuredContent);

          const outputKey = stepDefinition?.name ?? stepName;

          if (stepOutput !== undefined) {
            actions.setStepOutput(outputKey, stepOutput);
          }

          actions.setStepExecutionEnd(stepName, true);
          toast.success("Step executed successfully!");
        } catch (error) {
          console.error("Failed to run step", error);

          const errorObj =
            error instanceof Error
              ? { name: error.name, message: error.message }
              : { name: "Error", message: String(error) };
          actions.setStepExecutionEnd(stepName, false, errorObj);

          toast.error(
            error instanceof Error ? error.message : "Failed to run step",
          );
        } finally {
          setIsSubmitting(false);
        }
      },
      [
        connection,
        workflowUri,
        stepName,
        stepOutputs,
        firstStepInput,
        stepDefinition,
        locator,
        actions,
      ],
    );

    const hasProperties =
      stepInputSchema &&
      typeof stepInputSchema === "object" &&
      "properties" in stepInputSchema &&
      stepInputSchema.properties &&
      Object.keys(stepInputSchema.properties).length > 0;

    if (!hasProperties) {
      return (
        <div className="bg-gradient-to-br from-muted/30 to-muted/10 rounded-xl p-8 border border-dashed">
          <div className="flex flex-col items-center justify-center text-center gap-4">
            <div className="rounded-full bg-primary/10 p-4">
              <Icon name="check_circle" size={32} className="text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium mb-1">Ready to Execute</p>
              <p className="text-xs text-muted-foreground">
                This step does not require any input parameters
              </p>
            </div>
            <Button
              disabled={isSubmitting}
              size="lg"
              onClick={() => handleFormSubmit({})}
              className="min-w-[200px] flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Spinner size="xs" />
                  Running...
                </>
              ) : (
                <>
                  <Icon name="play_arrow" size={18} />
                  Run Step
                </>
              )}
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div className="bg-gradient-to-br from-muted/30 to-muted/10 rounded-xl p-6 border">
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((data) =>
              handleFormSubmit(data as Record<string, unknown>),
            )}
            onBlur={handleBlur}
            className="space-y-6"
          >
            {Object.entries(stepInputSchema.properties!).map(
              ([propName, propSchema]) => {
                const isRequired =
                  stepInputSchema.required?.includes(propName) ?? false;
                const schema = propSchema as JSONSchema7;

                if (schema.type === "object" && schema.properties) {
                  return (
                    <NestedObjectField
                      key={propName}
                      name={propName}
                      schema={schema}
                      form={form}
                      disabled={isSubmitting}
                      availableRefs={availableRefs}
                      isFirstStep={isFirstStep}
                    />
                  );
                }

                return (
                  <WorkflowStepField
                    key={propName}
                    name={propName}
                    schema={schema}
                    form={form}
                    isRequired={isRequired}
                    disabled={isSubmitting}
                    availableRefs={availableRefs}
                    isFirstStep={isFirstStep}
                  />
                );
              },
            )}

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button
                type="submit"
                disabled={isSubmitting}
                size="lg"
                className="min-w-[200px] flex items-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Spinner size="xs" />
                    Running...
                  </>
                ) : (
                  <>
                    <Icon name="play_arrow" size={18} />
                    Run Step
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    );
  },
  (prevProps, nextProps) => prevProps.stepName === nextProps.stepName,
);
