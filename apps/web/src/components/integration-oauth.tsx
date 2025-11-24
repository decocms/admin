import { FormProvider, useForm, UseFormReturn } from "react-hook-form";
import type { JSONSchema7 } from "json-schema";
import JsonSchemaForm from "./json-schema/index.tsx";
import { generateDefaultValues } from "./json-schema/utils/generate-default-values.ts";
import type { ContractState } from "@deco/sdk/mcp";
import { MicroDollar } from "@deco/sdk/mcp/wallet";
import { RefObject } from "react";
import { Icon } from "@deco/ui/components/icon.tsx";
import { ajvResolver } from "./json-schema/index.tsx";

interface Permission {
  scope: string;
  description: string;
}

interface IntegrationPermissionsProps {
  integrationName: string;
  permissions?: Permission[];
}

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

function ContractClauses({ contract }: { contract: ContractState }) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold mb-4">Pricing Information</h3>
      <div className="space-y-3">
        {contract.clauses.map((clause) => {
          const formatPrice = (price: string | number): string => {
            if (typeof price === "number") {
              return new Intl.NumberFormat("en-US", {
                style: "currency",
                currency: "USD",
                maximumFractionDigits: 6,
              }).format(price);
            }

            // Handle microdollar string
            try {
              return MicroDollar.from(price).display({
                showAllDecimals: true,
              });
            } catch {
              return `$${price}`;
            }
          };

          return (
            <div
              key={clause.id}
              className="flex items-center justify-between p-3 border rounded-lg bg-muted/20"
            >
              <div className="flex-1">
                <div className="font-medium text-sm">{clause.id}</div>
                {clause.description && (
                  <div className="text-xs text-muted-foreground mt-1">
                    {clause.description}
                  </div>
                )}
              </div>
              <div className="text-right">
                <div className="font-semibold text-sm">
                  {formatPrice(clause.price)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
