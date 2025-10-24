import { memo, startTransition, useCallback, useMemo } from "react";
import {
  useIsFirstStep,
  useWorkflowActions,
  useWorkflowStepDefinition,
  useWorkflowStepInput,
} from "../../../stores/workflows/hooks.ts";
import { JSONSchema7 } from "json-schema";
import { useWorkflowAvailableRefs } from "../../../hooks/use-workflow-available-refs.ts";
import { useForm } from "react-hook-form";
import { Form } from "@deco/ui/components/form.tsx";
import {
  NestedObjectField,
  WorkflowStepField,
} from "../workflow-step-field.tsx";
import { useStepRunner } from "./use-step-runner";

export const WorkflowStepInput = memo(
  function StepInput({ stepName }: { stepName: string }) {
    const actions = useWorkflowActions();
    const currentStepInput = useWorkflowStepInput(stepName);
    const stepDefinition = useWorkflowStepDefinition(stepName);
    const isFirstStep = useIsFirstStep(stepName);
    const { runStep, isSubmitting } = useStepRunner(stepName);

    const stepInputSchema = useMemo(() => {
      return stepDefinition?.inputSchema as JSONSchema7;
    }, [stepDefinition]);

    const availableRefs = useWorkflowAvailableRefs(stepName);

    const initialValues = useMemo<Record<string, unknown>>(() => {
      const input = currentStepInput || {};
      const cleaned: Record<string, unknown> = {};

      const schemaProperties = stepInputSchema?.properties || {};

      for (const key of Object.keys(schemaProperties)) {
        const value = (input as Record<string, unknown>)[key];

        if (isFirstStep) {
          // Skip @ references in first step
          if (typeof value === "string" && value.startsWith("@")) {
            cleaned[key] = "";
            continue;
          }
        }

        cleaned[key] = value ?? "";
      }

      return cleaned;
    }, [currentStepInput, isFirstStep, stepInputSchema]);

    const form = useForm<Record<string, unknown>>({
      values: initialValues,
      mode: "onBlur",
      resetOptions: {
        keepDirtyValues: false,
      },
    });

    const handleBlur = useCallback(() => {
      startTransition(() => {
        const currentData = form.getValues();
        if (currentData && Object.keys(currentData).length > 0) {
          actions.setStepInput(stepName, currentData);
        }
      });
    }, [form, stepName, actions]);

    return (
      <div className="rounded-xl p-4 bg-white shadow-xs">
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((data) => {
              if (data && typeof data === "object") {
                runStep(data as Record<string, unknown>);
              }
            })}
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
          </form>
        </Form>
      </div>
    );
  },
  (prevProps, nextProps) => prevProps.stepName === nextProps.stepName,
);
