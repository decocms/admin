import { useState } from "react";
import {
  useCreateAPIKey,
  useCreateIntegration,
  useGetRegistryApp,
  useInstallFromMarketplace,
} from "@deco/sdk/hooks";
import type { Integration } from "@deco/sdk/models";
import type { JSONSchema7 } from "json-schema";

interface InstallState {
  isModalOpen: boolean;
  stateSchema?: JSONSchema7;
  integrationName?: string;
  integration?: Integration;
  appName?: string;
  appId?: string;
  provider?: string;
}

export function useIntegrationInstallWithModal() {
  const [installState, setInstallState] = useState<InstallState>({
    isModalOpen: false,
  });

  const installMutation = useInstallFromMarketplace();
  const createIntegration = useCreateIntegration();
  const createAPIKey = useCreateAPIKey();
  const getRegistryApp = useGetRegistryApp();

  const handleInstall = async (params: {
    appId: string;
    appName: string;
    provider: string;
    returnUrl: string;
  }) => {
    try {
      const result = await installMutation.mutateAsync(params);

      // If we get a stateSchema, show the modal
      if (result.stateSchema) {
        setInstallState({
          isModalOpen: true,
          stateSchema: result.stateSchema as JSONSchema7,
          integrationName: params.appName,
          integration: result.integration,
          appName: params.appName,
          provider: params.provider,
        });
      } else if (result.redirectUrl) {
        // Handle redirect URL as before
        globalThis.location.href = result.redirectUrl;
      }

      return result;
    } catch (error) {
      console.error("Installation failed:", error);
      throw error;
    }
  };

  const handleModalSubmit = async (formData: Record<string, unknown>) => {
    if (!installState.appName || !installState.provider) {
      throw new Error("Missing app name or provider");
    }

    try {
      // Step 1: Generate API key with required policies
      const installId = installState.integration?.id ?? crypto.randomUUID();
      const keyName = `${installState.appName}-${installId}`;

      const apiKey = await createAPIKey.mutateAsync({
        claims: {
          state: formData,
        },
        name: keyName,
        policies: [
          { effect: "allow", resource: "INTEGRATIONS_GET" },
          { effect: "allow", resource: "DATABASES_RUN_SQL" },
        ],
      });

      // Step 2: Get marketplace app info
      const marketplaceApp = await getRegistryApp.mutateAsync({
        name: installState.appName,
      });

      // Step 3: Create integration with marketplace info and API token
      const integrationData = {
        id: installId,
        name: marketplaceApp.name,
        description: marketplaceApp.description,
        icon: marketplaceApp.icon,
        connection: {
          ...marketplaceApp.connection,
          token: apiKey.value,
          // Merge form data into connection
          ...formData,
        }, // Type assertion to handle the connection type
      };

      await createIntegration.mutateAsync(integrationData);

      // Close modal after successful submission
      setInstallState((prev: InstallState) => ({
        ...prev,
        isModalOpen: false,
      }));

      // Step 4: Redirect to the connections page after a brief delay
      // This ensures all async operations are fully processed before redirect
      const redirectPath = `/connection/unknown:::${installId}`;
      globalThis.location.href = redirectPath;
    } catch (error) {
      console.error("Failed to complete setup:", error);
      throw error;
    }
  };

  const handleModalClose = () => {
    setInstallState((prev: InstallState) => ({ ...prev, isModalOpen: false }));
  };

  return {
    // Install function
    install: handleInstall,

    // Modal state and handlers
    modalState: {
      isOpen: installState.isModalOpen,
      schema: installState.stateSchema,
      integrationName: installState.integrationName,
      integration: installState.integration,
      onSubmit: handleModalSubmit,
      onClose: handleModalClose,
      isLoading: createAPIKey.isPending || getRegistryApp.isPending ||
        createIntegration.isPending,
    },

    // Mutation state
    isLoading: installMutation.isPending,
    error: installMutation.error,
  };
}
