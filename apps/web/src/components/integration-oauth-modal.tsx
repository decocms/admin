import type React from "react";
import { FormProvider, useForm } from "react-hook-form";
import { Button } from "@deco/ui/components/button.tsx";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@deco/ui/components/dialog.tsx";
import type { JSONSchema7 } from "json-schema";
import JsonSchemaForm, { type OptionItem } from "./json-schema/index.tsx";
import { generateDefaultValues } from "./json-schema/utils/generate-default-values.ts";
import {
  getRegistryApp,
  type Integration,
  listIntegrations,
  useSDK,
} from "@deco/sdk";

interface IntegrationOAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  schema: JSONSchema7;
  integrationName: string;
  onSubmit: (data: Record<string, unknown>) => Promise<void>;
  isLoading?: boolean;
}

export function IntegrationOAuthModal({
  isOpen,
  onClose,
  schema,
  integrationName,
  onSubmit,
  isLoading = false,
}: IntegrationOAuthModalProps) {
  const { workspace } = useSDK();
  const form = useForm({
    defaultValues: generateDefaultValues(schema),
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const data = form.getValues();

    try {
      await onSubmit(data);
      onClose();
    } catch (error) {
      console.error("Error submitting OAuth form:", error);
      // TODO: Show error to user
    }
  };

  const optionsLoader = async (type: string): Promise<OptionItem[]> => {
    try {
      // Fetch installed integrations from workspace
      const installedIntegrations = await listIntegrations(workspace);

      // Try to get registry app information for the type to understand what we're looking for
      const registryApp = await getRegistryApp(workspace, { name: type });

      // Filter integrations based on the type
      const matchingIntegrations = installedIntegrations.filter(
        (integration: Integration) => {
          // Match by name (case-insensitive)
          return integration.connection.type === "HTTP" &&
            registryApp.connection.type === "HTTP" &&
            integration.connection.url === registryApp.connection.url;
        },
      );

      // Convert to OptionItem format with icons
      return matchingIntegrations.map((integration: Integration) => ({
        value: integration.id,
        label: integration.name,
        icon: integration.icon,
      }));
    } catch (error) {
      console.error("Error loading integration options:", error);
      return [];
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Complete {integrationName} Setup
          </DialogTitle>
        </DialogHeader>

        <div className="py-4">
          <FormProvider {...form}>
            <JsonSchemaForm
              schema={schema}
              form={form}
              onSubmit={handleSubmit}
              optionsLoader={optionsLoader}
              submitButton={
                <Button
                  type="submit"
                  disabled={form.formState.isSubmitting || isLoading}
                >
                  {form.formState.isSubmitting || isLoading
                    ? "Completing Setup..."
                    : "Complete Setup"}
                </Button>
              }
            />
          </FormProvider>
        </div>
      </DialogContent>
    </Dialog>
  );
}
