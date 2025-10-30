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
import { generateDefaultValue } from "../../json-schema/utils/generate-default-value.ts";

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

        // Keep the value as is (including @ references)
        // The WorkflowStepField component will handle reference mode display
        if (value !== null && value !== undefined) {
          cleaned[key] = value;
        } else {
          // Generate type-appropriate default based on schema
          const propertySchema = schemaProperties[key] as JSONSchema7;
          cleaned[key] = generateDefaultValue(propertySchema);
        }
      }

      return cleaned;
    }, [currentStepInput, stepInputSchema]);

    const form = useForm<Record<string, unknown>>({
      values: initialValues,
      mode: "onBlur",
      resetOptions: {
        keepDirtyValues: false,
      },
    });

    const isDirty = form.formState.isDirty;

    const handleBlur = useCallback(() => {
      startTransition(() => {
        const currentData = form.getValues();
        if (isDirty && currentData && Object.keys(currentData).length > 0) {
          actions.setStepInput(stepName, currentData);
        }
      });
    }, [form, stepName, actions, isDirty]);

    // Early return if schema or properties are not available
    if (!stepInputSchema?.properties) {
      return null;
    }

    return (
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit((data) => {
            if (data && typeof data === "object") {
              runStep(data as Record<string, unknown>);
            }
          })}
          onBlur={handleBlur}
          className="flex flex-col gap-5 min-w-0 overflow-hidden"
        >
          {Object.entries(stepInputSchema.properties).map(
            ([propName, propSchema]) => {
              const isRequired =
                stepInputSchema.required?.includes(propName) ?? false;
              const schema = propSchema as JSONSchema7;

              // Check if the current value is a reference
              const currentValue = (
                currentStepInput as Record<string, unknown>
              )?.[propName];
              const isReferenceValue =
                typeof currentValue === "string" &&
                currentValue.startsWith("@");

              // If it's an object with properties AND not a reference, render as nested object
              if (
                schema.type === "object" &&
                schema.properties &&
                !isReferenceValue
              ) {
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

              // Otherwise render as a regular field (which handles references)
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
    );
  },
  (prevProps, nextProps) => prevProps.stepName === nextProps.stepName,
);
