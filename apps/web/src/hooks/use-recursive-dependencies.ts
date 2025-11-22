import {
  getRegistryApp,
  getMarketplaceAppSchema,
  type Integration,
} from "@deco/sdk";
import {
  useIntegrations,
  useMarketplaceAppSchema,
  usePermissionDescriptions,
  useSDK,
} from "@deco/sdk/hooks";
import type { JSONSchema7, JSONSchema7Definition } from "json-schema";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  getAllScopes,
  getAppNameFromSchemaDefinition,
} from "../utils/scopes.ts";

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

/**
 * Hook to recursively resolve all dependencies of an app
 */
export function useRecursiveDependencies(appName?: string) {
  const { locator } = useSDK();
  const { data: installedIntegrations } = useIntegrations();
  const { data: appSchema, isLoading: appSchemaLoading } =
    useMarketplaceAppSchema(appName);
  const [dependencies, setDependencies] = useState<ResolvedDependency[]>([]);
  const [isResolving, setIsResolving] = useState(false);

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
      return;
    }

    if (!integrationSchema || appSchemaLoading || permissionsLoading) {
      setDependencies([]);
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

          // Collect all dependency app names first
          const depAppNamesMap = new Map<string, { propName: string; propSchema: JSONSchema7 }>();
          
          for (const [propName, propSchema] of Object.entries(properties)) {
            if (!isDependency(propSchema)) continue;

            const depAppName = getAppNameFromSchemaDefinition(propSchema);
            if (!depAppName) continue;

            // Skip if already processed
            if (visited.has(depAppName)) continue;
            visited.add(depAppName);

            depAppNamesMap.set(depAppName, { propName, propSchema: propSchema as JSONSchema7 });
          }

          // Fetch all registry apps in parallel
          const depAppNames = Array.from(depAppNamesMap.keys());
          const depAppsResults = await Promise.allSettled(
            depAppNames.map(appName => getRegistryApp({ name: appName }))
          );

          // Process results
          for (let i = 0; i < depAppNames.length; i++) {
            const depAppName = depAppNames[i];
            const result = depAppsResults[i];
            
            if (result.status === 'rejected') {
              console.error(`Failed to resolve dependency ${depAppName}:`, result.reason);
              continue;
            }
            
            const depApp = result.value;
            const depInfo = depAppNamesMap.get(depAppName);
            if (!depInfo) continue;

            const { propName, propSchema } = depInfo;

            try {
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
                schema: propSchema,
                permissions: depPermissions,
                isContract,
                contractClauses,
                availableAccounts,
                isRequired,
                icon: depApp.icon,
                friendlyName: depApp.friendlyName,
                description: depApp.description,
              });

              // Recursively resolve nested dependencies
              try {
                const depAppSchemaData = await getMarketplaceAppSchema(
                  locator,
                  depAppName,
                );
                if (depAppSchemaData?.schema) {
                  const depSchema = depAppSchemaData.schema as JSONSchema7;
                  await resolveRecursive(depSchema, depAppName, depth + 1);
                }
              } catch (nestedError) {
                console.error(
                  `Failed to resolve nested dependencies for ${depAppName}:`,
                  nestedError,
                );
                // Continue with other dependencies
              }
            } catch (error) {
              console.error(
                `Failed to process dependency ${depAppName}:`,
                error,
              );
              // Continue with other dependencies
            }
          }
        };

        await resolveRecursive(integrationSchema, appName);
        setDependencies(resolved);
      } catch (error) {
        console.error("Failed to resolve dependencies:", error);
        setDependencies([]);
      } finally {
        setIsResolving(false);
      }
    };

    resolveDependencies();
  }, [
    appName,
    integrationSchema,
    appSchemaLoading,
    installedIntegrations,
    permissionsLoading,
    allPermissions,
    locator,
  ]);

  return {
    dependencies,
    isLoading: appSchemaLoading || isResolving || permissionsLoading,
    permissions: allPermissions,
    schema: integrationSchema,
  };
}
