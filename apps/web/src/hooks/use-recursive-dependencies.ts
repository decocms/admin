import { getRegistryApp, type Integration } from "@deco/sdk";
import {
  useIntegrations,
  useMarketplaceAppSchema,
  usePermissionDescriptions,
} from "@deco/sdk/hooks";
import type { JSONSchema7, JSONSchema7Definition } from "json-schema";
import { useEffect, useMemo, useRef, useState } from "react";
import { getAllScopes } from "../utils/scopes.ts";

export interface ContractClause {
  id: string;
  price: string | number;
  description?: string;
}

export interface ResolvedDependency {
  name: string; // Property name in schema
  appName: string; // App name like "@scope/app"
  schema: JSONSchema7;
  permissions: Array<{
    scope: string;
    description: string;
    app?: string;
  }>;
  isContract: boolean;
  contractClauses?: ContractClause[];
  availableAccounts: Integration[];
  isRequired: boolean;
  icon?: string;
  friendlyName?: string;
  description?: string;
}

const isDependency = (property: JSONSchema7Definition): boolean => {
  return (
    typeof property === "object" && property.properties?.__type !== undefined
  );
};

const getAppNameFromSchema = (schema: JSONSchema7Definition): string | null => {
  if (typeof schema === "object" && schema.properties?.__type) {
    const typeProperty = schema.properties.__type;
    if (typeof typeProperty === "object" && "const" in typeProperty) {
      return typeProperty.const as string;
    }
  }
  return null;
};

/**
 * Hook to recursively resolve all dependencies of an app
 */
export function useRecursiveDependencies(appName?: string) {
  const { data: installedIntegrations } = useIntegrations();
  const { data: appSchema, isLoading: appSchemaLoading } =
    useMarketplaceAppSchema(appName);
  const [dependencies, setDependencies] = useState<ResolvedDependency[]>([]);
  const [isResolving, setIsResolving] = useState(false);
  const resolvedAppsRef = useRef<Set<string>>(new Set());

  // Get all scopes for permissions
  const integrationSchema = appSchema?.schema as JSONSchema7 | undefined;
  const integrationScopes = appSchema?.scopes ?? [];
  const allScopes = useMemo(() => {
    if (!integrationSchema) return [];
    return getAllScopes(integrationScopes, integrationSchema);
  }, [integrationScopes, integrationSchema]);

  const { permissions: allPermissions, isLoading: permissionsLoading } =
    usePermissionDescriptions(allScopes);

  useEffect(() => {
    if (!appName) {
      setDependencies([]);
      resolvedAppsRef.current.clear();
      return;
    }

    if (!integrationSchema || appSchemaLoading || permissionsLoading) {
      setDependencies([]);
      return;
    }

    // Skip if we've already resolved this app
    if (resolvedAppsRef.current.has(appName)) {
      return;
    }

    const resolveDependencies = async () => {
      setIsResolving(true);
      try {
        const resolved: ResolvedDependency[] = [];
        const visited = new Set<string>();

        // Recursive function to resolve dependencies
        const resolveRecursive = async (
          schema: JSONSchema7,
          parentAppName: string,
          depth: number = 0,
        ): Promise<void> => {
          // Prevent infinite loops and limit depth
          if (depth > 10) return;

          const properties = schema.properties;
          if (!properties) return;

          for (const [propName, propSchema] of Object.entries(properties)) {
            if (!isDependency(propSchema)) continue;

            const depAppName = getAppNameFromSchema(propSchema);
            if (!depAppName) continue;

            // Skip if already processed
            if (visited.has(depAppName)) continue;
            visited.add(depAppName);

            try {
              // Fetch registry app for this dependency
              const depApp = await getRegistryApp({ name: depAppName });

              // Check if it's a contract
              const isContract = !!depApp.metadata?.contract;
              const contractClauses = isContract
                ? (depApp.metadata?.contract as { clauses?: ContractClause[] })
                    ?.clauses || []
                : undefined;

              // Get available accounts for this app
              const availableAccounts =
                installedIntegrations?.filter((integration) => {
                  return (
                    "appName" in integration &&
                    integration.appName === depAppName
                  );
                }) ?? [];

              // Get permissions for this specific dependency
              const depPermissions = allPermissions.filter(
                (perm) => perm.app === depAppName,
              );

              // Check if required
              const isRequired = schema.required?.includes(propName) ?? false;

              resolved.push({
                name: propName,
                appName: depAppName,
                schema: propSchema as JSONSchema7,
                permissions: depPermissions,
                isContract,
                contractClauses,
                availableAccounts,
                isRequired,
                icon: depApp.icon,
                friendlyName: depApp.friendlyName,
                description: depApp.description,
              });
            } catch (error) {
              console.error(
                `Failed to resolve dependency ${depAppName}:`,
                error,
              );
              // Continue with other dependencies
            }
          }
        };

        await resolveRecursive(integrationSchema, appName);
        setDependencies(resolved);
        resolvedAppsRef.current.add(appName);
      } catch (error) {
        console.error("Failed to resolve dependencies:", error);
        setDependencies([]);
        resolvedAppsRef.current.add(appName); // Mark as resolved even on error to prevent infinite retries
      } finally {
        setIsResolving(false);
      }
    };

    resolveDependencies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    appName,
    integrationSchema,
    appSchemaLoading,
    installedIntegrations,
    permissionsLoading,
  ]);

  return {
    dependencies,
    isLoading: appSchemaLoading || isResolving || permissionsLoading,
    permissions: allPermissions,
    schema: integrationSchema,
  };
}
