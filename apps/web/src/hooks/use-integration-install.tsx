import { getRegistryApp } from "@deco/sdk";
import {
  type PermissionDescription,
  RegistryApp,
  useCreateAPIKey,
  useCreateIntegration,
  useInstallFromMarketplace,
  useMarketplaceAppSchema,
  usePermissionDescriptions,
} from "@deco/sdk/hooks";
import type { Integration } from "@deco/sdk/models";
import { useMutation } from "@tanstack/react-query";
import type { JSONSchema7 } from "json-schema";
import { createPolicyStatements, getAllScopes } from "../utils/scopes.ts";

interface InstallState {
  scopes?: string[];
  stateSchema?: JSONSchema7;
  integrationName?: string;
  integration?: Integration;
  appName?: string;
  appId?: string;
  vendor?: string;
  provider?: string;
}

export const useInstallCreatingApiKeyAndIntegration = () => {
  const createAPIKey = useCreateAPIKey();
  const createIntegration = useCreateIntegration();

  const mutation = useMutation({
    mutationFn: async ({
      clientId,
      app,
      formData,
      scopes,
      installId: inlineInstallId,
    }: {
      clientId: string;
      app: RegistryApp;
      formData: Record<string, unknown>;
      scopes: string[];
      installId?: string;
    }) => {
      const installId = inlineInstallId ?? crypto.randomUUID();
      const keyName = `${app.name}-${installId}`;

      const appName = clientId;

      const apiKey = await createAPIKey.mutateAsync({
        claims: {
          state: formData,
          integrationId: installId,
          appName,
        },
        name: keyName,
        policies: createPolicyStatements(scopes ?? [], formData),
      });

      const integrationData = {
        id: installId,
        name: app.friendlyName ?? app.name,
        description: app.description,
        icon: app.icon,
        connection: {
          ...app.connection,
          token: apiKey.value,
          // Merge form data into connection
          state: formData,
        }, // Type assertion to handle the connection type
      };

      const integration = await createIntegration.mutateAsync({
        ...integrationData,
        clientIdFromApp: appName,
      });

      return integration;
    },
  });

  return mutation;
};

export interface IntegrationState {
  schema: JSONSchema7;
  scopes: string[];
  permissions: PermissionDescription[];
  isLoading: boolean;
}

export function useIntegrationInstallState(appName?: string): IntegrationState {
  const { data: appSchema, isLoading: appSchemaLoading } =
    useMarketplaceAppSchema(appName);

  const integrationSchema = appSchema?.schema as JSONSchema7;
  const integrationScopes = appSchema?.scopes ?? [];
  // Get dynamic permission descriptions for all scopes
  const allScopes = getAllScopes(integrationScopes, integrationSchema);
  const { permissions: dynamicPermissions, isLoading: permissionsLoading } =
    usePermissionDescriptions(allScopes);

  return {
    schema: integrationSchema,
    scopes: integrationScopes,
    permissions: dynamicPermissions,
    isLoading: appSchemaLoading || permissionsLoading,
  };
}

export function integrationNeedsApproval(integrationState: IntegrationState) {
  if (integrationState.isLoading) return true;

  const needsApproval =
    !!integrationState.schema && integrationState.schema.properties && Object.keys(integrationState.schema.properties).length > 0 ||
    (integrationState.scopes && integrationState.scopes.length > 0);

  return needsApproval;
}

export function useIntegrationInstall() {
  const installMutation = useInstallFromMarketplace();

  const installCreatingApiKeyAndIntegration =
    useInstallCreatingApiKeyAndIntegration();

  const setupAppOauth = async (
    formData: Record<string, unknown>,
    installState: InstallState,
  ) => {
    if (!installState.appName || !installState.provider) {
      throw new Error("Missing app name or provider");
    }

    try {
      // Step 1: Generate API key with required policies
      const installId = installState.integration?.id ?? crypto.randomUUID();
      // Step 2: Get marketplace app info
      const marketplaceApp = await getRegistryApp({
        name: installState.appName,
      });

      await installCreatingApiKeyAndIntegration.mutateAsync({
        clientId: installState.appName,
        app: marketplaceApp,
        formData,
        scopes: installState.scopes ?? [],
        installId,
      });
    } catch (error) {
      console.error("Failed to complete setup:", error);
      throw error;
    }
  };

  const handleInstall = async (
    params: {
      appId: string;
      appName: string;
      provider: string;
      returnUrl: string;
    },
    formData: Record<string, unknown> | null,
  ) => {
    try {
      const result = await installMutation.mutateAsync(params);

      // If we get a stateSchema, show the modal
      if (result.stateSchema) {
        const scopes = result.scopes || [];

        const installState: InstallState = {
          stateSchema: result.stateSchema as JSONSchema7,
          scopes: scopes,
          integrationName: params.appName,
          integration: result.integration,
          appName: params.appName,
          provider: params.provider,
        };

        if (formData) {
          await setupAppOauth(formData, installState);
        }
      }

      return result;
    } catch (error) {
      console.error("Installation failed:", error);
      throw error;
    }
  };

  return {
    install: handleInstall,
    isLoading:
      installMutation.isPending ||
      installCreatingApiKeyAndIntegration.isPending,
    error: installMutation.error,
  };
}
