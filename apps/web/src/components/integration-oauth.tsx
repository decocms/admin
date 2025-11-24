import { FormProvider, useForm, UseFormReturn } from "react-hook-form";
import type { JSONSchema7 } from "json-schema";
import JsonSchemaForm from "./json-schema/index.tsx";
import { generateDefaultValues } from "./json-schema/utils/generate-default-values.ts";
import { RefObject } from "react";
import { ajvResolver } from "./json-schema/index.tsx";

interface IntegrationBindingFormProps {
  schema: JSONSchema7;
  formRef: RefObject<UseFormReturn<Record<string, unknown>> | null>;
}
const noop = () => {};
export function IntegrationBindingForm({
  schema,
  formRef,
}: IntegrationBindingFormProps) {
  const form = useForm<Record<string, unknown>>({
    defaultValues: generateDefaultValues(schema),
    // oxlint-disable-next-line no-explicit-any
    resolver: ajvResolver(schema as any),
  });

  formRef.current = form;

  return (
    <FormProvider {...form}>
      <JsonSchemaForm
        schema={schema}
        form={form}
        onSubmit={noop}
        submitButton={null}
      />
    </FormProvider>
  );
}
