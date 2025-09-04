import { FormProvider, useForm, UseFormReturn } from "react-hook-form";
import { Badge } from "@deco/ui/components/badge.tsx";
import { Separator } from "@deco/ui/components/separator.tsx";
import type { JSONSchema7 } from "json-schema";
import JsonSchemaForm from "./json-schema/index.tsx";
import { generateDefaultValues } from "./json-schema/utils/generate-default-values.ts";
import type { ContractState } from "@deco/sdk/mcp";
import { MicroDollar } from "@deco/sdk/mcp/wallet";
import { RefObject } from "react";

interface Permission {
  scope: string;
  description: string;
}

interface IntegrationPermissionsProps {
  integrationName: string;
  permissions: Permission[];
}

export function IntegrationPermissions({
  integrationName: _integrationName,
  permissions,
}: IntegrationPermissionsProps) {
  return (
    <div className="space-y-4">
      <div className="grid gap-2">
        {permissions.map((permission, index) => (
          <div
            key={index}
            className="flex items-center gap-3 p-3 rounded-lg bg-muted/50"
          >
            <div className="flex-shrink-0 text-success">✓</div>
            <div className="flex-1">
              <div className="text-sm font-medium">
                {permission.description}
              </div>
              <div className="text-xs text-muted-foreground">
                <Badge variant="outline" className="text-xs">
                  {permission.scope}
                </Badge>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface IntegrationBindingFormProps {
  schema: JSONSchema7;
  formRef: RefObject<UseFormReturn<unknown> | null>;
}
const noop = () => {};
export function IntegrationBindingForm({
  schema,
  formRef,
}: IntegrationBindingFormProps) {
  const form = useForm({
    defaultValues: generateDefaultValues(schema),
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

interface IntegrationOauthProps extends IntegrationBindingFormProps {
  permissions: Permission[];
  integrationName: string;
  contract?: ContractState;
}

export function IntegrationOauth({
  permissions,
  integrationName,
  contract,
  schema,
  formRef,
}: IntegrationOauthProps) {
  return (
    <div className="space-y-6 py-4">
      {/* Permissions Section */}
      {permissions.length > 0 && (
        <IntegrationPermissions
          integrationName={integrationName}
          permissions={permissions}
        />
      )}

      {contract && contract.clauses.length > 0 && (
        <>
          <Separator />
          <ContractClauses contract={contract} />
        </>
      )}

      <Separator />

      {/* Configuration Form */}
      <IntegrationBindingForm schema={schema} formRef={formRef} />
    </div>
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
